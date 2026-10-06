// Focused verification for the Prisma-converted gallery + reviews modules.
// Asserts the semantics that changed in the Sequelize -> Prisma conversion:
//   include: [{ model: Barber, attributes: [...] }] -> include: { barbers: { select } },
//   createdAt DESC ordering, category/barberId filters, rating staying a number
//   (UNSIGNED TINYINT), isApproved still DERIVED from status, and the
//   status/isApproved write-priority rule in updateReview.
// Run: node .freebuff/gallery-reviews-check.mjs [port]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = String(process.argv[2] || '5058')
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
const created = { gallery: [], reviews: [] }

console.log('=== gallery read surface (relation include) ===')
const gal = await req('/gallery?perPage=50')
const gItems = gal.json?.data?.items ?? []
check('gallery total is 10', gal.json?.data?.total === 10, `total ${gal.json?.data?.total}`)
check('gallery rows returned', gItems.length === 10, `rows ${gItems.length}`)
check('ordered by createdAt DESC', gItems.every((g, i) => i === 0 || Date.parse(gItems[i - 1].createdAt) >= Date.parse(g.createdAt)), JSON.stringify(gItems.slice(0, 3).map((g) => g.createdAt)))
check('barber is embedded as {id,name} or null', gItems.every((g) => g.barber === null || (typeof g.barber.id === 'number' && typeof g.barber.name === 'string')), JSON.stringify(gItems.map((g) => g.barber)))
check('the barber include is not a raw barber row', gItems.every((g) => g.barber === null || Object.keys(g.barber).length === 2), JSON.stringify(gItems.map((g) => g.barber && Object.keys(g.barber))))
check('barberId mirrors the embedded barber id', gItems.every((g) => (g.barber ? g.barberId === g.barber.id : g.barberId === null)))
check('category is a string', gItems.every((g) => typeof g.category === 'string'))
check('createdAt is an ISO string', gItems.every((g) => typeof g.createdAt === 'string' && !Number.isNaN(Date.parse(g.createdAt))))

const gCat = gItems[0].category
const byCat = await req(`/gallery?perPage=50&category=${gCat}`)
check('gallery category filter works', (byCat.json?.data?.items ?? []).length > 0 && byCat.json.data.items.every((g) => g.category === gCat), `${byCat.json?.data?.items?.length} in ${gCat}`)
const byBarber = await req('/gallery?perPage=50&barberId=1')
check('gallery barberId filter works', (byBarber.json?.data?.items ?? []).every((g) => g.barberId === 1), `${byBarber.json?.data?.items?.length} for barber 1`)
const gMiss = await req('/gallery/999999')
check('missing gallery item is a 404', gMiss.status === 404 && gMiss.json?.message === 'Gallery item not found.', `${gMiss.status} ${gMiss.json?.message}`)

console.log('\n=== gallery create guards ===')
const noImage = await req('/gallery', { method: 'POST', token, body: { title: 'QA no image', category: 'HAIRCUT' } })
check('create without an image is refused', noImage.status === 400, `${noImage.status} ${noImage.json?.message}`)
const badBarber = await req('/gallery', { method: 'POST', token, body: { title: 'QA bad barber', category: 'HAIRCUT', image: 'https://example.com/x.jpg', barberId: 999999 } })
check('create with an unknown barber is a 404', badBarber.status === 404 && badBarber.json?.message === 'Linked barber does not exist.', `${badBarber.status} ${badBarber.json?.message}`)

console.log('\n=== reviews read surface ===')
const revs = await req('/reviews?perPage=50')
const rItems = revs.json?.data?.items ?? []
check('reviews total is 6', revs.json?.data?.total === 6, `total ${revs.json?.data?.total}`)
check('ordered by createdAt DESC', rItems.every((r, i) => i === 0 || Date.parse(rItems[i - 1].createdAt) >= Date.parse(r.createdAt)))
check('rating is a JSON number', rItems.every((r) => typeof r.rating === 'number'), JSON.stringify(rItems.slice(0, 3).map((r) => [r.rating, typeof r.rating])))
check('rating is within 1..5', rItems.every((r) => r.rating >= 1 && r.rating <= 5))
// isApproved must stay DERIVED from status, not read from the column.
check('isApproved agrees with status on every row', rItems.every((r) => r.isApproved === (r.status === 'APPROVED')), JSON.stringify(rItems.map((r) => [r.status, r.isApproved])))
check('nullable fields are null, not undefined', rItems.every((r) => 'customerPhone' in r && 'customerEmail' in r && 'serviceId' in r))
const approved = await req('/reviews?perPage=50&approved=true')
check('approved=true filters to APPROVED', (approved.json?.data?.items ?? []).every((r) => r.status === 'APPROVED') && (approved.json?.data?.items ?? []).length > 0, `${approved.json?.data?.items?.length} approved`)
const pending = await req('/reviews?perPage=50&approved=false')
check('approved=false filters to PENDING', (pending.json?.data?.items ?? []).every((r) => r.status === 'PENDING'), `${pending.json?.data?.items?.length} pending`)
// `status` (and approved=false/all) is an ADMIN-only listing; barberId stays public.
const allSt = await req('/reviews?perPage=50&status=all', { token })
check('status=all returns everything (admin)', allSt.status === 200 && allSt.json?.data?.total === revs.json.data.total, `${allSt.status} ${allSt.json?.data?.total} vs ${revs.json.data.total}`)
const allAnon = await req('/reviews?perPage=50&status=all')
check('status=all is refused without a token', allAnon.status === 401, `${allAnon.status}`)
const byBarberRev = await req('/reviews?perPage=50&barberId=1')
check('reviews barberId filter works', (byBarberRev.json?.data?.items ?? []).every((r) => r.barberId === 1), `${byBarberRev.json?.data?.items?.length} for barber 1`)
const term = rItems[0].customerName.split(' ')[0]
const searched = await req(`/reviews?perPage=50&search=${encodeURIComponent(term)}`)
check('review search matches', (searched.json?.data?.items ?? []).length > 0 && searched.json.data.items.every((r) => `${r.customerName} ${r.comment} ${r.customerPhone ?? ''} ${r.customerEmail ?? ''} ${r.serviceName ?? ''}`.toLowerCase().includes(term.toLowerCase())), `${searched.json?.data?.items?.length} for "${term}"`)

console.log('\n=== review create defaults + update priority ===')
const created1 = await req('/reviews', { method: 'POST', body: { customerName: `QA Rev ${Date.now()}`, rating: 4, comment: 'probe comment' } })
created.reviews.push(created1.json?.data?.id)
check('new review defaults to PENDING', created1.json?.data?.status === 'PENDING', created1.json?.data?.status)
check('new review isApproved is false', created1.json?.data?.isApproved === false)
check('new review rating round-trips', created1.json?.data?.rating === 4, `${created1.json?.data?.rating}`)
const rid = created1.json?.data?.id
const byStatus = await req(`/reviews/${rid}`, { method: 'PATCH', token, body: { status: 'APPROVED' } })
check('PATCH status=APPROVED flips isApproved true', byStatus.json?.data?.status === 'APPROVED' && byStatus.json?.data?.isApproved === true, JSON.stringify([byStatus.json?.data?.status, byStatus.json?.data?.isApproved]))
const byFlag = await req(`/reviews/${rid}`, { method: 'PATCH', token, body: { isApproved: false } })
check('PATCH isApproved=false flips status to PENDING', byFlag.json?.data?.status === 'PENDING' && byFlag.json?.data?.isApproved === false, JSON.stringify([byFlag.json?.data?.status, byFlag.json?.data?.isApproved]))
const both = await req(`/reviews/${rid}`, { method: 'PATCH', token, body: { status: 'REJECTED', isApproved: true } })
check('status wins when both are sent', both.json?.data?.status === 'REJECTED' && both.json?.data?.isApproved === false, JSON.stringify([both.json?.data?.status, both.json?.data?.isApproved]))
const revMiss = await req('/reviews/999999', { method: 'PATCH', token, body: { status: 'APPROVED' } })
check('updating a missing review is a 404', revMiss.status === 404 && revMiss.json?.message === 'Review not found.', `${revMiss.status} ${revMiss.json?.message}`)

console.log('\n=== cleanup ===')
for (const id of created.reviews.filter(Boolean)) {
  const d = await req(`/reviews/${id}`, { method: 'DELETE', token })
  check(`probe review #${id} deleted`, d.status === 200, `${d.status} ${d.json?.message}`)
}
const revAfter = await req('/reviews?perPage=50')
check('review count is back to 6', revAfter.json?.data?.total === 6, `total ${revAfter.json?.data?.total}`)
const galAfter = await req('/gallery?perPage=50')
check('gallery count is back to 10', galAfter.json?.data?.total === 10, `total ${galAfter.json?.data?.total}`)

console.log(`\n==== GALLERY+REVIEWS CHECK: ${pass} passed, ${fail} failed ====`)
if (apiProc) apiProc.kill()
process.exit(fail ? 1 : 0)
