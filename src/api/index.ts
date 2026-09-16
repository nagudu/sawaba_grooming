const TOKEN_KEY = 'sawaba_admin_token'

/**
 * Deployed builds point at the hosted API (set VITE_API_URL, no trailing
 * slash). Unset — as in local dev — every call stays same-origin and the
 * Vite proxy handles /api.
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

export interface AdminProfile {
  id: number
  name: string
  email: string
  role: string
  isActive: boolean
}

export interface ServiceItem {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  duration: number
  image: string | null
  category: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface BarberItem {
  id: number
  name: string
  slug: string
  image: string | null
  specialty: string | null
  biography: string | null
  experience: number
  rating: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  services?: Array<{ id: number; name: string; slug: string; price: number; duration: number }>
}

export type AppointmentStatus =
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_SUBMITTED'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_REJECTED'
  | 'READY_FOR_SERVICE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING_VERIFICATION'
  | 'PAID'
  | 'REJECTED'
  | 'REFUNDED'
  | 'CANCELLED'

export type PaymentMethod = 'OPAY' | 'BANK_TRANSFER' | 'CASH' | 'OTHER' | 'ONLINE'

export interface AppointmentItem {
  id: number
  referenceCode: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  customerId: number | null
  serviceId: number
  barberId: number
  appointmentDate: string
  appointmentTime: string
  totalAmount: number
  notes: string | null
  status: AppointmentStatus
  serviceStartedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  cancelledBy: number | null
  createdAt: string
  updatedAt: string
  service?: { id: number; name: string; price: number; duration: number }
  barber?: { id: number; name: string; image: string | null }
  payment?: null | {
    id: number
    status: PaymentStatus
    amount: number
    paymentMethod: PaymentMethod | null
  }
}

export interface GalleryItem {
  id: number
  title: string
  image: string
  category: string
  barberId: number | null
  createdAt: string
  barber?: { id: number; name: string } | null
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface ReviewItem {
  id: number
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  customerImage: string | null
  serviceId: number | null
  serviceName: string | null
  rating: number
  comment: string
  status: ReviewStatus
  isApproved: boolean
  createdAt: string
  updatedAt: string
}

export type ContactStatus = 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED'

export interface ContactReplyItem {
  id: number
  contactMessageId: number
  adminId: number | null
  adminName: string | null
  recipientEmail: string
  subject: string
  message: string
  status: 'SENT' | 'FAILED'
  providerMessageId: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ContactItem {
  id: number
  name: string
  phone: string | null
  email: string
  subject: string | null
  message: string
  isRead: boolean
  status: ContactStatus
  repliedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  replies: ContactReplyItem[]
  replyCount: number
}

export interface ContactThread extends ContactItem {
  emailConfigured: boolean
}

export interface DashboardData {
  totals: {
    appointments: number
    pending: number
    confirmed: number
    completed: number
    cancelled: number
    customers: number
    barbers: number
    services: number
  }
  payments: {
    pendingVerification: number
    paid: number
    rejected: number
    revenue: number
  }
  recentAppointments: Array<{
    id: number
    referenceCode: string | null
    customerName: string
    appointmentDate: string
    appointmentTime: string
    status: string
    service: { id: number; name: string } | null
    barber: { id: number; name: string } | null
  }>
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAdminToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function clearAdminSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('sawaba_admin_profile')
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken()
  const headers = new Headers(options.headers)

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('Unable to reach the server. Is the backend running?', 0)
  }

  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    body = null
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminSession()
      window.location.href = '/admin/login'
    }
    throw new ApiError(body?.message ?? 'Request failed.', response.status)
  }

  if (!body || body.success !== true) {
    throw new ApiError(body?.message ?? 'Unexpected response from server.', response.status)
  }

  return body.data
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown, isForm = false) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: isForm ? (body as FormData) : JSON.stringify(body ?? {}),
    }),
  put: <T>(path: string, body?: unknown, isForm = false) =>
    apiFetch<T>(path, {
      method: 'PUT',
      body: isForm ? (body as FormData) : JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body ?? {}),
    }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}

export const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export function toForm(data: Record<string, unknown>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      form.set(key, value.join(','))
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      form.set(key, String(value))
    } else {
      form.set(key, value as string | Blob)
    }
  }
  return form
}