import { API_BASE, getAdminToken } from './index'
import { getCustomerToken } from './account'
import { getVendorToken } from './vendor'

/** Sawaba Stories API client — public feed, views, admin and vendor management. */

export type StoryType = 'PRODUCT' | 'BARBER' | 'SERVICE' | 'PROMOTION'
export type StoryStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

export interface StoryItem {
  id: number
  ownerType: string
  ownerName: string
  type: StoryType
  status: StoryStatus | string
  title: string
  caption: string | null
  mediaType: string
  image: string | null
  video: string | null
  thumbnailUrl: string | null
  duration: number | null
  ctaLabel: string
  ctaHref: string | null
  price: number | null
  compareAtPrice: number | null
  viewCount: number
  product: { id: number; name: string; slug: string } | null
  service: { id: number; name: string; slug: string } | null
  barber: { id: number; name: string; slug: string } | null
  vendor: { id: number; businessName: string } | null
  expiresAt: string
  createdAt: string
  approvedAt: string | null
  rejectedReason: string | null
}

export interface StoryPage {
  items: StoryItem[]
  total: number
  page: number
  perPage: number
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export class StoryApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'StoryApiError'
    this.status = status
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

async function storyFetch<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new StoryApiError('Unable to reach the server. Please try again.', 0)
  }
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !body || body.success !== true) {
    throw new StoryApiError(body?.message ?? 'Request failed.', response.status)
  }
  return body.data
}

const adminToken = () => getAdminToken()
const vendorToken = () => getVendorToken()

export const storiesApi = {
  list: () => storyFetch<StoryItem[]>('/api/stories'),

  view: (id: number, viewerKey: string) =>
    storyFetch<{ counted: boolean; viewCount: number }>(`/api/stories/${id}/view`, {
      method: 'POST',
      body: JSON.stringify({ viewerKey }),
    }, getCustomerToken()),

  adminList: (params: { status?: string; type?: string; search?: string; page?: number; perPage?: number } = {}) =>
    storyFetch<StoryPage>(`/api/admin/stories${qs(params)}`, {}, adminToken()),

  adminCreate: (form: FormData) =>
    storyFetch<StoryItem>('/api/admin/stories', { method: 'POST', body: form }, adminToken()),

  adminUpdate: (id: number, patch: Record<string, unknown>) =>
    storyFetch<StoryItem>(`/api/admin/stories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, adminToken()),

  adminModerate: (id: number, action: 'APPROVE' | 'REJECT', reason?: string) =>
    storyFetch<StoryItem>(`/api/admin/stories/${id}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }, adminToken()),

  adminDelete: (id: number) =>
    storyFetch<Record<string, never>>(`/api/admin/stories/${id}`, { method: 'DELETE' }, adminToken()),

  adminPromote: (id: number) =>
    storyFetch<{ targeted: number; sent: number; skipped: number }>(
      `/api/admin/stories/${id}/promote`,
      { method: 'POST', body: JSON.stringify({}) },
      adminToken(),
    ),

  vendorList: (params: { status?: string; type?: string; search?: string; page?: number; perPage?: number } = {}) =>
    storyFetch<StoryPage>(`/api/vendor/stories${qs(params)}`, {}, vendorToken()),

  vendorCreate: (form: FormData) =>
    storyFetch<StoryItem>('/api/vendor/stories', { method: 'POST', body: form }, vendorToken()),

  vendorUpdate: (id: number, patch: Record<string, unknown>) =>
    storyFetch<StoryItem>(`/api/vendor/stories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, vendorToken()),

  vendorDelete: (id: number) =>
    storyFetch<Record<string, never>>(`/api/vendor/stories/${id}`, { method: 'DELETE' }, vendorToken()),
}

const VIEWER_KEY = 'sawaba_story_viewer'

/** Stable anonymous viewer id used to count unique story views. */
export function getStoryViewerKey(): string {
  if (typeof window === 'undefined') return 'server-viewer'
  let key = localStorage.getItem(VIEWER_KEY)
  if (!key) {
    key = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `viewer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(VIEWER_KEY, key)
  }
  return key
}
