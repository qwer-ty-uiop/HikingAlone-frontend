import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { motion, useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  MapTrifold,
  Path,
  Clock,
  TrendUp,
  UploadSimple,
} from '@phosphor-icons/react'
import { routeApi } from './api'
import RouteUploadModal from './RouteUploadModal'
import RouteDetailModal from './RouteDetailModal'
import { formatDuration } from './RouteUploadModal'
import type { RouteTrack } from './types'

/** 列表 stagger 入场参数：父容器统一下发，子项逐个浮现 */
const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const listItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } as const },
}

/** 数字滚动：值变化时弹簧过渡 */
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

interface RoutePageProps {
  go: (link: string) => void
}

/** 路线页：路线统计 + 轨迹列表 + 上传/详情弹窗 */
export default function RoutePage({ go }: RoutePageProps) {
  const [routes, setRoutes] = useState<RouteTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    routeApi
      .list()
      .then(setRoutes)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalDistance = routes.reduce((s, r) => s + (r.distance || 0), 0)
  const totalDuration = routes.reduce((s, r) => s + (r.durationMin || 0), 0)

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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">路线</h1>
              <p className="text-[11px] text-slate-400 mt-1">轨迹上传 · 里程统计 · 地图浏览</p>
            </div>
          </div>
          <Magnetic>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
            >
              <Plus size={15} weight="bold" />
              上传路线
            </button>
          </Magnetic>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          /* 骨架：统计栏 + 路线卡片，与最终布局同构 */
          <div className="space-y-8">
            <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8">
              <div className="w-36 h-5 bg-slate-200/70 rounded-full skeleton-shimmer mb-2" />
              <div className="w-56 h-3 bg-slate-200/70 rounded-full skeleton-shimmer mb-8" />
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 skeleton-shimmer rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-4xl border border-slate-200/50 bg-white p-6">
                  <div className="w-40 h-4 bg-slate-200/70 rounded-full skeleton-shimmer mb-3" />
                  <div className="w-64 h-3 bg-slate-200/70 rounded-full skeleton-shimmer mb-6" />
                  <div className="h-14 bg-slate-100 skeleton-shimmer rounded-2xl" />
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
          <div className="space-y-8">
            {/* 统计总览：路线数 / 总里程 / 总时长 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <MapTrifold size={18} weight="bold" className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tighter text-slate-900">
                    我的足迹
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">每一段路线，都被记录</p>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                <div className="px-2 md:px-6">
                  <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mb-1.5">
                    <MapTrifold size={13} weight="bold" className="text-emerald-600" />
                    路线数
                  </div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={routes.length} />
                    <span className="text-sm font-sans text-slate-400 ml-1">条</span>
                  </div>
                </div>
                <div className="px-2 md:px-6">
                  <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mb-1.5">
                    <Path size={13} weight="bold" className="text-emerald-600" />
                    累计里程
                  </div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={Math.round(totalDistance * 100) / 100} />
                    <span className="text-sm font-sans text-slate-400 ml-1">km</span>
                  </div>
                </div>
                <div className="px-2 md:px-6">
                  <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mb-1.5">
                    <Clock size={13} weight="bold" className="text-emerald-600" />
                    累计时长
                  </div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={Math.round(totalDuration)} />
                    <span className="text-sm font-sans text-slate-400 ml-1">分钟</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 路线列表 */}
            <section>
              {routes.length === 0 ? (
                /* 空状态：图标微幅漂浮 + 引导上传 */
                <div className="rounded-4xl border border-slate-200/50 bg-white py-20 text-center">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
                    className="mx-auto w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4"
                  >
                    <MapTrifold size={26} weight="light" className="text-slate-300" />
                  </motion.div>
                  <p className="text-slate-500 text-sm mb-5">
                    还没有上传路线
                    <span className="block text-xs text-slate-400 mt-1">
                      上传 GPX / KML 轨迹，记录你的每一次徒步
                    </span>
                  </p>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
                  >
                    <UploadSimple size={15} weight="bold" />
                    上传第一条路线
                  </button>
                </div>
              ) : (
                <motion.div
                  layout
                  initial="hidden"
                  animate="show"
                  variants={listContainer}
                  className="grid gap-5 grid-cols-1 md:grid-cols-2"
                >
                  {routes.map((route) => (
                    <motion.button
                      key={route.id}
                      layout
                      variants={listItem}
                      onClick={() => setDetailId(route.id)}
                      className="text-left rounded-4xl border border-slate-200/50 bg-white p-6 hover:border-emerald-200 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] transition-all active:scale-[0.995]"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-base font-bold tracking-tight text-slate-900 truncate">
                          {route.name}
                        </h3>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {route.createTime.slice(0, 10)}
                        </span>
                      </div>
                      {route.description && (
                        <p className="text-xs text-slate-400 mb-4 line-clamp-1">{route.description}</p>
                      )}
                      <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl bg-slate-50/70">
                        <div className="px-3 py-2.5">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                            <Path size={11} weight="bold" className="text-emerald-600" />
                            里程
                          </div>
                          <div className="text-sm font-mono font-semibold text-slate-900">
                            {route.distance.toFixed(2)}
                            <span className="text-[10px] font-sans text-slate-400 ml-0.5">km</span>
                          </div>
                        </div>
                        <div className="px-3 py-2.5">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                            <Clock size={11} weight="bold" className="text-emerald-600" />
                            时长
                          </div>
                          <div className="text-sm font-mono font-semibold text-slate-900">
                            {formatDuration(route.durationMin)}
                          </div>
                        </div>
                        <div className="px-3 py-2.5">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                            <TrendUp size={11} weight="bold" className="text-emerald-600" />
                            爬升
                          </div>
                          <div className="text-sm font-mono font-semibold text-slate-900">
                            {route.elevationGain.toFixed(0)}
                            <span className="text-[10px] font-sans text-slate-400 ml-0.5">m</span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* 弹窗 */}
      {showUpload && (
        <RouteUploadModal onClose={() => setShowUpload(false)} onCreated={load} />
      )}
      {detailId !== null && (
        <RouteDetailModal routeId={detailId} onClose={() => setDetailId(null)} onDeleted={load} />
      )}
    </div>
  )
}
