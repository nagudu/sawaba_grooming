/**
 * Semantic verification: flipping today's availability row OFF must flip the
 * badge to false and remove the barber from the availableToday=true filter.
 * Uses the real admin seed login. Restores state afterwards.
 */
import('dotenv').then(async (d) => {
  d.config({ path: 'backend/.env' })
  const BASE = 'http://localhost:5000'

  const results = []
  const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)

  // 1. Real admin login with seed credentials
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ADMIN_SEED_EMAIL,
      password: process.env.ADMIN_SEED_PASSWORD,
    }),
  })
  const login = await loginRes.json()
  const token = login?.data?.accessToken || login?.data?.token
  check('admin login (seed credentials)', Boolean(token), loginRes.status)
  if (!token) {
    console.log(results.join('\n'))
    process.exit(1)
  }
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // 2. Pick a configured barber (id 8, Kamal Sani — 7 schedule rows)
  const TARGET = 8
  const dayOfWeek = new Date().getDay()

  // 3. Verify badge true before
  const before = await (await fetch(`${BASE}/api/barbers?includeInactive=true&perPage=100`, { headers: authHeaders })).json()
  const beforeBarber = before?.data?.items?.find((b) => b.id === TARGET)
  check('badge is true while schedule is on', beforeBarber?.availableToday === true, JSON.stringify(beforeBarber?.availableToday))

  // 4. Flip today's row off via the admin availability API
  const flipRes = await fetch(`${BASE}/api/barbers/${TARGET}/availability`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify([{ dayOfWeek, startTime: '09:00', endTime: '20:00', isAvailable: false }]),
  })
  check('availability PUT accepted', flipRes.status === 200, flipRes.status)

  const after = await (await fetch(`${BASE}/api/barbers?includeInactive=true&perPage=100`, { headers: authHeaders })).json()
  const afterBarber = after?.data?.items?.find((b) => b.id === TARGET)
  check('badge flips to false when today is off', afterBarber?.availableToday === false, JSON.stringify(afterBarber?.availableToday))

  // 5. Filters reflect the flip
  const availOnly = await (await fetch(`${BASE}/api/barbers?includeInactive=true&perPage=100&availableToday=true`, { headers: authHeaders })).json()
  check('availableToday=true filter excludes the off barber', !(availOnly?.data?.items ?? []).some((b) => b.id === TARGET), `total=${availOnly?.data?.total}`)

  const offOnly = await (await fetch(`${BASE}/api/barbers?includeInactive=true&perPage=100&availableToday=false`, { headers: authHeaders })).json()
  check('availableToday=false filter includes exactly the off barber', (offOnly?.data?.items ?? []).length === 1 && offOnly.data.items[0].id === TARGET, `total=${offOnly?.data?.total}`)

  // 6. Restore
  const restoreRes = await fetch(`${BASE}/api/barbers/${TARGET}/availability`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify([{ dayOfWeek, startTime: '09:00', endTime: '20:00', isAvailable: true }]),
  })
  check('availability restored', restoreRes.status === 200)
  const restored = await (await fetch(`${BASE}/api/barbers?includeInactive=true&perPage=100`, { headers: authHeaders })).json()
  const restoredBarber = restored?.data?.items?.find((b) => b.id === TARGET)
  check('badge returns to true after restore', restoredBarber?.availableToday === true)

  console.log('\n=== RESULTS ===')
  for (const line of results) console.log(line)
  const failed = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed > 0 ? 1 : 0)
})
