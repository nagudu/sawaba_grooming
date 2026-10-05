// Fast responsive sweep: horizontal overflow + blank/short renders only.
// Run: node .freebuff/responsive-sweep.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawn, execSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const APP = 'http://localhost:5173'
const API = 'http://localhost:5000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}
const up = async () => { try { return (await fetch(`${API}/health`)).ok } catch { return false } }
const listeners = () => { try { return execSync('netstat -ano -p TCP', { encoding: 'utf8' }).split(/\r?\n/).filter((l) => /:5000\s+.*LISTENING/.test(l)).map((l) => l.trim().split(/\s+/).pop()) } catch { return [] } }
for (const pid of listeners()) { try { process.kill(Number(pid), 'SIGKILL') } catch {} }
await sleep(600)
const apiProc = spawn(process.execPath, [path.join(ROOT, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], { cwd: path.join(ROOT, 'backend'), env: { ...process.env, PORT: '5000' }, stdio: ['ignore', 'ignore', 'ignore'] })
for (let i = 0; i < 120; i++) { if (await up()) break; await sleep(500) }
if (!(await up())) { console.log('API failed to start'); process.exit(1) }

async function api(m, p, { token, body } = {}) {
  const h = {}; if (token) h.Authorization = `Bearer ${token}`
  if (body) h['Content-Type'] = 'application/json'
  const r = await fetch(`${API}/api${p}`, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined })
  let j = null; try { j = await r.json() } catch {}
  return { status: r.status, json: j }
}

// ---- tokens (reuse a live customer + barber so no extra rows are created) ----
const admin = (await api('POST', '/auth/login', { body: { email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD } })).json?.data
const cust = (await api('POST', '/account/login', { body: { phone: '0803', password: 'wrong-probe' } })).status
const custTok = (await api('POST', '/account/register', { body: { fullName: 'Resp Probe', phone: '080' + String(Date.now()).slice(-8), email: `resp-${Date.now()}@test.local`, password: 'RespProbe123!' } })).json?.data?.token
const bLogin = (await api('POST', '/auth/login', { body: { email: process.env.ADMIN_SEED_EMAIL, password: process.env.ADMIN_SEED_PASSWORD } })).json?.data?.token
const barbers = (await api('GET', '/barbers?perPage=100')).json?.data?.items ?? []
const b = barbers.find((x) => x.portalEnabled && x.email)
const barberTok = b ? (await api('POST', '/barber/auth/login', { body: { identifier: b.email, password: process.env.BARBER_SEED_PASSWORD } })).json?.data?.token : null

const authSets = {
  public: {},
  admin: { sawaba_admin_token: admin.token, sawaba_admin_profile: JSON.stringify(admin.admin) },
  customer: { sawaba_customer_token: custTok },
  barber: { barber_token: barberTok },
}
const ROUTES = {
  public: ['/', '/about', '/services', '/services/1', '/barbers', '/barbers/1', '/gallery', '/reviews', '/pricing', '/book', '/payments', '/contact'],
  admin: ['/admin', '/admin/appointments', '/admin/payments', '/admin/payment-settings', '/admin/appearance', '/admin/services', '/admin/barbers', '/admin/barber-earnings', '/admin/gallery', '/admin/reviews', '/admin/contacts', '/admin/customers'],
  customer: ['/account', '/account/bookings', '/account/payments', '/account/profile', '/account/nope'],
  barber: ['/barber', '/barber/appointments', '/barber/day-view', '/barber/earnings', '/barber/notifications', '/barber/availability', '/barber/nope'],
}
const WIDTHS = (process.env.QA_WIDTHS ?? '320,390,768,1440').split(',').map(Number)

// ---- chrome ----
const PORT = 9446
const PROFILE = 'C:/Users/HALIFA~1/AppData/Local/Temp/opencode/sawaba/chrome-resp'
execSync(`rmdir /s /q "${PROFILE}" 2>nul || exit 0`)
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let ok = false
for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { ok = true; break } } catch {} await sleep(400) }
if (!ok) { console.log('chrome never opened'); process.exit(1) }

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let msgId = 0
const pending = new Map(); const handlers = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result) } else if (m.method) (handlers.get(m.method) ?? []).forEach((f) => f(m.params)) }
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++msgId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
const on = (method, fn) => { if (!handlers.has(method)) handlers.set(method, []); handlers.get(method).push(fn) }
await send('Page.enable'); await send('Runtime.enable')
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value

async function goto(url, settle = 1500) {
  const loaded = new Promise((r) => on('Page.loadEventFired', r))
  try { await send('Page.navigate', { url }) } catch { await evalJs(`location.assign(${JSON.stringify(url)}); true`) }
  await Promise.race([loaded, sleep(12000)])
  await sleep(settle)
}

const MEASURE = `(() => {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const overflowing = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
      if (el.closest('[style*="overflow"], .overflow-x-auto, .overflow-auto, table')) continue;
      overflowing.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\\s+/).slice(0,3).join('.') : '') + ' right=' + Math.round(r.right));
    }
  }
  const txt = (document.body.innerText || '').replace(/\\s+/g,' ').trim();
  return { vw, scrollW: de.scrollWidth, overflowBy: Math.max(0, de.scrollWidth - vw), chars: txt.length, overflowing: overflowing.slice(0, 4) };
})()`

const results = []
for (const w of WIDTHS) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 })
  for (const [group, routes] of Object.entries(ROUTES)) {
    const storage = authSets[group]
    await goto(APP + '/')
    await evalJs(`(()=>{try{localStorage.clear();${Object.entries(storage).filter(([, v]) => v).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)})`).join(';')}}catch(e){}})()`)
    for (const route of routes) {
      await goto(APP + route, 1600)
      const m = await evalJs(MEASURE)
      const bad = m.overflowBy > 2 || m.chars < 60
      results.push({ w, group, route, ...m, bad })
      console.log(`${bad ? 'FAIL' : ' ok '} ${String(w).padStart(4)} ${group.padEnd(8)} ${route.padEnd(28)} scrollW=${m.scrollW} over=${m.overflowBy} chars=${m.chars}${m.overflowing.length ? ' | ' + m.overflowing.join(' ; ') : ''}`)
    }
  }
}
const bad = results.filter((r) => r.bad)
console.log(`\n==== RESPONSIVE: ${results.length - bad.length}/${results.length} clean ====`)
if (bad.length) console.log(bad.map((b) => `  FAIL ${b.w}px ${b.group} ${b.route} over=${b.overflowBy} chars=${b.chars} ${b.overflowing.join(';')}`).join('\n'))
writeFileSync(path.join(ROOT, '.freebuff', 'responsive-sweep.json'), JSON.stringify(results, null, 2))
console.log('saved .freebuff/responsive-sweep.json')
ws.close(); chrome.kill()
try { process.kill(apiProc.pid, 'SIGKILL') } catch {}
process.exit(bad.length ? 1 : 0)