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
