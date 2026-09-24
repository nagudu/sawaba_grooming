import { config } from 'dotenv'
config({ path: 'backend/.env' })
const B = 'http://localhost:5000/api'

const r1 = await fetch(B + '/reviews?approved=false')
const j1 = await r1.json()
console.log('approved=false =>', r1.status, JSON.stringify(j1?.data?.items?.length ?? j1).slice(0, 200))
console.log('raw:', JSON.stringify(j1).slice(0, 400))

const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const T = (await login.json())?.data?.token
const r2 = await fetch(B + '/reviews?approved=false', { headers: { Authorization: 'Bearer ' + T } })
const j2 = await r2.json()
console.log('admin approved=false =>', r2.status, 'items:', j2?.data?.items?.length, j2?.data?.items?.slice(0, 3).map(x => ({ id: x.id, name: x.customerName, status: x.status })))
