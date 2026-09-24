import { config } from 'dotenv'
config({ path: 'backend/.env' })
import fs from 'node:fs'
const B = 'http://localhost:5000/api'

const png = fs.readFileSync('.freebuff/qa-receipt.png')
const fd = new FormData()
fd.append('serviceId', '1')
fd.append('barberId', '1')
fd.append('appointmentDate', '2026-10-02')
fd.append('appointmentTime', '10:00')
fd.append('customerName', 'QA Bank Probe')
fd.append('customerPhone', '07060000011')
fd.append('customerEmail', 'qa11@test.local')
fd.append('paymentMethod', 'BANK_TRANSFER')
fd.append('receipt', new Blob([png], { type: 'image/png' }), 'qa-receipt.png')

const r = await fetch(B + '/appointments', { method: 'POST', body: fd })
console.log(r.status, (await r.text()).slice(0, 300))
