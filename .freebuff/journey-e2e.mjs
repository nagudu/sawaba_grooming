// True end-to-end customer journey, then verified in the browser:
//   browse -> pick service -> book (cash) -> finalize -> payment page -> receipt
//   -> customer account -> admin queue -> confirm cash paid -> barber queue
// Run: node .freebuff/journey-e2e.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const API = 'http://localhost:5000/api'
const APP = 'http://localhost:5173'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const up = async () => { try { return (await fetch('http://localhost:5000/health')).ok } catch { return false } }

for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}

// always start a FRESH api so the in-memory rate-limit counters are empty
const { spawn, execSync } = await import('node:child_process')
const listener = () => { try { return execSync('netstat -ano -p TCP', { encoding: 'utf8' }).split(/\r?\n/).filter((l) => /:5000\s+.*LISTENING/.test(l)).map((l) => l.trim().split(/\s+/).pop()) } catch { return [] } }
for (const pid of listener()) { try { process.kill(Number(pid), 'SIGKILL'); console.log(`killed stale listener pid ${pid}`) } catch {} }
await sleep(700)
const apiProc = spawn(process.execPath, [path.join(ROOT, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], { cwd: path.join(ROOT, 'backend'), env: { ...process.env, PORT: '5000' }, stdio: ['ignore', 'ignore', 'ignore'] })
for (let i = 0; i < 120; i++) { if (await up()) break; await sleep(500) }
if (!(await up())) { console.log('API failed to start'); process.exit(1) }
console.log('fresh API up on :5000\n')

async function api(m, p, { token, body, form } = {}) {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`
  if (body && !form) h['Content-Type'] = 'application/json'
  const r = await fetch(API + p, { method: m, headers: h, body: form ?? (body ? JSON.stringify(body) : undefined) })
  let j = null; try { j = await r.json() } catch {}
  return { status: r.status, json: j }
}

let pass = 0, fail = 0
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} :: ${d}`)) }
const C = {}

console.log('=== STEP 1: browse the public catalogue ===')
const services = await api('GET', '/services?perPage=100&isActive=true')
const svcList = services.json?.data?.items ?? []
check('public service catalogue loads', svcList.length > 0, `count ${svcList.length}`)
const barbers = (await api('GET', '/barbers?perPage=100')).json?.data?.items ?? []
const svc = svcList[0]
const barber = barbers.find((b) => b.isActive && b.services?.some((s) => s.id === svc.id))
check('a barber offers that service', Boolean(barber), `svc ${svc?.name}; barbers ${barbers.length}`)
const gallery = await api('GET', '/gallery?perPage=50')
check('public gallery loads', gallery.status === 200, `status ${gallery.status}`)
const reviews = await api('GET', '/reviews?approved=true&perPage=50')
check('public approved reviews load', reviews.status === 200, `status ${reviews.status}`)
const settings = await api('GET', '/payments/settings')
check('public payment settings load', settings.status === 200, `status ${settings.status}`)
C.service = svc; C.barber = barber

console.log('\n=== STEP 2: choose an available slot ===')
let slot = null, date = null
for (let d = 2; d < 10 && !slot; d++) {
  const cand = new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)
  const av = await api('GET', `/availability?barberId=${barber.id}&date=${cand}`)
  const s = (av.json?.data?.slots ?? []).find((x) => x.available)
  if (s) { slot = s; date = cand }
}
check('found an available slot', Boolean(slot), `date=${date}`)
const duration = svc.duration ?? 30
C.date = date; C.slot = slot
console.log(`     ${date} ${slot.time}-${slot.endTime}  barber=${barber.name}  service=${svc.name} (${duration}min)`)

console.log('\n=== STEP 3: register a customer and book as CASH ===')
const phone = '0807' + String(Date.now()).slice(-7)
const reg = await api('POST', '/account/register', { body: { fullName: 'Journey Customer', phone, email: `journey-${Date.now()}@test.local`, password: 'Journey123!' } })
check('customer registered', reg.status === 200 || reg.status === 201, `status ${reg.status} ${JSON.stringify(reg.json).slice(0, 120)}`)
const custToken = reg.json?.data?.token
C.custToken = custToken; C.phone = phone

const session = await api('POST', '/checkout', { body: { serviceId: svc.id, barberId: barber.id, appointmentDate: date, appointmentTime: slot.time, paymentMethod: 'CASH', customerName: 'Journey Customer', customerPhone: phone, customerEmail: reg.json?.data?.customer?.email, notes: 'QA journey' } })
check('checkout session created', session.status === 200 || session.status === 201, `status ${session.status} ${JSON.stringify(session.json).slice(0, 160)}`)
const sessionToken = session.json?.data?.token ?? session.json?.data?.sessionToken
C.sessionToken = sessionToken

const final = await api('POST', `/checkout/${sessionToken}/finalize`, { body: {} })
check('finalize creates appointment + payment', final.status === 200 || final.status === 201, `status ${final.status} ${JSON.stringify(final.json).slice(0, 200)}`)
const appt = final.json?.data?.appointment ?? final.json?.data
const payment = final.json?.data?.payment
C.apptId = appt?.id
console.log(`     appointment #${appt?.id} status=${appt?.status} total=${appt?.totalAmount} payment status=${payment?.status}`)
check('appointment starts PAYMENT_REQUIRED', appt?.status === 'PAYMENT_REQUIRED', `got ${appt?.status}`)
check('cash payment created UNPAID', payment?.status === 'UNPAID', `got ${payment?.status}`)
check('appointment has a reference code', Boolean(appt?.referenceCode), `ref=${appt?.referenceCode}`)
C.accessToken = payment?.accessToken

console.log('\n=== STEP 4: customer account sees the booking ===')
const mine = await api('GET', '/account/appointments', { token: custToken })
check('GET /account/appointments returns the booking', (mine.json?.data?.items ?? []).some((a) => a.id === appt.id), `status ${mine.status}`)
const detail = await api('GET', `/account/appointments/${appt.id}`, { token: custToken })
check('booking detail loads for its owner', detail.status === 200, `status ${detail.status}`)
check('detail exposes the total and the customer link', detail.json?.data?.totalAmount != null && detail.json?.data?.customerId != null, `total=${detail.json?.data?.totalAmount} customerId=${detail.json?.data?.customerId}`)
const other = await api('GET', '/account/appointments/999999', { token: custToken })
check('another customer booking is not readable', other.status === 404 || other.status === 403, `status ${other.status}`)

console.log('\n=== STEP 5: admin reviews and confirms the cash payment ===')
const admin = (await api('POST', '/auth/login', { body: { email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD } })).json?.data?.token
const queue = await api('GET', '/admin/payments?status=UNPAID&perPage=50', { token: admin })
check('admin payment queue lists the cash payment', (queue.json?.data?.items ?? []).some((p) => p.id === payment.id), `status ${queue.status}`)
const dash = await api('GET', '/admin/dashboard', { token: admin })
check('admin dashboard loads', dash.status === 200, `status ${dash.status}`)

const declared = await api('POST', `/payments/${payment.accessToken}/cash`, { body: { amountPaid: appt.totalAmount ?? 0, transactionReference: 'QA-JOURNEY-1', paymentDate: new Date().toISOString().slice(0, 10), note: 'Paid at the counter' } })
check('customer can declare the cash payment', declared.status === 200 || declared.status === 201, `status ${declared.status} ${JSON.stringify(declared.json).slice(0, 160)}`)

const confirm = await api('POST', `/admin/payments/${payment.id}/confirm-cash`, { token: admin, body: { note: 'Cash confirmed by QA' } })
check('admin confirms cash paid', confirm.status === 200, `status ${confirm.status} ${JSON.stringify(confirm.json).slice(0, 160)}`)
const dbl = await api('POST', `/admin/payments/${payment.id}/confirm-cash`, { token: admin, body: { note: 'again' } })
check('double confirm-cash is rejected', dbl.status >= 400, `status ${dbl.status}`)

const afterAppt = await api('GET', `/account/appointments/${appt.id}`, { token: custToken })
check('appointment advanced to READY_FOR_SERVICE', afterAppt.json?.data?.appointment?.status === 'READY_FOR_SERVICE' || afterAppt.json?.data?.status === 'READY_FOR_SERVICE', `got ${JSON.stringify(afterAppt.json?.data?.appointment?.status ?? afterAppt.json?.data?.status)}`)

console.log('\n=== STEP 6: barber side ===')
const bStamp = Date.now()
const nb = await api('POST', '/barbers', { token: admin, body: { name: 'Journey Barber', email: `journey-b-${bStamp}@test.local`, phone: '08044556677', commissionType: 'PERCENTAGE', commissionValue: 20, serviceIds: [svc.id] } })
const bId = nb.json?.data?.id
await api('PUT', `/barbers/${bId}`, { token: admin, body: { portalEnabled: true, portalPassword: 'JourneyBarber1!' } })
const bTok = (await api('POST', '/barber/auth/login', { body: { identifier: '08044556677', password: 'JourneyBarber1!' } })).json?.data?.token
check('barber signs in to the portal', Boolean(bTok), `barber #${bId}`)

if (bTok) {
  const ov = await api('GET', '/barber/portal/overview', { token: bTok })
  check('barber overview loads', ov.status === 200, `status ${ov.status}`)
  const ovNo = await api('GET', '/barber/portal/overview')
  check('barber overview requires a token', ovNo.status === 401 || ovNo.status === 403, `status ${ovNo.status}`)
  const bAppts = await api('GET', '/barber/portal/appointments', { token: bTok })
  check('barber appointment list loads', bAppts.status === 200, `status ${bAppts.status}`)
  const earn = await api('GET', '/barber/portal/earnings', { token: bTok })
  check('barber earnings load', earn.status === 200, `status ${earn.status}`)
  const availGet = await api('GET', '/barber/portal/availability', { token: bTok })
  check('barber availability loads', availGet.status === 200, `status ${availGet.status}`)
  const notif = await api('GET', '/barber/portal/notifications', { token: bTok })
  check('barber notifications load', notif.status === 200, `status ${notif.status}`)
  const putAvail = await api('PUT', '/barber/portal/availability', { token: bTok, body: [{ dayOfWeek: 1, startTime: '10:00', endTime: '16:00', isAvailable: true }] })
  check('barber can save availability (frontend array payload)', putAvail.status === 200, `status ${putAvail.status} ${JSON.stringify(putAvail.json).slice(0, 140)}`)
  const putAvail1 = await api('PUT', '/barber/portal/availability', { token: bTok, body: { dayOfWeek: 2, startTime: '09:00', endTime: '15:00', isAvailable: true } })
  check('barber can save a single entry (legacy object payload)', putAvail1.status === 200, `status ${putAvail1.status} ${JSON.stringify(putAvail1.json).slice(0, 140)}`)
  const putAvailBad = await api('PUT', '/barber/portal/availability', { token: bTok, body: [{ dayOfWeek: 9, startTime: '10:00', endTime: '99:99', isAvailable: 'yes' }] })
  check('invalid availability is still rejected', putAvailBad.status === 400 || putAvailBad.status === 422, `status ${putAvailBad.status}`)
  const earnAdmin = await api('GET', '/admin/barber-earnings', { token: admin })
  check('admin barber-earnings loads', earnAdmin.status === 200, `status ${earnAdmin.status}`)
  const earnPublic = await api('GET', '/admin/barber-earnings')
  check('admin barber-earnings is not public', earnPublic.status === 401 || earnPublic.status === 403, `status ${earnPublic.status}`)
}

console.log('\n=== STEP 7: verify the payment + receipt pages in a real browser ===')
const PORT = 9444
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const { rmSync } = await import('node:fs')
const PROFILE = 'C:/Users/HALIFA~1/AppData/Local/Temp/opencode/sawaba/chrome-journey'
rmSync(PROFILE, { recursive: true, force: true })
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
for (let i = 0; i < 80; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break } catch {} await sleep(400) }
const tl = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const ws = new WebSocket(tl.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0; const pend = new Map(); const evs = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result) } else if (m.method) (evs.get(m.method) ?? []).forEach((f) => f(m.params)) }
const send = (method, params = {}) => new Promise((res, rej) => { const i2 = ++id; pend.set(i2, { res, rej }); ws.send(JSON.stringify({ id: i2, method, params })) })
const on = (mm, f) => { if (!evs.has(mm)) evs.set(mm, []); evs.get(mm).push(f) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
const evalJs = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.value
async function goto(url, settle = 2600) {
  const l = new Promise((r) => on('Page.loadEventFired', r))
  try { await send('Page.navigate', { url }) }
  catch (e) { await sleep(400); try { await evalJs(`location.assign(${JSON.stringify(url)}); true`) } catch {} }
  await Promise.race([l, sleep(15000)])
  await sleep(settle)
}

async function see(route, storage, mustContain) {
  await goto(APP + '/')
  await evalJs(`(()=>{try{localStorage.clear();${Object.entries(storage).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)})`).join(';')}}catch(e){}})()`)
  await goto(route, 2600)
  const txt = await evalJs(`(document.body.innerText||'').replace(/\\s+/g,' ').trim()`)
  const hit = mustContain ? txt.toLowerCase().includes(mustContain.toLowerCase()) : true
  check(`browser ${route}`, hit && txt.length > 60, hit ? '' : `missing "${mustContain}" in: ${txt.slice(0, 180)}`)
  return txt
}

const adminLogin = (await api('POST', '/auth/login', { body: { email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD } })).json?.data
await see('/account/bookings', { sawaba_customer_token: custToken }, 'Journey Customer')
await see('/account/bookings/' + appt.id, { sawaba_customer_token: custToken }, 'Journey')
await see(`/pay/${payment.accessToken}`, {}, 'payment')
await see(`/receipt/${payment.accessToken}`, {}, 'receipt')
await see('/payments', {}, 'payment history')
await see('/admin/payments', { sawaba_admin_token: adminLogin.token, sawaba_admin_profile: JSON.stringify(adminLogin.admin) }, 'payments')
await see('/admin/barber-earnings', { sawaba_admin_token: adminLogin.token, sawaba_admin_profile: JSON.stringify(adminLogin.admin) }, 'earnings')
if (bTok) { await see('/barber', { barber_token: bTok }, 'welcome'); await see('/barber/availability', { barber_token: bTok }, 'availab') }

console.log('\n=== STEP 8: booking-window edge cases ===')
const past = new Date(Date.now() - 864e5).toISOString().slice(0, 10)
const pastBook = await api('POST', '/checkout', { body: { serviceId: svc.id, barberId: barber.id, appointmentDate: past, appointmentTime: '12:00', paymentMethod: 'CASH', customerName: 'Past Probe', customerPhone: '08099998888' } })
check('past date is rejected', pastBook.status === 400 || pastBook.status === 422, `status ${pastBook.status} ${JSON.stringify(pastBook.json).slice(0, 120)}`)
const offHours = await api('POST', '/checkout', { body: { serviceId: svc.id, barberId: barber.id, appointmentDate: date, appointmentTime: '03:00', paymentMethod: 'CASH', customerName: 'Off Hours', customerPhone: '08099998887' } })
check('time outside working hours is rejected', offHours.status === 400 || offHours.status === 422, `status ${offHours.status} ${JSON.stringify(offHours.json).slice(0, 120)}`)
const wrongBarber = await api('POST', '/checkout', { body: { serviceId: svc.id, barberId: bId && barber.id === bId ? barber.id : 999999, appointmentDate: date, appointmentTime: slot.time, paymentMethod: 'CASH', customerName: 'Wrong Barber', customerPhone: '08099998886' } })
check('unknown barber is rejected', wrongBarber.status === 400 || wrongBarber.status === 404 || wrongBarber.status === 422, `status ${wrongBarber.status} ${JSON.stringify(wrongBarber.json).slice(0, 120)}`)
const disabled = await api('GET', `/services/99999`)
check('unknown service 404s', disabled.status === 404, `status ${disabled.status}`)

console.log(`\n================ JOURNEY RESULT: ${pass} passed, ${fail} failed ================`)
if (fail) console.log('(see FAIL lines above)')

// ---- cleanup ----
console.log('\n=== CLEANUP ===')
const dbg = { apptId: C.apptId, bId, phone, sessionToken }
console.log('cleanup targets:', JSON.stringify(dbg))
ws.close(); chrome.kill()
if (apiProc) { try { apiProc.kill('SIGKILL') } catch {} }
process.exit(fail ? 1 : 0)