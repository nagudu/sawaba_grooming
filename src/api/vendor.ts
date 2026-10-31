import { API_BASE } from './index'

/** Vendor portal API client — separate token namespace from admin/customer. */

const TOKEN_KEY = 'sawaba_vendor_token'

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export function getVendorToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setVendorToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class VendorApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'VendorApiError'
    this.status = status
  }
}

async function vendorFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = getVendorToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new VendorApiError('Unable to reach the server. Please try again.', 0)
  }

  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    body = null
  }
  if (!response.ok || !body || body.success !== true) {
    throw new VendorApiError(body?.message ?? 'Request failed.', response.status)
  }
  return body.data
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VendorProfile {
  id: number
  businessName: string
  contactName: string
  slug: string
  email: string
  phone: string
  logoUrl: string | null
  address: string | null
  location: string | null
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  businessInfo: string | null
  status: string
  statusReason: string | null
  commissionRate: number | null
  rating: number
  approvedAt: string | null
  createdAt: string
}

export interface VendorDashboardData {
  products: { total: number; active: number; outOfStock: number; pendingReview: number }
  orders: { new: number; processing: number; completed: number; cancelled: number; returned: number }
  earnings: { totalSales: number; totalCommission: number; pending: number; available: number; paid: number }
  recentOrders: Array<{
    itemId: number
    orderReference: string
    productName: string
    quantity: number
    lineTotal: number
    status: string
    customerName: string
    createdAt: string
  }>
  notifications: Array<{
    id: number
    type: string
    title: string
    message: string
    readAt: string | null
    createdAt: string
  }>
}

export interface VendorProduct {
  id: number
  name: string
  slug: string
  description: string
  brand: string | null
  price: number
  compareAtPrice: number | null
  stock: number
  lowStockThreshold: number
  status: string
  isActive: boolean
  rating: number
  reviewCount: number
  salesCount: number
  rejectionReason: string | null
  category: { id: number; name: string } | null
  images: Array<{ id: number; url: string; alt: string | null }>
  variations: Array<{ id: number; name: string; value: string; priceDelta: number; stock: number | null }>
  createdAt: string
  updatedAt: string
}

export interface VendorOrderItem {
  id: number
  orderReference: string
  productName: string
  productImage: string | null
  variationLabel: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
  status: string
  trackingInfo: string | null
  cancelReason: string | null
  customerName: string
  customerPhone: string
  deliveryAddress: string
  deliveryLocation: string | null
  orderStatus: string
  paymentStatus: string
  createdAt: string
}

export interface VendorLedgerEntry {
  id: number
  orderReference: string
  productName: string
  quantity: number
  salePrice: number
  commissionRate: number
  commissionAmount: number
  vendorNet: number
  reversedAmount: number
  settlementStatus: string
  releasedAt: string | null
  paidAt: string | null
  createdAt: string
}

export interface VendorEarnings {
  balances: { pending: number; available: number; paid: number; reversed: number }
  bankDetails: { bankName: string | null; accountName: string | null; accountNumber: string | null }
  releaseDelayDays: number
  entries: { items: VendorLedgerEntry[]; total: number; page: number; perPage: number }
  payouts: Array<{
    id: number
    referenceCode: string
    amount: number
    status: string
    note: string | null
    transactionRef: string | null
    requestedAt: string
    processedAt: string | null
  }>
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const vendorApi = {
  register: (input: {
    businessName: string
    contactName: string
    email: string
    phone: string
    password: string
    address?: string
    location?: string
    bankName?: string
    bankAccountName?: string
    bankAccountNumber?: string
    businessInfo?: string
  }) => vendorFetch<{ message: string }>('/api/vendor/register', { method: 'POST', body: JSON.stringify(input) }),

  login: (identifier: string, password: string) =>
    vendorFetch<{ token: string; vendor: VendorProfile }>('/api/vendor/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  me: () => vendorFetch<VendorProfile>('/api/vendor/me'),

  updateProfile: (patch: Partial<{
    contactName: string
    phone: string
    address: string
    location: string
    bankName: string
    bankAccountName: string
    bankAccountNumber: string
    businessInfo: string
  }>) => vendorFetch<VendorProfile>('/api/vendor/me', { method: 'PATCH', body: JSON.stringify(patch) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    vendorFetch<Record<string, never>>('/api/vendor/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  dashboard: () => vendorFetch<VendorDashboardData>('/api/vendor/dashboard'),

  notifications: () => vendorFetch<VendorDashboardData['notifications']>('/api/vendor/notifications'),
  readNotification: (id: number) =>
    vendorFetch<Record<string, never>>(`/api/vendor/notifications/${id}/read`, { method: 'POST' }),

  products: (params: { page?: number; perPage?: number; status?: string; search?: string }) =>
    vendorFetch<Paged<VendorProduct>>(`/api/vendor/products${qs(params)}`),

  createProduct: (form: FormData) =>
    vendorFetch<VendorProduct>('/api/vendor/products', { method: 'POST', body: form }),

  updateProduct: (id: number, form: FormData) =>
    vendorFetch<VendorProduct>(`/api/vendor/products/${id}`, { method: 'PUT', body: form }),

  toggleProduct: (id: number, isActive: boolean) =>
    vendorFetch<VendorProduct>(`/api/vendor/products/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  deleteProduct: (id: number) =>
    vendorFetch<Record<string, never>>(`/api/vendor/products/${id}`, { method: 'DELETE' }),

  orders: (params: { page?: number; perPage?: number; status?: string; search?: string }) =>
    vendorFetch<Paged<VendorOrderItem>>(`/api/vendor/orders${qs(params)}`),

  updateOrderItem: (
    itemId: number,
    input: { status: string; trackingInfo?: string; cancelReason?: string },
  ) =>
    vendorFetch<VendorOrderItem>(`/api/vendor/orders/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  earnings: (params: { page?: number; perPage?: number; settlementStatus?: string }) =>
    vendorFetch<VendorEarnings>(`/api/vendor/earnings${qs(params)}`),

  requestPayout: (amount: number, note?: string) =>
    vendorFetch<{ message: string }>('/api/vendor/payouts', {
      method: 'POST',
      body: JSON.stringify({ amount, note }),
    }),
}
