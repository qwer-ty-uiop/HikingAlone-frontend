import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion'
import {
  ArrowLeft,
  Heartbeat,
  Flame,
  Scales,
  TrendDown,
  TrendUp,
  CheckCircle,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { bodyApi } from './api'
import WeightChart from './WeightChart'
import type { BodyMetricRecent, BodyMetricRecord } from './types'
// 自绘日期选择器与训练模块共用同一组件（行为一致：按钮触发 + portal 日历 + 点外部/Esc 收起）
import DateField from '../train/DateField'

function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** yyyy-MM-dd → MM.DD */
function dateDot(date: string): string {
  return date.slice(5).replace('-', '.')
}

/** yyyy-MM-dd → 周X */
function weekdayLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
}

/** 带小数的数字滚动：体重展示保留 1 位小数，值变化时弹簧过渡 */
function WeightCountUp({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(useMotionValue(0), { stiffness: 100, damping: 20 })
  const [display, setDisplay] = useState(0)
  useMotionValueEvent(spring, 'change', (v) => setDisplay(v))
  useEffect(() => {
    spring.set(value)
  }, [value, spring])
  return <span className={className}>{display.toFixed(1)}</span>
}

/** 趋势图指标：体重 / 静息心率 */
type Metric = 'weight' | 'heart'

const METRIC_META: Record<Metric, { label: string; unit: string }> = {
  weight: { label: '体重', unit: 'kg' },
  heart: { label: '静息心率', unit: '次/分' },
}

interface BodyPageProps {
  go: (link: string) => void
}

export default function BodyPage({ go }: BodyPageProps) {
  const [data, setData] = useState<BodyMetricRecent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 记录表单：editingDate 非空 = 正在编辑某天（点击历史记录回填）
  const [formDate, setFormDate] = useState(todayStr())
  const [weight, setWeight] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [note, setNote] = useState('')
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [formError, setFormError] = useState('')

  // 趋势图指标切换
  const [metric, setMetric] = useState<Metric>('weight')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    bodyApi
      .recent(30)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const records = data?.records ?? []
  const summary = data?.summary

  /** 表单校验：体重必填且在领域区间内，心率可空但非空需在区间内 */
  const validate = (): string => {
    const w = Number(weight)
    if (!weight.trim() || Number.isNaN(w)) return '请填写体重'
    if (w < 25 || w > 250) return '体重需在 25.0 ~ 250.0 kg 之间'
    if (heartRate.trim()) {
      const hr = Number(heartRate)
      if (!Number.isInteger(hr) || hr < 30 || hr > 220) return '静息心率需为 30 ~ 220 的整数'
    }
    return ''
  }

  const handleSubmit = async () => {
    const msg = validate()
    if (msg) {
      setFormError(msg)
      return
    }
    setSubmitting(true)
    setFormError('')
    setSubmitError('')
    try {
      await bodyApi.record({
        date: editingDate ?? formDate,
        weightKg: Number(weight),
        restingHeartRate: heartRate.trim() ? Number(heartRate) : undefined,
        note: note.trim() || undefined,
      })
      setSubmitMsg(editingDate ? `${dateDot(editingDate)} 已更新` : '已记录')
      setWeight('')
      setHeartRate('')
      setNote('')
      setEditingDate(null)
      setFormDate(todayStr())
      load()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  /** 点击历史记录：回填表单进入编辑态（同日重复提交=覆盖更新） */
  const startEdit = (r: BodyMetricRecord) => {
    setEditingDate(r.date)
    setFormDate(r.date)
    setWeight(String(r.weightKg))
    setHeartRate(r.restingHeartRate == null ? '' : String(r.restingHeartRate))
    setNote(r.note ?? '')
    setSubmitMsg('')
    setFormError('')
    setSubmitError('')
  }

  const cancelEdit = () => {
    setEditingDate(null)
    setFormDate(todayStr())
    setWeight('')
    setHeartRate('')
    setNote('')
    setFormError('')
  }

  /** 趋势图数据：体重取全部记录；心率只取有值的记录 */
  const chartPoints = useMemo(() => {
    if (metric === 'weight') {
      return records.map((r) => ({ date: r.date, value: r.weightKg }))
    }
    return records
      .filter((r) => r.restingHeartRate != null)
      .map((r) => ({ date: r.date, value: r.restingHeartRate as number }))
  }, [records, metric])

  /** 历史列表按月分组（后端升序 → 倒序展示，最近在上） */
  const monthGroups = useMemo(() => {
    const map = new Map<string, BodyMetricRecord[]>()
    for (const r of [...records].reverse()) {
      const key = r.date.slice(0, 7)
      const arr = map.get(key)
      if (arr) arr.push(r)
      else map.set(key, [r])
    }
    return [...map.entries()].map(([month, list]) => ({ month, list }))
  }, [records])

  const metricMeta = METRIC_META[metric]
  const delta = summary?.weightDelta ?? null

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* 环境氛围：右上角 emerald 光晕 + 左下角暖光，固定层不拦截交互 */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 w-[520px] h-[520px] rounded-full bg-amber-200/25 blur-3xl" />
      </div>

      {/* 顶栏 */}
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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">身体数据</h1>
              <p className="text-[11px] text-slate-400 mt-1">体重 · 静息心率 · 每日一记</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
            <Heartbeat size={14} weight="bold" />
            每天一分钟
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          /* 骨架：统计栏 + 图表/表单分栏 + 列表，与最终布局同构 */
          <div className="space-y-8">
            <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 skeleton-shimmer rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-5">
              <div className="lg:col-span-3 rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
                <div className="w-28 h-4 bg-slate-200/70 rounded-full skeleton-shimmer mb-6" />
                <div className="h-56 bg-slate-100 skeleton-shimmer rounded-2xl" />
              </div>
              <div className="lg:col-span-2 rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-11 bg-slate-100 skeleton-shimmer rounded-2xl" />
                ))}
                <div className="h-24 bg-slate-100 skeleton-shimmer rounded-2xl" />
              </div>
            </div>
            <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
              <div className="w-32 h-4 bg-slate-200/70 rounded-full skeleton-shimmer mb-6" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 bg-slate-100 skeleton-shimmer rounded-2xl mb-3" />
              ))}
            </div>
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
            {/* 统计总览：最新体重 / 较上次 / 连续记录 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                <div className="px-2 md:px-6">
                  <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mb-1.5">
                    <Scales size={13} weight="bold" className="text-emerald-600" />
                    最新体重
                  </div>
                  {summary?.latestWeight != null ? (
                    <>
                      <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                        <WeightCountUp value={summary.latestWeight} />
                        <span className="text-sm font-sans text-slate-400 ml-1">kg</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {records.length > 0 && `${dateDot(records[records.length - 1].date)} 记录`}
                      </p>
                    </>
                  ) : (
                    <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-300">—</div>
                  )}
                </div>
                <div className="px-2 md:px-6">
                  <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mb-1.5">
                    {delta != null && delta < 0 ? (
                      <TrendDown size={13} weight="bold" className="text-emerald-600" />
                    ) : (
                      <TrendUp size={13} weight="bold" className="text-emerald-600" />
                    )}
                    较上次
                  </div>
                  {delta != null ? (
                    <>
                      <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                        {delta > 0 ? '+' : ''}
                        {delta.toFixed(1)}
                        <span className="text-sm font-sans text-slate-400 ml-1">kg</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {records.length >= 2 && `对比 ${dateDot(records[records.length - 2].date)}`}
                      </p>
                    </>
                  ) : (
                    <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-300">—</div>
                  )}
                </div>
                <div className="px-2 md:px-6">
                  <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mb-1.5">
                    <Flame size={13} weight="bold" className="text-emerald-600" />
                    连续记录
                  </div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    {summary?.streakDays ?? 0}
                    <span className="text-sm font-sans text-slate-400 ml-1">天</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    30 天内 {summary?.recordedDays ?? 0} 天
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-5 items-start">
              {/* 趋势图：指标切换 + 折线 */}
              <section className="lg:col-span-3 rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tighter text-slate-900">趋势</h2>
                  <div className="flex items-center gap-1 p-1 rounded-full bg-slate-100">
                    {(Object.keys(METRIC_META) as Metric[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetric(m)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                          metric === m
                            ? 'bg-white text-slate-900 font-medium shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {METRIC_META[m].label}
                      </button>
                    ))}
                  </div>
                </div>
                {chartPoints.length === 0 ? (
                  /* 空状态：图标微幅漂浮 + 引导文案 */
                  <div className="py-14 text-center">
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
                      className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4"
                    >
                      <Heartbeat size={26} weight="light" className="text-slate-300" />
                    </motion.div>
                    <p className="text-slate-500 text-sm">
                      {metric === 'heart'
                        ? '还没有静息心率记录，记录时填上它，趋势会在这里生长'
                        : '记录第一天的身体数据，趋势会在这里生长'}
                    </p>
                  </div>
                ) : (
                  <WeightChart points={chartPoints} unit={metricMeta.unit} />
                )}
              </section>

              {/* 记录表单：每天一条，同日重复提交覆盖更新 */}
              <section className="lg:col-span-2 rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between gap-2 mb-5">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Heartbeat size={18} weight="fill" className="text-emerald-600" />
                    {editingDate ? '修改记录' : '今日记录'}
                  </h2>
                  <AnimatePresence>
                    {editingDate && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors active:scale-95"
                      >
                        编辑 {dateDot(editingDate)}
                        <X size={11} weight="bold" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-500 block">日期</span>
                    <DateField value={formDate} onChange={setFormDate} />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-slate-500 block">体重 kg *</span>
                      <input
                        type="number"
                        step="0.1"
                        min={25}
                        max={250}
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="65.0"
                        className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:font-sans placeholder:text-slate-300"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-slate-500 block">静息心率 次/分</span>
                      <input
                        type="number"
                        min={30}
                        max={220}
                        value={heartRate}
                        onChange={(e) => setHeartRate(e.target.value)}
                        placeholder="选填"
                        className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:font-sans placeholder:text-slate-300"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-500 block">
                      备注
                      <span className="ml-2 font-mono text-slate-300">{note.length}/200</span>
                    </span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 200))}
                      maxLength={200}
                      rows={2}
                      placeholder="睡眠、疲劳、状态等（选填）"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-300 resize-none"
                    />
                  </label>

                  <AnimatePresence>
                    {formError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
                      >
                        <WarningCircle size={15} weight="fill" />
                        {formError}
                      </motion.p>
                    )}
                    {submitError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-sm text-red-500"
                      >
                        <WarningCircle size={15} weight="fill" />
                        {submitError}
                      </motion.p>
                    )}
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
                  </AnimatePresence>

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-900 text-white text-sm rounded-xl font-medium hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 transition-all"
                  >
                    {submitting && (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {editingDate ? '保存修改' : '记录今天'}
                  </button>
                </div>
              </section>
            </div>

            {/* 历史记录：按月分组，点击行回填表单编辑 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl md:text-2xl font-bold tracking-tighter text-slate-900">历史记录</h2>
                <span className="text-[11px] font-mono text-slate-400">近 30 天 {records.length} 条 · 点击可修改</span>
              </div>
              {records.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-300">暂无记录，从上方「记录今天」开始</p>
              ) : (
                <div className="space-y-6">
                  {monthGroups.map((g) => (
                    <div key={g.month}>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xs font-semibold tracking-wide text-slate-400">
                          {g.month.slice(0, 4)} 年 {Number(g.month.slice(5, 7))} 月
                        </h3>
                        <span className="text-[10px] font-mono text-slate-300">{g.list.length} 条</span>
                        <span className="flex-1 h-px bg-slate-100" />
                      </div>
                      <div className="divide-y divide-slate-100">
                        {g.list.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => startEdit(r)}
                            className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left transition-all active:scale-[0.995] hover:bg-slate-50 ${
                              editingDate === r.date ? 'bg-emerald-50/60' : ''
                            }`}
                          >
                            <span className="w-14 shrink-0">
                              <span className="block text-sm font-mono font-semibold text-slate-700 leading-none">
                                {dateDot(r.date)}
                              </span>
                              <span className="block text-[10px] text-slate-400 mt-0.5">{weekdayLabel(r.date)}</span>
                            </span>
                            <span className="w-20 shrink-0 text-sm font-mono text-slate-900">
                              {r.weightKg.toFixed(1)}
                              <span className="text-[10px] font-sans text-slate-400 ml-0.5">kg</span>
                            </span>
                            <span className="w-16 shrink-0 text-sm font-mono text-slate-600">
                              {r.restingHeartRate != null ? (
                                <>
                                  {r.restingHeartRate}
                                  <span className="text-[10px] font-sans text-slate-400 ml-0.5">次/分</span>
                                </>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </span>
                            <span className="flex-1 min-w-0 text-xs text-slate-400 truncate text-right">
                              {r.note ?? ''}
                            </span>
                            {editingDate === r.date && (
                              <span className="shrink-0 text-[10px] text-emerald-600 font-medium">编辑中</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
