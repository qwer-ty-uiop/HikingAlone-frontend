import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash,
  PencilSimple,
  X,
  MapTrifold,
  CloudSun,
  User,
  Coins,
  WarningCircle,
  Smiley,
  SmileyMeh,
  SmileySad,
  SmileyWink,
  SmileySticker,
} from '@phosphor-icons/react'
import { journalApi } from './api'
import JournalFormModal, { DIFFICULTY_LABELS, MOOD_LABELS } from './JournalFormModal'
import { CountUp, CountUpDecimal, Magnetic, MotionList, MotionItem, dateDot } from '../components/ui'
import type { JournalDetail, JournalItem, JournalSummary } from './types'

/** 心情表情刻度：1 疲惫 ~ 5 震撼 */
const MOOD_ICONS = [SmileySad, SmileyMeh, Smiley, SmileyWink, SmileySticker]
const MOOD_COLORS = ['text-slate-400', 'text-slate-400', 'text-emerald-500', 'text-emerald-500', 'text-amber-500']

/** 难度五点强度条 */
function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`难度 ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= level ? 'bg-slate-800' : 'bg-slate-200'}`}
        />
      ))}
    </span>
  )
}

function MoodFace({ level, size = 13 }: { level: number; size?: number }) {
  const Icon = MOOD_ICONS[level - 1] ?? Smiley
  return <Icon size={size} weight="fill" className={MOOD_COLORS[level - 1]} />
}

interface JournalPageProps {
  go: (link: string) => void
}

/** 时长分钟 → x小时y分 */
function formatDuration(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default function JournalPage({ go }: JournalPageProps) {
  const [list, setList] = useState<JournalItem[] | null>(null)
  const [summary, setSummary] = useState<JournalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<JournalDetail | null>(null)
  const [detail, setDetail] = useState<JournalDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([journalApi.list(100), journalApi.summary()])
      .then(([items, sum]) => {
        setList(items)
        setSummary(sum)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 列表按月分组（倒序，最近在上）
  const monthGroups = useMemo(() => {
    const items = list ?? []
    const map = new Map<string, JournalItem[]>()
    for (const r of items) {
      const key = r.hikeDate.slice(0, 7)
      const arr = map.get(key)
      if (arr) arr.push(r)
      else map.set(key, [r])
    }
    return [...map.entries()].map(([month, items2]) => ({ month, items: items2 }))
  }, [list])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = async (item: JournalItem) => {
    setDetailLoading(true)
    try {
      const d = await journalApi.get(item.id)
      setEditing(d)
      setDetail(null)
      setFormOpen(true)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const openDetail = async (item: JournalItem) => {
    setDetailLoading(true)
    try {
      setDetail(await journalApi.get(item.id))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    try {
      await journalApi.remove(id)
      setConfirmDeleteId(null)
      setDetail(null)
      load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除失败')
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* 环境氛围光晕 */}
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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">徒步日记</h1>
              <p className="text-[11px] text-slate-400 mt-1">山野之间 · 皆有回响</p>
            </div>
          </div>
          <Magnetic>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
            >
              <Plus size={15} weight="bold" />
              新建日记
            </button>
          </Magnetic>
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
            <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-44 bg-slate-100 skeleton-shimmer rounded-4xl" />
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
            {/* 汇总统计 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
                <div className="px-2 md:px-6">
                  <div className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-400 mb-1.5">
                    <BookOpen size={13} weight="bold" className="text-emerald-600" />
                    累计徒步
                  </div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={summary?.totalCount ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">次</span>
                  </div>
                </div>
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">总里程</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUpDecimal value={summary?.totalDistanceKm ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">km</span>
                  </div>
                </div>
                <div className="px-2 md:px-6 mt-4 md:mt-0">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">总爬升</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={summary?.totalElevationGain ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">m</span>
                  </div>
                </div>
                <div className="px-2 md:px-6 mt-4 md:mt-0">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">今年</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={summary?.thisYearCount ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">
                      次 · {(summary?.thisYearDistanceKm ?? 0).toFixed(0)}km
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 空状态 */}
            {monthGroups.length === 0 && (
              <div className="py-24 text-center">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="inline-flex"
                >
                  <BookOpen size={40} weight="light" className="text-slate-300" />
                </motion.div>
                <p className="mt-4 text-slate-400 text-sm">还没有日记，从下一次出发开始记录</p>
                <button
                  onClick={openCreate}
                  className="mt-4 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
                >
                  写第一篇
                </button>
              </div>
            )}

            {/* 按月分组的日记列表 */}
            {monthGroups.map(({ month, items }) => (
              <section key={month}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-sm font-semibold text-slate-500">{month.replace('-', '.')}</h2>
                  <span className="text-[11px] text-slate-300">{items.length} 篇</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <MotionList className="grid gap-5 grid-cols-1 md:grid-cols-2">
                  {items.map((item) => (
                    <MotionItem key={item.id}>
                      <motion.button
                        onClick={() => openDetail(item)}
                        whileHover={{ y: -2 }}
                        className="w-full text-left rounded-4xl border border-slate-200/50 bg-white p-6 hover:border-emerald-200 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)] transition-all active:scale-[0.995]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <span className="font-mono">{dateDot(item.hikeDate)}</span>
                              <span>·</span>
                              <DifficultyDots level={item.difficulty} />
                              <span>{DIFFICULTY_LABELS[item.difficulty - 1]}</span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                <MoodFace level={item.mood} />
                                {MOOD_LABELS[item.mood - 1]}
                              </span>
                            </div>
                            <h3 className="mt-1 font-bold text-slate-900 leading-snug">{item.title}</h3>
                          </div>
                          <div
                            className="shrink-0 flex gap-1"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1.5 rounded-full text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              aria-label="编辑"
                            >
                              <PencilSimple size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className={`p-1.5 rounded-full transition-colors ${
                                confirmDeleteId === item.id
                                  ? 'text-white bg-red-500'
                                  : 'text-slate-300 hover:text-red-600 hover:bg-red-50'
                              }`}
                              aria-label={confirmDeleteId === item.id ? '再点确认删除' : '删除'}
                              title={confirmDeleteId === item.id ? '再点一次确认删除' : '删除'}
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl bg-slate-50/70 py-3">
                          <div className="text-center px-2">
                            <div className="font-mono text-sm font-semibold text-slate-900">
                              {item.distanceKm != null ? item.distanceKm.toFixed(1) : '—'}
                              <span className="text-[10px] text-slate-400 ml-0.5">km</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">里程</div>
                          </div>
                          <div className="text-center px-2">
                            <div className="font-mono text-sm font-semibold text-slate-900">
                              {formatDuration(item.durationMin)}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">时长</div>
                          </div>
                          <div className="text-center px-2">
                            <div className="font-mono text-sm font-semibold text-slate-900">
                              {item.elevationGain != null ? item.elevationGain.toFixed(0) : '—'}
                              <span className="text-[10px] text-slate-400 ml-0.5">m</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">爬升</div>
                          </div>
                        </div>
                        {(item.weather || item.companions || item.cost != null || item.routeName) && (
                          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                            {item.routeName && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                                <MapTrifold size={11} weight="bold" />
                                {item.routeName}
                              </span>
                            )}
                            {item.weather && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50">
                                <CloudSun size={11} weight="bold" />
                                {item.weather}
                              </span>
                            )}
                            {item.companions && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50">
                                <User size={11} weight="bold" />
                                {item.companions}
                              </span>
                            )}
                            {item.cost != null && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50">
                                <Coins size={11} weight="bold" />
                                {item.cost.toFixed(0)} 元
                              </span>
                            )}
                          </div>
                        )}
                        {item.contentPreview && (
                          <p className="mt-3 text-sm text-slate-500 leading-relaxed line-clamp-2">
                            {item.contentPreview}
                          </p>
                        )}
                      </motion.button>
                    </MotionItem>
                  ))}
                </MotionList>
              </section>
            ))}
          </div>
        )}

        {actionError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-4 py-2.5 bg-white border border-red-100 shadow-xl rounded-full text-sm text-red-500">
            <WarningCircle size={15} weight="fill" />
            {actionError}
          </div>
        )}
        {detailLoading && (
          <div className="fixed bottom-6 right-6 z-50 text-xs text-slate-400 bg-white/90 border border-slate-100 rounded-full px-3 py-1.5 shadow-sm">
            加载中…
          </div>
        )}
      </main>

      {/* 新建/编辑弹窗 */}
      <JournalFormModal
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSaved={load}
      />

      {/* 详情弹窗 */}
      <AnimatePresence>
        {detail && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetail(null)}
          >
            <motion.div
              className="w-full max-w-2xl bg-white rounded-4xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
              exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {detail.hikeDate} · {DIFFICULTY_LABELS[detail.difficulty - 1]} · {MOOD_LABELS[detail.mood - 1]}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1 leading-snug">{detail.title}</h3>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="p-1.5 rounded-full text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-7 py-5">
                <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl bg-slate-50/70 py-3 mb-5">
                  <div className="text-center px-2">
                    <div className="font-mono text-base font-semibold text-slate-900">
                      {detail.distanceKm != null ? detail.distanceKm.toFixed(2) : '—'}
                      <span className="text-[10px] text-slate-400 ml-0.5">km</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">里程</div>
                  </div>
                  <div className="text-center px-2">
                    <div className="font-mono text-base font-semibold text-slate-900">
                      {formatDuration(detail.durationMin)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">时长</div>
                  </div>
                  <div className="text-center px-2">
                    <div className="font-mono text-base font-semibold text-slate-900">
                      {detail.elevationGain != null ? detail.elevationGain.toFixed(0) : '—'}
                      <span className="text-[10px] text-slate-400 ml-0.5">m</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">爬升</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400 mb-5">
                  {detail.routeName && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      <MapTrifold size={11} weight="bold" />
                      {detail.routeName}
                    </span>
                  )}
                  {detail.weather && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50">
                      <CloudSun size={11} weight="bold" />
                      {detail.weather}
                    </span>
                  )}
                  {detail.companions && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50">
                      <User size={11} weight="bold" />
                      {detail.companions}
                    </span>
                  )}
                  {detail.cost != null && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50">
                      <Coins size={11} weight="bold" />
                      {detail.cost.toFixed(2)} 元
                    </span>
                  )}
                </div>
                {detail.content ? (
                  <div className="text-[15px] text-slate-700 leading-loose whitespace-pre-wrap">
                    {detail.content}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">（没有正文）</p>
                )}
              </div>
              <div className="px-7 py-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => handleDelete(detail.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-full transition-all active:scale-[0.98] ${
                    confirmDeleteId === detail.id
                      ? 'bg-red-500 text-white'
                      : 'text-red-500 hover:bg-red-50'
                  }`}
                >
                  <Trash size={14} />
                  {confirmDeleteId === detail.id ? '再点一次确认' : '删除'}
                </button>
                <button
                  onClick={() => openEdit(detail)}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  <PencilSimple size={14} />
                  编辑
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
