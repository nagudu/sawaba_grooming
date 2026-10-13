import { api, buildQuery, type Paged } from './index'

export interface QrScanLogItem {
  id: number
  appointmentId: number | null
  referenceCode: string | null
  customerName: string | null
  barberId: number | null
  barberName: string | null
  adminId: number | null
  actorRole: string
  outcome: string
  source: string
  ip: string | null
  detail: string | null
  createdAt: string
}

export interface QrActivityStats {
  total: number
  valid: number
  rejected: number
  checkIns: number
  last7Days: number
}

export interface QrActivityResponse extends Paged<QrScanLogItem> {
  stats: QrActivityStats
}

export interface QrActivityParams {
  outcome?: string
  source?: string
  barberId?: number
  appointmentId?: number
  from?: string
  to?: string
  page?: number
  perPage?: number
}

export const qrApi = {
  activity: (params: QrActivityParams = {}) =>
    api.get<QrActivityResponse>(
      `/api/admin/qr/activity${buildQuery(params as Record<string, string | number | undefined>)}`,
    ),
  regenerate: (appointmentId: number) =>
    api.post<{
      appointmentId: number
      referenceCode: string | null
      qrToken: string
      qrPayload: string
    }>('/api/admin/qr/regenerate', { appointmentId }),
  revoke: (appointmentId: number) =>
    api.post<{ appointmentId: number }>('/api/admin/qr/revoke', { appointmentId }),
}
