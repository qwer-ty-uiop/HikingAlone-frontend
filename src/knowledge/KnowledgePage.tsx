import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Notebook,
  Plus,
  PencilSimple,
  Trash,
  PushPin,
  WarningCircle,
  X,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { knowledgeApi } from './api'
import { Magnetic, MotionList, MotionItem } from '../components/ui'
import type { KnowledgeNote, KnowledgeSaveDTO } from './types'

interface KnowledgePageProps {
  go: (link: string) => void
}

/** 与后端 KnowledgeCategoryEnum 一致 */
const CATEGORIES = ['安全守则', '急救', '装备技巧', '线路情报', '环保准则', '营养补给', '其他']

const CATEGORY_CLS = [
  'bg-red-50 text-red-600',
  'bg-rose-50 text-rose-600',
  'bg-amber-50 text-amber-700',
  'bg-emerald-50 text-emerald-700',
  'bg-lime-50 text-lime-700',
  'bg-sky-50 text-sky-700',
  'bg-slate-100 text-slate-500',
]

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5'

export default function KnowledgePage({ go }: KnowledgePageProps) {
  const [notes, setNotes] = useState<KnowledgeNote[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<number | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<KnowledgeNote | null>(null)
  const [title, setTitle] = useState('')
  const [formCategory, setFormCategory] = useState(1)
  const [content, setContent] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [detail, setDetail] = useState<KnowledgeNote | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    knowledgeApi
      .list(keyword.trim() || undefined, category ?? undefined)
      .then(setNotes)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [keyword, category])

  useEffect(() => {
    const t = setTimeout(load, keyword ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, keyword])

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setFormCategory(1)
    setContent('')
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (n: KnowledgeNote) => {
    setEditing(n)
    setTitle(n.title)
    setFormCategory(n.category)
    setContent(n.content)
    setFormError('')
    setDetail(null)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setFormError('请填写标题')
      return
    }
    if (!content.trim()) {
      setFormError('请填写正文')
      return
    }
    setSubmitting(true)
    setFormError('')
    const dto: KnowledgeSaveDTO = {
      title: title.trim(),
      category: formCategory,
      content: content.trim(),
    }
    try {
      if (editing) {
        await knowledgeApi.update({ ...dto, id: editing.id })
      } else {
        await knowledgeApi.create(dto)
      }
      setFormOpen(false)
      load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const togglePin = async (n: KnowledgeNote) => {
    try {
      await knowledgeApi.update({ id: n.id, title: n.title, category: n.category, content: n.content, pinned: n.pinned === 1 ? 0 : 1 })
      setDetail(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    try {
      await knowledgeApi.remove(id)
      setConfirmDeleteId(null)
      setDetail(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-lime-200/30 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 w-[520px] h-[520px] rounded-full bg-emerald-200/25 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-200/80">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => go('/')}
              className="p-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors active:scale-95"
              aria-label="返回首页"
            >
              <ArrowLeft size={18} weight="regular" />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">徒步知识库</h1>
              <p className="text-[11px] text-slate-400 mt-1">写给自己的山野手册</p>
            </div>
          </div>
          <Magnetic>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
            >
              <Plus size={15} weight="bold" />
              新笔记
            </button>
          </Magnetic>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {/* 搜索 + 分类过滤 */}
        <div className="mb-8 space-y-4">
          <div className="relative max-w-md">
            <MagnifyingGlass
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"
            />
            <input
              className={`${inputCls} pl-10`}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索标题或正文…"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategory(null)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-all active:scale-[0.98] ${
                category === null
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              全部
            </button>
            {CATEGORIES.map((label, i) => (
              <button
                key={label}
                onClick={() => setCategory(category === i + 1 ? null : i + 1)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all active:scale-[0.98] ${
                  category === i + 1
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-44 bg-slate-100 skeleton-shimmer rounded-4xl" />
            ))}
          </div>
        ) : error ? (
          <div className="py-24 text-center">
            <p className="text-slate-500">{error}</p>
            <button
              onClick={load}
              className="mt-4 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
            >
              重试
            </button>
          </div>
        ) : (notes ?? []).length === 0 ? (
          <div className="py-24 text-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <Notebook size={40} weight="light" className="text-slate-300" />
            </motion.div>
            <p className="mt-4 text-slate-400 text-sm">
              {keyword || category ? '没有匹配的笔记' : '把散落的经验一条条收进来'}
            </p>
          </div>
        ) : (
          <MotionList className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {(notes ?? []).map((n) => (
              <MotionItem key={n.id}>
                <motion.button
                  onClick={() => setDetail(n)}
                  whileHover={{ y: -2 }}
                  className="w-full h-full text-left rounded-4xl border border-slate-200/50 bg-white p-6 hover:border-emerald-200 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)] transition-all active:scale-[0.995]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORY_CLS[n.category - 1]}`}
                    >
                      {n.categoryLabel}
                    </span>
                    {n.pinned === 1 && (
                      <PushPin size={13} weight="fill" className="text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <h3 className="mt-2.5 font-bold text-slate-900 leading-snug">{n.title}</h3>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed line-clamp-4 whitespace-pre-line">
                    {n.content}
                  </p>
                  <p className="mt-3 text-[10px] font-mono text-slate-300">
                    {(n.updateTime ?? n.createTime ?? '').slice(0, 10)}
                  </p>
                </motion.button>
              </MotionItem>
            ))}
          </MotionList>
        )}

        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-4 py-2.5 bg-white border border-red-100 shadow-xl rounded-full text-sm text-red-500">
            <WarningCircle size={15} weight="fill" />
            {error}
          </div>
        )}
      </main>

      {/* 新建/编辑弹窗 */}
      <AnimatePresence>
        {formOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFormOpen(false)}
          >
            <motion.div
              className="w-full max-w-2xl bg-white rounded-4xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
              exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-7 py-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">{editing ? '编辑笔记' : '新笔记'}</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
                <div>
                  <label className={labelCls}>标题</label>
                  <input
                    className={inputCls}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="如：失温的三个阶段与处置"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className={labelCls}>分类</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((label, i) => (
                      <button
                        key={label}
                        onClick={() => setFormCategory(i + 1)}
                        className={`px-3 py-2 text-xs rounded-full border transition-all active:scale-[0.98] ${
                          formCategory === i + 1
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>正文（{content.length}/10000，按换行分段展示）</label>
                  <textarea
                    className={`${inputCls} min-h-[200px] resize-y leading-relaxed`}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="轻度：寒战、语无伦次…&#10;中度：寒战停止是危险信号…"
                    maxLength={10000}
                  />
                </div>
                <AnimatePresence>
                  {formError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-sm text-red-500"
                    >
                      <WarningCircle size={15} weight="fill" />
                      {formError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setFormOpen(false)}
                  className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-900 rounded-full transition-colors active:scale-[0.98]"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting ? '保存中…' : '保存'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 详情弹窗 */}
      <AnimatePresence>
        {detail && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetail(null)}
          >
            <motion.div
              className="w-full max-w-2xl bg-white rounded-4xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
              exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
                <div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${CATEGORY_CLS[detail.category - 1]}`}>
                    {detail.categoryLabel}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2 leading-snug">{detail.title}</h3>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="p-1.5 rounded-full text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-7 py-5">
                <div className="text-[15px] text-slate-700 leading-loose whitespace-pre-wrap">
                  {detail.content}
                </div>
              </div>
              <div className="px-7 py-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => handleDelete(detail.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-full transition-all active:scale-[0.98] ${
                    confirmDeleteId === detail.id ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'
                  }`}
                >
                  <Trash size={14} />
                  {confirmDeleteId === detail.id ? '再点一次确认' : '删除'}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => togglePin(detail)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-full transition-all active:scale-[0.98] ${
                      detail.pinned === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <PushPin size={14} weight={detail.pinned === 1 ? 'fill' : 'regular'} />
                    {detail.pinned === 1 ? '已置顶' : '置顶'}
                  </button>
                  <button
                    onClick={() => openEdit(detail)}
                    className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
                  >
                    <PencilSimple size={14} />
                    编辑
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
