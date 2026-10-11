import {
  Backpack,
  Bed,
  BatteryCharging,
  Compass,
  FirstAidKit,
  Flashlight,
  ForkKnife,
  Package,
  Sneaker,
  Tent,
  TShirt,
  type Icon,
} from '@phosphor-icons/react'

/** 品类 → 图标与配色的统一映射（装包可视化/列表/联想下拉共用） */
export function categoryTextClass(category: number | null | undefined): string {
  return (META[category ?? 11] ?? META[11]).color
}
const META: Record<number, { icon: Icon; color: string; bg: string }> = {
  1: { icon: Backpack, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  2: { icon: Tent, color: 'text-sky-600', bg: 'bg-sky-50' },
  3: { icon: Bed, color: 'text-violet-600', bg: 'bg-violet-50' },
  4: { icon: Sneaker, color: 'text-orange-600', bg: 'bg-orange-50' },
  5: { icon: TShirt, color: 'text-rose-600', bg: 'bg-rose-50' },
  6: { icon: ForkKnife, color: 'text-amber-600', bg: 'bg-amber-50' },
  7: { icon: Flashlight, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  8: { icon: Compass, color: 'text-teal-600', bg: 'bg-teal-50' },
  9: { icon: FirstAidKit, color: 'text-red-600', bg: 'bg-red-50' },
  10: { icon: BatteryCharging, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  11: { icon: Package, color: 'text-slate-500', bg: 'bg-slate-100' },
}

/**
 * 装备品类图标：圆角色块 + 实心品类图标。
 * 未知/临时条目归入 11 其他。
 */
export default function GearIcon({
  category,
  size = 16,
  className = '',
}: {
  category: number | null | undefined
  size?: number
  className?: string
}) {
  const meta = META[category ?? 11] ?? META[11]
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ${meta.bg} ${className}`}
      style={{ width: size + 8, height: size + 8 }}
    >
      <Icon size={size} weight="fill" className={meta.color} />
    </span>
  )
}
