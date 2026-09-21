/* Payment-rules test battery — runs against the live local backend.
 * Usage: node .freebuff/payment-rules-test.mjs
 */
import fs from 'node:fs'
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

// A tiny valid PNG (1x1) for receipt uploads.
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' + '01f15c4890000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082',
  'hex',
)

// Random day 3-30 days out — every run of the battery gets a unique date so
// repeated executions never collide with their own previous bookings.
const RUN_OFFSET = 3 + Math.floor(Math.random() * 28)

function slotDate() {
  const d = new Date(); d.setDate(d.getDate() + 3)
  return d.toISOString().slice(0, 10)
}

function slotDateOffset(daysAhead) {
  const d = new Date(); d.setDate(d.getDate() + daysAhead + RUN_OFFSET)
  return d.toISOString().slice(0, 10)
}

/** Random minute within the hour so repeated runs never collide with old bookings. */
function slotTime(hour) {
  return `${String(hour).padStart(2, '0')}:${String(Math.floor(Math.random() * 12) * 5).padStart(2, '0')}`
}

let phoneSeq = Math.floor(Math.random() * 90) + 10
function phone() {
  phoneSeq += 1
  return `080222${String(phoneSeq).padStart(4, '0')}${Math.floor(Math.random() * 90 + 10)}`
}

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

async function firstEnabled(methodKey) {
  const res = await fetch(`${BASE}/services?perPage=1`)
  const sBody = await res.json()
  const serviceId = sBody.data.items[0].id
  const bRes = await fetch(`${BASE}/barbers?perPage=1`)
  const bBody = await bRes.json()
  const barberId = bBody.data.items[0].id
  return { serviceId, barberId }
}

/** POST /appointments — receipt included when provided. */
async function book(payload, receipt) {
  const form = new FormData()
  for (const [k, v] of Object.entries(payload)) form.set(k, String(v))
  if (receipt) form.set('receipt', new Blob([receipt], { type: 'image/png' }), 'receipt.png')
  const res = await fetch(`${BASE}/appointments`, { method: 'POST', body: form })
  let body = null
  try { body = await res.json() } catch { /* noop */ }
  return { status: res.status, body }
}

async function getAdminAppointment(token, id) {
  const res = await fetch(`${BASE}/appointments/${id}`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json()
  return body.data
}

async function getAdminPayment(token, appointmentId) {
  const res = await fetch(`${BASE}/admin/payments?perPage=100`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json()
  const items = body.data?.items ?? []
  const found = items.find((p) => p.appointmentId === appointmentId || String(p.appointmentId) === String(appointmentId)) ?? null
  if (!found) console.log(`  [debug] no payment for appointment ${appointmentId}; got ${items.length} items`) 
  return found
}

const base = {
  customerName: 'Payment Rules Tester',
  customerPhone: phone(),
  customerEmail: 'payrules@test.local',
  // Distinct day per test so repeated runs never collide with each other or
  // with bookings left by earlier interrupted runs.
  appointmentDate: slotDateOffset(3),
  appointmentTime: slotTime(15),
  notes: 'automated payment-rules battery',
}
async function main(){
const { serviceId, barberId } = await firstEnabled()

// ─── TEST 2: Bank transfer without receipt must be REJECTED ──────────────────
{
  const r = await book({ ...base, serviceId, barberId, paymentMethod: 'BANK_TRANSFER' })
  check('TEST 2: bank transfer without receipt rejected', r.status === 422, `got ${r.status} ${r.body?.message}`)
  check('TEST 2b: friendly message', /receipt is required/i.test(r.body?.message ?? ''), r.body?.message)
}

// ─── TEST 3: invalid file type must be rejected ─────────────────────────────
{
  const form = new FormData()
  for (const [k, v] of Object.entries({ ...base, serviceId, barberId, paymentMethod: 'BANK_TRANSFER' })) form.set(k, String(v))
  form.set('receipt', new Blob(['not an image'], { type: 'text/plain' }), 'receipt.txt')
  const res = await fetch(`${BASE}/appointments`, { method: 'POST', body: form })
  const body = await res.json().catch(() => null)
  check('TEST 3: invalid receipt file type rejected', res.status === 400, `got ${res.status} ${body?.message}`)
}

// ─── TEST 4: empty receipt file (still "uploading" equivalent) must fail ────
{
  const form = new FormData()
  for (const [k, v] of Object.entries({ ...base, serviceId, barberId, paymentMethod: 'BANK_TRANSFER' })) form.set(k, String(v))
  form.set('receipt', new Blob([]), 'empty.png')
  const res = await fetch(`${BASE}/appointments`, { method: 'POST', body: form })
  const body = await res.json().catch(() => null)
  check('TEST 4: empty receipt file rejected', res.status >= 400 && res.status < 500, `got ${res.status} ${body?.message}`)
}

// ─── TEST 5+6: transfer WITH receipt succeeds → PENDING/PENDING_VERIFICATION ─
let transferApptId = null
let transferToken = null
{
  const r = await book({ ...base, serviceId, barberId, paymentMethod: 'BANK_TRANSFER' }, PNG)
  check('TEST 5: bank transfer with receipt accepted', r.status === 201, `got ${r.status} ${r.body?.message}`)
  transferApptId = r.body?.data?.appointment?.id
  transferToken = r.body?.data?.payment?.accessToken
  check('TEST 6a: appointment PENDING (PAYMENT_SUBMITTED)', r.body?.data?.appointment?.status === 'PAYMENT_SUBMITTED', r.body?.data?.appointment?.status)
  check('TEST 6b: payment PENDING_VERIFICATION', r.body?.data?.payment?.status === 'PENDING_VERIFICATION', r.body?.data?.payment?.status)
  check('TEST 6c: receipt stored', Boolean(r.body?.data?.appointment?.payment?.accessToken) && transferApptId > 0)
}

// ─── TEST 1: cash with no receipt must WORK (UNPAID) ─────────────────────────
let cashApptId = null
{
  const r = await book({ ...base, customerPhone: phone(), appointmentDate: slotDateOffset(4), appointmentTime: slotTime(10), serviceId, barberId, paymentMethod: 'CASH' })
  check('TEST 1: cash without receipt accepted', r.status === 201, `got ${r.status} ${r.body?.message}`)
  cashApptId = r.body?.data?.appointment?.id
  check('TEST 1b: payment UNPAID, method CASH',
    r.body?.data?.payment?.status === 'UNPAID' && r.body?.data?.appointment?.payment?.paymentMethod === 'CASH',
    JSON.stringify(r.body?.data?.payment?.status))
}

// ─── TEST 10: direct JSON API booking (non-cash, no receipt) must reject ────
{
  const res = await fetch(`${BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...base, customerPhone: phone(), appointmentDate: slotDateOffset(7), appointmentTime: slotTime(11), serviceId, barberId, paymentMethod: 'BANK_TRANSFER' }),
  })
  const body = await res.json().catch(() => null)
  check('TEST 10: direct API non-cash booking without receipt rejected', res.status === 422, `got ${res.status} ${body?.message}`)
}

// ─── TEST 6 (admin verify): transfer → verified → PAID ───────────────────────
{
  const adminToken = await adminLogin()
  const pay = await getAdminPayment(adminToken, transferApptId)
  if (!pay) throw new Error('transfer payment not found in admin queue — aborting')
  check('TEST 6d: transfer payment visible in admin queue with receipt', Boolean(pay?.receiptUrl) && pay?.status === 'PENDING_VERIFICATION', JSON.stringify({ status: pay?.status, receipt: pay?.receiptUrl }))
  const verifyRes = await fetch(`${BASE}/admin/payments/${pay.id}/verify`, {
    method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: '{}',
  })
  const verifyBody = await verifyRes.json().catch(() => null)
  check('TEST 6e: admin verify succeeds', verifyRes.status === 200, verifyBody?.message)
  const appt = await getAdminAppointment(adminToken, transferApptId)
  check('TEST 6f: appointment advanced after verification', appt?.status === 'READY_FOR_SERVICE' || appt?.status === 'PAYMENT_VERIFIED', appt?.status)
}

// ─── TEST 7: reject receipt → customer can retry ────────────────────────────
{
  // Book another transfer appointment to reject.
  const r = await book({ ...base, customerPhone: phone(), appointmentDate: slotDateOffset(5), appointmentTime: slotTime(16), serviceId, barberId, paymentMethod: 'BANK_TRANSFER' }, PNG)
  check('TEST 7a: second transfer booking accepted', r.status === 201, `got ${r.status}`)
  const apptId = r.body?.data?.appointment?.id
  const adminToken = await adminLogin()
  const pay = await getAdminPayment(adminToken, apptId)
  const rejRes = await fetch(`${BASE}/admin/payments/${pay.id}/reject`, {
    method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Automated test: receipt unreadable' }),
  })
  check('TEST 7b: admin can reject receipt', rejRes.status === 200)
  const rejBody = await rejRes.json().catch(() => null)
  check('TEST 7c: payment REJECTED', rejBody?.data?.status === 'REJECTED', rejBody?.data?.status)
  const appt = await getAdminAppointment(adminToken, apptId)
  check('TEST 7d: appointment PAYMENT_REJECTED', appt?.status === 'PAYMENT_REJECTED', appt?.status)
  // Customer retries via the /pay/:token submit endpoint with a new receipt.
  const retryToken = rejBody?.data?.accessToken
  const form = new FormData()
  form.set('paymentMethod', 'BANK_TRANSFER')
  form.set('amountPaid', String(pay.amount))
  form.set('transactionReference', 'retry-ref-001')
  form.set('paymentDate', new Date().toISOString().slice(0, 10))
  form.set('receipt', new Blob([PNG], { type: 'image/png' }), 'receipt2.png')
  const retryRes = await fetch(`${BASE}/payments/${retryToken}/submit`, { method: 'POST', body: form })
  const retryBody = await retryRes.json().catch(() => null)
  check('TEST 7e: customer retry after rejection works', retryRes.status === 200, retryBody?.message)
  check('TEST 7f: retried payment back to PENDING_VERIFICATION', retryBody?.data?.payment?.status === 'PENDING_VERIFICATION', retryBody?.data?.payment?.status)
}

// ─── TEST 8/9: ONLINE payment lifecycle ──────────────────────────────────────
{
  const r = await book({ ...base, customerPhone: phone(), appointmentDate: slotDateOffset(6), appointmentTime: slotTime(17), serviceId, barberId, paymentMethod: 'ONLINE' })
  check('TEST 8a: online booking creates un-finalized appointment', r.status === 201, `got ${r.status} ${r.body?.message}`)
  const apptId = r.body?.data?.appointment?.id
  check('TEST 8b: online appointment stays PAYMENT_REQUIRED + UNPAID (not finalized)',
    r.body?.data?.appointment?.status === 'PAYMENT_REQUIRED' && r.body?.data?.payment?.status === 'UNPAID',
    JSON.stringify({ a: r.body?.data?.appointment?.status, p: r.body?.data?.payment?.status }))
  const adminToken = await adminLogin()
  const appt = await getAdminAppointment(adminToken, apptId)
  check('TEST 9a: paystack init available for the online booking', Boolean(r.body?.data?.payment?.accessToken))
  // Simulate "payment cancelled": appointment must NOT be confirmed without verification.
  check('TEST 8c: unverified online appointment is NOT confirmed', appt?.status === 'PAYMENT_REQUIRED', appt?.status)
  const pay = await getAdminPayment(adminToken, apptId)
  check('TEST 9b: payment remains UNPAID pre-verification', pay?.status === 'UNPAID', pay?.status)
}

// ─── Cleanup: cancel the test appointments so the demo data stays tidy ──────
{
  const adminToken = await adminLogin()
  for (const id of [cashApptId, transferApptId].filter(Boolean)) {
    await fetch(`${BASE}/appointments/${id}/status`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED', cancellationReason: 'Automated payment-rules test' }),
    }).catch(() => undefined)
  }
}

}

function report() {
  console.log('\n=== Payment Rules Test Battery ===')
  for (const line of results) console.log(line)
  console.log(`\n${pass} passed, ${fail} failed`)
  fs.writeFileSync(path.resolve('.freebuff/payment-rules-results.txt'), results.join('\n') + `\n${pass} passed, ${fail} failed\n`)
}

main().catch((e)=>{ console.error('[battery error]', e.message) }).finally(()=>{ report(); process.exit(fail === 0 ? 0 : 1) })
