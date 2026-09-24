/**
 * Live verification of the Available-today badge + availability filter on the
 * admin barbers list. Requires backend on :5000. Cleans up after itself.
 */
import('dotenv').then(async (d) => {
  d.config({ path: 'backend/.env' })
  const BASE = 'http://localhost:5000'

  const results = []
  const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)

  // 1. Admin login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL || 'admin@sawaba.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123',
    }),
  })
  const login = await loginRes.json()
  const token = login?.data?.accessToken || login?.data?.token
  check('admin login', Boolean(token), loginRes.status)

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  // 2. Unfiltered admin list — every item must carry availableToday
  const allRes = await fetch(`${BASE}/api/barbers?includeInactive=true&perPage=100`, { headers: authHeaders })
  const all = await allRes.json()
  const items = all?.data?.items ?? []
  check(
    'admin list exposes availableToday on every barber',
    items.length > 0 && items.every((b) => typeof b.availableToday === 'boolean'),
    `${items.length} barbers`,
  )
  const trueCount = items.filter((b) => b.availableToday === true).length
  const falseCount = items.filter((b) => b.availableToday === false).length
  console.log(`   distribution: available=${trueCount} off=${falseCount}`)

  // 3. Filter availableToday=true
  const availRes = await fetch(`${BASE}/api/barbers?includeInactive=true&perPage=100&availableToday=true`, {
    headers: authHeaders,
  })
  const avail = await availRes.json()
  const availItems = avail?.data?.items ?? []
  check(
    'availableToday=true returns only available barbers',
    availItems.every((b) => b.availableToday === true),
    `${availItems.length} returned`,
  )
  check(
    'availableToday=true total matches unfiltered distribution',
    avail?.data?.total === trueCount,
    `total=${avail?.data?.total} expected=${trueCount}`,
  )

  // 4. Filter availableToday=false
  const offRes = await fetch(`${BASE}/api/barbers?includeInactive=true&perPage=100&availableToday=false`, {
    headers: authHeaders,
  })
  const off = await offRes.json()
  const offItems = off?.data?.items ?? []
  check(
    'availableToday=false returns only unavailable barbers',
    offItems.every((b) => b.availableToday === false),
    `${offItems.length} returned`,
  )
  check(
    'availableToday=false total matches unfiltered distribution',
    off?.data?.total === falseCount,
    `total=${off?.data?.total} expected=${falseCount}`,
  )

  // 5. Filters partition the full set
  check(
    'true + false partitions cover all barbers',
    avail?.data?.total + off?.data?.total === all?.data?.total,
    `${avail?.data?.total}+${off?.data?.total}=${all?.data?.total}`,
  )

  // 6. Public list must NOT receive the filter or the badge
  const pubRes = await fetch(`${BASE}/api/barbers?availableToday=false&perPage=100`)
  const pub = await pubRes.json()
  const pubItems = pub?.data?.items ?? []
  check(
    'public list ignores availableToday filter and omits badge',
    pubItems.length > 0 && pubItems.every((b) => b.availableToday === undefined),
    `${pubItems.length} public barbers`,
  )

  // 7. Semantic check: an inactive barber can never be "available today"
  const inactive = items.find((b) => b.isActive === false)
  if (inactive) {
    check('inactive barber is never available today', inactive.availableToday === false)
  } else {
    console.log('   (no inactive barber present — semantic check skipped)')
  }

  // 8. Public endpoint must not see inactive barbers even via filter
  const pubInactiveRes = await fetch(`${BASE}/api/barbers?availableToday=false&includeInactive=true`)
  const pubInactive = await pubInactiveRes.json()
  const pubInactiveItems = pubInactive?.data?.items ?? []
  check(
    'public list never returns inactive barbers (filter cannot bypass)',
    pubInactiveItems.length > 0 && pubInactiveItems.every((b) => b.isActive === true),
    `${pubInactiveItems.length} public`,
  )

  console.log('\n=== RESULTS ===')
  for (const line of results) console.log(line)
  const failed = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed > 0 ? 1 : 0)
})
