const BASE = 'http://localhost:5000/api'
let token = ''
let pass = 0
let fail = 0
const created = []

async function req(method, path, body, auth = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json = null
  try { json = await res.json() } catch { /* ignore */ }
  return { status: res.status, json }
}

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`) }
}

const tomorrow = () => {
  const d = new Date(Date.now() + 24 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

async function pickCombo() {
  const barbers = await req('GET', '/barbers', undefined, false)
  const list = Array.isArray(barbers.json.data) ? barbers.json.data : (barbers.json.data.items ?? [])
  const withService = list.find((b) => Array.isArray(b.services) && b.services.length > 0)
  if (!withService) throw new Error('no barber with services found')
  return { barberId: withService.id, serviceId: withService.services[0].id }
}

async function book(time, combo) {
  const r = await req('POST', '/appointments', {
    customerName: `Status Test ${time}`,
    customerPhone: '+2348012345678',
    customerEmail: null,
    serviceId: combo.serviceId,
    barberId: combo.barberId,
    appointmentDate: tomorrow(),
    appointmentTime: time,
  })
  if (r.status !== 201) throw new Error(`booking failed: ${JSON.stringify(r.json)}`)
  const id = r.json.data.appointment.id
  created.push(id)
  return { id, status: r.json.data.appointment.status, pay: r.json.data.appointment.payment?.status ?? 'NONE' }
}

async function main() {
  const login = await req('POST', '/auth/login', { email: 'admin@sawabasalon.com', password: 'ChangeMe123!' }, false)
  token = login.json.data.token
  check('admin login', login.status === 200 && Boolean(token))

  // Fresh, independent appointments each run — no shared state with previous runs.
  const combo = await pickCombo()
  const A = await book('10:00', combo) // stays in payment lifecycle
  const B = await book('11:00', combo) // full happy path to COMPLETED
  const C = await book('12:00', combo) // cancellation path
  const D = await book('13:00', combo) // left at PAYMENT_REQUIRED for isolation checks
  check('A/B/C/D created fresh at PAYMENT_REQUIRED', [A, B, C, D].every((x) => x.status === 'PAYMENT_REQUIRED'), JSON.stringify([A, B, C, D]))

  // --- 1. Invalid jump on A: PAYMENT_REQUIRED -> IN_PROGRESS ---
  let r = await req('PATCH', `/appointments/${A.id}/status`, { status: 'IN_PROGRESS' })
  check('A REQUIRED->IN_PROGRESS rejected (422)', r.status === 422, `got ${r.status}`)
  check('A message names current status', (r.json?.message ?? '').includes('currently Payment Required'), r.json?.message)
  check('A message lists valid next steps', (r.json?.message ?? '').includes('Available next steps: Payment Submitted, Cancelled'), r.json?.message)

  // --- 2. A: REQUIRED -> SUBMITTED ---
  r = await req('PATCH', `/appointments/${A.id}/status`, { status: 'PAYMENT_SUBMITTED' })
  check('A REQUIRED->SUBMITTED ok', r.status === 200 && r.json?.data?.status === 'PAYMENT_SUBMITTED', JSON.stringify(r.json))
  check('A response exposes availableNextSteps', r.json?.data?.availableNextSteps?.includes('PAYMENT_VERIFIED'), JSON.stringify(r.json?.data?.availableNextSteps))
  check('A payment record synced to PENDING_VERIFICATION', r.json?.data?.payment?.status === 'PENDING_VERIFICATION', `payment=${r.json?.data?.payment?.status}`)

  // --- 3. B: independent lifecycle start ---
  r = await req('PATCH', `/appointments/${B.id}/status`, { status: 'PAYMENT_SUBMITTED' })
  check('B REQUIRED->SUBMITTED ok (independent of A)', r.status === 200 && r.json?.data?.status === 'PAYMENT_SUBMITTED', JSON.stringify(r.json))

  // --- 4. A: SUBMITTED -> REJECTED ---
  r = await req('PATCH', `/appointments/${A.id}/status`, { status: 'PAYMENT_REJECTED' })
  check('A SUBMITTED->REJECTED ok', r.status === 200 && r.json?.data?.status === 'PAYMENT_REJECTED', JSON.stringify(r.json))
  check('A payment marked REJECTED', r.json?.data?.payment?.status === 'REJECTED', `payment=${r.json?.data?.payment?.status}`)

  // --- 5. The reported complaint: REJECTED -> IN_PROGRESS ---
  r = await req('PATCH', `/appointments/${A.id}/status`, { status: 'IN_PROGRESS' })
  check('A REJECTED->IN_PROGRESS rejected (422)', r.status === 422, `got ${r.status}`)
  check('A complaint case message', (r.json?.message ?? '').includes('currently Payment Rejected') && (r.json?.message ?? '').includes('Available next steps: Payment Submitted, Cancelled'), r.json?.message)

  // --- 6. Resubmission: REJECTED -> SUBMITTED ---
  r = await req('PATCH', `/appointments/${A.id}/status`, { status: 'PAYMENT_SUBMITTED' })
  check('A REJECTED->SUBMITTED (Resubmit) ok', r.status === 200 && r.json?.data?.status === 'PAYMENT_SUBMITTED', JSON.stringify(r.json))
  check('A payment resynced to PENDING_VERIFICATION', r.json?.data?.payment?.status === 'PENDING_VERIFICATION', `payment=${r.json?.data?.payment?.status}`)

  // --- 7. B: SUBMITTED -> VERIFIED -> READY -> IN_PROGRESS -> COMPLETED ---
  r = await req('PATCH', `/appointments/${B.id}/status`, { status: 'PAYMENT_VERIFIED' })
  check('B SUBMITTED->VERIFIED ok', r.status === 200 && r.json?.data?.status === 'PAYMENT_VERIFIED', JSON.stringify(r.json))
  check('B payment now PAID', r.json?.data?.payment?.status === 'PAID', `payment=${r.json?.data?.payment?.status}`)
  r = await req('PATCH', `/appointments/${B.id}/status`, { status: 'READY_FOR_SERVICE' })
  check('B VERIFIED->READY ok', r.status === 200 && r.json?.data?.status === 'READY_FOR_SERVICE', JSON.stringify(r.json))
  r = await req('PATCH', `/appointments/${B.id}/status`, { status: 'IN_PROGRESS' })
  check('B READY->IN_PROGRESS ok', r.status === 200 && r.json?.data?.status === 'IN_PROGRESS', JSON.stringify(r.json))
  check('B serviceStartedAt set', Boolean(r.json?.data?.serviceStartedAt))
  r = await req('PATCH', `/appointments/${B.id}/status`, { status: 'COMPLETED' })
  check('B IN_PROGRESS->COMPLETED ok', r.status === 200 && r.json?.data?.status === 'COMPLETED', JSON.stringify(r.json))
  check('B completedAt set', Boolean(r.json?.data?.completedAt))

  // --- 8. Terminal states ---
  r = await req('PATCH', `/appointments/${B.id}/status`, { status: 'IN_PROGRESS' })
  check('B COMPLETED is terminal (422)', r.status === 422, `got ${r.status}`)
  check('B terminal message', (r.json?.message ?? '').includes('terminal state'), r.json?.message)

  // --- 9. Cancellation path (payment is UNPAID — must not crash) ---
  r = await req('PATCH', `/appointments/${C.id}/status`, { status: 'CANCELLED' })
  check('C REQUIRED->CANCELLED ok', r.status === 200 && r.json?.data?.status === 'CANCELLED', JSON.stringify(r.json))
  check('C payment marked CANCELLED', r.json?.data?.payment?.status === 'CANCELLED', `payment=${r.json?.data?.payment?.status}`)
  r = await req('POST', `/appointments/${C.id}/reactivate`)
  check('C reactivate -> PAYMENT_REQUIRED', r.status === 200 && r.json?.data?.status === 'PAYMENT_REQUIRED', JSON.stringify(r.json))
  check('C payment restored to UNPAID', r.json?.data?.payment?.status === 'UNPAID', `payment=${r.json?.data?.payment?.status}`)

  // --- 10. Isolation: rapid concurrent changes on A and D ---
  const [ra, rd] = await Promise.all([
    req('PATCH', `/appointments/${A.id}/status`, { status: 'PAYMENT_VERIFIED' }),
    req('PATCH', `/appointments/${D.id}/status`, { status: 'PAYMENT_SUBMITTED' }),
  ])
  check('parallel A echoes its own id+status', ra.json?.data?.id === A.id && ra.json?.data?.status === 'PAYMENT_VERIFIED', `id=${ra.json?.data?.id} status=${ra.json?.data?.status}`)
  check('parallel D echoes its own id+status', rd.json?.data?.id === D.id && rd.json?.data?.status === 'PAYMENT_SUBMITTED', `id=${rd.json?.data?.id} status=${rd.json?.data?.status}`)

  // --- 11. Backend authority: stale frontend target rejected ---
  r = await req('PATCH', `/appointments/${D.id}/status`, { status: 'COMPLETED' })
  check('D SUBMITTED->COMPLETED rejected (stale-target guard)', r.status === 422, `got ${r.status}`)

  // --- 12. Reopen from DB: everything persisted, rows independent ---
  const ga = await req('GET', `/appointments/${A.id}`)
  const gd = await req('GET', `/appointments/${D.id}`)
  check('A DB persisted PAYMENT_VERIFIED', ga.json?.data?.status === 'PAYMENT_VERIFIED', ga.json?.data?.status)
  check('D DB persisted PAYMENT_SUBMITTED', gd.json?.data?.status === 'PAYMENT_SUBMITTED', gd.json?.data?.status)
  check('A/D independent rows', ga.json?.data?.id !== gd.json?.data?.id)

  // --- 13. Unauthenticated requests rejected ---
  r = await req('PATCH', `/appointments/${A.id}/status`, { status: 'CANCELLED' }, false)
  check('unauthenticated PATCH rejected', r.status === 401, `got ${r.status}`)

  // --- cleanup: remove test appointments so the admin list stays clean ---
  for (const id of created) await req('DELETE', `/appointments/${id}`)

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(async (e) => {
  console.error('RUNNER ERROR', e)
  process.exit(1)
})
