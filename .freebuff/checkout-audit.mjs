import { config } from 'dotenv'
config({ path: 'backend/.env' })
import fs from 'node:fs'
const B = 'http://localhost:5000/api'
const out = []
const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const T = (await login.json())?.data?.token
const AH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }
const adminAppts = async () => (await (await fetch(B + '/appointments?perPage=100', { headers: AH })).json())?.data?.items || []
const call = async (m, p, body, hdrs = {}) => {
  const r = await fetch(B + p, { method: m, headers: hdrs.bodyType ? hdrs : { ...AH, ...hdrs }, body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { s: r.status, j }
}

const before = (await adminAppts()).length

// --- SCENARIO A: abandon (Back to Home equivalent) ---
let fd = new FormData()
fd.append('serviceId', '1'); fd.append('barberId', '1')
fd.append('appointmentDate', '2026-10-05'); fd.append('appointmentTime', '10:00')
fd.append('customerName', 'QA Abandon Probe'); fd.append('customerPhone', '07060000021'); fd.append('customerEmail', 'qa21@test.local')
fd.append('paymentMethod', 'CASH')
let r = await fetch(B + '/checkout', { method: 'POST', body: fd })
let j = await r.json().catch(() => ({}))
const sTokenA = j?.data?.sessionToken
out.push(['A1 cash session created', r.s, `token=${!!sTokenA}`])
r = await call('POST', `/checkout/${sTokenA}/abandon`)
out.push(['A2 abandon', r.s, JSON.stringify(r.j?.data?.status ?? r.j?.message).slice(0, 60)])
const afterA = (await adminAppts()).length
out.push(['A3 abandon => no appointment rows', `${before} -> ${afterA}`, before === afterA ? '✓ nothing saved' : 'ROW SAVED (BAD)'])

// --- SCENARIO B: cash finalize ---
fd = new FormData()
fd.append('serviceId', '1'); fd.append('barberId', '1')
fd.append('appointmentDate', '2026-10-05'); fd.append('appointmentTime', '11:00')
fd.append('customerName', 'QA CashFinal Probe'); fd.append('customerPhone', '07060000022'); fd.append('customerEmail', 'qa22@test.local')
fd.append('paymentMethod', 'CASH')
r = await fetch(B + '/checkout', { method: 'POST', body: fd })
j = await r.json().catch(() => ({}))
const sTokenB = j?.data?.sessionToken
r = await call('POST', `/checkout/${sTokenB}/finalize`)
const apptB = r.j?.data?.appointment?.id
out.push(['B1 cash finalize', r.s, `appt=${apptB}`, `payStatus=${r.j?.data?.payment?.status}`])

// --- SCENARIO C: transfer session without receipt is rejected at creation ---
fd = new FormData()
fd.append('serviceId', '1'); fd.append('barberId', '1')
fd.append('appointmentDate', '2026-10-05'); fd.append('appointmentTime', '12:00')
fd.append('customerName', 'QA TransferProbe'); fd.append('customerPhone', '07060000023'); fd.append('customerEmail', 'qa23@test.local')
fd.append('paymentMethod', 'BANK_TRANSFER')
r = await fetch(B + '/checkout', { method: 'POST', body: fd })
j = await r.json().catch(() => ({}))
out.push(['C1 transfer session w/o receipt', r.s, String(j?.message || '').slice(0, 80)])

// --- SCENARIO D: online session → forged paystack verify must fail ---
fd = new FormData()
fd.append('serviceId', '1'); fd.append('barberId', '1')
fd.append('appointmentDate', '2026-10-05'); fd.append('appointmentTime', '13:00')
fd.append('customerName', 'QA OnlineS Probe'); fd.append('customerPhone', '07060000024'); fd.append('customerEmail', 'qa24@test.local')
fd.append('paymentMethod', 'ONLINE')
r = await fetch(B + '/checkout', { method: 'POST', body: fd })
j = await r.json().catch(() => ({}))
const sTokenD = j?.data?.sessionToken
out.push(['D1 online session created', r.s, `token=${!!sTokenD}`])
r = await call('POST', `/checkout/${sTokenD}/paystack/initialize`)
out.push(['D2 paystack init', r.s, String(r.j?.data?.authorizationUrl || r.j?.message || '').slice(0, 80)])
r = await call('POST', `/checkout/${sTokenD}/paystack/verify`, { reference: 'FAKE-REF-XYZ' })
out.push(['D3 forged verify', r.s, String(r.j?.message || '').slice(0, 90)])
const afterD = (await adminAppts()).length
out.push(['D4 forged verify => no appointment', `rows=${afterD}`, afterD === afterA + 1 ? '✓ nothing saved' : 'ROW SAVED (BAD)'])

console.log(out.map(l => l.join(' | ')).join('\n'))
