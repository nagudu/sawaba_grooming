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

// Bank booking #1 created as appt 20 (payment 20): verify it
let r = await call('POST', '/admin/payments/20/verify', { note: 'QA verify' })
out.push(['verify bank payment 20', r.s, `payStatus=${r.j?.data?.payment?.status ?? r.j?.data?.status}`, `apptStatus=${r.j?.data?.appointment?.status ?? ''}`])

// Bank booking #2 = appt 21 (payment 21): reject it, expect retry-able state
r = await call('POST', '/admin/payments/21/reject', { reason: 'QA rejection test' })
out.push(['reject bank payment 21', r.s, `apptStatus=${r.j?.data?.appointment?.status ?? r.j?.data?.status}`])

// Customer retry: same customer books again with a fresh receipt (multipart)
import fs from 'node:fs'
const png = fs.readFileSync('.freebuff/qa-receipt.png')
const fd = new FormData()
fd.append('serviceId', '1'); fd.append('barberId', '1')
fd.append('appointmentDate', '2026-10-02'); fd.append('appointmentTime', '12:00')
fd.append('customerName', 'QA Reject Probe'); fd.append('customerPhone', '07060000012'); fd.append('customerEmail', 'qa12@test.local')
fd.append('paymentMethod', 'BANK_TRANSFER')
fd.append('receipt', new Blob([png], { type: 'image/png' }), 'qa-receipt-retry.png')
const retry = await fetch(B + '/appointments', { method: 'POST', body: fd })
const rj = await retry.json().catch(() => ({}))
out.push(['customer retry after reject', retry.status, `appt=${rj?.data?.appointment?.id}`])

console.log(out.map(l => l.join(' | ')).join('\n'))
