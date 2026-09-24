import { config } from 'dotenv'
config({ path: 'backend/.env' })
const B = 'http://localhost:5000/api'
const out = []

const email = `qa-cust-${Date.now()}@test.local`
// register (correct field: fullName)
let r = await fetch(B + '/account/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: 'QA Customer', email, phone: '07061112222', password: 'QaPassword123!' }) })
out.push(['customer register', r.status])
const rj = await r.json().catch(() => ({}))

// login (by phone + password)
const lr = await fetch(B + '/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '07061112222', password: 'QaPassword123!' }) })
const lj = await lr.json().catch(() => ({}))
const CT = lj?.data?.token || lj?.token
out.push(['customer login', lr.status, 'token=' + !!CT])

// wrong password
const wr = await fetch(B + '/account/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '07061112222', password: 'WrongPassword1!' }) })
out.push(['customer wrong password', wr.status, (await wr.json().catch(() => ({})))?.message?.slice(0, 60)])

if (CT) {
  // customer token must NOT open admin endpoints
  const ah = await fetch(B + '/appointments', { headers: { Authorization: 'Bearer ' + CT } })
  out.push(['customer token on admin /appointments', ah.status, ah.status >= 400 ? 'blocked ✓' : 'LEAK (BAD)'])

  // cross-customer access: reading someone else's appointment
  const cross = await fetch(B + '/appointments/19', { headers: { Authorization: 'Bearer ' + CT } })
  out.push(['customer GET others appointment', cross.status, cross.status >= 400 ? 'blocked ✓' : 'LEAK (BAD)'])

  // own appointments list
  const own = await fetch(B + '/account/appointments', { headers: { Authorization: 'Bearer ' + CT } })
  const ownJ = await own.json().catch(() => ({}))
  const items = ownJ?.data?.items || ownJ?.data || []
  const arr = Array.isArray(items) ? items : []
  const foreign = arr.filter(x => x.customerEmail && x.customerEmail !== email)
  out.push(['customer own list', own.status, `count=${arr.length}`, foreign.length ? `FOREIGN ROWS (BAD)` : 'no foreign rows ✓'])

  // me endpoint
  const me = await fetch(B + '/account/me', { headers: { Authorization: 'Bearer ' + CT } })
  const meJ = await me.json().catch(() => ({}))
  out.push(['account/me', me.status, meJ?.data?.email || meJ?.data?.customer?.email || '?'])
}

console.log(out.map(l => l.join(' | ')).join('\n'))
console.log('EMAIL=' + email)
