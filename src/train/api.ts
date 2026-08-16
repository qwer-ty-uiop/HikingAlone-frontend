import type {
  HeatmapData,
  PlanCreateDTO,
  RecordCreateDTO,
  TrainHomeData,
  TrainingPlan,
  TrainingPlanDetail,
} from './types'

const SUCCESS_CODE = 200

/** 统一请求：校验 Result.code，非 200 抛后端 message，HTTP 失败抛网络错误 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const result = await res.json()
  if (result.code !== SUCCESS_CODE) {
    throw new Error(result.message || '请求失败')
  }
  return result.data as T
}

export const trainApi = {
  /** GET /train 训练首页聚合 */
  getHome: () => request<TrainHomeData>('/train'),

  /** POST /train/plans 制定训练计划，返回新计划 id */
  createPlan: (dto: PlanCreateDTO) =>
    request<number>('/train/plans', { method: 'POST', body: JSON.stringify(dto) }),

  /** GET /train/plans 计划列表（含进度） */
  getPlans: () => request<TrainingPlan[]>('/train/plans'),

  /** GET /train/plans/{id} 计划详情 */
  getPlanDetail: (id: number) => request<TrainingPlanDetail>(`/train/plans/${id}`),

  /** POST /train/records 提交训练项当天完成情况 */
  submitRecord: (dto: RecordCreateDTO) =>
    request<null>('/train/records', { method: 'POST', body: JSON.stringify(dto) }),

  /** GET /train/heatmap?year= 训练热力图 */
  getHeatmap: (year: number) => request<HeatmapData>(`/train/heatmap?year=${year}`),
}
