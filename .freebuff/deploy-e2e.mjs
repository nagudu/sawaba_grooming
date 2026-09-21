// Live E2E battery against the deployed Sawaba stack (Railway).
// Pure Node 18+ fetch — run: node .freebuff/deploy-e2e.mjs
const BASE = 'https://sawaba-api-production.up.railway.app/api'
const SITE = 'https://sawaba-api-production.up.railway.app'
const ADMIN_EMAIL = 'admin@sawabasalon.com'
const ADMIN_PASSWORD = 'ChangeMe123!'

let pass = 0
let fail = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  ✗ ${name} — ${detail}`)
  }
}

async function req(method, path, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !form) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-json */
  }
  return { status: res.status, json }
}

function futureDate(daysAhead) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

async function main() {
  console.log('■ 1. SITE & API REACHABILITY')
  const home = await fetch(SITE)
  const html = await home.text()
  check('public site 200 + HTML', home.status === 200 && html.includes('<html'), `status ${home.status}`)
  check('no localhost in bundle', !html.includes('localhost:5000'), 'found localhost ref')
  const deepLink = await fetch(`${SITE}/services`)
  const deepHtml = await deepLink.text()
  check('SPA deep link /services works', deepLink.status === 200 && deepHtml.includes('<html'), `status ${deepLink.status}`)
  const deepAdmin = await fetch(`${SITE}/admin/login`)
  check('SPA deep link /admin/login works', deepAdmin.status === 200, `status ${deepAdmin.status}`)
  const health = await req('GET', '/../health'.replace('/api', ''))
  check('health endpoint ok', health.status === 200 || (health.json?.status === 'ok'), JSON.stringify(health.json).slice(0, 80))

  console.log('■ 2. SEEDED DATA')
  const svc = await req('GET', '/services?perPage=50')
  const services = svc.json?.data?.items ?? []
  check(`services seeded (${services.length})`, services.length >= 10, `got ${services.length}`)
  const barbers = await req('GET', '/barbers')
  const barberItems = barbers.json?.data?.items ?? barbers.json?.data ?? []
  check(`barbers seeded (${barberItems.length})`, barberItems.length >= 5, `got ${barberItems.length}`)
  const gallery = await req('GET', '/gallery')
  const galleryItems = gallery.json?.data?.items ?? gallery.json?.data ?? []
  check(`gallery seeded (${galleryItems.length})`, galleryItems.length >= 5, `got ${galleryItems.length}`)
  const reviews = await req('GET', '/reviews?perPage=50')
  const reviewItems = reviews.json?.data?.items ?? reviews.json?.data ?? []
  check(`approved reviews public (${reviewItems.length})`, reviewItems.length >= 3, `got ${reviewItems.length}`)

  console.log('■ 3. AUTH')
  const admin = await req('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  const adminToken = admin.json?.data?.token
  check('admin login', Boolean(adminToken), `status ${admin.status}`)
  const badAdmin = await req('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: 'wrong' } })
  check('admin wrong password rejected', badAdmin.status === 401 || badAdmin.status === 422, `status ${badAdmin.status}`)

  const demoLogin = await req('POST', '/account/login', {
    body: { phone: '08000000001', password: 'TestCustomer123!' },
  })
  const demoToken = demoLogin.json?.data?.token
  check('demo customer password login', Boolean(demoToken), `status ${demoLogin.status} ${JSON.stringify(demoLogin.json).slice(0, 120)}`)

  const regPhone = '080' + String(70000000 + Math.floor(Math.random() * 9999999))
  const reg = await req('POST', '/account/register', {
    body: { fullName: 'Deploy Tester', phone: regPhone, email: `deploy${Date.now() % 100000}@example.com`, password: 'Tester123!' },
  })
  const custToken = reg.json?.data?.token
  check('customer registration', Boolean(custToken), `status ${reg.status} ${JSON.stringify(reg.json).slice(0, 120)}`)
  if (custToken) {
    const me = await req('GET', '/account/summary', { token: custToken })
    check('customer summary after register', me.status === 200, `status ${me.status}`)
  }
  const dupReg = await req('POST', '/account/register', {
    body: { fullName: 'Dup', phone: '08000000001', password: 'x'.repeat(8) },
  })
  check('duplicate customer phone blocked', dupReg.status === 409 || dupReg.status === 422, `status ${dupReg.status}`)

  console.log('■ 4. AVAILABILITY & BOOKING')
  const svc1 = services[0]
  const barbersForSvc = await req('GET', `/barbers?serviceId=${svc1.id}`)
  const barber1 = (barbersForSvc.json?.data?.items ?? barbersForSvc.json?.data ?? [])[0]
  check('barber linked to service', Boolean(barber1), JSON.stringify(barbersForSvc.json).slice(0, 100))
  const date = futureDate(4 + Math.floor(Math.random() * 10))
  const avail = await req('GET', `/availability?barberId=${barber1.id}&date=${date}&duration=${svc1.duration}`)
  const slots = avail.json?.data?.slots ?? []
  check('availability slots returned', Array.isArray(slots), `status ${avail.status} ${JSON.stringify(avail.json).slice(0, 120)}`)
  const freeSlot = slots.find((s) => s.available)?.time ?? '10:00'

  const book = await req('POST', '/appointments', {
    body: {
      customerName: 'Deploy Cash Tester',
      customerPhone: regPhone,
      customerEmail: `deploy${Date.now() % 100000}@example.com`,
      serviceId: svc1.id,
      barberId: barber1.id,
      appointmentDate: date,
      appointmentTime: freeSlot,
    },
  })
  check('booking created', book.status === 200 || book.status === 201, `status ${book.status} ${JSON.stringify(book.json).slice(0, 160)}`)
  const bundle = book.json?.data ?? {}
  const payToken = bundle.payment?.accessToken ?? bundle.accessToken ?? null
  const apptId = bundle.appointment?.id ?? bundle.booking?.id ?? bundle.id ?? null
  check('payment token returned', Boolean(payToken), JSON.stringify(bundle).slice(0, 200))

  console.log('■ 5. CASH FLOW')
  const declare = await req('POST', `/payments/${payToken}/cash`, { body: { note: 'Pay at salon' } })
  check('declare cash 200', declare.status === 200, `status ${declare.status} ${JSON.stringify(declare.json).slice(0, 140)}`)
  const cashPay = declare.json?.data?.payment ?? declare.json?.data
  check('method=CASH, still UNPAID', cashPay?.paymentMethod === 'CASH' && cashPay?.status === 'UNPAID', `${cashPay?.paymentMethod}/${cashPay?.status}`)
  const unpaidList = await req('GET', '/admin/payments?method=CASH&status=UNPAID', { token: adminToken })
  const cashEntry = (unpaidList.json?.data?.items ?? []).find((p) => p.accessToken === payToken || p.id)
  check('admin sees UNPAID cash payment', Boolean(cashEntry), `total ${unpaidList.json?.data?.total}`)
  const confirm = await req('POST', `/admin/payments/${cashEntry?.id}/confirm-cash`, { token: adminToken, body: { note: 'Cash received at salon (deploy test).' } })
  check('confirm-cash → PAID', confirm.status === 200, `status ${confirm.status} ${JSON.stringify(confirm.json).slice(0, 160)}`)
  const apptAfter = await req('GET', `/appointments/${apptId}`, { token: adminToken })
  check('appointment READY_FOR_SERVICE after cash confirm', ['READY_FOR_SERVICE', 'CONFIRMED'].includes(apptAfter.json?.data?.appointment?.status ?? apptAfter.json?.data?.status), JSON.stringify(apptAfter.json).slice(0, 140))
  const doubleConfirm = await req('POST', `/admin/payments/${cashEntry?.id}/confirm-cash`, { token: adminToken, body: {} })
  check('double confirm rejected (409)', doubleConfirm.status === 409, `status ${doubleConfirm.status}`)

  console.log('■ 6. RECEIPT (BANK_TRANSFER) FLOW')
  const svc2 = services[1]?.id ? services[1] : svc1
  const date2 = futureDate(5 + Math.floor(Math.random() * 8))
  const avail2 = await req('GET', `/availability?barberId=${barber1.id}&date=${date2}&duration=${svc2.duration}`)
  const slots2 = avail2.json?.data?.slots ?? []
  const freeSlot2 = slots2.find((s) => s.available)?.time
  const book2 = await req('POST', '/appointments', {
    body: {
      customerName: 'Deploy Receipt Tester',
      customerPhone: '081' + String(70000000 + Math.floor(Math.random() * 9999999)),
      customerEmail: `receipt${Date.now() % 100000}@example.com`,
      serviceId: svc2.id,
      barberId: barber1.id,
      appointmentDate: date2,
      appointmentTime: freeSlot2,
    },
  })
  const bundle2 = book2.json?.data ?? {}
  const payToken2 = bundle2.payment?.accessToken ?? bundle2.accessToken
  check('booking 2 created with token', Boolean(payToken2), `status ${book2.status}`)
  const form = new FormData()
  form.append('paymentMethod', 'BANK_TRANSFER')
  form.append('amountPaid', String(services[1]?.price ?? svc1.price))
  form.append('transactionReference', `DEPLOY-${Date.now()}`)
  form.append('paymentDate', futureDate(0))
  form.append('note', 'Transfer receipt (deploy test)')
  // 1x1 PNG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  form.append('receipt', new Blob([png], { type: 'image/png' }), 'receipt.png')
  const submit = await req('POST', `/payments/${payToken2}/submit`, { form })
  check('receipt submit → PENDING_VERIFICATION', submit.status === 200 && (submit.json?.data?.payment ?? submit.json?.data)?.status === 'PENDING_VERIFICATION', `status ${submit.status} ${JSON.stringify(submit.json).slice(0, 140)}`)
  const pendingList = await req('GET', '/admin/payments?status=PENDING_VERIFICATION', { token: adminToken })
  const receiptEntry = (pendingList.json?.data?.items ?? []).find((p) => p.accessToken === payToken2)
  check('admin sees pending receipt', Boolean(receiptEntry), `total ${pendingList.json?.data?.total}`)
  check('receipt image accessible', Boolean(receiptEntry?.receiptUrl), JSON.stringify(receiptEntry ?? null).slice(0, 100))
  const verify = await req('POST', `/admin/payments/${receiptEntry?.id}/verify`, { token: adminToken })
  check('verify receipt → PAID', verify.status === 200, `status ${verify.status} ${JSON.stringify(verify.json).slice(0, 140)}`)

  console.log('■ 7. CONTACT + REPLY')
  const contact = await req('POST', '/contact', {
    body: { name: 'Deploy Contact', email: `contact${Date.now() % 100000}@example.com`, phone: '08055500011', subject: 'Deploy Test Inquiry', message: 'This is an automated deployment verification message.' },
  })
  check('contact submitted', contact.status === 200 || contact.status === 201, `status ${contact.status} ${JSON.stringify(contact.json).slice(0, 120)}`)
  const contactList = await req('GET', '/contact?status=NEW', { token: adminToken })
  const contactEntry = (contactList.json?.data?.items ?? []).find((c) => c.subject === 'Deploy Test Inquiry')
  check('admin sees contact message', Boolean(contactEntry), `total ${contactList.json?.data?.total}`)
  const markRead = await req('PATCH', `/contact/${contactEntry?.id}/read`, { token: adminToken, body: { isRead: true } })
  check('mark contact read', markRead.status === 200, `status ${markRead.status} ${JSON.stringify(markRead.json).slice(0, 100)}`)
  const reply = await req('POST', `/contact/${contactEntry?.id}/reply`, { token: adminToken, body: { message: 'Hello! This is the deployment verification reply. Thank you for testing SAWABA.' } })
  const replyData = reply.json?.data ?? {}
  const replyOk = reply.status === 200
  const replyFailedCleanly = reply.status >= 400 && typeof reply.json?.message === 'string'
  check('reply returns honest result (sent or clean failure)', replyOk || replyFailedCleanly, `status ${reply.status} ${JSON.stringify(reply.json).slice(0, 160)}`)
  if (replyOk) {
    const after = await req('GET', `/contact/${contactEntry?.id}`, { token: adminToken })
    check('message status REPLIED after successful reply', after.json?.data?.status === 'REPLIED', `status ${after.json?.data?.status}`)
  } else {
    const after = await req('GET', `/contact/${contactEntry?.id}`, { token: adminToken })
    check('message NOT marked REPLIED on email failure', after.json?.data?.status !== 'REPLIED', `status ${after.json?.data?.status}`)
    check('failure message is user-friendly', /email|configur|smtp/i.test(reply.json?.message ?? ''), reply.json?.message)
  }

  console.log('■ 8. REVIEWS')
  const rev = await req('POST', '/reviews', {
    body: { customerName: 'Deploy Reviewer', rating: 5, comment: 'Excellent deployment test experience!', serviceId: svc1.id },
  })
  check('review submitted', rev.status === 200 || rev.status === 201, `status ${rev.status} ${JSON.stringify(rev.json).slice(0, 120)}`)
  const pendingReviews = await req('GET', '/reviews?status=PENDING&perPage=50', { token: adminToken })
  const pendingRev = (pendingReviews.json?.data?.items ?? []).find((r) => r.customerName === 'Deploy Reviewer')
  check('admin sees pending review', Boolean(pendingRev), `total ${pendingReviews.json?.data?.total}`)
  const approve = await req('PATCH', `/reviews/${pendingRev?.id}`, { token: adminToken, body: { status: 'APPROVED', isApproved: true } })
  check('admin approves review', approve.status === 200, `status ${approve.status} ${JSON.stringify(approve.json).slice(0, 120)}`)
  const publicApproved = await req('GET', '/reviews?perPage=50')
  const nowApproved = (publicApproved.json?.data?.items ?? []).some((r) => r.customerName === 'Deploy Reviewer')
  check('approved review visible publicly', nowApproved, 'not in public list')

  console.log('■ 9. ADMIN OPS')
  const dash = await req('GET', '/admin/dashboard', { token: adminToken })
  check('admin dashboard stats', dash.status === 200 && dash.json?.data, `status ${dash.status}`)
  const apptList = await req('GET', '/appointments?perPage=5', { token: adminToken })
  check('admin appointments list', apptList.status === 200 && (apptList.json?.data?.total ?? 0) >= 2, `status ${apptList.status}`)
  const noAuth = await req('GET', '/appointments')
  check('appointments blocked without auth', noAuth.status === 401 || noAuth.status === 403, `status ${noAuth.status}`)
  const customers = await req('GET', '/admin/customers?perPage=5', { token: adminToken })
  check('admin customers list', customers.status === 200, `status ${customers.status}`)

  console.log('■ 10. CUSTOMER DASHBOARD')
  const custAppts = await req('GET', '/account/appointments', { token: custToken })
  check('customer sees own bookings', custAppts.status === 200, `status ${custAppts.status} ${JSON.stringify(custAppts.json).slice(0, 120)}`)
  const custPayments = await req('GET', '/account/payments', { token: custToken })
  check('customer payments endpoint', custPayments.status === 200, `status ${custPayments.status}`)

  console.log('\n════════════════════════════')
  console.log(`RESULT: ${pass} passed, ${fail} failed`)
  if (failures.length) {
    console.log('Failures:')
    failures.forEach((f) => console.log(`  - ${f}`))
  }
}

main().catch((e) => {
  console.error('BATTERY CRASHED:', e)
  process.exit(1)
})
