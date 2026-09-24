/**
 * Day View QA harness.
 *   node dayview-qa-setup.mjs setup  -> create QA barber (real admin API flow) + today fixtures
 *   node dayview-qa-setup.mjs clean  -> remove QA barber + fixtures
 */
const mode = process.argv[2] || 'setup'
const BASE = 'http://localhost:5000'

const run = async () => {
  const dotenv = await import('dotenv')
  dotenv.config({ path: 'backend/.env' })
  const { Sequelize } = await import('sequelize')
  const s = new Sequelize(process.env.DATABASE_URL, { logging: false })

  if (mode === 'clean') {
    await s.query("DELETE FROM appointments WHERE reference_code LIKE 'QA-DAY-%'")
    await s.query("DELETE FROM barber_notifications WHERE barber_id IN (SELECT id FROM barbers WHERE name='QA DayView Barber')")
    await s.query("DELETE FROM barber_availability WHERE barber_id IN (SELECT id FROM barbers WHERE name='QA DayView Barber')")
    await s.query("DELETE FROM barber_services WHERE barber_id IN (SELECT id FROM barbers WHERE name='QA DayView Barber')")
    await s.query("DELETE FROM barbers WHERE name='QA DayView Barber'")
    console.log('QA day-view fixtures + barber removed.')
    await s.close()
    return
  }

  const loginAdmin = async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(`admin login failed: ${res.status}`)
    return body?.data?.accessToken || body?.data?.token
  }

  const token = await loginAdmin()
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const createRes = await fetch(`${BASE}/api/barbers`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: 'QA DayView Barber',
      email: 'qa-dayview@sawaba.test',
      phone: '07000000001',
      specialty: 'QA Timeline Testing',
      experience: 1,
      isActive: true,
      barberType: 'INTERNAL',
      commissionType: 'PERCENTAGE',
      commissionValue: 20,
      portalEnabled: true,
      portalPassword: 'QaDayView#2026',
      serviceIds: [],
    }),
  })
  const created = await createRes.json()
  if (!createRes.ok) throw new Error(`barber create failed: ${createRes.status} ${JSON.stringify(created).slice(0, 200)}`)
  const barberId = created?.data?.id ?? created?.data?.barber?.id
  console.log(`QA barber id=${barberId}`)

  for (let day = 0; day < 7; day += 1) {
    await fetch(`${BASE}/api/barbers/${barberId}/availability`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify([{ dayOfWeek: day, startTime: '09:00', endTime: '19:00', isAvailable: true }]),
    })
  }

  const now = new Date()
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const [[svcFast]] = await s.query('SELECT id, duration, price FROM services WHERE duration <= 45 ORDER BY id LIMIT 1')
  const [[svcLong]] = await s.query('SELECT id, duration, price FROM services WHERE duration > 45 ORDER BY id LIMIT 1')
  await s.query("DELETE FROM appointments WHERE reference_code LIKE 'QA-DAY-%'")
  const rows = [
    { ref: 'QA-DAY-1', name: 'QA Morning Client', time: '10:00', status: 'READY_FOR_SERVICE', svc: svcFast },
    { ref: 'QA-DAY-2', name: 'QA Noon Client', time: '12:30', status: 'IN_PROGRESS', svc: svcLong ?? svcFast },
    { ref: 'QA-DAY-3', name: 'QA Overlap A', time: '15:00', status: 'PAYMENT_VERIFIED', svc: svcFast },
    { ref: 'QA-DAY-4', name: 'QA Overlap B', time: '15:30', status: 'CANCELLED', svc: svcFast },
  ]
  for (const r of rows) {
    await s.query(
      `INSERT INTO appointments (customer_name, customer_phone, service_id, barber_id, appointment_date, appointment_time, status, total_amount, reference_code)
       VALUES (?, '07000000002', ?, ?, ?, ?, ?, ?, ?)`,
      { replacements: [r.name, r.svc.id, barberId, key, r.time, r.status, r.svc.price, r.ref] },
    )
  }
  console.log(`Fixtures for ${key}: 4 created`)
  console.log('Portal login: qa-dayview@sawaba.test / QaDayView#2026')
  await s.close()
}

run().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
