import { request, qs } from '../api/request'
import type { Goal, GoalCreateDTO, GoalUpdateDTO } from './types'

export const goalApi = {
  /** GET /goal/list 某年目标（含读时进度）；year 缺省当前年 */
  list: (year?: number) => request<Goal[]>(`/goal/list${qs({ year })}`),

  /** POST /goal 新建目标（同期同指标查重） */
  create: (dto: GoalCreateDTO) =>
    request<Goal>('/goal', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /goal/update 编辑目标（只许改 target/status） */
  update: (dto: GoalUpdateDTO) =>
    request<Goal>('/goal/update', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /goal/delete 删除目标 */
  remove: (id: number) =>
    request<void>('/goal/delete', { method: 'POST', body: JSON.stringify({ id }) }),
}
