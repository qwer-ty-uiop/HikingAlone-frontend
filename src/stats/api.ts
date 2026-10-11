import { request, qs } from '../api/request'
import type { AvailableYear, YearlyStats } from './types'

export const statsApi = {
  /** GET /stats/annual 年度报告（year 缺省当前年） */
  annual: (year?: number) => request<YearlyStats>(`/stats/annual${qs({ year })}`),

  /** GET /stats/years 可选年份列表 */
  years: () => request<AvailableYear[]>('/stats/years'),
}
