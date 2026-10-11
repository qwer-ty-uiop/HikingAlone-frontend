/** 个人中心（驾驶舱）模块类型定义，与后端 docs/interfaces/profile.md 对应 */

export interface DashboardToday {
  waterCups: number | null
  steps: number | null
  sleepHours: number | null
  sleepQuality: number | null
  checkedIn: boolean
}

export interface DashboardTodo {
  /** JOURNAL_PENDING 轨迹未写日记 / GOAL_BEHIND 目标进度落后 */
  type: string
  message: string
  target: string
}

export interface DashboardHiking {
  totalCount: number
  totalDistanceKm: number
  totalElevationGain: number
  thisYearCount: number
  thisYearDistanceKm: number
}

export interface DashboardStreaks {
  journalStreakMonths: number
  bodyStreakDays: number
}

export interface DashboardJournalItem {
  id: number
  title: string
  hikeDate: string
  distanceKm: number | null
}

export interface DashboardGoalItem {
  id: number
  metricLabel: string
  targetValue: number
  current: number
  percent: number
  unit: string
}

export interface DashboardWish {
  wishCount: number
  plannedCount: number
  doneCount: number
}

export interface DashboardAchievement {
  achievedCount: number
  totalCount: number
}

export interface Dashboard {
  today: DashboardToday
  todos: DashboardTodo[]
  hiking: DashboardHiking
  streaks: DashboardStreaks
  recentJournals: DashboardJournalItem[]
  activeGoals: DashboardGoalItem[]
  wish: DashboardWish
  achievement: DashboardAchievement
}
