import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  LngLatBounds,
  setWorkerUrl,
  type StyleSpecification,
  type CircleLayerSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// 让 Vite 把 maplibre 的 worker（及其 shared 依赖）整体打包成自包含 worker chunk 并拿到其 URL。
// 必须显式设置：maplibre v6 内部用 new URL('./maplibre-gl-worker.mjs', import.meta.url) 动态拼 worker 地址，
// 打包器无法静态分析，dev 预打包 / 生产构建都会丢失 worker，导致 GeoJSON 矢量数据（轨迹线）永远无法切片渲染
//（栅格底图是图片、不走 worker，所以只有轨迹线不显示）。
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { RoutePoint, RouteWaypoint } from './types'

// 模块加载即设置全局 worker URL，早于任何 new Map()，dev 与生产构建均生效
setWorkerUrl(maplibreWorkerUrl)

/**
 * 天地图（国家地理信息公共服务平台）底图，免费、国内访问快。
 * 坐标系为 CGCS2000，与 GPX 的 WGS-84 坐标在民用精度下重合，无需坐标转换。
 * - img_w 卫星影像（看地形/山脊/实际路径），Web 墨卡托投影（_w 后缀）
 * - cia_w 卫星影像注记叠加层（中文地名、道路名）
 *
 * 配额保护：天地图每 key 每天 1 万次，单图一次加载就是几十上百片（影像+注记两层）。
 * 瓦片内容不可变，因此走本站 /tdt 代理（线上 nginx proxy_cache 永久缓存、dev 走 vite proxy），
 * 首次回源后所有后续请求命中本地缓存，不再消耗天地图配额；同时 maxzoom 限 16（徒步无需 18 级）。
 * 不再使用 t0~t7 子域轮询——子域会打散缓存 key，缓存代理下单一域名更省配额。
 */
const TIANDITU_KEY = 'b3ae40b1aa340bdbd0d2b431068396f0'
function tdtTileUrl(layer: string): string {
  return `/tdt/DataServer?T=${layer}&x={x}&y={y}&l={z}&tk=${TIANDITU_KEY}`
}

const TIANDITU_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'tdt-img': {
      type: 'raster',
      tiles: [tdtTileUrl('img_w')],
      tileSize: 256,
      maxzoom: 16,
      attribution: '© 天地图 · 国家地理信息公共服务平台',
    },
    'tdt-cia': {
      type: 'raster',
      tiles: [tdtTileUrl('cia_w')],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    { id: 'tdt-img', type: 'raster', source: 'tdt-img' },
    { id: 'tdt-cia', type: 'raster', source: 'tdt-cia' },
  ],
}

/** 起点/终点圆点图层 */
function trackEndpointsLayer(sourceId: string): CircleLayerSpecification {
  return {
    id: 'track-endpoints',
    type: 'circle',
    source: sourceId,
    paint: {
      'circle-color': '#1e293b',
      'circle-radius': 5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  }
}

/** 过滤掉无效坐标点（NaN / 超出经纬度范围） */
function isValidPoint(p: RoutePoint): boolean {
  return (
    Number.isFinite(p.lng) &&
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  )
}

/**
 * 清洗轨迹点：移除 [0,0] 坏点和远离轨迹主体的离群点。
 * GPX 偶尔混入 lat=0/lng=0 脏数据，会导致 fitBounds 视野被拉到跨大洲级别，真实轨迹缩成不可见的点。
 * 策略：取经纬度中位数，过滤偏离中位数超过 0.5°（约 55km）的点——单日徒步轨迹跨度远小于此。
 */
function cleanTrackPoints(points: RoutePoint[]): RoutePoint[] {
  let valid = points.filter(isValidPoint)
  valid = valid.filter((p) => !(p.lat === 0 && p.lng === 0))
  if (valid.length < 2) return valid

  const sortedLats = valid.map((p) => p.lat).sort((a, b) => a - b)
  const sortedLngs = valid.map((p) => p.lng).sort((a, b) => a - b)
  const medianLat = sortedLats[Math.floor(sortedLats.length / 2)]
  const medianLng = sortedLngs[Math.floor(sortedLngs.length / 2)]

  return valid.filter(
    (p) => Math.abs(p.lat - medianLat) < 0.5 && Math.abs(p.lng - medianLng) < 0.5,
  )
}

interface RouteMapProps {
  points: RoutePoint[]
  /** 途径点/命名标注点（可选），以"文字标签 + 圆点"Marker 叠加在轨迹上 */
  waypoints?: RouteWaypoint[]
  className?: string
}

/** 标签常驻显示的关键名称（任意缩放层级都显示），其余标签放大后再显示，避免全览时 126 个标签重叠 */
const ALWAYS_LABEL = /^(起点|终点)$/

/** 文字标签在缩放层级 ≥ 该值时显示（全览只显示圆点，放大看细节时再展开名称，规避密集重叠） */
const LABEL_MIN_ZOOM = 13.5

/**
 * 构建途径点标注 DOM：上方白底文字标签 + 下方玫红圆点（白描边）。
 * 用 DOM Marker 而非 symbol 图层，规避 MapLibre 中文 glyph 字体依赖，系统字体直接渲染中文。
 * 标签节点与"是否常驻"挂在元素上，供缩放时统一切换显隐。
 */
function buildWaypointElement(wp: RouteWaypoint): HTMLElement {
  const el = document.createElement('div')
  // 配合 Marker({anchor:'bottom'})：整个标注（标签在上、圆点在下）的底边中点对准坐标，无需自行 transform
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:default;'

  let label: HTMLElement | null = null
  if (wp.name) {
    label = document.createElement('div')
    label.textContent = wp.name
    label.className =
      'mb-0.5 whitespace-nowrap rounded px-1.5 py-px text-[10px] font-semibold leading-4 text-slate-800 bg-white/90 shadow-sm border border-slate-200/80'
    if (wp.ele != null) label.title = `${wp.name} · 海拔 ${wp.ele.toFixed(0)}m`
    el.appendChild(label)
  }
  const dot = document.createElement('div')
  dot.style.cssText =
    'width:10px;height:10px;border-radius:9999px;background:#e11d48;border:2px solid #fff;box-sizing:border-box;box-shadow:0 0 0 1px rgba(0,0,0,0.18);'
  el.appendChild(dot)

  ;(el as unknown as { _label: HTMLElement | null })._label = label
  ;(el as unknown as { _always: boolean })._always = ALWAYS_LABEL.test(wp.name)
  return el
}

/** 天地图卫星底图 + 白色描边橙色轨迹线 + 起终点 + 途径点标注，自适应视野到整条路线 */
export default function RouteMap({ points, waypoints = [], className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || points.length < 2) return

    const map = new MapLibreMap({
      container,
      style: TIANDITU_STYLE,
      center: [points[0].lng, points[0].lat],
      zoom: 12,
      // 徒步轨迹无需天地图 18 级最深瓦片（该层级单屏瓦片最多、最耗配额），限到 16
      maxZoom: 16,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')

    // 途径点标注（DOM Marker，不依赖样式加载，直接叠加）；卸载时随地图销毁，这里单独记录以便显式移除
    const waypointMarkers = waypoints
      .filter((wp) => Number.isFinite(wp.lng) && Number.isFinite(wp.lat))
      .map((wp) => new Marker({ element: buildWaypointElement(wp), anchor: 'bottom' })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map))

    // 标签避让：低缩放只显示圆点（起点/终点除外），放大到 LABEL_MIN_ZOOM 后展开全部名称
    const updateLabelVisibility = () => {
      const showAll = map.getZoom() >= LABEL_MIN_ZOOM
      waypointMarkers.forEach((marker) => {
        const el = marker.getElement() as unknown as {
          _label: HTMLElement | null
          _always: boolean
        }
        if (!el._label) return
        el._label.style.display = showAll || el._always ? '' : 'none'
      })
    }
    map.on('zoom', updateLabelVisibility)
    const labelTimer = window.setTimeout(updateLabelVisibility, 500)

    // 轨迹渲染：清洗点 → 添加 geojson 图层（白色描边 + 橙色主线）→ 自适应视野
    const renderTrack = () => {
      // 守卫：防止 load / style.load / setTimeout 多次触发重复添加
      if (map.getSource('track')) return
      const cleanPoints = cleanTrackPoints(points)
      if (cleanPoints.length < 2) return
      // 天地图为 CGCS2000（≈WGS-84），与 GPX 一致，直接使用原始坐标
      const coords = cleanPoints.map((p) => [p.lng, p.lat] as [number, number])

      map.addSource('track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      })

      // 白色描边层（halo）：底层宽白线，让轨迹在深色卫星图/任何底图上都清晰可辨
      map.addLayer({
        id: 'track-halo',
        type: 'line',
        source: 'track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 7,
          'line-opacity': 0.9,
        },
      })

      // 橙色主线层：叠在白色描边之上，卫星地形上高对比、醒目（专业徒步 App 常用轨迹色）
      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f97316',
          'line-width': 4,
          'line-opacity': 1,
        },
      })

      // 起点/终点圆点
      map.addSource('track-points', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPoint',
            coordinates: [coords[0], coords[coords.length - 1]],
          },
        },
      })
      map.addLayer(trackEndpointsLayer('track-points'))

      // 自适应视野：下一帧先 resize 确保容器尺寸正确，再 fitBounds
      requestAnimationFrame(() => {
        map.resize()
        const bounds = new LngLatBounds()
        coords.forEach((c) => bounds.extend(c))
        map.fitBounds(bounds, { padding: 48, maxZoom: 15, animate: false })
      })
    }

    // 多重保险：已加载立即渲染；否则监听 load（瓦片完成）与 style.load（样式解析完成，更早）；
    // 再加 2s 兜底，应对任何事件未触发的极端情况。getSource 守卫保证只添加一次。
    if (map.loaded()) {
      renderTrack()
    } else {
      map.once('load', renderTrack)
    }
    map.once('style.load', renderTrack)
    const fallbackTimer = window.setTimeout(renderTrack, 2000)
    const resizeTimer = window.setTimeout(() => map.resize(), 300)

    return () => {
      window.clearTimeout(fallbackTimer)
      window.clearTimeout(resizeTimer)
      window.clearTimeout(labelTimer)
      map.off('zoom', updateLabelVisibility)
      waypointMarkers.forEach((marker) => marker.remove())
      map.remove()
      mapRef.current = null
    }
  }, [points, waypoints])

  return <div ref={containerRef} className={className} />
}
