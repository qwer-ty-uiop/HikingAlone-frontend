import { request } from '../api/request'
import type { Dashboard } from './types'

export const profileApi = {
  /** GET /profile/dashboard 驾驶舱聚合（今日打卡/待办提醒/概览/连续/最近日记/进行中目标） */
  dashboard: () => request<Dashboard>('/profile/dashboard'),
}
