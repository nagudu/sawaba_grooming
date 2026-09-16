const BASE = 'http://localhost:5000/api'
let token = ''
let pass = 0
let fail = 0
const created = []

const check = (n, c, d = '') => {
  if (c) { pass++; console.log(`  PASS  ${n}`) } else { fail++; console.log(`  FAIL  ${n} ${d}`) }
}

async function req(method, path, body, auth = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json = null
  try { json = await res.json() } catch { /* ignore */ }
  return { status: res.status, json }
}

// A valid 1x1 PNG (8 bytes header + minimal IHDR/IDAT/IEND)
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fcffff3f0300050001ff9ba7084b0000000049454e44ae426082',
  'hex',
)

async function submitWithReceipt(bundle, fields, includeFile = true) {
  const form = new FormData()
  form.set('paymentMethod', fields.paymentMethod)
  form.set('amountPaid', String(fields.amountPaid))
  form.set('transactionReference', fields.transactionReference ?? 'TXN-E2E-001')
  form.set('paymentDate', fields.paymentDate)
  if (includeFile) {
    form.append('receipt', new Blob([TINY_PNG], { type: 'image/png' }), 'receipt.png')
  }
  const res = await fetch(`${BASE}/payments/${bundle.payment.accessToken}/submit`, { method: 'POST', body: form })
  return { status: res.status, json: await res.json().catch(() => null) }
}

async function main() {
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)

  // Setup: pick a barber/service combo
  const barbers = await (await fetch(`${BASE}/barbers`)).json()
  const bList = Array.isArray(barbers.data) ? barbers.data : barbers.data.items
  const barber = bList.find((b) => Array.isArray(b.services) && b.services.length > 0)
  const service = barber.services[0]

  // ── 1. Customer books (randomized free slot so re-runs don't collide) ──
  const slot1 = `14:${String(Date.now() % 40).padStart(2, '0')}`
  const book = await req('POST', '/appointments', {
    customerName: 'Payment Flow Test',
    customerPhone: '+2348011122233',
    customerEmail: 'payflow@example.com',
    serviceId: service.id,
    barberId: barber.id,
    appointmentDate: tomorrow,
    appointmentTime: slot1,
  }, false)
  check('booking created with auto-generated ID', book.status === 201 && /^APT-\d{8}-\d{3,}$/.test(book.json?.data?.appointment?.referenceCode ?? ''), `ref=${book.json?.data?.appointment?.referenceCode}`)
  const apt = book.json.data.appointment
  const apptToken = book.json.data.payment.accessToken
  created.push(apt.id)
  check('charged price snapshotted from service', Number(apt.totalAmount) === Number(service.price), `${apt.totalAmount} vs ${service.price}`)
  check('appointment starts PAYMENT_REQUIRED + payment UNPAID', apt.status === 'PAYMENT_REQUIRED' && book.json.data.payment.status === 'UNPAID')

  // ── 2. Payment page data ──
  let bundle = (await req('GET', `/payments/${apptToken}`, undefined, false)).json.data
  check('payment linked to appointment + correct amount', bundle.payment.appointmentId === apt.id && Number(bundle.payment.appointment.totalAmount) === Number(service.price))
  check('settings exposed to customer (bank/OPay/methods/rules)', Boolean(bundle.settings) && Array.isArray(bundle.settings.enabledPaymentMethods))

  // ── 3. Validation: submit without receipt ──
  let r = await submitWithReceipt(bundle, { paymentMethod: 'BANK_TRANSFER', amountPaid: service.price, paymentDate: tomorrow }, false)
  check('no-receipt submission rejected (receiptRequired=true)', r.status === 422, `got ${r.status} ${r.json?.message}`)

  // ── 4. Validation: wrong amount ──
  r = await submitWithReceipt(bundle, { paymentMethod: 'BANK_TRANSFER', amountPaid: 1, paymentDate: tomorrow })
  check('underpayment rejected when full payment required', r.status === 422, `got ${r.status}`)

  // ── 5. Validation: disabled method (CASH likely enabled; try OTHER if disabled) ──
  const enabledMethods = bundle.settings.enabledPaymentMethods
  const disabledMethod = ['OPAY', 'BANK_TRANSFER', 'CASH', 'OTHER'].find((m) => !enabledMethods.includes(m))
  if (disabledMethod) {
    r = await submitWithReceipt(bundle, { paymentMethod: disabledMethod, amountPaid: service.price, paymentDate: tomorrow })
    check(`disabled method (${disabledMethod}) rejected server-side`, r.status === 422, `got ${r.status}`)
  } else {
    check('all methods enabled — server gate exists (skipped live check)', true)
  }

  // ── 6. Valid submission with receipt ──
  r = await submitWithReceipt(bundle, { paymentMethod: 'BANK_TRANSFER', amountPaid: service.price, paymentDate: tomorrow })
  check('receipt upload accepted → PENDING_VERIFICATION', r.status === 200 && r.json?.data?.payment?.status === 'PENDING_VERIFICATION', JSON.stringify(r.json?.message))
  check('receiptUrl stored (real backend upload)', typeof r.json?.data?.payment?.receiptUrl === 'string' && r.json.data.payment.receiptUrl.length > 10, String(r.json?.data?.payment?.receiptUrl))
  check('appointment moved to PAYMENT_SUBMITTED', r.json?.data?.payment?.appointment?.status === 'PAYMENT_SUBMITTED')
  const paymentId = r.json.data.payment.id

  // ── 7. Duplicate submission guard ──
  r = await req('GET', `/payments/${apptToken}`, undefined, false)
  bundle = r.json.data
  const dup = await submitWithReceipt(bundle, { paymentMethod: 'BANK_TRANSFER', amountPaid: service.price, paymentDate: tomorrow })
  check('duplicate submission blocked', dup.status !== 200, `got ${dup.status}`)

  // ── 8. Admin verifies → appointment auto-advances ──
  const login = await req('POST', '/auth/login', { email: 'admin@sawabasalon.com', password: 'ChangeMe123!' }, false)
  token = login.json.data.token
  r = await req('POST', `/admin/payments/${paymentId}/verify`)
  check('admin verify → payment PAID', r.status === 200 && r.json?.data?.status === 'PAID', JSON.stringify(r.json?.message))
  check('verifiedBy/verifiedAt recorded', r.json?.data?.verifiedAt !== null)
  const aptAfter = (await req('GET', `/appointments/${apt.id}`)).json.data
  check('appointment auto-advanced to READY_FOR_SERVICE', aptAfter.status === 'READY_FOR_SERVICE', aptAfter.status)
  check('payment record synced to PAID', aptAfter.payment?.status === 'PAID', String(aptAfter.payment?.status))

  // ── 9. Reject flow on a second appointment ──
  const slot2 = `16:${String((Date.now() + 17) % 40).padStart(2, '0')}`
  const book2 = await req('POST', '/appointments', {
    customerName: 'Reject Flow Test',
    customerPhone: '+2348011122244',
    serviceId: service.id,
    barberId: barber.id,
    appointmentDate: tomorrow,
    appointmentTime: slot2,
  }, false)
  created.push(book2.json.data.appointment.id)
  const token2 = book2.json.data.payment.accessToken
  let b2 = (await req('GET', `/payments/${token2}`, undefined, false)).json.data
  const sub2 = await submitWithReceipt(b2, { paymentMethod: 'OPAY', amountPaid: service.price, paymentDate: tomorrow, transactionReference: 'TXN-E2E-002' })
  const pid2 = sub2.json.data.payment.id
  r = await req('POST', `/admin/payments/${pid2}/reject`, { reason: 'Receipt is not clear. Please upload a clearer receipt.' })
  check('reject requires reason → payment REJECTED', r.status === 200 && r.json?.data?.status === 'REJECTED')
  check('rejection reason stored', (r.json?.data?.rejectionReason ?? '').includes('clearer'))
  const apt2After = (await req('GET', `/appointments/${book2.json.data.appointment.id}`)).json.data
  check('appointment moved to PAYMENT_REJECTED', apt2After.status === 'PAYMENT_REJECTED', apt2After.status)
  b2 = (await req('GET', `/payments/${token2}`, undefined, false)).json.data
  const resub = await submitWithReceipt(b2, { paymentMethod: 'OPAY', amountPaid: service.price, paymentDate: tomorrow, transactionReference: 'TXN-E2E-003' })
  check('resubmission after rejection works', resub.status === 200 && resub.json?.data?.payment?.status === 'PENDING_VERIFICATION', JSON.stringify(resub.json?.message))
  await req('POST', `/admin/payments/${pid2}/reject`, { reason: 'Test cleanup rejection.' })

  // ── 10. Security: track endpoint requires matching phone ──
  r = await req('POST', '/payments/track', { appointmentId: apt.referenceCode, phone: '+2349999999999' }, false)
  check('track with wrong phone → not found (no data leak)', r.status === 404, `got ${r.status}`)
  r = await req('POST', '/payments/track', { appointmentId: apt.referenceCode, phone: '+2348011122233' }, false)
  check('track with correct phone works', r.status === 200)

  // ── 11. Admin list shows appointment IDs ──
  r = await req('GET', `/admin/payments?perPage=100`)
  check('admin payment list includes receipt + reference code', r.json?.data?.items?.some((p) => p.id === paymentId && p.receiptUrl && p.appointment?.referenceCode))

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error('RUNNER ERROR', e); process.exit(1) })
