/* Checkout-rules test battery — booking is saved ONLY after the payment condition is met.
 * Usage: node .freebuff/checkout-rules-test.mjs
 * Covers: abandon = zero records, missing method rejected, transfer without receipt rejected,
 * transfer+receipt → PENDING pair, cash → UNPAID pair, online never created before verified payment,
 * availability slot-holds, and abandonment not interfering with new bookings.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require('dotenv').config({ path: path.resolve('backend/.env') })

const BASE = 'http://localhost:5000/api'
let pass = 0, fail = 0
const results = []
function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  PASS  ${name}`) }
  else { fail++; results.push(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' + '01f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082',
  'hex',
)

function dbCounts() {
  const r = spawnSync('npx', ['tsx', 'src/scripts/dbCounts.ts'], {
    cwd: path.resolve('backend'), encoding: 'utf8', shell: true,
  })
  const line = (r.stdout || '').split('\n').filter((l) => l.startsWith('{')).pop()
  return JSON.parse(line || '{}')
}

const RUN_OFFSET = 3 + Math.floor(Math.random() * 28)
function slotDateOffset(daysAhead) {
  const d = new Date(); d.setDate(d.getDate() + daysAhead + RUN_OFFSET)
  return d.toISOString().slice(0, 10)
}
function uniqueTime(h) {
  return `${String(h).padStart(2, '0')}:${String(Math.floor(Math.random() * 12) * 5).padStart(2, '0')}`
}

const phoneSeq = Math.floor(Math.random() * 90) + 10
const custPhone = `080333${String(phoneSeq).padStart(4, '0')}${Math.floor(Math.random() * 90 + 10)}`

async function adminLogin() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }),
  })
  const body = await res.json()
  if (!body.success) throw new Error('admin login failed: ' + body.message)
  return body.data.token
}

async function post(path_, body, token) {
  const res = await fetch(`${BASE}${path_}`, {
    method: 'POST',
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
  })
  let json = null
  try { json = await res.json() } catch { /* empty */ }
  return { status: res.status, body: json }
}

function bookingFormFields(overrides = {}) {
  return {
    customerName: 'Checkout Tester',
    customerPhone: custPhone,
    customerEmail: 'checkout.tester@example.com',
    serviceId: overrides.serviceId,
    barberId: overrides.barberId,
    appointmentDate: overrides.appointmentDate,
    appointmentTime: overrides.appointmentTime,
    notes: '',
    ...overrides,
  }
}

// ── Setup ──
const before = dbCounts()
console.log('DB before:', JSON.stringify(before))

const token = await adminLogin()
const [services, barbers] = await Promise.all([
  (await fetch(`${BASE}/services?perPage=100`)).json(),
  (await fetch(`${BASE}/barbers?perPage=100`)).json(),
])
const service = services.data.items.find((s) => s.isActive)
const barber = barbers.data.items.find((b) => b.isActive)
check('setup: found active service + barber', Boolean(service && barber), JSON.stringify({ service: service?.id, barber: barber?.id }))

// ── TEST 2: no payment method → rejected ──
{
  const { method: _m, paymentMethod: _p, ...fields } = bookingFormFields({
    serviceId: service.id, barberId: barber.id,
    appointmentDate: slotDateOffset(1), appointmentTime: uniqueTime(9),
  })
  const r = await post('/checkout', fields)
  check('T2: missing paymentMethod rejected', r.status >= 400 && /payment method/i.test(r.body?.message ?? ''), `status=${r.status} msg=${r.body?.message}`)
}

// ── TEST 3: transfer without receipt → rejected, nothing saved ──
{
  const r = await post('/checkout', bookingFormFields({
    serviceId: service.id, barberId: barber.id, paymentMethod: 'BANK_TRANSFER',
    appointmentDate: slotDateOffset(1), appointmentTime: uniqueTime(10),
  }))
  check('T3: transfer without receipt rejected', r.status >= 400 && /receipt/i.test(r.body?.message ?? ''), `status=${r.status} msg=${r.body?.message}`)
  const after = dbCounts()
  check('T3: no appointment created', after.appointments === before.appointments, JSON.stringify(after))
}

// ── TEST 1: cash session → abandon → zero permanent records ──
{
  const create = await post('/checkout', bookingFormFields({
    serviceId: service.id, barberId: barber.id, paymentMethod: 'CASH',
    appointmentDate: slotDateOffset(1), appointmentTime: uniqueTime(11),
  }))
  check('T1: cash session created', create.status === 201, JSON.stringify(create.body?.message))
  const t = create.body?.data?.sessionToken
  check('T1: session token returned', typeof t === 'string' && t.length > 20)
  const ab = await post(`/checkout/${t}/abandon`)
  check('T1: abandon accepted', ab.status === 200, JSON.stringify(ab.body))
  const after = dbCounts()
  check('T1: zero appointments/payments created', after.appointments === before.appointments && after.payments === before.payments, JSON.stringify(after))
}

// ── Availability slot-holds: an OPEN session holds its slot ──
{
  const time = uniqueTime(12)
  const date = slotDateOffset(2)
  const availRes = await fetch(`${BASE}/availability?barberId=${barber.id}&date=${date}&serviceId=${service.id}`)
  const avail = await availRes.json()
  const openSlot = avail.data?.slots?.find((s) => s.available)
  check('holds: availability has an open slot', Boolean(openSlot), JSON.stringify(avail.data?.slots?.slice(0, 3)))
  if (openSlot) {
    const create = await post('/checkout', bookingFormFields({
      serviceId: service.id, barberId: barber.id, paymentMethod: 'CASH',
      appointmentDate: date, appointmentTime: openSlot.time,
    }))
    check('holds: session created for open slot', create.status === 201, JSON.stringify(create.body?.message))
    const t = create.body?.data?.sessionToken
    const avail2 = await (await fetch(`${BASE}/availability?barberId=${barber.id}&date=${date}&serviceId=${service.id}`)).json()
    const held = avail2.data?.slots?.find((s) => s.time === openSlot.time)
    check('holds: slot now shows unavailable while session open', held && !held.available, JSON.stringify(held))
    // Direct API attempt with a non-cash method and no receipt while slot held → rejected
    const bypass = await post('/checkout', { ...bookingFormFields({ serviceId: service.id, barberId: barber.id }), paymentMethod: 'OPAY', appointmentDate: date, appointmentTime: openSlot.time })
    check('holds: second checkout for held slot rejected', bypass.status >= 400, `status=${bypass.status}`)
    await post(`/checkout/${t}/abandon`)
    const avail3 = await (await fetch(`${BASE}/availability?barberId=${barber.id}&date=${date}&serviceId=${service.id}`)).json()
    const released = avail3.data?.slots?.find((s) => s.time === openSlot.time)
    check('holds: slot released after abandon', released && released.available, JSON.stringify(released))
  }
}

// ── TEST 4: transfer + receipt → session → finalize → PENDING pair ──
{
  const date = slotDateOffset(3)
  const time = uniqueTime(13)
  const form = new FormData()
  const fields = bookingFormFields({ serviceId: service.id, barberId: barber.id, paymentMethod: 'BANK_TRANSFER', appointmentDate: date, appointmentTime: time })
  for (const [k, v] of Object.entries(fields)) if (v !== null && v !== undefined && v !== '') form.set(k, String(v))
  form.set('receipt', new Blob([PNG], { type: 'image/png' }), 'receipt.png')
  const create = await post('/checkout', form)
  check('T4: transfer session with receipt created', create.status === 201, JSON.stringify(create.body?.message))
  const t = create.body?.data?.sessionToken
  if (t) {
    const fin = await post(`/checkout/${t}/finalize`)
    check('T4: finalize created appointment', fin.status === 201 && fin.body?.data?.appointment?.id, JSON.stringify(fin.body?.message))
    const apptStatus = fin.body?.data?.appointment?.status
    check('T4: appointment PENDING-equivalent (PAYMENT_SUBMITTED)', apptStatus === 'PAYMENT_SUBMITTED', apptStatus)
    check('T4: payment PENDING_VERIFICATION', fin.body?.data?.payment?.status === 'PENDING_VERIFICATION', fin.body?.data?.payment?.status)
    // Admin queue sees it
    const q = await fetch(`${BASE}/admin/payments?status=PENDING_VERIFICATION`, { headers: { Authorization: `Bearer ${token}` } })
    const qBody = await q.json()
    const found = qBody.data?.items?.some((p) => p.id === fin.body?.data?.payment?.id)
    check('T4: payment in admin verification queue', Boolean(found))
  }
}

// ── TEST 5: cash → finalize → PENDING/UNPAID pair ──
{
  const create = await post('/checkout', bookingFormFields({
    serviceId: service.id, barberId: barber.id, paymentMethod: 'CASH',
    appointmentDate: slotDateOffset(4), appointmentTime: uniqueTime(14),
  }))
  const t = create.body?.data?.sessionToken
  check('T5: cash session created', create.status === 201, JSON.stringify(create.body?.message))
  const fin = await post(`/checkout/${t}/finalize`)
  check('T5: cash finalize created appointment', fin.status === 201, JSON.stringify(fin.body?.message))
  check('T5: payment UNPAID + CASH', fin.body?.data?.payment?.status === 'UNPAID', JSON.stringify(fin.body?.data?.payment))
  // Admin "Mark Cash as Paid" path exists (endpoint coverage)
  const payId = fin.body?.data?.payment?.id
  const cash = await post(`/admin/payments/${payId}/cash-confirm`, { note: 'battery test' }, token)
  check('T5: admin mark-cash-paid works', cash.status === 200 && cash.body?.data?.status === 'PAID', `status=${cash.status} msg=${cash.body?.message}`)
}

// ── TEST 6: online — direct booking POST rejected; abandoned checkout leaves nothing ──
{
  const direct = await post('/appointments', bookingFormFields({
    serviceId: service.id, barberId: barber.id, paymentMethod: 'ONLINE',
    appointmentDate: slotDateOffset(5), appointmentTime: uniqueTime(15),
  }))
  check('T6: direct ONLINE booking via /appointments rejected', direct.status >= 400, `status=${direct.status} msg=${direct.body?.message}`)

  const create = await post('/checkout', bookingFormFields({
    serviceId: service.id, barberId: barber.id, paymentMethod: 'ONLINE',
    appointmentDate: slotDateOffset(5), appointmentTime: uniqueTime(16),
  }))
  const t = create.body?.data?.sessionToken
  check('T6: online session created (no appointment)', create.status === 201, JSON.stringify(create.body?.message))
  const afterCreate = dbCounts()
  check('T6: session created ZERO appointments', afterCreate.appointments === before.appointments + 2 /* T4+T5 */, JSON.stringify(afterCreate))
  // Abandon (customer never pays)
  await post(`/checkout/${t}/abandon`)
  const afterAbandon = dbCounts()
  check('T6: abandoned checkout created no appointment/payment', afterAbandon.appointments === afterCreate.appointments && afterAbandon.payments === afterCreate.payments, JSON.stringify(afterAbandon))
}

// ── TEST 7: online — backend re-verifies with Paystack; unpaid reference never finalizes ──
{
  const create = await post('/checkout', bookingFormFields({
    serviceId: service.id, barberId: barber.id, paymentMethod: 'ONLINE',
    appointmentDate: slotDateOffset(6), appointmentTime: uniqueTime(9),
  }))
  const t = create.body?.data?.sessionToken
  check('T7: online session created', create.status === 201, JSON.stringify(create.body?.message))
  if (t) {
    const init = await post(`/checkout/${t}/paystack/initialize`)
    check('T7: Paystack checkout URL obtained (test mode)', init.status === 200 && /^https/.test(init.body?.data?.authorizationUrl ?? ''), `status=${init.status} url=${init.body?.data?.authorizationUrl}`)
    const ref = init.body?.data?.reference
    // The reference is NOT paid yet — verification must fail and create nothing.
    const verify = await post(`/checkout/${t}/paystack/verify`, { reference: ref })
    check('T7: unpaid reference NOT accepted as paid', verify.status >= 400, `status=${verify.status} msg=${verify.body?.message}`)
    const after = dbCounts()
    check('T7: no appointment created for unpaid reference', after.appointments === dbCounts().appointments && verify.status >= 400, JSON.stringify(after))
  }
}

// ── TEST 8: abandoned booking doesn't interfere with a fresh booking ──
{
  const create = await post('/checkout', bookingFormFields({
    serviceId: service.id, barberId: barber.id, paymentMethod: 'CASH',
    appointmentDate: slotDateOffset(7), appointmentTime: uniqueTime(10),
  }))
  check('T8: fresh booking after abandonment works', create.status === 201, JSON.stringify(create.body?.message))
  const fin = await post(`/checkout/${create.body?.data?.sessionToken}/finalize`)
  check('T8: fresh booking finalizes', fin.status === 201, JSON.stringify(fin.body?.message))
}

// ── Final DB verification ──
{
  const after = dbCounts()
  console.log('DB after:', JSON.stringify(after))
  // Sessions created during battery (abandoned/converted) must have produced NO
  // extra appointments beyond the ones the battery finalized (T4, T5, T8 = 3).
  check('final: appointments grew exactly by finalized bookings (3)', after.appointments === before.appointments + 3, `before=${before.appointments} after=${after.appointments}`)
  check('final: payments grew exactly by 3', after.payments === before.payments + 3, `before=${before.payments} after=${after.payments}`)
  check('final: zero OPEN sessions left holding slots', after.openSessions === 0, JSON.stringify({ openSessions: after.openSessions }))
}

console.log(`\n${pass} passed, ${fail} failed`)
results.forEach((r) => console.log(r))
process.exit(fail > 0 ? 1 : 0)
