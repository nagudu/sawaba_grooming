// Confirms admin login + one authenticated read through the Vite dev proxy.
// Reads credentials from backend/.env; never prints the password.
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const env = {}
for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  env[l.slice(0, i).trim()] = v
}
const base = 'http://localhost:5173'
const r = await fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.ADMIN_SEED_EMAIL, password: env.ADMIN_SEED_PASSWORD }),
})
const j = await r.json()
const ok = Boolean(j?.data?.token)
console.log(`admin login via Vite proxy (${env.ADMIN_SEED_EMAIL}): ${r.status} ${ok ? 'OK' : 'FAILED ' + JSON.stringify(j).slice(0, 160)}`)
if (ok) {
  const h = { Authorization: `Bearer ${j.data.token}` }
  for (const p of ['/api/admin/dashboard', '/api/admin/payments', '/api/admin/customers', '/api/admin/barber-earnings']) {
    const res = await fetch(base + p, { headers: h })
    const body = await res.json().catch(() => null)
    console.log(`  ${res.status} ${p}`)
    if (p === '/api/admin/dashboard') console.log(`     totals: ${JSON.stringify(body?.data?.totals)}`)
  }
}
process.exit(ok ? 0 : 1)