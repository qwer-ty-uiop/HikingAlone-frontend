import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Circle, Plus, Trash, Copy, WarningCircle, X, Sparkle } from '@phosphor-icons/react'
import { gearChecklistApi } from './api'
import { CATEGORY_LABELS } from './GearItemFormModal'
import type { GearChecklist, GearItem } from './types'

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'

const STATUS_META: Record<number, { label: string; cls: string }> = {
  0: { label: '准备中', cls: 'bg-amber-50 text-amber-700' },
  1: { label: '已打包', cls: 'bg-emerald-50 text-emerald-700' },
  2: { label: '已结束', cls: 'bg-slate-100 text-slate-500' },
}

interface ChecklistDetailModalProps {
  checklist: GearChecklist | null
  gearItems: GearItem[]
  onClose: () => void
  onChanged: () => void
}

/** 打包清单详情弹窗：条目勾选、从装备库加条目、复制清单、状态流转 */
export default function ChecklistDetailModal({ checklist, gearItems, onClose, onChanged }: ChecklistDetailModalProps) {
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [newWeight, setNewWeight] = useState('')
  const [fromGearId, setFromGearId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 智能生成：按行程参数从装备库自动选入（借鉴马蜂窝/两步路的出行清单模板思路）
  const [smartOpen, setSmartOpen] = useState(false)
  const [smartMulti, setSmartMulti] = useState(false)
  const [smartDistance, setSmartDistance] = useState('10')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    setError('')
    setNewName('')
    setNewWeight('')
    setFromGearId('')
    setConfirmDelete(false)
    setSmartOpen(false)
  }, [checklist?.id])

  if (!checklist) return null

  const inServiceGear = gearItems.filter((g) => g.status === 1)
  const checkedCount = checklist.items.filter((i) => i.checked === 1).length
  const totalWeight = checklist.items.reduce((sum, i) => sum + (i.weightGrams ?? 0), 0)

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
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  /**
   * 智能生成规则（借鉴主流徒步产品的清单模板）：
   * 必选 = 背包/鞋袜/照明/导航/安全急救；8km+ 带炊具饮水；5km+ 带电子设备；
   * 15km+ 或过夜换洗衣物；过夜加帐篷天幕与睡袋防潮垫。已在清单里的条目自动去重
   */
  const handleSmartFill = async () => {
    if (!checklist) return
    const distance = Number(smartDistance)
    if (Number.isNaN(distance) || distance < 0) {
      setError('请填写有效里程')
      return
    }
    const always = new Set([1, 4, 7, 8, 9])
    const picked = inServiceGear.filter((g) => {
      if (always.has(g.category)) return true
      if (g.category === 6) return distance >= 8
      if (g.category === 10) return distance >= 5
      if (g.category === 5) return smartMulti || distance >= 15
      if (g.category === 2 || g.category === 3) return smartMulti
      return false
    })
    const existing = new Set(checklist.items.map((i) => i.name))
    const toAdd = picked.filter((g) => !existing.has(g.name))
    if (toAdd.length === 0) {
      setError('按这个行程，装备库里的建议装备都已经在清单里了')
      return
    }
    setGenerating(true)
    setError('')
    try {
      for (const g of toAdd) {
        await gearChecklistApi.addItem({
          checklistId: checklist.id,
          gearItemId: g.id,
          name: g.name,
          weightGrams: g.weightGrams ?? undefined,
        })
      }
      setSmartOpen(false)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleAdd = async () => {
    if (fromGearId) {
      const g = inServiceGear.find((i) => String(i.id) === fromGearId)
      if (!g) return
      try {
        await gearChecklistApi.addItem({
          checklistId: checklist.id,
          gearItemId: g.id,
          name: g.name,
          weightGrams: g.weightGrams ?? undefined,
        })
        setFromGearId('')
        setError('')
        onChanged()
      } catch (e) {
        setError(e instanceof Error ? e.message : '添加失败')
      }
      return
    }
    if (!newName.trim()) {
      setError('请填写条目名或先选择装备')
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

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg bg-white rounded-4xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
        exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
        onClick={(e) => e.stopPropagation()}
      >
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
          {/* 进度条 */}
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              animate={{ width: `${checklist.items.length ? (checkedCount / checklist.items.length) * 100 : 0}%` }}
              transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-4">
          {/* 状态流转 */}
          <div className="flex gap-1.5 mb-4">
            {[0, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all active:scale-[0.98] ${
                  checklist.status === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>

          {/* 智能生成面板 */}
          <div className="mb-4">
            <button
              onClick={() => setSmartOpen(!smartOpen)}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-colors active:scale-[0.98]"
            >
              <Sparkle size={12} weight="fill" />
              按行程智能生成
            </button>
            {smartOpen && (
              <div className="mt-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">行程类型</span>
                  <div className="flex gap-1 rounded-full bg-white p-0.5 border border-slate-200">
                    {[false, true].map((multi) => (
                      <button
                        key={String(multi)}
                        onClick={() => setSmartMulti(multi)}
                        className={`px-3 py-1 text-xs rounded-full transition-all ${
                          smartMulti === multi ? 'bg-emerald-600 text-white' : 'text-slate-500'
                        }`}
                      >
                        {multi ? '过夜重装' : '单日往返'}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-slate-500 ml-2">计划里程</span>
                  <input
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-mono outline-none focus:border-emerald-400"
                    type="number"
                    value={smartDistance}
                    onChange={(e) => setSmartDistance(e.target.value)}
                  />
                  <span className="text-xs text-slate-400">km</span>
                  <button
                    onClick={handleSmartFill}
                    disabled={generating}
                    className="ml-auto px-4 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    {generating ? '生成中…' : '一键生成'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  背包、鞋袜、照明、导航、急救始终带上；8km+ 加炊具饮水，5km+ 加电子设备，15km+ 或过夜加换洗衣物，过夜加帐篷睡袋。已生成的条目自动去重。
                </p>
              </div>
            )}
          </div>

          {checklist.items.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-300">清单还是空的，点上面的「智能生成」试试</p>
          )}
          <div className="divide-y divide-slate-50">
            {checklist.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2.5">
                <button
                  onClick={() => toggleItem(item.id, item.checked)}
                  className={`shrink-0 transition-colors ${item.checked === 1 ? 'text-emerald-600' : 'text-slate-200 hover:text-slate-400'}`}
                  aria-label={item.checked === 1 ? '取消打包' : '标记已打包'}
                >
                  {item.checked === 1 ? (
                    <CheckCircle size={20} weight="fill" />
                  ) : (
                    <Circle size={20} weight="regular" />
                  )}
                </button>
                <span
                  className={`flex-1 text-sm ${item.checked === 1 ? 'text-slate-300 line-through' : 'text-slate-700'}`}
                >
                  {item.name}
                  {item.gearItemId == null && (
                    <span className="ml-1.5 text-[10px] text-slate-300">临时</span>
                  )}
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
                  <Trash size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* 加条目 */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex gap-2">
              <select
                className={inputCls}
                value={fromGearId}
                onChange={(e) => setFromGearId(e.target.value)}
              >
                <option value="">从装备库选择…</option>
                {inServiceGear.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}（{CATEGORY_LABELS[g.category - 1]}
                    {g.weightGrams != null ? ` · ${g.weightGrams}g` : ''}）
                  </option>
                ))}
              </select>
            </div>
            <div className="text-center text-[10px] text-slate-300">或手动添加临时条目</div>
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="条目名，如：路餐（坚果+能量胶）"
                maxLength={100}
              />
              <input
                className={`${inputCls} w-24 font-mono`}
                type="number"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="克重"
              />
              <button
                onClick={handleAdd}
                className="shrink-0 px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all"
                aria-label="添加条目"
              >
                <Plus size={16} weight="bold" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-sm text-red-500 mt-3"
              >
                <WarningCircle size={15} weight="fill" />
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

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
