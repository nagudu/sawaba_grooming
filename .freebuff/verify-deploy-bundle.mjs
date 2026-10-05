// Boots the committed deploy bundle exactly as Railway would and checks it serves.
// Run: node .freebuff/verify-deploy-bundle.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = '5055'
const BASE = `http://localhost:${PORT}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}
// deploy/node_modules does not exist locally; Railway runs `npm install --omit=dev` before
// `node dist/server.js`, so resolve the bundle's deps from the backend install for this check.
const proc = spawn(process.execPath, ['dist/server.js'], {
  cwd: path.join(ROOT, 'deploy'),
  env: { ...process.env, PORT, NODE_ENV: 'production', SERVE_STATIC_DIR: path.join(ROOT, 'deploy', 'spa'), NODE_PATH: path.join(ROOT, 'backend', 'node_modules') },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let out = ''
proc.stdout.on('data', (d) => { out += d })
proc.stderr.on('data', (d) => { out += d })

const code = async (p) => { try { const r = await fetch(BASE + p); return r.status } catch { return 0 } }
let up = false
for (let i = 0; i < 80; i++) { if (await code('/health')) { up = true; break } await sleep(500) }
if (!up) { console.log('deploy bundle failed to boot:\n' + out); process.exit(1) }

let pass = 0, fail = 0
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} :: ${d}`)) }
check('GET /health', (await code('/health')) === 200)
check('GET /api/services', (await code('/api/services')) === 200)
check('GET /api/barbers', (await code('/api/barbers')) === 200)
check('GET /api/payments/settings', (await code('/api/payments/settings')) === 200)
check('GET /api/docs (swagger)', (await code('/api/docs')) === 200)
check('admin routes are mounted', (await code('/api/admin/dashboard')) === 401)
check('barber portal routes are present', (await code('/api/barber/portal/overview')) === 401)
check('SPA index served from deploy/spa', (await code('/')) === 200)
const idx = await (await fetch(BASE + '/')).text()
check('SPA index references the built bundle', /assets\/index-.*\.js/.test(idx), idx.slice(0, 120))
const asset = /assets\/index-[^"']+\.js/.exec(idx)?.[0]
check('SPA main bundle is fetchable', asset ? (await code('/' + asset)) === 200 : false, String(asset))
check('unknown API route returns JSON 404', (await code('/api/does-not-exist')) === 404)

console.log(`\n==== DEPLOY BUNDLE: ${pass} passed, ${fail} failed ====`)
console.log('--- server boot log ---')
console.log(out.trim().split('\n').slice(-14).join('\n'))
try { process.kill(proc.pid, 'SIGKILL') } catch {}
process.exit(fail ? 1 : 0)