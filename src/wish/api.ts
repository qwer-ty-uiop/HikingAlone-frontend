import { request } from '../api/request'
import type { Wish, WishCompleteDTO, WishSaveDTO, WishSummary } from './types'

export const wishApi = {
  /** GET /wish/list 全量心愿（状态升序 + 优先级降序） */
  list: () => request<Wish[]>('/wish/list'),

  /** GET /wish/summary 各状态数量 */
  summary: () => request<WishSummary>('/wish/summary'),

  /** POST /wish 新建心愿 */
  create: (dto: WishSaveDTO) => request<Wish>('/wish', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /wish/update 编辑心愿（status 仅允许 0↔1） */
  update: (dto: WishSaveDTO) =>
    request<Wish>('/wish/update', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /wish/complete 标记完成（可挂日记） */
  complete: (dto: WishCompleteDTO) =>
    request<Wish>('/wish/complete', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /wish/giveUp 放弃 */
  giveUp: (id: number) =>
    request<Wish>('/wish/giveUp', { method: 'POST', body: JSON.stringify({ id }) }),

  /** POST /wish/delete 删除 */
  remove: (id: number) =>
    request<void>('/wish/delete', { method: 'POST', body: JSON.stringify({ id }) }),
}
