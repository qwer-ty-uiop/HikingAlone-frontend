/** 年度统计模块类型定义，与后端 docs/interfaces/stats.md 对应 */

export interface MonthlyPoint {
  month: number
  hikeCount: number
  distanceKm: number
}

export interface YearlyStats {
  year: number
  hikeCount: number
  totalDistanceKm: number
  totalDurationMin: number
  totalElevationGain: number
  totalCost: number
  maxSingleDistanceKm: number | null
  maxSingleElevationGain: number | null
  firstHikeDate: string | null
  monthly: MonthlyPoint[]
}

export interface AvailableYear {
  year: number
  hikeCount: number
}
