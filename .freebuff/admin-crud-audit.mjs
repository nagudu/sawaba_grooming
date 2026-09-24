import { config } from 'dotenv'
config({ path: 'backend/.env' })
const B = 'http://localhost:5000/api'
const login = await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD }) })
const T = (await login.json())?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T }
const call = async (m, p, body) => { const r = await fetch(B + p, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await r.json() } catch {}; return { s: r.status, j } }
const log = []

// SERVICES CRUD
let r = await call('POST', '/services', { name: 'QA Probe Service', description: 'temp', price: 5000, duration: 30, isActive: true })
const svcId = r.j?.data?.id || r.j?.data?.service?.id
log.push(['service create', r.s, svcId])
r = await call('PATCH', '/services/' + svcId, { price: 5500 })
log.push(['service update', r.s])
r = await call('GET', '/services')
const pubSvc = r.j?.data?.items?.find(s => s.id === svcId)
log.push(['service public price after update', r.s, pubSvc ? pubSvc.price : 'MISSING'])
r = await call('DELETE', '/services/' + svcId)
log.push(['service delete', r.s])
r = await call('GET', '/services')
log.push(['service gone publicly', r.j?.data?.items?.some(s => s.id === svcId) ? 'STILL THERE (BAD)' : 'gone ✓'])

// BARBERS CRUD + privacy
r = await call('POST', '/barbers', { name: 'QA Probe Barber', specialty: 'Fades', experience: 3, isActive: true, barberType: 'INTERNAL', commissionType: 'PERCENTAGE', commissionValue: 30 })
const barbId = r.j?.data?.id || r.j?.data?.barber?.id
log.push(['barber create', r.s, barbId])
r = await call('GET', '/barbers')
const pubBarber = r.j?.data?.items?.find(b => b.id === barbId)
log.push(['barber public keys', r.s, pubBarber ? Object.keys(pubBarber).join(',') : 'MISSING'])
log.push(['barber privacy', pubBarber && (pubBarber.commissionValue ?? pubBarber.commission) !== undefined ? 'COMMISSION LEAKED (BAD)' : 'no commission leak ✓'])
r = await call('DELETE', '/barbers/' + barbId)
log.push(['barber delete', r.s])

// REVIEW MODERATION
r = await call('POST', '/reviews', { name: 'QA Probe Reviewer', email: 'qa-probe@test.local', rating: 5, message: 'QA probe review ' + Date.now(), serviceId: 1 })
const revId = r.j?.data?.id || r.j?.data?.review?.id
log.push(['review submit', r.s, revId])
r = await call('GET', '/reviews?approved=true')
log.push(['pending review hidden publicly', r.j?.data?.items?.some(x => x.id === revId) ? 'VISIBLE (BAD)' : 'hidden ✓'])
r = await call('PATCH', '/reviews/' + revId, { approved: true })
log.push(['admin approve', r.s])
r = await call('GET', '/reviews?approved=true')
log.push(['approved review public', r.j?.data?.items?.some(x => x.id === revId) ? 'visible ✓' : 'MISSING (BAD)'])
r = await call('DELETE', '/reviews/' + revId)
log.push(['review delete', r.s])

console.log(log.map(l => l.join(' | ')).join('\n'))
