import 'dotenv/config'
import dotenv from 'dotenv'
dotenv.config({ path: 'backend/.env' })

const BASE = 'http://localhost:5000'
const stamp = Date.now()

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }),
}).then((r) => r.json())
const auth = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }

// Resend test mode delivers ONLY to the account owner's address.
const ownerEmail = 'halifashuaibu12@gmail.com'
const created = await fetch(`${BASE}/api/barbers`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    name: `QA Delivery Proof ${stamp}`,
    email: ownerEmail,
    specialty: 'QA',
    experience: 1,
    barberType: 'INTERNAL',
    portalEnabled: true,
    portalPassword: 'qa-delivery-proof-2026',
  }),
}).then((r) => r.json())

const notice = created?.data?.credentialNotice
console.log(`credentialNotice: ${JSON.stringify(notice)}`)
console.log(notice === null ? '✅ EMAIL ACTUALLY DELIVERED (provider accepted it)' : '❌ delivery failed')
console.log(`→ check the inbox of ${ownerEmail} for "Your SAWABA Barber Portal access"`)

// Cleanup
await fetch(`${BASE}/api/barbers/${created.data.id}`, { method: 'DELETE', headers: auth })
console.log('QA barber deleted (the sent email remains in the inbox as proof).')
process.exit(notice === null ? 0 : 1)
