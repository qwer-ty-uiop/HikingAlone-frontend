/** 训练模块类型定义，与后端 docs/interfaces/training.md 及 GET /train 系列接口对应 */

/** 后端统一返回包装（对应 Result<T>） */
export interface Result<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

/** 计划状态：0 已放弃 1 进行中 2 已完成 3 已过期 */
export type PlanStatus = 0 | 1 | 2 | 3

/** 训练项模式：times 按次数、sets 按次数+组数 */
export type ItemMode = 'times' | 'sets'

/** 计划内训练项（TrainingPlanItemVO） */
export interface TrainingItem {
  id: number
  name: string
  mode: ItemMode
  totalTimes: number | null
  totalSets: number | null
  unit: string
  /** 累计完成值（times=累计次数，sets=累计组数） */
  doneValue: number
  done: boolean
}

/** 训练计划摘要（TrainingPlanVO） */
export interface TrainingPlan {
  id: number
  title: string
  description: string
  /** yyyy-MM-dd */
  startDate: string
  endDate: string
  status: PlanStatus
  /** 0-100 */
  progress: number
  items: TrainingItem[]
}

/** 热力图单日记录（count = 当天记录条数） */
export interface HeatmapDay {
  date: string
  count: number
}

export interface HeatmapData {
  year: number
  days: HeatmapDay[]
}

/** GET /train 聚合返回体 */
export interface TrainHomeData {
  plans: TrainingPlan[]
  heatmap: HeatmapData
}

/** 打卡记录 */
export interface PlanRecord {
  date: string
  itemId: number
  completedSets: number
  completedTimes: number
}

/** 计划详情（TrainingPlanDetailVO = 计划 + records） */
export interface TrainingPlanDetail extends TrainingPlan {
  records: PlanRecord[]
}

/** POST /train/plans 请求体中的训练项 */
export interface PlanItemCreateDTO {
  name: string
  mode: ItemMode
  totalTimes: number | null
  totalSets: number | null
  unit: string
}

/** POST /train/plans 请求体（PlanCreateDTO） */
export interface PlanCreateDTO {
  title: string
  description: string
  startDate: string
  endDate: string
  items: PlanItemCreateDTO[]
}

/** POST /train/records 请求体（RecordCreateDTO） */
export interface RecordCreateDTO {
  planId: number
  itemId: number
  recordDate: string
  completedSets: number
  /** sets 模式不传则后端默认取计划项 totalTimes */
  completedTimes: number | null
}
