/** 每日打卡模块类型定义，与后端 docs/interfaces/daily.md 系列接口对应 */

/** 单条每日打卡（饮水/步数/睡眠各自独立覆盖） */
export interface DailyCheckin {
  id: number
  /** yyyy-MM-dd */
  date: string
  waterCups: number | null
  steps: number | null
  sleepHours: number | null
  sleepQuality: number | null
  updateTime: string | null
}

/** 汇总统计（7 天均值的分母为各自有值的天数） */
export interface DailySummary {
  recordedDays: number
  avgWater7: number | null
  avgSteps7: number | null
  avgSleep7: number | null
}

/** GET /daily/recent 返回体 */
export interface DailyRecent {
  records: DailyCheckin[]
  summary: DailySummary
  days: number
}

/** POST /daily/checkin 请求体：非 null 字段才覆盖 */
export interface DailyCheckinDTO {
  date?: string
  waterCups?: number
  steps?: number
  sleepHours?: number
  sleepQuality?: number
}
