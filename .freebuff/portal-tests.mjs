import { config } from 'dotenv'
config({ path: 'backend/.env' })
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
const B = 'http://localhost:5000/api'
const out = []
const log = (label, ...rest) => out.push([label, ...rest].filter((x) => x !== undefined && x !== null).map(String).join(' | '))

const adminLogin = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const T = (await adminLogin.json())?.data?.token
const AH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }
const admin = async (m, p, body) => {
  const r = await fetch(B + p, { method: m, headers: AH, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { s: r.status, j }
}

// ── Setup: create internal + external barbers with portal credentials ──
const stamp = Date.now()
const mkPortal = () => 'qa-' + stamp + '-' + Math.random().toString(36).slice(2, 7)

// Test A setup — INTERNAL barber
let r = await admin('POST', '/barbers', {
  name: 'QA Internal Barber', specialty: 'Cuts', experience: 2, isActive: true,
  email: `qa-internal-${stamp}@sawaba.test`, phone: '07065550001',
  barberType: 'INTERNAL', commissionType: 'PERCENTAGE', commissionValue: 20,
  portalEnabled: true, portalPassword: 'qa-password-123',
  serviceIds: [1],
})
const intId = r.j?.data?.id
log('A0 create internal barber (20%)', r.s, `id=${intId}`)

// Test B setup — EXTERNAL barber
r = await admin('POST', '/barbers', {
  name: 'QA External Barber', specialty: 'Mobile cuts', experience: 4, isActive: true,
  email: `qa-external-${stamp}@sawaba.test`, phone: '07065550002',
  barberType: 'EXTERNAL', location: 'Dutse, Jigawa', commissionType: 'PERCENTAGE', commissionValue: 25,
  portalEnabled: true, portalPassword: 'qa-password-456',
  serviceIds: [1],
})
const extId = r.j?.data?.id
log('B0 create external barber (25%)', r.s, `id=${extId}`)

// Barber logins
const bLogin = async (identifier) => {
  const res = await fetch(B + '/barber/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password: 'qa-password-123' }) })
  return { s: res.status, token: (await res.json().catch(() => ({})))?.data?.token }
}
const intA = await bLogin(`qa-internal-${stamp}@sawaba.test`)
// external login with its own password
const extLoginRes = await fetch(B + '/barber/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: `qa-external-${stamp}@sawaba.test`, password: 'qa-password-456' }) })
const extA = { s: extLoginRes.status, token: (await extLoginRes.json().catch(() => ({})))?.data?.token }
log('A1 internal portal login', intA.s, 'token=' + !!intA.token)
log('B1 external portal login', extA.s, 'token=' + !!extA.token)

const bAuthed = (token) => async (m, p, body) => {
  const res = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await res.json() } catch {}
  return { s: res.status, j }
}
const intApi = bAuthed(intA.token)
const extApi = bAuthed(extA.token)

// Overview for each
r = await intApi('GET', '/barber/portal/overview')
log('A2 internal overview', r.s, `today=${r.j?.data?.overview?.todayCount} pendingComm=${r.j?.data?.overview?.pendingCommission} comm=${r.j?.data?.overview?.commissionValue}%`)
r = await extApi('GET', '/barber/portal/overview')
log('B2 external overview', r.s, `comm=${r.j?.data?.overview?.commissionValue}%`)

// Book two appointments (different slots) as customers via checkout→finalize cash
const bookCash = async (time, name) => {
  const fd = new FormData()
  fd.append('serviceId', '1'); fd.append('barberId', '1')
  fd.append('appointmentDate', '2026-10-10'); fd.append('appointmentTime', time)
  fd.append('customerName', name); fd.append('customerPhone', '07061234567'); fd.append('customerEmail', `${name.toLowerCase().replace(/ /g, '')}@gmail.com`)
  fd.append('paymentMethod', 'CASH')
  const res = await fetch(B + '/checkout', { method: 'POST', body: fd })
  const j = await res.json().catch(() => ({}))
  const tok = j?.data?.sessionToken
  const fin = await fetch(B + `/checkout/${tok}/finalize`, { method: 'POST' })
  const fj = await fin.json().catch(() => ({}))
  return { s: fin.status, appt: fj?.data?.appointment?.id, pay: fj?.data?.payment?.id }
}
const bkg1 = await bookCash('08:30', 'QA Portal One')
const bkg2 = await bookCash('11:00', 'QA Portal Two')
log('A3 book appts for assignment', bkg1.s, `appt=${bkg1.appt}`, bkg2.s, `appt=${bkg2.appt}`)

// Assign internal barber to appt1, external to appt2
r = await admin('PUT', `/admin/appointments/${bkg1.appt}/assign-barber`, { barberId: intId, reason: 'QA internal flow' })
log('A4 assign internal', r.s, String(r.j?.message || '').slice(0, 70))
r = await admin('PUT', `/admin/appointments/${bkg2.appt}/assign-barber`, { barberId: extId, reason: 'QA external flow' })
log('B4 assign external', r.s, String(r.j?.message || '').slice(0, 70))

// Verify assignment notification created for internal barber
r = await intApi('GET', '/barber/portal/notifications')
const assignmentNotif = (r.j?.data?.items || []).find((n) => n.type === 'ASSIGNMENT')
log('A5 internal got ASSIGNMENT notification', r.s, assignmentNotif ? '✓ ' + assignmentNotif.title : 'MISSING (BAD)')

// Scoping: internal sees only his appointment; external sees only theirs
r = await intApi('GET', '/barber/portal/appointments?perPage=100')
const intAppts = (r.j?.data?.items || []).map((a) => a.id)
log('A6 internal sees only own appts', r.s, `ids=[${intAppts}]`, intAppts.includes(bkg1.appt) && !intAppts.includes(bkg2.appt) ? '✓ scoped' : 'SCOPING FAIL')

r = await extApi('GET', '/barber/portal/appointments?perPage=100')
const extAppts = (r.j?.data?.items || []).map((a) => a.id)
log('B6 external sees only own appts', r.s, `ids=[${extAppts}]`, extAppts.includes(bkg2.appt) && !extAppts.includes(bkg1.appt) ? '✓ scoped' : 'SCOPING FAIL')

// Cross-access: internal barber requests external's appointment detail
r = await intApi('GET', `/barber/portal/appointments/${bkg2.appt}`)
log('C1 barber A fetches barber B appt', r.s, r.s === 404 ? '✓ rejected' : 'LEAK (BAD)')

// Cross-access: external tries admin endpoints + other's earnings
r = await extApi('GET', '/admin/barber-earnings')
log('C2 external → admin earnings API', r.s, r.s >= 400 ? '✓ rejected' : 'LEAK (BAD)')
r = await extApi('GET', '/admin/commission-rates')
log('C3 external → commission rates API', r.s, r.s >= 400 ? '✓ rejected' : 'LEAK (BAD)')
r = await extApi('GET', '/appointments')
log('C4 external → admin appointments list', r.s, r.s >= 400 ? '✓ rejected' : 'LEAK (BAD)')

// Payment status transition guard: barber cannot set PAYMENT_VERIFIED
r = await extApi('PUT', `/barber/portal/appointments/${bkg2.appt}/status`, { to: 'PAYMENT_VERIFIED' })
log('C5 barber tries payment verification', r.s, r.s === 400 || r.s === 422 ? '✓ rejected' : 'NOT GUARDED (BAD)')

// Status flow: READY → needs payment verify first? appt is PAYMENT_REQUIRED (cash finalize => READY? check)
r = await admin('GET', `/appointments/${bkg2.appt}`)
const statusNow = r.j?.data?.status
log('B7 appt status after cash finalize', statusNow)

// Confirm cash then start + complete
await admin('POST', `/admin/payments/${bkg2.pay}/confirm-cash`, { note: 'QA' })
r = await extApi('PUT', `/barber/portal/appointments/${bkg2.appt}/status`, { to: 'IN_PROGRESS' })
log('B8 external starts service', r.s, r.j?.data?.appointment?.status)
r = await extApi('PUT', `/barber/portal/appointments/${bkg2.appt}/status`, { to: 'COMPLETED' })
log('B9 external completes service', r.s, r.j?.data?.appointment?.status)

// Earnings after completion (cash confirmed => PAID => EARNED)
r = await extApi('GET', '/barber/portal/earnings')
const extEarn = (r.j?.data?.items || []).find((e) => e.appointmentId === bkg2.appt)
log('B10 external earning snapshot', extEarn ? `rate=${extEarn.commissionRateSnapshot}% amt=₦${extEarn.commissionAmount} status=${extEarn.status}` : 'MISSING (BAD)')

// ── Test D: commission freeze — change rate 25→40, snapshot unchanged ──
r = await admin('PUT', `/admin/commission-rates/${extId}`, { commissionType: 'PERCENTAGE', commissionValue: 40 })
log('D1 change external rate to 40%', r.s)
r = await extApi('GET', '/barber/portal/earnings')
const extEarn2 = (r.j?.data?.items || []).find((e) => e.appointmentId === bkg2.appt)
log('D2 snapshot frozen', extEarn2 && extEarn2.commissionRateSnapshot === 25 ? `✓ still 25% / ₦${extEarn2.commissionAmount}` : 'RECALCULATED (BAD)')

// ── Test E: double-booking prevention ──
// appt2 occupies 10:00-10:30 with external barber; book another appt at 10:00 (booked to barber 1) and try to assign external
const fd3 = new FormData()
fd3.append('serviceId', '1'); fd3.append('barberId', '1')
fd3.append('appointmentDate', '2026-10-10'); fd3.append('appointmentTime', '11:30')
fd3.append('customerName', 'QA Conflict Client'); fd3.append('customerPhone', '07061234568'); fd3.append('customerEmail', 'qaconflict@gmail.com')
fd3.append('paymentMethod', 'CASH')
const cRes = await fetch(B + '/checkout', { method: 'POST', body: fd3 })
const cJ = await cRes.json().catch(() => ({}))
const cTok = cJ?.data?.sessionToken
const cFin = await fetch(B + `/checkout/${cTok}/finalize`, { method: 'POST' })
const cFj = await cFin.json().catch(() => ({}))
const cAppt = cFj?.data?.appointment?.id
r = await admin('PUT', `/admin/appointments/${cAppt}/assign-barber`, { barberId: extId })
log('E1 double-booking rejected', r.s, r.s === 422 ? '✓ ' + String(r.j?.message || '').slice(0, 80) : 'ALLOWED (BAD)')

// Also: assigning a barber who doesn't provide the service
r = await admin('POST', '/barbers', { name: 'QA NoService Barber', specialty: 'Shaves', experience: 1, isActive: true, email: `qa-nosvc-${stamp}@sawaba.test`, barberType: 'INTERNAL', commissionType: 'PERCENTAGE', commissionValue: 10, serviceIds: [] })
const noSvcId = r.j?.data?.id
r = await admin('PUT', `/admin/appointments/${cAppt}/assign-barber`, { barberId: noSvcId })
log('E2 service-mismatch rejected', r.s, r.s === 422 ? '✓ ' + String(r.j?.message || '').slice(0, 70) : 'ALLOWED (BAD)')

// Outside working hours check: give internal barber a schedule excluding 09:00, then try to assign on that date
await admin('PUT', `/barbers/${intId}/availability`, [{ dayOfWeek: new Date('2026-10-10T00:00:00').getDay(), startTime: '12:00', endTime: '18:00', isAvailable: true }])
r = await admin('PUT', `/admin/appointments/${bkg2.appt}/assign-barber`, { barberId: intId })
log('E3 outside working hours rejected', r.s, r.s === 422 ? '✓ ' + String(r.j?.message || '').slice(0, 80) : String(r.j?.message || r.s).slice(0, 80))

console.log('\n' + out.join('\n'))
fs.writeFileSync('.freebuff/portal-test-ids.json', JSON.stringify({ intId, extId, noSvcId, appts: [bkg1.appt, bkg2.appt, cAppt], stamp }))
