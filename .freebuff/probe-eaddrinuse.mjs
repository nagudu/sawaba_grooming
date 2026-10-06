// Occupies :5099, then starts the real backend so it must fail with the friendly
// EADDRINUSE message instead of a raw stack trace.
// Run: node .freebuff/probe-eaddrinuse.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import net from 'node:net'

const ROOT = path.resolve(import.meta.dirname, '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}

const blocker = net.createServer()
await new Promise((res) => blocker.listen(5099, '::', res))
console.log('squatter holding :5099')

const child = spawn(process.execPath, [path.join(ROOT, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], {
  cwd: path.join(ROOT, 'backend'), env: { ...process.env, PORT: '5099', NODE_ENV: 'production', SEED_ON_BOOT: 'false' }, stdio: ['ignore', 'pipe', 'pipe'],
})
let out = ''
child.stdout.on('data', (d) => { out += d })
child.stderr.on('data', (d) => { out += d })
const code = await new Promise((res) => child.on('exit', res))
await new Promise((res) => blocker.close(res))

const friendly = out.includes('is already in use') && out.includes('taskkill')
const crash = out.includes("Unhandled 'error' event") || out.includes('Emitted')
console.log('--- backend output ---')
console.log(out.trim().split('\n').filter((l) => l.trim()).slice(-14).join('\n'))
console.log('---')
console.log(`exit code: ${code}`)
console.log(`friendly EADDRINUSE message shown: ${friendly}`)
console.log(`raw unhandled-error crash dump: ${crash}`)
const ok = friendly && !crash && code === 1
console.log(ok ? '\nPASS: the duplicate-backend failure is now self-explanatory' : '\nFAIL')
process.exit(ok ? 0 : 1)