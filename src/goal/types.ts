/** 目标模块类型定义，与后端 docs/interfaces/goal.md 系列接口对应 */

export interface GoalProgress {
  current: number
  percent: number
  achieved: boolean
  periodEnded: boolean
  unit: string
}

export interface Goal {
  id: number
  /** 1月里程 2月次数 3月爬升 4年里程 5年次数 6年爬升 */
  metric: number
  metricLabel: string
  targetValue: number
  /** 1 月度 / 2 年度 */
  periodType: number
  year: number
  /** 月 1~12；年度为 0 */
  month: number
  /** 0 已放弃 / 1 进行中 */
  status: number
  progress: GoalProgress
}

export interface GoalCreateDTO {
  metric: number
  targetValue: number
  year: number
  month?: number
}

export interface GoalUpdateDTO {
  id: number
  targetValue?: number
  status?: number
}
