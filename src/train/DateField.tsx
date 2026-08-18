import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react'

interface DateFieldProps {
  value: string
  onChange: (v: string) => void
}

/** 星期表头：周一起始（国内习惯） */
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const CALENDAR_WIDTH = 272

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 解析 yyyy-MM-dd 到本地 Date（非法返回 null） */
function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/**
 * 日期选择：自绘日历面板（portal 悬浮层），触发元素为按钮而非 input——按钮天然不可选中，
 * 点击时不会像只读 input 那样把框内日期文字标蓝选中。
 * <p>点击按钮开/关（toggle）；面板可前后翻月、点击日期选中并关闭；点外部或 Esc 关闭。
 * 不再依赖原生 picker，跨浏览器行为一致，也不会出现"再点无法收起"</p>
 */
export default function DateField({ value, onChange }: DateFieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)
  // 视图月份：打开时定位到当前值所在月
  const [view, setView] = useState(() => {
    const now = new Date()
    return { y: now.getFullYear(), m: now.getMonth() }
  })

  const togglePicker = () => {
    if (open) {
      setOpen(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const parsed = parseDate(value)
    setView({ y: parsed?.getFullYear() ?? new Date().getFullYear(), m: parsed ? parsed.getMonth() : new Date().getMonth() })
    setAnchor({
      left: Math.min(rect.left, window.innerWidth - CALENDAR_WIDTH - 8),
      top: rect.bottom + 6,
    })
    setOpen(true)
  }

  // 点外部（含日历面板本身不关）/ Esc 关闭
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /** 当月日期格：周一起始，前置空位补齐 */
  const cells = useMemo(() => {
    const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
    const arr: (number | null)[] = Array.from({ length: firstWeekday }, () => null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    return arr
  }, [view])

  const today = todayStr()

  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))

  const pick = (day: number) => {
    onChange(`${view.y}-${pad(view.m + 1)}-${pad(day)}`)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={togglePicker}
          className={`w-full px-3 py-2 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-mono cursor-pointer select-none text-left date-input ${
            open ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-200'
          }`}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="text-slate-900">{value || '选择日期'}</span>
        </button>
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        >
          <CalendarBlank size={14} weight="bold" />
        </span>
      </div>

      {createPortal(
        <AnimatePresence>
          {open && anchor && (
            <motion.div
              ref={popRef}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }}
              exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
              className="fixed z-[100] w-[272px] bg-white rounded-2xl border border-slate-200 shadow-2xl p-3"
              style={{ left: anchor.left, top: anchor.top }}
            >
              {/* 月份头部：前后翻月 */}
              <div className="flex items-center justify-between mb-2 px-1">
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all"
                  aria-label="上个月"
                >
                  <CaretLeft size={14} weight="bold" />
                </button>
                <span className="text-sm font-semibold text-slate-700">
                  {view.y} 年 {view.m + 1} 月
                </span>
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all"
                  aria-label="下个月"
                >
                  <CaretRight size={14} weight="bold" />
                </button>
              </div>
              {/* 星期表头 */}
              <div className="grid grid-cols-7 mb-1">
                {WEEK_LABELS.map((w) => (
                  <span key={w} className="text-center text-[10px] text-slate-400 py-1">
                    {w}
                  </span>
                ))}
              </div>
              {/* 日期格 */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((day, i) => {
                  if (day == null) return <span key={`empty-${i}`} />
                  const dayStr = `${view.y}-${pad(view.m + 1)}-${pad(day)}`
                  const isSelected = dayStr === value
                  const isToday = dayStr === today
                  return (
                    <button
                      key={dayStr}
                      onClick={() => pick(day)}
                      className={`h-8 text-xs rounded-lg transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                          : isToday
                            ? 'text-emerald-700 font-semibold hover:bg-emerald-50'
                            : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
