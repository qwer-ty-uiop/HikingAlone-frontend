/** 各业务模块共享的统一请求封装（train/route/body 模块各有一份本地副本，历史保留不动） */

const SUCCESS_CODE = 200

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

/** GET 拼 query（undefined/null 跳过） */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}
