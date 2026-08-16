import { useCallback, useEffect, useRef, useState } from 'react'
import SidePanel from './SidePanel'
import PoiListPanel from './PoiListPanel'
import PoiDetailCard from './PoiDetailCard'
import type { Category, PoiItem, RouteMode, RouteSummary, StartPoint } from './types'

/** 默认地图中心：北京天安门 */
const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923]
/** 周边搜索半径（米） */
const SEARCH_RADIUS = 3000
const POI_PAGE_SIZE = 20

/** 兼容数组 / "lng,lat" 字符串 / AMap.LngLat 三种坐标形式 */
function parseLocation(loc: any): [number, number] | null {
  if (!loc) return null
  if (Array.isArray(loc)) {
    const lng = Number(loc[0])
    const lat = Number(loc[1])
    return isFinite(lng) && isFinite(lat) ? [lng, lat] : null
  }
  if (typeof loc === 'string' && loc.includes(',')) {
    const [lng, lat] = loc.split(',').map(Number)
    return isFinite(lng) && isFinite(lat) ? [lng, lat] : null
  }
  if (typeof loc === 'object' && loc.lng != null && loc.lat != null) {
    return [Number(loc.lng), Number(loc.lat)]
  }
  return null
}

/** 从路径规划结果中提取摘要 */
function extractRouteSummary(mode: RouteMode, result: any): RouteSummary | null {
  if (mode === 'transit') {
    const plan = result.plans?.[0]
    if (!plan) return null
    const lines: string[] = []
    plan.segments?.forEach((seg: any) => {
      const t = seg.transit
      if (t) {
        const on = t.on_station?.name || ''
        const off = t.off_station?.name || ''
        lines.push(`${t.name || '公交'}${on && off ? `：${on} → ${off}` : ''}`)
      }
    })
    return {
      mode,
      distance: Number(plan.distance) || 0,
      time: Number(plan.time) || 0,
      cost: plan.cost != null ? Number(plan.cost) : undefined,
      lines: lines.length ? lines : ['直达'],
    }
  }

  const route = result.routes?.[0]
  if (!route) return null
  const lines = (route.steps || route.rides || [])
    .slice(0, 3)
    .map((s: any) => s.instruction || s.road || '')
    .filter(Boolean)
  return {
    mode,
    distance: Number(route.distance) || 0,
    time: Number(route.time) || 0,
    cost: mode === 'driving' && route.tolls > 0 ? Number(route.tolls) : undefined,
    lines,
  }
}

export default function PoiMapApp() {
  const mapRef = useRef<any>(null)
  const amapRef = useRef<any>(null)
  const startMarkerRef = useRef<any>(null)
  const poiMarkersRef = useRef<any[]>([])
  const highlightCircleRef = useRef<any>(null)
  const routeInstancesRef = useRef<Partial<Record<RouteMode, any>>>({})
  const handlePoiSelectRef = useRef<(poi: PoiItem) => void>(() => {})

  const [mapReady, setMapReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [startPoint, setStartPoint] = useState<StartPoint | null>(null)
  const [pois, setPois] = useState<PoiItem[]>([])
  const [selectedPoi, setSelectedPoi] = useState<PoiItem | null>(null)
  const [searching, setSearching] = useState(false)
  const [poiError, setPoiError] = useState('')
  const [routeMode, setRouteMode] = useState<RouteMode>('driving')
  const [routeResult, setRouteResult] = useState<RouteSummary | null>(null)
  const [routing, setRouting] = useState(false)
  const [routeError, setRouteError] = useState('')

  const poisRef = useRef<PoiItem[]>([])
  useEffect(() => {
    poisRef.current = pois
  }, [pois])

  // ---------- 地图生命周期 ----------
  useEffect(() => {
    let cancelled = false
    const loader = window.AMapLoader
    if (!loader) {
      setLoadError('高德地图加载器(loader.js)未加载，请检查网络连接')
      return
    }
    const key = window.AMAP_CONFIG?.key
    if (!key || key.startsWith('YOUR_')) {
      setLoadError('请先在 public/env.js 中配置高德地图 key 与 securityJsCode')
      return
    }

    loader
      .load({
        key,
        version: '2.0',
        plugins: [
          'AMap.AutoComplete',
          'AMap.PlaceSearch',
          'AMap.Driving',
          'AMap.Walking',
          'AMap.Transfer',
          'AMap.Riding',
          'AMap.Scale',
          'AMap.ToolBar',
        ],
      })
      .then((AMap: any) => {
        if (cancelled) return
        const map = new AMap.Map('map-container', {
          viewMode: '3D',
          zoom: 15,
          center: DEFAULT_CENTER,
        })
        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: 'LT' }))
        mapRef.current = map
        amapRef.current = AMap
        setMapReady(true)
        // 初始状态：显示北京天安门并添加标记点（同时作为默认起点）
        addStartMarker(map, AMap, DEFAULT_CENTER)
        setStartPoint({ name: '天安门', location: DEFAULT_CENTER, city: '北京市' })
      })
      .catch((e: any) => {
        if (!cancelled) setLoadError('地图加载失败：' + (e?.message || String(e)))
      })

    return () => {
      cancelled = true
      mapRef.current?.destroy?.()
      mapRef.current = null
      amapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 分类数据 ----------
  useEffect(() => {
    fetch('/poi-categories.json')
      .then((r) => r.json())
      .then((data: Category[]) => {
        setCategories(data)
        if (data.length) setActiveCategoryId(data[0].id)
      })
      .catch(() => setPoiError('分类数据加载失败'))
  }, [])

  // ---------- 基础回调（按依赖顺序声明） ----------

  const addStartMarker = useCallback((map: any, AMap: any, location: [number, number]) => {
    if (startMarkerRef.current) map.remove(startMarkerRef.current)
    startMarkerRef.current = new AMap.Marker({
      position: location,
      content: `<div class="route-marker route-marker--start">起</div>`,
      offset: new AMap.Pixel(-15, -15),
      title: '起点',
      zIndex: 130,
    })
    map.add(startMarkerRef.current)
  }, [])

  const removeHighlight = useCallback(() => {
    const map = mapRef.current
    if (map && highlightCircleRef.current) map.remove(highlightCircleRef.current)
    highlightCircleRef.current = null
  }, [])

  const clearPoiResults = useCallback(() => {
    const map = mapRef.current
    if (map && poiMarkersRef.current.length) map.remove(poiMarkersRef.current)
    poiMarkersRef.current = []
    setPois([])
    removeHighlight()
  }, [removeHighlight])

  const clearRoutesAndResult = useCallback(() => {
    Object.values(routeInstancesRef.current).forEach((r: any) => {
      try {
        r?.clear?.()
      } catch {
        /* 忽略清理异常 */
      }
    })
    setRouteResult(null)
    setRouteError('')
  }, [])

  const renderPoiMarkers = useCallback((list: PoiItem[], selectedId: string | null) => {
    const map = mapRef.current
    const AMap = amapRef.current
    if (!map || !AMap) return
    if (poiMarkersRef.current.length) map.remove(poiMarkersRef.current)
    poiMarkersRef.current = list.map((poi, idx) => {
      const marker = new AMap.Marker({
        position: poi.location,
        content: `<div class="poi-marker${poi.id === selectedId ? ' poi-marker--active' : ''}">${idx + 1}</div>`,
        offset: new AMap.Pixel(-14, -14),
        title: poi.name,
        zIndex: poi.id === selectedId ? 120 : 100,
      })
      marker.on('click', () => handlePoiSelectRef.current(poi))
      map.add(marker)
      return marker
    })
  }, [])

  const handlePoiSelect = useCallback(
    (poi: PoiItem) => {
      const map = mapRef.current
      const AMap = amapRef.current
      if (!map || !AMap) return
      setSelectedPoi(poi)
      clearRoutesAndResult()
      // 高亮该 POI：高亮圆圈 + 标记高亮
      removeHighlight()
      highlightCircleRef.current = new AMap.Circle({
        center: poi.location,
        radius: 45,
        strokeColor: '#1677ff',
        strokeWeight: 2,
        strokeOpacity: 0.9,
        fillColor: '#1677ff',
        fillOpacity: 0.12,
      })
      map.add(highlightCircleRef.current)
      renderPoiMarkers(poisRef.current, poi.id)
      map.setZoomAndCenter(15, poi.location)
    },
    [clearRoutesAndResult, removeHighlight, renderPoiMarkers],
  )
  useEffect(() => {
    handlePoiSelectRef.current = handlePoiSelect
  }, [handlePoiSelect])

  const handleStartSelect = useCallback(
    (poi: { name: string; city?: string; location?: any }) => {
      const AMap = amapRef.current
      const map = mapRef.current
      if (!AMap || !map) return

      const apply = (loc: [number, number]) => {
        setStartPoint({ name: poi.name, location: loc, city: poi.city })
        addStartMarker(map, AMap, loc)
        map.setZoomAndCenter(14, loc)
        clearPoiResults()
        clearRoutesAndResult()
        setSelectedPoi(null)
      }

      const location = parseLocation(poi.location)
      if (location) {
        apply(location)
        return
      }
      // 输入提示未返回坐标时，用 POI 搜索兜底
      const placeSearch = new AMap.PlaceSearch({ pageSize: 1, city: poi.city || '' })
      placeSearch.search(poi.name, (status: string, result: any) => {
        const first = result?.poiList?.pois?.[0]
        if (status === 'complete' && first) {
          apply(parseLocation(first.location) || DEFAULT_CENTER)
        } else {
          setPoiError(`未找到「${poi.name}」的位置`)
        }
      })
    },
    [addStartMarker, clearPoiResults, clearRoutesAndResult],
  )

  const handleSubCategorySearch = useCallback(
    (keyword: string) => {
      const AMap = amapRef.current
      const map = mapRef.current
      if (!AMap || !map || !startPoint) return
      setSearching(true)
      setPoiError('')
      setSelectedPoi(null)
      clearRoutesAndResult()
      removeHighlight()

      const placeSearch = new AMap.PlaceSearch({
        pageSize: POI_PAGE_SIZE,
        pageIndex: 1,
        city: startPoint.city || '',
        citylimit: false,
        extensions: 'base',
      })
      placeSearch.searchNearBy(keyword, startPoint.location, SEARCH_RADIUS, (status: string, result: any) => {
        setSearching(false)
        const list = result?.poiList?.pois ?? []
        if (status !== 'complete' || !list.length) {
          setPoiError(`未找到「${keyword}」相关结果`)
          clearPoiResults()
          return
        }
        const pois: PoiItem[] = list.map((p: any) => ({
          id: p.id,
          name: p.name,
          address:
            p.address || [p.pname, p.cityname, p.adname].filter(Boolean).join('') || '暂无地址',
          location: parseLocation(p.location) || startPoint.location,
          distance: p.distance != null ? Number(p.distance) : undefined,
          type: p.type,
          tel: p.tel,
        }))
        setPois(pois)
        renderPoiMarkers(pois, null)
        map.setZoomAndCenter(13, startPoint.location)
      })
    },
    [startPoint, clearPoiResults, clearRoutesAndResult, removeHighlight, renderPoiMarkers],
  )

  // ---------- 路径规划 ----------
  const planRoute = useCallback(
    (mode: RouteMode) => {
      const AMap = amapRef.current
      const map = mapRef.current
      if (!AMap || !map || !startPoint || !selectedPoi) return
      setRouting(true)
      setRouteError('')
      setRouteResult(null)
      clearRoutesAndResult()

      const startLoc = startPoint.location
      const endLoc = selectedPoi.location

      let instance = routeInstancesRef.current[mode]
      if (!instance) {
        if (mode === 'driving') instance = new AMap.Driving({ map, policy: AMap.DrivingPolicy.LEAST_TIME })
        else if (mode === 'walking') instance = new AMap.Walking({ map })
        else if (mode === 'riding') instance = new AMap.Riding({ map })
        else
          instance = new AMap.Transfer({
            map,
            city: startPoint.city || '北京市',
            policy: AMap.TransferPolicy.LEAST_TIME,
          })
        routeInstancesRef.current[mode] = instance
      }

      instance.search(startLoc, endLoc, (status: string, result: any) => {
        setRouting(false)
        if (status !== 'complete' || !result) {
          setRouteError('路线规划失败，请重试')
          return
        }
        const summary = extractRouteSummary(mode, result)
        if (!summary) {
          setRouteError('未找到可行路线')
          return
        }
        setRouteResult(summary)
        map.setFitView()
      })
    },
    [startPoint, selectedPoi, clearRoutesAndResult],
  )

  const handleGoHere = useCallback(() => {
    if (!startPoint || !selectedPoi) return
    planRoute(routeMode)
  }, [startPoint, selectedPoi, routeMode, planRoute])

  const handleModeChange = useCallback(
    (mode: RouteMode) => {
      setRouteMode(mode)
      if (startPoint && selectedPoi) planRoute(mode)
    },
    [startPoint, selectedPoi, planRoute],
  )

  const handleCloseDetail = useCallback(() => {
    setSelectedPoi(null)
    removeHighlight()
    clearRoutesAndResult()
    renderPoiMarkers(poisRef.current, null)
  }, [removeHighlight, clearRoutesAndResult, renderPoiMarkers])

  // ---------- 渲染 ----------
  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* 地图容器 */}
      <div id="map-container" className="absolute inset-0" />

      {/* 加载 / 错误遮罩 */}
      {loadError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95">
          <div className="max-w-md mx-4 text-center">
            <p className="text-2xl mb-3">⚠️</p>
            <p className="text-red-600 font-medium mb-2">{loadError}</p>
            <p className="text-sm text-gray-500">
              地图 Key 申请方式：登录高德开放平台控制台 → 应用管理 → 创建「Web端(JS API)」Key
            </p>
          </div>
        </div>
      )}
      {!mapReady && !loadError && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80">
          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            地图加载中...
          </div>
        </div>
      )}

      {/* 左侧：POI 详情卡片 */}
      {selectedPoi && startPoint && (
        <PoiDetailCard
          poi={selectedPoi}
          startPoint={startPoint}
          routeMode={routeMode}
          routeResult={routeResult}
          routing={routing}
          routeError={routeError}
          onGoHere={handleGoHere}
          onModeChange={handleModeChange}
          onClose={handleCloseDetail}
        />
      )}

      {/* 底部：POI 列表 */}
      {pois.length > 0 && (
        <PoiListPanel
          pois={pois}
          selectedPoi={selectedPoi}
          searching={searching}
          error={poiError}
          onSelect={handlePoiSelect}
        />
      )}

      {/* 右侧：搜索 + 分类面板 */}
      <SidePanel
        startPoint={startPoint}
        amap={amapRef.current}
        mapReady={mapReady}
        categories={categories}
        activeCategoryId={activeCategoryId}
        onStartSelect={handleStartSelect}
        onTabClick={setActiveCategoryId}
        onSubSearch={handleSubCategorySearch}
        searching={searching}
      />
    </div>
  )
}
