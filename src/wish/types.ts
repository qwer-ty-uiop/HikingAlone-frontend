/** 心愿单模块类型定义，与后端 docs/interfaces/wish.md 系列接口对应 */

export interface Wish {
  id: number
  title: string
  location: string | null
  /** yyyy-MM-dd，可空 */
  expectedDate: string | null
  /** 1 随缘 / 2 想去 / 3 一定要去 */
  priority: number
  note: string | null
  /** 0 想去 / 1 已计划 / 2 已完成 / 3 已放弃 */
  status: number
  doneDate: string | null
  journalId: number | null
  journalTitle: string | null
  createTime: string | null
  updateTime: string | null
}

export interface WishSummary {
  wishCount: number
  plannedCount: number
  doneCount: number
  givenUpCount: number
}

export interface WishSaveDTO {
  id?: number
  title: string
  location?: string
  expectedDate?: string
  priority?: number
  note?: string
  status?: number
}

export interface WishCompleteDTO {
  id: number
  doneDate?: string
  journalId?: number
}
