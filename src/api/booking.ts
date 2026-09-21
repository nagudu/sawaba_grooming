import { API_BASE, type AppointmentItem, type BarberItem, type PaymentMethod, type Paged, type ServiceItem } from './index'
import { cachedJson } from './offlineCache'

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
  paymentMethod: PaymentMethod
  transactionReference?: string
}

/** Multipart booking — carries the receipt file for transfer/OPAY methods. */
export interface BookingPayloadWithReceipt extends BookingPayload {
  receiptFile: File | null
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
  return cachedJson('booking:services', () => bookingRequest<Paged<ServiceItem>>('/api/services?perPage=100'))
}

export function fetchBookingBarbers(): Promise<Paged<BarberItem>> {
  return cachedJson('booking:barbers', () => bookingRequest<Paged<BarberItem>>('/api/barbers?perPage=100'))
}

/** A bookable time slot as served by the backend availability API. */
export interface AvailabilitySlot {
  time: string
  endTime: string
  available: boolean
}

export interface AvailabilityResult {
  barberId: number
  date: string
  duration: number
  slots: AvailabilitySlot[]
}

/**
 * Real availability for one barber on one date — computed from the barber's
 * working hours and existing bookings, filtered to the service duration.
 */
export function fetchAvailability(barberId: number, date: string, serviceId?: number): Promise<AvailabilityResult> {
  const params = new URLSearchParams({ barberId: String(barberId), date })
  if (serviceId) params.set('serviceId', String(serviceId))
  return bookingRequest<AvailabilityResult>(`/api/availability?${params.toString()}`)
}

export interface BookingResult {
  appointment: AppointmentItem
  payment: { id: number; accessToken: string; amount: number; status: string }
}

// ─── Checkout sessions (payment-before-booking) ────────────────────────────────

/** A temporary checkout session — NOT an appointment until the payment condition is satisfied. */
export interface CheckoutSessionInfo {
  sessionToken: string
  totalAmount: number
  serviceName: string | null
  barberName: string | null
  appointmentDate: string
  appointmentTime: string
  status: 'OPEN' | 'AWAITING_PAYMENT' | 'CONVERTED' | 'EXPIRED'
  paystackReference: string | null
}

export interface CheckoutFinalized {
  appointment: {
    id: number
    referenceCode: string | null
    status: string
    customerName: string
    appointmentDate: string
    appointmentTime: string
  }
  payment: { id: number; accessToken: string; amount: number; status: string }
  sessionToken: string
}

export interface CreateCheckoutPayload {
  customerName: string
  customerPhone: string
  customerEmail: string | null
  serviceId: number
  barberId: number
  /** Customer's area/state — helps admin pick the right barber. Optional. */
  customerLocation: string | null
  appointmentDate: string
  appointmentTime: string
  notes: string | null
  paymentMethod: PaymentMethod
  transactionReference?: string
  receiptFile: File | null
}

/**
 * Stages the booking as a temporary session (creates NO appointment/payment).
 * Transfer methods must carry their receipt here; cash carries nothing.
 */
export function createCheckoutSession(payload: CreateCheckoutPayload): Promise<CheckoutSessionInfo> {
  const { receiptFile, ...fields } = payload
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined && value !== '') form.set(key, String(value))
  }
  if (receiptFile) form.set('receipt', receiptFile)
  return bookingRequest<CheckoutSessionInfo>('/api/checkout', { method: 'POST', body: form })
}

/** Converts the session into a real appointment — CASH and receipt-backed transfers only. */
export function finalizeCheckout(sessionToken: string): Promise<CheckoutFinalized> {
  return bookingRequest<CheckoutFinalized>(
    `/api/checkout/${encodeURIComponent(sessionToken)}/finalize`,
    { method: 'POST' },
  )
}

/** Abandons the session (Back to Home). Nothing was ever saved as an appointment. */
export function abandonCheckout(sessionToken: string): Promise<void> {
  return bookingRequest<{ abandoned: boolean }>(
    `/api/checkout/${encodeURIComponent(sessionToken)}/abandon`,
    { method: 'POST' },
  ).then(() => undefined)
}

/** Starts the Paystack checkout on the session — no appointment exists yet. */
export function initializeCheckoutPaystack(sessionToken: string): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  return bookingRequest(
    `/api/checkout/${encodeURIComponent(sessionToken)}/paystack/initialize`,
    { method: 'POST' },
  )
}

/** Server-side verification on the session — creates the booking only on Paystack-confirmed success. */
export function verifyCheckoutPaystack(sessionToken: string, reference: string): Promise<CheckoutFinalized> {
  return bookingRequest<CheckoutFinalized>(
    `/api/checkout/${encodeURIComponent(sessionToken)}/paystack/verify`,
    { method: 'POST', body: JSON.stringify({ reference }) },
  )
}

/** Submits the booking as multipart form-data so the receipt rides along. */
export function submitBookingRequest({ receiptFile, ...payload }: BookingPayloadWithReceipt): Promise<BookingResult> {
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined) form.set(key, String(value))
  }
  if (receiptFile) form.set('receipt', receiptFile)
  return bookingRequest<BookingResult>('/api/appointments', {
    method: 'POST',
    body: form,
  })
}

export function to24Hour(time12h: string): string {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time12h.trim())
  if (!match) return time12h
  let hours = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') hours += 12
  return `${String(hours).padStart(2, '0')}:${match[2]}`
}