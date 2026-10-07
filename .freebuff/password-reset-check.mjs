import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = '5064'
const API = `http://127.0.0.1:${PORT}/api`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const raw of readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8').split(/\r?\n/)) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue
  const i = l.indexOf('='); if (i < 1) continue
  let v = l.slice(i + 1).trim(); if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1)
  process.env[l.slice(0, i).trim()] = v
}

const OWNER_EMAIL = 'halifashuaibu12@gmail.com'
const require = createRequire(path.join(ROOT, 'backend', 'package.json'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Per-group spoofed X-Forwarded-For so each scenario gets its own
// express-rate-limit bucket (app trusts the first XFF hop).
const IP = { customer: '10.10.0.1', barber: '10.10.0.2', admin: '10.10.0.3', unknown: '10.10.0.4' }

const up = async () => { try { return (await fetch(`http://127.0.0.1:${PORT}/health`)).ok } catch { return false } }

let apiProc = null
if (await up()) {
  console.log(`API already up on :${PORT} — reusing\n`)
} else {
  apiProc = spawn(process.execPath, [path.join(ROOT, 'backend', 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], {
    cwd: path.join(ROOT, 'backend'),
    env: { ...process.env, PORT },
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  for (let i = 0; i < 120; i++) { if (await up()) break; await sleep(500) }
  if (!(await up())) { console.log('API failed to start'); process.exit(1) }
  console.log('API up\n')
}

if (!process.env.RESEND_API_KEY) {
  console.log('RESEND_API_KEY missing from backend/.env — cannot extract codes from real emails')
  if (apiProc) apiProc.kill()
  process.exit(1)
}

let pass = 0, fail = 0
const check = (n, ok, d = '') => { ok ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + ' :: ' + d)) }

async function req(group, p, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': IP[group] }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, raw: text }
}

// ── Resend email helpers ───────────────────────────────────────────────────
async function resendList() {
  const r = await fetch('https://api.resend.com/emails?limit=40', {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  if (!r.ok) return []
  const j = await r.json().catch(() => ({}))
  return j?.data ?? []
}

async function resendGet(id) {
  const r = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  if (!r.ok) return null
  return (await r.json().catch(() => ({})))?.data ?? null
}

const mailTo = (e) => (e.to ?? []).map((t) => (typeof t === 'string' ? t : t?.email ?? '')).join(',')

/** Polls Resend for the newest email to OWNER_EMAIL created after `since`. */
async function waitForEmail(subjectContains, since) {
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    const list = await resendList()
    const cands = list
      .filter((e) => new Date(e.created_at).getTime() >= since && mailTo(e).includes(OWNER_EMAIL) && (e.subject ?? '').includes(subjectContains))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (cands.length) return await resendGet(cands[0].id)
  }
  return null
}

const codeFromEmail = (email, fromSubject = false) => {
  if (!email) return null
  const hay = fromSubject ? email.subject : email.text ?? email.html ?? ''
  const m = hay.match(/\b(\d{6})\b/)
  return m ? m[1] : null
}

// Assert no code ever appears in an API response (request/verify/reset).
async function assertNoCode(group, pathname, payload, since, opts = {}) {
  const r = await req(group, pathname, { method: 'POST', body: payload, ...opts })
  if (r.body && typeof r.body === 'object' && r.body.data && typeof r.body.data === 'object' && 'devCode' in r.body.data) {
    check(`no devCode in ${pathname}`, false, 'data.devCode present')
  }
  return r
}

const noCodeIn = (r, code) => !JSON.stringify(r.body ?? {}).includes(code)

// ── Fixtures ───────────────────────────────────────────────────────────────
const stamp = String(Date.now())
const CUST_PHONE = `091${String(Date.now()).slice(-8)}`
const CUST_PASS_OLD = 'OldCustPass123!'
const CUST_PASS_NEW = 'NewCustPass456!'
const BARBER_PASS_OLD = 'OldBarberPass123!'
const BARBER_PASS_NEW = 'NewBarberPass456!'
const ADMIN_PASS_OLD = 'OldAdminPass123!'
const ADMIN_PASS_NEW = 'NewAdminPass456!'

let barberId = null
let adminId = null

try {
  // Customer (real API registration so the token & mix of fields are genuine).
  const reg = await req('customer', '/account/register', {
    method: 'POST',
    body: { fullName: 'OTP QA Customer', phone: CUST_PHONE, email: OWNER_EMAIL, password: CUST_PASS_OLD },
  })
  check('customer registered', reg.status === 201 || reg.status === 200, `${reg.status} ${reg.body?.message}`)

  const custLogin = await req('customer', '/account/login', {
    method: 'POST',
    body: { phone: CUST_PHONE, password: CUST_PASS_OLD },
  })
  check('customer initial login (old password)', custLogin.status === 200, `${custLogin.status} ${custLogin.body?.message}`)

  // Barber fixture (direct DB — a barber keyed by phone + password like prod).
  const barber = await prisma.barber.create({
    data: {
      name: 'OTP QA Barber', slug: `qa-otp-${stamp}`, email: OWNER_EMAIL,
      phone: '08099110022', barberType: 'INTERNAL', isActive: true, portalEnabled: true,
      passwordHash: await (await import('bcryptjs')).hash(BARBER_PASS_OLD, 12),
    },
  })
  barberId = barber.id
  const byEmail = await prisma.barber.findFirst({ where: { email: OWNER_EMAIL } })
  check('barber fixture is the one keyed by owner email', byEmail?.id === barberId, `matched ${byEmail?.slug}`)

  // Admin fixture (direct DB, distinct from the seed admin).
  const admin = await prisma.admin.create({
    data: {
      name: 'OTP QA Admin', email: OWNER_EMAIL, role: 'ADMIN', isActive: true,
      password: await (await import('bcryptjs')).hash(ADMIN_PASS_OLD, 12),
    },
  })
  adminId = admin.id

  // ── ANTI-ENUMERATION ─────────────────────────────────────────────────────
  {
    const r = await req('unknown', '/auth/forgot-password/request', {
      method: 'POST', body: { email: 'does-not-exist@example.com', target: 'ADMIN' },
    })
    check('request for unknown email is generic 200 (no 404, no code)', r.status === 200 && (!JSON.stringify(r.body).includes('dev')), `${r.status}`)
  }

  // ── CUSTOMER — forgot password (email extraction, wrong code, single use) ─
  {
    const since = Date.now()
    const rq = await req('customer', '/auth/forgot-password/request', {
      method: 'POST', body: { email: OWNER_EMAIL, target: 'CUSTOMER' },
    })
    check('customer request reset code 200, empty data', rq.status === 200 && JSON.stringify(rq.body?.data) === '{}', `${rq.status} ${JSON.stringify(rq.body)}`)

    const mail = await waitForEmail('Password Reset', since)
    const code = codeFromEmail(mail)
    check('customer reset code delivered by real email', Boolean(mail && code), code ? '' : (mail ? 'email found but no code' : 'no email from Resend'))

    if (code) check('request response contains no code', noCodeIn(rq, code))

    const wrong = await req('customer', '/auth/forgot-password/verify', {
      method: 'POST', body: { email: OWNER_EMAIL, code: '000000', target: 'CUSTOMER' },
    })
    check('wrong code rejected', wrong.status === 422, `${wrong.status}`)

    const ok = await req('customer', '/auth/forgot-password/verify', {
      method: 'POST', body: { email: OWNER_EMAIL, code, target: 'CUSTOMER' },
    })
    const resetToken = ok.body?.data?.resetToken
    check('verify returns a reset token', ok.status === 200 && typeof resetToken === 'string' && resetToken.length > 0, `${ok.status} ${JSON.stringify(ok.body)}`)
    if (code) check('verify response contains no code', noCodeIn(ok, code))

    const reused = await req('customer', '/auth/forgot-password/verify', {
      method: 'POST', body: { email: OWNER_EMAIL, code, target: 'CUSTOMER' },
    })
    check('code is single-use (re-verify rejected)', reused.status === 422, `${reused.status}`)

    const reset = await req('customer', '/auth/forgot-password/reset', {
      method: 'POST', body: { email: OWNER_EMAIL, resetToken, newPassword: CUST_PASS_NEW, target: 'CUSTOMER' },
    })
    check('customer reset password 200', reset.status === 200, `${reset.status} ${reset.body?.message}`)

    const relog = await req('customer', '/account/login', {
      method: 'POST', body: { phone: CUST_PHONE, password: CUST_PASS_NEW },
    })
    check('customer logs in with the new password', relog.status === 200, `${relog.status} ${relog.body?.message}`)

    // Attempts cap: request a fresh code, burn it to the cap threshold via DB.
    const aSince = Date.now()
    await req('customer', '/auth/forgot-password/request', {
      method: 'POST', body: { email: OWNER_EMAIL, target: 'CUSTOMER' },
    })
    const aMail = await waitForEmail('Password Reset', aSince)
    const aCode = codeFromEmail(aMail)
    const last = await prisma.passwordResetOtp.findFirst({
      where: { email: OWNER_EMAIL, target: 'CUSTOMER', consumedAt: null }, orderBy: { createdAt: 'desc' },
    })
    await prisma.passwordResetOtp.update({ where: { id: last.id }, data: { attempts: 4 } })
    const w1 = await req('customer', '/auth/forgot-password/verify', {
      method: 'POST', body: { email: OWNER_EMAIL, code: aCode === '000000' ? '111111' : '000000', target: 'CUSTOMER' },
    })
    const w2 = await req('customer', '/auth/forgot-password/verify', {
      method: 'POST', body: { email: OWNER_EMAIL, code: aCode === '000000' ? '111111' : '000000', target: 'CUSTOMER' },
    })
    check('attempts capped (5th failure locked)', w1.status === 422 && /attempts/i.test(w2.body?.message ?? ''), `w1=${w1.status} w2=${w2.status} ${(w2.body?.message ?? '').toString().slice(0, 80)}`)

    // Bad reset token rejected.
    const badReset = await req('customer', '/auth/forgot-password/reset', {
      method: 'POST', body: { email: OWNER_EMAIL, resetToken: 'garbage-token', newPassword: CUST_PASS_NEW, target: 'CUSTOMER' },
    })
    check('reset rejects a forged token', badReset.status === 422, `${badReset.status}`)
  }

  // ── CUSTOMER — phone-OTP login (delivered by email) + resend cooldown ────
  {
    const since = Date.now()
    const o1 = await req('customer', '/account/otp/request', { method: 'POST', body: { phone: CUST_PHONE } })
    check('customer phone-OTP request 200', o1.status === 200 && o1.body?.data?.found === true, `${o1.status} ${JSON.stringify(o1.body)}`)

    const o2 = await req('customer', '/account/otp/request', { method: 'POST', body: { phone: CUST_PHONE } })
    check('phone-OTP resend within 60s is blocked (429)', o2.status === 429, `${o2.status} ${o2.body?.message}`)

    const mail = await waitForEmail('is your SAWABA login code', since)
    const code = codeFromEmail(mail, true)
    check('login OTP delivered by real email (code from subject)', Boolean(mail && code), code ? '' : 'no email')

    const ov = await req('customer', '/account/otp/verify', { method: 'POST', body: { phone: CUST_PHONE, code } })
    check('phone-OTP verify logs customer in', ov.status === 200 && Boolean(ov.body?.data?.token), `${ov.status} ${(ov.body?.message ?? '').toString().slice(0, 80)}`)
    check('otp responses contain no code', noCodeIn(o1, code) && noCodeIn(o2, code) && noCodeIn(ov, code))
  }

  // ── BARBER — forgot password (dedicated router) + duplicate-request cooldown
  {
    const since = Date.now()
    const r1 = await req('barber', '/barber/auth/forgot-password/request', { method: 'POST', body: { email: OWNER_EMAIL } })
    check('barber request reset code 200', r1.status === 200, `${r1.status} ${JSON.stringify(r1.body)}`)

    const r2 = await req('barber', '/barber/auth/forgot-password/request', { method: 'POST', body: { email: OWNER_EMAIL } })
    check('barber resend within 60s is blocked (429)', r2.status === 429, `${r2.status} ${r2.body?.message}`)

    const mail = await waitForEmail('Password Reset', since)
    const code = codeFromEmail(mail)
    check('barber reset code delivered by real email', Boolean(mail && code), code ? '' : 'no email')

    const v = await req('barber', '/barber/auth/forgot-password/verify', { method: 'POST', body: { email: OWNER_EMAIL, code } })
    const resetToken = v.body?.data?.resetToken
    check('barber verify returns reset token', v.status === 200 && typeof resetToken === 'string', `${v.status} ${JSON.stringify(v.body)}`)

    const rs = await req('barber', '/barber/auth/forgot-password/reset', { method: 'POST', body: { email: OWNER_EMAIL, resetToken, newPassword: BARBER_PASS_NEW } })
    check('barber reset password 200', rs.status === 200, `${rs.status} ${rs.body?.message}`)

    const bl = await req('barber', '/barber/auth/login', { method: 'POST', body: { identifier: OWNER_EMAIL, password: BARBER_PASS_NEW } })
    check('barber logs in with new password', bl.status === 200 && Boolean(bl.body?.data?.token), `${bl.status} ${bl.body?.message}`)
  }

  // ── ADMIN — full forgot-password lifecycle ───────────────────────────────
  {
    const since = Date.now()
    const r = await req('admin', '/auth/forgot-password/request', { method: 'POST', body: { email: OWNER_EMAIL, target: 'ADMIN' } })
    check('admin request reset code 200', r.status === 200, `${r.status} ${JSON.stringify(r.body)}`)

    const mail = await waitForEmail('Password Reset', since)
    const code = codeFromEmail(mail)
    check('admin reset code delivered by real email', Boolean(mail && code), code ? '' : 'no email')

    const v = await req('admin', '/auth/forgot-password/verify', { method: 'POST', body: { email: OWNER_EMAIL, code, target: 'ADMIN' } })
    const resetToken = v.body?.data?.resetToken
    check('admin verify returns reset token', v.status === 200 && typeof resetToken === 'string', `${v.status} ${JSON.stringify(v.body)}`)

    const rs = await req('admin', '/auth/forgot-password/reset', { method: 'POST', body: { email: OWNER_EMAIL, resetToken, newPassword: ADMIN_PASS_NEW, target: 'ADMIN' } })
    check('admin reset password 200', rs.status === 200, `${rs.status} ${rs.body?.message}`)

    const al = await req('admin', '/auth/login', { method: 'POST', body: { email: OWNER_EMAIL, password: ADMIN_PASS_NEW } })
    check('admin logs in with new password', al.status === 200 && Boolean(al.body?.data?.token), `${al.status} ${al.body?.message}`)
  }
} catch (err) {
  console.log('HARNESS ERROR', err)
  fail++
} finally {
  if (barberId) await prisma.barber.delete({ where: { id: barberId } }).catch(() => {})
  if (adminId) await prisma.admin.delete({ where: { id: adminId } }).catch(() => {})
  await prisma.customer.deleteMany({ where: { phone: CUST_PHONE } }).catch(() => {})
  await prisma.passwordResetOtp.deleteMany({ where: { email: OWNER_EMAIL } }).catch(() => {})
  await prisma.customerOtp.deleteMany({ where: { phone: CUST_PHONE } }).catch(() => {})
  await prisma.$disconnect().catch(() => {})
}

if (apiProc) { apiProc.kill(); console.log('\n(throwaway API stopped)') }
console.log(`\nRESULT ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)