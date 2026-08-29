/** 路线轨迹模块类型定义，与后端 interfaces/route 系列接口对应 */

/** 轨迹点（与后端 RouteCreateDTO.Point / RouteTrackDetailVO.PointVO 对应） */
export interface RoutePoint {
  /** 经度 */
  lng: number
  /** 纬度 */
  lat: number
  /** 高程（米），可 null */
  ele: number | null
  /** 时间点（yyyy-MM-dd'T'HH:mm:ss），可 null */
  time: string | null
}

/** 途径点/命名标注点（与后端 RouteCreateDTO.Waypoint / RouteTrackDetailVO.WaypointVO 对应） */
export interface RouteWaypoint {
  /** 经度 */
  lng: number
  /** 纬度 */
  lat: number
  /** 高程（米），可 null */
  ele: number | null
  /** 标注名称（起点、补给点、山头名等），无名称为空字符串 */
  name: string
}

/** 路线列表项（RouteTrackVO：摘要，不含轨迹点） */
export interface RouteTrack {
  id: number
  name: string
  description: string
  /** 总里程（公里） */
  distance: number
  /** 总时长（分钟） */
  durationMin: number
  /** 累计爬升（米） */
  elevationGain: number
  /** 轨迹点数 */
  pointCount: number
  /** 创建时间（yyyy-MM-dd'T'HH:mm:ss） */
  createTime: string
}

/** 路线详情（RouteTrackDetailVO：含完整轨迹点） */
export interface RouteTrackDetail {
  id: number
  name: string
  description: string
  distance: number
  durationMin: number
  elevationGain: number
  createTime: string
  points: RoutePoint[]
  /** 途径点/命名标注点（无则空数组） */
  waypoints: RouteWaypoint[]
}

/** POST /routes 请求体（RouteCreateDTO） */
export interface RouteCreateDTO {
  name: string
  description: string
  points: RoutePoint[]
  /** 途径点/命名标注点（无标注点传空数组） */
  waypoints: RouteWaypoint[]
}
