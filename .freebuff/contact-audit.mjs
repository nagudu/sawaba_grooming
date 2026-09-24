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

// 1. public contact submit
const stamp = Date.now()
let r = await call('POST', '/contact', { name: 'QA Contact Probe', email: `qa-contact-${stamp}@test.local`, phone: '07069990001', message: 'QA probe contact message ' + stamp })
out.push(['contact submit', r.s, `id=${r.j?.data?.id}`])
const cid = r.j?.data?.id

// 2. validation: invalid email
r = await call('POST', '/contact', { name: 'QA', email: 'not-an-email', message: 'x'.repeat(20) })
out.push(['contact invalid email', r.s])

// 3. empty message
r = await call('POST', '/contact', { name: 'QA', email: 'ok@test.local' })
out.push(['contact missing message', r.s])

// 4. admin inbox
r = await call('GET', '/contact?perPage=50')
const found = (r.j?.data?.items || []).find(x => x.id === cid)
out.push(['admin inbox has message', r.s, found ? 'found ✓' : 'MISSING (BAD)'])

// 5. mark read
if (cid) { r = await call('PATCH', `/contact/${cid}/read`, {}); out.push(['mark read', r.s, JSON.stringify(r.j?.message || '').slice(0, 60)]) }

// 6. reply (email is in Resend sandbox — expect honest failure for non-whitelisted recipient)
if (cid) { r = await call('POST', `/contact/${cid}/reply`, { message: 'Thanks for reaching out — QA reply test.' }); out.push(['admin reply (sandbox)', r.s, JSON.stringify(r.j?.message || '').slice(0, 140)]) }

console.log(out.map(l => l.join(' | ')).join('\n'))
console.log('CONTACT_ID=' + cid)
