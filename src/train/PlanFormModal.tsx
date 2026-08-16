import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import type { ItemMode, PlanCreateDTO, PlanItemCreateDTO } from './types'

interface PlanFormModalProps {
  open: boolean
  onClose: () => void
  /** 返回新计划 id */
  onSubmit: (dto: PlanCreateDTO) => Promise<void>
}

function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function emptyItem(): PlanItemCreateDTO {
  return { name: '', mode: 'times', totalTimes: null, totalSets: null, unit: '' }
}

/** 输入框统一风格：label 在上、错误在下 */
const inputCls =
  'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all'

export default function PlanFormModal({ open, onClose, onSubmit }: PlanFormModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(todayStr())
  const [items, setItems] = useState<PlanItemCreateDTO[]>([emptyItem()])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateItem = (index: number, patch: Partial<PlanItemCreateDTO>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const validate = (): string => {
    if (!title.trim()) return '请填写计划标题'
    if (!startDate || !endDate) return '请选择计划起止日期'
    if (startDate > endDate) return '开始日期不能晚于结束日期'
    if (items.length === 0) return '至少添加一个训练项'
    for (const [i, it] of items.entries()) {
      if (!it.name.trim()) return `第 ${i + 1} 个训练项缺少名称`
      if (it.totalTimes == null || it.totalTimes <= 0) return `第 ${i + 1} 个训练项缺少有效目标次数`
      if (it.mode === 'sets' && (it.totalSets == null || it.totalSets <= 0))
        return `第 ${i + 1} 个训练项（组数模式）缺少有效目标组数`
    }
    return ''
  }

  const handleSubmit = async () => {
    const msg = validate()
    if (msg) {
      setError(msg)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const dto: PlanCreateDTO = {
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        items: items.map((it) => ({
          name: it.name.trim(),
          mode: it.mode,
          totalTimes: it.totalTimes,
          totalSets: it.mode === 'sets' ? it.totalSets : null,
          unit: it.unit.trim() || '个',
        })),
      }
      await onSubmit(dto)
      setTitle('')
      setDescription('')
      setStartDate(todayStr())
      setEndDate(todayStr())
      setItems([emptyItem()])
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg bg-white rounded-4xl shadow-2xl max-h-[90vh] flex flex-col"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
            exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部：左对齐 */}
            <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">制定训练计划</h2>
                <p className="text-xs text-slate-400 mt-0.5">周期内每天打卡，用坚持说话</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors active:scale-95"
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>

            {/* 表单主体 */}
            <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <label className="col-span-2 block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 block">标题 *</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="如：居家健身挑战"
                    className={inputCls}
                  />
                </label>
                <label className="col-span-2 block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 block">描述</span>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="可选，如：坚持每天锻炼"
                    className={inputCls}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 block">开始日期 *</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 block">结束日期 *</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>

              {/* 训练项：无卡片，分割线分组 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-600">训练项 *</span>
                  <button
                    onClick={() => setItems((prev) => [...prev, emptyItem()])}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 active:scale-95 transition-all"
                  >
                    <Plus size={13} weight="bold" />
                    添加训练项
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map((it, i) => (
                    <div key={i} className="py-4 space-y-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-mono text-slate-300 shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <input
                          value={it.name}
                          onChange={(e) => updateItem(i, { name: e.target.value })}
                          placeholder="名称，如：俯卧撑"
                          className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                        />
                        <select
                          value={it.mode}
                          onChange={(e) => updateItem(i, { mode: e.target.value as ItemMode })}
                          className="px-2 py-1.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none"
                        >
                          <option value="times">按次数</option>
                          <option value="sets">按组数</option>
                        </select>
                        <button
                          onClick={() => removeItem(i)}
                          disabled={items.length === 1}
                          className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300"
                          aria-label="删除训练项"
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-500 space-y-0">
                          目标
                          <input
                            type="number"
                            min={1}
                            value={it.totalTimes ?? ''}
                            onChange={(e) =>
                              updateItem(i, { totalTimes: e.target.value ? Number(e.target.value) : null })
                            }
                            placeholder="次数"
                            className="w-20 px-2 py-1.5 text-sm font-mono rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                          />
                        </label>
                        {it.mode === 'sets' && (
                          <label className="flex items-center gap-1.5 text-xs text-slate-500">
                            × 组
                            <input
                              type="number"
                              min={1}
                              value={it.totalSets ?? ''}
                              onChange={(e) =>
                                updateItem(i, { totalSets: e.target.value ? Number(e.target.value) : null })
                              }
                              placeholder="组数"
                              className="w-16 px-2 py-1.5 text-sm font-mono rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                            />
                          </label>
                        )}
                        <label className="flex items-center gap-1.5 text-xs text-slate-500">
                          单位
                          <input
                            value={it.unit}
                            onChange={(e) => updateItem(i, { unit: e.target.value })}
                            placeholder="个"
                            className="w-16 px-2 py-1.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 内联错误提示 */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
                  >
                    <WarningCircle size={15} weight="fill" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* 底部：右对齐操作 */}
            <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-xl transition-colors active:scale-[0.98]"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white text-sm rounded-xl font-medium hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 transition-all"
              >
                {submitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                创建计划
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
