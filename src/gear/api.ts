import { request } from '../api/request'
import type {
  ChecklistItemAddDTO,
  GearSuggest,
  GearSuggestDTO,
  ChecklistItemUpdateDTO,
  GearChecklist,
  GearChecklistSaveDTO,
  GearChecklistUpdateDTO,
  GearItem,
  GearItemSaveDTO,
  GearItemUpdateDTO,
} from './types'

export const gearItemApi = {
  /** GET /gear/items 全量装备（在役在前） */
  list: () => request<GearItem[]>('/gear/items'),

  /** POST /gear/items 新建装备（默认在役） */
  create: (dto: GearItemSaveDTO) =>
    request<GearItem>('/gear/items', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /gear/items/update 编辑装备（全量替换） */
  update: (dto: GearItemUpdateDTO) =>
    request<GearItem>('/gear/items/update', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /gear/items/delete 删除装备（不影响清单条目快照） */
  remove: (id: number) =>
    request<void>('/gear/items/delete', { method: 'POST', body: JSON.stringify({ id }) }),
}

export const gearChecklistApi = {
  /** GET /gear/checklists 全量清单（含条目） */
  list: () => request<GearChecklist[]>('/gear/checklists'),

  /** POST /gear/checklists 新建空清单 */
  create: (dto: GearChecklistSaveDTO) =>
    request<GearChecklist>('/gear/checklists', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /gear/checklists/update 编辑清单头（非 null 覆盖） */
  update: (dto: GearChecklistUpdateDTO) =>
    request<GearChecklist>('/gear/checklists/update', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /gear/checklists/delete 删除清单（级联删条目） */
  remove: (id: number) =>
    request<void>('/gear/checklists/delete', { method: 'POST', body: JSON.stringify({ id }) }),

  /** POST /gear/checklists/copy 复制清单（勾选清零） */
  copy: (id: number) =>
    request<GearChecklist>('/gear/checklists/copy', { method: 'POST', body: JSON.stringify({ id }) }),

  /** POST /gear/checklists/items/add 加条目 */
  addItem: (dto: ChecklistItemAddDTO) =>
    request<GearChecklist>('/gear/checklists/items/add', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /gear/checklists/items/update 更新条目（勾选/改名/改克重） */
  updateItem: (dto: ChecklistItemUpdateDTO) =>
    request<GearChecklist>('/gear/checklists/items/update', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  /** POST /gear/checklists/items/delete 删条目 */
  deleteItem: (id: number) =>
    request<GearChecklist>('/gear/checklists/items/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
}

export const gearSuggestApi = {
  /** POST /gear/suggest AI 装备建议（LLM 优先，未配置 key 自动降级内置规则，source 区分） */
  suggest: (dto: GearSuggestDTO) =>
    request<GearSuggest>('/gear/suggest', { method: 'POST', body: JSON.stringify(dto) }),
}
