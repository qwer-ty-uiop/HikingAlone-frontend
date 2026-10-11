import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Target,
  Plus,
  Trash,
  WarningCircle,
  Medal,
  X,
  ArrowClockwise,
} from '@phosphor-icons/react'
import { goalApi } from './api'
import { CountUp, Magnetic, MotionList, MotionItem } from '../components/ui'
import type { Goal, GoalCreateDTO } from './types'

interface GoalPageProps {
  go: (link: string) => void
}

/** 与后端 GoalMetricEnum 一致（code, label, unit, 是否月度, 默认目标） */
const METRICS: { code: number; label: string; unit: string; monthly: boolean; suggest: number; max: number }[] = [
  { code: 1, label: '月徒步里程', unit: 'km', monthly: true, suggest: 80, max: 5000 },
  { code: 2, label: '月徒步次数', unit: '次', monthly: true, suggest: 4, max: 365 },
  { code: 3, label: '月累计爬升', unit: 'm', monthly: true, suggest: 3000, max: 200000 },
  { code: 4, label: '年徒步里程', unit: 'km', monthly: false, suggest: 600, max: 5000 },
  { code: 5, label: '年徒步次数', unit: '次', monthly: false, suggest: 30, max: 365 },
  { code: 6, label: '年累计爬升', unit: 'm', monthly: false, suggest: 30000, max: 200000 },
]

const metricMeta = (code: number) => METRICS.find((m) => m.code === code)

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5'

export default function GoalPage({ go }: GoalPageProps) {
  const nowYear = new Date().getFullYear()
  const [year, setYear] = useState(nowYear)
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // 新建弹窗
  const [formOpen, setFormOpen] = useState(false)
  const [metric, setMetric] = useState(1)
  const [formYear, setFormYear] = useState(nowYear)
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1)
  const [target, setTarget] = useState('80')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 编辑弹窗（只改 target）
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [editTarget, setEditTarget] = useState('')

  const years = [nowYear - 1, nowYear, nowYear + 1]

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    goalApi
      .list(year)
      .then(setGoals)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setMetric(1)
    setFormYear(year)
    setFormMonth(new Date().getMonth() + 1)
    setTarget(String(metricMeta(1)?.suggest ?? 80))
    setFormError('')
    setFormOpen(true)
  }

  const pickMetric = (code: number) => {
    setMetric(code)
    const meta = metricMeta(code)
    setTarget(String(meta?.suggest ?? 80))
  }

  const handleSubmit = async () => {
    const meta = metricMeta(metric)
    const t = Number(target)
    if (!meta || Number.isNaN(t) || t <= 0 || t > meta.max) {
      setFormError(`目标值需在 1 ~ ${meta?.max ?? ''} ${meta?.unit ?? ''} 之间`)
      return
    }
    setSubmitting(true)
    setFormError('')
    const dto: GoalCreateDTO = { metric, targetValue: t, year: formYear }
    if (meta.monthly) dto.month = formMonth
    try {
      await goalApi.create(dto)
      setFormOpen(false)
      setYear(formYear)
      load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditTarget = async () => {
    if (!editingGoal) return
    const meta = metricMeta(editingGoal.metric)
    const t = Number(editTarget)
    if (!meta || Number.isNaN(t) || t <= 0 || t > meta.max) {
      setActionError(`目标值需在 1 ~ ${meta?.max ?? ''} ${meta?.unit ?? ''} 之间`)
      return
    }
    try {
      await goalApi.update({ id: editingGoal.id, targetValue: t })
      setEditingGoal(null)
      load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const toggleAbandon = async (g: Goal) => {
    try {
      await goalApi.update({ id: g.id, status: g.status === 1 ? 0 : 1 })
      load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleDelete = async (g: Goal) => {
    if (confirmDeleteId !== g.id) {
      setConfirmDeleteId(g.id)
      return
    }
    try {
      await goalApi.remove(g.id)
      setConfirmDeleteId(null)
      load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除失败')
      setConfirmDeleteId(null)
    }
  }

  const periodLabel = (g: Goal) => (g.periodType === 2 ? `${g.year} 年度` : `${g.year} 年 ${g.month} 月`)

  return (
    <div className="min-h-[100dvh] bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 w-[520px] h-[520px] rounded-full bg-sky-200/25 blur-3xl" />
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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">目标</h1>
              <p className="text-[11px] text-slate-400 mt-1">进度从日记自动累计，补记也会回填</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 年份切换 */}
            <div className="flex gap-1 rounded-full bg-slate-100 p-1">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`relative px-3 py-1.5 text-xs rounded-full transition-colors ${
                    year === y ? 'text-slate-900 font-medium' : 'text-slate-400'
                  }`}
                >
                  {year === y && (
                    <motion.span
                      layoutId="goal-year-pill"
                      className="absolute inset-0 bg-white rounded-full shadow-sm"
                      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    />
                  )}
                  <span className="relative z-10 font-mono">{y}</span>
                </button>
              ))}
            </div>
            <Magnetic>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
              >
                <Plus size={15} weight="bold" />
                新目标
              </button>
            </Magnetic>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-48 bg-slate-100 skeleton-shimmer rounded-4xl" />
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
          <>
            {(goals ?? []).length === 0 ? (
              <div className="py-24 text-center">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="inline-flex"
                >
                  <Target size={40} weight="light" className="text-slate-300" />
                </motion.div>
                <p className="mt-4 text-slate-400 text-sm">{year} 年还没有目标，先定一个够得着的小目标</p>
                <button
                  onClick={openCreate}
                  className="mt-4 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
                >
                  定个目标
                </button>
              </div>
            ) : (
              <MotionList className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {(goals ?? []).map((g) => {
                  const abandoned = g.status === 0
                  return (
                    <MotionItem key={g.id}>
                      <motion.div
                        whileHover={{ y: -2 }}
                        className={`rounded-4xl border p-6 transition-all ${
                          abandoned
                            ? 'border-slate-100 bg-slate-50/60 opacity-60'
                            : 'border-slate-200/50 bg-white hover:border-emerald-200 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-slate-900">{g.metricLabel}</h3>
                            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{periodLabel(g)}</p>
                          </div>
                          {g.progress.achieved ? (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-emerald-600 text-white font-medium">
                              <Medal size={12} weight="fill" />
                              已达成
                            </span>
                          ) : g.progress.periodEnded ? (
                            <span className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-400">
                              未达成
                            </span>
                          ) : (
                            <span className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-sky-50 text-sky-700">
                              进行中
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex items-baseline gap-1.5">
                          <span className="text-3xl font-mono font-semibold text-slate-900">
                            {g.progress.unit === '次' ? (
                              <CountUp value={g.progress.current} />
                            ) : (
                              <CountUp value={Math.round(g.progress.current)} />
                            )}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            / {g.targetValue} {g.progress.unit}
                          </span>
                        </div>

                        {/* 进度条 */}
                        <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              g.progress.achieved ? 'bg-emerald-500' : 'bg-slate-900'
                            }`}
                            animate={{
                              width: `${Math.min(100, g.progress.percent)}%`,
                            }}
                            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono">{g.progress.percent}%</span>
                          {g.progress.periodEnded && !g.progress.achieved && (
                            <span>周期已结束</span>
                          )}
                        </div>

                        {/* 操作 */}
                        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingGoal(g)
                              setEditTarget(String(g.targetValue))
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"
                          >
                            调整目标
                          </button>
                          <button
                            onClick={() => toggleAbandon(g)}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
                          >
                            <ArrowClockwise size={11} />
                            {abandoned ? '恢复' : '放弃'}
                          </button>
                          <button
                            onClick={() => handleDelete(g)}
                            className={`ml-auto p-1.5 rounded-full transition-colors ${
                              confirmDeleteId === g.id
                                ? 'text-white bg-red-500'
                                : 'text-slate-300 hover:text-red-600 hover:bg-red-50'
                            }`}
                            aria-label="删除"
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      </motion.div>
                    </MotionItem>
                  )
                })}
              </MotionList>
            )}
          </>
        )}

        {actionError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-4 py-2.5 bg-white border border-red-100 shadow-xl rounded-full text-sm text-red-500">
            <WarningCircle size={15} weight="fill" />
            {actionError}
          </div>
        )}
      </main>

      {/* 新建弹窗 */}
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
                <h3 className="text-lg font-bold text-slate-900">新目标</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
                <div>
                  <label className={labelCls}>指标</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {METRICS.map((m) => (
                      <button
                        key={m.code}
                        onClick={() => pickMetric(m.code)}
                        className={`py-2 text-xs rounded-full border transition-all active:scale-[0.98] ${
                          metric === m.code
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>年份</label>
                    <select
                      className={inputCls}
                      value={formYear}
                      onChange={(e) => setFormYear(Number(e.target.value))}
                    >
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  {metricMeta(metric)?.monthly && (
                    <div>
                      <label className={labelCls}>月份</label>
                      <select
                        className={inputCls}
                        value={formMonth}
                        onChange={(e) => setFormMonth(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>
                            {m} 月
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>
                    目标值（{metricMeta(metric)?.unit}，上限 {metricMeta(metric)?.max}）
                  </label>
                  <input
                    className={`${inputCls} font-mono`}
                    type="number"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
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
                  className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-900 rounded-full transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting ? '保存中…' : '立个目标'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 调整目标弹窗 */}
      <AnimatePresence>
        {editingGoal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingGoal(null)}
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
                  <h3 className="text-lg font-bold text-slate-900">调整目标值</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {editingGoal.metricLabel} · {periodLabel(editingGoal)}
                  </p>
                </div>
                <button
                  onClick={() => setEditingGoal(null)}
                  className="p-1.5 rounded-full text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-7 py-5">
                <label className={labelCls}>目标值（{metricMeta(editingGoal.metric)?.unit}）</label>
                <input
                  className={`${inputCls} font-mono`}
                  type="number"
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                />
              </div>
              <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => setEditingGoal(null)}
                  className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-900 rounded-full transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleEditTarget}
                  className="px-6 py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
