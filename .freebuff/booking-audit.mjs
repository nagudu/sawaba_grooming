import { config } from 'dotenv'
config({ path: 'backend/.env' })
const B = 'http://localhost:5000/api'
const out = []

const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const T = (await login.json())?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }
const adminCount = async () => {
  const j = await (await fetch(B + '/admin/appointments?perPage=100', { headers: H })).json()
  return (j?.data?.items || []).length
}
const call = async (m, p, body, extra = {}) => {
  const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...extra }, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { s: r.status, j }
}

const before = await adminCount()

// 1. Empty payload
let r = await call('POST', '/appointments', {})
out.push(['empty payload', r.s, JSON.stringify(r.j?.message).slice(0, 80)])

// 2. Past date
r = await call('POST', '/appointments', { serviceId: 1, barberId: 1, appointmentDate: '2020-01-01', appointmentTime: '10:00', customerName: 'QA Past', customerPhone: '07060000001', customerEmail: 'qa1@test.local', paymentMethod: 'CASH' })
out.push(['past date', r.s, JSON.stringify(r.j?.message).slice(0, 80)])

// 3. Bank transfer without receipt — MUST reject
r = await call('POST', '/appointments', { serviceId: 1, barberId: 1, appointmentDate: '2026-10-01', appointmentTime: '10:00', customerName: 'QA NoReceipt', customerPhone: '07060000002', customerEmail: 'qa2@test.local', paymentMethod: 'BANK_TRANSFER' })
out.push(['bank_transfer no receipt', r.s, JSON.stringify(r.j?.message).slice(0, 100)])

// 4. No payment method — MUST reject
r = await call('POST', '/appointments', { serviceId: 1, barberId: 1, appointmentDate: '2026-10-01', appointmentTime: '10:30', customerName: 'QA NoMethod', customerPhone: '07060000003', customerEmail: 'qa3@test.local' })
out.push(['no payment method', r.s, JSON.stringify(r.j?.message).slice(0, 100)])

// 5. CASH — must succeed
r = await call('POST', '/appointments', { serviceId: 1, barberId: 1, appointmentDate: '2026-10-01', appointmentTime: '11:00', customerName: 'QA Cash Probe', customerPhone: '07060000004', customerEmail: 'qa4@test.local', paymentMethod: 'CASH' })
const cashId = r.j?.data?.id || r.j?.data?.appointment?.id
const cash = r.j?.data || r.j?.data?.appointment || {}
out.push(['cash booking', r.s, `appt=${cashId}`, `status=${cash.status ?? cash.appointmentStatus}`, `pay=${cash.paymentStatus ?? cash.payment?.status}`])

// 6. Duplicate slot (same barber/time) — must reject
r = await call('POST', '/appointments', { serviceId: 1, barberId: 1, appointmentDate: '2026-10-01', appointmentTime: '11:00', customerName: 'QA Duplicate', customerPhone: '07060000005', customerEmail: 'qa5@test.local', paymentMethod: 'CASH' })
out.push(['duplicate slot', r.s, JSON.stringify(r.j?.message).slice(0, 80)])

const after = await adminCount()
out.push(['admin dashboard delta (expect +1)', `${before} -> ${after}`])

// 7. Admin mark cash as paid
r = await call('POST', `/admin/appointments/${cashId}/mark-cash-paid`)
if (r.s === 404) r = await call('PATCH', `/admin/payments/${cashId}/mark-cash-paid`)
if (r.s === 404) r = await call('POST', `/admin/payments/cash/${cashId}/mark-paid`)
out.push(['mark cash paid', r.s, JSON.stringify(r.j?.message || r.j?.data?.payment?.status).slice(0, 80)])

console.log(out.map(l => l.join(' | ')).join('\n'))
console.log('CASH_APPT_ID=' + cashId)
