import { memo, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

export interface ChartPoint {
  date: string
  value: number
}

interface WeightChartProps {
  points: ChartPoint[]
  /** 数值单位（kg / 次/分），用于 y 轴与悬浮提示 */
  unit: string
  /** 折线主色（tailwind emerald-500 等 hex） */
  color?: string
}

/** viewBox 尺寸：等比缩放响应式，文字随容器等比缩放 */
const W = 640
const H = 240
const PAD = { l: 46, r: 20, t: 18, b: 30 }

/** 单点数据 hover 提示 */
interface Tip {
  x: number
  y: number
  date: string
  value: number
}

/** 数值格式：整数不带小数，否则保留 1 位 */
function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/** MM.DD 短日期 */
function shortDate(date: string): string {
  return date.slice(5).replace('-', '.')
}

/**
 * Catmull-Rom → 三次贝塞尔：把折线转为平滑曲线（张力 1/6，不过冲出数据范围明显）
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

/**
 * 趋势折线图：SVG 绘制（不引第三方图表库），平滑曲线 + 渐变面积 + 入场描线动画 + 悬浮提示。
 * y 轴取数据范围加 15% 余量（极差为 0 时上下各撑 1 个单位）；单条记录只画点不画线。
 */
const WeightChart = memo(function WeightChart({ points, unit, color = '#10b981' }: WeightChartProps) {
  const [tip, setTip] = useState<Tip | null>(null)

  const geo = useMemo(() => {
    const values = points.map((p) => p.value)
    let min = Math.min(...values)
    let max = Math.max(...values)
    const span = max - min
    if (span === 0) {
      min -= 1
      max += 1
    } else {
      const pad = span * 0.15
      min -= pad
      max += pad
    }
    const innerW = W - PAD.l - PAD.r
    const innerH = H - PAD.t - PAD.b
    const xy = points.map((p, i) => ({
      ...p,
      x: points.length === 1 ? PAD.l + innerW / 2 : PAD.l + (i / (points.length - 1)) * innerW,
      y: PAD.t + innerH - ((p.value - min) / (max - min)) * innerH,
    }))
    const line = smoothPath(xy)
    // 面积路径：沿曲线到底边闭合（单点无面积）
    const area =
      xy.length >= 2
        ? `${line} L ${xy[xy.length - 1].x} ${PAD.t + innerH} L ${xy[0].x} ${PAD.t + innerH} Z`
        : ''
    // 网格线：上下留 1/4 内边距的 3 条水平线 + 对应刻度
    const gridLines = [0.25, 0.5, 0.75].map((t) => {
      const y = PAD.t + innerH * t
      const v = max - (max - min) * t
      return { y, v }
    })
    return { xy, line, area, gridLines }
  }, [points])

  const onDotEnter = useCallback((e: React.MouseEvent<SVGCircleElement>, p: ChartPoint & { x: number; y: number }) => {
    const rect = e.currentTarget.getBoundingClientRect()
    // viewBox 坐标 → 屏幕坐标：以圆点元素自身的包围盒为准（等比缩放后仍准确）
    setTip({ x: rect.left + rect.width / 2, y: rect.top, date: p.date, value: p.value })
  }, [])
  const onDotLeave = useCallback(() => setTip(null), [])

  if (points.length === 0) {
    return null
  }

  const first = geo.xy[0]
  const last = geo.xy[geo.xy.length - 1]
  const mid = geo.xy[Math.floor((geo.xy.length - 1) / 2)]

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label={`${unit}趋势图`}>
        <defs>
          <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 网格与 y 轴刻度 */}
        {geo.gridLines.map((g) => (
          <g key={g.y}>
            <line x1={PAD.l} x2={W - PAD.r} y1={g.y} y2={g.y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 5" />
            <text x={PAD.l - 8} y={g.y + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="ui-monospace, monospace">
              {fmt(Math.round(g.v * 10) / 10)}
            </text>
          </g>
        ))}
        {/* 底线 */}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />

        {/* 面积 + 主折线（入场描线动画，transform/opacity 之外仅 pathLength，不触发布局） */}
        {geo.area && <path d={geo.area} fill="url(#chart-area)" />}
        {geo.line && (
          <motion.path
            d={geo.line}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ type: 'spring', stiffness: 40, damping: 20 }}
          />
        )}

        {/* 数据点：白底描边圆点，hover 放大并弹出提示 */}
        {geo.xy.map((p) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={tip?.date === p.date ? 5 : 3.5}
            fill="#fff"
            stroke={color}
            strokeWidth="2"
            className="transition-all duration-150 cursor-pointer"
            onMouseEnter={(e) => onDotEnter(e, p)}
            onMouseLeave={onDotLeave}
          />
        ))}

        {/* x 轴日期：首 / 中 / 尾 */}
        {[
          { p: first, anchor: 'start' as const },
          { p: mid, anchor: 'middle' as const },
          { p: last, anchor: 'end' as const },
        ].map(({ p, anchor }, i) => (
          <text
            key={i}
            x={p.x}
            y={H - 8}
            textAnchor={anchor}
            fontSize="10"
            fill="#94a3b8"
            fontFamily="ui-monospace, monospace"
          >
            {shortDate(p.date)}
          </text>
        ))}
      </svg>

      {/* 悬浮提示：portal 到 body，fixed 定位不随滚动/缩放裁剪 */}
      {createPortal(
        <AnimatePresence>
          {tip && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22 } }}
              exit={{ opacity: 0, y: 4, scale: 0.92, transition: { duration: 0.12 } }}
              className="fixed z-[100] pointer-events-none bg-slate-800 text-white border border-white/10 rounded-xl px-3 py-2 shadow-2xl text-xs"
              style={{ left: tip.x, top: tip.y - 10, transform: 'translate(-50%, -100%)' }}
            >
              <p className="font-mono font-semibold">{shortDate(tip.date)}</p>
              <p className="text-slate-300 mt-0.5">
                <span className="font-mono">{fmt(tip.value)}</span> {unit}
              </p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
})

export default WeightChart
