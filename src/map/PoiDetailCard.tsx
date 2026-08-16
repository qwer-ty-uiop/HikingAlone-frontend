import { Car, Footprints, Bus, Bike, Navigation, X, Loader2, MapPin, Clock } from 'lucide-react'
import type { PoiItem, RouteMode, RouteSummary, StartPoint } from './types'

interface PoiDetailCardProps {
  poi: PoiItem
  startPoint: StartPoint
  routeMode: RouteMode
  routeResult: RouteSummary | null
  routing: boolean
  routeError: string
  onGoHere: () => void
  onModeChange: (mode: RouteMode) => void
  onClose: () => void
}

const MODES: { key: RouteMode; label: string; icon: typeof Car }[] = [
  { key: 'driving', label: '驾车', icon: Car },
  { key: 'walking', label: '步行', icon: Footprints },
  { key: 'transit', label: '公交', icon: Bus },
  { key: 'riding', label: '骑行', icon: Bike },
]

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} 米`
  return `${(m / 1000).toFixed(1)} 公里`
}

function formatTime(s: number) {
  const hours = Math.floor(s / 3600)
  const minutes = Math.round((s % 3600) / 60)
  if (hours > 0 && minutes > 0) return `${hours} 小时 ${minutes} 分钟`
  if (hours > 0) return `${hours} 小时`
  return `${minutes || 1} 分钟`
}

export default function PoiDetailCard({
  poi,
  startPoint,
  routeMode,
  routeResult,
  routing,
  routeError,
  onGoHere,
  onModeChange,
  onClose,
}: PoiDetailCardProps) {
  return (
    <div className="absolute left-4 top-4 bottom-4 z-30 flex flex-col w-[320px] bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2 p-4 pb-3 border-b border-gray-100">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 break-all">{poi.name}</h2>
          {poi.type && <p className="text-xs text-gray-400 mt-0.5">{poi.type}</p>}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="关闭"
        >
          <X size={16} />
        </button>
      </div>

      {/* 详情 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
        <div className="flex items-start gap-2 text-gray-600">
          <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
          <span className="break-all">{poi.address || '暂无地址'}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Navigation size={14} className="shrink-0 text-gray-400" />
          <span>
            距起点「{startPoint.name}」约 {formatDistance(poi.distance ?? 0)}
          </span>
        </div>

        {/* 路线摘要 */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          {routing && (
            <div className="flex items-center gap-2 text-sm text-blue-600 py-2">
              <Loader2 size={14} className="animate-spin" />
              正在规划路线...
            </div>
          )}
          {routeError && (
            <p className="text-sm text-red-500 py-2">{routeError}</p>
          )}
          {routeResult && !routing && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Clock size={14} className="text-gray-400" />
                {formatTime(routeResult.time)}
                <span className="font-normal text-gray-500">· {formatDistance(routeResult.distance)}</span>
                {routeResult.cost != null && (
                  <span className="font-normal text-gray-500">· 约 ¥{routeResult.cost.toFixed(1)}</span>
                )}
              </div>
              {routeResult.lines.length > 0 && (
                <ul className="text-xs text-gray-500 space-y-1 pl-1">
                  {routeResult.lines.map((line, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!routeResult && !routing && !routeError && (
            <p className="text-xs text-gray-400">点击「去这里」，从起点规划到此处</p>
          )}
        </div>
      </div>

      {/* 底部：出行方式 + 去这里 */}
      <div className="p-4 pt-3 border-t border-gray-100 space-y-3">
        <div className="grid grid-cols-4 gap-1.5">
          {MODES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onModeChange(key)}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs transition-all ${
                routeMode === key
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={onGoHere}
          disabled={routing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
        >
          <Navigation size={16} />
          去这里
        </button>
      </div>
    </div>
  )
}
