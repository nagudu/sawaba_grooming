import '../models'
import { sequelize } from '../config/database'
import { Appointment, BarberNotification, BarberEarning, ContactMessage, Customer, Payment, Review } from '../models'
import { Op } from 'sequelize'

const QA_NAMES = ['QA Cash Probe', 'QA Bank Probe', 'QA Reject Probe', 'QA Online Probe', 'QA Online Probe 2', 'QA OnlineS Probe', 'QA Duplicate', 'QA NoReceipt', 'QA NoMethod', 'QA Past', 'QA CashFinal Probe', 'QA TransferProbe', 'QA Abandon Probe']
const QA_EMAILS = ['qa11@test.local', 'qa12@test.local', 'qa13@test.local', 'qa13b@test.local', 'qa14@test.local', 'qa21@test.local', 'qa22@test.local', 'qa23@test.local', 'qa24@test.local', 'qa25@test.local']

async function main(): Promise<void> {
  await sequelize.authenticate()

  const appts = await Appointment.findAll({ where: { customerName: { [Op.in]: QA_NAMES } } })
  console.log('QA appointments:', appts.map(a => a.id).join(',') || 'none')
  for (const a of appts) {
    await Payment.destroy({ where: { appointmentId: a.id } })
    await BarberEarning.destroy({ where: { appointmentId: a.id } })
    await a.destroy()
  }

  const custsByEmail = await Customer.findAll({ where: { email: { [Op.in]: QA_EMAILS } } })
  for (const c of custsByEmail) await c.destroy()
  console.log('QA customers removed:', custsByEmail.length)

  const notifs = await BarberNotification.findAll({ where: { message: { [Op.like]: '%QA notif test%' } } })
  for (const n of notifs) await n.destroy()
  console.log('QA notifications removed:', notifs.length)

  const reviews = await Review.findAll({ where: { customerName: 'QA Probe Reviewer' } })
  for (const r of reviews) await r.destroy()
  console.log('QA reviews removed:', reviews.length)

  const contacts = await ContactMessage.findAll({ where: { name: 'QA Contact Probe' } })
  for (const c of contacts) await c.destroy()
  console.log('QA contacts removed:', contacts.length)

  const custs = await Customer.findAll({ where: { email: { [Op.like]: 'qa-cust-%@test.local' } } })
  for (const c of custs) await c.destroy()
  console.log('QA customers removed:', custs.length)

  console.log('appointments remaining (real data):', await Appointment.count())
  await sequelize.close()
}

main().catch(err => { console.error(err); process.exit(1) })
