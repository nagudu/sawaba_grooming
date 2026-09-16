import { API_BASE } from './index'

const TOKEN_KEY = 'sawaba_customer_token'

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export interface CustomerProfile {
  id: number
  customerCode: string
  fullName: string
  phone: string
  email: string | null
  avatarUrl: string | null
  preferredBarberId: number | null
  favoriteServiceId: number | null
  reminderOptIn: boolean
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface CustomerStats {
  totalAppointments: number
  completed: number
  cancelled: number
  pending: number
  totalSpent: number
}

export interface UsualService {
  service: { id: number; name: string; price: number }
  timesBooked: number
  lastBooked: string
  appointmentId: number
  barberId: number
  isFavorite: boolean
}

export interface CustomerSummary {
  customer: CustomerProfile
  stats: CustomerStats
  upcoming: import('./index').AppointmentItem[]
  upcomingCount: number
  recent: import('./index').AppointmentItem[]
  usual: UsualService | null
}

export interface CustomerPaymentItem {
  id: number
  appointmentId: number
  accessToken: string
  referenceCode: string | null
  customerName: string
  serviceName: string | null
  servicePrice: number | null
  barberName: string | null
  appointmentDate: string | null
  appointmentTime: string | null
  amount: number
  paymentMethod: import('./index').PaymentMethod | null
  transactionReference: string | null
  paymentDate: string | null
  status: import('./index').PaymentStatus
  receiptUrl: string | null
  verifiedAt: string | null
  createdAt: string
}

export interface BookingPrefill {
  fullName: string
  phone: string
  email: string | null
  usualService: { id: number; name: string; price: number; duration: number } | null
  usualBarberId: number | null
  preferredBarberId: number | null
  recentServiceIds: number[]
}

export function getCustomerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setCustomerToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class AccountError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AccountError'
    this.status = status
  }
}

async function accountFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getCustomerToken()
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new AccountError('Unable to reach the server. Please try again.', 0)
  }
  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    body = null
  }
  if (!response.ok || !body || body.success !== true) {
    // An expired customer session silently logs out (but never hijacks admin pages).
    if (response.status === 401 && !path.startsWith('/account/otp')) {
      setCustomerToken(null)
    }
    throw new AccountError(body?.message ?? 'Request failed.', response.status)
  }
  return body.data
}

export const accountApi = {
  requestOtp: (phone: string) =>
    accountFetch<{ found: boolean; message: string; devCode: string | null }>('/api/account/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (phone: string, code: string) =>
    accountFetch<{ token: string; customer: CustomerProfile }>('/api/account/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  register: (input: { fullName: string; phone: string; email?: string; password?: string }) =>
    accountFetch<{ token: string; customer: CustomerProfile }>('/api/account/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  loginPassword: (phone: string, password: string) =>
    accountFetch<{ token: string; customer: CustomerProfile }>('/api/account/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),
  me: () => accountFetch<{ customer: CustomerProfile }>('/api/account/me'),
  updateProfile: (
    patch: Partial<{
      fullName: string
      email: string | null
      avatarUrl: string | null
      preferredBarberId: number | null
      favoriteServiceId: number | null
      reminderOptIn: boolean
    }>,
  ) =>
    accountFetch<{ customer: CustomerProfile }>('/api/account/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  changePassword: (currentPassword: string | null, newPassword: string) =>
    accountFetch<Record<string, never>>('/api/account/me/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: currentPassword ?? undefined, newPassword }),
    }),
  prefill: () => accountFetch<BookingPrefill>('/api/account/booking-prefill'),
  summary: () => accountFetch<CustomerSummary>('/api/account/summary'),
  appointments: (page = 1) =>
    accountFetch<{ items: import('./index').AppointmentItem[]; total: number; page: number; perPage: number }>(
      `/api/account/appointments?page=${page}`,
    ),
  payments: (page = 1) =>
    accountFetch<{ items: CustomerPaymentItem[]; total: number; page: number; perPage: number }>(
      `/api/account/payments?page=${page}`,
    ),
  cancelAppointment: (id: number, reason: string | null) =>
    accountFetch<{ appointment: import('./index').AppointmentItem }>(
      `/api/account/appointments/${id}/cancel`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  getAppointment: (id: number) =>
    accountFetch<import('./index').AppointmentItem>(
      `/api/account/appointments/${id}`,
    ),
}
