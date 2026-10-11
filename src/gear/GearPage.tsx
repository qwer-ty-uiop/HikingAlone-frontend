import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Backpack,
  Plus,
  ClipboardText,
  CheckCircle,
  WarningCircle,
  LockSimpleOpen,
} from '@phosphor-icons/react'
import { gearChecklistApi, gearItemApi } from './api'
import GearItemFormModal, { CATEGORY_LABELS } from './GearItemFormModal'
import ChecklistDetailModal from './ChecklistDetailModal'
import { CountUp, Magnetic, MotionList, MotionItem, dateDot } from '../components/ui'
import type { GearChecklist, GearItem } from './types'

interface GearPageProps {
  go: (link: string) => void
}

type Tab = 'library' | 'checklist'

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'

export default function GearPage({ go }: GearPageProps) {
  const [tab, setTab] = useState<Tab>('library')
  const [items, setItems] = useState<GearItem[] | null>(null)
  const [checklists, setChecklists] = useState<GearChecklist[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<GearItem | null>(null)
  const [detailChecklist, setDetailChecklist] = useState<GearChecklist | null>(null)
  const [newListTitle, setNewListTitle] = useState('')
  const [newListDate, setNewListDate] = useState('')
  const [creatingList, setCreatingList] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([gearItemApi.list(), gearChecklistApi.list()])
      .then(([its, cls]) => {
        setItems(its)
        setChecklists(cls)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 装备按品类分组（在役在前，后端已排序）
  const itemsByCategory = useMemo(() => {
    const groups = new Map<number, GearItem[]>()
    for (const it of items ?? []) {
      const arr = groups.get(it.category)
      if (arr) arr.push(it)
      else groups.set(it.category, [it])
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0])
  }, [items])

  const inServiceItems = useMemo(() => (items ?? []).filter((i) => i.status === 1), [items])
  const totalWeightGrams = inServiceItems.reduce((s, i) => s + (i.weightGrams ?? 0), 0)

  const handleCreateList = async () => {
    if (!newListTitle.trim()) return
    setCreatingList(true)
    try {
      await gearChecklistApi.create({
        title: newListTitle.trim(),
        hikeDate: newListDate || undefined,
      })
      setNewListTitle('')
      setNewListDate('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreatingList(false)
    }
  }

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
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">装备</h1>
              <p className="text-[11px] text-slate-400 mt-1">轻量化从称重开始 · 打包从清单开始</p>
            </div>
          </div>
          {/* Tab 切换 */}
          <div className="flex gap-1 rounded-full bg-slate-100 p-1">
            {(
              [
                { key: 'library', label: '装备库' },
                { key: 'checklist', label: '打包清单' },
              ] as { key: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative px-4 py-1.5 text-xs rounded-full transition-colors ${
                  tab === t.key ? 'text-slate-900 font-medium' : 'text-slate-400'
                }`}
              >
                {tab === t.key && (
                  <motion.span
                    layoutId="gear-tab-pill"
                    className="absolute inset-0 bg-white rounded-full shadow-sm"
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-10">
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 bg-slate-100 skeleton-shimmer rounded-4xl" />
              ))}
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 bg-slate-100 skeleton-shimmer rounded-2xl" />
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
        ) : tab === 'library' ? (
          <div className="space-y-8">
            {/* 统计 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="grid grid-cols-3 divide-x divide-slate-100">
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">装备总数</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={items?.length ?? 0} />
                    <span className="text-sm font-sans text-slate-400 ml-1">件</span>
                  </div>
                </div>
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">在役</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    <CountUp value={inServiceItems.length} />
                    <span className="text-sm font-sans text-slate-400 ml-1">件</span>
                  </div>
                </div>
                <div className="px-2 md:px-6">
                  <div className="text-[11px] md:text-xs text-slate-400 mb-1.5">在役总自重</div>
                  <div className="text-2xl md:text-3xl font-mono font-semibold text-slate-900">
                    {(totalWeightGrams / 1000).toFixed(1)}
                    <span className="text-sm font-sans text-slate-400 ml-1">kg</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <Magnetic>
                  <button
                    onClick={() => {
                      setEditingItem(null)
                      setItemFormOpen(true)
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
                  >
                    <Plus size={15} weight="bold" />
                    新增装备
                  </button>
                </Magnetic>
              </div>
            </section>

            {/* 按品类分组 */}
            {itemsByCategory.length === 0 && (
              <div className="py-24 text-center">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="inline-flex"
                >
                  <Backpack size={40} weight="light" className="text-slate-300" />
                </motion.div>
                <p className="mt-4 text-slate-400 text-sm">装备库还是空的，先把主力包录进来</p>
              </div>
            )}
            {itemsByCategory.map(([category, list]) => (
              <section key={category}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-sm font-semibold text-slate-500">{CATEGORY_LABELS[category - 1]}</h2>
                  <span className="text-[11px] text-slate-300">{list.length} 件</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <MotionList className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  {list.map((item) => (
                    <MotionItem key={item.id}>
                      <button
                        onClick={() => {
                          setEditingItem(item)
                          setItemFormOpen(true)
                        }}
                        className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.99] ${
                          item.status === 1
                            ? 'border-slate-200/50 bg-white hover:border-emerald-200 hover:shadow-[0_12px_28px_-12px_rgba(16,185,129,0.2)]'
                            : 'border-slate-100 bg-slate-50/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900 leading-snug">{item.name}</span>
                          {item.status === 0 && (
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">
                              退役
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                          <span className="font-mono">
                            {item.weightGrams != null
                              ? item.weightGrams >= 1000
                                ? `${(item.weightGrams / 1000).toFixed(1)}kg`
                                : `${item.weightGrams}g`
                              : '—'}
                          </span>
                          {item.brand && <span>· {item.brand}</span>}
                        </div>
                        {item.note && <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">{item.note}</p>}
                      </button>
                    </MotionItem>
                  ))}
                </MotionList>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* 新建清单 */}
            <section className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
              <h2 className="font-bold text-slate-900 mb-4">新建打包清单</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  className={inputCls}
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="清单标题，如：海坨山两日重装"
                  maxLength={100}
                />
                <input
                  className={`${inputCls} sm:w-44 font-mono`}
                  type="date"
                  value={newListDate}
                  onChange={(e) => setNewListDate(e.target.value)}
                />
                <button
                  onClick={handleCreateList}
                  disabled={creatingList || !newListTitle.trim()}
                  className="shrink-0 px-6 py-2.5 bg-slate-900 text-white text-sm rounded-xl font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingList ? '创建中…' : '创建'}
                </button>
              </div>
            </section>

            {/* 清单列表 */}
            {(checklists ?? []).length === 0 && (
              <div className="py-24 text-center">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="inline-flex"
                >
                  <ClipboardText size={40} weight="light" className="text-slate-300" />
                </motion.div>
                <p className="mt-4 text-slate-400 text-sm">还没有清单，出发前把要带的东西一条条列出来</p>
              </div>
            )}
            <MotionList className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {(checklists ?? []).map((cl) => {
                const checked = cl.items.filter((i) => i.checked === 1).length
                const pct = cl.items.length ? (checked / cl.items.length) * 100 : 0
                return (
                  <MotionItem key={cl.id}>
                    <motion.button
                      onClick={() => setDetailChecklist(cl)}
                      whileHover={{ y: -2 }}
                      className="w-full text-left rounded-4xl border border-slate-200/50 bg-white p-6 hover:border-emerald-200 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.15)] transition-all active:scale-[0.995]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 leading-snug">{cl.title}</h3>
                        <span
                          className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${
                            cl.status === 0
                              ? 'bg-amber-50 text-amber-700'
                              : cl.status === 1
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {cl.status === 0 ? '准备中' : cl.status === 1 ? '已打包' : '已结束'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 font-mono">
                        {cl.hikeDate ? `出发 ${dateDot(cl.hikeDate)}` : '未定日期'} · {cl.items.length} 项
                      </p>
                      <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-emerald-500"
                          animate={{ width: `${pct}%` }}
                          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle size={12} weight="fill" className="text-emerald-500" />
                          {checked}/{cl.items.length} 已打包
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <LockSimpleOpen size={12} />
                          {(
                            cl.items.reduce((s, i) => s + (i.weightGrams ?? 0), 0) / 1000
                          ).toFixed(1)}{' '}
                          kg
                        </span>
                      </div>
                    </motion.button>
                  </MotionItem>
                )
              })}
            </MotionList>
          </div>
        )}

        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-4 py-2.5 bg-white border border-red-100 shadow-xl rounded-full text-sm text-red-500">
            <WarningCircle size={15} weight="fill" />
            {error}
          </div>
        )}
      </main>

      {/* 装备表单弹窗 */}
      <GearItemFormModal
        open={itemFormOpen}
        initial={editingItem}
        onClose={() => {
          setItemFormOpen(false)
          setEditingItem(null)
        }}
        onSaved={load}
      />

      {/* 清单详情弹窗 */}
      <AnimatePresence>
        {detailChecklist && (
          <ChecklistDetailModal
            checklist={checklists?.find((c) => c.id === detailChecklist.id) ?? detailChecklist}
            gearItems={items ?? []}
            onClose={() => setDetailChecklist(null)}
            onChanged={load}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
