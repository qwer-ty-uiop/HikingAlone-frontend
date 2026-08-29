import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { UploadSimple, X, MapTrifold, Clock, Path, TrendUp } from '@phosphor-icons/react'
import { routeApi } from './api'
import RouteMap from './RouteMap'
import { detectTrackType, parseTrackFile, totalDistanceKm, totalDurationMin, totalElevationGain } from './track'
import type { RoutePoint, RouteWaypoint } from './types'

/** 时长展示：>=60 分钟显示 xh ym，否则 xm */
export function formatDuration(min: number): string {
  if (!(min > 0)) return '0m'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

interface RouteUploadModalProps {
  onClose: () => void
  onCreated: () => void
}

/** 上传路线弹窗：选择 .gpx → 前端解析轨迹点并预览地图/统计 → 提交（指标由后端领域层权威计算） */
export default function RouteUploadModal({ onClose, onCreated }: RouteUploadModalProps) {
  const [fileName, setFileName] = useState('')
  const [points, setPoints] = useState<RoutePoint[]>([])
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parseError, setParseError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return
    if (!detectTrackType(file.name)) {
      setParseError('仅支持 .gpx / .kml 轨迹文件')
      return
    }
    setParseError('')
    try {
      const text = await file.text()
      const { points: parsed, waypoints: parsedWaypoints } = parseTrackFile(file.name, text)
      if (parsed.length < 2) {
        setParseError('未能从文件中解析出轨迹点，请检查文件内容')
        setPoints([])
        setWaypoints([])
        setFileName('')
        return
      }
      setFileName(file.name)
      setPoints(parsed)
      setWaypoints(parsedWaypoints)
      if (!name.trim()) setName(file.name.replace(/\.(gpx|kml)$/i, ''))
    } catch {
      setParseError('文件解析失败，请上传有效的 GPX / KML 轨迹文件')
      setPoints([])
      setWaypoints([])
      setFileName('')
    }
  }

  const hasTrack = points.length >= 2
  const canSubmit = hasTrack && name.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setParseError('')
    try {
      await routeApi.create({
        name: name.trim(),
        description: description.trim(),
        points,
        waypoints,
      })
      onCreated()
      onClose()
    } catch (e) {
      setParseError(e instanceof Error ? e.message : '保存失败')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="relative w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-4xl bg-white border border-slate-200/60 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.25)]"
      >
        {/* 头部 */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">上传路线</h2>
            <p className="text-[11px] text-slate-400 mt-1">
              支持 .gpx / .kml 轨迹文件，里程 / 时长 / 爬升自动计算
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

        <div className="px-6 pb-6 space-y-5">
          {/* 文件选择：已解析则显示文件名 + 可重选 */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,.kml"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            {!hasTrack ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  handleFile(e.dataTransfer.files?.[0])
                }}
                className={`w-full h-44 flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed transition-colors active:scale-[0.995] ${
                  dragging
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50/60 hover:border-emerald-400 hover:bg-emerald-50/40'
                }`}
              >
                <UploadSimple size={28} weight="light" className="text-slate-400" />
                <span className="text-sm text-slate-600">点击选择或拖拽 .gpx / .kml 文件到此处</span>
                <span className="text-xs text-slate-400">轨迹将从文件中解析并在地图上预览</span>
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapTrifold size={16} weight="bold" className="text-emerald-600 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{fileName}</span>
                </div>
                <button
                  onClick={() => {
                    setPoints([])
                    setWaypoints([])
                    setFileName('')
                  }}
                  className="px-3 py-1.5 text-xs rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all active:scale-95"
                >
                  重新选择
                </button>
              </div>
            )}
            {parseError && <p className="mt-2 text-xs text-red-600">{parseError}</p>}
          </div>

          {/* 地图预览 + 预览统计 */}
          {hasTrack && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-3xl border border-slate-200/70 h-80 relative bg-slate-100">
                <RouteMap points={points} waypoints={waypoints} className="w-full h-full" />
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-200/60">
                <div className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Path size={12} weight="bold" />
                    里程
                  </div>
                  <div className="text-base font-mono font-semibold text-slate-900">
                    {totalDistanceKm(points).toFixed(2)}
                    <span className="text-xs font-sans text-slate-400 ml-0.5">km</span>
                  </div>
                </div>
                <div className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
                    <Clock size={12} weight="bold" />
                    时长
                  </div>
                  <div className="text-base font-mono font-semibold text-slate-900">
                    {formatDuration(totalDurationMin(points))}
                  </div>
                </div>
                <div className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
                    <TrendUp size={12} weight="bold" />
                    爬升
                  </div>
                  <div className="text-base font-mono font-semibold text-slate-900">
                    {totalElevationGain(points).toFixed(0)}
                    <span className="text-xs font-sans text-slate-400 ml-0.5">m</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 名称 / 描述 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              路线名称
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="如：梧桐山碧桐道环线"
              className="w-full px-4 py-2.5 text-sm rounded-2xl bg-slate-100 border border-transparent focus:outline-none focus:bg-white focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">路线描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="路况、风景、难度等（可选）"
              className="w-full px-4 py-2.5 text-sm rounded-2xl bg-slate-100 border border-transparent focus:outline-none focus:bg-white focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* 操作 */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all active:scale-[0.98]"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
            >
              {submitting && (
                <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-white rounded-full animate-spin" />
              )}
              {submitting ? '保存中' : '保存路线'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
