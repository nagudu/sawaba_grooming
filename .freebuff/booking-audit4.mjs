import { config } from 'dotenv'
config({ path: 'backend/.env' })
const B = 'http://localhost:5000/api'
const out = []

const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const T = (await login.json())?.data?.token
const AH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }
const call = async (m, p, body) => {
  const r = await fetch(B + p, { method: m, headers: AH, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { s: r.status, j }
}

// The payment for appt 21 was already rejected earlier (404 means payment 21 was the rejected one? no — find payment rows)
// List payments by querying each payment id around 19-22
for (const id of [19, 20, 21, 22]) {
  const r = await call('GET', '/admin/payments/' + id)
  if (r.s === 200) {
    const p = r.j?.data
    out.push([`payment ${id}`, `appt=${p.appointmentId}`, `method=${p.paymentMethod}`, `status=${p.status}`, `receipt=${p.receiptUrl ? 'yes' : 'no'}`])
  }
}

// Reject appt 21's payment (whatever its id) → appointment must become PAYMENT_REJECTED
const r21 = await call('GET', '/appointments/21')
const payId21 = r21.j?.data?.payment?.id
if (payId21) {
  const rej = await call('POST', `/admin/payments/${payId21}/reject`, { reason: 'QA rejection' })
  out.push([`reject payment ${payId21}`, rej.s, `apptStatus=${rej.j?.data?.appointment?.status ?? rej.j?.data?.status}`])
} else {
  out.push(['appt 21 payment', 'not embedded in GET /appointments/21 — check shape', JSON.stringify(r21.j?.data || {}).slice(0, 200)])
}

console.log(out.map(l => l.join(' | ')).join('\n'))
