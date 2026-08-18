import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CheckCircle,
  CalendarCheck,
  CalendarDots,
  CaretDown,
  WarningCircle,
  Keyboard,
  SlidersHorizontal,
} from '@phosphor-icons/react'
import { trainApi } from './api'
import DateField from './DateField'
import type { CycleType, PlanRecord, TrainingItem, TrainingPlanDetail } from './types'

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

/** 打卡记录默认只展开最近 N 天的分组，避免计划跨度大时一屏刷满 */
const VISIBLE_RECORD_DAYS = 3

/** 周期计划：当前周期内默认展开最近 N 天 */
const VISIBLE_CURRENT_DAYS = 3

/** 周期计划：历史周期默认展示 N 个折叠组，更早的收进「显示更早」 */
const VISIBLE_PERIODS = 3

/** 2026-08-16 -> 08.16（记录分组标题用） */
function dateDot(date: string): string {
  return date.slice(5).replace('-', '.')
}

/** 2026-08-16 -> 周六 */
function weekdayLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
}

/** 本地解析 yyyy-MM-dd（避免 new Date(str) 的 UTC 时区偏移） */
function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Date -> yyyy-MM-dd */
function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 构造合法日期：日越界钳制到当月月末（如 2月30日 → 2月28/29日） */
function clampDate(year: number, month: number, day: number): Date {
  const m = Math.max(1, Math.min(12, month))
  const last = new Date(year, m, 0).getDate()
  return new Date(year, m - 1, Math.min(Math.max(1, day), last))
}

/**
 * 计算日期所在周期（含两端），与后端 TrainingPlan.currentPeriod 语义一致；非周期返回 null。
 * 每天=当天；每周=锚点星期（缺省周一）所在自然周；每月=锚点日（缺省1号）起；每年=锚点月日（缺省1月1日）起
 */
function periodOf(date: string, cycleType: CycleType, anchor: number | null): { start: string; end: string } | null {
  if (cycleType === 0) return null
  const d = parseLocal(date)
  if (cycleType === 1) return { start: date, end: date }
  if (cycleType === 2) {
    const a = anchor ?? 1
    const dow = d.getDay() === 0 ? 7 : d.getDay() // 1=周一 ... 7=周日
    const start = new Date(d.getTime() - (((dow - a) % 7) + 7) % 7 * 86400000)
    return { start: toStr(start), end: toStr(new Date(start.getTime() + 6 * 86400000)) }
  }
  if (cycleType === 3) {
    const a = anchor ?? 1
    const y = d.getFullYear()
    const m = d.getDate() >= a ? d.getMonth() + 1 : d.getMonth() // 早于锚点日 → 从上月锚点日起算
    const start = clampDate(y, m, a)
    return { start: toStr(start), end: toStr(new Date(start.getFullYear(), start.getMonth() + 1, 0)) }
  }
  const am = anchor != null ? Math.floor(anchor / 100) : 1
  const ad = anchor != null ? anchor % 100 : 1
  let y = d.getFullYear()
  const startThisYear = clampDate(y, am, ad)
  if (d.getTime() < startThisYear.getTime()) y -= 1
  const start = clampDate(y, am, ad)
  return { start: toStr(start), end: toStr(new Date(start.getFullYear() + 1, start.getMonth(), 0)) }
}

/** 记录按日期倒序分组（组内保持传入顺序），每组一个日期头 */
function groupByDay(records: PlanRecord[]): { date: string; list: PlanRecord[] }[] {
  const map = new Map<string, PlanRecord[]>()
  for (const r of records) {
    const arr = map.get(r.date)
    if (arr) arr.push(r)
    else map.set(r.date, [r])
  }
  return [...map.entries()].map(([date, list]) => ({ date, list }))
}

/** 周期内聚合：打卡天数/条数/达标进度（Σ完成值/Σ目标值，按模式取对应字段，超额封顶） */
function periodStats(records: PlanRecord[], items: TrainingItem[]): { dayCount: number; recordCount: number; done: number; goal: number } {
  const days = new Set(records.map((r) => r.date))
  const acc = new Map<number, { sets: number; times: number }>()
  for (const r of records) {
    const cur = acc.get(r.itemId) ?? { sets: 0, times: 0 }
    cur.sets += r.completedSets
    cur.times += r.completedTimes
    acc.set(r.itemId, cur)
  }
  let done = 0
  let goal = 0
  for (const it of items) {
    const v = acc.get(it.id)
    if (!v) continue
    const goalV = it.mode === 'sets' ? it.totalSets ?? 0 : it.totalTimes ?? 0
    done += Math.min(it.mode === 'sets' ? v.sets : v.times, goalV)
    goal += goalV
  }
  return { dayCount: days.size, recordCount: records.length, done, goal }
}

function formatTarget(item: TrainingItem): string {
  if (item.mode === 'sets') {
    return `${item.totalTimes} ${item.unit} × ${item.totalSets} 组`
  }
  return `${item.totalTimes} ${item.unit}`
}

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all'

  /** 拖拽条的滑块轨道类：两端圆形、emerald 填充 */
  const rangeCls =
    'w-full h-2.5 rounded-full bg-slate-100 appearance-none cursor-pointer range-emerald'

export default function PlanDetailModal({ planId, onClose, onChanged }: PlanDetailModalProps) {
  const [detail, setDetail] = useState<TrainingPlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // 打卡表单状态
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [recordDate, setRecordDate] = useState(todayStr())
  const [completedTimes, setCompletedTimes] = useState('')
  const [completedSets, setCompletedSets] = useState('')
  // 完成量填写方式：直接输入 / 拖拽条（默认拖拽）
  const [inputMode, setInputMode] = useState<'input' | 'slider'>('slider')
  const [submitMsg, setSubmitMsg] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // 打卡记录：非周期按天折叠（最近 3 天）；周期计划当前周期内按天折叠 + 历史周期折叠
  const [showAllRecords, setShowAllRecords] = useState(false)
  const [showAllCurrentDays, setShowAllCurrentDays] = useState(false)
  const [showAllPeriods, setShowAllPeriods] = useState(false)

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

  /** 当前选中项的剩余任务量：直接用后端返回的 remainValue（输入与拖拽共用同一上限，保证两模式提交逻辑一致） */
  const remain = selectedItem?.remainValue ?? 0

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

  // 打卡记录：按日期倒序分组（组内保持原始顺序），每组一个日期头
  const recordGroups = useMemo(() => {
    if (!detail) return []
    return groupByDay([...detail.records].reverse())
  }, [detail])

  const visibleRecordGroups = showAllRecords ? recordGroups : recordGroups.slice(0, VISIBLE_RECORD_DAYS)
  const hiddenRecordDays = Math.max(0, recordGroups.length - VISIBLE_RECORD_DAYS)

  // 周期计划：记录按周期 start 倒序分组（有记录的周期），当前周期（含今天）单列高亮
  const cycleView = useMemo(() => {
    if (!detail || detail.cycleType === 0) return null
    const todayPeriod = periodOf(todayStr(), detail.cycleType, detail.cycleAnchor)
    const currentKey = todayPeriod?.start ?? null
    const map = new Map<string, { start: string; end: string; list: PlanRecord[] }>()
    for (const r of [...detail.records].reverse()) {
      const p = periodOf(r.date, detail.cycleType, detail.cycleAnchor) ?? { start: r.date, end: r.date }
      const g = map.get(p.start)
      if (g) g.list.push(r)
      else map.set(p.start, { start: p.start, end: p.end, list: [r] })
    }
    const groups = [...map.values()].map((g) => ({
      ...g,
      stats: periodStats(g.list, detail.items),
      isCurrent: g.start === currentKey,
    }))
    groups.sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
    const current = groups.find((g) => g.isCurrent) ?? null
    const past = groups.filter((g) => !g.isCurrent)
    const visiblePast = showAllPeriods ? past : past.slice(0, VISIBLE_PERIODS)
    return { todayPeriod, current, past: visiblePast, hiddenPastCount: past.length - visiblePast.length }
  }, [detail, showAllPeriods])

  // 当前周期内的按天分组：默认展开最近 VISIBLE_CURRENT_DAYS 天
  const currentDays = cycleView?.current ? groupByDay(cycleView.current.list) : []
  const visibleCurrentDays = showAllCurrentDays ? currentDays : currentDays.slice(0, VISIBLE_CURRENT_DAYS)
  const hiddenCurrentDays = Math.max(0, currentDays.length - VISIBLE_CURRENT_DAYS)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-xl bg-white rounded-4xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden pb-10"
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
          <div className="flex-1 overflow-y-auto px-7 pt-5 space-y-6">
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
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <CalendarCheck size={16} className="text-emerald-600" />
                  今日打卡
                </h3>
                {/* 填写方式切换：拖拽（默认）/ 直接输入，拖拽在左 */}
                <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100">
                  <button
                    onClick={() => setInputMode('slider')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                      inputMode === 'slider'
                        ? 'bg-white text-slate-900 font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <SlidersHorizontal size={13} weight={inputMode === 'slider' ? 'bold' : 'regular'} />
                    拖拽
                  </button>
                  <button
                    onClick={() => setInputMode('input')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                      inputMode === 'input'
                        ? 'bg-white text-slate-900 font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Keyboard size={13} weight={inputMode === 'input' ? 'bold' : 'regular'} />
                    输入
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* 训练项：自绘下拉面板（点击开合，点外部/Esc 收起） */}
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-500 block">训练项</span>
                  <ItemSelect
                    items={detail.items}
                    value={selectedItemId}
                    onChange={(id) => setSelectedItemId(id)}
                  />
                </label>
                {/* 日期：与新建计划共用 DateField，整框点击打开日历选择器 */}
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-500 block">日期</span>
                  <DateField value={recordDate} onChange={setRecordDate} />
                </label>
              </div>
              {selectedItem?.mode === 'sets' ? (
                inputMode === 'slider' ? (
                  /* 组数模式拖拽：总量 = 剩余组数 */
                  <SliderField
                    value={parseInt(completedSets || '0', 10)}
                    max={remain}
                    unit="组"
                    hint={
                      remain > 0
                        ? `剩余 ${remain} 组，拖动设置本次完成量`
                        : '已完成全部组数，无需再打卡'
                    }
                    onChange={(v) => setCompletedSets(String(v))}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-slate-500 block">
                        完成组数（剩余 {remain} 组）
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={remain}
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
                )
              ) : inputMode === 'slider' ? (
                /* 次数模式拖拽：总量 = 剩余次数 */
                <SliderField
                  value={parseInt(completedTimes || '0', 10)}
                  max={remain}
                  unit={selectedItem?.unit ?? '次'}
                  hint={
                    remain > 0
                      ? `剩余 ${remain} ${selectedItem?.unit}，拖动设置本次完成量`
                      : '已完成全部次数，无需再打卡'
                  }
                  onChange={(v) => setCompletedTimes(String(v))}
                />
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-500 block">
                    完成次数（剩余 {remain} {selectedItem?.unit}）
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={remain}
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

            {/* 打卡记录：周期计划按周期折叠（本期高亮 + 历史周期摘要组），非周期按天折叠 */}
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase mb-3">
                打卡记录
                <span className="ml-2 font-mono normal-case text-slate-300">
                  {detail.records.length} 条
                </span>
              </h3>
              {detail.records.length === 0 ? (
                <p className="text-sm text-slate-300 py-3">暂无打卡记录</p>
              ) : cycleView ? (
                <div className="space-y-2.5">
                  {/* 当前周期：本期进度 + 当前周期内的按天明细（默认最近 N 天） */}
                  {cycleView.current && (
                    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 overflow-hidden">
                      <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 border-b border-emerald-100">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CalendarDots size={14} weight="bold" />
                          本期 · {dateDot(cycleView.current.start)} ~ {dateDot(cycleView.current.end)}
                        </span>
                        <span className="text-[11px] text-emerald-600/70">
                          打卡 {cycleView.current.stats.dayCount} 天 · {cycleView.current.stats.recordCount} 条
                        </span>
                      </div>
                      <div className="px-3.5 py-2.5 border-b border-emerald-100">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-1.5 rounded-full bg-white overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-emerald-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${cycleView.current.stats.goal > 0 ? Math.min(100, Math.round((cycleView.current.stats.done / cycleView.current.stats.goal) * 100)) : 0}%` }}
                              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-emerald-700 shrink-0">
                            {cycleView.current.stats.done}/{cycleView.current.stats.goal}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white/60 divide-y divide-slate-100">
                        {visibleCurrentDays.map((g) => (
                          <DayGroup key={g.date} g={g} items={detail.items} />
                        ))}
                        {hiddenCurrentDays > 0 && (
                          <button
                            onClick={() => setShowAllCurrentDays((s) => !s)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-slate-500 hover:bg-slate-50 transition-colors active:scale-[0.99]"
                          >
                            <CaretDown size={12} weight="bold" className={`transition-transform duration-200 ${showAllCurrentDays ? 'rotate-180' : ''}`} />
                            {showAllCurrentDays ? '收起' : `展开本期更早 ${hiddenCurrentDays} 天`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 历史周期：每组一行摘要，展开见明细 */}
                  {cycleView.past.map((g) => (
                    <PeriodGroup
                      key={g.start}
                      group={g}
                      items={detail.items}
                      index={0}
                    />
                  ))}
                  {cycleView.hiddenPastCount > 0 && (
                    <button
                      onClick={() => setShowAllPeriods((s) => !s)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.99]"
                    >
                      <CaretDown size={13} weight="bold" className={`transition-transform duration-200 ${showAllPeriods ? 'rotate-180' : ''}`} />
                      {showAllPeriods ? '收起' : `显示更早 ${cycleView.hiddenPastCount} 个周期`}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleRecordGroups.map((g) => (
                    <DayGroup key={g.date} g={g} items={detail.items} />
                  ))}
                  {hiddenRecordDays > 0 && (
                    <button
                      onClick={() => setShowAllRecords((s) => !s)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.99]"
                    >
                      <CaretDown
                        size={13}
                        weight="bold"
                        className={`transition-transform duration-200 ${showAllRecords ? 'rotate-180' : ''}`}
                      />
                      {showAllRecords ? '收起' : `显示更早的 ${hiddenRecordDays} 天记录`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  )
}

/** 单日记录组（非周期折叠 + 周期计划当前周期内展开共用）；memo 隔离，展开动画不波及父级 */
const DayGroup = memo(function DayGroup({ g, items }: { g: { date: string; list: PlanRecord[] }; items: TrainingItem[] }) {
  return (
    <div className="overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-1.5">
        <span className="text-[11px] font-semibold font-mono text-slate-500">{dateDot(g.date)}</span>
        <span className="text-[10px] text-slate-400">
          {weekdayLabel(g.date)} · {g.list.length} 条
        </span>
      </div>
      <div className="px-3.5 pb-1.5 divide-y divide-slate-100">
        {g.list.map((r) => {
          const item = items.find((it) => it.id === r.itemId)
          return (
            <div key={r.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-xs text-slate-600 truncate">
                {item?.name ?? `训练项#${r.itemId}`}
              </span>
              <span className="text-xs text-slate-500 shrink-0 font-mono">
                {item?.mode === 'sets'
                  ? `完成 ${r.completedSets} 组${r.completedTimes ? ` × ${r.completedTimes}` : ''}`
                  : `完成 ${r.completedTimes}${item?.unit ?? ''}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})

interface PeriodGroupProps {
  group: {
    start: string
    end: string
    list: PlanRecord[]
    stats: { dayCount: number; recordCount: number; done: number; goal: number }
    isCurrent?: boolean
  }
  items: TrainingItem[]
  index: number
}

/**
 * 历史周期折叠组：一行摘要（周期范围/打卡天数/达标进度）+ 展开后的按天明细。
 * memo 隔离 + spring 高度动画，展开只影响自身，不触发父级重渲染
 */
const PeriodGroup = memo(function PeriodGroup({ group, items, index }: PeriodGroupProps) {
  const [expanded, setExpanded] = useState(false)
  const pct = group.stats.goal > 0 ? Math.min(100, Math.round((group.stats.done / group.stats.goal) * 100)) : 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20, delay: index * 0.05 } }}
      className="rounded-2xl border border-slate-100 bg-white overflow-hidden"
    >
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50/80 transition-colors active:scale-[0.995]"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              {dateDot(group.start)} ~ {dateDot(group.end)}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0">
              打卡 {group.stats.dayCount} 天
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-emerald-500/70"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-400 shrink-0">{pct}%</span>
          </div>
        </div>
        <CaretDown
          size={14}
          weight="bold"
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="overflow-hidden border-t border-slate-100 bg-slate-50/50"
          >
            {groupByDay(group.list).map((g) => (
              <DayGroup key={g.date} g={g} items={items} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

interface SliderFieldProps {
  value: number
  max: number
  unit: string
  hint: string
  onChange: (v: number) => void
}

/** 打卡拖拽条：总量 = 计划剩余数量，拖拽比例 = 本次提交完成量 */
function SliderField({ value, max, unit, hint, onChange }: SliderFieldProps) {
  const clamped = Math.max(0, Math.min(max, value))
  const pct = max > 0 ? (clamped / max) * 100 : 0
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200/60 px-5 py-4">
      <div className="flex items-end justify-between gap-4 mb-3">
        <p className="text-xs text-slate-400 leading-relaxed">{hint}</p>
        <div className="shrink-0 text-right">
          <span className="text-2xl font-mono font-bold text-slate-900 leading-none">{clamped}</span>
          <span className="text-xs text-slate-400 ml-1">
            / {max} {unit}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(1, max)}
        value={clamped}
        disabled={max <= 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={rangeCls}
        style={{
          background: `linear-gradient(to right, #10b981 ${pct}%, #e2e8f0 ${pct}%)`,
        }}
      />
      <div className="flex justify-between mt-1.5 text-[10px] font-mono text-slate-300">
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

interface ItemSelectProps {
  items: TrainingItem[]
  value: number | null
  onChange: (id: number) => void
}

const PANEL_WIDTH = 232

/**
 * 训练项下拉：自绘弹出面板（portal 悬浮层）。
 * 点击按钮开/合，点外部或 Esc 收起；选项带目标预览，选中项 emerald 高亮。
 * 替代原生 select —— 鼠标手势与点击行为完全可控
 */
function ItemSelect({ items, value, onChange }: ItemSelectProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null)

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.max(PANEL_WIDTH, rect.width)
    setAnchor({
      left: Math.min(rect.left, window.innerWidth - width - 8),
      top: rect.bottom + 6,
      width,
    })
    setOpen(true)
  }

  const pick = (id: number) => {
    onChange(id)
    setOpen(false)
  }

  // 点外部（面板本身不关）/ Esc 收起
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = items.find((it) => it.id === value) ?? null

  return (
    <div ref={wrapRef} className="relative">
      {/* 触发按钮：仿输入框样式，点击开合 */}
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`${inputCls} flex items-center justify-between gap-2 text-left cursor-pointer ${
          open ? 'border-emerald-500 ring-2 ring-emerald-500/30' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.name ?? '选择训练项'}</span>
        <CaretDown
          size={14}
          weight="bold"
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && anchor && (
            <motion.div
              ref={popRef}
              role="listbox"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }}
              exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
              className="fixed z-[100] bg-white rounded-xl border border-slate-200 shadow-2xl p-1 max-h-56 overflow-y-auto"
              style={{ left: anchor.left, top: anchor.top, width: anchor.width }}
            >
              {items.map((it) => {
                const isSel = it.id === value
                return (
                  <button
                    key={it.id}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onClick={() => pick(it.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isSel ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm font-medium truncate">{it.name}</span>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {it.mode === 'sets' ? `${it.totalSets} 组` : `${it.totalTimes} ${it.unit}`}
                    </span>
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
