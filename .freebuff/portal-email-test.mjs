import 'dotenv/config'
import dotenv from 'dotenv'
dotenv.config({ path: 'backend/.env' })

const BASE = 'http://localhost:5000'
const stamp = Date.now()
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` · ${detail}` : ''}`)
}

const emailProvider = process.env.RESEND_API_KEY ? 'resend(test mode)' : process.env.SMTP_HOST ? 'smtp' : 'NOT CONFIGURED'
console.log(`Email provider in use: ${emailProvider}\n`)

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.ADMIN_SEED_EMAIL,
    password: process.env.ADMIN_SEED_PASSWORD,
  }),
}).then((r) => r.json())
const token = login?.data?.token
check('Admin login', Boolean(token))

const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

// 1. Create barber with portal enabled + password → should attempt email
const createRes = await fetch(`${BASE}/api/barbers`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    name: `QA Portal Email ${stamp}`,
    email: `qa-portal-email-${stamp}@example.com`,
    specialty: 'QA',
    experience: 1,
    barberType: 'EXTERNAL',
    location: 'Dutse, Jigawa',
    portalEnabled: true,
    portalPassword: 'qa-test-pass-2026',
  }),
}).then((r) => r.json())
const created = createRes?.data
check('Create barber with portal enabled', createRes?.success === true, `id=${created?.id}`)
check(
  'Response carries credentialNotice field',
  'credentialNotice' in (created ?? {}),
  created?.credentialNotice === null
    ? 'null → email DELIVERED'
    : String(created?.credentialNotice).slice(0, 110),
)

// 2. Rotate password on update → email re-sent
const updateRes = await fetch(`${BASE}/api/barbers/${created.id}`, {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({ portalPassword: 'qa-rotated-pass-2026' }),
}).then((r) => r.json())
check(
  'Password rotation triggers re-send',
  updateRes?.success === true && 'credentialNotice' in (updateRes?.data ?? {}),
  updateRes?.data?.credentialNotice === null ? 'null → DELIVERED' : String(updateRes?.data?.credentialNotice).slice(0, 110),
)

// 3. Control: saving WITHOUT a password change must NOT send email
const noEmailRes = await fetch(`${BASE}/api/barbers/${created.id}`, {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({ specialty: 'QA updated' }),
}).then((r) => r.json())
check(
  'No email when password untouched',
  noEmailRes?.success === true && noEmailRes?.data?.credentialNotice === undefined,
)

// 4. Security: password hash must never leave the server
check('No passwordHash in API response', !('passwordHash' in (created ?? {})))

// 5. Portal login works with the rotated password
const portalLogin = await fetch(`${BASE}/api/barber/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: `qa-portal-email-${stamp}@example.com`, password: 'qa-rotated-pass-2026' }),
}).then((r) => r.json())
check('Barber portal login with emailed password', portalLogin?.data?.token ? true : false, portalLogin?.message)

// 6. Cleanup
const del = await fetch(`${BASE}/api/barbers/${created.id}`, { method: 'DELETE', headers: auth }).then((r) => r.json())
check('Cleanup: delete QA barber', del?.success === true)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
