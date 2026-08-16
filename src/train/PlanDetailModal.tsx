import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, CalendarCheck, WarningCircle } from '@phosphor-icons/react'
import { trainApi } from './api'
import type { TrainingItem, TrainingPlanDetail } from './types'

interface PlanDetailModalProps {
  planId: number
  onClose: () => void
  /** 打卡成功后回调（让外层刷新列表/聚合） */
  onChanged: () => void
}

function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function formatTarget(item: TrainingItem): string {
  if (item.mode === 'sets') {
    return `${item.totalTimes} ${item.unit} × ${item.totalSets} 组`
  }
  return `${item.totalTimes} ${item.unit}`
}

const inputCls =
  'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all'

export default function PlanDetailModal({ planId, onClose, onChanged }: PlanDetailModalProps) {
  const [detail, setDetail] = useState<TrainingPlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // 打卡表单状态
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [recordDate, setRecordDate] = useState(todayStr())
  const [completedTimes, setCompletedTimes] = useState('')
  const [completedSets, setCompletedSets] = useState('')
  const [submitMsg, setSubmitMsg] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadDetail = (id: number) => {
    setLoading(true)
    setLoadError('')
    trainApi
      .getPlanDetail(id)
      .then((d) => {
        setDetail(d)
        if (d.items.length > 0 && selectedItemId === null) {
          setSelectedItemId(d.items[0].id)
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDetail(planId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId])

  const selectedItem = detail?.items.find((it) => it.id === selectedItemId) ?? null

  const handleSubmit = async () => {
    if (!detail || !selectedItem) return
    setSubmitting(true)
    setSubmitMsg('')
    setSubmitError('')
    try {
      const times = completedTimes.trim() ? Number(completedTimes) : 0
      const sets = completedSets.trim() ? Number(completedSets) : 0
      await trainApi.submitRecord({
        planId: detail.id,
        itemId: selectedItem.id,
        recordDate,
        // sets 模式：未填次数则传 null，让后端取计划项默认值
        completedTimes: selectedItem.mode === 'sets' && !completedTimes.trim() ? null : times,
        completedSets: selectedItem.mode === 'sets' ? sets : 0,
      })
      setSubmitMsg('打卡成功')
      setCompletedTimes('')
      setCompletedSets('')
      loadDetail(planId)
      onChanged()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 记录按日期倒序
  const records = detail ? [...detail.records].reverse() : []

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-xl bg-white rounded-4xl shadow-2xl max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
        exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 truncate">
              {detail?.title ?? '计划详情'}
            </h2>
            {detail && (
              <p className="text-xs text-slate-400 mt-1">
                <span className="font-mono">{detail.startDate}</span> ~{' '}
                <span className="font-mono">{detail.endDate}</span>
                {detail.description && ` · ${detail.description}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors active:scale-95"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          /* 骨架加载 */
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
            <div className="space-y-2">
              <div className="w-24 h-3 bg-slate-200/70 rounded-full animate-pulse" />
              <div className="h-2 rounded-full bg-slate-200/70 animate-pulse" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100">
                <div className="space-y-2">
                  <div className="w-28 h-3 bg-slate-200/70 rounded-full animate-pulse" />
                  <div className="w-40 h-2.5 bg-slate-200/70 rounded-full animate-pulse" />
                </div>
                <div className="w-16 h-3 bg-slate-200/70 rounded-full animate-pulse" />
              </div>
            ))}
            <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
        ) : loadError ? (
          <div className="flex-1 flex items-center justify-center py-16 text-red-500">{loadError}</div>
        ) : detail ? (
          <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">
            {/* 进度 */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>计划进度</span>
                <span className="font-mono font-semibold text-slate-700">{detail.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${detail.progress}%` }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                />
              </div>
            </div>

            {/* 训练项：分割线分组，达标绿色勾 */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase mb-2">
                训练项
              </h3>
              <div className="divide-y divide-slate-100">
                {detail.items.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        目标 {formatTarget(item)}
                        {item.mode === 'sets' ? ' · 组数模式' : ' · 次数模式'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-mono font-semibold text-slate-800">
                        {item.doneValue}
                        <span className="text-xs font-normal text-slate-400">
                          {' '}/ {item.mode === 'sets' ? item.totalSets : item.totalTimes}
                        </span>
                      </span>
                      <AnimatePresence>
                        {item.done && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                          >
                            <CheckCircle size={18} weight="fill" className="text-emerald-500" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 打卡表单：label 在上 */}
            <div className="rounded-3xl border border-slate-200/60 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <CalendarCheck size={16} className="text-emerald-600" />
                今日打卡
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-500 block">训练项</span>
                  <select
                    value={selectedItemId ?? ''}
                    onChange={(e) => setSelectedItemId(Number(e.target.value))}
                    className={inputCls}
                  >
                    {detail.items.map((it) => (
                      <option key={it.id} value={it.id}>{it.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-500 block">日期</span>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>
              {selectedItem?.mode === 'sets' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-500 block">完成组数</span>
                    <input
                      type="number"
                      min={0}
                      value={completedSets}
                      onChange={(e) => setCompletedSets(e.target.value)}
                      placeholder="0"
                      className={`${inputCls} font-mono`}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-500 block">
                      每组次数（默认 {selectedItem.totalTimes}）
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={completedTimes}
                      onChange={(e) => setCompletedTimes(e.target.value)}
                      placeholder="留空取默认值"
                      className={`${inputCls} font-mono`}
                    />
                  </label>
                </div>
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-500 block">
                    完成次数（目标 {selectedItem?.totalTimes} {selectedItem?.unit}）
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={completedTimes}
                    onChange={(e) => setCompletedTimes(e.target.value)}
                    placeholder="0"
                    className={`${inputCls} font-mono`}
                  />
                </label>
              )}
              <AnimatePresence>
                {submitMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-xs text-emerald-600"
                  >
                    <CheckCircle size={13} weight="fill" />
                    {submitMsg}
                  </motion.p>
                )}
                {submitError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-xs text-red-500"
                  >
                    <WarningCircle size={13} weight="fill" />
                    {submitError}
                  </motion.p>
                )}
              </AnimatePresence>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white text-sm rounded-xl font-medium hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 transition-all"
              >
                {submitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                提交打卡
              </button>
            </div>

            {/* 打卡记录：分割线分组 */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase mb-2">
                打卡记录
                <span className="ml-2 font-mono normal-case text-slate-300">{records.length}</span>
              </h3>
              {records.length === 0 ? (
                <p className="text-sm text-slate-300 py-3">暂无打卡记录</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {records.map((r, i) => {
                    const item = detail.items.find((it) => it.id === r.itemId)
                    return (
                      <div key={i} className="flex items-center justify-between text-sm py-2.5">
                        <span className="font-mono text-xs text-slate-500">{r.date}</span>
                        <span className="text-xs text-slate-500">
                          {item?.name ?? `训练项#${r.itemId}`} ·{' '}
                          {item?.mode === 'sets'
                            ? `完成 ${r.completedSets} 组${r.completedTimes ? ` × ${r.completedTimes}` : ''}`
                            : `完成 ${r.completedTimes}${item?.unit ?? ''}`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  )
}
