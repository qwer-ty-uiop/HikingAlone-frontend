/** 起点（地址搜索选择后打点） */
export interface StartPoint {
  name: string
  location: [number, number]
  city?: string
}

/** POI 搜索结果条目 */
export interface PoiItem {
  id: string
  name: string
  address: string
  location: [number, number]
  /** 距起点的距离（米），仅周边搜索时有 */
  distance?: number
  type?: string
  tel?: string
}

/** 出行方式 */
export type RouteMode = 'driving' | 'walking' | 'transit' | 'riding'

/** 路径规划结果摘要 */
export interface RouteSummary {
  mode: RouteMode
  /** 距离（米） */
  distance: number
  /** 预计耗时（秒） */
  time: number
  /** 费用（元），仅驾车/公交有 */
  cost?: number
  /** 分段描述（如公交换乘明细） */
  lines: string[]
}

/** 分类 Tab（来自 poi-categories.json） */
export interface Category {
  id: string
  name: string
  icon: string
  children: { name: string; keyword: string }[]
}
