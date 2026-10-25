import type { RouteCreateDTO, RouteHot, RouteTrack, RouteTrackDetail } from './types'

const SUCCESS_CODE = 200

/** 非 JSON 响应（nginx 限流 429 / 网关 503 等 HTML 错误页）的状态码友好文案 */
function statusMessage(status: number): string {
  if (status === 429) return '操作过于频繁，请稍后再试'
  if (status === 503) return '服务暂时不可用，请稍后再试'
  return `请求失败（HTTP ${status}）`
}

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
    // 只在不在登录页时跳转：带 expired 标记驱动「登录已过期」提示；已在登录页只抛错
    // （App 会清本地登录态）。若此处无条件跳转，登录页挂载仍调 /user/me → 401 → 再跳，
    // 与 AuthPage 清理后的 /login 不同 URL 会整页重载，形成刷新循环
    if (window.location.pathname !== '/login') {
      sessionStorage.setItem(REDIRECT_KEY, window.location.pathname)
      window.location.href = '/login?expired=1'
    }
    throw new Error('未登录，请先登录')
  }
  // 非 JSON 响应体（如 nginx 限流 429 / 网关 503 的 HTML 错误页）：res.json() 会抛
  // SyntaxError 变成通用错误，这里按状态码给出友好文案
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(statusMessage(res.status))
  }
  let result
  try {
    result = await res.json()
  } catch {
    throw new Error(statusMessage(res.status))
  }
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

  /** GET /routes/hot 常走路线 Top N（按徒步日记引用次数聚合；limit 缺省 5，后端钳制 1~20） */
  hot: (limit?: number) => {
    const qs = limit == null ? '' : `?limit=${limit}`
    return request<RouteHot[]>(`/routes/hot${qs}`)
  },
}
