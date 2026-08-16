import { Loader2, MapPin } from 'lucide-react'
import type { PoiItem } from './types'

interface PoiListPanelProps {
  pois: PoiItem[]
  selectedPoi: PoiItem | null
  searching: boolean
  error: string
  onSelect: (poi: PoiItem) => void
}

function formatDistance(distance?: number) {
  if (distance == null) return ''
  if (distance < 1000) return `${Math.round(distance)} 米`
  return `${(distance / 1000).toFixed(1)} 公里`
}

export default function PoiListPanel({ pois, selectedPoi, searching, error, onSelect }: PoiListPanelProps) {
  if (searching) {
    return (
      <div className="absolute left-4 right-[356px] bottom-4 z-20 flex items-center justify-center gap-2 py-4 bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-gray-100 text-sm text-gray-600">
        <Loader2 size={16} className="animate-spin text-blue-600" />
        正在搜索周边 POI...
      </div>
    )
  }

  return (
    <div className="absolute left-4 right-[356px] bottom-4 z-20">
      {error && (
        <div className="mb-2 px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
          {error}
        </div>
      )}
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-100 p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-sm font-semibold text-gray-800">
            共 {pois.length} 个结果
          </span>
          <span className="text-[11px] text-gray-400">点击列表项查看详情</span>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {pois.map((poi, idx) => {
            const active = poi.id === selectedPoi?.id
            return (
              <button
                key={poi.id}
                onClick={() => onSelect(poi)}
                className={`shrink-0 w-[220px] text-left p-3 rounded-xl border transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center rounded-full text-[11px] font-semibold text-white ${
                      active ? 'bg-blue-600' : 'bg-gray-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{poi.name}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {poi.address || '暂无地址'}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-400">
                      <MapPin size={11} />
                      {formatDistance(poi.distance) || '—'}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
