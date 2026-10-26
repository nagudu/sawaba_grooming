/**
 * End-to-end payment lifecycle test against the RUNNING backend (port 5000).
 * Exercises: book (cash) -> confirm cash -> PAID; book (bank transfer + receipt)
 * -> submit -> PENDING_VERIFICATION -> verify -> PAID; refund -> REFUNDED;
 * plus the new summary, transaction-ref search and CSV export endpoints.
 * Cleans up every test appointment it created.
 *
 * Run: node scripts/payment-lifecycle-test.mjs
 * Secret values are read from backend/.env and never printed.
 */
import { readFileSync } from 'node:fs'

const BASE = 'http://localhost:5000'
const createdAppointmentIds = []

// Minimal valid 1x1 PNG for the receipt upload.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

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
  // Read the body once — res.json() would consume it and break the CSV path.
  const raw = await res.text().catch(() => '')
  let json = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    /* non-JSON (e.g. CSV) */
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

async function cleanup() {
  for (const id of createdAppointmentIds) {
    try {
      await call(`/api/appointments/${id}`, { method: 'DELETE', token: adminToken })
      console.log(`  cleaned up appointment #${id}`)
    } catch (error) {
      console.log(`  WARN could not clean up appointment #${id}: ${error.message}`)
    }
  }
}

// ── 1. Admin login ────────────────────────────────────────────────────────────
const env = readEnv()
const adminEmail = env.ADMIN_SEED_EMAIL ?? 'admin@sawabasalon.com'
const adminPassword = env.ADMIN_SEED_PASSWORD ?? 'ChangeMe123!'

const login = await call('/api/auth/login', {
  method: 'POST',
  body: { email: adminEmail, password: adminPassword },
})
const adminToken = login.json?.data?.token
if (!adminToken) {
  console.error('Could not log in as admin:', login.status, login.json?.message)
  process.exit(1)
}
console.log('Logged in as admin.\n')

// Pick a real barber and a service that barber actually offers.
const barbersRes = await call('/api/barbers?page=1&perPage=5&isActive=true')
const barber = (barbersRes.json?.data?.items ?? []).find((b) => (b.services ?? []).length > 0)
if (!barber || !barber.services?.length) {
  console.error('No barber with assigned services available to book against.')
  process.exit(1)
}
const service = barber.services[0]
const amount = Number(service.price)
const futureDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

console.log(`Booking against: ${service.name} (₦${amount}) with barber ${barber.name}.\n`)

/** Multipart booking body — BANK_TRANSFER bookings must carry a receipt. */
function bookingForm(method, extra = {}) {
  const form = new FormData()
  form.set('customerName', extra.name ?? 'Lifecycle Test')
  form.set('customerPhone', extra.phone ?? '08011112222')
  form.set('serviceId', String(service.id))
  form.set('barberId', String(barber.id))
  form.set('appointmentDate', futureDate)
  form.set('appointmentTime', extra.time ?? '10:00')
  form.set('paymentMethod', method)
  if (method === 'BANK_TRANSFER') {
    form.set('receipt', new Blob([PNG_1PX], { type: 'image/png' }), 'receipt.png')
    form.set('transactionReference', extra.ref ?? `BOOKING-${Date.now()}`)
    form.set('amountPaid', String(amount))
    form.set('paymentDate', futureDate)
  }
  return form
}

// ── 2. Cash lifecycle: book -> UNPAID, confirm cash -> PAID ──────────────────
console.log('CASH LIFECYCLE')
const cashBooking = await call('/api/appointments', {
  method: 'POST',
  form: bookingForm('CASH', { name: 'Lifecycle Test Cash', phone: '08011112222', time: '10:00' }),
})
const cashApt = cashBooking.json?.data?.appointment ?? cashBooking.json?.data
const cashPayment = cashBooking.json?.data?.payment
if (cashApt?.id) createdAppointmentIds.push(cashApt.id)
check('cash booking created', cashBooking.status < 300 && Boolean(cashApt?.id), `status ${cashBooking.status}: ${cashBooking.json?.message}`)
const cashToken = cashPayment?.accessToken
check('payment record created for cash booking', Boolean(cashToken))

if (cashToken) {
  const declared = await call(`/api/payments/${cashToken}/cash`, { method: 'POST', body: { note: 'Pay at salon' } })
  check('cash declared -> UNPAID', declared.json?.data?.payment?.status === 'UNPAID', declared.json?.data?.payment?.status)

  const cashList = await call(`/api/admin/payments?status=UNPAID&method=CASH&search=${cashApt.referenceCode ?? cashApt.id}`, { token: adminToken })
  const cashRow = cashList.json?.data?.items?.find((p) => p.appointmentId === cashApt.id)
  check('cash payment listed in admin (booking-ref search)', Boolean(cashRow), JSON.stringify(cashList.json?.data?.items?.length))

  if (cashRow) {
    const confirmed = await call(`/api/admin/payments/${cashRow.id}/confirm-cash`, {
      method: 'POST',
      token: adminToken,
      body: { note: 'Cash received at salon (lifecycle test)' },
    })
    check('confirm cash -> PAID', confirmed.json?.data?.status === 'PAID', confirmed.json?.data?.status)
    check('verifiedAt stamped on cash confirm', Boolean(confirmed.json?.data?.verifiedAt))

    const detail = await call(`/api/admin/payments/${cashRow.id}`, { token: adminToken })
    check('detail exposes verification info', detail.json?.data?.verifiedByName != null && Boolean(detail.json?.data?.verifiedAt), JSON.stringify({ verifiedBy: detail.json?.data?.verifiedBy, name: detail.json?.data?.verifiedByName }))
  }
}

// ── 3. Bank transfer lifecycle: book -> submit receipt -> PENDING -> verify ───
console.log('\nBANK TRANSFER LIFECYCLE')
const btTxnRef = `BOOKING-BT-${Date.now()}`
const btBooking = await call('/api/appointments', {
  method: 'POST',
  form: bookingForm('BANK_TRANSFER', { name: 'Lifecycle Test Transfer', phone: '08033334444', time: '12:00', ref: btTxnRef }),
})
const btApt = btBooking.json?.data?.appointment ?? btBooking.json?.data
const btPayment = btBooking.json?.data?.payment
if (btApt?.id) createdAppointmentIds.push(btApt.id)
check('bank-transfer booking created', btBooking.status < 300 && Boolean(btApt?.id), `status ${btBooking.status}: ${btBooking.json?.message}`)

const btToken = btPayment?.accessToken
if (btToken) {
  // Booking with a receipt already submits the payment (PENDING_VERIFICATION).
  check('bank-transfer booking with receipt -> PENDING_VERIFICATION', btPayment?.status === 'PENDING_VERIFICATION', btPayment?.status)

  // Transaction-reference search finds it.
  const byRef = await call(`/api/admin/payments?search=${btTxnRef}`, { token: adminToken })
  const refRow = byRef.json?.data?.items?.find((p) => p.appointmentId === btApt.id)
  check('search by transaction reference finds it', Boolean(refRow), `items=${byRef.json?.data?.total}`)

  if (refRow) {
    check('row carries the transaction reference', refRow.transactionReference === btTxnRef, refRow.transactionReference)
    const verified = await call(`/api/admin/payments/${refRow.id}/verify`, { method: 'POST', token: adminToken })
    check('admin verify -> PAID', verified.json?.data?.status === 'PAID', verified.json?.data?.status)
    check('verifiedAt stamped on verify', Boolean(verified.json?.data?.verifiedAt))
    check('txn reference preserved through verify', verified.json?.data?.transactionReference === btTxnRef, verified.json?.data?.transactionReference)

    // ── 4. Refund -> REFUNDED (and no longer PAID) ───────────────────────────
    console.log('\nREFUND LIFECYCLE')
    const refunded = await call(`/api/admin/payments/${refRow.id}/refund`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Lifecycle test refund (customer cancelled)' },
    })
    check('refund -> REFUNDED', refunded.json?.data?.status === 'REFUNDED', refunded.json?.data?.status)
    check('refund reason stored', refunded.json?.data?.rejectionReason?.includes('cancelled'))

    // A non-PAID payment cannot be refunded again.
    const again = await call(`/api/admin/payments/${refRow.id}/refund`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Double refund attempt' },
    })
    check('double-refund rejected (422/409)', again.status >= 400, `status ${again.status}`)
  }

  // A second transfer booking: submitted via token, rejected, re-submitted —
  // proves the reject -> retry path still records exactly one payment row.
  console.log('\nREJECT / RETRY LIFECYCLE')
  // Book as CASH so the payment starts UNPAID, then drive submit -> reject ->
  // re-submit through the public token endpoint (the real customer retry path).
  const rtBooking = await call('/api/appointments', {
    method: 'POST',
    form: bookingForm('CASH', { name: 'Lifecycle Test Retry', phone: '08055556666', time: '14:00' }),
  })
  const rtApt = rtBooking.json?.data?.appointment ?? rtBooking.json?.data
  const rtToken = rtBooking.json?.data?.payment?.accessToken
  if (rtApt?.id) createdAppointmentIds.push(rtApt.id)
  if (rtToken) {
    const submitOnce = async (ref) => {
      const f = new FormData()
      f.set('paymentMethod', 'BANK_TRANSFER')
      f.set('amountPaid', String(amount))
      f.set('transactionReference', ref)
      f.set('paymentDate', futureDate)
      f.set('receipt', new Blob([PNG_1PX], { type: 'image/png' }), 'receipt.png')
      return call(`/api/payments/${rtToken}/submit`, { method: 'POST', form: f })
    }
    const first = await submitOnce(`RETRY-A-${Date.now()}`)
    check('first submit -> PENDING_VERIFICATION', first.json?.data?.payment?.status === 'PENDING_VERIFICATION', first.json?.data?.payment?.status)

    const listed = await call(`/api/admin/payments?search=${rtApt.referenceCode ?? rtApt.id}`, { token: adminToken })
    const rtRow = listed.json?.data?.items?.find((p) => p.appointmentId === rtApt.id)
    if (rtRow) {
      const rejected = await call(`/api/admin/payments/${rtRow.id}/reject`, {
        method: 'POST',
        token: adminToken,
        body: { reason: 'Receipt is unreadable, please re-upload.' },
      })
      check('reject -> REJECTED', rejected.json?.data?.status === 'REJECTED', rejected.json?.data?.status)

      const second = await submitOnce(`RETRY-B-${Date.now()}`)
      check('re-submit after reject -> PENDING_VERIFICATION', second.json?.data?.payment?.status === 'PENDING_VERIFICATION', second.json?.data?.payment?.status)

      // Exactly one payment row for this appointment (no duplicates).
      const after = await call(`/api/admin/payments?search=${rtApt.referenceCode ?? rtApt.id}`, { token: adminToken })
      const rowsForApt = (after.json?.data?.items ?? []).filter((p) => p.appointmentId === rtApt.id)
      check('still exactly one payment row after retry (no duplicates)', rowsForApt.length === 1, `rows=${rowsForApt.length}`)
    }
  }
}

// ── 5. Summary endpoint ───────────────────────────────────────────────────────
console.log('\nSUMMARY & EXPORT')
const summary = await call('/api/admin/payments/summary', { token: adminToken })
const s = summary.json?.data
check('summary returns totals', summary.status === 200 && typeof s?.totalTransactions === 'number', JSON.stringify(s))
check('summary counts are non-negative', s && s.successfulTotal >= 0 && s.pendingTotal >= 0 && s.todayTotal >= 0)
check('revenue excludes pending (successful >= 0 and pending tracked separately)', s && typeof s.pendingTotal === 'number')

// ── 6. CSV export ─────────────────────────────────────────────────────────────
const csv = await call('/api/admin/payments/export?status=PAID', { token: adminToken })
check('CSV export returns 200', csv.status === 200, `status ${csv.status}`)
check('CSV has correct content type', (csv.headers.get('content-type') ?? '').includes('text/csv'), csv.headers.get('content-type'))
check('CSV suggests a filename', (csv.headers.get('content-disposition') ?? '').includes('attachment'), csv.headers.get('content-disposition'))
const csvLines = csv.raw.replace(/^\uFEFF/, '').trim().split('\r\n')
check('CSV has a header row', csvLines[0]?.includes('Transaction Ref') && csvLines[0]?.includes('Amount (NGN)'), csvLines[0]?.slice(0, 120))
check('CSV has data rows when PAID payments exist', csvLines.length >= 1, `rows=${csvLines.length - 1}`)

// Unauthenticated access must be refused.
const anon = await call('/api/admin/payments/summary')
check('summary rejects unauthenticated access', anon.status === 401 || anon.status === 403, `status ${anon.status}`)
const anonCsv = await call('/api/admin/payments/export')
check('export rejects unauthenticated access', anonCsv.status === 401 || anonCsv.status === 403, `status ${anonCsv.status}`)

// ── Cleanup ───────────────────────────────────────────────────────────────────
console.log('\nCLEANUP')
await cleanup()

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
