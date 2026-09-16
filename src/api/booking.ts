import { API_BASE, type AppointmentItem, type BarberItem, type Paged, type ServiceItem } from './index'

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export interface BookingPayload {
  customerName: string
  customerPhone: string
  customerEmail: string | null
  serviceId: number
  barberId: number
  appointmentDate: string
  appointmentTime: string
  notes: string | null
}

async function bookingRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    throw new Error('Unable to reach the server. Please try again.')
  }

  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    body = null
  }

  if (!response.ok || !body || body.success !== true) {
    throw new Error(body?.message ?? 'Something went wrong. Please try again.')
  }

  return body.data
}

export function fetchBookingServices(): Promise<Paged<ServiceItem>> {
  return bookingRequest<Paged<ServiceItem>>('/api/services?perPage=100')
}

export function fetchBookingBarbers(): Promise<Paged<BarberItem>> {
  return bookingRequest<Paged<BarberItem>>('/api/barbers?perPage=100')
}

export interface BookingResult {
  appointment: AppointmentItem
  payment: { id: number; accessToken: string; amount: number; status: string }
}

export function submitBookingRequest(payload: BookingPayload): Promise<BookingResult> {
  return bookingRequest<BookingResult>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function to24Hour(time12h: string): string {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time12h.trim())
  if (!match) return time12h
  let hours = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hours += 12
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}