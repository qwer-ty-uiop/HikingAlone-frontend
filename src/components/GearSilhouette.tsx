/**
 * 品类实物剪影 SVG（拼图装包芯片用）：每品类一个可辨识的单色实物轮廓，
 * viewBox 40x40，fill=currentColor，颜色由父级 text-* 控制。
 * 造型为示意化产品剪影（背包带肩带、帐篷 A 字开门、睡袋卷状、鞋型…）
 */
const SHAPES: Record<number, React.ReactNode> = {
  // 背包：主仓 + 顶盖 + 肩带
  1: (
    <>
      <path d="M12 13 C9 15 7.5 19 7.5 24 L7.5 33 C7.5 36 10 38.5 13 38.5 L27 38.5 C30 38.5 32.5 36 32.5 33 L32.5 24 C32.5 19 31 15 28 13 L28 11 C28 8.5 26 6.5 23.5 6.5 L16.5 6.5 C14 6.5 12 8.5 12 11 Z" />
      <path d="M12 14 C16 15.5 24 15.5 28 14 L28 18 C24 19.4 16 19.4 12 18 Z" fill="#fff" opacity="0.35" />
    </>
  ),
  // 帐篷：A 字 + 倒 V 门
  2: <path d="M20 5 L37 35 L26.5 35 L20 21 L13.5 35 L3 35 Z" />,
  // 睡袋：卷状（侧视圆筒 + 两道捆带）
  3: (
    <>
      <rect x="4" y="14" width="32" height="12" rx="6" />
      <rect x="14" y="13.5" width="3" height="13" fill="#fff" opacity="0.55" />
      <rect x="23" y="13.5" width="3" height="13" fill="#fff" opacity="0.55" />
    </>
  ),
  // 登山鞋：侧面鞋型 + 鞋底
  4: (
    <>
      <path d="M4 26 C4 21.5 8 19.5 12.5 19.5 L18 13.5 C19.8 11.5 22.8 11.6 24.6 13.5 L29.5 19 C33 20.2 36 22.5 36 26.5 L36 28.5 C36 30.5 34.5 32 32.5 32 L7.5 32 C5.4 32 4 29.5 4 26 Z" />
      <path d="M4 29.5 L36 29.5 L36 32 L4 32 Z" opacity="0.5" />
    </>
  ),
  // 冲锋衣：连帽衣型 + 拉链
  5: (
    <>
      <path d="M15 5 L20 9 L25 5 L31 8.5 C33 9.5 34 11.5 34.5 13.5 L36 21 L30.5 22.5 L30.5 35 L9.5 35 L9.5 22.5 L4 21 L5.5 13.5 C6 11.5 7 9.5 9 8.5 Z" />
      <rect x="19" y="10" width="2" height="24" fill="#fff" opacity="0.55" />
    </>
  ),
  // 炊具：套锅 + 长柄
  6: (
    <>
      <path d="M7 18 L29 18 L29 27 C29 30.5 26.5 33 23 33 L13 33 C9.5 33 7 30.5 7 27 Z" />
      <path d="M29 19 L38 12 L38 16.5 L31 22 Z" opacity="0.75" />
      <rect x="16" y="14.5" width="4" height="3" rx="1.2" />
    </>
  ),
  // 头灯：灯头 + 头带
  7: (
    <>
      <rect x="3" y="15" width="17" height="9" rx="4.5" opacity="0.75" />
      <path d="M22 12 C29 12 34.5 16.5 34.5 21.5 C34.5 25 32.5 27.5 29 27.5 C25.5 27.5 23.5 25 23.5 22 C23.5 19.5 24.5 18.5 22.5 17.5 Z" />
    </>
  ),
  // 指南针：表盘 + 指针
  8: (
    <>
      <circle cx="20" cy="20" r="15" />
      <path d="M28 12 L23.2 22.5 L12 28 L16.8 17.5 Z" fill="#fff" opacity="0.8" />
      <circle cx="20" cy="20" r="2.2" fill="#fff" />
    </>
  ),
  // 急救包：箱体 + 提手 + 十字
  9: (
    <>
      <path d="M15 9 C15 7 16.5 5.5 18.5 5.5 L21.5 5.5 C23.5 5.5 25 7 25 9 L25 12 L15 12 Z" opacity="0.75" />
      <rect x="6" y="12" width="28" height="23" rx="3.5" />
      <path d="M18 18.5 L22 18.5 L22 22.5 L26 22.5 L26 26.5 L22 26.5 L22 30.5 L18 30.5 L18 26.5 L14 26.5 L14 22.5 L18 22.5 Z" fill="#fff" />
    </>
  ),
  // 电池/充电宝：圆角矩 + 电量条
  10: (
    <>
      <rect x="9" y="10" width="22" height="20" rx="4" />
      <rect x="17" y="6.5" width="6" height="3.5" rx="1.5" opacity="0.75" />
      <path d="M21.5 14 L15.5 21.5 L19.5 21.5 L18 26 L24.5 18.5 L20.5 18.5 Z" fill="#fff" />
    </>
  ),
  // 登山杖：斜杖 + 握把 + 雪托
  11: (
    <>
      <rect x="24.5" y="4" width="6" height="9" rx="2" transform="rotate(18 27.5 8.5)" />
      <path d="M27 10 L14 33" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M11.5 30 L17.5 35.5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </>
  ),
}

export default function GearSilhouette({
  category,
  size = 28,
  className = '',
  title,
}: {
  category: number | null | undefined
  size?: number
  className?: string
  title?: string
}) {
  const cat = category ?? 11
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      fill="currentColor"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={title ?? `品类 ${cat} 剪影`}
    >
      {SHAPES[cat] ?? SHAPES[11]}
    </svg>
  )
}
