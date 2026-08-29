import type { RouteCreateDTO, RouteTrack, RouteTrackDetail } from './types'

const SUCCESS_CODE = 200

/** 与 App.tsx 的 REDIRECT_KEY 同一 key：登录后回跳目标页（请求层无法 import 组件层，故各自定义、保持字面量一致） */
const REDIRECT_KEY = 'hikingalone.redirect'

/** 统一请求：校验 Result.code，非 200 抛后端 message，HTTP 失败抛网络错误；
 *  credentials: 'include' 携带 HttpSession Cookie，/routes 接口从会话取当前登录用户 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    ...options,
  })
  // 401 未登录：会话缺失/过期，记下当前页供登录后回跳，再跳登录页
  if (res.status === 401) {
    if (window.location.pathname !== '/login') {
      sessionStorage.setItem(REDIRECT_KEY, window.location.pathname)
    }
    window.location.href = '/login'
    throw new Error('未登录，请先登录')
  }
  const result = await res.json()
  if (result.code !== SUCCESS_CODE) {
    throw new Error(result.message || '请求失败')
  }
  return result.data as T
}

export const routeApi = {
  /** GET /routes 我的路线列表（摘要） */
  list: () => request<RouteTrack[]>('/routes'),

  /** GET /routes/{id} 路线详情（含轨迹点） */
  get: (id: number) => request<RouteTrackDetail>(`/routes/${id}`),

  /** POST /routes 上传/创建路线（里程/时长/爬升由后端领域层计算），返回新路线 id */
  create: (dto: RouteCreateDTO) =>
    request<number>('/routes', { method: 'POST', body: JSON.stringify(dto) }),

  /** DELETE /routes/{id} 删除路线 */
  remove: (id: number) => request<null>(`/routes/${id}`, { method: 'DELETE' }),
}
