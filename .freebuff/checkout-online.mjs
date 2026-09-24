import { config } from 'dotenv'
config({ path: 'backend/.env' })
const B = 'http://localhost:5000/api'
const out = []
const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const T = (await login.json())?.data?.token
const AH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }
const adminAppts = async () => (await (await fetch(B + '/appointments?perPage=100', { headers: AH })).json())?.data?.items || []
const call = async (m, p, body) => {
  const r = await fetch(B + p, { method: m, headers: AH, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { s: r.status, j }
}

const fd = new FormData()
fd.append('serviceId', '1'); fd.append('barberId', '1')
fd.append('appointmentDate', '2026-10-05'); fd.append('appointmentTime', '14:00')
fd.append('customerName', 'QA Online Probe'); fd.append('customerPhone', '07060000025'); fd.append('customerEmail', 'qa25@test.local')
fd.append('paymentMethod', 'ONLINE')
let r = await fetch(B + '/checkout', { method: 'POST', body: fd })
let j = await r.json().catch(() => ({}))
const tok = j?.data?.sessionToken
const before = (await adminAppts()).length

r = await call('POST', `/checkout/${tok}/paystack/initialize`)
out.push(['paystack init (test key)', r.s, String(r.j?.data?.authorizationUrl || r.j?.message || '').slice(0, 110)])
r = await call('POST', `/checkout/${tok}/paystack/verify`, { reference: 'FAKE-REF-XYZ' })
out.push(['forged verify', r.s, String(r.j?.message || '').slice(0, 110)])
const after = (await adminAppts()).length
out.push(['appointment rows', `${before} -> ${after}`, before === after ? '✓ nothing saved' : 'ROW SAVED (BAD)'])
// cleanup session
await fetch(B + `/checkout/${tok}/abandon`, { method: 'POST' })
console.log(out.map(l => l.join(' | ')).join('\n'))
