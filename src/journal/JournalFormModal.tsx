import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WarningCircle } from '@phosphor-icons/react'
import DateField from '../train/DateField'
import { todayStr } from '../components/ui'
import { routeApi } from '../route/api'
import { journalApi } from './api'
import type { RouteTrack } from '../route/types'
import type { JournalDetail, JournalSaveDTO } from './types'

/** 难度/心情标签（与后端取值一致） */
export const DIFFICULTY_LABELS = ['休闲', '轻松', '进阶', '挑战', '地狱']
export const MOOD_LABELS = ['疲惫', '平静', '愉悦', '兴奋', '震撼']

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:bg-white transition-colors'
const labelCls = 'block text-xs font-medium text-slate-500 mb-1.5'

interface JournalFormModalProps {
  open: boolean
  initial?: JournalDetail | null
  onClose: () => void
  onSaved: () => void
}

/**
 * 新建/编辑日记弹窗：routeId 选中后，里程/时长/爬升留空则由后端从轨迹自动带出
 */
export default function JournalFormModal({ open, initial, onClose, onSaved }: JournalFormModalProps) {
  const [title, setTitle] = useState('')
  const [hikeDate, setHikeDate] = useState(todayStr())
  const [routeId, setRouteId] = useState<string>('')
  const [routes, setRoutes] = useState<RouteTrack[]>([])
  const [difficulty, setDifficulty] = useState(3)
  const [mood, setMood] = useState(3)
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [elevation, setElevation] = useState('')
  const [weather, setWeather] = useState('')
  const [companions, setCompanions] = useState('独行')
  const [cost, setCost] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 打开时回填（编辑）或重置（新建），并拉路线列表供选择
  useEffect(() => {
    if (!open) return
    if (initial) {
      setTitle(initial.title)
      setHikeDate(initial.hikeDate)
      setRouteId(initial.routeId == null ? '' : String(initial.routeId))
      setDistance(initial.distanceKm == null ? '' : String(initial.distanceKm))
      setDuration(initial.durationMin == null ? '' : String(initial.durationMin))
      setElevation(initial.elevationGain == null ? '' : String(initial.elevationGain))
      setDifficulty(initial.difficulty)
      setMood(initial.mood)
      setWeather(initial.weather ?? '')
      setCompanions(initial.companions ?? '')
      setCost(initial.cost == null ? '' : String(initial.cost))
      setContent(initial.content ?? '')
    } else {
      setTitle('')
      setHikeDate(todayStr())
      setRouteId('')
      setDistance('')
      setDuration('')
      setElevation('')
      setDifficulty(3)
      setMood(3)
      setWeather('')
      setCompanions('独行')
      setCost('')
      setContent('')
    }
    setError('')
    routeApi
      .list()
      .then(setRoutes)
      .catch(() => setRoutes([]))
  }, [open, initial])

  const validate = (): string => {
    if (!title.trim()) return '请填写标题'
    if (title.trim().length > 100) return '标题不能超过 100 字'
    if (content.length > 8000) return '正文不能超过 8000 字'
    if (distance.trim()) {
      const d = Number(distance)
      if (Number.isNaN(d) || d <= 0 || d > 500) return '里程需在 0 ~ 500 km 之间'
    }
    if (duration.trim()) {
      const m = Number(duration)
      if (!Number.isInteger(m) || m < 1 || m > 4320) return '时长需在 1 ~ 4320 分钟之间'
    }
    if (elevation.trim()) {
      const e = Number(elevation)
      if (Number.isNaN(e) || e < 0 || e > 10000) return '累计爬升需在 0 ~ 10000 米之间'
    }
    if (cost.trim()) {
      const c = Number(cost)
      if (Number.isNaN(c) || c < 0) return '花费不能为负数'
    }
    return ''
  }

  const handleSubmit = async () => {
    const msg = validate()
    if (msg) {
      setError(msg)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const dto: JournalSaveDTO = {
        title: title.trim(),
        hikeDate,
        routeId: routeId ? Number(routeId) : undefined,
        distanceKm: distance.trim() ? Number(distance) : undefined,
        durationMin: duration.trim() ? Number(duration) : undefined,
        elevationGain: elevation.trim() ? Number(elevation) : undefined,
        difficulty,
        mood,
        weather: weather.trim() || undefined,
        companions: companions.trim() || undefined,
        cost: cost.trim() ? Number(cost) : undefined,
        content: content.trim() || undefined,
      }
      if (initial) {
        await journalApi.update({ ...dto, id: initial.id })
      } else {
        await journalApi.create(dto)
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-2xl bg-white rounded-4xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } }}
            exit={{ opacity: 0, scale: 0.96, y: 10, transition: { duration: 0.15 } }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{initial ? '编辑日记' : '新建日记'}</h3>
              <p className="text-xs text-slate-400 mt-1">
                关联轨迹后，里程 / 时长 / 爬升留空会自动从轨迹带出
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4">
              <div>
                <label className={labelCls}>标题</label>
                <input
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="如：雨后初晴 · 海坨山南大梁"
                  maxLength={100}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>徒步日期</label>
                  <DateField value={hikeDate} onChange={setHikeDate} />
                </div>
                <div>
                  <label className={labelCls}>关联轨迹（可空）</label>
                  <select
                    className={inputCls}
                    value={routeId}
                    onChange={(e) => setRouteId(e.target.value)}
                  >
                    <option value="">不关联</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>里程 km（可空）</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.01"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="自动带出"
                  />
                </div>
                <div>
                  <label className={labelCls}>时长 分钟（可空）</label>
                  <input
                    className={inputCls}
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="自动带出"
                  />
                </div>
                <div>
                  <label className={labelCls}>爬升 m（可空）</label>
                  <input
                    className={inputCls}
                    type="number"
                    value={elevation}
                    onChange={(e) => setElevation(e.target.value)}
                    placeholder="自动带出"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>难度</label>
                <div className="flex gap-1.5">
                  {DIFFICULTY_LABELS.map((label, i) => (
                    <button
                      key={label}
                      onClick={() => setDifficulty(i + 1)}
                      className={`flex-1 py-2 text-xs rounded-full border transition-all active:scale-[0.98] ${
                        difficulty === i + 1
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>心情</label>
                <div className="flex gap-1.5">
                  {MOOD_LABELS.map((label, i) => (
                    <button
                      key={label}
                      onClick={() => setMood(i + 1)}
                      className={`flex-1 py-2 text-xs rounded-full border transition-all active:scale-[0.98] ${
                        mood === i + 1
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>天气（可空）</label>
                  <input
                    className={inputCls}
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    placeholder="多云 12℃ 微风"
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className={labelCls}>同伴（可空）</label>
                  <input
                    className={inputCls}
                    value={companions}
                    onChange={(e) => setCompanions(e.target.value)}
                    placeholder="独行"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className={labelCls}>花费 元（可空）</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="86.5"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>正文（可空，{content.length}/8000）</label>
                <textarea
                  className={`${inputCls} min-h-[140px] resize-y`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="今天的山脊线、遇到的人、腿的感觉……"
                  maxLength={8000}
                />
              </div>
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-sm text-red-500"
                  >
                    <WarningCircle size={15} weight="fill" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="px-7 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-900 rounded-full transition-colors active:scale-[0.98]"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-slate-900 text-white text-sm rounded-full font-medium hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? '保存中…' : initial ? '保存修改' : '保存日记'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
