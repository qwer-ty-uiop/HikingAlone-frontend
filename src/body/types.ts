/** 身体数据模块类型定义，与后端 docs/interfaces/body.md 系列接口对应 */

/** 单条身体数据记录（每用户每天一条，同日重复提交覆盖更新） */
export interface BodyMetricRecord {
  id: number
  /** yyyy-MM-dd */
  date: string
  /** 体重 kg（1 位小数） */
  weightKg: number
  /** 晨起静息心率 次/分（可空） */
  restingHeartRate: number | null
  /** 备注（可空） */
  note: string | null
  /** 最近修改时间（yyyy-MM-dd'T'HH:mm:ss，未修改过为 null） */
  updateTime: string | null
}

/** 汇总统计（后端跨记录计算） */
export interface BodyMetricSummary {
  /** 最近一条记录的体重；无记录时 null */
  latestWeight: number | null
  /** 倒数第二条记录的体重；不足两条时 null */
  prevWeight: number | null
  /** latest - prev，负数=下降；不足两条时 null */
  weightDelta: number | null
  /** 查询区间内有记录的天数 */
  recordedDays: number
  /** 连续记录天数（今天未记录则从昨天起算） */
  streakDays: number
}

/** GET /body/recent 返回体：区间内升序记录 + 汇总 */
export interface BodyMetricRecent {
  records: BodyMetricRecord[]
  summary: BodyMetricSummary
  /** 本次查询的天数窗口 */
  days: number
}

/** POST /body/record 请求体（date 缺省=今天） */
export interface BodyMetricRecordDTO {
  date?: string
  weightKg: number
  restingHeartRate?: number
  note?: string
}
