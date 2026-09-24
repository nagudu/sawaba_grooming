/**
 * Day View QA fixtures: two today-appointments for the portal barber (id 50)
 * with different times, statuses, and service durations, plus one overlapping
 * pair to prove column layout. Cleans up by reference-code prefix on re-run.
 */
import('dotenv').then(async (d) => {
  d.config({ path: 'backend/.env' })
  const { default: Sequelize } = await import('sequelize')
  const s = new Sequelize(process.env.DATABASE_URL, { logging: false })
  try {
    const today = new Date()
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    await s.query("DELETE FROM appointments WHERE reference_code LIKE 'QA-DAY-%'")
    // service 19 exists (used by the real appointment); use a couple of services
    const [[svc1]] = await s.query("SELECT id, duration, price FROM services ORDER BY id LIMIT 1")
    const [[svc2]] = await s.query("SELECT id, duration, price FROM services WHERE duration >= 45 ORDER BY id LIMIT 1")
    const rows = [
      { ref: 'QA-DAY-1', name: 'QA Morning Client', time: '10:00', status: 'READY_FOR_SERVICE', svc: svc1 },
      { ref: 'QA-DAY-2', name: 'QA Noon Client', time: '12:30', status: 'IN_PROGRESS', svc: svc2 },
      { ref: 'QA-DAY-3', name: 'QA Overlap A', time: '15:00', status: 'PAYMENT_VERIFIED', svc: svc1 },
      { ref: 'QA-DAY-4', name: 'QA Overlap B', time: '15:30', status: 'CANCELLED', svc: svc1 },
    ]
    for (const r of rows) {
      await s.query(
        `INSERT INTO appointments (customer_name, customer_phone, service_id, barber_id, appointment_date, appointment_time, status, total_amount, reference_code)
         VALUES (?, '08000000000', ?, 50, ?, ?, ?, ?, ?)`,
        { replacements: [r.name, r.svc.id, key, r.time, r.status, r.svc.price, r.ref] },
      )
    }
    const [created] = await s.query("SELECT id, reference_code, appointment_time, status FROM appointments WHERE reference_code LIKE 'QA-DAY-%' ORDER BY appointment_time")
    console.log(`Created ${created.length} fixtures for ${key}`)
    console.table(created)
  } finally {
    await s.close()
  }
}).catch((e) => {
  console.error(e.message)
  process.exit(1)
})
