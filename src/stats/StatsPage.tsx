import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ChartBar, Tent, ArrowUp, Coins, CalendarBlank } from '@phosphor-icons/react'
import { statsApi } from './api'
import { CountUp, CountUpDecimal, MotionList, MotionItem, dateDot } from '../components/ui'
import type { YearlyStats } from './types'

interface StatsPageProps {
  go: (link: string) => void
}

/** 月度里程柱状图（纯 SVG，柱高弹簧动画；prev 存在时画今年 vs 去年双柱对比） */
function MonthlyBars({
  monthly,
  prev,
}: {
  monthly: YearlyStats['monthly']
  prev?: YearlyStats['monthly'] | null
}) {
  const max = Math.max(...monthly.map((m) => m.distanceKm), ...(prev ?? []).map((m) => m.distanceKm), 1)
  const W = 640
  const H = 200
  const PAD = { l: 8, r: 8, t: 12, b: 24 }
  const barArea = W - PAD.l - PAD.r
  const barGap = 10
  const barWidth = (barArea - barGap * 11) / 12
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {monthly.map((m, i) => {
        const h = m.distanceKm > 0 ? ((H - PAD.t - PAD.b) * m.distanceKm) / max : 0
        const x = PAD.l + i * (barWidth + barGap)
        const y = H - PAD.b - h
        return (
          <g key={m.month}>
            {(() => {
              const prevMonth = prev?.[m.month - 1]
              const hasPrev = prevMonth != null && prevMonth.distanceKm > 0
              const w = hasPrev ? barWidth / 2 - 1 : barWidth
              const prevH = hasPrev ? ((H - PAD.t - PAD.b) * (prevMonth?.distanceKm ?? 0)) / max : 0
              return (
                <>
                  {hasPrev && (
                    <motion.rect
                      x={x}
                      initial={{ y: H - PAD.b, height: 0 }}
                      animate={{ y: H - PAD.b - prevH, height: prevH }}
                      transition={{ type: 'spring', stiffness: 60, damping: 20, delay: i * 0.04 }}
                      width={w}
                      rx={3}
                      fill="#cbd5e1"
                    />
                  )}
                  {m.distanceKm > 0 && (
                    <motion.rect
                      x={hasPrev ? x + w + 2 : x}
                      initial={{ y: H - PAD.b, height: 0 }}
                      animate={{ y, height: h }}
                      transition={{ type: 'spring', stiffness: 60, damping: 20, delay: i * 0.04 }}
                      width={w}
                      rx={4}
                      fill={i === new Date().getMonth() ? '#10b981' : '#94a3b8'}
                    />
                  )}
                </>
              )
            })()}
            {m.hikeCount > 0 && h > 16 && (
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize="9"
                fill={i === new Date().getMonth() ? '#059669' : '#94a3b8'}
                fontFamily="ui-monospace, monospace"
              >
                {m.distanceKm.toFixed(0)}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#94a3b8"
              fontFamily="ui-monospace, monospace"
            >
              {m.month}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function StatsPage({ go }: StatsPageProps) {
  const [stats, setStats] = useState<YearlyStats | null>(null)
  const [prevStats, setPrevStats] = useState<YearlyStats | null>(null)
  const [years, setYears] = useState<{ year: number; hikeCount: number }[]>([])
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback((y: number) => {
    setLoading(true)
    setError('')
    statsApi
      .annual(y)
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(year)
    // 对比数据：去年同接口，静默失败不影响主图
    statsApi
      .annual(year - 1)
      .then((s) => setPrevStats(s.hikeCount > 0 ? s : null))
      .catch(() => setPrevStats(null))
  }, [load, year])

  useEffect(() => {
    statsApi
      .years()
      .then((ys) => {
        setYears(ys)
        if (ys.length > 0 && !ys.some((y) => y.year === new Date().getFullYear())) {
          setYear(ys[0].year)
        }
      })
      .catch(() => setYears([]))
  }, [])

  const hasData = (stats?.hikeCount ?? 0) > 0

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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">年度报告</h1>
              <p className="text-[11px] text-slate-400 mt-1">这一年，山替你记着</p>
            </div>
          </div>
          {/* 年份切换 */}
          <div className="flex gap-1 rounded-full bg-slate-100 p-1 max-w-[60vw] overflow-x-auto">
            {(years.length ? years : [{ year, hikeCount: 0 }]).map((y) => (
              <button
                key={y.year}
                onClick={() => setYear(y.year)}
                className={`relative px-3 py-1.5 text-xs rounded-full transition-colors whitespace-nowrap ${
                  year === y.year ? 'text-slate-900 font-medium' : 'text-slate-400'
                }`}
              >
                {year === y.year && (
                  <motion.span
                    layoutId="stats-year-pill"
                    className="absolute inset-0 bg-white rounded-full shadow-sm"
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                  />
                )}
                <span className="relative z-10 font-mono">
                  {y.year}
                  {y.hikeCount > 0 ? ` · ${y.hikeCount}` : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          <div className="space-y-8">
            <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 skeleton-shimmer rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
              <div className="h-56 bg-slate-100 skeleton-shimmer rounded-2xl" />
            </div>
          </div>
        ) : error ? (
          <div className="py-24 text-center">
            <p className="text-slate-500">{error}</p>
            <button
              onClick={() => load(year)}
              className="mt-4 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
            >
              重试
            </button>
          </div>
        ) : !hasData ? (
          <div className="py-24 text-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <Tent size={40} weight="light" className="text-slate-300" />
            </motion.div>
            <p className="mt-4 text-slate-400 text-sm">{year} 年还没有徒步记录，先把日记写起来</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 大数字 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">徒步次数</div>
                  <div className="text-3xl md:text-4xl font-mono font-semibold text-slate-900">
                    <CountUp value={stats?.hikeCount ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">次</span>
                  </div>
                </div>
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">总里程</div>
                  <div className="text-3xl md:text-4xl font-mono font-semibold text-emerald-600">
                    <CountUpDecimal value={stats?.totalDistanceKm ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">km</span>
                  </div>
                </div>
                <div className="px-2 md:px-6 mt-6 md:mt-0">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">总爬升</div>
                  <div className="text-3xl md:text-4xl font-mono font-semibold text-slate-900">
                    <CountUp value={Math.round(stats?.totalElevationGain ?? 0)} />
                    <span className="text-sm font-sans text-slate-400 ml-1">m</span>
                  </div>
                </div>
                <div className="px-2 md:px-6 mt-6 md:mt-0">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">总时长</div>
                  <div className="text-3xl md:text-4xl font-mono font-semibold text-slate-900">
                    <CountUp value={Math.round((stats?.totalDurationMin ?? 0) / 60)} />
                    <span className="text-sm font-sans text-slate-400 ml-1">h</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 月度分布 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2 mb-6">
                <ChartBar size={16} weight="bold" className="text-emerald-600" />
                <h2 className="font-bold text-slate-900">月度里程分布</h2>
                {prevStats && (
                  <span className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" /> 去年
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" /> 今年
                    </span>
                  </span>
                )}
                <span className="ml-auto text-[11px] text-slate-300 font-mono">单位 km</span>
              </div>
              <MonthlyBars monthly={stats?.monthly ?? []} prev={prevStats?.monthly ?? null} />
            </section>

            {/* 亮点 */}
            <MotionList className="grid gap-5 grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: <ArrowUp size={16} weight="bold" className="text-orange-500" />,
                  label: '单日最远',
                  value: `${(stats?.maxSingleDistanceKm ?? 0).toFixed(1)} km`,
                },
                {
                  icon: <ArrowUp size={16} weight="bold" className="text-violet-500" />,
                  label: '单日最大爬升',
                  value: `${Math.round(stats?.maxSingleElevationGain ?? 0)} m`,
                },
                {
                  icon: <CalendarBlank size={16} weight="bold" className="text-emerald-600" />,
                  label: '首次徒步',
                  value: stats?.firstHikeDate ? dateDot(stats.firstHikeDate) : '—',
                },
                {
                  icon: <Coins size={16} weight="bold" className="text-amber-500" />,
                  label: '总花费',
                  value: `${(stats?.totalCost ?? 0).toFixed(0)} 元`,
                },
              ].map((item) => (
                <MotionItem key={item.label}>
                  <div className="rounded-4xl border border-slate-200/50 bg-white p-6">
                    <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mb-1.5">
                      {item.icon}
                      {item.label}
                    </div>
                    <div className="text-xl md:text-2xl font-mono font-semibold text-slate-900">{item.value}</div>
                  </div>
                </MotionItem>
              ))}
            </MotionList>
          </div>
        )}
      </main>
    </div>
  )
}
