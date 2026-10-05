// Focused verification for the Prisma-converted services module.
// Smoke only proves the endpoint didn't crash; this asserts the exact semantics
// that changed during the Sequelize -> Prisma conversion:
//   Op.or/Op.like -> OR/contains, findAndCountAll -> $transaction([findMany, count]),
//   name ASC ordering, DECIMAL still serialized as a NUMBER, slug uniqueness,
//   and the appointment conflict guard on delete.
// Run: node .freebuff/services-check.mjs [port]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = String(process.argv[2] || '5057')
const API = `http://localhost:${PORT}/api`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}
const up = async () => { try { return (await fetch(`http://localhost:${PORT}/health`)).ok } catch { return false } }

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
const req = async (p, { method = 'GET', body, token } = {}) => {
  const h = {}
  if (token) h.Authorization = `Bearer ${token}`
  if (body !== undefined) h['Content-Type'] = 'application/json'
  const r = await fetch(API + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  let j = null; try { j = await r.json() } catch {}
  return { status: r.status, json: j }
}
const login = await req('/auth/login', { method: 'POST', body: { email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD } })
if (login.status !== 200) { console.log('admin login failed', login.status, JSON.stringify(login.json)); process.exit(1) }
const token = login.json.data.token
const created = []

console.log('=== read surface ===')
const all = await req('/services?perPage=100')
const items = all.json?.data?.items ?? []
check('total is 14', all.json?.data?.total === 14, `total ${all.json?.data?.total}`)
check('14 rows returned', items.length === 14, `rows ${items.length}`)
check('ordered by name ASC', items.every((s, i) => i === 0 || items[i - 1].name.localeCompare(s.name) <= 0), JSON.stringify(items.map((s) => s.name)))
check('only active services are public', items.every((s) => s.isActive === true))
// The big one: DECIMAL must stay a number, not a Prisma.Decimal or a string.
check('price is a JSON number (not a string)', items.every((s) => typeof s.price === 'number'), JSON.stringify(items.slice(0, 3).map((s) => [s.price, typeof s.price])))
check('price has at most 2 decimals', items.every((s) => Math.round(s.price * 100) === s.price * 100), JSON.stringify(items.map((s) => s.price)))
check('duration is a number', items.every((s) => typeof s.duration === 'number'))
check('createdAt is an ISO string', items.every((s) => typeof s.createdAt === 'string' && !Number.isNaN(Date.parse(s.createdAt))), JSON.stringify(items[0]?.createdAt))
check('updatedAt is an ISO string', items.every((s) => typeof s.updatedAt === 'string' && !Number.isNaN(Date.parse(s.updatedAt))), JSON.stringify(items[0]?.updatedAt))
check('every row carries a slug', items.every((s) => typeof s.slug === 'string' && s.slug.length > 0))

console.log('\n=== search (was Op.or + Op.like -> OR + contains) ===')
const target = items[0]
const term = target.name.split(' ')[0]
const searched = await req(`/services?perPage=100&search=${encodeURIComponent(term)}`)
const sItems = searched.json?.data?.items ?? []
check('search returns rows', sItems.length > 0, `${sItems.length} for "${term}"`)
check('every hit matches the term', sItems.every((s) => `${s.name} ${s.slug} ${s.description ?? ''}`.toLowerCase().includes(term.toLowerCase())), JSON.stringify(sItems.map((s) => s.name)))
check('search narrows the total', searched.json.data.total < 14, `total ${searched.json.data.total}`)
const noHit = await req('/services?perPage=100&search=zzzz-no-such-service-zzzz')
check('search with no match is empty', noHit.json?.data?.total === 0 && noHit.json.data.items.length === 0, JSON.stringify(noHit.json?.data))

console.log('\n=== category filter ===')
const cat = items[0].category
const byCat = await req(`/services?perPage=100&category=${encodeURIComponent(cat)}`)
check('category filter narrows results', (byCat.json?.data?.items ?? []).length > 0 && byCat.json.data.items.every((s) => s.category === cat), `${byCat.json?.data?.items?.length} in ${cat}`)

console.log('\n=== pagination (findAndCountAll -> $transaction) ===')
const p1 = await req('/services?page=1&perPage=3')
const p2 = await req('/services?page=2&perPage=3')
check('page 1 respects perPage', p1.json?.data?.items?.length === 3, `rows ${p1.json?.data?.items?.length}`)
check('total stays 14 across pages', p1.json?.data?.total === 14 && p2.json?.data?.total === 14, `${p1.json?.data?.total}/${p2.json?.data?.total}`)
check('pages do not overlap', p1.json.data.items[0].id !== p2.json.data.items[0].id)
check('page/perPage echoed back', p1.json?.data?.page === 1 && p1.json?.data?.perPage === 3, JSON.stringify({ page: p1.json?.data?.page, perPage: p1.json?.data?.perPage }))

console.log('\n=== single fetch + 404 ===')
const one = await req('/services/1')
check('GET /services/1', one.status === 200 && one.json?.data?.id === 1, `status ${one.status}`)
const missing = await req('/services/999999')
check('missing service is a 404 with the right message', missing.status === 404 && missing.json?.message === 'Service not found.', `${missing.status} ${missing.json?.message}`)

console.log('\n=== delete guard (appointment conflict) ===')
const conflict = await req('/services/15', { method: 'DELETE', token })
check('deleting a service with appointments is refused', conflict.status === 409, `${conflict.status} ${conflict.json?.message}`)
const stillThere = await req('/services/15')
check('the refused delete left the row intact', stillThere.status === 200, `status ${stillThere.status}`)

console.log('\n=== create + slug uniqueness + delete ===')
const name = `ZZ QA Services Probe ${Date.now()}`
const c1 = await req('/services', { method: 'POST', token, body: { name, price: 12.5, duration: 30, category: 'HAIRCUTS' } })
created.push(c1.json?.data?.id)
const slug1 = c1.json?.data?.slug
check('create returns 201', c1.status === 201, `${c1.status} ${JSON.stringify(c1.json)}`)
check('slug is generated from the name', typeof slug1 === 'string' && slug1 === name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), `slug ${slug1}`)
check('new price round-trips as a number', c1.json?.data?.price === 12.5, `price ${c1.json?.data?.price}`)
const c2 = await req('/services', { method: 'POST', token, body: { name, price: 9.99, duration: 15, category: 'HAIRCUTS' } })
created.push(c2.json?.data?.id)
check('duplicate name gets a de-duplicated slug', c2.json?.data?.slug === `${slug1}-2`, `${slug1} vs ${c2.json?.data?.slug}`)
const noOp = await req(`/services/${c1.json.data.id}`, { method: 'PUT', token, body: { name: c1.json.data.name, price: 12.5, duration: 30, category: 'HAIRCUTS' } })
check('renaming to the same name keeps the slug', noOp.json?.data?.slug === slug1, `${noOp.json?.data?.slug}`)

console.log('\n=== cleanup ===')
for (const id of created.filter(Boolean)) {
  const d = await req(`/services/${id}`, { method: 'DELETE', token })
  check(`probe service #${id} deleted`, d.status === 200, `${d.status} ${d.json?.message}`)
}
const after = await req('/services?perPage=100')
check('service count is back to 14', after.json?.data?.total === 14, `total ${after.json?.data?.total}`)

console.log(`\n==== SERVICES CHECK: ${pass} passed, ${fail} failed ====`)
if (apiProc) apiProc.kill()
process.exit(fail ? 1 : 0)
