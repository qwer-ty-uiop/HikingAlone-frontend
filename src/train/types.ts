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

/** 周期类型：0 不重复 1 每天 2 每周 3 每月 4 每年 */
export type CycleType = 0 | 1 | 2 | 3 | 4

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
  /** 剩余任务量（目标值-已完成，已达标为 0）；打卡输入/拖拽的可用上限即此值 */
  remainValue: number
  done: boolean
}

/** 训练计划摘要（TrainingPlanVO，含每日记录） */
export interface TrainingPlan {
  id: number
  title: string
  description: string
  /** yyyy-MM-dd */
  startDate: string
  endDate: string
  status: PlanStatus
  /** 周期类型：0 不重复 1 每天 2 每周 3 每月 4 每年 */
  cycleType: CycleType
  /** 周期锚点：每周=星期(1周一~7周日)；每月=日(1~31)；每年=月*100+日；null=默认锚点 */
  cycleAnchor: number | null
  /** 当前周期起始（周期计划；非周期为 null） */
  periodStart: string | null
  /** 当前周期结束（周期计划；非周期为 null） */
  periodEnd: string | null
  /** 0-100（周期计划为本期进度） */
  progress: number
  items: TrainingItem[]
  /** 提交记录（append 模型，每次提交一条；按日期升序，同日多条按 createTime 升序；未提交的天不返回） */
  records: PlanRecord[]
}

/** 热力图单日记录（count = 当天记录条数） */
export interface HeatmapDay {
  date: string
  count: number
}

export interface HeatmapData {
  year: number
  /** 该年份提交总次数（全年每天 count 之和） */
  totalCount: number
  days: HeatmapDay[]
}

/** GET /train 聚合返回体 */
export interface TrainHomeData {
  plans: TrainingPlan[]
  heatmap: HeatmapData
}

/** 打卡记录（每次提交一条） */
export interface PlanRecord {
  id: number
  date: string
  itemId: number
  completedSets: number
  completedTimes: number
  /** 本次提交时间（yyyy-MM-dd'T'HH:mm:ss），用于「最近提交」从新到旧排序 */
  createTime: string | null
  /** 最近编辑时间（yyyy-MM-dd'T'HH:mm:ss）；未编辑过为 null */
  updateTime: string | null
}

/** 计划详情（TrainingPlanDetailVO = TrainingPlanVO 结构，无额外字段） */
export interface TrainingPlanDetail extends TrainingPlan {}

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
  cycleType: CycleType
  /** 每周=星期(1周一~7周日)；每月=日(1~31)；每年=月*100+日；null=默认锚点 */
  cycleAnchor: number | null
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

/** POST /train/plans/update 请求体中的训练项 */
export interface PlanItemUpdateDTO {
  /** 非空=更新对应训练项；null=新增 */
  id: number | null
  name: string
  mode: ItemMode
  totalTimes: number | null
  totalSets: number | null
  unit: string
}

/** POST /train/plans/update 请求体（PlanUpdateDTO） */
export interface PlanUpdateDTO {
  id: number
  title: string
  description: string
  startDate: string
  endDate: string
  cycleType: CycleType
  /** 每周=星期(1周一~7周日)；每月=日(1~31)；每年=月*100+日；null=默认锚点 */
  cycleAnchor: number | null
  items: PlanItemUpdateDTO[]
}

/** POST /train/plans/abandon 请求体（PlanAbandonDTO） */
export interface PlanAbandonDTO {
  id: number
}

/** POST /train/plans/delete 请求体（PlanDeleteDTO） */
export interface PlanDeleteDTO {
  id: number
}

/** POST /train/records/update 请求体（RecordUpdateDTO） */
export interface RecordUpdateDTO {
  id: number
  completedSets: number
  completedTimes: number | null
}
