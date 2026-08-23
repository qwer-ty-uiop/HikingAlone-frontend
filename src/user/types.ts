/**
 * 用户模块类型定义，与后端 interfaces/user 系列接口对应
 */

/** 注册请求体（UserCreateDTO：username/password/email/code 必填，code 为邮箱验证码） */
export interface UserRegisterDTO {
  username: string
  password: string
  email: string
  code: string
}

/** 发送邮箱验证码请求体（EmailDTO） */
export interface EmailCodeDTO {
  email: string
}

/** 发送验证码返回（EmailSendVO：sent=false 表示冷却中） */
export interface EmailSendResult {
  sent: boolean
}

/** 登录请求体（UserLoginDTO：email 必填，password 必填） */
export interface UserLoginDTO {
  email: string
  password: string
}

/** 修改密码请求体（UserChangePasswordDTO：email 必填，code 为邮箱验证码） */
export interface UserChangePasswordDTO {
  email: string
  oldPassword: string
  newPassword: string
  code: string
}

/** 注册返回（UserCreateVO） */
export interface UserCreateResult {
  email: string
  username: string
}

/** 登录返回（UserLoginVO） */
export interface UserLoginResult {
  email: string
}
