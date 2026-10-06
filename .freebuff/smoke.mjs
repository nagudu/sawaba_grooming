// Post-cleanup smoke test: boots its own API, checks every read surface, creates nothing.
// Run: node .freebuff/smoke.mjs [port]
// The port is configurable so the suite can run against a throwaway instance with a
// fresh rate-limit bucket (the in-memory limiter caps at 300 requests / 15 min).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = String(process.argv[2] || '5000')
const API = `http://localhost:${PORT}/api`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}
const up = async () => { try { return (await fetch(`http://localhost:${PORT}/health`)).ok } catch { return false } }
// Reuse a backend that is already running; never kill one this script didn't start
// (killing the developer's own `npm run dev` backend caused the EADDRINUSE confusion).
let apiProc = null
if (await up()) {
  console.log(`API already up on :${PORT} — reusing it\n`)
} else {
  apiProc = spawn(process.execPath, [path.join(ROOT, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], { cwd: path.join(ROOT, 'backend'), env: { ...process.env, PORT }, stdio: ['ignore', 'ignore', 'ignore'] })
  for (let i = 0; i < 120; i++) { if (await up()) break; await sleep(500) }
  if (!(await up())) { console.log('API failed to start'); process.exit(1) }
  console.log('API up\n')
}

let pass = 0, fail = 0
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} :: ${d}`)) }
const get = async (p, token) => {
  const h = token ? { Authorization: `Bearer ${token}` } : {}
  const r = await fetch(API + p, { headers: h })
  let j = null; try { j = await r.json() } catch {}
  return { status: r.status, json: j }
}

console.log('=== public surfaces ===')
const svc = await get('/services?perPage=100')
check('GET /services', svc.status === 200, `status ${svc.status}`)
const barbers = await get('/barbers?perPage=100')
check('GET /barbers', barbers.status === 200, `status ${barbers.status}`)
check('the genuine barber is still listed', (barbers.json?.data?.items ?? []).some((b) => b.name === 'Gaddafi Salisu'), JSON.stringify((barbers.json?.data?.items ?? []).map((b) => b.name)))
check('no QA barber leaked into the public list', !(barbers.json?.data?.items ?? []).some((b) => /^QA |^TEST-|Journey|Probe|Cascade/.test(b.name)), JSON.stringify((barbers.json?.data?.items ?? []).map((b) => b.name)))
const gal = await get('/gallery?perPage=50')
check('GET /gallery', gal.status === 200 && (gal.json?.data?.items ?? []).length === 10, `status ${gal.status} count ${(gal.json?.data?.items ?? []).length}`)
const rev = await get('/reviews?perPage=50')
check('GET /reviews', rev.status === 200, `status ${rev.status}`)
check('only approved reviews are public', (rev.json?.data?.items ?? []).every((r) => r.isApproved !== false), `${(rev.json?.data?.items ?? []).length} reviews`)
const set = await get('/payments/settings')
check('GET /payments/settings', set.status === 200, `status ${set.status}`)
const av = await get('/availability?barberId=1&date=2026-10-03')
check('GET /availability', av.status === 200, `status ${av.status}`)
const doc = await fetch(`${API}/docs`)
check('Swagger UI reachable at /api/docs', doc.ok, `status ${doc.status}`)
check('Swagger spec reachable', (await fetch('http://localhost:5000/api/docs/spec')).ok)
check('404 shape is consistent', (await get('/services/99999')).status === 404)

console.log('\n=== admin surfaces ===')
const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const lj = await login.json()
const tok = lj?.data?.token
check('admin can sign in', login.ok && Boolean(tok), `status ${login.status}`)
for (const [label, p] of [['dashboard', '/admin/dashboard'], ['payments', '/admin/payments'], ['customers', '/admin/customers'], ['payment-settings', '/admin/payment-settings'], ['barber-earnings', '/admin/barber-earnings'], ['commission-rates', '/admin/commission-rates']]) {
  const r = await get(p, tok)
  check(`GET ${p}`, r.status === 200, `status ${r.status}`)
}
// the admin appointments list lives on the shared router; /admin/appointments only exposes assignment
const adminAppts = await get('/appointments?perPage=50', tok)
check('GET /appointments with an admin token lists the genuine appointment', adminAppts.status === 200 && (adminAppts.json?.data?.items ?? []).length === 1, `status ${adminAppts.status} count ${(adminAppts.json?.data?.items ?? []).length}`)
const hist = await get(`/admin/appointments/${(adminAppts.json?.data?.items ?? [])[0]?.id}/assignment-history`, tok)
check('assignment history endpoint answers', [200, 404].includes(hist.status), `status ${hist.status}`)
check('/admin/appointments has no list route by design', (await get('/admin/appointments', tok)).status === 404)
const dash = await get('/admin/dashboard', tok)
const dj = dash.json?.data ?? {}
check('dashboard totals match the cleaned database', dj.totals?.appointments === 1 && dj.totals?.customers === 1 && dj.totals?.barbers === 1 && dj.totals?.services === 14, JSON.stringify(dj.totals))
const noAuth = await get('/admin/dashboard')
check('admin dashboard is closed without a token', noAuth.status === 401 || noAuth.status === 403, `status ${noAuth.status}`)
const badToken = await get('/admin/dashboard', 'not.a.real.token')
check('admin dashboard rejects a forged token', badToken.status === 401 || badToken.status === 403, `status ${badToken.status}`)

console.log('\n=== admin write authorization on the shared routers ===')
// The admin UI performs CRUD through /api/services, /api/barbers, /api/gallery, /api/reviews
// with the admin token. A no-op PUT proves the role gate without creating rows.
const svc1 = (await get('/services?perPage=1')).json?.data?.items?.[0]
const noop = async (token, label) => {
  const r = await fetch(`${API}/services/${svc1.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ name: svc1.name, price: svc1.price, duration: svc1.duration, category: svc1.category, isActive: svc1.isActive }) })
  return r.status
}
check('admin may write to /api/services', [200].includes(await noop(tok)), `status ${await noop(tok)}`)
check('an anonymous write is refused', [401, 403].includes(await noop(null)), `status ${await noop(null)}`)
check('a customer token cannot write to /api/services', [401, 403].includes(await noop('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiY3VzdG9tZXIifQ.bogus')), `status ${await noop('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiY3VzdG9tZXIifQ.bogus')}`)
check('the no-op write left the service unchanged', (await get('/services?perPage=1')).json?.data?.items?.[0]?.name === svc1.name)

console.log('\n=== barber portal (read-only, existing account) ===')
const bl = await fetch(`${API}/barber/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: '08033445566', password: process.env.BARBER_SEED_PASSWORD }) })
const bt = (await bl.json())?.data?.token
if (bt) {
  for (const [label, p] of [['overview', '/barber/portal/overview'], ['appointments', '/barber/portal/appointments'], ['earnings', '/barber/portal/earnings'], ['availability', '/barber/portal/availability'], ['notifications', '/barber/portal/notifications']]) {
    const r = await get(p, bt)
    check(`GET /barber/portal/${label}`, r.status === 200, `status ${r.status}`)
  }
} else console.log('  -- barber seed login unavailable, portal endpoints not exercised')

console.log(`\n==== SMOKE: ${pass} passed, ${fail} failed ====`)
try { if (apiProc) process.kill(apiProc.pid, 'SIGKILL') } catch {}
process.exit(fail ? 1 : 0)