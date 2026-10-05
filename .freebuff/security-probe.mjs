// Security probe: verifies auth boundaries on every mutating endpoint with
// (a) no token, (b) a forged token, (c) a customer token, (d) a barber token.
// A 401/403 is PASS. Anything else (2xx, or 404/422 that indicates the route
// was reached without auth) is FAIL. Run: node .freebuff/security-probe.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = path.resolve(import.meta.dirname, '..')
const B = 'http://localhost:5000/api'

for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim()
  if (!l || l.startsWith('#')) continue
  const i = l.indexOf('=')
  if (i < 1) continue
  let v = l.slice(i + 1).trim()
  if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}

async function req(method, p, { token, body } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${B}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try { json = await res.json() } catch { /* non-json */ }
  return { status: res.status, json }
}

// Build a correctly-signed token using the real JWT secret, claiming each role,
// to test whether the server validates the *identity* behind the token.
function signToken(payload, secret) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${sig}`
}

let pass = 0, fail = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ok   ${name}`) }
  else { fail++; failures.push(`${name} :: ${detail}`); console.log(`  FAIL ${name} :: ${detail}`) }
}

// ---- obtain real tokens ----
const adminLogin = await req('POST', '/auth/login', {
  body: { email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD },
})
if (adminLogin.status !== 200) { console.error('admin login failed', adminLogin.status, JSON.stringify(adminLogin.json)); process.exit(2) }
const adminToken = adminLogin.json.data.token

// customer token: register a throwaway customer
const qaPhone = '0809' + String(Date.now()).slice(-7)
const reg = await req('POST', '/account/register', {
  body: { fullName: 'QA SecProbe', phone: qaPhone, email: `qa-sec-${Date.now()}@test.local`, password: 'QaProbe123!' },
})
let customerToken = reg.json?.data?.token ?? null
if (!customerToken) {
  const login = await req('POST', '/account/login', { body: { phone: qaPhone, password: 'QaProbe123!' } })
  customerToken = login.json?.data?.token ?? null
}
check('obtained customer token', Boolean(customerToken), `register ${reg.status}`)

// barber token: enable a throwaway barber via admin
const newBarber = await req('POST', '/barbers', {
  token: adminToken,
  body: { name: 'QA SecProbe Barber', email: `qa-sec-b-${Date.now()}@test.local`, phone: '08087776655', commissionType: 'PERCENTAGE', commissionValue: 10 },
})
const barberId = newBarber.json?.data?.id
let barberToken = null
if (barberId) {
  const setPw = await req('PUT', `/barbers/${barberId}`, {
    token: adminToken,
    body: { portalEnabled: true, portalPassword: 'QaBarber123!' },
  })
  if (setPw.status === 200) {
    const blogin = await req('POST', '/barber/auth/login', { body: { identifier: '08087776655', password: 'QaBarber123!' } })
    barberToken = blogin.json?.data?.token ?? null
  }
}
check('obtained barber token', Boolean(barberToken), `barber ${barberId ?? 'none'}`)

// forged token: valid shape, bogus signature
const forged = signToken({ id: 1, role: 'ADMIN' }, 'not-the-real-secret-at-all')
// correctly-signed but wrong-namespace token (barber secret namespace)
const jwtSecret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET
const crossNs = jwtSecret ? signToken({ id: 1, role: 'ADMIN', tokenType: 'admin' }, jwtSecret + ':barber') : null

const PROBES = [
  ['POST', '/services', { name: 'Hacked', price: 1, duration: 30, category: 'HAIRCUTS' }],
  ['PUT', '/services/1', { name: 'Hacked', price: 1, duration: 30, category: 'HAIRCUTS' }],
  ['DELETE', '/services/1', undefined],
  ['POST', '/barbers', { name: 'Hacked' }],
  ['PUT', '/barbers/1', { name: 'Hacked' }],
  ['DELETE', '/barbers/1', undefined],
  ['PATCH', '/appointments/1', { status: 'COMPLETED' }],
  ['POST', '/appointments/1/reactivate', {}],
  ['PUT', '/admin/appointments/1/assign-barber', { barberId: 1 }],
  ['GET', '/appointments', undefined],
  ['GET', '/admin/dashboard', undefined],
  ['GET', '/admin/customers', undefined],
  ['PATCH', '/admin/customers/1', { isActive: false }],
  ['GET', '/admin/payments', undefined],
  ['POST', '/admin/payments/1/verify', {}],
  ['POST', '/admin/payments/1/reject', { reason: 'x' }],
  ['POST', '/admin/payments/1/confirm-cash', { note: 'x' }],
  ['GET', '/admin/barber-earnings', undefined],
  ['POST', '/admin/barber-earnings/1/paid', {}],
  ['PUT', '/admin/commission-rates/1', { commissionType: 'PERCENTAGE', commissionValue: 99 }],
  ['PUT', '/admin/payment-settings', { shopName: 'Hacked' }],
  ['PATCH', '/reviews/1', { status: 'APPROVED' }],
  ['POST', '/gallery', { title: 'Hacked', image: '/x.jpg', category: 'HAIRCUT' }],
  ['PUT', '/gallery/1', { title: 'Hacked' }],
  ['DELETE', '/gallery/1', undefined],
  ['PATCH', '/contact/1/read', { isRead: true }],
  ['PATCH', '/contact/1/status', { status: 'ARCHIVED' }],
  ['POST', '/contact/1/reply', { message: 'hijack' }],
  ['GET', '/barber/portal/overview', undefined],
  ['GET', '/barber/portal/appointments', undefined],
  ['PUT', '/barber/portal/appointments/1/status', { status: 'COMPLETED' }],
  ['GET', '/barber/portal/earnings', undefined],
  ['PUT', '/barber/portal/availability', { slots: [] }],
  ['PUT', '/barber/portal/notifications/read', { ids: [1] }],
  ['POST', '/barber/auth/change-password', { currentPassword: 'x', newPassword: 'y1234567' }],
  ['GET', '/account/me', undefined],
  ['PATCH', '/account/me', { fullName: 'Hacked' }],
  ['POST', '/account/me/password', { currentPassword: 'x', newPassword: 'y1234567' }],
  ['GET', '/account/summary', undefined],
  ['GET', '/account/appointments', undefined],
  ['GET', '/account/payments', undefined],
  ['POST', '/account/appointments/1/cancel', { reason: 'x' }],
]

console.log('\n--- A. NO TOKEN (expect 401/403) ---')
for (const [m, p, b] of PROBES) {
  const r = await req(m, p, { body: b })
  check(`${m} ${p}`, r.status === 401 || r.status === 403, `got ${r.status} ${JSON.stringify(r.json).slice(0, 90)}`)
}

console.log('\n--- B. FORGED TOKEN (expect 401) ---')
for (const [m, p, b] of PROBES) {
  const r = await req(m, p, { token: forged, body: b })
  check(`${m} ${p}`, r.status === 401 || r.status === 403, `got ${r.status} ${JSON.stringify(r.json).slice(0, 90)}`)
}

if (crossNs) {
  console.log('\n--- C. CROSS-NAMESPACE SIGNED TOKEN (expect 401) ---')
  for (const [m, p, b] of PROBES.filter(([, p]) => p.startsWith('/admin') || p.startsWith('/barber'))) {
    const r = await req(m, p, { token: crossNs, body: b })
    check(`${m} ${p}`, r.status === 401 || r.status === 403, `got ${r.status} ${JSON.stringify(r.json).slice(0, 90)}`)
  }
}

if (customerToken) {
  console.log('\n--- D. CUSTOMER TOKEN ON ADMIN/BARBER ROUTES (expect 401/403) ---')
  for (const [m, p, b] of PROBES.filter(([, p]) => p.startsWith('/admin') || p.startsWith('/barber'))) {
    const r = await req(m, p, { token: customerToken, body: b })
    check(`${m} ${p}`, r.status === 401 || r.status === 403, `got ${r.status} ${JSON.stringify(r.json).slice(0, 90)}`)
  }
}

if (barberToken) {
  console.log('\n--- E. BARBER TOKEN ON ADMIN ROUTES (expect 401/403) ---')
  for (const [m, p, b] of PROBES.filter(([, p]) => p.startsWith('/admin'))) {
    const r = await req(m, p, { token: barberToken, body: b })
    check(`${m} ${p}`, r.status === 401 || r.status === 403, `got ${r.status} ${JSON.stringify(r.json).slice(0, 90)}`)
  }
  console.log('\n--- F. BARBER TOKEN ON OTHER BARBERS DATA (expect 403/empty) ---')
  const otherAppt = await req('GET', '/barber/portal/appointments?scope=all', { token: barberToken })
  check('barber cannot widen appointment scope', otherAppt.status === 403 || (otherAppt.json?.data?.items ?? []).length === 0, `status ${otherAppt.status}`)
}

console.log('\n--- G. PUBLIC DATA MUST NOT LEAK SENSITIVE FIELDS ---')
const pubBarbers = await req('GET', '/barbers?perPage=5')
const items = pubBarbers.json?.data?.items ?? []
const FIRST = items[0] ?? {}
const FORBIDDEN = ['commissionType', 'commissionValue', 'portalEnabled', 'hasPortalPassword', 'passwordHash', 'password']
const leaked = FORBIDDEN.filter((k) => k in FIRST)
check('public /barbers hides commission + portal fields', leaked.length === 0, `leaked: ${leaked.join(',')} | keys: ${Object.keys(FIRST).join(',')}`)

const pubReviews = await req('GET', '/reviews?approved=true&perPage=5')
check('public /reviews only returns approved', (pubReviews.json?.data?.items ?? []).every((r) => r.isApproved === true || r.status === 'APPROVED'), 'unapproved review publicly visible')

const pubServices = await req('GET', '/services?perPage=5')
check('public /services works without auth', pubServices.status === 200, `status ${pubServices.status}`)

const docs = await req('GET', '/docs/')
check('swagger UI reachable', docs.status === 200, `status ${docs.status}`)

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
if (failures.length) { console.log('Failures:'); failures.forEach((f) => console.log('  - ' + f)) }
process.exit(fail > 0 ? 1 : 0)