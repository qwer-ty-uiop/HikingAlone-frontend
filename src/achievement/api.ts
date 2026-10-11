import { request } from '../api/request'
import type { AchievementGroup } from './types'

export const achievementApi = {
  /** GET /achievement/all 全部徽章（按分组，实时计算达成状态） */
  all: () => request<AchievementGroup[]>('/achievement/all'),
}
