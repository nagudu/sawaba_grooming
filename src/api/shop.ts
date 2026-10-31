import { API_BASE } from './index'

/**
 * Public Shop API client (marketplace). Works for guests — the cart is keyed
 * by an opaque token held in localStorage — and attaches the customer JWT
 * automatically when one exists, so order history/reviews work for members.
 */

const CART_TOKEN_KEY = 'sawaba_shop_cart_token'

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export function getCartToken(): string | null {
  return localStorage.getItem(CART_TOKEN_KEY)
}

export function ensureCartToken(): string {
  const existing = localStorage.getItem(CART_TOKEN_KEY)
  if (existing) return existing
  const token = `cart-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`
  localStorage.setItem(CART_TOKEN_KEY, token)
  return token
}

export function clearCartToken(): void {
  localStorage.removeItem(CART_TOKEN_KEY)
}

function customerToken(): string | null {
  return localStorage.getItem('sawaba_customer_token')
}

export class ShopError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ShopError'
    this.status = status
  }
}

async function shopFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = customerToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ShopError('Unable to reach the server. Please try again.', 0)
  }

  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    body = null
  }
  if (!response.ok || !body || body.success !== true) {
    throw new ShopError(body?.message ?? 'Request failed.', response.status)
  }
  return body.data
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShopProduct {
  id: number
  name: string
  slug: string
  brand: string | null
  price: number
  compareAtPrice: number | null
  stock: number
  lowStockThreshold: number
  rating: number
  reviewCount: number
  image: string | null
  vendor: { id: number; businessName: string }
  category: { id: number; name: string } | null
  createdAt: string
}

export interface ShopProductDetail extends ShopProduct {
  description: string
  isActive: boolean
  status: string
  variations: Array<{ id: number; name: string; value: string; priceDelta: number }>
  images: Array<{ id: number; url: string; alt: string | null }>
}

export interface ShopCategory {
  id: number
  name: string
  slug: string
  imageUrl: string | null
  productCount: number
}

export interface CartItemView {
  id: number
  quantity: number
  product: {
    id: number
    name: string
    slug: string
    price: number
    stock: number
    image: string | null
    vendor: { id: number; businessName: string }
    status: string
  }
  variation: { id: number; name: string; value: string; priceDelta: number } | null
  unitPrice: number
  lineTotal: number
}

export interface CartView {
  token: string
  items: CartItemView[]
  subtotal: number
  itemCount: number
}

export interface ShopOrderItem {
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
  status: string
  trackingInfo: string | null
}

export interface ShopOrder {
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
  items: ShopOrderItem[]
  history?: Array<{
    id: number
    type: string
    status: string
    detail: string | null
    actorRole: string | null
    createdAt: string
  }>
  paymentDetails?: {
    bankName: string | null
    accountName: string | null
    accountNumber: string | null
    opayAccountName: string | null
    opayAccountNumber: string | null
    instructions: string | null
    shopName: string | null
  } | null
}

export interface ShopSettings {
  deliveryFee: number
  freeDeliveryThreshold: number
  deliveryLocations: string[]
  allowGuestCheckout: boolean
  vendorRegistrationOpen: boolean
  requireProductApproval: boolean
}

export interface ShopReview {
  id: number
  customerName: string
  rating: number
  comment: string
  reply: string | null
  createdAt: string
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  perPage: number
}

// ─── API ─────────────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const shopApi = {
  settings: () => shopFetch<ShopSettings>('/api/shop/settings'),

  products: (params: {
    search?: string
    category?: string
    brand?: string
    minPrice?: number
    maxPrice?: number
    sort?: string
    page?: number
    perPage?: number
    vendor?: number
  }) => shopFetch<Paged<ShopProduct>>(`/api/shop/products${qs(params)}`),

  product: (slug: string) =>
    shopFetch<ShopProductDetail>(`/api/shop/products/${encodeURIComponent(slug)}`),

  categories: () => shopFetch<ShopCategory[]>('/api/shop/categories'),
  brands: () => shopFetch<string[]>('/api/shop/brands'),

  reviews: (productId: number, page = 1) =>
    shopFetch<Paged<ShopReview>>(`/api/shop/products/${productId}/reviews${qs({ page })}`),

  submitReview: (
    productId: number,
    input: { rating: number; comment: string; customerName?: string },
  ) =>
    shopFetch<Record<string, never>>(`/api/shop/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Cart
  getCart: () => shopFetch<CartView>(`/api/shop/cart${qs({ token: ensureCartToken() })}`),

  addToCart: (input: { productId: number; variationId?: number | null; quantity?: number }) =>
    shopFetch<CartView>('/api/shop/cart/items', {
      method: 'POST',
      body: JSON.stringify({ ...input, token: ensureCartToken(), quantity: input.quantity ?? 1 }),
    }),

  updateCartItem: (itemId: number, quantity: number) =>
    shopFetch<CartView>(`/api/shop/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ token: ensureCartToken(), quantity }),
    }),

  removeCartItem: (itemId: number) =>
    shopFetch<CartView>(`/api/shop/cart/items/${itemId}`, {
      method: 'DELETE',
      body: JSON.stringify({ token: ensureCartToken() }),
    }),

  clearCart: () =>
    shopFetch<Record<string, never>>('/api/shop/cart/clear', {
      method: 'POST',
      body: JSON.stringify({ token: ensureCartToken() }),
    }),

  // Checkout
  checkout: (input: {
    customerName: string
    customerPhone: string
    customerEmail?: string
    deliveryAddress: string
    deliveryLocation?: string
    notes?: string
    paymentMethod: 'BANK_TRANSFER' | 'OPAY' | 'ONLINE' | 'CASH'
  }) =>
    shopFetch<ShopOrder>('/api/shop/orders', {
      method: 'POST',
      body: JSON.stringify({ ...input, token: ensureCartToken() }),
    }),

  getOrder: (reference: string, phone: string) =>
    shopFetch<ShopOrder>(`/api/shop/orders${qs({ reference, phone })}`),

  cancelOrder: (reference: string, phone: string) =>
    shopFetch<ShopOrder>('/api/shop/orders/cancel', {
      method: 'POST',
      body: JSON.stringify({ reference, phone }),
    }),

  submitReceipt: (reference: string, receipt: File, transactionReference?: string) => {
    const form = new FormData()
    form.set('reference', reference)
    form.set('receipt', receipt)
    if (transactionReference) form.set('transactionReference', transactionReference)
    return shopFetch<ShopOrder>(`/api/shop/orders/${encodeURIComponent(reference)}/receipt`, {
      method: 'POST',
      body: form,
    })
  },

  submitTransferReference: (reference: string, transactionReference: string) =>
    shopFetch<ShopOrder>(`/api/shop/orders/${encodeURIComponent(reference)}/transfer-reference`, {
      method: 'POST',
      body: JSON.stringify({ reference, transactionReference }),
    }),

  initPaystack: (reference: string) =>
    shopFetch<{ authorizationUrl: string; accessCode: string; reference: string }>(
      `/api/shop/orders/${encodeURIComponent(reference)}/paystack/initialize`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  verifyPaystack: (reference: string, paystackReference: string) =>
    shopFetch<ShopOrder>(`/api/shop/orders/${encodeURIComponent(reference)}/paystack/verify`, {
      method: 'POST',
      body: JSON.stringify({ reference: paystackReference }),
    }),

  myOrders: (page = 1) =>
    shopFetch<Paged<ShopOrder>>(`/api/shop/my/orders${qs({ page })}`),
}
