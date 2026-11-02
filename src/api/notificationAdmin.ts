import { api, buildQuery } from './index'

export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP'
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED'

export const NOTIFICATION_EVENTS = [
  'WELCOME',
  'BOOKING_CONFIRMATION',
  'BOOKING_REMINDER',
  'BOOKING_STATUS',
  'BOOKING_CANCELLED',
  'ORDER_CONFIRMATION',
  'ORDER_STATUS',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'ORDER_CANCELLED',
  'REFUND_UPDATE',
] as const
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number] | 'TEST'

export const NOTIFICATION_CHANNELS: NotificationChannel[] = ['EMAIL', 'SMS', 'WHATSAPP']

export const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  WELCOME: 'Registration / welcome',
  BOOKING_CONFIRMATION: 'Booking confirmation',
  BOOKING_REMINDER: 'Appointment reminder',
  BOOKING_STATUS: 'Booking status change',
  BOOKING_CANCELLED: 'Booking cancelled',
  ORDER_CONFIRMATION: 'Order confirmation',
  ORDER_STATUS: 'Order status update',
  PAYMENT_SUCCESS: 'Payment success / verified',
  PAYMENT_FAILED: 'Payment failed / rejected',
  ORDER_CANCELLED: 'Order cancelled',
  REFUND_UPDATE: 'Refund update',
  TEST: 'Test notification',
}

export interface NotificationSettings {
  emailEnabled: boolean
  smsEnabled: boolean
  whatsappEnabled: boolean
  smsProvider: string
  smsSenderId: string | null
  smsBaseUrl: string | null
  hasSmsApiKey: boolean
  smsApiKeyLast4: string | null
  whatsappPhoneNumberId: string | null
  whatsappDisplayNumber: string | null
  whatsappApiVersion: string | null
  hasWhatsappToken: boolean
  whatsappTokenLast4: string | null
  emailProvider: 'resend' | 'smtp' | string
  fromEmail: string | null
  hasEmailApiKey: boolean
  emailApiKeyLast4: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpSecure: boolean
  hasSmtpPassword: boolean
  smtpPasswordLast4: string | null
  eventChannels: Record<string, NotificationChannel[]> | null
  isEmailConfigured: boolean
  isSmsConfigured: boolean
  isWhatsAppConfigured: boolean
  isEncryptionConfigured: boolean
  updatedAt: string | null
}

/** Editable payload — secrets are only included when the admin types a new value. */
export interface NotificationSettingsUpdate {
  emailEnabled?: boolean
  smsEnabled?: boolean
  whatsappEnabled?: boolean
  smsProvider?: string
  smsApiKey?: string
  smsSenderId?: string | null
  smsBaseUrl?: string | null
  whatsappPhoneNumberId?: string | null
  whatsappToken?: string
  whatsappDisplayNumber?: string | null
  whatsappApiVersion?: string | null
  emailProvider?: string
  emailApiKey?: string
  fromEmail?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
  smtpPassword?: string
  smtpSecure?: boolean
  eventChannels?: Record<string, NotificationChannel[]> | null
}

export interface NotificationTemplate {
  id: number
  name: string
  event: NotificationEvent
  channel: NotificationChannel
  subject: string
  body: string
  isActive: boolean
  updatedAt: string
}

export interface NotificationHistoryRow {
  id: number
  customerId: number | null
  customer: { id: number; fullName: string; phone: string; email: string | null } | null
  appointmentId: number | null
  orderId: number | null
  type: string
  channel: NotificationChannel
  title: string
  message: string
  status: NotificationStatus
  provider: string | null
  providerMessageId: string | null
  error: string | null
  sentAt: string | null
  createdAt: string
}

export interface PagedNotifications {
  items: NotificationHistoryRow[]
  total: number
  page: number
  perPage: number
}

export const notificationAdminApi = {
  getSettings: () => api.get<NotificationSettings>('/api/admin/notifications/settings'),
  updateSettings: (input: NotificationSettingsUpdate) =>
    api.put<NotificationSettings>('/api/admin/notifications/settings', input),
  templates: () => api.get<NotificationTemplate[]>('/api/admin/notifications/templates'),
  upsertTemplate: (input: {
    name: string
    event: string
    channel: NotificationChannel
    subject: string
    body: string
    isActive?: boolean
  }) => api.put<{ ok: boolean }>('/api/admin/notifications/templates', input),
  history: (params: {
    status?: NotificationStatus
    channel?: NotificationChannel
    event?: string
    page?: number
    perPage?: number
  }) => api.get<PagedNotifications>(`/api/admin/notifications/history${buildQuery(params)}`),
  sendTest: (input: { channel: NotificationChannel; customerId?: number | null }) =>
    api.post<{ ok: boolean; status?: string }>('/api/admin/notifications/test', input),
  retry: (id: number) => api.post<{ ok: boolean; status?: string }>(`/api/admin/notifications/${id}/retry`),
}
