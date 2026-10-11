import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WarningCircle, Trash } from '@phosphor-icons/react'
import { gearItemApi } from './api'
import type { GearItem, GearItemSaveDTO } from './types'

/** 与后端 GearCategoryEnum 一致 */
export const CATEGORY_LABELS = [
  '背包',
  '帐篷天幕',
  '睡袋防潮垫',
  '鞋袜',
  '服装',
  '炊具饮水',
  '照明',
  '导航',
  '安全急救',
  '电子设备',
  '其他',
]

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5'

interface GearItemFormModalProps {
  open: boolean
  initial?: GearItem | null
  onClose: () => void
  onSaved: () => void
}

/** 新建/编辑装备弹窗（编辑模式支持退役/删除） */
export default function GearItemFormModal({ open, initial, onClose, onSaved }: GearItemFormModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(1)
  const [weight, setWeight] = useState('')
  const [brand, setBrand] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState(1)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setName(initial.name)
      setCategory(initial.category)
      setWeight(initial.weightGrams == null ? '' : String(initial.weightGrams))
      setBrand(initial.brand ?? '')
      setNote(initial.note ?? '')
      setStatus(initial.status)
    } else {
      setName('')
      setCategory(1)
      setWeight('')
      setBrand('')
      setNote('')
      setStatus(1)
    }
    setError('')
    setConfirmDelete(false)
  }, [open, initial])

  const validate = (): string => {
    if (!name.trim()) return '请填写装备名'
    if (name.trim().length > 100) return '装备名不能超过 100 字'
    if (weight.trim()) {
      const w = Number(weight)
      if (!Number.isInteger(w) || w < 0 || w > 30000) return '自重需为 0 ~ 30000 克的整数'
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
    const dto: GearItemSaveDTO = {
      name: name.trim(),
      category,
      weightGrams: weight.trim() ? Number(weight) : undefined,
      brand: brand.trim() || undefined,
      note: note.trim() || undefined,
    }
    try {
      if (initial) {
        await gearItemApi.update({ ...dto, id: initial.id, status })
      } else {
        await gearItemApi.create(dto)
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!initial) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    try {
      await gearItemApi.remove(initial.id)
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      setConfirmDelete(false)
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
            className="w-full max-w-md bg-white rounded-4xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
            exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{initial ? '编辑装备' : '新增装备'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
              <div>
                <label className={labelCls}>装备名</label>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：三峰 出云 40L"
                  maxLength={100}
                />
              </div>
              <div>
                <label className={labelCls}>品类</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {CATEGORY_LABELS.map((label, i) => (
                    <button
                      key={label}
                      onClick={() => setCategory(i + 1)}
                      className={`py-2 text-xs rounded-full border transition-all active:scale-[0.98] ${
                        category === i + 1
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>自重 克（可空）</label>
                  <input
                    className={`${inputCls} font-mono`}
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="1480"
                  />
                </div>
                <div>
                  <label className={labelCls}>品牌（可空）</label>
                  <input
                    className={inputCls}
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="三峰"
                    maxLength={50}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>备注（可空）</label>
                <input
                  className={inputCls}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="40L，主力包"
                  maxLength={200}
                />
              </div>
              {initial && (
                <div>
                  <label className={labelCls}>状态</label>
                  <div className="flex gap-1.5">
                    {[1, 0].map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`flex-1 py-2 text-xs rounded-full border transition-all active:scale-[0.98] ${
                          status === s
                            ? s === 1
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-500 text-white border-slate-500'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {s === 1 ? '在役' : '已退役'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-sm text-red-500"
                  >
                    <WarningCircle size={15} weight="fill" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="px-7 py-4 border-t border-slate-100 flex justify-between items-center">
              {initial ? (
                <button
                  onClick={handleDelete}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-full transition-all active:scale-[0.98] ${
                    confirmDelete ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'
                  }`}
                >
                  <Trash size={14} />
                  {confirmDelete ? '再点一次确认' : '删除'}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-900 rounded-full transition-colors active:scale-[0.98]"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
