/** 各业务模块共享的统一请求封装（train/route/body 模块各有一份本地副本，历史保留不动） */

const SUCCESS_CODE = 200

/** 非 JSON 响应（nginx 限流 429 / 网关 503 等 HTML 错误页）的状态码友好文案 */
function statusMessage(status: number): string {
  if (status === 429) return '操作过于频繁，请稍后再试'
  if (status === 503) return '服务暂时不可用，请稍后再试'
  return `请求失败（HTTP ${status}）`
}

/** 与 App.tsx 的 REDIRECT_KEY 同一 key：登录后回跳目标页（请求层无法 import 组件层，故各自定义、保持字面量一致） */
export const REDIRECT_KEY = 'hikingalone.redirect'

/** 统一请求：校验 Result.code，非 200 抛后端 message，HTTP 失败抛网络错误；no-store 避免 GET 命中缓存导致提交后数据不刷新；
 *  credentials: 'include' 携带 HttpSession Cookie，后端从会话取当前登录用户 */
export async function request<T>(url: string, options?: RequestInit): Promise<T> {
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

/** GET 拼 query（undefined/null 跳过） */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}
