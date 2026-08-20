/**
 * 用户模块类型定义，与后端 interfaces/user 系列接口对应
 */

/** 注册请求体（UserCreateDTO：username/password 必填，email 选填） */
export interface UserRegisterDTO {
  username: string
  password: string
  email?: string
}

/** 登录请求体（UserLoginDTO：email 必填，password 必填） */
export interface UserLoginDTO {
  email: string
  password: string
}

/** 修改密码请求体（UserChangePasswordDTO） */
export interface UserChangePasswordDTO {
  email: string
  oldPassword: string
  newPassword: string
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
