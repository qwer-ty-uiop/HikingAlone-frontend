import { request, qs } from '../api/request'
import type { KnowledgeNote, KnowledgeSaveDTO } from './types'

export const knowledgeApi = {
  /** GET /knowledge/list 笔记列表（关键词 + 分类过滤，置顶在前） */
  list: (keyword?: string, category?: number) =>
    request<KnowledgeNote[]>(`/knowledge/list${qs({ keyword, category })}`),

  /** POST /knowledge 新建笔记 */
  create: (dto: KnowledgeSaveDTO) =>
    request<KnowledgeNote>('/knowledge', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /knowledge/update 编辑笔记（非 null 覆盖，可置顶） */
  update: (dto: KnowledgeSaveDTO) =>
    request<KnowledgeNote>('/knowledge/update', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /knowledge/delete 删除笔记 */
  remove: (id: number) =>
    request<void>('/knowledge/delete', { method: 'POST', body: JSON.stringify({ id }) }),
}
