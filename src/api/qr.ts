import { api, buildQuery, type Paged } from './index'
import type { QrScanHistoryEntry, QrScanResult } from './qrTypes'

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
  /** Admin scanner: validate any booking QR/reference (full detail incl. receipt). */
  adminValidate: async (input: { token?: string; reference?: string }): Promise<QrScanResult> => {
    const data = await api.post<{ result: QrScanResult }>('/api/admin/qr/validate', input)
    return data.result
  },
  /** Admin scanner: confirm a customer's arrival. Never changes payment status. */
  adminCheckIn: async (appointmentId: number, token?: string): Promise<QrScanResult> => {
    const data = await api.post<{ result: QrScanResult }>('/api/admin/qr/checkin', {
      appointmentId,
      token,
    })
    return data.result
  },
  /** Recent scan/check-in history for one appointment. */
  appointmentHistory: (appointmentId: number) =>
    api.get<QrScanHistoryEntry[]>(`/api/admin/qr/appointments/${appointmentId}/history`),

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
