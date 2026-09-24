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

// 1. Snapshot immutability on settled row (barber 8, PAID amount 1350 @30%)
let r = await call('GET', '/admin/barber-earnings?perPage=50')
const earnings = r.j?.data?.items || []
const settled = earnings.find(e => (e.barberId ?? e.barber?.id) === 8 && (e.status === 'PAID' || e.status === 'EARNED'))
if (settled) {
  const before = JSON.stringify({ a: settled.commissionAmount, r: settled.commissionRateSnapshot, s: settled.status })
  r = await call('PUT', '/admin/commission-rates/8', { commissionType: 'PERCENTAGE', commissionValue: 55 })
  out.push(['rate change barber 8 → 55%', r.s])
  r = await call('GET', '/admin/barber-earnings?perPage=50')
  const after = (r.j?.data?.items || []).find(e => e.id === settled.id)
  const afterStr = JSON.stringify({ a: after?.commissionAmount, r: after?.commissionRateSnapshot, s: after?.status })
  out.push(['snapshot immutable', before === afterStr ? `✓ (${before})` : `CHANGED (BAD) ${before} -> ${afterStr}`])
  r = await call('PUT', '/admin/commission-rates/8', { commissionType: 'PERCENTAGE', commissionValue: 30 })
  out.push(['rate restored to 30%', r.s])
} else {
  out.push(['no settled earning for barber 8 found', 'skip immutability'])
}

// 2. Rate history
r = await call('GET', '/admin/commission-rates')
const hist = r.j?.data
out.push(['commission-rates payload keys', r.s, Object.keys(hist || {}).join(','), JSON.stringify(hist).slice(0, 200)])

console.log(out.map(l => l.join(' | ')).join('\n'))
