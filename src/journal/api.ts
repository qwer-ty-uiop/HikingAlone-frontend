import { request, qs } from '../api/request'
import type { JournalDetail, JournalItem, JournalSaveDTO, JournalSummary } from './types'

export const journalApi = {
  /** POST /journal 新建日记（关联轨迹可自动带出缺失指标），返回落库后的列表项 VO */
  create: (dto: JournalSaveDTO) =>
    request<JournalItem>('/journal', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /journal/update 编辑日记（全量替换记述内容） */
  update: (dto: JournalSaveDTO) =>
    request<JournalItem>('/journal/update', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /journal/delete 删除日记（物理删除，不影响关联轨迹） */
  remove: (id: number) =>
    request<void>('/journal/delete', { method: 'POST', body: JSON.stringify({ id }) }),

  /** GET /journal/list 最近日记（limit 缺省 50，后端钳制 1~200） */
  list: (limit?: number) => request<JournalItem[]>(`/journal/list${qs({ limit })}`),

  /** GET /journal/{id} 日记详情 */
  get: (id: number) => request<JournalDetail>(`/journal/${id}`),

  /** GET /journal/summary 汇总统计 */
  summary: () => request<JournalSummary>('/journal/summary'),
}
