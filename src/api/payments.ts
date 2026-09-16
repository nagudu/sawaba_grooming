import { API_BASE, type AppointmentStatus, type PaymentMethod, type PaymentStatus } from './index'

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export interface PaymentAppointment {
  id: number
  referenceCode: string | null
  customerName: string
  customerPhone: string
  customerEmail: string | null
  appointmentDate: string
  appointmentTime: string
  totalAmount: number
  status: AppointmentStatus
  service: { id: number; name: string; price: number; duration: number } | null
  barber: { id: number; name: string; image: string | null } | null
}

export interface PaymentItem {
  id: number
  appointmentId: number
  amount: number
  paymentMethod: PaymentMethod | null
  transactionReference: string | null
  paymentDate: string | null
  receiptUrl: string | null
  note: string | null
  status: PaymentStatus
  rejectionReason: string | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
  accessToken: string
  appointment?: PaymentAppointment
}

export interface PaymentSettings {
  shopName: string
  shopAddress: string | null
  shopPhone: string | null
  shopLogo: string | null
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  opayAccountName: string | null
  opayAccountNumber: string | null
  paymentInstructions: string | null
  enabledPaymentMethods: PaymentMethod[]
  minAmount: number
  fullPaymentRequired: boolean
  receiptRequired: boolean
  onlinePaymentEnabled: boolean
}

export interface PublicPaymentBundle {
  payment: PaymentItem
  settings: PaymentSettings
}

export interface SubmitPaymentPayload {
  paymentMethod: PaymentMethod
  amountPaid: number
  transactionReference: string
  paymentDate: string
  note?: string | null
}

export interface TrackPaymentPayload {
  appointmentId: string
  phone: string
}

export interface PaystackInitResult {
  authorizationUrl: string
  accessCode: string
  reference: string
}

async function paymentsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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

export function fetchPaymentSettings(): Promise<PaymentSettings> {
  return paymentsRequest<PaymentSettings>('/api/payments/settings')
}

export function fetchPayment(token: string): Promise<PublicPaymentBundle> {
  return paymentsRequest<PublicPaymentBundle>(`/api/payments/${encodeURIComponent(token)}`)
}

export function trackPayment(payload: TrackPaymentPayload): Promise<PublicPaymentBundle> {
  return paymentsRequest<PublicPaymentBundle>('/api/payments/track', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Starts a Paystack checkout for this payment; returns the hosted checkout URL. */
export function initializePaystack(token: string): Promise<PaystackInitResult> {
  return paymentsRequest<PaystackInitResult>(
    `/api/payments/paystack/initialize/${encodeURIComponent(token)}`,
    { method: 'POST' },
  )
}

/** Server-side verification: asks our backend, which re-checks with Paystack itself. */
export function verifyPaystack(token: string, reference: string): Promise<PublicPaymentBundle> {
  return paymentsRequest<PublicPaymentBundle>(
    `/api/payments/paystack/verify/${encodeURIComponent(token)}`,
    { method: 'POST', body: JSON.stringify({ reference }) },
  )
}

export function submitPayment(
  token: string,
  payload: SubmitPaymentPayload,
  receiptFile: File | null,
): Promise<PublicPaymentBundle> {
  const form = new FormData()
  form.set('paymentMethod', payload.paymentMethod)
  form.set('amountPaid', String(payload.amountPaid))
  form.set('transactionReference', payload.transactionReference)
  form.set('paymentDate', payload.paymentDate)
  if (payload.note) form.set('note', payload.note)
  if (receiptFile) form.set('receipt', receiptFile)

  return paymentsRequest<PublicPaymentBundle>(`/api/payments/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    body: form,
  })
}

/** Declares "I will pay cash at the salon" — method recorded, status stays UNPAID. */
export function declareCashPayment(token: string, note?: string): Promise<PublicPaymentBundle> {
  return paymentsRequest<PublicPaymentBundle>(
    `/api/payments/${encodeURIComponent(token)}/cash`,
    { method: 'POST', body: JSON.stringify({ note: note ?? 'Pay at the salon' }) },
  )
}

/** Same as submitPayment but reports real upload progress (0-100) via XHR. */
export function submitPaymentWithProgress(
  token: string,
  payload: SubmitPaymentPayload,
  receiptFile: File | null,
  onProgress: (percent: number) => void,
): Promise<PublicPaymentBundle> {
  const form = new FormData()
  form.set('paymentMethod', payload.paymentMethod)
  form.set('amountPaid', String(payload.amountPaid))
  form.set('transactionReference', payload.transactionReference)
  form.set('paymentDate', payload.paymentDate)
  if (payload.note) form.set('note', payload.note)
  if (receiptFile) form.set('receipt', receiptFile)

  return new Promise<PublicPaymentBundle>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/payments/${encodeURIComponent(token)}/submit`)
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
      }
    })
    xhr.addEventListener('load', () => {
      try {
        const body = JSON.parse(xhr.responseText) as ApiEnvelope<PublicPaymentBundle>
        if (xhr.status >= 200 && xhr.status < 300 && body.success === true) {
          onProgress(100)
          resolve(body.data)
        } else {
          reject(new Error(body?.message ?? 'Something went wrong. Please try again.'))
        }
      } catch {
        reject(new Error('Something went wrong. Please try again.'))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Unable to reach the server. Please try again.')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')))
    xhr.send(form)
  })
}