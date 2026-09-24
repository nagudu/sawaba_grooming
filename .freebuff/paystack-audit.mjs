import { config } from 'dotenv'
config({ path: 'backend/.env' })
import fs from 'node:fs'
const B = 'http://localhost:5000/api'
const out = []

// Fresh booking with ONLINE method
const fd = new FormData()
fd.append('serviceId', '1'); fd.append('barberId', '1')
fd.append('appointmentDate', '2026-10-04'); fd.append('appointmentTime', '14:00')
fd.append('customerName', 'QA Online Probe'); fd.append('customerPhone', '07060000013'); fd.append('customerEmail', 'qa13b@test.local')
fd.append('paymentMethod', 'ONLINE')
const appt = await fetch(B + '/appointments', { method: 'POST', body: fd })
const apptJ = await appt.json().catch(() => ({}))
const d = apptJ?.data || {}
const apptId = d.appointment?.id || d.id
const token = d.payment?.token || d.token
out.push(['ONLINE booking created', appt.status, `appt=${apptId}`, `token=${token ? String(token).slice(0, 8) + '…' : 'MISSING'}`])

if (token) {
  // init paystack — real API call with test key
  const init = await fetch(`${B}/payments/paystack/initialize/${token}`, { method: 'POST' })
  const initJ = await init.json().catch(() => ({}))
  out.push(['paystack initialize', init.status, String(initJ?.data?.authorizationUrl || initJ?.message || '').slice(0, 100)])

  // forged verify with a made-up reference — backend must re-check with Paystack and reject
  const forge = await fetch(`${B}/payments/paystack/verify/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference: 'FAKE-REF-123' }) })
  const forgeJ = await forge.json().catch(() => ({}))
  out.push(['forged verify (fake reference)', forge.status, String(forgeJ?.message || '').slice(0, 100)])
}

console.log(out.map(l => l.join(' | ')).join('\n'))
