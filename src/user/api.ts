import type {
  EmailCodeDTO,
  EmailSendResult,
  UserChangePasswordDTO,
  UserCreateResult,
  UserLoginDTO,
  UserLoginResult,
  UserRegisterDTO,
} from './types'

const SUCCESS_CODE = 200

/** 统一请求：校验 Result.code，非 200 抛后端 message，HTTP 失败抛网络错误；
 *  credentials: 'include' 携带 HttpSession Cookie（JSESSIONID），登录后 /train 等接口从会话取当前用户 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    ...options,
  })
  const result = await res.json()
  if (result.code !== SUCCESS_CODE) {
    throw new Error(result.message || '请求失败')
  }
  return result.data as T
}

export const userApi = {
  /** POST /email/code 发送邮箱验证码（sent=false 表示 60s 冷却中） */
  sendCode: (dto: EmailCodeDTO) =>
    request<EmailSendResult>('/email/code', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /user/register 注册，返回邮箱与用户名（需先获取并填写邮箱验证码） */
  register: (dto: UserRegisterDTO) =>
    request<UserCreateResult>('/user/register', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /user/login 登录，返回邮箱；成功后建立服务端会话 */
  login: (dto: UserLoginDTO) =>
    request<UserLoginResult>('/user/login', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /user/forget 修改密码（旧密码校验 + 新密码覆盖） */
  changePassword: (dto: UserChangePasswordDTO) =>
    request<null>('/user/forget', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /user/logout 登出，使服务端会话失效 */
  logout: () => request<null>('/user/logout', { method: 'POST' }),
}
