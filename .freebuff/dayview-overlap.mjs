/**
 * Adds two same-time (16:00) appointments for the QA barber to prove the
 * timeline's side-by-side overlap layout. Idempotent (QA-DAY-OV prefix).
 */
import('dotenv').then(async (d) => {
  d.config({ path: 'backend/.env' })
  const { Sequelize } = await import('sequelize')
  const s = new Sequelize(process.env.DATABASE_URL, { logging: false })
  const now = new Date()
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  try {
    await s.query("DELETE FROM appointments WHERE reference_code LIKE 'QA-DAY-OV%'")
    const [[svc]] = await s.query('SELECT id, price FROM services WHERE duration <= 45 ORDER BY id LIMIT 1')
    const rows = [
      { ref: 'QA-DAY-OV1', name: 'QA Double X' },
      { ref: 'QA-DAY-OV2', name: 'QA Double Y' },
    ]
    for (const r of rows) {
      await s.query(
        `INSERT INTO appointments (customer_name, customer_phone, service_id, barber_id, appointment_date, appointment_time, status, total_amount, reference_code)
         VALUES (?, '07000000003', ?, 56, ?, '16:00', 'PAYMENT_VERIFIED', ?, ?)`,
        { replacements: [r.name, svc.id, key, svc.price, r.ref] },
      )
    }
    console.log('overlap fixtures at 16:00 created for', key)
  } finally {
    await s.close()
  }
}).catch((e) => {
  console.error(e.message)
  process.exit(1)
})
