import { memo, useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion'
import { createPortal } from 'react-dom'
import { CalendarCheck, PencilSimple, Check, X } from '@phosphor-icons/react'
import { trainApi } from './api'
import type { HeatmapData, HeatmapDay, ItemMode } from './types'

interface HeatmapProps {
  data: HeatmapData | null
  /** 最近打卡记录（跨计划合并，按日期倒序），用于填充热力图右侧空白 */
  recent?: RecentRecord[]
  /** 编辑打卡记录成功后回调（让外层刷新计划/热力图） */
  onEdited?: () => void
}

/** 最近提交条目：由 TrainPage 拉取各计划详情合并组装 */
export interface RecentRecord {
  id: number
  planId: number
  itemId: number
  date: string
  planTitle: string
  itemName: string
  mode: ItemMode
  unit: string
  completedSets: number
  completedTimes: number
  /** 本次提交时间（yyyy-MM-dd'T'HH:mm:ss），用于从新到旧排序 */
  createTime: string | null
  /** 最近编辑时间（yyyy-MM-dd'T'HH:mm:ss）；编辑过的记录排到最前 */
  updateTime: string | null
}

/** 单个格子：无记录则 date 为 null（空占位） */
interface Cell {
  date: string | null
  count: number
}

/** count → 颜色等级（0 无记录、1-4 逐级加深）。浅色卡片上 emerald 从浅灰到墨绿，跨度大、色差明显 */
const LEVEL_CLASS = [
  'bg-slate-100 border-slate-200/60',
  'bg-emerald-200 border-emerald-300/60',
  'bg-emerald-400 border-emerald-500/50',
  'bg-emerald-600 border-emerald-700/50',
  'bg-emerald-800 border-emerald-900/40',
]

function levelOf(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  return 4
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function dateStr(year: number, dayIndex: number): string {
  const d = new Date(year, 0, 1 + dayIndex)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** GitHub 风格年度热力图：列=周（周日起），行=周日~周六。每列一个 flex 容器 */
function buildGrid(year: number, days: Map<string, number>): Cell[][] {
  const totalDays = isLeapYear(year) ? 366 : 365
  const firstDayOffset = new Date(year, 0, 1).getDay() // 0=周日
  const cols = Math.ceil((totalDays + firstDayOffset) / 7)
  const grid: Cell[][] = Array.from({ length: cols }, () =>
    Array.from({ length: 7 }, (): Cell => ({ date: null, count: 0 })),
  )
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const pos = dayIndex + firstDayOffset
    const col = Math.floor(pos / 7)
    const row = pos % 7
    const date = dateStr(year, dayIndex)
    grid[col][row] = { date, count: days.get(date) ?? 0 }
  }
  return grid
}

/** 每列顶部显示月份：该列包含某月 1 日时显示月份名 */
function buildMonthLabels(year: number, cols: number): (string | null)[] {
  const labels: (string | null)[] = Array.from({ length: cols }, () => null)
  const firstDayOffset = new Date(year, 0, 1).getDay()
  for (let month = 1; month <= 12; month++) {
    const doy = Math.floor(
      (Date.UTC(year, month - 1, 1) - Date.UTC(year, 0, 1)) / 86400000,
    )
    const col = Math.floor((doy + firstDayOffset) / 7)
    labels[col] = `${month}月`
  }
  return labels
}

/** 悬浮提示内容 */
interface Tip {
  /** 触发格子的屏幕坐标（用于 fixed 定位 tooltip） */
  rect: DOMRect
  date: string
  count: number
}

/** 单个格子：memo 隔离，hover 放大 + 上报坐标与内容 */
const GridCell = memo(function GridCell({
  cell,
  level,
  onHover,
}: {
  cell: Cell
  level: number
  onHover: (tip: Tip | null) => void
}) {
  if (!cell.date) {
    return <span className="w-3 h-3" />
  }
  return (
    <motion.span
      whileHover={{ scale: 1.35 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className={`w-3 h-3 rounded-[4px] border cursor-pointer ${LEVEL_CLASS[level]}`}
      onMouseEnter={(e) =>
        onHover({
          rect: e.currentTarget.getBoundingClientRect(),
          date: cell.date!,
          count: cell.count,
        })
      }
      onMouseLeave={() => onHover(null)}
    />
  )
})

/** 左侧星期标签列：只在周一/周三/周五显示 */
const WEEK_ROW_LABELS = ['', '一', '', '三', '', '五', '']

/** 数字滚动：值变化时从旧值弹簧过渡到新值（订阅 motion value 到 state，避免渲染异常） */
function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 100, damping: 20 })
  const [display, setDisplay] = useState(0)
  useMotionValueEvent(spring, 'change', (v) => setDisplay(Math.round(v)))
  useEffect(() => {
    mv.set(value)
  }, [value, mv])
  return <span className={className}>{display}</span>
}

export default function Heatmap({ data, recent = [], onEdited }: HeatmapProps) {
  const [year, setYear] = useState<number>(data?.year ?? new Date().getFullYear())
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(data)
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)

  // 最近提交编辑态
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editSets, setEditSets] = useState('')
  const [editTimes, setEditTimes] = useState('')
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  // 父组件刷新（打卡/新建计划后）时，回到当年最新数据
  useEffect(() => {
    if (data) {
      setYear(data.year)
      setHeatmap(data)
    }
  }, [data])

  const changeYear = useCallback(
    (target: number) => {
      if (target === year) return
      setYear(target)
      setLoading(true)
      trainApi
        .getHeatmap(target)
        .then(setHeatmap)
        .catch(() => {
          /* 请求失败保持当前数据 */
        })
        .finally(() => setLoading(false))
    },
    [year],
  )

  const handleHover = useCallback((t: Tip | null) => setTip(t), [])

  const startEdit = (r: RecentRecord) => {
    setEditingId(r.id)
    setEditSets(String(r.completedSets))
    setEditTimes(String(r.completedTimes))
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError('')
  }

  const saveEdit = async (r: RecentRecord) => {
    setSaving(true)
    setEditError('')
    try {
      const times = editTimes.trim() ? Number(editTimes) : null
      const sets = editSets.trim() ? Number(editSets) : 0
      await trainApi.updateRecord({
        id: r.id,
        completedSets: r.mode === 'sets' ? sets : 0,
        completedTimes: r.mode === 'sets' ? (times == null ? null : times) : (times ?? 0),
      })
      setEditingId(null)
      onEdited?.()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const daysMap = new Map<string, number>()
  heatmap?.days.forEach((d: HeatmapDay) => daysMap.set(d.date, d.count))
  const grid = buildGrid(year, daysMap)
  const monthLabels = buildMonthLabels(year, grid.length)
  const totalCount = heatmap?.totalCount ?? 0
  // 近 5 年：以选中年为中心向两侧各延伸 2 年，左右都能切换
  const years = Array.from({ length: 5 }, (_, i) => year - 2 + i)

  return (
    <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* 左侧：热力图主体 */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <h3 className="text-xl md:text-2xl font-bold tracking-tighter text-slate-900">
              {year}年已提交 <CountUp value={totalCount} className="font-mono text-emerald-600" /> 次
            </h3>
            {/* 年份切换 + 图例：按钮组下方由图例填充，避免悬空 */}
            <div className="flex flex-col items-end gap-3 shrink-0">
              <div className="flex items-center gap-1.5">
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() => changeYear(y)}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors active:scale-95 ${
                      y === year
                        ? 'text-white'
                        : 'bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-700'
                    }`}
                  >
                    {/* 选中年份：layoutId 共享元素，切换时底色平滑滑过 */}
                    {y === year && (
                      <motion.span
                        layoutId="heatmap-year-pill"
                        className="absolute inset-0 rounded-lg bg-emerald-600 shadow-sm"
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                      />
                    )}
                    <span className="relative">{y}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                <span>少</span>
                {[0, 1, 2, 3, 4].map((lv) => (
                  <span key={lv} className={`w-2.5 h-2.5 rounded-[3px] border ${LEVEL_CLASS[lv]}`} />
                ))}
                <span>多</span>
                {loading && <span className="ml-1 text-slate-400">加载中…</span>}
              </div>
            </div>
          </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* 月份标签行：左侧留出星期标签列宽 */}
          <div className="flex gap-[3px] pl-[30px]">
            {monthLabels.map((label, i) => (
              <span key={i} className="w-3 text-[10px] text-slate-500 text-center">
                {label}
              </span>
            ))}
          </div>
          {/* 热力图主体 */}
          <div className="flex gap-[3px]">
            {/* 左侧星期标签：周一/周三/周五 */}
            <div className="flex flex-col gap-[3px] pr-1.5">
              {WEEK_ROW_LABELS.map((label, rowIdx) => (
                <span key={rowIdx} className="w-6 h-3 text-[10px] leading-3 text-slate-400 text-right">
                  {label}
                </span>
              ))}
            </div>
            {grid.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-[3px]">
                {col.map((cell, rowIdx) => (
                  <GridCell
                    key={cell.date ?? `empty-${colIdx}-${rowIdx}`}
                    cell={cell}
                    level={levelOf(cell.count)}
                    onHover={handleHover}
                  />
                ))}
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>

        {/* 右侧：最近提交，填充全宽容器右端空白 */}
        <aside className="lg:w-80 shrink-0 lg:border-l lg:border-slate-100 lg:pl-8">
          <div className="flex items-center gap-1.5">
            <CalendarCheck size={15} className="text-emerald-600" />
            <h4 className="text-sm font-semibold text-slate-700">最近提交</h4>
            <span className="text-[10px] font-mono text-slate-400">({recent.length})</span>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-300 py-3">暂无打卡记录</p>
          ) : (
            <ul className="mt-1 divide-y divide-slate-100">
              {recent.map((r) => (
                <li key={r.id} className="py-2.5">
                  {editingId === r.id ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 truncate">
                        <span className="font-mono text-slate-400">{r.date}</span>
                        {' · '}
                        <span className="font-medium text-slate-700">{r.itemName}</span>
                      </p>
                      {r.mode === 'sets' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block space-y-1">
                            <span className="text-[10px] text-slate-400">完成组数</span>
                            <input
                              type="number"
                              min={0}
                              value={editSets}
                              onChange={(e) => setEditSets(e.target.value)}
                              className="w-full px-2 py-1 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[10px] text-slate-400">每组次数</span>
                            <input
                              type="number"
                              min={0}
                              value={editTimes}
                              onChange={(e) => setEditTimes(e.target.value)}
                              className="w-full px-2 py-1 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="block space-y-1">
                          <span className="text-[10px] text-slate-400">完成次数</span>
                          <input
                            type="number"
                            min={0}
                            value={editTimes}
                            onChange={(e) => setEditTimes(e.target.value)}
                            className="w-full px-2 py-1 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                          />
                        </label>
                      )}
                      {editError && <p className="text-[10px] text-red-500">{editError}</p>}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => saveEdit(r)}
                          disabled={saving}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 active:scale-95 disabled:opacity-60 transition-all"
                        >
                          {saving ? (
                            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Check size={12} weight="bold" />
                          )}
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all"
                          aria-label="取消编辑"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-slate-400">{r.date}</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs font-semibold text-emerald-700 truncate">
                            {r.planTitle}
                          </span>
                          <button
                            onClick={() => startEdit(r)}
                            className="shrink-0 p-1 rounded-md text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 active:scale-95 transition-all"
                            aria-label="编辑记录"
                          >
                            <PencilSimple size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        <span className="font-medium text-slate-700">{r.itemName}</span>{' '}
                        完成{' '}
                        <span className="font-mono">
                          {r.mode === 'sets'
                            ? `${r.completedSets} 组${r.completedTimes ? ` × ${r.completedTimes}` : ''}`
                            : `${r.completedTimes}${r.unit}`}
                        </span>
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
      {/* 悬浮提示：portal 到 body，fixed 定位不随滚动裁剪 */}
      {createPortal(
        <AnimatePresence>
          {tip && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22 } }}
              exit={{ opacity: 0, y: 4, scale: 0.92, transition: { duration: 0.12 } }}
              className="fixed z-[100] pointer-events-none bg-slate-800 text-white border border-white/10 rounded-xl px-3 py-2 shadow-2xl text-xs"
              style={{
                left: tip.rect.left + tip.rect.width / 2,
                top: tip.rect.top - 10,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <p className="font-mono font-semibold">{tip.date}</p>
              <p className="text-slate-300 mt-0.5">
                {tip.count > 0 ? `打卡 ${tip.count} 次` : '无打卡记录'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
