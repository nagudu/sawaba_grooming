import { config } from 'dotenv'
config({ path: 'backend/.env' })
const B = 'http://localhost:5000/api'

const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const T = (await login.json())?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }
const out = []

// 1. pending hidden from public
let pub = await (await fetch(B + '/reviews?approved=true&perPage=100')).json()
out.push(['pending hidden publicly', (pub?.data?.items || []).some(x => x.id === 13) ? 'VISIBLE (BAD)' : 'hidden ✓'])

// 2. approve
let r = await fetch(B + '/reviews/13', { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'APPROVED' }) })
out.push(['admin approve', r.status])

// 3. now public
pub = await (await fetch(B + '/reviews?approved=true&perPage=100')).json()
out.push(['approved now public', (pub?.data?.items || []).some(x => x.id === 13) ? 'visible ✓' : 'MISSING (BAD)'])

// 4. reject
r = await fetch(B + '/reviews/13', { method: 'PATCH', headers: H, body: JSON.stringify({ status: 'REJECTED' }) })
out.push(['admin reject', r.status])

// 5. rejected hidden again
pub = await (await fetch(B + '/reviews?approved=true&perPage=100')).json()
out.push(['rejected hidden publicly', (pub?.data?.items || []).some(x => x.id === 13) ? 'VISIBLE (BAD)' : 'hidden ✓'])

// 6. delete
r = await fetch(B + '/reviews/13', { method: 'DELETE', headers: H })
out.push(['admin delete', r.status])

console.log(out.map(l => l.join(' | ')).join('\n'))
