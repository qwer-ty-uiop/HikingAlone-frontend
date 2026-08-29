import { gpx as gpxToGeo, kml as kmlToGeo } from '@tmcw/togeojson'
import type { RoutePoint, RouteWaypoint } from './types'

/** 支持的轨迹文件类型 */
export type TrackFileType = 'gpx' | 'kml'

/** 按文件扩展名识别轨迹类型；不识别返回 null */
export function detectTrackType(fileName: string): TrackFileType | null {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'gpx') return 'gpx'
  if (ext === 'kml') return 'kml'
  return null
}

/** 解析结果：轨迹点（画线）+ 途径点（命名标注，来自 GPX wpt / KML Point） */
export interface ParsedTrack {
  points: RoutePoint[]
  waypoints: RouteWaypoint[]
}

/**
 * 解析轨迹文件文本 → 轨迹点 + 命名途径点
 * <p>GPX 与 KML 都用 @tmcw/togeojson 转 GeoJSON：
 * LineString（含 KML gx:Track，时间序列在 properties.coordTimes）→ 轨迹点；
 * Point（GPX wpt、KML 标注点 Placemark，名称在 properties.name）→ 途径点。
 * 两种格式坐标顺序一致（lng, lat, ele），抽点逻辑共用。</p>
 * <p>无轨迹段时 points 为空数组；格式不支持时抛错。</p>
 */
export function parseTrackFile(fileName: string, text: string): ParsedTrack {
  const type = detectTrackType(fileName)
  if (!type) {
    throw new Error(`不支持的轨迹文件类型：${fileName}`)
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const geo = type === 'gpx' ? gpxToGeo(doc) : kmlToGeo(doc)
  const points: RoutePoint[] = []
  const waypoints: RouteWaypoint[] = []
  for (const feature of geo.features) {
    const geometry = feature.geometry
    if (!geometry) continue

    if (geometry.type === 'LineString') {
      const times = (feature.properties?.coordTimes as string[] | undefined) ?? []
      geometry.coordinates.forEach((coord, i) => {
        const [lng, lat, ele] = coord
        points.push({
          lng,
          lat,
          ele: typeof ele === 'number' ? ele : null,
          time: times[i] ? toLocalIso(times[i]) : null,
        })
      })
    } else if (geometry.type === 'Point') {
      const [lng, lat, ele] = geometry.coordinates
      // 跳过非法坐标与 [0,0] 坏点
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      if (lng === 0 && lat === 0) continue
      const rawName = feature.properties?.name
      waypoints.push({
        lng,
        lat,
        ele: typeof ele === 'number' ? ele : null,
        name: typeof rawName === 'string' ? rawName.trim() : '',
      })
    }
  }
  return { points, waypoints }
}

/** 时间（UTC，带 Z）→ 本地 ISO（去 Z，供后端 LocalDateTime 解析；首尾时间差不变） */
function toLocalIso(utc: string): string {
  return utc.replace(/\.\d+Z$/, '').replace(/Z$/, '')
}

/** Haversine 球面距离（公里） */
export function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const r = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng
  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** 总里程（公里），相邻点逐段累加 */
export function totalDistanceKm(points: RoutePoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i])
  return total
}

/** 总时长（分钟）：首尾时间戳差；缺时间戳或未递增为 0 */
export function totalDurationMin(points: RoutePoint[]): number {
  const first = points[0]?.time
  const last = points[points.length - 1]?.time
  if (!first || !last) return 0
  const ms = Date.parse(last) - Date.parse(first)
  if (!(ms > 0)) return 0
  return Math.round(ms / 60000)
}

/** 累计爬升（米）：相邻点高程正向差累加；缺高程跳过该段 */
export function totalElevationGain(points: RoutePoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].ele
    const cur = points[i].ele
    if (prev == null || cur == null) continue
    const delta = cur - prev
    if (delta > 0) total += delta
  }
  return total
}
