import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Drop,
  Footprints,
  MoonStars,
  Minus,
  Plus,
  WarningCircle,
  CheckCircle,
  Bell,
  Medal,
  BookOpen,
  Target,
  Flag,
  Flame,
} from '@phosphor-icons/react'
import { profileApi } from './api'
import { dailyApi } from '../daily/api'
import { CountUp, CountUpDecimal, MotionList, MotionItem } from '../components/ui'
import type { Dashboard } from './types'

interface ProfilePageProps {
  go: (link: string) => void
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'

export default function ProfilePage({ go }: ProfilePageProps) {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 今日快捷打卡的本地状态（部分更新语义：只提交改动的字段）
  const [stepsInput, setStepsInput] = useState('')
  const [sleepInput, setSleepInput] = useState('')
  const [checkinError, setCheckinError] = useState('')
  const [checkinMsg, setCheckinMsg] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    profileApi
      .dashboard()
      .then((d) => {
        setData(d)
        setStepsInput(d.today.steps == null ? '' : String(d.today.steps))
        setSleepInput(d.today.sleepHours == null ? '' : String(d.today.sleepHours))
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** 提交今日部分字段，成功后刷新整屏（进度/提醒会随之变化） */
  const submitToday = async (fields: { waterCups?: number; steps?: number; sleepHours?: number }) => {
    setCheckinError('')
    setCheckinMsg('')
    try {
      await dailyApi.checkin(fields)
      setCheckinMsg('已记录')
      load()
    } catch (e) {
      setCheckinError(e instanceof Error ? e.message : '打卡失败')
    }
  }

  const quickWater = (delta: number) => {
    const current = data?.today.waterCups ?? 0
    const next = Math.max(0, Math.min(30, current + delta))
    submitToday({ waterCups: next })
  }

  const saveSteps = () => {
    const s = Number(stepsInput)
    if (!stepsInput.trim() || !Number.isInteger(s) || s < 0 || s > 200000) {
      setCheckinError('步数需为 0 ~ 200000 的整数')
      return
    }
    submitToday({ steps: s })
  }

  const saveSleep = () => {
    const h = Number(sleepInput)
    if (!sleepInput.trim() || Number.isNaN(h) || h <= 0 || h > 24) {
      setCheckinError('睡眠时长需在 0 ~ 24 小时之间')
      return
    }
    submitToday({ sleepHours: h })
  }

  const today = data?.today
  const streaks = data?.streaks

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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">我的</h1>
              <p className="text-[11px] text-slate-400 mt-1">今天也要出发</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
            <Flame size={14} weight="fill" />
            日记连续 {streaks?.journalStreakMonths ?? 0} 个月
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          <div className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2 h-52 bg-slate-100 skeleton-shimmer rounded-4xl" />
              <div className="h-52 bg-slate-100 skeleton-shimmer rounded-4xl" />
            </div>
            <div className="h-24 bg-slate-100 skeleton-shimmer rounded-4xl" />
            <div className="h-40 bg-slate-100 skeleton-shimmer rounded-4xl" />
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
            <div className="grid gap-5 lg:grid-cols-3">
              {/* 今日一键打卡 */}
              <section className="lg:col-span-2 rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-slate-900">今日打卡</h2>
                  {today?.checkedIn ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <CheckCircle size={14} weight="fill" />
                      已打卡
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">还没打卡，顺手记一下</span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* 饮水：一键加减，直接落库 */}
                  <div className="rounded-2xl bg-sky-50/60 border border-sky-100/60 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                      <Drop size={13} weight="fill" className="text-sky-500" />
                      饮水（杯）
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => quickWater(-1)}
                        className="p-2.5 rounded-xl bg-white text-slate-500 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                        aria-label="减一杯"
                      >
                        <Minus size={14} weight="bold" />
                      </button>
                      <span className="text-3xl font-mono font-semibold text-slate-900 w-10 text-center">
                        {today?.waterCups ?? 0}
                      </span>
                      <button
                        onClick={() => quickWater(1)}
                        className="p-2.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 active:scale-95 transition-all shadow-sm shadow-sky-500/30"
                        aria-label="加一杯"
                      >
                        <Plus size={14} weight="bold" />
                      </button>
                    </div>
                  </div>
                  {/* 步数 */}
                  <div className="rounded-2xl bg-orange-50/50 border border-orange-100/60 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                      <Footprints size={13} weight="fill" className="text-orange-500" />
                      步数
                    </div>
                    <div className="flex gap-2">
                      <input
                        className={`${inputCls} font-mono`}
                        type="number"
                        value={stepsInput}
                        onChange={(e) => setStepsInput(e.target.value)}
                        placeholder="8000"
                      />
                      <button
                        onClick={saveSteps}
                        className="shrink-0 px-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all text-xs"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                  {/* 睡眠 */}
                  <div className="rounded-2xl bg-violet-50/50 border border-violet-100/60 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                      <MoonStars size={13} weight="fill" className="text-violet-500" />
                      睡眠（小时）
                    </div>
                    <div className="flex gap-2">
                      <input
                        className={`${inputCls} font-mono`}
                        type="number"
                        step="0.5"
                        value={sleepInput}
                        onChange={(e) => setSleepInput(e.target.value)}
                        placeholder="7.5"
                      />
                      <button
                        onClick={saveSleep}
                        className="shrink-0 px-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all text-xs"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                </div>
                {checkinError && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-red-500">
                    <WarningCircle size={15} weight="fill" />
                    {checkinError}
                  </p>
                )}
                {checkinMsg && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircle size={15} weight="fill" />
                    {checkinMsg}
                  </p>
                )}
              </section>

              {/* 待办提醒 */}
              <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-2 mb-5">
                  <Bell size={16} weight="bold" className="text-amber-500" />
                  <h2 className="font-bold text-slate-900">该做点什么</h2>
                </div>
                {(data?.todos ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-300">一切都在正轨上</p>
                ) : (
                  <div className="space-y-2.5">
                    {data?.todos.map((t, i) => (
                      <motion.button
                        key={t.type + i}
                        onClick={() => go(t.target)}
                        whileHover={{ y: -1 }}
                        className="w-full text-left flex items-center gap-2.5 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 hover:bg-amber-100/70 transition-colors active:scale-[0.99]"
                      >
                        <WarningCircle size={16} weight="fill" className="text-amber-500 shrink-0" />
                        <span className="flex-1 text-sm text-slate-700">{t.message}</span>
                        <span className="text-xs text-amber-600">去处理</span>
                      </motion.button>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* 概览数字 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">累计里程</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-emerald-600">
                    <CountUpDecimal value={data?.hiking.totalDistanceKm ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">km</span>
                  </div>
                </div>
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">累计徒步</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={data?.hiking.totalCount ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">次</span>
                  </div>
                </div>
                <div className="px-2 md:px-6 mt-4 md:mt-0">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">身体连续记录</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={streaks?.bodyStreakDays ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">天</span>
                  </div>
                </div>
                <div className="px-2 md:px-6 mt-4 md:mt-0">
                  <button onClick={() => go('/achievement')} className="text-left group">
                    <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mb-1.5">
                      <Medal size={13} weight="fill" className="text-amber-500" />
                      成就徽章
                    </div>
                    <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900 group-hover:text-amber-600 transition-colors">
                      {data?.achievement.achievedCount ?? 0}
                      <span className="text-sm font-sans text-slate-400 ml-1">/ {data?.achievement.totalCount ?? 0}</span>
                    </div>
                  </button>
                </div>
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* 进行中目标 */}
              <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Target size={16} weight="bold" className="text-emerald-600" />
                    <h2 className="font-bold text-slate-900">进行中目标</h2>
                  </div>
                  <button onClick={() => go('/goal')} className="text-xs text-slate-400 hover:text-emerald-600 transition-colors">
                    管理目标
                  </button>
                </div>
                {(data?.activeGoals ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-300">还没有进行中的目标</p>
                ) : (
                  <div className="space-y-4">
                    {data?.activeGoals.map((g) => (
                      <button key={g.id} onClick={() => go('/goal')} className="w-full text-left group">
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-slate-700 group-hover:text-emerald-700 transition-colors">{g.metricLabel}</span>
                          <span className="font-mono text-xs text-slate-400">
                            {g.current % 1 === 0 ? g.current : g.current.toFixed(1)} / {g.targetValue} {g.unit} · {g.percent}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, g.percent)}%` }}
                            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* 最近日记 + 心愿 */}
              <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} weight="bold" className="text-emerald-600" />
                    <h2 className="font-bold text-slate-900">最近日记</h2>
                  </div>
                  <button onClick={() => go('/journal')} className="text-xs text-slate-400 hover:text-emerald-600 transition-colors">
                    全部日记
                  </button>
                </div>
                {(data?.recentJournals ?? []).length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-300">还没有日记</p>
                ) : (
                  <MotionList className="divide-y divide-slate-50">
                    {data?.recentJournals.map((j) => (
                      <MotionItem key={j.id}>
                        <button
                          onClick={() => go('/journal')}
                          className="w-full text-left flex items-center gap-3 py-2.5 group"
                        >
                          <span className="font-mono text-[11px] text-slate-300 w-12 shrink-0">
                            {j.hikeDate.slice(5).replace('-', '.')}
                          </span>
                          <span className="flex-1 text-sm text-slate-700 group-hover:text-emerald-700 transition-colors truncate">
                            {j.title}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            {j.distanceKm != null ? `${j.distanceKm.toFixed(1)}km` : ''}
                          </span>
                        </button>
                      </MotionItem>
                    ))}
                  </MotionList>
                )}
                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center gap-4 text-xs text-slate-400">
                  <Flag size={13} className="text-rose-400" weight="fill" />
                  <span>想去 {data?.wish.wishCount ?? 0}</span>
                  <span>已计划 {data?.wish.plannedCount ?? 0}</span>
                  <span>已完成 {data?.wish.doneCount ?? 0}</span>
                  <button onClick={() => go('/wish')} className="ml-auto text-slate-400 hover:text-emerald-600 transition-colors">
                    看看心愿单
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
