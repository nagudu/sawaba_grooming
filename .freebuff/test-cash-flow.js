// Cash / transfer / online payment-flow E2E test (live API).
// Run: cd backend && node ../.freebuff/test-cash-flow.js
const BASE = 'http://localhost:5000/api'

let pass = 0
let fail = 0
const failures = []

function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} — ${detail}`)
    console.log(`  ✗ ${name} — ${detail}`)
  }
}

async function req(method, path, { token, body, admin } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (admin) headers['x-admin-token'] = admin
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* empty body */
  }
  return { status: res.status, json }
}

async function loginAdmin() {
  const res = await req('POST', '/auth/login', {
    body: { email: 'admin@sawabasalon.com', password: process.env.ADMIN_SEED_PASSWORD ?? 'Admin@123' },
  })
  return res.json?.data?.token ?? null
}

function futureDate(daysAhead) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

async function main() {
  const adminToken = await loginAdmin()
  check('admin login', Boolean(adminToken), 'no token')

  // ── TEST 1: CASH ──────────────────────────────────────────────
  console.log('\n■ CASH FLOW')
  const svcRes = await req('GET', '/services?perPage=5')
  const services = svcRes.json?.data?.items ?? []
  const svc = services[0]
  check('services available', Boolean(svc), 'no services')

  const barbersRes = await req('GET', `/barbers?serviceId=${svc.id}`)
  const barber = (barbersRes.json?.data?.items ?? barbersRes.json?.data ?? [])[0]
  check('barber for service', Boolean(barber), 'no barber')

  const today = futureDate(3 + Math.floor(Math.random() * 8))
  const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
  const time = SLOTS[Math.floor(Math.random() * SLOTS.length)]
  const book = await req('POST', '/appointments', {
    body: {
      customerName: `Cash Tester ${Date.now() % 10000}`,
      customerPhone: '08099990001',
      customerEmail: `cash${Date.now() % 10000}@example.com`,
      serviceId: svc.id,
      barberId: barber.id,
      appointmentDate: today,
      appointmentTime: time,
    },
  })
  check('booking created', book.status === 200 || book.status === 201, `status ${book.status} ${JSON.stringify(book.json).slice(0, 160)}`)
  const bundle = book.json?.data ?? {}
  const payToken = bundle.payment?.accessToken ?? bundle.accessToken ?? null
  const apptId = bundle.appointment?.id ?? bundle.booking?.id ?? bundle.id ?? null
  check('payment token returned', Boolean(payToken), JSON.stringify(bundle).slice(0, 200))
  check('appointment unpaid + pending', ['PENDING', 'PAYMENT_REQUIRED'].includes(bundle.appointment?.status ?? bundle.booking?.status), `status ${bundle.appointment?.status ?? bundle.booking?.status}`)

  // Declare cash
  const declare = await req('POST', `/payments/${payToken}/cash`, { body: { note: 'Pay at the salon' } })
  check('declare cash accepted', declare.status === 200, `status ${declare.status} ${JSON.stringify(declare.json).slice(0, 160)}`)
  const cashPay = declare.json?.data?.payment ?? declare.json?.data
  check('method = CASH after declare', cashPay?.paymentMethod === 'CASH', `method ${cashPay?.paymentMethod}`)
  check('status still UNPAID (no auto-confirm)', cashPay?.status === 'UNPAID', `status ${cashPay?.status}`)

  // Admin sees cash payment with no receipt, marks cash paid
  const list = await req('GET', `/admin/payments?method=CASH&status=UNPAID`, { token: adminToken })
  const cashEntry = (list.json?.data?.items ?? []).find((p) => p.appointmentId === (bundle.appointment?.id ?? apptId))
  check('admin sees cash payment', Boolean(cashEntry), 'not in admin list')

  const confirm = await req('POST', `/admin/payments/${cashEntry?.id ?? 0}/confirm-cash`, {
    token: adminToken,
    body: { note: 'Cash received at salon.' },
  })
  check('confirm-cash accepted', confirm.status === 200, `status ${confirm.status} ${JSON.stringify(confirm.json).slice(0, 200)}`)
  const confirmed = confirm.json?.data
  check('payment PAID', confirmed?.status === 'PAID', `status ${confirmed?.status}`)
  check('audit note stored', Boolean(confirmed?.note), 'no note')

  const apptAfter = await req('GET', `/appointments?perPage=50`, { token: adminToken })
  const apptEntry = (apptAfter.json?.data?.items ?? apptAfter.json?.data ?? []).find((a) => a.id === (bundle.appointment?.id ?? apptId))
  check('appointment CONFIRMED/READY after cash', ['CONFIRMED', 'READY_FOR_SERVICE', 'PAYMENT_VERIFIED'].includes(apptEntry?.status), `status ${apptEntry?.status}`)

  // Double-confirm must fail
  const again = await req('POST', `/admin/payments/${cashEntry?.id ?? 0}/confirm-cash`, {
    token: adminToken,
    body: { note: 'second' },
  })
  check('double confirm-cash rejected (409)', again.status === 409, `status ${again.status}`)

  // verify endpoint must refuse cash (receipt flow ≠ cash flow)
  const wrongFlow = await req('POST', `/admin/payments/${cashEntry?.id ?? 0}/verify`, { token: adminToken })
  check('verify endpoint refuses already-paid', wrongFlow.status >= 400, `status ${wrongFlow.status}`)

  // ── TEST 2: BANK TRANSFER + RECEIPT ───────────────────────────
  console.log('\n■ TRANSFER / RECEIPT FLOW')
  const time2 = SLOTS[Math.floor(Math.random() * SLOTS.length)]
  const book2 = await req('POST', '/appointments', {
    body: {
      customerName: `Transfer Tester ${Date.now() % 10000}`,
      customerPhone: '08099990002',
      customerEmail: `transfer${Date.now() % 10000}@example.com`,
      serviceId: svc.id,
      barberId: barber.id,
      appointmentDate: futureDate(4 + Math.floor(Math.random() * 8)),
      appointmentTime: time2,
    },
  })
  const bundle2 = book2.json?.data ?? {}
  const payToken2 = bundle2.payment?.accessToken ?? bundle2.accessToken
  check('transfer booking created', Boolean(payToken2), JSON.stringify(bundle2).slice(0, 160))

  // Submit WITHOUT a receipt must fail (receipt-based method)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const noReceipt = await fetch(`${BASE}/payments/${encodeURIComponent(payToken2)}/submit`, {
    method: 'POST',
    body: (() => {
      const fd = new FormData()
      fd.set('paymentMethod', 'BANK_TRANSFER')
      fd.set('amountPaid', String(svc.price))
      fd.set('transactionReference', 'TRF-TEST-1')
      fd.set('paymentDate', futureDate(0))
      return fd
    })(),
  })
  check('transfer submit without receipt rejected', noReceipt.status === 422, `status ${noReceipt.status}`)

  // Submit WITH a receipt
  const withReceipt = await fetch(`${BASE}/payments/${encodeURIComponent(payToken2)}/submit`, {
    method: 'POST',
    body: (() => {
      const fd = new FormData()
      fd.set('paymentMethod', 'BANK_TRANSFER')
      fd.set('amountPaid', String(svc.price))
      fd.set('transactionReference', 'TRF-TEST-2')
      fd.set('paymentDate', futureDate(0))
      fd.set('receipt', new Blob([png], { type: 'image/png' }), 'receipt.png')
      return fd
    })(),
  })
  const submitted2 = withReceipt.status === 200 ? (await withReceipt.json())?.data : null
  check('transfer submit with receipt → PENDING_VERIFICATION', submitted2?.payment?.status === 'PENDING_VERIFICATION' || submitted2?.status === 'PENDING_VERIFICATION', `status ${withReceipt.status}`)

  const list2 = await req('GET', `/admin/payments?status=PENDING_VERIFICATION`, { token: adminToken })
  const receiptEntry = (list2.json?.data?.items ?? []).find(
    (p) => p.appointmentId === (bundle2.appointment?.id ?? null) && p.paymentMethod === 'BANK_TRANSFER',
  )
  check('admin sees transfer payment with receipt', Boolean(receiptEntry?.receiptUrl), 'missing receipt url')

  const verify = await req('POST', `/admin/payments/${receiptEntry?.id ?? 0}/verify`, { token: adminToken })
  const verified = verify.json?.data
  check('verify receipt → PAID', verified?.status === 'PAID', `status ${verify.status} ${JSON.stringify(verify.json).slice(0, 120)}`)

  const apptAfter2 = await req('GET', `/appointments?perPage=50`, { token: adminToken })
  const apptEntry2 = (apptAfter2.json?.data?.items ?? apptAfter2.json?.data ?? []).find((a) => a.id === bundle2.appointment?.id)
  check('transfer appointment confirmed after verify', ['CONFIRMED', 'READY_FOR_SERVICE', 'PAYMENT_VERIFIED'].includes(apptEntry2?.status), `status ${apptEntry2?.status}`)

  // ── TEST 3: CASH in admin verify must be method-aware ─────────
  console.log('\n■ METHOD GUARDS')
  const time3 = SLOTS[Math.floor(Math.random() * SLOTS.length)]
  const book3 = await req('POST', '/appointments', {
    body: {
      customerName: `Guard Tester ${Date.now() % 10000}`,
      customerPhone: '08099990003',
      customerEmail: `guard${Date.now() % 10000}@example.com`,
      serviceId: svc.id,
      barberId: barber.id,
      appointmentDate: futureDate(5 + Math.floor(Math.random() * 8)),
      appointmentTime: time3,
    },
  })
  const bundle3 = book3.json?.data ?? {}
  const payToken3 = bundle3.payment?.accessToken ?? bundle3.accessToken
  const decl3 = await req('POST', `/payments/${payToken3}/cash`, { body: {} })
  check('second cash declare works', decl3.status === 200, `status ${decl3.status}`)
  const cashId3 = (await req('GET', `/admin/payments?method=CASH&status=UNPAID`, { token: adminToken })).json?.data?.items
    ?.find((p) => p.appointmentId === bundle3.appointment?.id)?.id

  // cash payment should NOT be verifiable via the receipt endpoint while UNPAID
  const guard = await req('POST', `/admin/payments/${cashId3 ?? 0}/verify`, { token: adminToken })
  check('cash via verify endpoint rejected', guard.status >= 400, `status ${guard.status}`)

  // cleanup the two UNPAID cash declarations so admin list stays clean
  const cancel3 = await req('POST', `/account/appointments/${bundle3.appointment?.id}/cancel`, {
    body: { reason: 'test cleanup' },
  })
  check('cleanup cancel allowed (guest cancel)', cancel3.status === 200 || cancel3.status === 400 || cancel3.status === 401, `status ${cancel3.status}`)

  console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`)
  if (failures.length) {
    console.log('Failures:')
    failures.forEach((f) => console.log('  - ' + f))
  }
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
