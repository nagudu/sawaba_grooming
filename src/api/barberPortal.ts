import { ApiError, API_BASE } from './index'

/**
 * Barber Portal API — every call is authenticated with the barber's own JWT
 * and the backend scopes all data to that barber. No barberId is ever sent
 * from the client; the server derives it from the token.
 */

const TOKEN_KEY = 'barber_token'

export function getBarberToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setBarberToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearBarberToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export interface BarberProfile {
  id: number
  name: string
  image: string | null
  email: string | null
  phone: string | null
  specialty: string | null
  barberType: 'INTERNAL' | 'EXTERNAL'
  location: string | null
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionValue: number
  portalEnabled: boolean
  hasPortalPassword: boolean
}

export interface PortalAppointment {
  id: number
  referenceCode: string | null
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  serviceId: number | null
  appointmentDate: string
  appointmentTime: string
  totalAmount: number
  notes: string | null
  status: string
  serviceStartedAt: string | null
  completedAt: string | null
  service?: { id: number; name: string; price: number; duration: number } | null
}

export interface PortalEarning {
  id: number
  appointmentId: number
  referenceCode: string | null
  appointmentDate: string
  appointmentTime: string
  customerName: string
  barberTypeSnapshot: 'INTERNAL' | 'EXTERNAL'
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionRateSnapshot: number
  serviceAmount: number
  commissionAmount: number
  studioAmount: number
  status: 'PENDING' | 'EARNED' | 'PAID' | 'CANCELLED'
  earnedAt: string | null
  paidAt: string | null
}

export interface PortalNotification {
  id: number
  type: 'ASSIGNMENT' | 'EARNING' | 'APPOINTMENT' | 'SYSTEM'
  title: string
  message: string
  readAt: string | null
  createdAt: string
}

export interface PortalAvailability {
  id: number
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

export interface PortalOverview {
  todayCount: number
  daysUpcomingCount: number
  completedCount: number
  pendingCount: number
  todayEarnings: number
  weekEarnings: number
  monthEarnings: number
  totalEarnings: number
  pendingCommission: number
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionValue: number
  unreadCount: number
  dueSoon: PortalAppointment[]
  notifications: PortalNotification[]
}

interface Paged<T> { items: T[]; total: number; page: number; perPage: number }

async function barberFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = getBarberToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('Unable to reach the server. Is the backend running?', 0)
  }

  let body: { success?: boolean; message?: string; data?: T } | null = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok || body?.success === false) {
    throw new ApiError(body?.message ?? 'Request failed.', response.status)
  }
  return body?.data as T
}

export async function barberLogin(identifier: string, password: string): Promise<{ token: string; barber: BarberProfile }> {
  const data = await barberFetch<{ token: string; barber: BarberProfile }>('/api/barber/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
  setBarberToken(data.token)
  return data
}

export async function fetchBarberMe(): Promise<BarberProfile> {
  const data = await barberFetch<{ barber: BarberProfile }>('/api/barber/auth/me')
  return data.barber
}

export async function changeBarberPassword(currentPassword: string, newPassword: string): Promise<void> {
  await barberFetch('/api/barber/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function fetchPortalOverview(): Promise<PortalOverview> {
  const data = await barberFetch<{ overview: PortalOverview }>('/api/barber/portal/overview')
  return data.overview
}

export async function fetchPortalAppointments(params: { status?: string; from?: string; to?: string; page?: number; perPage?: number } = {}): Promise<Paged<PortalAppointment>> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.page) qs.set('page', String(params.page))
  if (params.perPage) qs.set('perPage', String(params.perPage))
  return barberFetch<Paged<PortalAppointment>>(`/api/barber/portal/appointments?${qs.toString()}`)
}

export async function updatePortalAppointmentStatus(appointmentId: number, to: 'IN_PROGRESS' | 'COMPLETED'): Promise<PortalAppointment> {
  const data = await barberFetch<{ appointment: PortalAppointment }>(`/api/barber/portal/appointments/${appointmentId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to }),
  })
  return data.appointment
}

export async function fetchPortalEarnings(params: { earningStatus?: string; page?: number; perPage?: number } = {}): Promise<Paged<PortalEarning>> {
  const qs = new URLSearchParams()
  if (params.earningStatus) qs.set('earningStatus', params.earningStatus)
  if (params.page) qs.set('page', String(params.page))
  if (params.perPage) qs.set('perPage', String(params.perPage))
  return barberFetch<Paged<PortalEarning>>(`/api/barber/portal/earnings?${qs.toString()}`)
}

export async function fetchPortalNotifications(params: { page?: number; perPage?: number } = {}): Promise<Paged<PortalNotification> & { unreadCount: number }> {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.perPage) qs.set('perPage', String(params.perPage))
  return barberFetch<Paged<PortalNotification> & { unreadCount: number }>(`/api/barber/portal/notifications?${qs.toString()}`)
}

export async function markPortalNotificationsRead(notificationId?: number): Promise<void> {
  await barberFetch('/api/barber/portal/notifications/read', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notificationId ? { notificationId } : {}),
  })
}

export async function fetchPortalAvailability(): Promise<PortalAvailability[]> {
  const data = await barberFetch<{ availability: PortalAvailability[] }>('/api/barber/portal/availability')
  return data.availability
}

export async function savePortalAvailability(entries: Array<{ dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }>): Promise<PortalAvailability[]> {
  const data = await barberFetch<{ availability: PortalAvailability[] }>('/api/barber/portal/availability', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries),
  })
  return data.availability
}
