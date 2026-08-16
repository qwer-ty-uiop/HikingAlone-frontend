import type { HeatmapData, HeatmapDay } from './types'

interface HeatmapProps {
  data: HeatmapData | null
  loading?: boolean
}

/** 单个格子：无记录则 date 为 null（空占位） */
interface Cell {
  date: string | null
  count: number
}

/** count → 颜色等级（0 无记录、1-4 递深）。emerald 为全局唯一强调色 */
const LEVEL_CLASS = [
  'bg-slate-100',
  'bg-emerald-200',
  'bg-emerald-400',
  'bg-emerald-600',
  'bg-emerald-800',
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

/**
 * GitHub 风格年度热力图：列=周（周日起），行=周日~周六。
 * 每列一个 flex 容器，从左上开始填充当天格子。
 */
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
    // 该月 1 日是全年第 doy 天（0 起）
    const doy = Math.floor(
      (Date.UTC(year, month - 1, 1) - Date.UTC(year, 0, 1)) / 86400000,
    )
    const col = Math.floor((doy + firstDayOffset) / 7)
    labels[col] = `${month}月`
  }
  return labels
}

export default function Heatmap({ data, loading }: HeatmapProps) {
  const year = data?.year ?? new Date().getFullYear()
  const daysMap = new Map<string, number>()
  data?.days.forEach((d: HeatmapDay) => daysMap.set(d.date, d.count))
  const grid = buildGrid(year, daysMap)
  const monthLabels = buildMonthLabels(year, grid.length)

  return (
    <div className="rounded-4xl border border-slate-200/50 bg-white p-6 md:p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl md:text-2xl font-bold tracking-tighter text-slate-900">
            {year} 训练热力图
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            每天一格 · 颜色深浅 = 当天打卡次数
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
          <span>少</span>
          {[0, 1, 2, 3, 4].map((lv) => (
            <span key={lv} className={`w-2.5 h-2.5 rounded-[3px] ${LEVEL_CLASS[lv]}`} />
          ))}
          <span>多</span>
          {loading && <span className="ml-2 text-slate-300">加载中</span>}
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* 月份标签行 */}
          <div className="flex gap-[3px] pl-8">
            {monthLabels.map((label, i) => (
              <span key={i} className="w-[10px] text-[10px] text-slate-400 text-center">
                {label}
              </span>
            ))}
          </div>
          {/* 热力图主体 */}
          <div className="flex gap-[3px]">
            {grid.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-[3px]">
                {col.map((cell, rowIdx) =>
                  cell.date ? (
                    <span
                      key={cell.date}
                      title={`${cell.date} · ${cell.count} 次打卡`}
                      className={`w-[10px] h-[10px] rounded-[3px] ${LEVEL_CLASS[levelOf(cell.count)]}`}
                    />
                  ) : (
                    <span key={`empty-${colIdx}-${rowIdx}`} className="w-[10px] h-[10px]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
