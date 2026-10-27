/**
 * Guest-booking identity test against the RUNNING backend (port 5000).
 *
 * Covers the customer-identification rules:
 *  - Two different people can book with the SAME phone number (different names
 *    and emails) and get separate customer records, references and QR codes.
 *  - Registration on a shared number never adopts another person's bookings.
 *  - Password/OTP login resolves only real account records, never guest records.
 *  - Guest booking lookups require booking reference + phone (2nd factor).
 *  - A guest record on a number never blocks an account from claiming it.
 *
 * Everything it creates is cleaned up (appointments via the API, then the
 * test-only customer records via Prisma).
 *
 * Run: node scripts/guest-booking-identity-test.mjs
 * Secret values are read from backend/.env and never printed.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const BASE = 'http://localhost:5000'

// Test-only fixtures: synthetic numbers/emails, clearly QA-marked.
const SHARED_PHONE = '09160000007' // used by THREE different people below
const GUEST_ONLY_PHONE = '09160000008' // never associated with an account
const OTHER_ACCOUNT_PHONE = '09160000009'
const FRESH_ACCOUNT_PHONE = '09160000010'
const WRONG_PHONE = '08012345678'
const TEST_PASSWORD = 'QaTest123!'

const createdAppointmentIds = []
let adminToken = null

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

async function call(path, { method = 'GET', token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
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
  return { status: res.status, headers: res.headers, json, raw }
}

let pass = 0
let fail = 0
function check(name, cond, detail = '') {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// Cleanup must run even if a step throws (e.g. rate-limited booking).
let cleanupDone = false
async function cleanupOnce() {
  if (cleanupDone) return
  cleanupDone = true
  await cleanup()
}
function crashExit(error) {
  console.error(`\nTEST CRASHED: ${error?.message ?? error}`)
  void cleanupOnce().finally(() => process.exit(1))
}
process.on('uncaughtException', crashExit)
process.on('unhandledRejection', crashExit)

async function cleanup() {
  for (const id of createdAppointmentIds) {
    try {
      await call(`/api/appointments/${id}`, { method: 'DELETE', token: adminToken })
    } catch (error) {
      console.log(`  WARN could not delete appointment #${id}: ${error.message}`)
    }
  }
  // Remove the test-only customer records (bookings are already gone).
  try {
    execFileSync('npx', ['tsx', 'src/scripts/qaIdentityCleanup.ts'], {
      stdio: 'inherit',
      shell: true, // Windows: resolve npx.cmd
      cwd: 'backend',
    })
  } catch (error) {
    console.log(`  WARN QA customer cleanup failed: ${error.message}`)
  }
}

// ── Admin login ───────────────────────────────────────────────────────────────
const env = readEnv()
const login = await call('/api/auth/login', {
  method: 'POST',
  body: {
    email: env.ADMIN_SEED_EMAIL ?? 'admin@sawabasalon.com',
    password: env.ADMIN_SEED_PASSWORD ?? 'ChangeMe123!',
  },
})
adminToken = login.json?.data?.token
if (!adminToken) {
  console.error('Could not log in as admin:', login.status, login.json?.message)
  process.exit(1)
}

const barbersRes = await call('/api/barbers?page=1&perPage=5&isActive=true')
const barber = (barbersRes.json?.data?.items ?? []).find((b) => (b.services ?? []).length > 0)
if (!barber || !barber.services?.length) {
  console.error('No barber with assigned services available to book against.')
  process.exit(1)
}
const service = barber.services[0]
const futureDate = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10)

function bookingForm({ name, phone, email, time }) {
  const form = new FormData()
  form.set('customerName', name)
  form.set('customerPhone', phone)
  form.set('customerEmail', email)
  form.set('serviceId', String(service.id))
  form.set('barberId', String(barber.id))
  form.set('appointmentDate', futureDate)
  form.set('appointmentTime', time)
  form.set('paymentMethod', 'CASH')
  return form
}

async function book(payload) {
  const res = await call('/api/appointments', { method: 'POST', form: bookingForm(payload) })
  if (res.json?.data?.appointment?.id) createdAppointmentIds.push(res.json.data.appointment.id)
  return res
}

// ── 1. Two people, SAME phone, different names + emails ──────────────────────
console.log('\n1) Two guest bookings on one phone number')
const aRes = await book({
  name: 'Halifa Shuaibu',
  phone: SHARED_PHONE,
  email: 'halifa.qa@sawaba.test',
  time: '09:00',
})
const bRes = await book({
  name: 'Sani Isah',
  phone: SHARED_PHONE,
  email: 'sani.qa@sawaba.test',
  time: '10:00',
})
const aptA = aRes.json?.data?.appointment
const aptB = bRes.json?.data?.appointment
check('Halifa booking accepted', aRes.status === 201, `status ${aRes.status}: ${aRes.json?.message}`)
check('Sani booking accepted (same phone)', bRes.status === 201, `status ${bRes.status}: ${bRes.json?.message}`)
check(
  'Both bookings have a unique reference code',
  Boolean(aptA?.referenceCode && aptB?.referenceCode && aptA.referenceCode !== aptB.referenceCode),
  `refA=${aptA?.referenceCode} refB=${aptB?.referenceCode}`,
)
check(
  'Each booking keeps its own customer record (not merged by phone)',
  Boolean(aptA?.customerId && aptB?.customerId && aptA.customerId !== aptB.customerId),
  `customerIdA=${aptA?.customerId} customerIdB=${aptB?.customerId}`,
)
check(
  'Halifa snapshot correct on booking A',
  aptA?.customerName === 'Halifa Shuaibu' &&
    aptA?.customerPhone === SHARED_PHONE &&
    aptA?.customerEmail === 'halifa.qa@sawaba.test',
  JSON.stringify({ n: aptA?.customerName, p: aptA?.customerPhone, e: aptA?.customerEmail }),
)
check(
  'Sani snapshot correct on booking B',
  aptB?.customerName === 'Sani Isah' &&
    aptB?.customerPhone === SHARED_PHONE &&
    aptB?.customerEmail === 'sani.qa@sawaba.test',
  JSON.stringify({ n: aptB?.customerName, p: aptB?.customerPhone, e: aptB?.customerEmail }),
)

if (!aptA || !aptB) {
  console.log('\nBookings unavailable (rate-limited or server error) — aborting early.')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exitCode = 1
  await cleanupOnce()
  process.exit(1)
}

// ── 2. Admin appointments list shows both separately ─────────────────────────
console.log('\n2) Admin list shows each booking separately')
const listRes = await call(`/api/appointments?search=${SHARED_PHONE}&perPage=100`, { token: adminToken })
const rows = listRes.json?.data?.items ?? []
const rowA = rows.find((r) => r.referenceCode === aptA.referenceCode)
const rowB = rows.find((r) => r.referenceCode === aptB.referenceCode)
check('Both bookings returned for a phone search', Boolean(rowA && rowB))
check(
  'Row A shows Halifa with his own email',
  rowA?.customerName === 'Halifa Shuaibu' && rowA?.customerEmail === 'halifa.qa@sawaba.test',
)
check(
  'Row B shows Sani with his own email',
  rowB?.customerName === 'Sani Isah' && rowB?.customerEmail === 'sani.qa@sawaba.test',
)
check(
  'List rows keep distinct customerIds',
  Boolean(rowA?.customerId && rowB?.customerId && rowA.customerId !== rowB.customerId),
)

// ── 3. Guest QR lookup: reference + phone, per-booking QR ────────────────────
console.log('\n3) Guest QR lookup (reference + phone)')
const qrA = await call('/api/bookings/qr', {
  method: 'POST',
  body: { reference: aptA.referenceCode, phone: SHARED_PHONE },
})
const qrB = await call('/api/bookings/qr', {
  method: 'POST',
  body: { reference: aptB.referenceCode, phone: SHARED_PHONE },
})
const qrWrong = await call('/api/bookings/qr', {
  method: 'POST',
  body: { reference: aptA.referenceCode, phone: WRONG_PHONE },
})
check('QR retrievable for booking A', qrA.status === 200 && Boolean(qrA.json?.data?.qrPayload))
check('QR retrievable for booking B', qrB.status === 200 && Boolean(qrB.json?.data?.qrPayload))
check(
  'Each booking has its OWN QR token',
  qrA.json?.data?.qrToken !== qrB.json?.data?.qrToken,
  `A=${qrA.json?.data?.qrToken} B=${qrB.json?.data?.qrToken}`,
)
check('Wrong phone rejected for QR lookup', qrWrong.status === 404, `status ${qrWrong.status}`)

// ── 4. Guest payment tracking: reference + phone ─────────────────────────────
console.log('\n4) Guest payment tracking (reference + phone)')
const trackOk = await call('/api/payments/track', {
  method: 'POST',
  body: { appointmentId: aptA.referenceCode, phone: SHARED_PHONE },
})
const trackBad = await call('/api/payments/track', {
  method: 'POST',
  body: { appointmentId: aptA.referenceCode, phone: WRONG_PHONE },
})
check('Track works with correct reference + phone', trackOk.status === 200)
check('Track rejects wrong phone', trackBad.status === 404, `status ${trackBad.status}`)

// ── 5. OTP: guest-only numbers are not accounts ──────────────────────────────
console.log('\n5) OTP login only reaches real accounts')
const guestOnly = await book({
  name: 'Qa Guest Only',
  phone: GUEST_ONLY_PHONE,
  email: 'guestonly.qa@sawaba.test',
  time: '11:00',
})
const otpGuest = await call('/api/account/otp/request', {
  method: 'POST',
  body: { phone: GUEST_ONLY_PHONE },
})
check(
  'Guest-only number has no login account',
  otpGuest.json?.data?.found === false,
  JSON.stringify(otpGuest.json?.data ?? otpGuest.json),
)

// ── 6. Registration adopts ONLY the same person's record ─────────────────────
console.log('\n6) Registration on a shared number')
const reg = await call('/api/account/register', {
  method: 'POST',
  body: {
    fullName: 'Halifa Shuaibu',
    phone: SHARED_PHONE,
    email: 'halifa.acct.qa@sawaba.test',
    password: TEST_PASSWORD,
  },
})
const regToken = reg.json?.data?.token
check('Halifa can register on the shared number', Boolean(regToken), `${reg.status}: ${reg.json?.message}`)

if (regToken) {
  const mine = await call('/api/account/appointments?page=1&perPage=50', { token: regToken })
  const items = mine.json?.data?.items ?? []
  const refs = items.map((i) => i.referenceCode)
  check('Account sees Halifa\'s own booking', refs.includes(aptA.referenceCode), `refs=${refs.join(',')}`)
  check('Account does NOT see Sani\'s booking', !refs.includes(aptB.referenceCode), `refs=${refs.join(',')}`)
  check(
    'Account does NOT see the guest-only booking',
    !refs.includes(guestOnly.json?.data?.appointment?.referenceCode),
    `refs=${refs.join(',')}`,
  )
  const itemA = items.find((i) => i.referenceCode === aptA.referenceCode)
  check('Account id equals booking-A customerId', itemA?.customerId === aptA.customerId)

  // Password login by phone (account record among several phone records)
  const pwLogin = await call('/api/account/login', {
    method: 'POST',
    body: { identifier: SHARED_PHONE, password: TEST_PASSWORD },
  })
  check('Password login by phone works on shared number', Boolean(pwLogin.json?.data?.token), `${pwLogin.status}`)

  // Second registration on the same number must conflict
  const reg2 = await call('/api/account/register', {
    method: 'POST',
    body: { fullName: 'Sani Isah', phone: SHARED_PHONE, password: TEST_PASSWORD },
  })
  check('Second account on same number rejected', reg2.status === 409, `status ${reg2.status}`)
}

// Email owned by another record must still conflict
const regEmail = await call('/api/account/register', {
  method: 'POST',
  body: {
    fullName: 'Qa Other Person',
    phone: FRESH_ACCOUNT_PHONE,
    email: 'sani.qa@sawaba.test',
    password: TEST_PASSWORD,
  },
})
check('Registering with another record\'s email rejected', regEmail.status === 409, `status ${regEmail.status}`)

// ── 7. New guest on the account\'s number stays separate ─────────────────────
console.log('\n7) Guest booking on an account\'s number with a different name')
const cRes = await book({
  name: 'Usman Alhaji',
  phone: SHARED_PHONE,
  email: 'usman.qa@sawaba.test',
  time: '13:00',
})
const aptC = cRes.json?.data?.appointment
check('Third guest booking accepted', cRes.status === 201, `status ${cRes.status}`)
check(
  'New guest got a separate customer record',
  Boolean(aptC?.customerId && aptC.customerId !== aptA.customerId && aptC.customerId !== aptB.customerId),
  `customerIdC=${aptC?.customerId}`,
)
if (regToken) {
  const mine2 = await call('/api/account/appointments?page=1&perPage=50', { token: regToken })
  const refs2 = (mine2.json?.data?.items ?? []).map((i) => i.referenceCode)
  check('Account still isolated from the new guest booking', !refs2.includes(aptC.referenceCode))
}

// ── 8. Profile phone change not blocked by guest records ─────────────────────
console.log('\n8) Account phone change vs guest records on the target number')
const regOther = await call('/api/account/register', {
  method: 'POST',
  body: { fullName: 'Qa Account Two', phone: OTHER_ACCOUNT_PHONE, password: TEST_PASSWORD },
})
const otherToken = regOther.json?.data?.token
check('Second test account registered', Boolean(otherToken), `${regOther.status}: ${regOther.json?.message}`)
if (otherToken) {
  // Guest-only record on FRESH_ACCOUNT_PHONE? Use GUEST_ONLY number (guest record lives there)
  const patch = await call('/api/account/me', {
    method: 'PATCH',
    token: otherToken,
    body: { phone: GUEST_ONLY_PHONE },
  })
  check(
    'Phone change allowed when the target number only has guest records',
    patch.status === 200,
    `status ${patch.status}: ${patch.json?.message}`,
  )
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
process.exitCode = fail > 0 ? 1 : 0
await cleanupOnce()
process.exit(process.exitCode ?? 0)
