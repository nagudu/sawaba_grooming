import { API_BASE, clearAdminSession, getAdminToken } from './index'
import { getCustomerToken, setCustomerToken } from './account'
import { getVendorToken, setVendorToken } from './vendor'
import { clearBarberToken, getBarberToken } from './barberPortal'

/**
 * Cross-namespace session resolution.
 * The backend identifies the role from the token; the frontend just needs to
 * know which stored token is still valid so it can route the user.
 */

export type SessionRole = 'ADMIN' | 'VENDOR' | 'CUSTOMER' | 'BARBER'

export interface SessionProfile {
  id: number
  name: string
  email: string | null
  phone: string | null
  status: string | null
}

export interface SessionIdentity {
  role: SessionRole
  profile: SessionProfile
  expiresAt: string | null
}

export interface ResolveResult {
  session: SessionIdentity | null
  status: number
}

/** Calls GET /api/auth/session with an explicit token (not the admin client's). */
export async function resolveToken(token: string): Promise<ResolveResult> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/session`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return { session: null, status: response.status }
    const json = (await response.json()) as { data?: SessionIdentity }
    return { session: json.data ?? null, status: response.status }
  } catch {
    return { session: null, status: 0 }
  }
}

export interface StoredSession extends SessionIdentity {
  token: string
}

/**
 * Finds the first valid stored session across all four namespaces, clearing any
 * token the backend rejects (401/403). Network errors leave tokens untouched.
 */
export async function resolveStoredSession(): Promise<StoredSession | null> {
  const candidates: Array<{ token: string | null; clear: () => void }> = [
    { token: getAdminToken(), clear: clearAdminSession },
    { token: getVendorToken(), clear: () => setVendorToken(null) },
    { token: getBarberToken(), clear: clearBarberToken },
    { token: getCustomerToken(), clear: () => setCustomerToken(null) },
  ]

  for (const candidate of candidates) {
    if (!candidate.token) continue
    const { session, status } = await resolveToken(candidate.token)
    if (session) return { ...session, token: candidate.token }
    if (status === 401 || status === 403) candidate.clear()
  }
  return null
}

export function dashboardPathForRole(role: SessionRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin'
    case 'VENDOR':
      return '/vendor'
    case 'BARBER':
      return '/barber'
    case 'CUSTOMER':
    default:
      return '/account'
  }
}
