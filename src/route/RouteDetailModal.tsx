import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, TrashSimple, CheckCircle, Clock, Path, TrendUp, MapPin, ArrowsOut } from '@phosphor-icons/react'
import { routeApi } from './api'
import RouteMap from './RouteMap'
import { formatDuration } from './RouteUploadModal'
import type { RouteTrackDetail } from './types'

interface RouteDetailModalProps {
  routeId: number
  onClose: () => void
  onDeleted: () => void
}

/** 路线详情弹窗：拉取完整轨迹点，地图渲染 + 统计 + 删除（两步确认） */
export default function RouteDetailModal({ routeId, onClose, onDeleted }: RouteDetailModalProps) {
  const [detail, setDetail] = useState<RouteTrackDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    routeApi
      .get(routeId)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [routeId])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await routeApi.remove(routeId)
      onDeleted()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      setDeleting(false)
    }
  }

  const dateLabel = (iso: string | undefined) => {
    if (!iso) return ''
    return iso.slice(0, 16).replace('T', ' ')
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="relative w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-4xl bg-white border border-slate-200/60 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="min-w-0">
            {loading ? (
              <div className="w-40 h-5 bg-slate-200/70 rounded-full skeleton-shimmer" />
            ) : (
              <h2 className="text-xl font-bold tracking-tight text-slate-900 truncate">
                {detail?.name ?? '路线详情'}
              </h2>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              {loading ? '' : `创建于 ${dateLabel(detail?.createTime)}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors active:scale-95"
            aria-label="关闭"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-64 rounded-3xl bg-slate-100 skeleton-shimmer" />
              <div className="h-16 rounded-2xl bg-slate-100 skeleton-shimmer" />
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-slate-500 text-sm mb-4">{error}</p>
              <button
                onClick={load}
                className="px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 active:scale-[0.98] transition-all"
              >
                重试
              </button>
            </div>
          ) : detail && detail.points.length >= 2 ? (
            <>
              <div className="overflow-hidden rounded-3xl border border-slate-200/70 h-80 relative bg-slate-100">
                <RouteMap points={detail.points} waypoints={detail.waypoints} className="w-full h-full" />
                {/* 放大查看：打开全屏地图层，便于观察长路线细节 */}
                <button
                  onClick={() => setMapExpanded(true)}
                  className="absolute top-3 right-3 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur text-xs font-medium text-slate-700 shadow-sm border border-slate-200/60 hover:bg-white active:scale-95 transition-all"
                >
                  <ArrowsOut size={13} weight="bold" />
                  放大
                </button>
              </div>

              {detail.description && (
                <p className="text-sm text-slate-500 leading-relaxed">{detail.description}</p>
              )}

              {/* 统计 */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-200/60">
                <div className="px-4 py-3.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Path size={12} weight="bold" />
                    里程
                  </div>
                  <div className="text-lg font-mono font-semibold text-slate-900">
                    {detail.distance.toFixed(2)}
                    <span className="text-xs font-sans text-slate-400 ml-0.5">km</span>
                  </div>
                </div>
                <div className="px-4 py-3.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Clock size={12} weight="bold" />
                    时长
                  </div>
                  <div className="text-lg font-mono font-semibold text-slate-900">
                    {formatDuration(detail.durationMin)}
                  </div>
                </div>
                <div className="px-4 py-3.5 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
                    <TrendUp size={12} weight="bold" />
                    爬升
                  </div>
                  <div className="text-lg font-mono font-semibold text-slate-900">
                    {detail.elevationGain.toFixed(0)}
                    <span className="text-xs font-sans text-slate-400 ml-0.5">m</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin size={12} weight="bold" className="text-emerald-600" />
                  轨迹点 {detail.points.length} 个
                </span>
                {/* 两步确认删除 */}
                <button
                  onClick={() => (confirmDelete ? handleDelete() : setConfirmDelete(true))}
                  disabled={deleting}
                  onMouseLeave={() => setConfirmDelete(false)}
                  className={`flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-50 ${
                    confirmDelete
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50'
                  }`}
                >
                  {deleting ? (
                    <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                  ) : confirmDelete ? (
                    <CheckCircle size={13} weight="bold" />
                  ) : (
                    <TrashSimple size={13} weight="bold" />
                  )}
                  {deleting ? '删除中' : confirmDelete ? '确认删除' : '删除路线'}
                </button>
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">路线轨迹数据为空</div>
          )}
        </div>
      </motion.div>
      </div>

      {/* 全屏地图层：点击"放大"后覆盖整个视口，便于查看长路线细节 */}
      {mapExpanded && detail && (
        <div className="fixed inset-0 z-[70] bg-white">
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-slate-100 text-xs text-slate-600 font-medium max-w-[200px] truncate">
              {detail.name}
            </span>
            <button
              onClick={() => setMapExpanded(false)}
              className="p-2 rounded-full bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 shadow-sm border border-slate-200/60 transition-colors active:scale-95"
              aria-label="关闭全屏地图"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
          <RouteMap points={detail.points} waypoints={detail.waypoints} className="w-full h-full" />
        </div>
      )}
    </>
  )
}
