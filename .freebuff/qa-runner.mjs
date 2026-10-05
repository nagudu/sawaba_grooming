// QA battery runner v2 — restarts the backend before each battery so the
// in-memory express-rate-limit counters (300 req / 15 min, 20 bookings / 15 min)
// never cause false failures. Loads backend/.env for admin credentials.
// Run: node .freebuff/qa-runner.mjs [name-fragment...]
import { spawn, execSync } from 'node:child_process'
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const BACKEND = path.join(ROOT, 'backend')

// --- load backend/.env into process.env (never printed) ---
for (const raw of readFileSync(path.join(BACKEND, '.env'), 'utf8').split(/\r?\n/)) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  if (eq < 1) continue
  const k = line.slice(0, eq).trim()
  let v = line.slice(eq + 1).trim()
  if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[k] = v
}
if (!process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD) {
  console.error('FATAL: admin seed credentials missing from backend/.env')
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function killPort(port) {
  try {
    const out = execSync(`netstat -ano -p TCP | findstr ":${port}.*LISTENING"`, { encoding: 'utf8' })
    const pids = new Set(
      out.split(/\r?\n/).map((l) => (l.trim().split(/\s+/).pop() || '')).filter((p) => /^\d+$/.test(p)),
    )
    for (const pid of pids) {
      try { process.kill(Number(pid), 'SIGKILL') } catch { /* already gone */ }
    }
    return [...pids]
  } catch { return [] }
}

async function waitForHealth(timeoutMs = 45000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch('http://localhost:5000/health')
      if (r.ok) return true
    } catch { /* not up yet */ }
    await sleep(400)
  }
  return false
}

async function restartBackend() {
  killPort(5000)
  await sleep(900)
  const child = spawn(process.execPath, [path.join(BACKEND, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], {
    cwd: BACKEND,
    env: { ...process.env, PORT: '5000', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  const ok = await waitForHealth()
  if (!ok) throw new Error('backend did not become healthy after restart')
  return child
}

const BATTERIES = [
  'customer-audit.mjs',
  'booking-audit.mjs',
  'booking-audit2.mjs',
  'booking-audit3.mjs',
  'booking-audit4.mjs',
  'booking-audit5.mjs',
  'contact-audit.mjs',
  'commission-audit.mjs',
  'notif-audit.mjs',
  'loc-roundtrip.mjs',
  'review-flow.mjs',
  'review-check.mjs',
  'checkout-audit.mjs',
  'paystack-audit.mjs',
  'admin-crud-audit.mjs',
  'portal-tests.mjs',
  'barber-system-test.mjs',
  'checkout-rules-test.mjs',
  'payment-rules-test.mjs',
  'test-status.js',
  'test-payment-flow.js',
  'test-cash-flow.js',
  'avail-semantic-test.mjs',
  'perf-test.mjs',
]

const only = process.argv.slice(2)
const list = only.length ? BATTERIES.filter((b) => only.some((o) => b.includes(o))) : BATTERIES
const LOG = path.join(ROOT, '.freebuff', 'qa-results.log')
writeFileSync(LOG, `QA RUN v2 ${new Date().toISOString()}  (backend restarted before each battery)\n\n`)

const summary = []
for (const file of list) {
  let backend
  try { backend = await restartBackend() } catch (e) { console.log(`SETUP-FAIL ${file}: ${e.message}`); continue }
  const started = Date.now()
  const child = spawn(process.execPath, [path.join(ROOT, '.freebuff', file)], {
    cwd: ROOT,
    env: { ...process.env, PORT: '5000' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', (d) => (out += d))
  child.stderr.on('data', (d) => (out += d))
  const timer = setTimeout(() => child.kill('SIGKILL'), 180000)
  const res = await new Promise((resolve) => child.on('close', (code, signal) => {
    clearTimeout(timer); resolve({ code, signal })
  }))
  try { backend.kill('SIGKILL') } catch { /* noop */ }

  const text = out.replace(/\u001b\[[0-9;]*m/g, '')
  let passed = null, failed = null
  let m = text.match(/RESULT:\s*(\d+)\s*passed,\s*(\d+)\s*failed/i)
  if (m) { passed = +m[1]; failed = +m[2] }
  if (passed === null) { m = text.match(/(\d+)\s*passed,\s*(\d+)\s*failed/i); if (m) { passed = +m[1]; failed = +m[2] } }
  if (passed === null) { m = text.match(/(\d+)\/(\d+)/); if (m) { passed = +m[1]; failed = +m[2] - +m[1] } }

  const crashed = res.code !== 0 && passed === null
  const status = crashed ? 'CRASH' : failed === null ? 'NO-RESULT' : failed > 0 ? 'FAIL' : 'PASS'
  summary.push({ file, status, passed, failed, code: res.code, ms: Date.now() - started })
  appendFileSync(LOG, `\n${'='.repeat(78)}\n### ${file}  [${status}] code=${res.code} ${((Date.now() - started) / 1000).toFixed(1)}s\n${'='.repeat(78)}\n${text}\n`)
  console.log(`${status.padEnd(10)} ${file.padEnd(26)} ${passed ?? '-'}/${passed !== null && failed !== null ? passed + failed : '-'}  ${((Date.now() - started) / 1000) | 0}s`)
}

console.log('\n===== SUMMARY =====')
for (const s of summary) console.log(`${s.status.padEnd(10)} ${s.file.padEnd(26)} pass=${s.passed ?? '?'} fail=${s.failed ?? '?'}`)
console.log(`\nlog: ${LOG}`)