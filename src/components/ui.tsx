/** 新模块共享的动效与列表基础组件（train/route/body 各有本地副本，历史保留不动） */
import { useEffect, useState, type ReactNode } from 'react'
import { motion, useMotionValue, useMotionValueEvent, useSpring } from 'framer-motion'

/** 数字滚动：值变化时弹簧过渡（整数展示） */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(useMotionValue(0), { stiffness: 100, damping: 20 })
  const [display, setDisplay] = useState(0)
  useMotionValueEvent(spring, 'change', (v) => setDisplay(Math.round(v)))
  useEffect(() => {
    spring.set(value)
  }, [value, spring])
  return <span className={className}>{display}</span>
}

/** 带小数的数字滚动（digits 控制小数位） */
export function CountUpDecimal({
  value,
  digits = 1,
  className,
}: {
  value: number
  digits?: number
  className?: string
}) {
  const spring = useSpring(useMotionValue(0), { stiffness: 100, damping: 20 })
  const [display, setDisplay] = useState(0)
  useMotionValueEvent(spring, 'change', (v) => setDisplay(v))
  useEffect(() => {
    spring.set(value)
  }, [value, spring])
  return <span className={className}>{display.toFixed(digits)}</span>
}

/** 磁吸按钮容器：hover 时按光标偏移轻微吸附（useMotionValue 在渲染周期外，不触发父级重渲染） */
export function Magnetic({
  children,
  strength = 0.25,
}: {
  children: ReactNode
  strength?: number
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 100, damping: 20 })
  const sy = useSpring(y, { stiffness: 100, damping: 20 })
  return (
    <motion.div
      style={{ x: sx, y: sy, display: 'inline-block' }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - rect.left - rect.width / 2) * strength)
        y.set((e.clientY - rect.top - rect.height / 2) * strength)
      }}
      onMouseLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

/** 列表 stagger 入场（父容器 + 子项必须同树） */
export const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

export const listItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } },
}

export function MotionList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={listContainer}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  )
}

export function MotionItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={listItem}>
      {children}
    </motion.div>
  )
}

/** yyyy-MM-dd → MM.DD */
export function dateDot(date: string): string {
  return date.slice(5).replace('-', '.')
}

/** 日期字符串 yyyy-MM-dd → 今天同格式 */
export function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
