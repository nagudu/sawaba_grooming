import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = '5063'
const API = `http://127.0.0.1:${PORT}/api`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}

const up = async () => { try { return (await fetch(`http://127.0.0.1:${PORT}/health`)).ok } catch { return false } }

let apiProc = null
if (await up()) {
  console.log(`API already up on :${PORT} — reusing\n`)
} else {
  apiProc = spawn(process.execPath, [path.join(ROOT, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], {
    cwd: path.join(ROOT, 'backend'),
    env: { ...process.env, PORT },
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  for (let i = 0; i < 120; i++) { if (await up()) break; await sleep(500) }
  if (!(await up())) { console.log('API failed to start'); process.exit(1) }
  console.log('API up\n')
}

let pass = 0, fail = 0
const check = (n, ok, d = '') => { ok ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + ' :: ' + d)) }

async function req(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body }
}

const login = await req('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }),
})
check('admin login', login.status === 200, JSON.stringify(login.body))
const token = login.body?.data?.token
const auth = { Authorization: `Bearer ${token}` }

const list = await req('/gallery?page=1&perPage=100', { headers: auth })
check('list 200', list.status === 200, String(list.status))
const items = list.body?.data?.items ?? []
check('has items', items.length > 0, `count ${items.length}`)
const item = items[0]

const r1 = await req(`/gallery/${item.id}`, {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({ title: item.title, category: item.category, image: item.image }),
})
check('edit w/ unchanged relative image -> 200', r1.status === 200, `${r1.status} ${JSON.stringify(r1.body?.message)}`)

const r2 = await req(`/gallery/${item.id}`, { method: 'PUT', headers: auth, body: JSON.stringify({ title: item.title }) })
check('edit no image field -> 200', r2.status === 200, `${r2.status}`)

const r3 = await req(`/gallery/${item.id}`, { method: 'PUT', headers: auth, body: JSON.stringify({ title: item.title, image: 'not-a-url' }) })
check('edit invalid image -> 422', r3.status === 422, `${r3.status}`)

const r4 = await req(`/gallery/${item.id}`, {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({ title: item.title + ' (edited)', category: item.category, image: item.image }),
})
check('edit echo image -> 200', r4.status === 200, `${r4.status} ${JSON.stringify(r4.body?.message)}`)
check('edit persisted title/category', r4.body?.data?.title === item.title + ' (edited)' && r4.body?.data?.category === item.category, JSON.stringify(r4.body?.data && { title: r4.body.data.title, category: r4.body.data.category }))
check('edit kept the image', r4.body?.data?.image === item.image, JSON.stringify(r4.body?.data?.image))

const cid = Date.now()
const r5 = await req('/gallery', {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({ title: `QA glyph ${cid}`, category: 'FADE', image: '/uploads/seed/fade.jpg' }),
})
check('create w/ relative image -> 201', r5.status === 201, `${r5.status}`)
if (r5.status === 201) {
  await req(`/gallery/${r5.body.data.id}`, { method: 'DELETE', headers: auth })
}

if (apiProc) { apiProc.kill(); console.log('\n(throwaway API stopped)') }
console.log(`\nRESULT ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)