import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle,
  Circle,
  Plus,
  Trash,
  Copy,
  WarningCircle,
  X,
  Sparkle,
  MagnifyingGlass,
  HandGrabbing,
} from '@phosphor-icons/react'
import { gearChecklistApi, gearSuggestApi } from './api'
import { CATEGORY_LABELS } from './GearItemFormModal'
import type { GearChecklist, GearItem, GearSuggest, GearSuggestItem } from './types'

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'

const STATUS_META: Record<number, { label: string; cls: string }> = {
  0: { label: '准备中', cls: 'bg-amber-50 text-amber-700' },
  1: { label: '已打包', cls: 'bg-emerald-50 text-emerald-700' },
  2: { label: '已结束', cls: 'bg-slate-100 text-slate-500' },
}

/** 品类 → 背包装载位置（借鉴主流重装徒步装包原则；顺序即装载顺序） */
const PACKING_SLOTS: { label: string; tip: string; categories: number[] }[] = [
  { label: '随身（不进包）', tip: '鞋在脚上、地图在手', categories: [4, 8] },
  { label: '顶袋（随手可取）', tip: '急救和头灯必须伸手可及，夜幕/受伤即刻能用', categories: [7, 9] },
  { label: '背部中段（最重贴背）', tip: '最重的装备贴近背部中上部，行走重心最稳', categories: [1, 10] },
  { label: '包内上部（路上偶取）', tip: '加层衣物随天气取用', categories: [5, 11] },
  { label: '包底（到营才取）', tip: '睡袋帐篷最占空间且到营才用，压包底', categories: [2, 3, 6] },
]

const PRIORITY_META: Record<number, { label: string; cls: string }> = {
  1: { label: '必带', cls: 'bg-red-50 text-red-600' },
  2: { label: '建议', cls: 'bg-amber-50 text-amber-700' },
  3: { label: '可选', cls: 'bg-slate-100 text-slate-500' },
}

interface ChecklistDetailModalProps {
  checklist: GearChecklist | null
  gearItems: GearItem[]
  onClose: () => void
  onChanged: () => void
}

/**
 * 打包清单详情弹窗（两栏）：
 * 左 = 清单（按装包位置分组渲染，勾选/删除）；右 = 装备库（拖拽装包 + 点击添加 + 手动临时条目）；
 * 顶部 AI 装备建议：行程参数 → LLM 个性化建议（未配置 key 自动降级内置规则）→ 一键入清单
 */
export default function ChecklistDetailModal({ checklist, gearItems, onClose, onChanged }: ChecklistDetailModalProps) {
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [newWeight, setNewWeight] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [gearSearch, setGearSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)

  // AI 装备建议
  const [aiOpen, setAiOpen] = useState(false)
  const [tripDays, setTripDays] = useState('1')
  const [tripDistance, setTripDistance] = useState('')
  const [tripMonth, setTripMonth] = useState(String(new Date().getMonth() + 1))
  const [tripExtra, setTripExtra] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<GearSuggest | null>(null)
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set())

  useEffect(() => {
    setError('')
    setNewName('')
    setNewWeight('')
    setConfirmDelete(false)
    setAiOpen(false)
    setAiResult(null)
    setAddedNames(new Set())
    setGearSearch('')
  }, [checklist?.id])

  if (!checklist) return null

  const inServiceGear = gearItems.filter((g) => g.status === 1)
  const matchedGear = inServiceGear.filter((g) =>
    gearSearch.trim() ? g.name.includes(gearSearch.trim()) : true,
  )
  const checkedCount = checklist.items.filter((i) => i.checked === 1).length
  const totalWeight = checklist.items.reduce((sum, i) => sum + (i.weightGrams ?? 0), 0)
  const existingNames = new Set(checklist.items.map((i) => i.name))

  /** 按装包位置分组渲染（未匹配的品类归入「包内上部」） */
  const slotGroups = PACKING_SLOTS.map((slot) => ({
    ...slot,
    items: checklist.items.filter((i) => {
      const cat = gearItems.find((g) => g.id === i.gearItemId)?.category
      // 临时条目/装备已删除：按名称匹配不到品类，归入包内上部
      return slot.categories.includes(cat ?? 0)
    }),
  })).filter((s) => s.items.length > 0)
  const uncategorized = checklist.items.filter(
    (i) => !slotGroups.some((s) => s.items.includes(i)),
  )

  const toggleItem = async (id: number, checked: number) => {
    try {
      await gearChecklistApi.updateItem({ id, checked: checked === 1 ? 0 : 1 })
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const removeItem = async (id: number) => {
    try {
      await gearChecklistApi.deleteItem(id)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  /** 从装备库加条目（点击或拖拽落下），已存在的自动跳过 */
  const addGear = async (g: GearItem) => {
    if (existingNames.has(g.name)) {
      setError(`「${g.name}」已经在清单里了`)
      return
    }
    setAddingId(g.id)
    setError('')
    try {
      await gearChecklistApi.addItem({
        checklistId: checklist.id,
        gearItemId: g.id,
        name: g.name,
        weightGrams: g.weightGrams ?? undefined,
      })
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败')
    } finally {
      setAddingId(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const id = Number(e.dataTransfer.getData('text/gear-id'))
    const g = inServiceGear.find((i) => i.id === id)
    if (g) addGear(g)
  }

  /** 手动添加临时条目 */
  const handleAddManual = async () => {
    if (!newName.trim()) {
      setError('请填写条目名')
      return
    }
    try {
      await gearChecklistApi.addItem({
        checklistId: checklist.id,
        name: newName.trim(),
        weightGrams: newWeight.trim() ? Number(newWeight) : undefined,
      })
      setNewName('')
      setNewWeight('')
      setError('')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败')
    }
  }

  /** AI 装备建议：行程参数 → LLM（未配置 key 自动降级规则引擎） */
  const handleSuggest = async () => {
    setAiLoading(true)
    setError('')
    setAiResult(null)
    setAddedNames(new Set())
    try {
      const result = await gearSuggestApi.suggest({
        days: Number(tripDays) || undefined,
        distanceKm: tripDistance.trim() ? Number(tripDistance) : undefined,
        month: Number(tripMonth) || undefined,
        extra: tripExtra.trim() || undefined,
      })
      setAiResult(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取建议失败')
    } finally {
      setAiLoading(false)
    }
  }

  /** 把建议条目加入清单（全部或单条），已加入的跳过 */
  const addSuggested = async (items: GearSuggestItem[]) => {
    const toAdd = items.filter((s) => !existingNames.has(s.name) && !addedNames.has(s.name))
    if (toAdd.length === 0) {
      setError('建议的装备都已经在清单里了')
      return
    }
    setError('')
    try {
      for (const s of toAdd) {
        await gearChecklistApi.addItem({
          checklistId: checklist.id,
          name: s.name,
          weightGrams: s.weightGrams ?? undefined,
        })
      }
      setAddedNames((prev) => {
        const next = new Set(prev)
        toAdd.forEach((s) => next.add(s.name))
        return next
      })
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败')
      onChanged()
    }
  }

  const handleCopy = async () => {
    try {
      await gearChecklistApi.copy(checklist.id)
      onChanged()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '复制失败')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    try {
      await gearChecklistApi.remove(checklist.id)
      onChanged()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      setConfirmDelete(false)
    }
  }

  const setStatus = async (status: number) => {
    try {
      await gearChecklistApi.update({ id: checklist.id, status })
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  /** 渲染清单条目行（勾选/名称/克重/删除） */
  const renderItemRow = (item: GearChecklist['items'][number]) => (
    <div key={item.id} className="flex items-center gap-3 py-2">
      <button
        onClick={() => toggleItem(item.id, item.checked)}
        className={`shrink-0 transition-colors ${item.checked === 1 ? 'text-emerald-600' : 'text-slate-200 hover:text-slate-400'}`}
        aria-label={item.checked === 1 ? '取消打包' : '标记已打包'}
      >
        {item.checked === 1 ? <CheckCircle size={18} weight="fill" /> : <Circle size={18} weight="regular" />}
      </button>
      <span className={`flex-1 text-sm ${item.checked === 1 ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
        {item.name}
        {item.gearItemId == null && <span className="ml-1.5 text-[10px] text-slate-300">临时</span>}
      </span>
      {item.weightGrams != null && (
        <span className="font-mono text-xs text-slate-400">
          {item.weightGrams >= 1000 ? `${(item.weightGrams / 1000).toFixed(1)}kg` : `${item.weightGrams}g`}
        </span>
      )}
      <button
        onClick={() => removeItem(item.id)}
        className="p-1.5 rounded-full text-slate-200 hover:text-red-500 hover:bg-red-50 transition-colors"
        aria-label="删除条目"
      >
        <Trash size={12} />
      </button>
    </div>
  )

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl bg-white rounded-4xl shadow-2xl max-h-[94dvh] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
        exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-7 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">{checklist.title}</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {checklist.hikeDate ?? '未定日期'} · {checkedCount}/{checklist.items.length} 已打包 ·{' '}
                {(totalWeight / 1000).toFixed(1)} kg
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                animate={{ width: `${checklist.items.length ? (checkedCount / checklist.items.length) * 100 : 0}%` }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              />
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-2.5 py-1 text-[11px] rounded-full border transition-all active:scale-[0.98] ${
                    checklist.status === s
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI 装备建议面板 */}
        <div className="px-7 pt-4">
          <button
            onClick={() => setAiOpen(!aiOpen)}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-colors active:scale-[0.98]"
          >
            <Sparkle size={12} weight="fill" />
            AI 装备建议
          </button>
          {aiOpen && (
            <div className="mt-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">天数</span>
                <input
                  className="w-12 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-mono outline-none focus:border-emerald-400"
                  type="number"
                  min={1}
                  max={7}
                  value={tripDays}
                  onChange={(e) => setTripDays(e.target.value)}
                />
                <span className="text-xs text-slate-500">里程 km</span>
                <input
                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-mono outline-none focus:border-emerald-400"
                  type="number"
                  value={tripDistance}
                  onChange={(e) => setTripDistance(e.target.value)}
                  placeholder="可选"
                />
                <span className="text-xs text-slate-500">月份</span>
                <input
                  className="w-12 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-mono outline-none focus:border-emerald-400"
                  type="number"
                  min={1}
                  max={12}
                  value={tripMonth}
                  onChange={(e) => setTripMonth(e.target.value)}
                />
                <input
                  className="flex-1 min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400"
                  value={tripExtra}
                  onChange={(e) => setTripExtra(e.target.value)}
                  placeholder="特别说明（天气/同伴/宠物…）"
                  maxLength={200}
                />
                <button
                  onClick={handleSuggest}
                  disabled={aiLoading}
                  className="px-4 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {aiLoading ? '思考中…' : '获取建议'}
                </button>
              </div>

              {aiResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      来源：{aiResult.source === 'LLM' ? `AI · ${aiResult.model}` : '内置规则（未配置 LLM_API_KEY）'}
                      ，共 {aiResult.items.length} 条建议
                    </span>
                    <button
                      onClick={() => addSuggested(aiResult.items)}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
                    >
                      全部加入清单
                    </button>
                  </div>
                  <div className="grid gap-1.5 max-h-56 overflow-y-auto pr-1">
                    {aiResult.items.map((s, i) => {
                      const added = addedNames.has(s.name) || existingNames.has(s.name)
                      return (
                        <motion.div
                          key={s.name + i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-2 rounded-xl bg-white border border-slate-100 px-3 py-2"
                        >
                          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY_META[s.priority].cls}`}>
                            {PRIORITY_META[s.priority].label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-800">
                              {s.name}
                              {s.weightGrams != null && (
                                <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                                  {s.weightGrams >= 1000
                                    ? `${(s.weightGrams / 1000).toFixed(1)}kg`
                                    : `${s.weightGrams}g`}
                                </span>
                              )}
                              <span className="ml-1.5 text-[10px] text-slate-300">
                                {CATEGORY_LABELS[s.category - 1]}
                              </span>
                            </div>
                            {s.reason && <p className="text-[11px] text-slate-400 leading-snug">{s.reason}</p>}
                          </div>
                          <button
                            onClick={() => addSuggested([s])}
                            disabled={added}
                            className={`shrink-0 p-1.5 rounded-full transition-colors ${
                              added ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            aria-label={added ? '已加入' : '加入清单'}
                          >
                            {added ? <CheckCircle size={15} weight="fill" /> : <Plus size={15} weight="bold" />}
                          </button>
                        </motion.div>
                      )
                    })}
                  </div>
                  {aiResult.packingTips.length > 0 && (
                    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                      <p className="text-[11px] font-medium text-slate-500 mb-1">装包提示</p>
                      {aiResult.packingTips.map((tip, i) => (
                        <p key={i} className="text-[11px] text-slate-400 leading-relaxed">
                          · {tip}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 两栏主体 */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 gap-0">
          {/* 左：清单（拖拽落区 + 装包位置分组） */}
          <div
            className={`md:col-span-3 overflow-y-auto px-7 py-4 border-r border-slate-100 transition-colors ${
              dragOver ? 'bg-emerald-50/50' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <p className="text-[11px] text-slate-300 mb-3 flex items-center gap-1">
              <HandGrabbing size={12} />
              从右侧装备库拖进来，或点击添加
            </p>
            {checklist.items.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-300">
                清单还是空的 —— 试试 AI 建议、拖拽装备，或手动添加
              </p>
            )}
            {slotGroups.map((slot) => (
              <div key={slot.label} className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-slate-500">{slot.label}</span>
                </div>
                <p className="text-[10px] text-slate-300 mb-1.5">{slot.tip}</p>
                <div className="divide-y divide-slate-50">{slot.items.map(renderItemRow)}</div>
              </div>
            ))}
            {uncategorized.length > 0 && (
              <div className="divide-y divide-slate-50">{uncategorized.map(renderItemRow)}</div>
            )}
            {checklist.items.length > 0 && uncategorized.length === 0 && slotGroups.length === 0 && null}
          </div>

          {/* 右：装备库（拖拽源 + 点击添加） */}
          <div className="md:col-span-2 overflow-y-auto px-5 py-4 bg-slate-50/40">
            <div className="relative mb-3">
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs outline-none focus:border-emerald-400"
                value={gearSearch}
                onChange={(e) => setGearSearch(e.target.value)}
                placeholder="搜索我的装备"
              />
            </div>
            {matchedGear.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-300">装备库（在役）里没有匹配的装备</p>
            )}
            <div className="space-y-1.5">
              {matchedGear.map((g) => {
                const added = existingNames.has(g.name)
                return (
                  <div
                    key={g.id}
                    draggable={!added}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/gear-id', String(g.id))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addGear(g)}
                    className={`group flex items-center gap-2 rounded-xl border px-3 py-2 cursor-grab active:cursor-grabbing transition-all ${
                      added
                        ? 'border-slate-100 bg-white/60 opacity-50'
                        : 'border-slate-200/70 bg-white hover:border-emerald-300 hover:shadow-sm'
                    }`}
                    title={added ? '已在清单' : '点击或拖拽加入清单'}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-800 truncate">{g.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {CATEGORY_LABELS[g.category - 1]}
                        {g.weightGrams != null && ` · ${g.weightGrams}g`}
                      </div>
                    </div>
                    {added ? (
                      <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                    ) : (
                      <Plus
                        size={14}
                        weight="bold"
                        className={`shrink-0 text-slate-300 group-hover:text-emerald-600 transition-colors ${
                          addingId === g.id ? 'animate-pulse' : ''
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* 手动添加临时条目 */}
            <div className="mt-4 pt-3 border-t border-slate-200/60 space-y-2">
              <div className="text-center text-[10px] text-slate-300">或手动添加临时条目</div>
              <input
                className={`${inputCls} text-xs`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="条目名，如：路餐（坚果+能量胶）"
                maxLength={100}
              />
              <div className="flex gap-2">
                <input
                  className={`${inputCls} text-xs font-mono`}
                  type="number"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  placeholder="克重"
                />
                <button
                  onClick={handleAddManual}
                  className="shrink-0 px-4 bg-slate-900 text-white text-xs rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 bottom-20 flex items-center gap-1.5 text-xs text-red-500 bg-white border border-red-100 shadow-lg rounded-full px-4 py-2"
            >
              <WarningCircle size={14} weight="fill" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* 底部操作 */}
        <div className="px-7 py-4 border-t border-slate-100 flex justify-between items-center">
          <button
            onClick={handleDelete}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-full transition-all active:scale-[0.98] ${
              confirmDelete ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'
            }`}
          >
            <Trash size={14} />
            {confirmDelete ? '再点一次确认' : '删除清单'}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98]"
          >
            <Copy size={14} />
            复制为新清单
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
