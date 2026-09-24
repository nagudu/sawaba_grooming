import { config } from 'dotenv'
config({ path: 'backend/.env' })
const B = 'http://localhost:5000/api'
const out = []

const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const T = (await login.json())?.data?.token
const AH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }

// Admin dashboard totals
let r = await fetch(B + '/admin/dashboard', { headers: AH })
const dj = await r.json().catch(() => ({}))
const totals = dj?.data?.totals || {}
out.push(['admin dashboard', r.s, `totals=${JSON.stringify(totals).slice(0, 220)}`])

// notifications endpoints probe (admin)
for (const p of ['/admin/notifications', '/notifications', '/admin/notifications/unread-count', '/account/notifications']) {
  const rr = await fetch(B + p, { headers: AH })
  let jj = null; try { jj = await rr.json() } catch {}
  out.push([`GET ${p}`, rr.status, JSON.stringify(jj?.data ?? jj?.message).slice(0, 100)])
}

// barber notifications table exists — check via barber portal login? Just verify the model endpoint is mounted
r = await fetch(B + '/barber/portal/notifications', { headers: AH })
let jj = null; try { jj = await r.json() } catch {}
out.push(['GET /barber/portal/notifications (admin token)', r.status, JSON.stringify(jj?.message).slice(0, 80)])

console.log(out.map(l => l.join(' | ')).join('\n'))
