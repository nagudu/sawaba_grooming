// Targeted probes for two suspected defects:
//  1. Barber delete cascade — create barber + availability + service links, delete, assert no orphans.
//  2. Availability vs checkout hold — open a checkout session, then ask the availability
//     endpoint whether that slot is still bookable.
// Run: node .freebuff/probe-cascade-hold.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const B = 'http://localhost:5000/api'
for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}

async function req(m, p, { token, body } = {}) {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (body) h['Content-Type'] = 'application/json'
  const r = await fetch(B + p, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { status: r.status, json: j }
}
const sql = (q) =>
  execFileSync(process.execPath, [path.join(ROOT, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), '-e', `
    import {sequelize} from './src/config/database';
    (async () => {
      const [r] = await sequelize.query(${JSON.stringify(q)});
      console.log('@@' + JSON.stringify(r));
      await sequelize.close();
    })();
  `], { cwd: path.join(ROOT, 'backend'), encoding: 'utf8', env: { ...process.env } }).trim().split('\n').filter((l) => l.startsWith('@@')).pop().slice(2)

let pass = 0, fail = 0
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  ok   ${n}`)) : (fail++, console.log(`  FAIL ${n} :: ${d}`)) }

const admin = (await req('POST', '/auth/login', { body: { email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD } })).json.data.token

console.log('=== PROBE 1: barber delete cascade (current code) ===')
const stamp = Date.now()
const created = await req('POST', '/barbers', {
  token: admin,
  body: { name: 'Cascade Probe', email: `cascade-${stamp}@test.local`, phone: '08055550001', commissionType: 'PERCENTAGE', commissionValue: 15, serviceIds: [1, 2, 3] },
})
const bid = created.json?.data?.id
check('probe barber created', Boolean(bid), `status ${created.status} ${JSON.stringify(created.json).slice(0, 120)}`)

const put = await req('PUT', `/barbers/${bid}`, { token: admin, body: { portalEnabled: true, portalPassword: 'QaCascade123!' } })
check('probe barber portal enabled', put.status === 200, `status ${put.status}`)

const avBefore = JSON.parse(await sql(`SELECT COUNT(*) n FROM barber_availability WHERE barber_id=${bid}`))
const svBefore = JSON.parse(await sql(`SELECT COUNT(*) n FROM barber_services WHERE barber_id=${bid}`))
console.log(`     availability rows=${avBefore[0].n}  service links=${svBefore[0].n}`)

const del = await req('DELETE', `/barbers/${bid}`, { token: admin })
check('probe barber deleted', del.status === 200, `status ${del.status} ${JSON.stringify(del.json).slice(0, 120)}`)

const avAfter = JSON.parse(await sql(`SELECT COUNT(*) n FROM barber_availability WHERE barber_id=${bid}`))
const svAfter = JSON.parse(await sql(`SELECT COUNT(*) n FROM barber_services WHERE barber_id=${bid}`))
check('no orphan barber_availability after delete', Number(avAfter[0].n) === 0, `${avAfter[0].n} rows left`)
check('no orphan barber_services after delete', Number(svAfter[0].n) === 0, `${svAfter[0].n} rows left`)

console.log('\n=== PROBE 2: availability vs checkout hold ===')
const barbers = (await req('GET', '/barbers?perPage=50&isActive=true')).json?.data?.items ?? []
const barber = barbers.find((b) => b.isActive && b.services?.length)
const svcId = barber?.services?.[0]?.id
const date = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)
const before = await req('GET', `/availability?barberId=${barber.id}&date=${date}`)
const openSlot = (before.json?.data?.slots ?? before.json?.data ?? []).find?.((s) => s.available)
check('found an available slot to hold', Boolean(openSlot), `barber=${barber?.id} svc=${svcId} date=${date} keys=${Object.keys(before.json?.data ?? {})}`)
const slot = openSlot

if (slot) {
  const session = await req('POST', '/checkout', {
    body: { serviceId: svcId, barberId: barber.id, appointmentDate: date, appointmentTime: slot.time, paymentMethod: 'CASH', customerName: 'Cascade Probe', customerPhone: '08055550002' },
  })
  check('checkout session opened', session.status === 200 || session.status === 201, `status ${session.status} ${JSON.stringify(session.json).slice(0, 140)}`)
  const token = session.json?.data?.token ?? session.json?.data?.sessionToken

  const during = await req('GET', `/availability?barberId=${barber.id}&date=${date}`)
  const duringSlots = during.json?.data?.slots ?? during.json?.data ?? []
  const sameSlot = duringSlots.find?.((s) => s.time === slot.time)
  check('held slot reports UNAVAILABLE in availability', sameSlot?.available === false, `slot ${slot.time} reported available=${sameSlot?.available} while a checkout session holds it`)

  if (token) {
    const ab = await req('POST', `/checkout/${token}/abandon`, { body: {} })
    check('session abandoned', ab.status === 200, `status ${ab.status}`)
    const after = await req('GET', `/availability?barberId=${barber.id}&date=${date}`)
    const afterSlots = after.json?.data?.slots ?? after.json?.data ?? []
    const released = afterSlots.find?.((s) => s.time === slot.time)
    check('slot released after abandon', released?.available === true, `slot ${slot.time} available=${released?.available}`)
  }
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)