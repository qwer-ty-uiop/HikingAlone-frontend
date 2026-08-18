import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { motion, useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion'
import { ArrowLeft, Plus, CalendarBlank, PencilSimple, TrashSimple, CheckCircle, Prohibit, MagnifyingGlass, X } from '@phosphor-icons/react'
import { trainApi } from './api'
import Heatmap, { type RecentRecord } from './Heatmap'
import PlanFormModal from './PlanFormModal'
import PlanDetailModal from './PlanDetailModal'
import type { CycleType, PlanAbandonDTO, PlanCreateDTO, PlanDeleteDTO, PlanStatus, PlanUpdateDTO, TrainHomeData, TrainingPlan } from './types'

const STATUS_META: Record<PlanStatus, { label: string; dotClass: string; textClass: string; sectionClass: string }> = {
  0: { label: '已放弃', dotClass: 'bg-slate-400', textClass: 'text-slate-500', sectionClass: 'text-slate-500' },
  1: { label: '进行中', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600', sectionClass: 'text-emerald-600' },
  2: { label: '已完成', dotClass: 'bg-emerald-800', textClass: 'text-emerald-800', sectionClass: 'text-emerald-800' },
  3: { label: '已过期', dotClass: 'bg-orange-500', textClass: 'text-orange-600', sectionClass: 'text-orange-600' },
}

/** 状态分列展示顺序：进行中在前，其余依次 */
const STATUS_ORDER: PlanStatus[] = [1, 2, 3, 0]

function dateLabel(date: string): string {
  return date.replace(/-/g, '.')
}

const CYCLE_LABELS: Record<CycleType, string> = { 0: '', 1: '每天', 2: '每周', 3: '每月', 4: '每年' }

/** 周期标签：如 每天 / 每周3 / 每月15 / 每年8.15；默认锚点省略数字 */
function cycleLabel(plan: TrainingPlan): string {
  const base = CYCLE_LABELS[plan.cycleType]
  if (!base || plan.cycleAnchor == null) return base
  if (plan.cycleType === 2 || plan.cycleType === 3) return `${base}${plan.cycleAnchor}`
  const m = Math.floor(plan.cycleAnchor / 100)
  const d = plan.cycleAnchor % 100
  return `${base}${m}.${d}`
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

/** 数字滚动：值变化时弹簧过渡（订阅 motion value 的渲染值到 state，避免 motion value 直接作 children 渲染异常） */
function CountUp({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(useMotionValue(0), { stiffness: 100, damping: 20 })
  const [display, setDisplay] = useState(0)
  useMotionValueEvent(spring, 'change', (v) => setDisplay(Math.round(v)))
  useEffect(() => {
    spring.set(value)
  }, [value, spring])
  return <span className={className}>{display}</span>
}

/** 磁吸 CTA：按钮中心向鼠标微幅吸附，motion value 驱动不触发 React 重渲染 */
function Magnetic({ children }: { children: ReactNode }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 100, damping: 20 })
  const sy = useSpring(y, { stiffness: 100, damping: 20 })
  return (
    <motion.div
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - rect.left - rect.width / 2) * 0.2)
        y.set((e.clientY - rect.top - rect.height / 2) * 0.35)
      }}
      onMouseLeave={() => {
        x.set(0)
        y.set(0)
      }}
      className="inline-block"
    >
      {children}
    </motion.div>
  )
}

interface TrainPageProps {
  go: (link: string) => void
}

export default function TrainPage({ go }: TrainPageProps) {
  const [data, setData] = useState<TrainHomeData | null>(null)
  const [recent, setRecent] = useState<RecentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [editingPlan, setEditingPlan] = useState<TrainingPlan | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [abandoningId, setAbandoningId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  /** 两步确认删除：待确认的计划 id（悬停显示危险态） */
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  // 计划搜索：匹配标题与描述（忽略大小写）
  const [query, setQuery] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    trainApi
      .getHome()
      .then((d) => {
        setData(d)
        // 最近提交：GET /train 聚合已带各计划 records，按 updateTime ?? createTime 从新到旧取最近 5 条
        const recents = d.plans
          .flatMap((p) =>
            p.records.map((r) => {
              const item = p.items.find((it) => it.id === r.itemId)
              return {
                id: r.id,
                planId: p.id,
                itemId: r.itemId,
                date: r.date,
                createTime: r.createTime,
                updateTime: r.updateTime,
                planTitle: p.title,
                itemName: item?.name ?? `训练项#${r.itemId}`,
                mode: item?.mode ?? 'times',
                unit: item?.unit ?? '',
                completedSets: r.completedSets,
                completedTimes: r.completedTimes,
              }
            }),
          )
          .sort((a, b) => {
            // 从新到旧：编辑过的按 updateTime，否则按 createTime；缺省退化按日期
            const ta = a.updateTime ?? a.createTime ?? `${a.date}T00:00:00`
            const tb = b.updateTime ?? b.createTime ?? `${b.date}T00:00:00`
            return ta < tb ? 1 : ta > tb ? -1 : 0
          })
          .slice(0, 5)
        setRecent(recents)
      })
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

  const handleUpdate = async (dto: PlanUpdateDTO) => {
    setCreating(true)
    try {
      await trainApi.updatePlan(dto)
      setEditingPlan(null)
      load()
    } finally {
      setCreating(false)
    }
  }

  const handleAbandon = async (plan: TrainingPlan) => {
    const dto: PlanAbandonDTO = { id: plan.id }
    setAbandoningId(plan.id)
    try {
      await trainApi.abandonPlan(dto)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
      load()
    } finally {
      setAbandoningId(null)
    }
  }

  const handleDelete = async (plan: TrainingPlan) => {
    const dto: PlanDeleteDTO = { id: plan.id }
    setDeletingId(plan.id)
    try {
      await trainApi.deletePlan(dto)
      setConfirmDeleteId(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      load()
    } finally {
      setDeletingId(null)
    }
  }

  const plans = data?.plans ?? []

  // 搜索过滤：标题 / 描述包含关键字（忽略大小写）
  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  const visiblePlans = searching
    ? plans.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q),
      )
    : plans

  // 按状态分列
  const groups = STATUS_ORDER.map((status) => ({
    status,
    plans: visiblePlans.filter((p) => p.status === status),
  })).filter((g) => g.plans.length > 0)

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* 环境氛围：右上角 emerald 光晕 + 左下角暖光，固定层不拦截交互，页面层次立刻立起来 */}
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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">
                训练
              </h1>
              <p className="text-[11px] text-slate-400 mt-1">周期计划 · 每日打卡 · 热力图</p>
            </div>
          </div>
          <Magnetic>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
            >
              <Plus size={15} weight="bold" />
              新建计划
            </button>
          </Magnetic>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          /* 骨架加载：微光流动，与最终布局同构 —— 热力图全宽在上，计划全宽在下 */
          <div className="space-y-8">
            <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
              <div className="w-36 h-5 bg-slate-200/70 rounded-full skeleton-shimmer mb-2" />
              <div className="w-56 h-3 bg-slate-200/70 rounded-full skeleton-shimmer mb-8" />
              <div className="grid grid-cols-[repeat(20,10px)] gap-[3px]">
                {Array.from({ length: 140 }).map((_, i) => (
                  <div key={i} className="w-[10px] h-[10px] rounded-[3px] bg-slate-100 skeleton-shimmer" />
                ))}
              </div>
            </div>
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
                  <div className="w-40 h-4 bg-slate-200/70 rounded-full skeleton-shimmer mb-3" />
                  <div className="w-64 h-3 bg-slate-200/70 rounded-full skeleton-shimmer mb-6" />
                  <div className="h-2 rounded-full bg-slate-200/70 skeleton-shimmer mb-3" />
                  <div className="w-52 h-3 bg-slate-200/70 rounded-full skeleton-shimmer" />
                </div>
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
          /* 纵向堆叠：热力图全宽一行在上，计划列表全宽在下 */
          <div className="space-y-8">
            {/* 热力图 */}
            <Heatmap data={data?.heatmap ?? null} recent={recent} onEdited={load} />

            {/* 计划列表：无卡片，用分割线分组 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tighter text-slate-900">
                    我的计划
                  </h2>
                  {/* 计划总数：pill 徽章，数字弹簧滚动；搜索时显示匹配数 */}
                  <div className="flex items-baseline gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white">
                    <CountUp value={visiblePlans.length} className="text-base font-mono font-semibold leading-none" />
                    <span className="text-[11px] text-slate-300 leading-none">个计划</span>
                  </div>
                </div>
                {/* 搜索框：胶囊样式，输入区正常可选中 */}
                <div className="relative w-full sm:w-64">
                  <MagnifyingGlass
                    size={15}
                    weight="bold"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索计划标题或描述…"
                    className="w-full pl-10 pr-9 py-2 text-sm rounded-full bg-slate-100 border border-transparent focus:outline-none focus:bg-white focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors active:scale-90"
                      aria-label="清除搜索"
                    >
                      <X size={13} weight="bold" />
                    </button>
                  )}
                </div>
              </div>

              {!plans.length ? (
                /* 空状态：图标微幅漂浮 + 双按钮引导 */
                <div className="py-16 text-center">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
                    className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4"
                  >
                    <CalendarBlank size={26} weight="light" className="text-slate-300" />
                  </motion.div>
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
              ) : searching && groups.length === 0 ? (
                /* 搜索无结果：提示关键字 + 一键清除 */
                <div className="py-16 text-center">
                  <MagnifyingGlass size={28} weight="light" className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 text-sm">
                    未找到与「{query.trim()}」相关的计划
                  </p>
                  <button
                    onClick={() => setQuery('')}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
                  >
                    清除搜索
                  </button>
                </div>
              ) : (
                // auto-fit 列：窄屏 1 列，宽屏 4 个状态可同一行放下
                <motion.div layout className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(260px,1fr))] items-start">
                  {groups.map((group) => {
                    const meta = STATUS_META[group.status]
                    return (
                      <motion.div
                        key={group.status}
                        layout
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                        className="rounded-2xl border border-slate-200/60 p-4 min-w-0"
                      >
                        {/* 列标题：状态色块 + 计数徽章 */}
                        <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-1.5 h-4 rounded-full ${meta.dotClass}`} />
                            <h3 className={`text-sm font-bold tracking-wide ${meta.sectionClass}`}>
                              {meta.label}
                            </h3>
                          </div>
                          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                            {group.plans.length} 个
                          </span>
                        </div>
                        <motion.ul
                          variants={listContainer}
                          initial="hidden"
                          animate="show"
                          className="space-y-3"
                        >
                          {group.plans.map((plan) => {
                            const status = STATUS_META[plan.status]
                            const doneItems = plan.items.filter((it) => it.done).length
                            const isAbandoning = abandoningId === plan.id
                            const isDeleting = deletingId === plan.id
                            const isConfirming = confirmDeleteId === plan.id
                            return (
                              <motion.li
                                key={plan.id}
                                variants={listItem}
                                className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3 hover:border-slate-200 hover:bg-white hover:shadow-[0_10px_25px_-12px_rgba(0,0,0,0.12)] transition-all"
                              >
                                <button
                                  onClick={() => setDetailId(plan.id)}
                                  className="w-full text-left active:scale-[0.995] transition-transform"
                                >
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                                      {plan.title}
                                    </h3>
                                    <span className={`flex items-center gap-1.5 text-[11px] shrink-0 ${status.textClass}`}>
                                      {/* 进行中状态脉冲点：强调"活"的进行感 */}
                                      {plan.status === 1 ? (
                                        <span className="relative flex h-1.5 w-1.5">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${status.dotClass}`} />
                                        </span>
                                      ) : (
                                        <span className={`inline-flex rounded-full h-1.5 w-1.5 ${status.dotClass}`} />
                                      )}
                                      {status.label}
                                    </span>
                                  </div>
                                  {plan.description && (
                                    <p className="text-xs text-slate-400 mb-2 line-clamp-1">{plan.description}</p>
                                  )}
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                                      <motion.div
                                        className="h-full rounded-full bg-emerald-500"
                                        initial={false}
                                        animate={{ width: `${plan.progress}%` }}
                                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-600">{plan.progress}%</span>
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 min-w-0">
                                      {plan.cycleType !== 0 && (
                                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                                          {cycleLabel(plan)}
                                        </span>
                                      )}
                                      <span className="truncate">
                                        {dateLabel(plan.startDate)} ~ {dateLabel(plan.endDate)}
                                      </span>
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      达标 <span className="font-mono">{doneItems}/{plan.items.length}</span>
                                    </span>
                                  </div>
                                </button>

                                {/* 操作：编辑 / 放弃（仅进行中）/ 删除（两步确认） */}
                                <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-slate-100">
                                  <button
                                    onClick={() => setEditingPlan(plan)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 active:scale-95 transition-all"
                                    aria-label="编辑计划"
                                    title="编辑计划"
                                  >
                                    <PencilSimple size={14} weight="bold" />
                                  </button>
                                  {plan.status === 1 && (
                                    <button
                                      onClick={() => handleAbandon(plan)}
                                      disabled={isAbandoning}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-50"
                                      aria-label="放弃计划"
                                      title="放弃计划"
                                    >
                                      {isAbandoning ? (
                                        <span className="block w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                                      ) : (
                                        <Prohibit size={14} weight="bold" />
                                      )}
                                    </button>
                                  )}
                                  <span className="flex-1" />
                                  {/* 两步确认删除：第一次点击进入确认态，再点执行 */}
                                  <button
                                    onClick={() => (isConfirming ? handleDelete(plan) : setConfirmDeleteId(plan.id))}
                                    disabled={isDeleting}
                                    onMouseLeave={() => setConfirmDeleteId(null)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 disabled:opacity-50 ${
                                      isConfirming
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                    }`}
                                    aria-label="删除计划"
                                  >
                                    {isDeleting ? (
                                      <span className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                                    ) : isConfirming ? (
                                      <CheckCircle size={13} weight="bold" />
                                    ) : (
                                      <TrashSimple size={13} weight="bold" />
                                    )}
                                    {isConfirming ? '确认删除' : '删除'}
                                  </button>
                                </div>
                              </motion.li>
                            )
                          })}
                        </motion.ul>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* 弹窗 */}
      <PlanFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
      <PlanFormModal
        open={editingPlan !== null}
        initial={editingPlan}
        onClose={() => setEditingPlan(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
      {detailId !== null && (
        <PlanDetailModal planId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
      )}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-2 bg-white rounded-xl px-5 py-3 text-sm text-slate-600 shadow-xl">
            <span className="w-4 h-4 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
            保存中
          </div>
        </div>
      )}
    </div>
  )
}
