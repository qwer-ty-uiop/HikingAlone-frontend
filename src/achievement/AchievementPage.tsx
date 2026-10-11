import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Medal, LockSimple } from '@phosphor-icons/react'
import { achievementApi } from './api'
import { MotionList, MotionItem } from '../components/ui'
import type { Achievement, AchievementGroup } from './types'

interface AchievementPageProps {
  go: (link: string) => void
}

/** 徽章卡片（独立小组件：进度条弹簧过渡 + 达成/未达成两种形态） */
function BadgeCard({ a, index }: { a: Achievement; index: number }) {
  return (
    <MotionItem>
      <motion.div
        whileHover={{ y: -2 }}
        className={`h-full rounded-4xl border p-6 transition-all ${
          a.achieved
            ? 'border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50/60 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.25)]'
            : 'border-slate-200/50 bg-white'
        }`}
      >
        <div className="flex items-start justify-between">
          <motion.div
            animate={
              a.achieved
                ? { rotate: [0, -8, 8, 0], scale: [1, 1.08, 1] }
                : {}
            }
            transition={{ repeat: a.achieved ? Infinity : 0, duration: 4, repeatDelay: 2 }}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
              a.achieved ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-300'
            }`}
          >
            {a.achieved ? <Medal size={22} weight="fill" /> : <LockSimple size={20} weight="regular" />}
          </motion.div>
          <span
            className={`text-[11px] font-mono ${
              a.achieved ? 'text-emerald-600 font-medium' : 'text-slate-400'
            }`}
          >
            {a.progressPercent}%
          </span>
        </div>
        <h3
          className={`mt-4 font-bold ${a.achieved ? 'text-slate-900' : 'text-slate-500'}`}
        >
          {a.name}
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">{a.description}</p>
        <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${a.achieved ? 'bg-emerald-500' : 'bg-slate-300'}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, a.progressPercent)}%` }}
            transition={{ type: 'spring', stiffness: 60, damping: 20, delay: index * 0.05 }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400 font-mono">
          <span>
            {a.current % 1 === 0 ? a.current : a.current.toFixed(1)}
          </span>
          <span>{a.target % 1 === 0 ? a.target : a.target.toFixed(1)}</span>
        </div>
      </motion.div>
    </MotionItem>
  )
}

export default function AchievementPage({ go }: AchievementPageProps) {
  const [groups, setGroups] = useState<AchievementGroup[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    achievementApi
      .all()
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const all = groups?.flatMap((g) => g.achievements) ?? []
  const achievedCount = all.filter((a) => a.achieved).length

  return (
    <div className="min-h-[100dvh] bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-amber-200/30 blur-3xl" />
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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">成就徽章</h1>
              <p className="text-[11px] text-slate-400 mt-1">里程碑实时计算 · 无需打卡</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium font-mono">
            <Medal size={14} weight="fill" />
            {achievedCount} / {all.length}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          <div className="space-y-10">
            {[0, 1].map((g) => (
              <div key={g}>
                <div className="w-24 h-4 bg-slate-200/70 rounded-full skeleton-shimmer mb-5" />
                <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-48 bg-slate-100 skeleton-shimmer rounded-4xl" />
                  ))}
                </div>
              </div>
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
          <div className="space-y-10">
            {groups?.map((g) => (
              <section key={g.group}>
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="text-sm font-semibold text-slate-500">{g.group}</h2>
                  <span className="text-[11px] text-slate-300 font-mono">
                    {g.achievements.filter((a) => a.achieved).length}/{g.achievements.length}
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <MotionList className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  {g.achievements.map((a, i) => (
                    <BadgeCard key={a.code} a={a} index={i} />
                  ))}
                </MotionList>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
