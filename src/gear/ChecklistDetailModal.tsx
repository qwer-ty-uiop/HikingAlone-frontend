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
  ListChecks,
} from '@phosphor-icons/react'
import { gearChecklistApi, gearItemApi, gearSuggestApi } from './api'
import { CATEGORY_LABELS } from './GearItemFormModal'
import GearIcon, { categoryTextClass } from '../components/GearIcon'
import GearSilhouette from '../components/GearSilhouette'
import type { GearCatalogItem, GearChecklist, GearItem, GearSuggest, GearSuggestItem } from './types'

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'

const STATUS_META: Record<number, { label: string; cls: string }> = {
  0: { label: '准备中', cls: 'bg-amber-50 text-amber-700' },
  1: { label: '已打包', cls: 'bg-emerald-50 text-emerald-700' },
  2: { label: '已结束', cls: 'bg-slate-100 text-slate-500' },
}

/** 品类 → 背包装载位置（顺序即装载顺序；与 docs/interfaces/gear.md 装包口径一致） */
const PACKING_SLOTS: { label: string; tip: string; categories: number[] }[] = [
  { label: '随身（不进包）', tip: '鞋在脚上、地图在手', categories: [4, 8] },
  { label: '顶袋（随手可取）', tip: '急救和头灯必须伸手可及', categories: [7, 9] },
  { label: '背部中段（最重贴背）', tip: '最重的装备贴近背部中上部，重心最稳', categories: [1, 10] },
  { label: '包内上部（路上偶取）', tip: '加层衣物随天气取用', categories: [5, 11] },
  { label: '包底（到营才取）', tip: '睡袋帐篷最占空间且到营才用，压包底', categories: [2, 3, 6] },
]

/** 品类 → 所属仓位下标（可视化装包显示归位用） */
function slotIndexOf(category: number): number {
  return PACKING_SLOTS.findIndex((s) => s.categories.includes(category))
}

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
 * 打包清单详情弹窗：
 * 列表视图（两栏：清单 + 装备库拖拽/联想）与 装包拼图视图（背包轮廓 + 仓位芯片，拖进背包 = 打包）切换；
 * AI 装备建议面板跨视图共用；临时条目输入带常用装备目录联想
 */
export default function ChecklistDetailModal({ checklist, gearItems, onClose, onChanged }: ChecklistDetailModalProps) {
  const [view, setView] = useState<'list' | 'pack'>('list')
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [newWeight, setNewWeight] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [gearSearch, setGearSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  // 装包拼图视图：正在拖拽的条目（推荐仓位高亮）
  const [dragItem, setDragItem] = useState<{ id: number; category: number } | null>(null)

  // AI 装备建议
  const [aiOpen, setAiOpen] = useState(false)
  const [tripDays, setTripDays] = useState('1')
  const [tripDistance, setTripDistance] = useState('')
  const [tripMonth, setTripMonth] = useState(String(new Date().getMonth() + 1))
  const [tripExtra, setTripExtra] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<GearSuggest | null>(null)
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set())

  // 常用装备目录联想（临时条目输入）
  const [catalog, setCatalog] = useState<GearCatalogItem[]>([])
  const [showCatalog, setShowCatalog] = useState(false)

  useEffect(() => {
    setError('')
    setNewName('')
    setNewWeight('')
    setConfirmDelete(false)
    setAiOpen(false)
    setAiResult(null)
    setAddedNames(new Set())
    setGearSearch('')
    setView('list')
    gearItemApi
      .catalog()
      .then(setCatalog)
      .catch(() => setCatalog([]))
  }, [checklist?.id])

  if (!checklist) return null

  const inServiceGear = gearItems.filter((g) => g.status === 1)
  const matchedGear = inServiceGear.filter((g) =>
    gearSearch.trim() ? g.name.includes(gearSearch.trim()) : true,
  )
  const checkedCount = checklist.items.filter((i) => i.checked === 1).length
  const totalWeight = checklist.items.reduce((sum, i) => sum + (i.weightGrams ?? 0), 0)
  const existingNames = new Set(checklist.items.map((i) => i.name))

  const categoryOf = (item: GearChecklist['items'][number]): number =>
    gearItems.find((g) => g.id === item.gearItemId)?.category ?? 11

  /** 条目当前仓位：用户拖拽放置的 slot 优先，未放置时按品类推荐归位 */
  const itemSlot = (item: GearChecklist['items'][number]): number =>
    item.slot ?? slotIndexOf(categoryOf(item))

  /** 装包视图数据：已打包按「条目自己的仓位」归位；未打包进待装栏 */
  const packedBySlot = PACKING_SLOTS.map((slot, idx) => ({
    ...slot,
    items: checklist.items.filter((i) => i.checked === 1 && itemSlot(i) === idx),
  }))
  const unpacked = checklist.items.filter((i) => i.checked !== 1)

  /** 重量账本：空包重 = 清单中的背包条目合计；装载重 = 其余已打包条目；总重 = 两者之和 */
  const packWeights = (() => {
    const packed = checklist.items.filter((i) => i.checked === 1)
    const baseWeight = packed
      .filter((i) => (gearItems.find((g) => g.id === i.gearItemId)?.category ?? 11) === 1)
      .reduce((s, i) => s + (i.weightGrams ?? 0), 0)
    const totalWeight = packed.reduce((s, i) => s + (i.weightGrams ?? 0), 0)
    const loadWeight = totalWeight - baseWeight
    const tier =
      totalWeight === 0
        ? { advice: '从左侧拖一件装备进背包，开始称重。', toneClass: 'text-slate-400' }
        : totalWeight <= 8000
          ? { advice: '轻量级 ✓：这个基重走长线都舒服。', toneClass: 'text-emerald-600' }
          : totalWeight <= 15000
            ? { advice: '标准范围：注意重物贴背、大件压底。', toneClass: 'text-slate-500' }
            : totalWeight <= 20000
              ? { advice: '偏重：逐件检查「真的要带吗」，超过 15kg 膝盖会很累。', toneClass: 'text-amber-600' }
              : { advice: '重装警告：超过 20kg 的包是对膝盖的酷刑，强烈建议减重。', toneClass: 'text-red-500' }
    return { baseWeight, loadWeight, totalWeight, ...tier }
  })()

  /** 按装包位置分组的列表视图分组 */
  const slotGroups = PACKING_SLOTS.map((slot) => ({
    ...slot,
    items: checklist.items.filter((i) =>
      slot.categories.includes(gearItems.find((g) => g.id === i.gearItemId)?.category ?? 11),
    ),
  })).filter((s) => s.items.length > 0)
  const uncategorized = checklist.items.filter(
    (i) => !slotGroups.some((s) => s.items.includes(i)),
  )

  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase()

  /** 临时条目的目录联想：归一化匹配 名称/品牌/别名 */
  const catalogSuggestions =
    newName.trim().length >= 1
      ? catalog
          .filter(
            (c) =>
              norm(c.name) !== norm(newName) &&
              (norm(c.name).includes(norm(newName)) ||
                (c.brand ?? "").toLowerCase().includes(norm(newName)) ||
                (c.searchTerms ?? "").includes(newName.trim().toLowerCase())),
          )
          .slice(0, 5)
      : []

  const pickCatalog = (c: GearCatalogItem) => {
    setNewName(c.name)
    if (c.weightGrams != null) setNewWeight(String(c.weightGrams))
    setShowCatalog(false)
  }

  // 输入完整命中目录名时直接带出克重（打完整名也免填）
  useEffect(() => {
    if (!checklist) return
    const hit = catalog.find(
      (c) => norm(c.name) === norm(newName.trim()) && newName.trim().length >= 2,
    )
    if (hit?.weightGrams != null && !newWeight.trim()) setNewWeight(String(hit.weightGrams))
  }, [newName, catalog, checklist])

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

  const renderItemRow = (item: GearChecklist['items'][number]) => {
    const category = gearItems.find((g) => g.id === item.gearItemId)?.category ?? null
    return (
      <div key={item.id} className="flex items-center gap-3 py-2">
        <button
          onClick={() => toggleItem(item.id, item.checked)}
          className={`shrink-0 transition-colors ${item.checked === 1 ? 'text-emerald-600' : 'text-slate-200 hover:text-slate-400'}`}
          aria-label={item.checked === 1 ? '取消打包' : '标记已打包'}
        >
          {item.checked === 1 ? <CheckCircle size={18} weight="fill" /> : <Circle size={18} weight="regular" />}
        </button>
        <GearIcon category={category} size={15} />
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
  }

  /** 装包芯片（可拖拽）：拖出背包 = 未打包 */
  const renderPackChip = (item: GearChecklist['items'][number], compact = true) => {
    const category = gearItems.find((g) => g.id === item.gearItemId)?.category ?? null
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/item-id', String(item.id))
          e.dataTransfer.setData('text/item-checked', String(item.checked))
          setDragItem({ id: item.id, category: category ?? 11 })
        }}
        onDragEnd={() => setDragItem(null)}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 cursor-grab active:cursor-grabbing transition-all ${
          item.checked === 1
            ? 'border-emerald-200 bg-white shadow-sm hover:border-red-200'
            : 'border-slate-200 bg-white hover:border-emerald-300'
        }`}
        title={item.name}
      >
        <GearSilhouette
          category={category}
          size={compact ? 16 : 19}
          className={categoryTextClass(category)}
          title={item.name}
        />
        <span className="text-[11px] text-slate-700 max-w-[72px] truncate">{item.name}</span>
        {item.weightGrams != null && (
          <span className="font-mono text-[9px] text-slate-300">
            {item.weightGrams >= 1000 ? `${(item.weightGrams / 1000).toFixed(1)}k` : `${item.weightGrams}g`}
          </span>
        )}
      </div>
    )
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl bg-white rounded-4xl shadow-2xl max-h-[94dvh] flex flex-col overflow-hidden relative"
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
                            <div className="text-sm text-slate-800 flex items-center gap-1.5">
                              <GearIcon category={s.category} size={13} />
                              {s.name}
                              {s.weightGrams != null && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  {s.weightGrams >= 1000
                                    ? `${(s.weightGrams / 1000).toFixed(1)}kg`
                                    : `${s.weightGrams}g`}
                                </span>
                              )}
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

        {/* 视图切换 */}
        <div className="px-7 pt-3 pb-1 flex items-center justify-between">
          <div className="flex gap-1 rounded-full bg-slate-100 p-1">
            {(
              [
                { key: 'list', label: '列表', icon: <ListChecks size={12} /> },
                { key: 'pack', label: '装包拼图', icon: <HandGrabbing size={12} /> },
              ] as { key: 'list' | 'pack'; label: string; icon: React.ReactNode }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`relative px-3 py-1.5 text-xs rounded-full transition-colors flex items-center gap-1 ${
                  view === t.key ? 'text-slate-900 font-medium' : 'text-slate-400'
                }`}
              >
                {view === t.key && (
                  <motion.span
                    layoutId="checklist-view-pill"
                    className="absolute inset-0 bg-white rounded-full shadow-sm"
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  {t.icon}
                  {t.label}
                </span>
              </button>
            ))}
          </div>
          {view === 'pack' && (
            <span className="text-[11px] text-slate-300">
              拖进背包 = 打包装入 · 拖回待装 = 取出 · 虚线仓位是它的推荐位置
            </span>
          )}
        </div>

        {/* 主体 */}
        {view === 'list' ? (
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 gap-0">
            {/* 左：清单（装包位置分组） */}
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
            </div>

            {/* 右：装备库 */}
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
                      <GearIcon category={g.category} size={14} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-800 truncate">{g.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {g.weightGrams != null ? `${g.weightGrams}g` : CATEGORY_LABELS[g.category - 1]}
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

              {/* 手动添加（带目录联想） */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 space-y-2">
                <div className="text-center text-[10px] text-slate-300">或手动添加临时条目</div>
                <div className="relative">
                  <input
                    className={`${inputCls} text-xs`}
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value)
                      setShowCatalog(true)
                    }}
                    onFocus={() => setShowCatalog(true)}
                    onBlur={() => setTimeout(() => setShowCatalog(false), 150)}
                    placeholder="输入名称联想常用装备…"
                    maxLength={100}
                    autoComplete="off"
                  />
                  {showCatalog && catalogSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 bottom-full mb-1 z-10 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                      {catalogSuggestions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickCatalog(c)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-50 transition-colors text-left"
                        >
                          <GearIcon category={c.category} size={13} />
                          <span className="flex-1 text-xs text-slate-700 truncate">{c.name}</span>
                          {c.weightGrams != null && (
                            <span className="font-mono text-[10px] text-slate-400">{c.weightGrams}g</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
        ) : (
          /* 装包拼图视图：待装 → 背包（SVG 轮廓 + 仓位） + 随身 */
          <div className="flex-1 overflow-y-auto px-7 py-4">
            <div className="flex gap-4 items-stretch min-h-[430px]">
              {/* 待装栏（拖出 = 打包；从背包拖回 = 取出） */}
              <div
                className="w-36 shrink-0 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-3 overflow-y-auto transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = Number(e.dataTransfer.getData('text/item-id'))
                  const checked = Number(e.dataTransfer.getData('text/item-checked'))
                  if (id && checked === 1) toggleItem(id, 1)
                }}
              >
                <p className="text-[11px] font-semibold text-slate-500 mb-2">
                  待装 <span className="font-mono text-slate-300">{unpacked.length}</span>
                </p>
                {unpacked.length === 0 && (
                  <p className="text-[11px] text-slate-300 leading-relaxed py-2">都装进包里了，出发！</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {unpacked.map((item) => renderPackChip(item, false))}
                </div>
              </div>

              {/* 背包画布 */}
              <div className="flex-1 relative min-h-[430px] select-none">
                {/* 轮廓 */}
                <svg viewBox="0 0 200 260" className="absolute inset-0 w-full h-full" aria-hidden>
                  <path d="M60,18 C52,60 52,150 60,205" stroke="#cbd5e1" strokeWidth="4" fill="none" strokeLinecap="round" />
                  <path
                    d="M50,84 C42,116 42,182 48,224 C50,240 60,248 76,248 L124,248 C140,248 150,240 152,224 C158,182 158,116 150,84 C146,64 132,56 114,54 L86,54 C68,56 54,64 50,84 Z"
                    className="fill-slate-50 stroke-slate-300"
                    strokeWidth="4"
                  />
                  <path
                    d="M64,38 L136,38 C146,38 152,44 152,52 L152,62 C152,66 149,68 145,68 L55,68 C51,68 48,66 48,62 L48,52 C48,44 54,38 64,38 Z"
                    className="fill-white stroke-slate-300"
                    strokeWidth="4"
                  />
                  <rect x="158" y="128" width="18" height="58" rx="9" className="fill-slate-50 stroke-slate-300" strokeWidth="3.5" />
                </svg>

                {/* 仓位（绝对定位；drop = 打包；显示按品类归位） */}
                {[
                  { slot: PACKING_SLOTS[1], style: { left: '26%', top: '12%', width: '48%', height: '14%' } },
                  { slot: PACKING_SLOTS[3], style: { left: '24%', top: '28%', width: '52%', height: '18%' } },
                  { slot: PACKING_SLOTS[2], style: { left: '24%', top: '47%', width: '52%', height: '20%' } },
                  { slot: PACKING_SLOTS[4], style: { left: '26%', top: '68%', width: '48%', height: '24%' } },
                ].map(({ slot, style }) => {
                  const items = packedBySlot.find((s) => s.label === slot.label)?.items ?? []
                  const recommended = dragItem != null && slotIndexOf(dragItem.category) === PACKING_SLOTS.indexOf(slot)
                  return (
                    <div
                      key={slot.label}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const id = Number(e.dataTransfer.getData('text/item-id'))
                        if (id) {
                          const item = checklist.items.find((i) => i.id === id)
                          if (item) {
                            const targetSlot = PACKING_SLOTS.indexOf(slot)
                            const patch =
                              item.checked === 1
                                ? { id, slot: targetSlot }
                                : { id, checked: 1, slot: targetSlot }
                            gearChecklistApi.updateItem(patch).then(onChanged).catch(() => {})
                          }
                        }
                        setDragItem(null)
                      }}
                      className={`absolute rounded-2xl p-1.5 overflow-y-auto transition-all ${
                        recommended
                          ? 'border-2 border-dashed border-emerald-400 bg-emerald-50/70'
                          : 'border border-slate-100 bg-white/40'
                      }`}
                      style={style}
                      title={slot.tip}
                    >
                      <p className="text-[9px] text-slate-400 leading-tight px-0.5 flex items-center justify-between gap-1">
                        <span className="truncate">{slot.label}</span>
                        <span className="font-mono shrink-0">
                          {((packedBySlot.find((s) => s.label === slot.label)?.items ?? [])
                            .reduce((s, i) => s + (i.weightGrams ?? 0), 0) / 1000).toFixed(1)}
                          kg
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {items.map((item) => renderPackChip(item))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 随身仓（drop = 打包） + 重量账本 */}
              <div className="w-40 shrink-0 flex flex-col gap-3">
                <div
                  className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-3 overflow-y-auto transition-all"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = Number(e.dataTransfer.getData('text/item-id'))
                  if (id) {
                    const item = checklist.items.find((i) => i.id === id)
                    if (item) {
                      const patch =
                        item.checked === 1 ? { id, slot: 0 } : { id, checked: 1, slot: 0 }
                      gearChecklistApi.updateItem(patch).then(onChanged).catch(() => {})
                    }
                  }
                  setDragItem(null)
                }}
              >
                <p className="text-[11px] font-semibold text-slate-500">{PACKING_SLOTS[0].label}</p>
                <p className="text-[10px] text-slate-300 mb-2">{PACKING_SLOTS[0].tip}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(packedBySlot.find((s) => s.label === PACKING_SLOTS[0].label)?.items ?? []).map((item) =>
                    renderPackChip(item, false),
                  )}
                </div>
              </div>

              {/* 重量账本：空包重 / 装载重 / 总重 + 档位建议 */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5">
                <p className="text-[11px] font-semibold text-slate-600 mb-2">重量账本</p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">空包重</span>
                    <span className="font-mono text-slate-700">{(packWeights.baseWeight / 1000).toFixed(1)} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">装载重</span>
                    <span className="font-mono text-slate-700">{(packWeights.loadWeight / 1000).toFixed(1)} kg</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1">
                    <span className="text-slate-600 font-medium">打包总重</span>
                    <span className="font-mono text-slate-900 font-semibold">
                      {(packWeights.totalWeight / 1000).toFixed(1)} kg
                    </span>
                  </div>
                </div>
                <p className={`mt-2 text-[10px] leading-relaxed ${packWeights.toneClass}`}>{packWeights.advice}</p>
              </div>
            </div>
          </div>
        </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 bottom-20 z-20 flex items-center gap-1.5 text-xs text-red-500 bg-white border border-red-100 shadow-lg rounded-full px-4 py-2"
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
