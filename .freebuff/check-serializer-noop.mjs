/**
 * Proves the Prisma serializer is a no-op for the current Sequelize-backed app,
 * by comparing live HTTP responses before/after wiring it into successRes.
 * Run the backend, then: node .freebuff/check-serializer-noop.mjs
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}

const base = 'http://localhost:5173'
const PATHS = [
  '/api/services', '/api/barbers', '/api/gallery', '/api/reviews',
  '/api/payment-settings', '/api/availability', '/api/admin/dashboard',
]

async function grab() {
  const out = {}
  for (const p of PATHS) {
    const r = await fetch(base + p)
    out[p] = { status: r.status, body: await r.text() }
  }
  return out
}

const snap = JSON.stringify(await grab(), null, 0)
const file = path.join(ROOT, '.freebuff', 'serializer-baseline.json')
const prev = (() => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } })()

if (!process.argv.includes('--save')) {
  if (!prev) { console.log('no baseline yet — run with --save'); process.exit(2) }
  const before = JSON.stringify(prev, null, 0)
  const same = before === snap
  console.log(`baseline captured: ${file}`)
  console.log(`responses identical after wiring the serializer: ${same}`)
  if (!same) {
    for (const p of PATHS) {
      if (JSON.stringify(prev[p]) !== JSON.stringify(JSON.parse(snap)[p])) {
        console.log(`\nDIFF ${p}`)
        console.log('  before:', prev[p].body.slice(0, 300))
        console.log('  after :', JSON.parse(snap)[p].body.slice(0, 300))
      }
    }
  }
  process.exit(same ? 0 : 1)
} else {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(file, snap)
  console.log(`saved baseline for ${PATHS.length} endpoints`)
}
