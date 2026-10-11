import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Drop,
  Footprints,
  MoonStars,
  Minus,
  Plus,
  WarningCircle,
  Star,
  CheckCircle,
} from '@phosphor-icons/react'
import { dailyApi } from './api'
import DateField from '../train/DateField'
import WeightChart from '../body/WeightChart'
import { CountUpDecimal, MotionList, MotionItem, dateDot, todayStr } from '../components/ui'
import type { DailyCheckin, DailyRecent } from './types'

interface DailyPageProps {
  go: (link: string) => void
}

/** 趋势图指标：饮水 / 步数 / 睡眠 */
type Metric = 'water' | 'steps' | 'sleep'

const METRIC_META: Record<Metric, { label: string; unit: string; color: string; digits: number }> = {
  water: { label: '饮水', unit: '杯', color: '#0ea5e9', digits: 0 },
  steps: { label: '步数', unit: '步', color: '#f97316', digits: 0 },
  sleep: { label: '睡眠', unit: '小时', color: '#8b5cf6', digits: 1 },
}

export default function DailyPage({ go }: DailyPageProps) {
  const [data, setData] = useState<DailyRecent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 打卡表单：editingDate 非空 = 正在编辑某天（点击历史记录回填）
  const [formDate, setFormDate] = useState(todayStr())
  const [water, setWater] = useState('')
  const [steps, setSteps] = useState('')
  const [sleepHours, setSleepHours] = useState('')
  const [sleepQuality, setSleepQuality] = useState(0)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [submitMsg, setSubmitMsg] = useState('')

  // 趋势图指标切换
  const [metric, setMetric] = useState<Metric>('water')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    dailyApi
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
  const todayRecord = records.find((r) => r.date === todayStr())

  // 表单初始值跟随今天已有记录（部分更新语义：留空=不覆盖）
  useEffect(() => {
    if (!loading && todayRecord) {
      setWater(todayRecord.waterCups == null ? '' : String(todayRecord.waterCups))
      setSteps(todayRecord.steps == null ? '' : String(todayRecord.steps))
      setSleepHours(todayRecord.sleepHours == null ? '' : String(todayRecord.sleepHours))
      setSleepQuality(todayRecord.sleepQuality ?? 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const chartPoints = useMemo(() => {
    return records
      .filter((r) => {
        if (metric === 'water') return r.waterCups != null
        if (metric === 'steps') return r.steps != null
        return r.sleepHours != null
      })
      .map((r) => ({
        date: r.date,
        value:
          metric === 'water'
            ? (r.waterCups as number)
            : metric === 'steps'
              ? (r.steps as number)
              : (r.sleepHours as number),
      }))
  }, [records, metric])

  /** 快捷 +1 杯水（直接提交，无需保存按钮） */
  const quickWater = async (delta: number) => {
    const current = todayRecord?.waterCups ?? 0
    const next = Math.max(0, current + delta)
    if (next > 30) return
    try {
      await dailyApi.checkin({ date: todayStr(), waterCups: next })
      setWater(String(next))
      load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '打卡失败')
    }
  }

  const validate = (): string => {
    const hasAny = water.trim() || steps.trim() || sleepHours.trim() || sleepQuality > 0
    if (!hasAny) return '请至少填写一项打卡数据'
    if (water.trim()) {
      const w = Number(water)
      if (!Number.isInteger(w) || w < 0 || w > 30) return '饮水杯数需为 0 ~ 30 的整数'
    }
    if (steps.trim()) {
      const s = Number(steps)
      if (!Number.isInteger(s) || s < 0 || s > 200000) return '步数需为 0 ~ 200000 的整数'
    }
    if (sleepHours.trim()) {
      const h = Number(sleepHours)
      if (Number.isNaN(h) || h <= 0 || h > 24) return '睡眠时长需在 0 ~ 24 小时之间'
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
    setSubmitMsg('')
    try {
      await dailyApi.checkin({
        date: editingDate ?? formDate,
        waterCups: water.trim() ? Number(water) : undefined,
        steps: steps.trim() ? Number(steps) : undefined,
        sleepHours: sleepHours.trim() ? Number(sleepHours) : undefined,
        sleepQuality: sleepQuality > 0 ? sleepQuality : undefined,
      })
      setSubmitMsg(editingDate ? `${dateDot(editingDate)} 已更新` : '已打卡')
      setEditingDate(null)
      setFormDate(todayStr())
      load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (r: DailyCheckin) => {
    setEditingDate(r.date)
    setFormDate(r.date)
    setWater(r.waterCups == null ? '' : String(r.waterCups))
    setSteps(r.steps == null ? '' : String(r.steps))
    setSleepHours(r.sleepHours == null ? '' : String(r.sleepHours))
    setSleepQuality(r.sleepQuality ?? 0)
    setSubmitMsg('')
    setFormError('')
  }

  const cancelEdit = () => {
    setEditingDate(null)
    setFormDate(todayStr())
    if (todayRecord) {
      setWater(todayRecord.waterCups == null ? '' : String(todayRecord.waterCups))
      setSteps(todayRecord.steps == null ? '' : String(todayRecord.steps))
      setSleepHours(todayRecord.sleepHours == null ? '' : String(todayRecord.sleepHours))
      setSleepQuality(todayRecord.sleepQuality ?? 0)
    }
    setFormError('')
  }

  /** 历史列表按月分组（升序 → 倒序展示） */
  const monthGroups = useMemo(() => {
    const map = new Map<string, DailyCheckin[]>()
    for (const r of [...records].reverse()) {
      const key = r.date.slice(0, 7)
      const arr = map.get(key)
      if (arr) arr.push(r)
      else map.set(key, [r])
    }
    return [...map.entries()].map(([month, list]) => ({ month, list }))
  }, [records])

  const meta = METRIC_META[metric]
  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5'

  return (
    <div className="min-h-[100dvh] bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-48 -left-32 w-[520px] h-[520px] rounded-full bg-violet-200/25 blur-3xl" />
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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">每日打卡</h1>
              <p className="text-[11px] text-slate-400 mt-1">饮水 · 步数 · 睡眠，一日三问</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 text-sky-700 text-xs font-medium">
            <Drop size={14} weight="fill" />
            今日 {todayRecord?.waterCups ?? 0} 杯
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          <div className="space-y-8">
            <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
              <div className="grid grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 skeleton-shimmer rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-5">
              <div className="lg:col-span-2 rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-11 bg-slate-100 skeleton-shimmer rounded-2xl" />
                ))}
              </div>
              <div className="lg:col-span-3 rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
                <div className="h-64 bg-slate-100 skeleton-shimmer rounded-2xl" />
              </div>
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
            {/* 汇总统计 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">今日饮水</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUpDecimal value={todayRecord?.waterCups ?? 0} digits={0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">杯</span>
                  </div>
                </div>
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">7 天饮水均值</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    {summary?.avgWater7 != null ? summary.avgWater7.toFixed(1) : '—'}
                    <span className="text-sm font-sans text-slate-400 ml-1">杯</span>
                  </div>
                </div>
                <div className="px-2 md:px-6 mt-4 md:mt-0">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">7 天步数均值</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    {summary?.avgSteps7 != null ? Math.round(summary.avgSteps7).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="px-2 md:px-6 mt-4 md:mt-0">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">7 天睡眠均值</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    {summary?.avgSleep7 != null ? summary.avgSleep7.toFixed(1) : '—'}
                    <span className="text-sm font-sans text-slate-400 ml-1">h</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-5">
              {/* 打卡表单 */}
              <section className="lg:col-span-2 rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-slate-900">今日打卡</h2>
                  {editingDate && (
                    <button
                      onClick={cancelEdit}
                      className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 font-medium"
                    >
                      编辑 {dateDot(editingDate)} · 取消
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>日期</label>
                    <DateField value={formDate} onChange={setFormDate} />
                  </div>
                  <div>
                    <label className={labelCls}>饮水（杯，250ml/杯）</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => quickWater(-1)}
                        className="p-2.5 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"
                        aria-label="减一杯"
                      >
                        <Minus size={14} weight="bold" />
                      </button>
                      <input
                        className={`${inputCls} text-center font-mono`}
                        type="number"
                        value={water}
                        onChange={(e) => setWater(e.target.value)}
                        placeholder="0"
                      />
                      <button
                        onClick={() => quickWater(1)}
                        className="p-2.5 rounded-xl bg-sky-50 text-sky-600 hover:bg-sky-100 active:scale-95 transition-all"
                        aria-label="加一杯"
                      >
                        <Plus size={14} weight="bold" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>步数</label>
                    <input
                      className={`${inputCls} font-mono`}
                      type="number"
                      value={steps}
                      onChange={(e) => setSteps(e.target.value)}
                      placeholder="8000"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>睡眠 小时</label>
                      <input
                        className={`${inputCls} font-mono`}
                        type="number"
                        step="0.5"
                        value={sleepHours}
                        onChange={(e) => setSleepHours(e.target.value)}
                        placeholder="7.5"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>睡眠质量</label>
                      <div className="flex gap-1 items-center h-[42px]">
                        {[1, 2, 3, 4, 5].map((q) => (
                          <button
                            key={q}
                            onClick={() => setSleepQuality(sleepQuality === q ? 0 : q)}
                            aria-label={`质量 ${q}`}
                            className={`p-1 transition-transform active:scale-90 ${
                              sleepQuality >= q ? 'text-violet-500' : 'text-slate-200'
                            }`}
                          >
                            <Star size={18} weight={sleepQuality >= q ? 'fill' : 'regular'} />
                          </button>
                        ))}
                      </div>
                    </div>
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
                    {submitMsg && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 text-sm text-emerald-600"
                      >
                        <CheckCircle size={15} weight="fill" />
                        {submitMsg}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting ? '保存中…' : editingDate ? '更新该天' : '打卡保存'}
                  </button>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    只填写想更新的项即可，其余保持不变；同一天可多次打卡，互不覆盖。
                  </p>
                </div>
              </section>

              {/* 趋势图 */}
              <section className="lg:col-span-3 rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-bold text-slate-900">30 天趋势</h2>
                  <div className="flex gap-1 rounded-full bg-slate-100 p-1">
                    {(Object.keys(METRIC_META) as Metric[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetric(m)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                          metric === m ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-400'
                        }`}
                      >
                        {METRIC_META[m].label}
                      </button>
                    ))}
                  </div>
                </div>
                {chartPoints.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center">
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                    >
                      <Drop size={36} weight="light" className="text-slate-200" />
                    </motion.div>
                    <p className="mt-3 text-sm text-slate-300">还没有 {meta.label} 数据，先打卡一天试试</p>
                  </div>
                ) : (
                  <WeightChart points={chartPoints} unit={meta.unit} color={meta.color} />
                )}
              </section>
            </div>

            {/* 历史记录 */}
            {monthGroups.length > 0 && (
              <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <h2 className="font-bold text-slate-900 mb-5">历史记录</h2>
                {monthGroups.map(({ month, list }) => (
                  <div key={month} className="mb-6 last:mb-0">
                    <div className="text-xs font-semibold text-slate-400 mb-2">{month.replace('-', '.')}</div>
                    <MotionList className="divide-y divide-slate-50">
                      {list.map((r) => (
                        <MotionItem key={r.id}>
                          <button
                            onClick={() => startEdit(r)}
                            className={`w-full flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl text-left transition-colors hover:bg-slate-50 ${
                              editingDate === r.date ? 'bg-emerald-50/60' : ''
                            }`}
                          >
                            <span className="font-mono text-xs text-slate-400 w-14 shrink-0">{dateDot(r.date)}</span>
                            <span className="flex items-center gap-1 text-sm text-slate-700 w-20 shrink-0">
                              <Drop size={13} className="text-sky-500" weight="fill" />
                              <span className="font-mono">{r.waterCups ?? '—'}</span>
                            </span>
                            <span className="flex items-center gap-1 text-sm text-slate-700 w-24 shrink-0">
                              <Footprints size={13} className="text-orange-500" weight="fill" />
                              <span className="font-mono">{r.steps != null ? r.steps.toLocaleString() : '—'}</span>
                            </span>
                            <span className="flex items-center gap-1 text-sm text-slate-700 w-24 shrink-0">
                              <MoonStars size={13} className="text-violet-500" weight="fill" />
                              <span className="font-mono">{r.sleepHours != null ? r.sleepHours.toFixed(1) : '—'}h</span>
                            </span>
                            <span className="hidden sm:flex items-center gap-0.5 ml-auto">
                              {[1, 2, 3, 4, 5].map((q) => (
                                <Star
                                  key={q}
                                  size={11}
                                  weight={r.sleepQuality != null && q <= r.sleepQuality ? 'fill' : 'regular'}
                                  className={r.sleepQuality != null && q <= r.sleepQuality ? 'text-violet-400' : 'text-slate-200'}
                                />
                              ))}
                            </span>
                          </button>
                        </MotionItem>
                      ))}
                    </MotionList>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
