/** 成就徽章模块类型定义，与后端 docs/interfaces/achievement.md 对应 */

export interface Achievement {
  code: string
  name: string
  description: string
  achieved: boolean
  current: number
  target: number
  progressPercent: number
}

export interface AchievementGroup {
  group: string
  achievements: Achievement[]
}
