// Round-trip: stage with location → read session → finalize → inspect full payload
const BASE = 'http://localhost:5000/api'
async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const { execSync } = await import('node:child_process')
const out = execSync(`node -e "require('dotenv').config({path:'backend/.env'}); process.stdout.write(process.env.ADMIN_SEED_EMAIL+'|'+process.env.ADMIN_SEED_PASSWORD)"`, { encoding: 'utf8', cwd: process.cwd() })
const [email, password] = out.split('|')
const login = await req('POST', '/auth/login', { email, password })
const TOKEN = login.json.data.token

const svc = (await req('GET', '/services')).json.data.items[0]
const barbers = (await req('GET', '/barbers')).json.data.items
const barber = barbers.find((b) => b.services?.some((s) => s.id === svc.id)) ?? barbers[0]

const staged = await req('POST', '/checkout', {
  customerName: 'LOC-TEST Roundtrip',
  customerPhone: '08099988877',
  serviceId: svc.id,
  barberId: barber.id,
  customerLocation: 'Dutse, Jigawa',
  appointmentDate: '2026-11-20',
  appointmentTime: '09:30',
  paymentMethod: 'CASH',
})
console.log('stage status:', staged.status)
const s = staged.json?.data
const token2 = s?.sessionToken ?? s?.token
console.log('SESSION location field:', JSON.stringify(s?.customerLocation))
console.log('SESSION keys:', Object.keys(s ?? {}).join(','))
const fin = await req('POST', `/checkout/${token2}/finalize`)
console.log('finalize status:', fin.status)
const appt = fin.json?.data?.appointment ?? fin.json?.data
console.log('APPT full:', JSON.stringify(appt))
const admin = await req('GET', `/appointments/${appt.id}`, null, TOKEN)
console.log('ADMIN view full:', JSON.stringify(admin.json?.data).slice(0, 900))
