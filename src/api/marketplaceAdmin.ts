import { API_BASE, getAdminToken } from './index'

/** Admin marketplace API client (JWT: admin token). */

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export class MarketplaceAdminError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'MarketplaceAdminError'
    this.status = status
  }
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = getAdminToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new MarketplaceAdminError('Unable to reach the server.', 0)
  }

  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    body = null
  }
  if (!response.ok || !body || body.success !== true) {
    throw new MarketplaceAdminError(body?.message ?? 'Request failed.', response.status)
  }
  return body.data
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MarketplaceOverview {
  vendors: { total: number; pending: number; approved: number; suspended: number; rejected: number }
  products: { total: number; active: number; pendingReview: number; outOfStock: number }
  orders: {
    total: number
    awaitingPayment: number
    paymentPendingVerification: number
    paid: number
    processing: number
    delivered: number
    cancelled: number
    refunded: number
  }
  finance: {
    grossSales: number
    successfulPayments: number
    pendingPayments: number
    marketplaceCommission: number
    vendorLiability: number
    completedPayouts: number
    refunds: number
    netMarketplaceRevenue: number
  }
  recentOrders: Array<{
    referenceCode: string
    customerName: string
    totalAmount: number
    status: string
    paymentStatus: string
    createdAt: string
  }>
  pendingVendorApplications: Array<{ id: number; businessName: string; contactName: string; createdAt: string }>
}

export interface AdminVendor {
  id: number
  businessName: string
  contactName: string
  email: string
  phone: string
  status: string
  statusReason: string | null
  commissionRate: number | null
  address: string | null
  location: string | null
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  businessInfo: string | null
  approvedAt: string | null
  createdAt: string
  productCount?: number
  totalSales?: number
}

export interface AdminProduct {
  id: number
  name: string
  slug: string
  description: string
  sku: string | null
  brand: string | null
  price: number
  compareAtPrice: number | null
  stock: number
  status: string
  isActive: boolean
  rating: number
  reviewCount: number
  salesCount: number
  rejectionReason: string | null
  createdAt: string
  vendor: { id: number; businessName: string; status: string; isOfficial: boolean }
  category: { id: number; name: string } | null
  images: Array<{ id: number; url: string }>
}

export interface AdminCategory {
  id: number
  name: string
  slug: string
  description: string | null
  commissionRate: number | null
  isActive: boolean
  sortOrder: number
  productCount: number
}

export interface AdminOrder {
  id: number
  referenceCode: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  deliveryAddress: string
  deliveryLocation: string | null
  notes: string | null
  subtotal: number
  deliveryFee: number
  discount: number
  totalAmount: number
  status: string
  paymentMethod: string | null
  paymentStatus: string
  transactionRef: string | null
  receiptUrl: string | null
  refundedAmount: number
  createdAt: string
  vendorIds: number[]
  vendorNames: string[]
  paymentVerifiedAt: string | null
  paymentNote: string | null
  cancelledAt: string | null
  deliveredAt: string | null
  refundedAt: string | null
  items: Array<{
    id: number
    vendorId: number
    vendorName: string
    productId: number
    productName: string
    productImage: string | null
    variationLabel: string | null
    unitPrice: number
    quantity: number
    lineTotal: number
    commissionRate: number
    commissionAmount: number
    vendorNet: number
    status: string
    trackingInfo: string | null
  }>
}

export interface AdminOrderDetail extends AdminOrder {
  events: Array<{ id: number; type: string; status: string; detail: string | null; actorRole: string | null; createdAt: string }>
  refunds: Array<{ id: number; reason: string; amount: number; status: string; requestedBy: string; createdAt: string }>
  ledger: Array<{ id: number; vendorId: number; commissionAmount: number; vendorNet: number; settlementStatus: string }>
}

export interface LedgerEntry {
  id: number
  orderReference: string
  vendorId: number
  vendorName: string
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

export interface PayoutRow {
  id: number
  referenceCode: string
  vendorId: number
  vendorName: string
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  amount: number
  status: string
  note: string | null
  transactionRef: string | null
  requestedAt: string
  processedAt: string | null
}

export interface MarketplaceSettings {
  defaultCommissionRate: number
  commissionType: 'PERCENTAGE' | 'FIXED'
  releaseDelayDays: number
  deliveryFee: number
  freeDeliveryThreshold: number
  deliveryLocations: string
  requireProductApproval: boolean
  allowGuestCheckout: boolean
  vendorRegistrationOpen: boolean
}

export interface ReviewRow {
  id: number
  productId: number
  productName: string
  vendorId: number
  vendorName: string
  customerName: string
  rating: number
  comment: string
  status: string
  reply: string | null
  createdAt: string
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

const BASE = '/api/admin/marketplace'

// ─── API ─────────────────────────────────────────────────────────────────────

export const marketplaceAdminApi = {
  overview: () => adminFetch<MarketplaceOverview>(`${BASE}/overview`),

  vendors: (params: { status?: string; search?: string; page?: number; perPage?: number }) =>
    adminFetch<Paged<AdminVendor>>(`${BASE}/vendors${qs(params)}`),

  vendor: (id: number) => adminFetch<AdminVendor>(`${BASE}/vendors/${id}`),

  updateVendorStatus: (
    id: number,
    input: { status: string; reason?: string; commissionRate?: number | null },
  ) =>
    adminFetch<AdminVendor>(`${BASE}/vendors/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  products: (params: { status?: string; vendorId?: number; categoryId?: number; search?: string; page?: number; perPage?: number }) =>
    adminFetch<Paged<AdminProduct>>(`${BASE}/products${qs(params)}`),

  createProduct: (body: FormData) =>
    adminFetch<AdminProduct>(`${BASE}/products`, { method: 'POST', body }),

  updateProduct: (id: number, body: FormData) =>
    adminFetch<AdminProduct>(`${BASE}/products/${id}`, { method: 'PUT', body }),

  setProductAvailability: (id: number, isActive: boolean) =>
    adminFetch<Record<string, never>>(`${BASE}/products/${id}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  moderateProduct: (id: number, action: 'APPROVED' | 'REJECTED', reason?: string) =>
    adminFetch<Record<string, never>>(`${BASE}/products/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }),

  deleteProduct: (id: number) =>
    adminFetch<Record<string, never>>(`${BASE}/products/${id}`, { method: 'DELETE' }),

  categories: () => adminFetch<AdminCategory[]>(`${BASE}/categories`),

  createCategory: (input: { name: string; description?: string; commissionRate?: number | null; isActive?: boolean }) =>
    adminFetch<AdminCategory>(`${BASE}/categories`, { method: 'POST', body: JSON.stringify(input) }),

  updateCategory: (
    id: number,
    input: { name?: string; description?: string; commissionRate?: number | null; isActive?: boolean; sortOrder?: number },
  ) => adminFetch<AdminCategory>(`${BASE}/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  deleteCategory: (id: number) =>
    adminFetch<Record<string, never>>(`${BASE}/categories/${id}`, { method: 'DELETE' }),

  orders: (params: {
    status?: string
    paymentStatus?: string
    vendorId?: number
    search?: string
    from?: string
    to?: string
    page?: number
    perPage?: number
  }) => adminFetch<Paged<AdminOrder>>(`${BASE}/orders${qs(params)}`),

  order: (reference: string) => adminFetch<AdminOrderDetail>(`${BASE}/orders/${encodeURIComponent(reference)}`),

  updateOrderStatus: (reference: string, status: string, reason?: string) =>
    adminFetch<AdminOrder>(`${BASE}/orders/${encodeURIComponent(reference)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),

  verifyOrderPayment: (reference: string, note?: string) =>
    adminFetch<AdminOrder>(`${BASE}/orders/${encodeURIComponent(reference)}/payment/verify`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  rejectOrderPayment: (reference: string, reason: string) =>
    adminFetch<AdminOrder>(`${BASE}/orders/${encodeURIComponent(reference)}/payment/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  createRefund: (reference: string, input: { reason: string; amount?: number; vendorId?: number }) =>
    adminFetch<{ id: number; status: string }>(`${BASE}/orders/${encodeURIComponent(reference)}/refunds`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  resolveRefund: (id: number, action: 'APPROVED' | 'REJECTED', resolution?: string) =>
    adminFetch<Record<string, never>>(`${BASE}/refunds/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, resolution }),
    }),

  settings: () => adminFetch<MarketplaceSettings>(`${BASE}/settings`),

  updateSettings: (input: MarketplaceSettings) =>
    adminFetch<MarketplaceSettings>(`${BASE}/settings`, { method: 'PUT', body: JSON.stringify(input) }),

  ledger: (params: { vendorId?: number; settlementStatus?: string; from?: string; to?: string; page?: number; perPage?: number }) =>
    adminFetch<Paged<LedgerEntry> & { totals: { salePrice: number; commissionAmount: number; vendorNet: number; reversedAmount: number } }>(
      `${BASE}/ledger${qs(params)}`,
    ),

  payouts: (params: { status?: string; vendorId?: number; page?: number; perPage?: number }) =>
    adminFetch<Paged<PayoutRow>>(`${BASE}/payouts${qs(params)}`),

  processPayout: (id: number, action: 'APPROVED' | 'REJECTED' | 'PAID', input?: { transactionRef?: string; note?: string }) =>
    adminFetch<Record<string, never>>(`${BASE}/payouts/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action, ...input }),
    }),

  reviews: (params: { status?: string; search?: string; page?: number; perPage?: number }) =>
    adminFetch<Paged<ReviewRow>>(`${BASE}/reviews${qs(params)}`),

  moderateReview: (id: number, action: 'APPROVED' | 'REJECTED') =>
    adminFetch<Record<string, never>>(`${BASE}/reviews/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  /** CSV exports open in a new tab — they need the raw response, not JSON. */
  exportOrdersCsvUrl: (params: { from?: string; to?: string; vendorId?: number }) =>
    `${API_BASE}${BASE}/reports/orders.csv${qs(params ?? {})}`,
  exportLedgerCsvUrl: (params: { from?: string; to?: string; vendorId?: number }) =>
    `${API_BASE}${BASE}/reports/ledger.csv${qs(params ?? {})}`,
}
