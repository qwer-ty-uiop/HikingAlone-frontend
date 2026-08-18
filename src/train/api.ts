import type {
  HeatmapData,
  PlanAbandonDTO,
  PlanCreateDTO,
  PlanDeleteDTO,
  PlanUpdateDTO,
  RecordCreateDTO,
  RecordUpdateDTO,
  TrainHomeData,
  TrainingPlan,
  TrainingPlanDetail,
} from './types'

const SUCCESS_CODE = 200

/** 统一请求：校验 Result.code，非 200 抛后端 message，HTTP 失败抛网络错误；no-store 避免 GET 命中缓存导致提交后数据不刷新 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
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

  /** POST /train/plans/update 编辑计划（含训练项整表替换） */
  updatePlan: (dto: PlanUpdateDTO) =>
    request<null>('/train/plans/update', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /train/plans/abandon 放弃计划（置状态已放弃） */
  abandonPlan: (dto: PlanAbandonDTO) =>
    request<null>('/train/plans/abandon', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /train/plans/delete 物理删除计划（级联清理全部记录，不可恢复） */
  deletePlan: (dto: PlanDeleteDTO) =>
    request<null>('/train/plans/delete', { method: 'POST', body: JSON.stringify(dto) }),

  /** GET /train/plans 计划列表（含进度） */
  getPlans: () => request<TrainingPlan[]>('/train/plans'),

  /** GET /train/plans/{id} 计划详情 */
  getPlanDetail: (id: number) => request<TrainingPlanDetail>(`/train/plans/${id}`),

  /** POST /train/records 提交训练项当天完成情况 */
  submitRecord: (dto: RecordCreateDTO) =>
    request<null>('/train/records', { method: 'POST', body: JSON.stringify(dto) }),

  /** POST /train/records/update 编辑单条打卡记录（仅完成量） */
  updateRecord: (dto: RecordUpdateDTO) =>
    request<null>('/train/records/update', { method: 'POST', body: JSON.stringify(dto) }),

  /** GET /train/heatmap?year= 训练热力图 */
  getHeatmap: (year: number) => request<HeatmapData>(`/train/heatmap?year=${year}`),
}
