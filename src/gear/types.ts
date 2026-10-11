/** 装备模块类型定义，与后端 docs/interfaces/gear.md 系列接口对应 */

/** 装备台账条目 */
export interface GearItem {
  id: number
  name: string
  /** 品类 1~11 */
  category: number
  weightGrams: number | null
  brand: string | null
  note: string | null
  /** 0 已退役 / 1 在役 */
  status: number
  createTime: string | null
}

/** 打包清单条目（对装备库为快照式弱引用） */
export interface GearChecklistItem {
  id: number
  gearItemId: number | null
  name: string
  weightGrams: number | null
  /** 0 未打包 / 1 已打包 */
  checked: number
  sort: number
}

/** 打包清单（含全部条目） */
export interface GearChecklist {
  id: number
  title: string
  hikeDate: string | null
  note: string | null
  /** 0 准备中 / 1 已打包 / 2 已结束 */
  status: number
  createTime: string | null
  items: GearChecklistItem[]
}

export interface GearItemSaveDTO {
  name: string
  category: number
  weightGrams?: number
  brand?: string
  note?: string
}

export interface GearItemUpdateDTO extends GearItemSaveDTO {
  id: number
  status: number
}

export interface GearChecklistSaveDTO {
  title: string
  hikeDate?: string
  note?: string
}

export interface GearChecklistUpdateDTO {
  id: number
  /** 以下字段非 null 才覆盖（后端部分更新语义） */
  title?: string
  hikeDate?: string
  note?: string
  status?: number
}

export interface ChecklistItemAddDTO {
  checklistId: number
  gearItemId?: number
  name: string
  weightGrams?: number
}

export interface ChecklistItemUpdateDTO {
  id: number
  checked?: number
  name?: string
  weightGrams?: number
}

/** AI 装备建议（POST /gear/suggest）：source=LLM 个性化建议 / RULE 内置规则兜底 */
export interface GearSuggestItem {
  name: string
  /** 品类 1~11 */
  category: number
  weightGrams: number | null
  /** 1 必带 / 2 建议 / 3 可选 */
  priority: number
  reason: string
}

export interface GearSuggest {
  source: 'LLM' | 'RULE'
  model: string
  items: GearSuggestItem[]
  packingTips: string[]
}

export interface GearSuggestDTO {
  routeId?: number
  days?: number
  distanceKm?: number
  month?: number
  extra?: string
}

/** 常用装备目录条目（GET /gear/catalog 联想数据，平台级共享只读） */
export interface GearCatalogItem {
  id: number
  name: string
  /** 品类 1~11 */
  category: number
  weightGrams: number | null
}
