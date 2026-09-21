// End-to-end battery for the Internal/External barber system.
// Run: node .freebuff/barber-system-test.mjs
const BASE = 'http://localhost:5000/api'
let pass = 0
let fail = 0
const failures = []
const created = { barbers: [], appointments: [], earnings: [], sessions: [] }

function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  PASS ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function req(method, path, { body, token, raw } = {}) {
  const headers = {}
  if (body && !raw) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* leave null */
  }
  return { status: res.status, json, text }
}

async function adminLogin() {
  const env = await req('GET', '/__env__').catch(() => null) // not a real endpoint
  const { execSync } = await import('node:child_process')
  const out = execSync(
    `node -e "require('dotenv').config({path:'backend/.env'}); process.stdout.write(process.env.ADMIN_SEED_EMAIL+'|'+process.env.ADMIN_SEED_PASSWORD)"`,
    { cwd: process.cwd(), encoding: 'utf8' },
  )
  const [email, password] = out.split('|')
  const r = await req('POST', '/auth/login', { body: { email, password } })
  if (!r.json?.data?.token) throw new Error(`admin login failed: ${r.text.slice(0, 200)}`)
  return r.json.data.token
}

const DATE = '2026-11-17' // Tuesday, far future — no collisions
const DATE2 = '2026-11-18'

console.log('SETUP — admin login + fixture lookup')
const TOKEN = await adminLogin()
const servicesRes = await req('GET', '/services')
const service = servicesRes.json.data.items[0]
check('fixture: service exists', !!service?.id, `got ${service?.id}`)
const serviceDetail = await req('GET', `/services/${service.id}`)
const PRICE = Number(serviceDetail.json?.data?.price ?? serviceDetail.json?.data?.service?.price ?? 0)
check('fixture: service price known', PRICE > 0, `price=${PRICE}`)

// ─── TEST 1: Internal barber, admin + public surfaces ───────────────────
console.log('\nTEST 1 — create INTERNAL barber; public hides business fields')
const createMultipart = (fields) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v))
  return fd
}
let r = await req('POST', '/barbers', {
  token: TOKEN,
  raw: true,
  body: createMultipart({
    name: 'TEST-INT Abdullahi',
    specialty: 'Test fades',
    experience: 4,
    barberType: 'INTERNAL',
    commissionType: 'PERCENTAGE',
    commissionValue: 25,
  }),
})
check('T1 create internal barber (admin)', r.status === 201 || r.status === 200, r.text.slice(0, 200))
const intBarber = r.json?.data?.barber ?? r.json?.data
created.barbers.push(intBarber?.id)
check('T1 admin sees barberType=INTERNAL', intBarber?.barberType === 'INTERNAL', JSON.stringify(intBarber)?.slice(0, 160))
check('T1 admin sees commission PERCENTAGE 25', intBarber?.commissionType === 'PERCENTAGE' && Number(intBarber?.commissionValue) === 25)

r = await req('GET', '/barbers')
const pubInt = r.json.data.items.find((b) => b.id === intBarber.id)
check('T1 public list shows barber', !!pubInt)
const pubIntKeys = Object.keys(pubInt ?? {})
check('T1 public hides barberType', !('barberType' in pubIntKeys) && !pubIntKeys.includes('barberType') && !('barberType' in (pubInt ?? {})))
check('T1 public hides commission fields', !pubIntKeys.includes('commissionType') && !pubIntKeys.includes('commissionValue') && !pubIntKeys.includes('location'))

// ─── TEST 2: External barber ─────────────────────────────────────────────
console.log('\nTEST 2 — create EXTERNAL barber with location + FIXED commission')
r = await req('POST', '/barbers', {
  token: TOKEN,
  raw: true,
  body: createMultipart({
    name: 'TEST-EXT Muhammad',
    specialty: 'Test cuts',
    experience: 6,
    barberType: 'EXTERNAL',
    location: 'Jigawa',
    commissionType: 'FIXED',
    commissionValue: 1500,
  }),
})
check('T2 create external barber (admin)', r.status === 201 || r.status === 200, r.text.slice(0, 200))
const extBarber = r.json?.data?.barber ?? r.json?.data
created.barbers.push(extBarber?.id)
check('T2 admin sees EXTERNAL + Jigawa + FIXED 1500', extBarber?.barberType === 'EXTERNAL' && extBarber?.location === 'Jigawa' && extBarber?.commissionType === 'FIXED' && Number(extBarber?.commissionValue) === 1500)
r = await req('GET', '/barbers')
const pubExt = r.json.data.items.find((b) => b.id === extBarber.id)
check('T2 public shows external barber normally', !!pubExt)
check('T2 public hides type/location/commission', pubExt && !['barberType', 'location', 'commissionType', 'commissionValue'].some((k) => k in pubExt))

// Assign both barbers to the service so booking allows them
for (const b of [intBarber, extBarber]) {
  await req('PUT', `/barbers/${b.id}`, {
    token: TOKEN,
    raw: true,
    body: createMultipart({ name: b.name, serviceIds: String(service.id), barberType: b.barberType, commissionType: b.commissionType, commissionValue: b.commissionValue, ...(b.location ? { location: b.location } : {}) }),
  })
}

// ─── TEST 3: Customer location on booking ────────────────────────────────
console.log('\nTEST 3 — customer location flows to admin booking view')
const pickBarberId = intBarber.id
r = await req('POST', '/checkout', {
  body: {
    customerName: 'TEST-CUST John Doe',
    customerPhone: '08011122233',
    serviceId: service.id,
    barberId: pickBarberId,
    customerLocation: 'Dutse, Jigawa',
    appointmentDate: DATE,
    appointmentTime: '10:00',
    paymentMethod: 'CASH',
  },
})
check('T3 stage checkout (cash, with location)', r.status === 201 || r.status === 200, r.text.slice(0, 200))
const session = r.json?.data
const sessionToken = session?.sessionToken ?? session?.token
created.sessions.push(sessionToken)
check('T3 session token returned', !!sessionToken)

r = await req('POST', `/checkout/${sessionToken}/finalize`)
check('T3 finalize → appointment created', r.status === 200 || r.status === 201, r.text.slice(0, 200))
const appt = r.json?.data?.appointment ?? r.json?.data
created.appointments.push(appt?.id)

// Admin view is the authoritative surface for location (#3, #13).
r = await req('GET', `/appointments/${appt.id}`, { token: TOKEN })
const adminAppt = r.json?.data?.appointment ?? r.json?.data
check('T3 admin sees customerLocation', adminAppt?.customerLocation === 'Dutse, Jigawa', JSON.stringify(adminAppt)?.slice(0, 140))

// ─── TEST 4: Admin assignment + history ──────────────────────────────────
console.log('\nTEST 4 — admin assigns external barber; history recorded')
r = await req('PUT', `/admin/appointments/${appt.id}/assign-barber`, {
  token: TOKEN,
  body: { barberId: extBarber.id, reason: 'Customer location — Jigawa' },
})
check('T4 assign external barber', r.status === 200, r.text.slice(0, 250))
const assigned = r.json?.data?.appointment ?? r.json?.data
check('T4 assignment saved (assignedBarberId)', Number(assigned?.assignedBarberId ?? assigned?.assignedBarber?.id) === extBarber.id, JSON.stringify(assigned)?.slice(0, 200))
check('T4 assignedAt/By stamped', !!assigned?.assignedAt)

r = await req('GET', `/admin/appointments/${appt.id}/assignment-history`, { token: TOKEN })
const hist = r.json?.data?.items ?? r.json?.data ?? []
check('T4 history has ASSIGN entry', Array.isArray(hist) && hist.some((h) => String(h.action ?? '').includes('ASSIGN')), JSON.stringify(hist)?.slice(0, 200))

// ─── TEST 5: Completion → commission snapshot (FIXED ₦1,500) ────────────
console.log('\nTEST 5 — payment + completion create earning with snapshot')
r = await req('GET', '/admin/payments', { token: TOKEN })
const payList = r.json?.data?.items ?? []
const pay = payList.find((p) => p.appointmentId === appt.id)
if (pay) {
  await req('POST', `/admin/payments/${pay.id}/confirm-cash`, { token: TOKEN, body: {} })
}
// Status machine: PAYMENT_REQUIRED → READY_FOR_SERVICE (auto on cash confirm)
// → IN_PROGRESS → COMPLETED.
await req('PATCH', `/appointments/${appt.id}/status`, { token: TOKEN, body: { status: 'IN_PROGRESS' } })
r = await req('PATCH', `/appointments/${appt.id}/status`, { token: TOKEN, body: { status: 'COMPLETED' } })
check('T5 appointment completed', r.status === 200, r.text.slice(0, 200))

r = await req('GET', `/admin/barber-earnings?barberId=${extBarber.id}`, { token: TOKEN })
const earnings = r.json?.data?.items ?? []
const earning = earnings.find((e) => e.appointmentId === appt.id)
created.earnings.push(earning?.id)
check('T5 earning exists for completed appointment', !!earning, JSON.stringify(earnings)?.slice(0, 200))
check('T5 status EARNED after completion', earning?.status === 'EARNED', `status=${earning?.status}`)
check('T5 serviceAmount = service price', Number(earning?.serviceAmount) === PRICE, `got ${earning?.serviceAmount} want ${PRICE}`)
check('T5 commissionAmount = FIXED snapshot 1500', Number(earning?.commissionAmount) === 1500, `got ${earning?.commissionAmount}`)
check('T5 studioAmount = price - 1500', Math.abs(Number(earning?.studioAmount) - (PRICE - 1500)) < 0.01, `got ${earning?.studioAmount}`)

// ─── TEST 6: Commission snapshot survives rate change ───────────────────
console.log('\nTEST 6 — old appointment keeps original commission after rate change')
await req('PUT', `/barbers/${extBarber.id}`, {
  token: TOKEN,
  raw: true,
  body: createMultipart({ name: extBarber.name, serviceIds: String(service.id), barberType: 'EXTERNAL', commissionType: 'PERCENTAGE', commissionValue: 40, location: 'Jigawa' }),
})
r = await req('GET', `/admin/barber-earnings?barberId=${extBarber.id}`, { token: TOKEN })
const earningAfter = (r.json?.data?.items ?? []).find((e) => e.appointmentId === appt.id)
check('T6 snapshot unchanged after rate change', earningAfter && Number(earningAfter.commissionAmount) === 1500 && earningAfter.commissionType === 'FIXED', JSON.stringify(earningAfter)?.slice(0, 200))

// ─── TEST 7: Cancelled appointment never earns ──────────────────────────
console.log('\nTEST 7 — cancelled appointment does not become EARNED')
r = await req('POST', '/checkout', {
  body: {
    customerName: 'TEST-CUST Cancel Case',
    customerPhone: '08011122244',
    serviceId: service.id,
    barberId: pickBarberId,
    appointmentDate: DATE,
    appointmentTime: '11:30',
    paymentMethod: 'CASH',
  },
})
const s2 = r.json?.data
const s2token = s2?.sessionToken ?? s2?.token
created.sessions.push(s2token)
r = await req('POST', `/checkout/${s2token}/finalize`)
const appt2 = r.json?.data?.appointment ?? r.json?.data
created.appointments.push(appt2?.id)
await req('PUT', `/admin/appointments/${appt2.id}/assign-barber`, { token: TOKEN, body: { barberId: extBarber.id, reason: 'test' } })
r = await req('PATCH', `/appointments/${appt2.id}/status`, { token: TOKEN, body: { status: 'CANCELLED', cancellationReason: 'Test cancellation' } })
check('T7 appointment cancelled', r.status === 200, r.text.slice(0, 160))
r = await req('GET', `/admin/barber-earnings?barberId=${extBarber.id}`, { token: TOKEN })
const cancelledEarning = (r.json?.data?.items ?? []).find((e) => e.appointmentId === appt2.id)
check('T7 earning not EARNED after cancellation', cancelledEarning ? cancelledEarning.status !== 'EARNED' : true, `status=${cancelledEarning?.status}`)
check('T7 earning CANCELLED', cancelledEarning?.status === 'CANCELLED' || !cancelledEarning, `status=${cancelledEarning?.status}`)

// ─── TEST 8: Mark commission paid ────────────────────────────────────────
console.log('\nTEST 8 — admin marks commission PAID')
r = await req('POST', `/admin/barber-earnings/${earning.id}/paid`, { token: TOKEN, body: { note: 'Test payout' } })
check('T8 mark paid succeeds', r.status === 200, r.text.slice(0, 200))
check('T8 status PAID + paidAt', r.json?.data?.status === 'PAID' || r.json?.data?.earning?.status === 'PAID', r.text.slice(0, 160))

// ─── TEST 9: Customer cannot modify assignment/status ───────────────────
console.log('\nTEST 9 — unauthenticated/customer requests rejected')
r = await req('PUT', `/admin/appointments/${appt.id}/assign-barber`, { body: { barberId: intBarber.id } })
check('T9 anonymous assign-barber rejected', r.status === 401 || r.status === 403, `status=${r.status}`)
r = await req('PATCH', `/appointments/${appt.id}/status`, { body: { status: 'COMPLETED' } })
check('T9 anonymous status change rejected', r.status === 401 || r.status === 403, `status=${r.status}`)
r = await req('POST', `/admin/barber-earnings/${earning.id}/paid`, { body: { note: 'hack' } })
check('T9 anonymous mark-paid rejected', r.status === 401 || r.status === 403, `status=${r.status}`)
r = await req('PUT', `/barbers/${extBarber.id}`, { raw: true, body: createMultipart({ name: 'HACKED', commissionValue: 100 }) })
check('T9 anonymous commission change rejected', r.status === 401 || r.status === 403, `status=${r.status}`)

// ─── TEST 10: Customers never see commission/revenue ─────────────────────
console.log('\nTEST 10 — public surfaces carry no financial data')
r = await req('GET', `/checkout/${sessionToken}`)
const sessKeys = JSON.stringify(r.json?.data ?? {})
check('T10 session view has no commission fields', !/commission|studioAmount|barberType|assignedBy/i.test(sessKeys), sessKeys.slice(0, 120))
r = await req('GET', '/barbers/' + extBarber.id)
const pubDetail = JSON.stringify(r.json?.data ?? {})
check('T10 public barber detail has no commission/type/location', !/commission|barberType|"location"/i.test(pubDetail), pubDetail.slice(0, 160))
r = await req('GET', '/appointments')
check('T10 anonymous appointment list rejected', r.status === 401 || r.status === 403, `status=${r.status}`)

// ─── TEST 11: Admin filters by type/location ─────────────────────────────
console.log('\nTEST 11 — admin type/location filters')
r = await req('GET', '/barbers?includeInactive=true&barberType=EXTERNAL', { token: TOKEN })
const extItems = r.json?.data?.items ?? []
check('T11 EXTERNAL filter returns only external', extItems.length > 0 && extItems.every((b) => b.barberType === 'EXTERNAL'), JSON.stringify(extItems.map((b) => b.barberType)))
r = await req('GET', '/barbers?includeInactive=true&barberType=INTERNAL', { token: TOKEN })
const intItems = r.json?.data?.items ?? []
check('T11 INTERNAL filter returns only internal', intItems.length > 0 && intItems.every((b) => b.barberType === 'INTERNAL'), JSON.stringify(intItems.map((b) => b.barberType)))
r = await req('GET', '/barbers?includeInactive=true&location=Jigawa', { token: TOKEN })
const locItems = r.json?.data?.items ?? []
check('T11 location filter finds Jigawa barber', locItems.some((b) => b.id === extBarber.id), JSON.stringify(locItems.map((b) => b.name)))

// ─── TEST 12: Commission report totals ───────────────────────────────────
console.log('\nTEST 12 — commission report')
r = await req('GET', '/admin/barber-earnings/report', { token: TOKEN })
const rep = r.json?.data?.totals ?? r.json?.data ?? {}
const hasTotals = ['barberRevenue', 'internalCommission', 'externalCommission', 'paidCommission', 'pendingCommission', 'studioRevenue'].every((k) => typeof rep[k] === 'number')
check('T12 report totals present (all six)', hasTotals, JSON.stringify(r.json?.data).slice(0, 220))
r = await req('GET', `/admin/barber-earnings/report?from=2026-11-01&to=2026-11-30&barberType=EXTERNAL`, { token: TOKEN })
check('T12 report accepts date-range + type filters', r.status === 200, r.text.slice(0, 160))
r = await req('GET', '/admin/barber-earnings/summary', { token: TOKEN })
check('T12 summary endpoint works', r.status === 200 && !!r.json?.data, r.text.slice(0, 160))

// ─── RESULT ──────────────────────────────────────────────────────────────
console.log(`\n========== RESULT: ${pass} passed, ${fail} failed ==========`)
if (failures.length) {
  console.log('Failures:')
  for (const f of failures) console.log(` - ${f}`)
}
console.log(`\nCleanup targets: barbers=[${created.barbers}] appointments=[${created.appointments}] earnings=[${created.earnings}] sessions=${created.sessions.length}`)
process.exit(fail ? 1 : 0)
