import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import DateField from './DateField'
import type {
  CycleType,
  PlanCreateDTO,
  PlanItemCreateDTO,
  PlanItemUpdateDTO,
  PlanUpdateDTO,
  TrainingPlan,
} from './types'

interface PlanFormModalProps {
  open: boolean
  /** 非空 = 编辑模式（完整编辑含训练项）；空 = 新建模式 */
  initial?: TrainingPlan | null
  onClose: () => void
  onCreate: (dto: PlanCreateDTO) => Promise<void>
  onUpdate: (dto: PlanUpdateDTO) => Promise<void>
}

function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 内部可编辑训练项：id 非空=已有项（编辑），空=待新增 */
interface EditableItem extends PlanItemUpdateDTO {}

function emptyItem(): EditableItem {
  return { id: null, name: '', mode: 'times', totalTimes: null, totalSets: null, unit: '' }
}

/** 周期类型选项：label 胶囊 + 说明 + 锚点输入 placeholder */
const CYCLE_OPTIONS: { value: CycleType; label: string; hint: string; placeholder: string }[] = [
  { value: 0, label: '不重复', hint: '整个周期累计目标，全部达标即完成', placeholder: '' },
  { value: 1, label: '每天', hint: '每天重置目标，坚持当日达标', placeholder: '' },
  { value: 2, label: '每周', hint: '每周重置目标，新的一周重新累计', placeholder: '每周三重置（1周一~7周日，留空=每周一）' },
  { value: 3, label: '每月', hint: '每月重置目标，新的月份重新累计', placeholder: '每月15号重置（1~31，留空=每月1号）' },
  { value: 4, label: '每年', hint: '每年重置目标，新的一年重新累计', placeholder: '每年8月15日重置（月日，留空=每年1月1日）' },
]

/** 周期锚点文本校验：留空=默认锚点；非空按类型校验取值 */
function validateCycleAnchor(type: CycleType, text: string): string {
  if (type === 0 || type === 1) return ''
  const t = text.trim()
  if (!t) return ''
  const n = Number(t)
  if (!Number.isInteger(n)) return '周期锚点需为整数'
  if (type === 2) return n >= 1 && n <= 7 ? '' : '每周锚点为 1~7（1周一~7周日）'
  if (type === 3) return n >= 1 && n <= 31 ? '' : '每月锚点为 1~31'
  const month = Math.floor(n / 100)
  const day = n % 100
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? '' : '每年锚点格式为月日（如 815 = 8月15日）'
}

/** 周期锚点组装：不重复/每天恒为 null；其余留空转 null（默认锚点），否则转数字 */
function buildCycleAnchor(type: CycleType, text: string): number | null {
  if (type === 0 || type === 1) return null
  const t = text.trim()
  return t ? Number(t) : null
}

/** 输入框统一风格：label 在上、错误在下 */
const inputCls =
  'w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all'

export default function PlanFormModal({
  open,
  initial = null,
  onClose,
  onCreate,
  onUpdate,
}: PlanFormModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(todayStr())
  // 周期：0不重复 1每天 2每周 3每月 4每年；锚点为输入文本（提交时按类型转换/校验）
  const [cycleType, setCycleType] = useState<CycleType>(0)
  const [cycleAnchor, setCycleAnchor] = useState('')
  const [items, setItems] = useState<EditableItem[]>([emptyItem()])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isEdit = initial != null

  // 打开时按模式回填（新建清空，编辑带入既有数据）
  useEffect(() => {
    if (!open) return
    if (initial) {
      setTitle(initial.title)
      setDescription(initial.description)
      setStartDate(initial.startDate)
      setEndDate(initial.endDate)
      setCycleType(initial.cycleType)
      setCycleAnchor(initial.cycleAnchor == null ? '' : String(initial.cycleAnchor))
      setItems(
        initial.items.map((it) => ({
          id: it.id,
          name: it.name,
          mode: it.mode,
          totalTimes: it.totalTimes,
          totalSets: it.totalSets,
          unit: it.unit,
        })),
      )
    } else {
      setTitle('')
      setDescription('')
      setStartDate(todayStr())
      setEndDate(todayStr())
      setCycleType(0)
      setCycleAnchor('')
      setItems([emptyItem()])
    }
    setError('')
  }, [open, initial])

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const validate = (): string => {
    if (!title.trim()) return '请填写计划标题'
    if (!startDate || !endDate) return '请选择计划起止日期'
    if (startDate > endDate) return '开始日期不能晚于结束日期'
    const cycleMsg = validateCycleAnchor(cycleType, cycleAnchor)
    if (cycleMsg) return cycleMsg
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
      if (isEdit && initial) {
        const dto: PlanUpdateDTO = {
          id: initial.id,
          title: title.trim(),
          description: description.trim(),
          startDate,
          endDate,
          cycleType,
          cycleAnchor: buildCycleAnchor(cycleType, cycleAnchor),
          items: items.map((it) => ({
            id: it.id,
            name: it.name.trim(),
            mode: it.mode,
            totalTimes: it.totalTimes,
            totalSets: it.mode === 'sets' ? it.totalSets : null,
            unit: it.unit.trim() || '个',
          })),
        }
        await onUpdate(dto)
      } else {
        const dto: PlanCreateDTO = {
          title: title.trim(),
          description: description.trim(),
          startDate,
          endDate,
          cycleType,
          cycleAnchor: buildCycleAnchor(cycleType, cycleAnchor),
          items: items.map((it): PlanItemCreateDTO => ({
            name: it.name.trim(),
            mode: it.mode,
            totalTimes: it.totalTimes,
            totalSets: it.mode === 'sets' ? it.totalSets : null,
            unit: it.unit.trim() || '个',
          })),
        }
        await onCreate(dto)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
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
            {/* 头部 */}
            <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  {isEdit ? '编辑训练计划' : '制定训练计划'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isEdit ? '调整目标与周期，训练项可增删改' : '周期内每天打卡，用坚持说话'}
                </p>
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
                  <DateField value={startDate} onChange={setStartDate} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-slate-600 block">结束日期 *</span>
                  <DateField value={endDate} onChange={setEndDate} />
                </label>
              </div>

              {/* 周期：类型胶囊 + 锚点输入，锚点随类型切换 */}
              <div className="rounded-2xl border border-slate-200/60 bg-slate-50/40 p-4 space-y-3">
                <div>
                  <span className="text-xs font-medium text-slate-600">周期</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {CYCLE_OPTIONS.find((o) => o.value === cycleType)?.hint}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {CYCLE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setCycleType(o.value)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-all active:scale-95 ${
                        cycleType === o.value
                          ? 'bg-slate-900 text-white font-medium shadow-sm'
                          : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {cycleType >= 2 && (
                  <label className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">锚点</span>
                    <input
                      value={cycleAnchor}
                      onChange={(e) => setCycleAnchor(e.target.value)}
                      placeholder={CYCLE_OPTIONS.find((o) => o.value === cycleType)?.placeholder}
                      className="w-full px-3 py-1.5 text-sm font-mono rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:font-sans"
                    />
                  </label>
                )}
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
                        <button
                          onClick={() => removeItem(i)}
                          disabled={items.length === 1}
                          className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300"
                          aria-label="删除训练项"
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {/* 制定模式：分段切换，比下拉更直观 */}
                        <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100">
                          <button
                            onClick={() => updateItem(i, { mode: 'times' })}
                            className={`px-2.5 py-1 text-xs rounded-full transition-all active:scale-95 ${
                              it.mode === 'times'
                                ? 'bg-white text-slate-900 font-medium shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            按次数
                          </button>
                          <button
                            onClick={() => updateItem(i, { mode: 'sets' })}
                            className={`px-2.5 py-1 text-xs rounded-full transition-all active:scale-95 ${
                              it.mode === 'sets'
                                ? 'bg-white text-slate-900 font-medium shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            按组数
                          </button>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-500">
                          目标
                          <input
                            type="number"
                            min={1}
                            value={it.totalTimes ?? ''}
                            onChange={(e) =>
                              updateItem(i, { totalTimes: e.target.value ? Number(e.target.value) : null })
                            }
                            placeholder={it.mode === 'sets' ? '每组' : '次数'}
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

            {/* 底部 */}
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
                {isEdit ? '保存修改' : '创建计划'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
