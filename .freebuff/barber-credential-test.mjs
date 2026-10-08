// Verifies the admin-created barber has working portal credentials.
// Reads seed credentials from backend/.env; never prints secret values.
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const B = 'http://localhost:5000/api'
const headers = (t) => ({ 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) })
const call = async (method, path, token, body) => {
  const r = await fetch(B + path, { method, headers: headers(token), body: body ? JSON.stringify(body) : undefined })
  let d = null
  try { d = await r.json() } catch { /* non-JSON */ }
  return { status: r.status, d }
}
const data = (d) => d?.data ?? d

// 1. Admin login with seed credentials (values stay out of the log).
const al = await call('POST', '/auth/login', null, {
  email: env.ADMIN_SEED_EMAIL,
  password: env.ADMIN_SEED_PASSWORD,
})
const T = data(al.d)?.token ?? data(al.d)?.accessToken
console.log('1. admin login:', al.status, T ? 'OK' : 'FAIL ' + JSON.stringify(al.d?.message ?? al.d))
if (!T) process.exit(1)

// 2. Is the UI-created QA barber present?
const list = await call('GET', '/barbers?search=QA%20Portal%20Test&includeInactive=true&perPage=20', T)
const items = data(list.d)?.items ?? []
console.log('2. QA barbers found:', items.length, items.map((b) => `#${b.id} portal=${b.portalEnabled} hasPw=${b.hasPortalPassword}`).join(', '))

// Remove leftovers from earlier attempts so we start clean.
for (const b of items) {
  const del = await call('DELETE', `/barbers/${b.id}`, T)
  console.log('   cleaned up old test barber', b.id, '→', del.status)
}

// 3. Create exactly as the admin form now does: portal ON, default password 123456.
const create = await call('POST', '/barbers', T, {
  name: 'QA Portal Test',
  email: 'qa.portal.test@example.com',
  phone: '08099990001',
  portalEnabled: true,
  portalPassword: '123456',
  barberType: 'INTERNAL',
  experience: 1,
  commissionType: 'PERCENTAGE',
  commissionValue: 0,
  isActive: true,
})
const barber = data(create.d)
console.log('3. create (portal ON, pw 123456):', create.status, barber?.id ? `id=${barber.id}` : JSON.stringify(create.d?.message ?? create.d))

// 4. Barber portal login — email identifier.
const loginEmail = await call('POST', '/barber/auth/login', null, {
  identifier: 'qa.portal.test@example.com',
  password: '123456',
})
console.log('4. barber login via email + 123456:', loginEmail.status, data(loginEmail.d)?.token ? 'OK' : JSON.stringify(loginEmail.d?.message ?? loginEmail.d))

// 5. Barber portal login — phone identifier (login fallback).
const loginPhone = await call('POST', '/barber/auth/login', null, {
  identifier: '08099990001',
  password: '123456',
})
console.log('5. barber login via phone + 123456:', loginPhone.status, data(loginPhone.d)?.token ? 'OK' : JSON.stringify(loginPhone.d?.message ?? loginPhone.d))

// 6. Negative check: 5-char password must be rejected by BOTH validators.
const shortCreate = await call('POST', '/barbers', T, {
  name: 'QA Short PW',
  email: 'qa.shortpw@example.com',
  portalEnabled: true,
  portalPassword: '1234',
})
console.log('6. create with 4-char pw rejected (expect 400):', shortCreate.status)

console.log('DONE (test barber left in place for the browser login test)')
