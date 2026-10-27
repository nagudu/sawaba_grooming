/**
 * Creates ONE QA account + booking (phone 09160000011) so the customer
 * appointments page can be visually verified, then prints only non-secret
 * details. Remove afterwards with: cd backend && npx tsx src/scripts/qaIdentityCleanup.ts
 */
import { readFileSync } from 'node:fs'

const BASE = 'http://localhost:5000'
const PHONE = '09160000011'
const NAME = 'Qa Customer Ui'
const EMAIL = 'qa.customer.ui@sawaba.test'

function readEnv() {
  const env = {}
  for (const line of readFileSync('backend/.env', 'utf8').split(/\r?\n/)) {
    const idx = line.indexOf('=')
    if (idx > 0 && !line.trimStart().startsWith('#')) {
      env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  }
  return env
}

async function call(path, { method = 'GET', body, form, token } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  const raw = await res.text().catch(() => '')
  let json = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json }
}

const env = readEnv()

// 1. Register the QA account
const reg = await call('/api/account/register', {
  method: 'POST',
  body: { fullName: NAME, phone: PHONE, email: EMAIL, password: 'QaUiTest123!' },
})
console.log('register:', reg.status, reg.json?.data?.token ? 'token ok' : reg.json?.message)
const token = reg.json?.data?.token

// 2. Book against a real barber (same identity so it links to the account)
const barbers = await call('/api/barbers?page=1&perPage=5&isActive=true')
const barber = (barbers.json?.data?.items ?? []).find((b) => (b.services ?? []).length > 0)
const service = barber.services[0]
const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)

const form = new FormData()
form.set('customerName', NAME)
form.set('customerPhone', PHONE)
form.set('customerEmail', EMAIL)
form.set('serviceId', String(service.id))
form.set('barberId', String(barber.id))
form.set('appointmentDate', futureDate)
form.set('appointmentTime', '15:00')
form.set('paymentMethod', 'CASH')
const book = await call('/api/appointments', { method: 'POST', form })
console.log('booking:', book.status, book.json?.data?.appointment?.referenceCode ?? book.json?.message)

// 3. Confirm the account's list contains it
if (token) {
  const mine = await call('/api/account/appointments?page=1&perPage=10', { token })
  const items = mine.json?.data?.items ?? []
  console.log(
    'account appointments:',
    mine.status,
    items.map((i) => `${i.referenceCode} ${i.customerName} <${i.customerEmail}>`).join(' | '),
  )
}
