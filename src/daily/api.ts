import { request, qs } from '../api/request'
import type { DailyCheckinDTO, DailyCheckin, DailyRecent } from './types'

export const dailyApi = {
  /** GET /daily/recent 最近 N 天记录（升序）+ 汇总；days 缺省 30（后端钳制 7~365） */
  recent: (days?: number) => request<DailyRecent>(`/daily/recent${qs({ days })}`),

  /** POST /daily/checkin 打卡（部分更新：只覆盖非 null 字段），返回当天落库后的完整记录 */
  checkin: (dto: DailyCheckinDTO) =>
    request<DailyCheckin>('/daily/checkin', { method: 'POST', body: JSON.stringify(dto) }),
}
