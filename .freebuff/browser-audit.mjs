// Full browser audit: visits EVERY route in the app (public, admin, barber,
// customer), recording console errors, failed/4xx network requests, blank-page
// renders, horizontal overflow, and a screenshot per route.
// Run: node .freebuff/browser-audit.mjs [--shots]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SHOTS = path.join(ROOT, '.freebuff', 'qa-shots')
const WANT_SHOTS = process.argv.includes('--shots')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9333
const PROFILE = 'C:/Users/HALIFA~1/AppData/Local/Temp/opencode/sawaba/chrome-qa'
const APP = 'http://localhost:5173'
const API = 'http://localhost:5000/api'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// credentials
for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}
async function api(m, p, { token, body } = {}) {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`; if (body) h['Content-Type'] = 'application/json'
  const r = await fetch(API + p, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { status: r.status, json: j }
}

// ---------- manage the API ourselves so it cannot be reaped mid-run ----------
let apiProc = null
async function apiUp() { try { return (await fetch('http://localhost:5000/health')).ok } catch { return false } }
async function ensureApi() {
  if (await apiUp()) { console.log('API already running on :5000 — reusing it'); return }
  const { spawn } = await import('node:child_process')
  console.log('starting API on :5000 ...')
  apiProc = spawn(process.execPath, [path.join(ROOT, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], {
    cwd: path.join(ROOT, 'backend'),
    env: { ...process.env, PORT: '5000', NODE_ENV: 'development' },
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  for (let i = 0; i < 90; i++) { if (await apiUp()) { console.log('API is up'); return } await sleep(500) }
  throw new Error('API never became healthy')
}
await ensureApi()

// ---------- chrome ----------
rmSync(PROFILE, { recursive: true, force: true })
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--window-size=1440,900', '--disable-extensions',
  '--disable-background-networking', '--disable-features=Translate,BackForwardCache', 'about:blank'], { stdio: 'ignore' })

async function waitPort() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return } catch {}
    await sleep(400)
  }
  throw new Error('chrome debug port never opened')
}
await waitPort()

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

let msgId = 0
const pending = new Map()
const handlers = new Map()
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result) }
  else if (m.method) { (handlers.get(m.method) ?? []).forEach((fn) => fn(m.params)) }
}
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++msgId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
const on = (method, fn) => { if (!handlers.has(method)) handlers.set(method, []); handlers.get(method).push(fn) }

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable')

let consoleErrors = []
let netErrors = []
on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 300)) })
on('Runtime.exceptionThrown', (p) => { consoleErrors.push('UNCAUGHT: ' + String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? '').slice(0, 300)) })
on('Network.responseReceived', (p) => { if (p.response.status >= 400) netErrors.push(`${p.response.status} ${p.response.url.replace(APP, '').replace(API, '/api')}`) })
on('Network.loadingFailed', (p) => { if (p.type !== 'Image' || !p.canceled) netErrors.push(`FAILED ${p.errorText} ${p.type}`) })

const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value

// ---------- helpers ----------
let inflight = 0, quietSince = Date.now()
on('Network.requestWillBeSent', () => { inflight++; quietSince = Date.now() })
on('Network.loadingFinished', () => { inflight = Math.max(0, inflight - 1); quietSince = Date.now() })
on('Network.loadingFailed', () => { inflight = Math.max(0, inflight - 1); quietSince = Date.now() })
async function waitQuiet(max = 12000) { const t = Date.now(); while (Date.now() - t < max) { if (inflight === 0 && Date.now() - quietSince > 800) return; await sleep(150) } }

async function goto(url, settle = 2000) {
  const loaded = new Promise((res) => { const h = () => res(); on('Page.loadEventFired', h) })
  await send('Page.navigate', { url })
  await Promise.race([loaded, sleep(18000)])
  await waitQuiet()
  await sleep(settle)
}
async function setStorage(obj) {
  await evalJs(`(()=>{ try{ localStorage.clear(); ${Object.entries(obj).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join(' ')} }catch(e){} })()`)
}
async function probeViewport(width, height = 900) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 })
  await sleep(500)
}

const results = []
async function visit(route, { group, expectRedirect, expectText } = {}) {
  consoleErrors = []; netErrors = []
  await goto(APP + route)
  const info = JSON.parse((await evalJs(`JSON.stringify({
    path: location.pathname + location.search,
    title: document.title,
    textLen: (document.body.innerText||'').replace(/\\s+/g,' ').trim().length,
    rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : 0,
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    h1: (document.querySelector('h1')?.innerText||'').slice(0,70),
    sample: (document.body.innerText||'').replace(/\\s+/g,' ').trim().slice(0,110)
  })`)) ?? '{}')

  const overflow = info.scrollW > info.innerW + 2
  const blank = info.textLen < 30 || info.rootChildren === 0
  const redirected = expectRedirect ? new RegExp(expectRedirect).test(info.path) : true
  const hasText = expectText ? (info.sample + ' ' + info.h1).toLowerCase().includes(expectText.toLowerCase()) : true

  let file = ''
  if (WANT_SHOTS) {
    mkdirSync(SHOTS, { recursive: true })
    const name = (group + '-' + route.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'root').slice(0, 80) + '.png'
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(path.join(SHOTS, name), Buffer.from(shot.data, 'base64'))
    file = name
  }

  const row = { group, route, finalPath: info.path, textLen: info.textLen, blank, overflow: overflow ? `${info.scrollW}>${info.innerW}` : false, redirected, hasText, consoleErrors: [...consoleErrors], netErrors: [...netErrors], sample: info.sample, file }
  results.push(row)
  const flags = [blank && 'BLANK', overflow && 'OVERFLOW', !redirected && 'NO-REDIRECT', !hasText && 'NO-TEXT', consoleErrors.length && `CONSOLE:${consoleErrors.length}`, netErrors.length && `NET:${netErrors.length}`].filter(Boolean)
  console.log(`${flags.length ? 'FAIL' : ' ok '} ${group.padEnd(9)} ${route.padEnd(30)} -> ${info.path.padEnd(28)} ${String(info.textLen).padStart(5)}ch ${flags.join(' ') || ''}`)
  return row
}

// ---------- tokens ----------
const adminLogin = await api('POST', '/auth/login', { body: { email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD } })
const adminToken = adminLogin.json?.data?.token
const adminProfile = JSON.stringify(adminLogin.json?.data?.admin ?? {})

const qaPhone = '0803' + String(Date.now()).slice(-7)
let custToken = null
const reg = await api('POST', '/account/register', { body: { fullName: 'QA Browser Probe', phone: qaPhone, email: `qa-browser-${Date.now()}@test.local`, password: 'QaBrowser123!' } })
custToken = reg.json?.data?.token
if (!custToken) custToken = (await api('POST', '/account/login', { body: { phone: qaPhone, password: 'QaBrowser123!' } })).json?.data?.token

const stamp = Date.now()
const nb = await api('POST', '/barbers', { token: adminToken, body: { name: 'QA Browser Barber', email: `qa-brows-${stamp}@test.local`, phone: '08099112233', commissionType: 'PERCENTAGE', commissionValue: 12, serviceIds: [1, 2] } })
const barberId = nb.json?.data?.id
let barberToken = null
if (barberId) {
  await api('PUT', `/barbers/${barberId}`, { token: adminToken, body: { portalEnabled: true, portalPassword: 'QaBrowserBarber1!' } })
  barberToken = (await api('POST', '/barber/auth/login', { body: { identifier: '08099112233', password: 'QaBrowserBarber1!' } })).json?.data?.token
}
console.log(`tokens: admin=${Boolean(adminToken)} customer=${Boolean(custToken)} barber=${Boolean(barberToken)} (probe barber #${barberId})\n`)

// ---------- 1. public ----------
console.log('--- PUBLIC PAGES ---')
await setStorage({})
await visit('/', { group: 'public' })
for (const r of ['/about', '/services', '/services/1', '/services/99999', '/barbers', '/barbers/1', '/barbers/99999', '/gallery', '/reviews', '/pricing', '/book', '/payments', '/contact', '/404', '/this-route-does-not-exist'])
  await visit(r, { group: 'public' })
await visit('/baber', { group: 'public', expectRedirect: '^/barber/login' })

// ---------- 2. guards ----------
console.log('\n--- AUTH GUARDS (logged out) ---')
for (const r of ['/admin', '/admin/appointments', '/admin/nope', '/barber', '/barber/appointments', '/barber/nope', '/account', '/account/bookings', '/account/nope', '/account/bookings/1'])
  await visit(r, { group: 'guard' })

// ---------- 3. admin ----------
console.log('\n--- ADMIN DASHBOARD ---')
await setStorage({ sawaba_admin_token: adminToken, sawaba_admin_profile: adminProfile })
await visit('/admin/login', { group: 'admin' })
for (const r of ['/admin', '/admin/appointments', '/admin/payments', '/admin/payment-settings', '/admin/appearance', '/admin/services', '/admin/barbers', '/admin/barber-earnings', '/admin/gallery', '/admin/reviews', '/admin/contacts', '/admin/customers', '/admin/nope'])
  await visit(r, { group: 'admin' })

// ---------- 4. customer ----------
console.log('\n--- CUSTOMER ACCOUNT ---')
await setStorage({ sawaba_customer_token: custToken })
await visit('/account/login', { group: 'customer' })
for (const r of ['/account', '/account/bookings', '/account/bookings/1', '/account/payments', '/account/profile', '/account/appointments', '/account/nope'])
  await visit(r, { group: 'customer' })

// ---------- 5. barber ----------
console.log('\n--- BARBER PORTAL ---')
await setStorage({ barber_token: barberToken })
await visit('/barber/login', { group: 'barber' })
for (const r of ['/barber', '/barber/appointments', '/barber/day-view', '/barber/earnings', '/barber/notifications', '/barber/availability', '/barber/nope'])
  await visit(r, { group: 'barber' })

// ---------- 6. payment pages with a real session ----------
console.log('\n--- PAYMENT / RECEIPT PAGES ---')
const svc = (await api('GET', '/services?perPage=1')).json?.data?.items?.[0]
const barbers = (await api('GET', '/barbers?perPage=50')).json?.data?.items ?? []
const barber = barbers.find((b) => b.isActive && b.services?.some((s) => s.id === svc?.id))
const date = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10)
const avail = await api('GET', `/availability?barberId=${barber.id}&date=${date}`)
const slot = (avail.json?.data?.slots ?? []).find((s) => s.available)
await setStorage({})
if (slot) {
  const cs = await api('POST', '/checkout', { body: { serviceId: svc.id, barberId: barber.id, appointmentDate: date, appointmentTime: slot.time, paymentMethod: 'CASH', customerName: 'QA Browser Pay', customerPhone: '08055667788' } })
  const tok = cs.json?.data?.token ?? cs.json?.data?.sessionToken
  console.log(`     checkout token: ${tok ? 'obtained' : 'NONE ' + JSON.stringify(cs.json).slice(0, 120)}`)
  if (tok) {
    await visit(`/pay/${tok}`, { group: 'payment' })
    await visit(`/receipt/${tok}`, { group: 'payment' })
    await api('POST', `/checkout/${tok}/abandon`, { body: {} })
  }
}
await visit('/pay/not-a-real-token', { group: 'payment' })
await visit('/receipt/not-a-real-token', { group: 'payment' })
await visit('/payments/callback?token=x&reference=y', { group: 'payment' })

// ---------- 7. responsiveness ----------
const respResults = []
writeFileSync(path.join(ROOT, '.freebuff', 'browser-audit.json'), JSON.stringify({ results, respResults }, null, 2))
console.log(`\n[stage 1 complete: ${results.length} routes visited, ${results.filter((r) => r.blank || r.overflow || r.consoleErrors.length || r.netErrors.length).length} with issues -> saved]`)
console.log('\n--- RESPONSIVE SWEEP (overflow + blank) ---')
const WIDTHS = process.env.QA_WIDTHS ? process.env.QA_WIDTHS.split(',').map(Number) : [320, 390, 768, 1440]
const RESP_ROUTES = process.env.QA_MINIMAL
  ? { public: ['/', '/services', '/gallery', '/book', '/contact'], admin: ['/admin', '/admin/payments'], customer: ['/account', '/account/profile'], barber: ['/barber', '/barber/appointments'] }
  : {
      public: ['/', '/about', '/services', '/services/1', '/barbers', '/barbers/1', '/gallery', '/reviews', '/pricing', '/book', '/payments', '/contact'],
      admin: ['/admin', '/admin/appointments', '/admin/payments', '/admin/payment-settings', '/admin/appearance', '/admin/services', '/admin/barbers', '/admin/barber-earnings', '/admin/gallery', '/admin/reviews', '/admin/contacts', '/admin/customers'],
      customer: ['/account', '/account/bookings', '/account/payments', '/account/profile'],
      barber: ['/barber', '/barber/appointments', '/barber/day-view', '/barber/earnings', '/barber/notifications', '/barber/availability'],
    }
const authSets = {
  public: {},
  admin: { sawaba_admin_token: adminToken, sawaba_admin_profile: adminProfile },
  customer: { sawaba_customer_token: custToken },
  barber: { barber_token: barberToken },
}
for (const [grp, routes] of Object.entries(RESP_ROUTES)) {
  await setStorage(authSets[grp])
  for (const w of WIDTHS) {
    await probeViewport(w, w < 768 ? 844 : 900)
    for (const r of routes) {
      consoleErrors = []; netErrors = []
      await goto(APP + r, 1500)
      const info = JSON.parse((await evalJs(`JSON.stringify({
        scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
        textLen: (document.body.innerText||'').trim().length,
        offenders: Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right > window.innerWidth + 2 && getComputedStyle(e).position !== 'fixed').slice(0,3).map(e=>e.tagName+'.'+String(e.className).slice(0,40))
      })`)) ?? '{}')
      const ov = info.scrollW > info.innerW + 2
      const blank = info.textLen < 30
      if (ov || blank) { respResults.push({ grp, w, r, ...info }); console.log(` FAIL ${grp.padEnd(9)} ${String(w).padStart(4)}px ${r.padEnd(28)} ${ov ? `OVERFLOW ${info.scrollW}>${info.innerW} ${JSON.stringify(info.offenders)}` : ''} ${blank ? 'BLANK' : ''}`) }
    }
  }
}
await probeViewport(1440)

// ---------- summary ----------
const fails = results.filter((r) => r.blank || r.overflow || !r.redirected || !r.hasText || r.consoleErrors.length || r.netErrors.length)
writeFileSync(path.join(ROOT, '.freebuff', 'browser-audit.json'), JSON.stringify({ results, respResults }, null, 2))

console.log(`\n================ BROWSER AUDIT SUMMARY ================`)
console.log(`routes visited: ${results.length}`)
console.log(`routes with issues: ${fails.length}`)
console.log(`responsive combos checked: ${Object.keys(RESP_ROUTES).reduce((a, g) => a + RESP_ROUTES[g].length, 0) * WIDTHS.length}, with issues: ${respResults.length}`)
if (fails.length) {
  console.log('\nISSUES:')
  for (const f of fails) {
    console.log(`\n [${f.group}] ${f.route} -> ${f.finalPath}`)
    if (f.blank) console.log(`   BLANK PAGE (${f.textLen} chars of text)`)
    if (f.overflow) console.log(`   OVERFLOW ${f.overflow}`)
    if (!f.redirected) console.log(`   expected redirect did not happen`)
    if (!f.hasText) console.log(`   expected text missing; saw: "${f.sample}"`)
    for (const e of f.consoleErrors) console.log(`   console: ${e}`)
    for (const e of f.netErrors) console.log(`   network: ${e}`)
  }
}
if (respResults.length) { console.log('\nRESPONSIVE ISSUES:'); for (const r of respResults) console.log(`  ${r.grp} @${r.w}px ${r.r} scrollW=${r.scrollW} innerW=${r.innerW} ${JSON.stringify(r.offenders ?? [])}`) }
console.log(`\nartifacts: .freebuff/browser-audit.json${WANT_SHOTS ? ` + ${SHOTS}` : ''}`)

ws.close(); chrome.kill()
if (apiProc) { try { apiProc.kill('SIGKILL') } catch {} }
process.exit(fails.length || respResults.length ? 1 : 0)