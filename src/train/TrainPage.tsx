import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, CalendarBlank } from '@phosphor-icons/react'
import { trainApi } from './api'
import Heatmap from './Heatmap'
import PlanFormModal from './PlanFormModal'
import PlanDetailModal from './PlanDetailModal'
import type { PlanCreateDTO, PlanStatus, TrainHomeData } from './types'

const STATUS_META: Record<PlanStatus, { label: string; dotClass: string; textClass: string }> = {
  0: { label: '已放弃', dotClass: 'bg-slate-400', textClass: 'text-slate-500' },
  1: { label: '进行中', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600' },
  2: { label: '已完成', dotClass: 'bg-emerald-800', textClass: 'text-emerald-800' },
  3: { label: '已过期', dotClass: 'bg-orange-500', textClass: 'text-orange-600' },
}

function dateLabel(date: string): string {
  return date.replace(/-/g, '.')
}

/** 列表 stagger 入场参数：父容器统一下发，子项逐个浮现 */
const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const listItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } as const },
}

interface TrainPageProps {
  go: (link: string) => void
}

export default function TrainPage({ go }: TrainPageProps) {
  const [data, setData] = useState<TrainHomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    trainApi
      .getHome()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (dto: PlanCreateDTO) => {
    setCreating(true)
    try {
      await trainApi.createPlan(dto)
      setShowCreate(false)
      load()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">
                训练
              </h1>
              <p className="text-[11px] text-slate-400 mt-1">周期计划 · 每日打卡 · 热力图</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
          >
            <Plus size={15} weight="bold" />
            新建计划
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          /* 骨架加载：与最终布局同构 */
          <div className="grid lg:grid-cols-[2fr_1fr] gap-8">
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
                  <div className="w-40 h-4 bg-slate-200/70 rounded-full animate-pulse mb-3" />
                  <div className="w-64 h-3 bg-slate-200/70 rounded-full animate-pulse mb-6" />
                  <div className="h-2 rounded-full bg-slate-200/70 animate-pulse mb-3" />
                  <div className="w-52 h-3 bg-slate-200/70 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
            <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
              <div className="w-36 h-5 bg-slate-200/70 rounded-full animate-pulse mb-8" />
              <div className="grid grid-cols-[repeat(20,10px)] gap-[3px]">
                {Array.from({ length: 140 }).map((_, i) => (
                  <div key={i} className="w-[10px] h-[10px] rounded-[3px] bg-slate-100 animate-pulse" />
                ))}
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
          /* 非对称分栏：计划 2fr · 热力图 1fr */
          <div className="grid lg:grid-cols-[2fr_1fr] gap-8 items-start">
            {/* 计划列表：无卡片，用分割线分组 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl md:text-2xl font-bold tracking-tighter text-slate-900">
                  我的计划
                </h2>
                <span className="text-xs font-mono text-slate-400">{data?.plans.length ?? 0}</span>
              </div>

              {!data?.plans.length ? (
                /* 空状态 */
                <div className="py-16 text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <CalendarBlank size={26} weight="light" className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 text-sm mb-5">
                    还没有训练计划
                    <span className="block text-xs text-slate-400 mt-1">
                      制定一个周期计划，从今天开始坚持
                    </span>
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
                  >
                    制定第一个计划
                  </button>
                </div>
              ) : (
                <motion.ul
                  variants={listContainer}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-slate-100"
                >
                  {data.plans.map((plan) => {
                    const status = STATUS_META[plan.status]
                    const doneItems = plan.items.filter((it) => it.done).length
                    return (
                      <motion.li key={plan.id} variants={listItem}>
                        <button
                          onClick={() => setDetailId(plan.id)}
                          className="w-full text-left py-5 px-1 group active:scale-[0.995] transition-transform"
                        >
                          <div className="flex items-start justify-between gap-4 mb-2.5">
                            <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                              {plan.title}
                            </h3>
                            <span className={`flex items-center gap-1.5 text-xs shrink-0 ${status.textClass}`}>
                              {/* 进行中状态脉冲点：强调"活"的进行感 */}
                              {plan.status === 1 ? (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                                  <span className={`relative inline-flex rounded-full h-2 w-2 ${status.dotClass}`} />
                                </span>
                              ) : (
                                <span className={`inline-flex rounded-full h-2 w-2 ${status.dotClass}`} />
                              )}
                              {status.label}
                            </span>
                          </div>
                          {plan.description && (
                            <p className="text-sm text-slate-400 mb-2.5 line-clamp-2">{plan.description}</p>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                                style={{ width: `${plan.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-slate-600">{plan.progress}%</span>
                          </div>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className="text-xs text-slate-400">
                              {dateLabel(plan.startDate)} ~ {dateLabel(plan.endDate)}
                            </span>
                            <span className="text-xs text-slate-400">
                              {plan.items.length} 项 · 达标{' '}
                              <span className="font-mono">{doneItems}/{plan.items.length}</span>
                            </span>
                          </div>
                        </button>
                      </motion.li>
                    )
                  })}
                </motion.ul>
              )}
            </section>

            {/* 热力图 */}
            <Heatmap data={data?.heatmap ?? null} />
          </div>
        )}
      </main>

      {/* 弹窗 */}
      <PlanFormModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      {detailId !== null && (
        <PlanDetailModal planId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
      )}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-2 bg-white rounded-xl px-5 py-3 text-sm text-slate-600 shadow-xl">
            <span className="w-4 h-4 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
            创建计划中
          </div>
        </div>
      )}
    </div>
  )
}
