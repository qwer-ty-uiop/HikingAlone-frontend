import type { BodyMetricRecord, BodyMetricRecordDTO, BodyMetricRecent } from './types'

const SUCCESS_CODE = 200

/** 与 App.tsx 的 REDIRECT_KEY 同一 key：登录后回跳目标页（请求层无法 import 组件层，故各自定义、保持字面量一致） */
const REDIRECT_KEY = 'hikingalone.redirect'

/** 统一请求：校验 Result.code，非 200 抛后端 message，HTTP 失败抛网络错误；no-store 避免 GET 命中缓存导致提交后数据不刷新；
 *  credentials: 'include' 携带 HttpSession Cookie，/body 接口从会话取当前登录用户 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    ...options,
  })
  // 401 未登录：会话缺失/过期，记下当前页供登录后回跳，再跳登录页
  if (res.status === 401) {
    // 只在不在登录页时跳转：带 expired 标记驱动「登录已过期」提示；已在登录页只抛错
    // （App 会清本地登录态）。若此处无条件跳转，登录页挂载仍调 /user/me → 401 → 再跳，
    // 与 AuthPage 清理后的 /login 不同 URL 会整页重载，形成刷新循环
    if (window.location.pathname !== '/login') {
      sessionStorage.setItem(REDIRECT_KEY, window.location.pathname)
      window.location.href = '/login?expired=1'
    }
    throw new Error('未登录，请先登录')
  }
  const result = await res.json()
  if (result.code !== SUCCESS_CODE) {
    throw new Error(result.message || '请求失败')
  }
  return result.data as T
}

export const bodyApi = {
  /** GET /body/recent 最近 N 天记录（升序）+ 汇总；days 缺省 30（后端钳制 7~365） */
  recent: (days?: number) => {
    const qs = days == null ? '' : `?days=${days}`
    return request<BodyMetricRecent>(`/body/recent${qs}`)
  },

  /** POST /body/record 记录/更新当日身体数据（每日一条，同日重复提交覆盖更新），返回落库后的记录 */
  record: (dto: BodyMetricRecordDTO) =>
    request<BodyMetricRecord>('/body/record', { method: 'POST', body: JSON.stringify(dto) }),
}
