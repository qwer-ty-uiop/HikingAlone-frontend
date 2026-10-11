/** 知识库模块类型定义，与后端 docs/interfaces/knowledge.md 对应 */

export interface KnowledgeNote {
  id: number
  title: string
  /** 分类 1~7 */
  category: number
  categoryLabel: string
  content: string
  /** 0 普通 / 1 置顶 */
  pinned: number
  createTime: string | null
  updateTime: string | null
}

export interface KnowledgeSaveDTO {
  id?: number
  title: string
  category: number
  content: string
  pinned?: number
}
