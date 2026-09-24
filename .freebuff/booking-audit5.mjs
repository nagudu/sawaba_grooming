import { config } from 'dotenv'
config({ path: 'backend/.env' })
import fs from 'node:fs'
const B = 'http://localhost:5000/api'
const out = []

// --- Customer register + login ---
const email = `qa-cust-${Date.now()}@test.local`
let r = await fetch(B + '/account/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'QA Customer', email, phone: '07061112222', password: 'QaPassword123!' }) })
let j = await r.json().catch(() => ({}))
out.push(['customer register', r.status])
if (r.status === 404) {
  r = await fetch(B + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'QA Customer', email, phone: '07061112222', password: 'QaPassword123!' }) })
  out.push(['customer register (/auth/register)', r.status])
}
j = await r.json().catch(() => ({}))

// login
let lr = await fetch(B + '/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'QaPassword123!' }) })
if (lr.status === 404) lr = await fetch(B + '/auth/customer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'QaPassword123!' }) })
const lj = await lr.json().catch(() => ({}))
const CT = lj?.data?.token || lj?.token
out.push(['customer login', lr.status, 'token=' + !!CT])

// customer token must NOT open admin endpoints
const ah = await fetch(B + '/appointments', { headers: { Authorization: 'Bearer ' + CT } })
out.push(['customer token on admin /appointments', ah.status, ah.status === 403 || ah.status === 401 ? 'blocked ✓' : 'LEAK (BAD)'])

// cross-customer access: customer token reading someone else's appointment (19)
const cross = await fetch(B + '/appointments/19', { headers: { Authorization: 'Bearer ' + CT } })
out.push(['customer GET others appointment', cross.status, cross.status >= 400 ? 'blocked ✓' : 'LEAK (BAD)'])

// customer sees only own appointments
const own = await fetch(B + '/account/appointments', { headers: { Authorization: 'Bearer ' + CT } })
const ownJ = await own.json().catch(() => ({}))
const items = ownJ?.data?.items || ownJ?.data || []
const foreign = Array.isArray(items) ? items.filter(x => x.customerEmail && x.customerEmail !== email) : []
out.push(['customer own list', own.status, `count=${Array.isArray(items) ? items.length : '?'}`, foreign.length ? `FOREIGN ROWS (BAD): ${foreign.length}` : 'no foreign rows ✓'])

// --- Online payment: cancelled/not-verified must not finalize ---
// Start a paystack transaction for a fresh booking? Instead directly test: create ONLINE booking without verification
const png = fs.readFileSync('.freebuff/qa-receipt.png')
const fd = new FormData()
fd.append('serviceId', '1'); fd.append('barberId', '1')
fd.append('appointmentDate', '2026-10-03'); fd.append('appointmentTime', '10:00')
fd.append('customerName', 'QA Online Probe'); fd.append('customerPhone', '07060000013'); fd.append('customerEmail', 'qa13@test.local')
fd.append('paymentMethod', 'ONLINE')
const on = await fetch(B + '/appointments', { method: 'POST', body: fd })
const onJ = await on.json().catch(() => ({}))
out.push(['ONLINE without verified payment', on.status, JSON.stringify(onJ?.message || '').slice(0, 90)])

console.log(out.map(l => l.join(' | ')).join('\n'))
console.log('QA_CUSTOMER_EMAIL=' + email)
