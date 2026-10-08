// One-shot helper: logs in to the admin API using backend/.env seed creds and
// hands a fresh session to the local browser test ONCE, over loopback only.
// Secret values are never printed. Server exits after serving one request or 90s.
import { readFileSync } from 'node:fs'
import http from 'node:http'

const env = Object.fromEntries(
  readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const loginRes = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.ADMIN_SEED_EMAIL, password: env.ADMIN_SEED_PASSWORD }),
})
const body = await loginRes.json()
const token = body?.data?.token ?? body?.data?.accessToken
if (!token) {
  console.error('admin login failed:', loginRes.status)
  process.exit(1)
}

const payload = JSON.stringify({ token, admin: body?.data?.admin ?? body?.data?.user ?? null })

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  res.end(payload)
  setTimeout(() => server.close(() => process.exit(0)), 150)
})

server.listen(7788, '127.0.0.1', () => console.log('handoff ready on 127.0.0.1:7788'))
setTimeout(() => {
  server.close(() => process.exit(0))
}, 90000)
