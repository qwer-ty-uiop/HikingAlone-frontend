import { useEffect, useRef } from 'react'
import { Search, MapPin, Loader2, Home } from 'lucide-react'
import type { Category, StartPoint } from './types'

interface SidePanelProps {
  startPoint: StartPoint | null
  /** 高德 AMap 命名空间（地图加载完成后才有值） */
  amap: any
  mapReady: boolean
  categories: Category[]
  activeCategoryId: string
  onStartSelect: (poi: { name: string; city?: string; location?: any }) => void
  onTabClick: (id: string) => void
  onSubSearch: (keyword: string) => void
  searching: boolean
}

export default function SidePanel({
  startPoint,
  amap,
  mapReady,
  categories,
  activeCategoryId,
  onStartSelect,
  onTabClick,
  onSubSearch,
  searching,
}: SidePanelProps) {
  const tipPanelRef = useRef<HTMLDivElement>(null)

  // 创建输入提示(AutoComplete)：绑定输入框并监听选中
  useEffect(() => {
    if (!amap || !mapReady) return
    const auto = new amap.AutoComplete({
      input: 'start-input',
      output: 'start-tip',
      city: '',
      pageSize: 8,
    })
    const handleSelect = (e: any) => {
      const p = e?.poi
      if (!p?.name) return
      onStartSelect({ name: p.name, city: p.cityname || p.adcode, location: p.location })
    }
    auto.on('select', handleSelect)
    return () => {
      try {
        auto.off('select', handleSelect)
      } catch {
        /* 忽略 */
      }
    }
  }, [amap, mapReady, onStartSelect])

  const activeCategory = categories.find((c) => c.id === activeCategoryId)

  return (
    <div className="absolute top-0 right-0 bottom-0 w-[340px] z-20 flex flex-col bg-white/95 backdrop-blur border-l border-gray-200 shadow-2xl">
      {/* 顶部：搜索 */}
      <div className="p-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold tracking-tight">POI 探索</h1>
          <a
            href="/"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <Home size={14} />
            首页
          </a>
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            id="start-input"
            type="text"
            placeholder="搜索起点，如：北京南站"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            autoComplete="off"
          />
        </div>
        {/* AutoComplete 下拉面板 */}
        <div id="start-tip" ref={tipPanelRef} className="relative z-30" />

        {/* 当前起点 */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
          <MapPin size={14} className="text-emerald-600 shrink-0" />
          <span className="truncate">
            {startPoint ? `起点：${startPoint.name}` : '起点未设置'}
          </span>
        </div>
      </div>

      {/* 分类 Tab */}
      <div className="flex-1 overflow-y-auto">
        {categories.length === 0 && (
          <p className="px-4 py-3 text-xs text-gray-400">分类加载中...</p>
        )}
        <div className="flex gap-1 overflow-x-auto px-3 pt-3 pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onTabClick(cat.id)}
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all ${
                cat.id === activeCategoryId
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* 二级菜单 */}
        {activeCategory && activeCategory.children.length > 0 && (
          <div className="px-4 py-2">
            <p className="text-[11px] text-gray-400 mb-1.5">
              以起点为中心，周边 {activeCategory.name} 搜索
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeCategory.children.map((sub) => (
                <button
                  key={sub.name}
                  onClick={() => onSubSearch(sub.keyword)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-4 py-3 text-[11px] text-gray-400 border-t border-gray-100">
        {searching ? (
          <span className="flex items-center gap-1.5 text-blue-600">
            <Loader2 size={12} className="animate-spin" />
            正在搜索周边 POI...
          </span>
        ) : (
          '点击分类下的具体项开始周边搜索'
        )}
      </div>
    </div>
  )
}
