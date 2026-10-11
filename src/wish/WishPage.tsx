import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  PencilSimple,
  Trash,
  CalendarBlank,
  MapPin,
  BookOpen,
  CheckCircle,
  XCircle,
  WarningCircle,
  X,
  Fire,
} from '@phosphor-icons/react'
import { wishApi } from './api'
import { journalApi } from '../journal/api'
import DateField from '../train/DateField'
import { todayStr, dateDot, Magnetic, MotionList, MotionItem } from '../components/ui'
import type { Wish, WishSummary } from './types'

interface WishPageProps {
  go: (link: string) => void
}

/** 状态分组（与后端 WishStatusEnum 一致） */
const STATUS_META: Record<number, { label: string; pill: string }> = {
  0: { label: '想去', pill: 'bg-sky-50 text-sky-700' },
  1: { label: '已计划', pill: 'bg-amber-50 text-amber-700' },
  2: { label: '已完成', pill: 'bg-emerald-50 text-emerald-700' },
  3: { label: '已放弃', pill: 'bg-slate-100 text-slate-400' },
}
const STATUS_ORDER = [0, 1, 2, 3]

const PRIORITY_META: Record<number, { label: string; cls: string }> = {
  1: { label: '随缘', cls: 'text-slate-300' },
  2: { label: '想去', cls: 'text-orange-400' },
  3: { label: '一定要去', cls: 'text-red-500' },
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5'

export default function WishPage({ go }: WishPageProps) {
  const [list, setList] = useState<Wish[] | null>(null)
  const [summary, setSummary] = useState<WishSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Wish | null>(null)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [priority, setPriority] = useState(2)
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 完成弹窗：日期 + 挂日记
  const [completing, setCompleting] = useState<Wish | null>(null)
  const [doneDate, setDoneDate] = useState(todayStr())
  const [journalId, setJournalId] = useState('')
  const [journals, setJournals] = useState<{ id: number; title: string; hikeDate: string }[]>([])
  const [completeError, setCompleteError] = useState('')

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([wishApi.list(), wishApi.summary()])
      .then(([l, s]) => {
        setList(l)
        setSummary(s)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setLocation('')
    setExpectedDate('')
    setPriority(2)
    setNote('')
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (w: Wish) => {
    setEditing(w)
    setTitle(w.title)
    setLocation(w.location ?? '')
    setExpectedDate(w.expectedDate ?? '')
    setPriority(w.priority)
    setNote(w.note ?? '')
    setFormError('')
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setFormError('请填写标题')
      return
    }
    setSubmitting(true)
    setFormError('')
    const dto = {
      title: title.trim(),
      location: location.trim() || undefined,
      expectedDate: expectedDate || undefined,
      priority,
      note: note.trim() || undefined,
    }
    try {
      if (editing) {
        await wishApi.update({ ...dto, id: editing.id })
      } else {
        await wishApi.create(dto)
      }
      setFormOpen(false)
      load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const openComplete = (w: Wish) => {
    setCompleting(w)
    setDoneDate(todayStr())
    setJournalId('')
    setCompleteError('')
    journalApi
      .list(50)
      .then((items) =>
        setJournals(items.map((j) => ({ id: j.id, title: j.title, hikeDate: j.hikeDate }))),
      )
      .catch(() => setJournals([]))
  }

  const handleComplete = async () => {
    if (!completing) return
    try {
      await wishApi.complete({
        id: completing.id,
        doneDate: doneDate || undefined,
        journalId: journalId ? Number(journalId) : undefined,
      })
      setCompleting(null)
      load()
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleGiveUp = async (w: Wish) => {
    try {
      await wishApi.giveUp(w.id)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handlePlan = async (w: Wish) => {
    try {
      await wishApi.update({ id: w.id, title: w.title, status: 1 })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleDelete = async (w: Wish) => {
    if (confirmDeleteId !== w.id) {
      setConfirmDeleteId(w.id)
      return
    }
    try {
      await wishApi.remove(w.id)
      setConfirmDeleteId(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 w-[520px] h-[520px] rounded-full bg-rose-200/25 blur-3xl" />
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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">徒步心愿单</h1>
              <p className="text-[11px] text-slate-400 mt-1">种草 · 计划 · 走完 · 回顾</p>
            </div>
          </div>
          <Magnetic>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
            >
              <Plus size={15} weight="bold" />
              新心愿
            </button>
          </Magnetic>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-slate-100 skeleton-shimmer rounded-4xl" />
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
        ) : (
          <div className="space-y-8">
            {/* 汇总 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="grid grid-cols-4 divide-x divide-slate-100">
                {[
                  { label: '想去', value: summary?.wishCount ?? 0 },
                  { label: '已计划', value: summary?.plannedCount ?? 0 },
                  { label: '已完成', value: summary?.doneCount ?? 0 },
                  { label: '已放弃', value: summary?.givenUpCount ?? 0 },
                ].map((s) => (
                  <div key={s.label} className="px-2 md:px-6 text-center">
                    <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">{s.value}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* 按状态分列 */}
            <MotionList className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              {STATUS_ORDER.map((status) => {
                const soonOf = (w: Wish): number | null => {
                  // 出发临近：7 天内有期望日期的活动态心愿，置顶并高亮
                  if (status > 1 || !w.expectedDate) return null
                  const days = Math.ceil(
                    (new Date(w.expectedDate).getTime() - Date.now()) / 86400000,
                  )
                  return days >= -3 && days <= 7 ? days : null
                }
                const wishes = (list ?? [])
                  .filter((w) => w.status === status)
                  .sort((a, b) => {
                    const da = soonOf(a)
                    const db = soonOf(b)
                    if (da != null || db != null) return (da ?? 99) - (db ?? 99)
                    return 0
                  })
                return (
                  <MotionItem key={status}>
                    <div className="rounded-4xl border border-slate-200/50 bg-white/60 p-5 min-h-[200px]">
                      <div className="flex items-center justify-between mb-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_META[status].pill}`}
                        >
                          {STATUS_META[status].label}
                        </span>
                        <span className="text-[11px] font-mono text-slate-300">{wishes.length}</span>
                      </div>
                      {wishes.length === 0 ? (
                        <p className="py-8 text-center text-xs text-slate-300">
                          {status === 0 ? '把想去的山先记下来' : '这里还没有条目'}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {wishes.map((w) => (
                            <div
                              key={w.id}
                              className={`rounded-2xl border p-4 transition-all ${
                                w.status === 3
                                  ? 'border-slate-100 bg-slate-50/60 opacity-60'
                                  : soonOf(w) != null
                                    ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
                                    : 'border-slate-100 bg-white hover:border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h3
                                  className={`text-sm font-medium leading-snug ${
                                    w.status === 2 ? 'text-slate-500' : 'text-slate-900'
                                  }`}
                                >
                                  {w.title}
                                </h3>
                                <span className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium ${PRIORITY_META[w.priority].cls}`}>
                                  <Fire size={11} weight="fill" />
                                  {PRIORITY_META[w.priority].label}
                                </span>
                              </div>
                              {w.location && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                                  <MapPin size={11} />
                                  {w.location}
                                </p>
                              )}
                              {w.expectedDate && (() => {
                                const soon = soonOf(w)
                                return (
                                  <p
                                    className={`mt-0.5 flex items-center gap-1 text-[11px] font-mono ${
                                      soon != null ? 'text-amber-600 font-semibold' : 'text-slate-400'
                                    }`}
                                  >
                                    <CalendarBlank size={11} />
                                    期望 {dateDot(w.expectedDate)}
                                    {soon != null && (
                                      <span className="ml-auto px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px]">
                                        {soon < 0 ? '已到行程' : `${soon} 天后`}
                                      </span>
                                    )}
                                  </p>
                                )
                              })()}
                              {w.status === 2 && w.doneDate && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 font-mono">
                                  <CheckCircle size={11} weight="fill" />
                                  {dateDot(w.doneDate)} 完成
                                </p>
                              )}
                              {w.journalTitle && (
                                <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700 line-clamp-1">
                                  <BookOpen size={11} />
                                  {w.journalTitle}
                                </p>
                              )}
                              {w.note && (
                                <p className="mt-1.5 text-[11px] text-slate-400 line-clamp-2">{w.note}</p>
                              )}
                              {/* 操作区 */}
                              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                                {(w.status === 0 || w.status === 1) && (
                                  <>
                                    {w.status === 0 && (
                                      <button
                                        onClick={() => handlePlan(w)}
                                        className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors active:scale-[0.98]"
                                      >
                                        开始计划
                                      </button>
                                    )}
                                    <button
                                      onClick={() => openComplete(w)}
                                      className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors active:scale-[0.98]"
                                    >
                                      走完了
                                    </button>
                                    <button
                                      onClick={() => handleGiveUp(w)}
                                      className="text-[11px] px-2.5 py-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                      放弃
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => openEdit(w)}
                                  className="ml-auto p-1.5 rounded-full text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                  aria-label="编辑"
                                >
                                  <PencilSimple size={12} />
                                </button>
                                <button
                                  onClick={() => handleDelete(w)}
                                  className={`p-1.5 rounded-full transition-colors ${
                                    confirmDeleteId === w.id
                                      ? 'text-white bg-red-500'
                                      : 'text-slate-300 hover:text-red-600 hover:bg-red-50'
                                  }`}
                                  aria-label="删除"
                                  title={confirmDeleteId === w.id ? '再点一次确认删除' : '删除'}
                                >
                                  <Trash size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </MotionItem>
                )
              })}
            </MotionList>
          </div>
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
              className="w-full max-w-md bg-white rounded-4xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
              exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-7 py-5 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">{editing ? '编辑心愿' : '新心愿'}</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
                <div>
                  <label className={labelCls}>标题</label>
                  <input
                    className={inputCls}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="如：武功山金顶看日出"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className={labelCls}>地点（可空）</label>
                  <input
                    className={inputCls}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="江西 · 萍乡"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className={labelCls}>期望出发（可空）</label>
                  <DateField value={expectedDate} onChange={setExpectedDate} />
                </div>
                <div>
                  <label className={labelCls}>优先级</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-2 text-xs rounded-full border transition-all active:scale-[0.98] ${
                          priority === p
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {PRIORITY_META[p].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>备注（可空）</label>
                  <textarea
                    className={`${inputCls} min-h-[80px] resize-y`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="路线攻略、季节提示…"
                    maxLength={500}
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

      {/* 完成弹窗 */}
      <AnimatePresence>
        {completing && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCompleting(null)}
          >
            <motion.div
              className="w-full max-w-sm bg-white rounded-4xl shadow-2xl overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
              exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">标记完成</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{completing.title}</p>
                </div>
                <button
                  onClick={() => setCompleting(null)}
                  className="p-1.5 rounded-full text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-7 py-5 space-y-4">
                <div>
                  <label className={labelCls}>完成日期</label>
                  <DateField value={doneDate} onChange={setDoneDate} />
                </div>
                <div>
                  <label className={labelCls}>关联日记（可空）</label>
                  <select
                    className={inputCls}
                    value={journalId}
                    onChange={(e) => setJournalId(e.target.value)}
                  >
                    <option value="">暂不关联</option>
                    {journals.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.hikeDate} · {j.title}
                      </option>
                    ))}
                  </select>
                  {journals.length === 0 && (
                    <p className="mt-1.5 text-[11px] text-slate-300">
                      还没有日记，完成之后可以先去写一篇再回来挂上
                    </p>
                  )}
                </div>
                <AnimatePresence>
                  {completeError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-1.5 text-sm text-red-500"
                    >
                      <XCircle size={15} weight="fill" />
                      {completeError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setCompleting(null)}
                  className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-900 rounded-full transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleComplete}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-sm rounded-full font-medium hover:bg-emerald-700 transition-all active:scale-[0.98]"
                >
                  完成
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
