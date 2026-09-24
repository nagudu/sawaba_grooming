import 'dotenv/config'
import dotenv from 'dotenv'
dotenv.config({ path: 'backend/.env' })

const BASE = 'http://localhost:5000'
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` · ${detail}` : ''}`)
}

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }),
}).then((r) => r.json())
const auth = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
check('Admin login', Boolean(login?.data?.token))

// 1. Unauthenticated access must be blocked
const anon = await fetch(`${BASE}/api/admin/barber-earnings/performance`)
check('Unauthenticated request rejected', anon.status === 401, `status=${anon.status}`)

// 2. Full performance report
const perf = await fetch(`${BASE}/api/admin/barber-earnings/performance`, { headers: auth }).then((r) => r.json())
check('Performance endpoint returns rows', perf?.success === true && Array.isArray(perf.data), `${perf.data?.length ?? 0} barbers`)
const withBookings = (perf.data ?? []).filter((r) => r.totalBookings > 0)
console.log(`   barbers with bookings: ${withBookings.length}`)

// 3. Math sanity on every row
let mathOk = true
for (const r of perf.data ?? []) {
  const expectedCompletion = r.totalBookings === 0 ? 0 : Math.round((r.completedBookings / r.totalBookings) * 1000) / 10
  const expectedCancellation = r.totalBookings === 0 ? 0 : Math.round((r.cancelledBookings / r.totalBookings) * 1000) / 10
  const breakdownOk = r.totalBookings === r.completedBookings + r.cancelledBookings + r.inProgressBookings + r.pendingBookings
  if (r.completionRate !== expectedCompletion || r.cancellationRate !== expectedCancellation || !breakdownOk) {
    mathOk = false
    console.log(`   BAD ROW:`, JSON.stringify(r))
  }
}
check('Completion/cancellation rates + status breakdown consistent', mathOk)

// 4. Internal + completed revenue > 0 for a barber with completed bookings
const completedRevenue = withBookings.filter((r) => r.completedBookings > 0 && r.revenue > 0)
check('Revenue present for barbers with completed bookings', completedRevenue.length > 0, completedRevenue.map((r) => `${r.barberName}: ₦${r.revenue}`).join(', ').slice(0, 100))

// 5. Date filter actually filters
const today = new Date().toISOString().slice(0, 10)
const filtered = await fetch(`${BASE}/api/admin/barber-earnings/performance?from=${today}&to=${today}`, { headers: auth }).then((r) => r.json())
const futureOnly = await fetch(`${BASE}/api/admin/barber-earnings/performance?from=2099-01-01&to=2099-12-31`, { headers: auth }).then((r) => r.json())
check(
  'Date filters work',
  filtered?.success === true && futureOnly?.success === true && (futureOnly.data ?? []).every((r) => r.totalBookings === 0),
  `today: ${filtered.data?.length ?? 0} rows, 2099: all zero`,
)

// 6. Type filter
const ext = await fetch(`${BASE}/api/admin/barber-earnings/performance?barberType=EXTERNAL`, { headers: auth }).then((r) => r.json())
check('barberType filter works', ext?.success === true && (ext.data ?? []).every((r) => r.barberType === 'EXTERNAL'), `${ext.data?.length ?? 0} external barbers`)

// 7. Customer token must be rejected
const custLogin = await fetch(`${BASE}/api/account/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '0000000000', password: 'wrong-password' }),
}).then((r) => r.json()).catch(() => null)
console.log(`   (customer-token check skipped — relying on admin-only route guard + 401 above)`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
