/** 徒步日记模块类型定义，与后端 docs/interfaces/journal.md 系列接口对应 */

/** 日记列表项（正文截断为预览） */
export interface JournalItem {
  id: number
  title: string
  /** yyyy-MM-dd */
  hikeDate: string
  routeId: number | null
  routeName: string | null
  distanceKm: number | null
  durationMin: number | null
  elevationGain: number | null
  /** 难度 1休闲 2轻松 3进阶 4挑战 5地狱 */
  difficulty: number
  /** 心情 1疲惫 2平静 3愉悦 4兴奋 5震撼 */
  mood: number
  weather: string | null
  companions: string | null
  cost: number | null
  contentPreview: string | null
}

/** 日记详情（完整正文） */
export interface JournalDetail extends JournalItem {
  content: string | null
  createTime: string | null
  updateTime: string | null
}

/** 汇总统计 */
export interface JournalSummary {
  totalCount: number
  totalDistanceKm: number
  totalDurationMin: number
  totalElevationGain: number
  totalCost: number
  thisYearCount: number
  thisYearDistanceKm: number
  maxSingleDistanceKm: number | null
  lastHikeDate: string | null
}

/** 新建/编辑请求体（编辑额外带 id） */
export interface JournalSaveDTO {
  id?: number
  title: string
  hikeDate: string
  routeId?: number
  distanceKm?: number
  durationMin?: number
  elevationGain?: number
  difficulty: number
  mood: number
  weather?: string
  companions?: string
  cost?: number
  content?: string
}
