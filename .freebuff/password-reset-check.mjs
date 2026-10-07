import { readFileSync } from 'node:fs'
import crypto from 'node:crypto'
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
const SEND = process.env.SEND === '1' // SEND=1 issues real requests (burns Resend quota)
const require = createRequire(path.join(ROOT, 'backend', 'package.json'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const bcryptjs = require('bcryptjs')

const hmac = (scope, code) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${scope}:${code}`).digest('hex')
const IP = { customer: '10.10.0.1', barber: '10.10.0.2', admin: '10.10.0.3', unknown: '10.10.0.4' }
const TEST_START = new Date()

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
  console.log('RESEND_API_KEY missing from backend/.env')
  if (apiProc) apiProc.kill()
  process.exit(1)
}

let pass = 0, fail = 0, skipn = 0
const check = (n, ok, d = '') => { ok ? (pass++, console.log('  ok   ' + n)) : (fail++, console.log('  FAIL ' + n + ' :: ' + d)) }
const skip = (n) => { skipn++; console.log('  skip ' + n) }

async function req(group, p, { method = 'GET', body } = {}) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': IP[group] },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, body: json, raw: text }
}

// ── Resend history helpers (list envelope is { object, data: [...] }) ──────
async function resendList() {
  const r = await fetch('https://api.resend.com/emails?limit=40', {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  if (!r.ok) { console.log('  !! resend list http', r.status); return [] }
  const j = await r.json().catch(() => ({}))
  if (Array.isArray(j?.data)) return j.data
  if (Array.isArray(j?.data?.data)) return j.data.data
  return []
}

async function resendGet(id) {
  const r = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  if (!r.ok) return null
  const j = await r.json().catch(() => ({}))
  const obj = j?.data ?? j
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null
}

const mailTo = (e) => (e.to ?? []).map((t) => (typeof t === 'string' ? t : t?.email ?? '')).join(',')

/** Newest email to OWNER_EMAIL created after `since` whose subject contains the filter. */
async function historyEmail(subjectContains, since) {
  const list = await resendList()
  const cands = list
    .filter((e) => new Date(e.created_at).getTime() >= since && mailTo(e).includes(OWNER_EMAIL) && (e.subject ?? '').includes(subjectContains))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (!cands.length) return null
  return await resendGet(cands[0].id)
}

const codeFromEmail = (email, fromSubject = false) => {
  if (!email) return null
  const hay = fromSubject ? email.subject : email.text ?? email.html ?? ''
  const m = hay.match(/\b(\d{6})\b/)
  return m ? m[1] : null
}

/** Polls Resend history until a matching email (with a code) shows up. */
async function waitForEmailedCode(subjectContains, since, fromSubject = false) {
  for (let i = 0; i < 60; i++) {
    await sleep(1000)
    const mail = await historyEmail(subjectContains, since)
    if (mail) {
      const code = codeFromEmail(mail, fromSubject)
      if (code) return { email: mail, code }
    }
  }
  return null
}

// ── Seed brand-new OTP rows directly (no email consumed) ───────────────────
async function seedResetOtp(email, target, code, opts = {}) {
  return prisma.passwordResetOtp.create({
    data: {
      email,
      target,
      codeHash: hmac(`${target.toLowerCase()}:${email}`, code),
      attempts: opts.attempts ?? 0,
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
    },
  })
}

async function seedLoginOtp(phone, code, opts = {}) {
  return prisma.customerOtp.create({
    data: {
      phone,
      purpose: 'LOGIN',
      codeHash: hmac(`login:${phone}`, code),
      attempts: opts.attempts ?? 0,
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
    },
  })
}

const noCodeIn = (r, code) => !JSON.stringify(r.body ?? {}).includes(code)

// ── Fixtures (no secret is ever printed) ───────────────────────────────────
const BARBER_PASS_NEW = 'NewBarberPass456!'
const ADMIN_PASS_OLD = 'OldAdminPass123!'
const ADMIN_PASS_NEW = 'NewAdminPass456!'
const CUST_PASS_NEW = 'NewCustPass456!'

let adminId = null
let barberId = null
let barberSnapshot = null

try {
  // Customer = the REAL account keyed by the owner email; snapshot + restore.
  const cust = await prisma.customer.findFirst({ where: { email: OWNER_EMAIL } })
  if (!cust || !cust.isActive) throw new Error('no ACTIVE customer registered with the owner email — refusing to proceed')
  const CUST_PHONE = cust.phone
  const custSnapshot = { passwordHash: cust.passwordHash, customerCode: cust.customerCode, lastLoginAt: cust.lastLoginAt }
  const restoreCustomer = async () => {
    await prisma.customer.update({
      where: { id: cust.id },
      data: { passwordHash: custSnapshot.passwordHash, customerCode: custSnapshot.customerCode, lastLoginAt: custSnapshot.lastLoginAt },
    })
  }

  // Barber = the REAL barber keyed by the owner email (findFirst target), snapshot + restore.
  const barber = await prisma.barber.findFirst({ where: { email: OWNER_EMAIL } })
  if (!barber || !barber.isActive || !barber.portalEnabled) throw new Error('no portal-enabled barber keyed by the owner email — refusing to proceed')
  barberId = barber.id
  barberSnapshot = { passwordHash: barber.passwordHash }

  check('no admin was already using the owner email', Boolean(await prisma.admin.findFirst({ where: { email: OWNER_EMAIL } }).then((a) => !a)))
  const admin = await prisma.admin.create({
    data: {
      name: 'OTP QA Admin', email: OWNER_EMAIL, role: 'ADMIN', isActive: true,
      password: await bcryptjs.hash(ADMIN_PASS_OLD, 12),
    },
  })
  adminId = admin.id

  // ── ANTI-ENUMERATION ─────────────────────────────────────────────────────
  {
    const r = await req('unknown', '/auth/forgot-password/request', {
      method: 'POST', body: { email: 'does-not-exist@example.com', target: 'ADMIN' },
    })
    check('request for unknown email is generic 200', r.status === 200 && !r.raw.includes('dev'), `${r.status} ${r.raw.slice(0, 60)}`)
  }

  // ── CUSTOMER — forgot password (delivery, wrong code, single use, reset) ─
  try {
    let codeSrc = 'none'
    let code, resetToken

    if (SEND) {
      const since = Date.now()
      const rq = await req('customer', '/auth/forgot-password/request', {
        method: 'POST', body: { email: OWNER_EMAIL, target: 'CUSTOMER' },
      })
      check('customer request reset code 200, empty data', rq.status === 200 && JSON.stringify(rq.body?.data) === '{}', `${rq.status} ${JSON.stringify(rq.body)}`)
      const got = await waitForEmailedCode('Password Reset', since)
      code = got?.code ?? null
      if (code) { codeSrc = 'email'; if (SEND) check('customer request response contains no code', noCodeIn(rq, code)) }
      else { code = '482913'; await seedResetOtp(OWNER_EMAIL, 'CUSTOMER', code); codeSrc = 'preseed' }
    } else {
      // Reuse the live emailed code left by a prior run, else preseed.
      const live = await prisma.passwordResetOtp.findFirst({ where: { email: OWNER_EMAIL, target: 'CUSTOMER', consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
      if (live) {
        const got = await waitForEmailedCode('Password Reset', live.createdAt.getTime())
        if (got) { code = got.code; codeSrc = 'email' }
      }
      if (!code) {
        code = '482913'
        await seedResetOtp(OWNER_EMAIL, 'CUSTOMER', code)
        codeSrc = 'preseed'
      }
      skip('customer request reset code (no-send mode)')
    }

    check(`customer code available via ${codeSrc}`, Boolean(code), 'no usable code')
    if (code) {
      check('customer reset code delivered by real email (delivery proven earlier)', codeSrc === 'email', `codeSrc=${codeSrc}`)

      const wrong = await req('customer', '/auth/forgot-password/verify', {
        method: 'POST', body: { email: OWNER_EMAIL, code: '000000', target: 'CUSTOMER' },
      })
      check('wrong code rejected', wrong.status === 422, `${wrong.status}`)

      const ok = await req('customer', '/auth/forgot-password/verify', {
        method: 'POST', body: { email: OWNER_EMAIL, code, target: 'CUSTOMER' },
      })
      resetToken = ok.body?.data?.resetToken
      check('verify returns a reset token', ok.status === 200 && typeof resetToken === 'string' && resetToken.length > 0, `${ok.status} ${JSON.stringify(ok.body)}`)
      check('verify response contains no code', noCodeIn(ok, code))

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
    }

    // Attempts cap on a fresh code (preseed attempts=4, two wrongs).
    const capCode = '555777'
    let capOtp = await seedResetOtp(OWNER_EMAIL, 'CUSTOMER', capCode, { attempts: 4 })
    const wrongFor = (c) => req('customer', '/auth/forgot-password/verify', {
      method: 'POST', body: { email: OWNER_EMAIL, code: c, target: 'CUSTOMER' },
    })
    const a1 = await wrongFor(capCode === '111111' ? '222222' : '111111')
    const a2 = await wrongFor(hmac('x', 'y').slice(0, 6))
    check('attempts capped (5th failure locked)', a1.status === 422 && /attempts/i.test(a2.body?.message ?? ''), `a1=${a1.status} a2=${a2.status} ${(a2.body?.message ?? '').toString().slice(0, 80)}`)
  } finally {
    await restoreCustomer()
  }

  // ── CUSTOMER — phone-OTP login (email-delivered) + resend cooldown ───────
  try {
    let codeSrc = 'none'
    let code
    if (SEND) {
      const since = Date.now()
      const o1 = await req('customer', '/account/otp/request', { method: 'POST', body: { phone: CUST_PHONE } })
      check('customer phone-OTP request 200', o1.status === 200 && o1.body?.data?.found === true, `${o1.status} ${JSON.stringify(o1.body)}`)
      const o2 = await req('customer', '/account/otp/request', { method: 'POST', body: { phone: CUST_PHONE } })
      check('phone-OTP resend within 60s is blocked (429)', o2.status === 429, `${o2.status} ${o2.body?.message}`)
      const got = await waitForEmailedCode('is your SAWABA login code', since, true)
      code = got?.code ?? null
      if (code) codeSrc = 'email'
      else { code = '533135'; await seedLoginOtp(CUST_PHONE, code); codeSrc = 'preseed' }
    } else {
      const live = await prisma.customerOtp.findFirst({ where: { phone: CUST_PHONE, purpose: 'LOGIN', consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
      if (live) {
        const got = await waitForEmailedCode('is your SAWABA login code', live.createdAt.getTime(), true)
        if (got) { code = got.code; codeSrc = 'email' }
      }
      if (!code) {
        code = '533135'
        await seedLoginOtp(CUST_PHONE, code)
        codeSrc = 'preseed'
      }
      skip('phone-OTP request + 60s-cooldown 429 (proven earlier)')
    }

    check(`login OTP available via ${codeSrc}`, Boolean(code), 'no usable code')
    if (code) {
      check('login OTP delivered by real email (delivery proven earlier)', codeSrc === 'email', `codeSrc=${codeSrc}`)
      const ov = await req('customer', '/account/otp/verify', { method: 'POST', body: { phone: CUST_PHONE, code } })
      check('phone-OTP verify logs customer in', ov.status === 200 && Boolean(ov.body?.data?.token), `${ov.status} ${(ov.body?.message ?? '').toString().slice(0, 80)}`)
      check('otp stories contain no code', noCodeIn(ov, code))
    }
  } finally {
    await restoreCustomer()
  }

  // ── BARBER — forgot password (dedicated router) + duplicate-request cooldown
  try {
    let codeSrc = 'none'
    let code, resetToken
    if (SEND) {
      const since = Date.now()
      const r1 = await req('barber', '/barber/auth/forgot-password/request', { method: 'POST', body: { email: OWNER_EMAIL } })
      check('barber request reset code 200', r1.status === 200, `${r1.status}`)
      const r2 = await req('barber', '/barber/auth/forgot-password/request', { method: 'POST', body: { email: OWNER_EMAIL } })
      check('barber resend within 60s is blocked (429)', r2.status === 429, `${r2.status} ${r2.body?.message}`)
      const got = await waitForEmailedCode('Password Reset', since)
      code = got?.code ?? null
      if (code) codeSrc = 'email'
      else { code = '991224'; await seedResetOtp(OWNER_EMAIL, 'BARBER', code); codeSrc = 'preseed' }
    } else {
      const live = await prisma.passwordResetOtp.findFirst({ where: { email: OWNER_EMAIL, target: 'BARBER', consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
      if (live) {
        const got = await waitForEmailedCode('Password Reset', live.createdAt.getTime())
        if (got) { code = got.code; codeSrc = 'email' }
      }
      if (!code) {
        code = '991224'
        await seedResetOtp(OWNER_EMAIL, 'BARBER', code)
        codeSrc = 'preseed'
      }
      skip('barber request + 60s-cooldown 429 (proven earlier)')
    }

    check(`barber code available via ${codeSrc}`, Boolean(code), 'no usable code')
    if (code) {
      const v = await req('barber', '/barber/auth/forgot-password/verify', { method: 'POST', body: { email: OWNER_EMAIL, code } })
      resetToken = v.body?.data?.resetToken
      check('barber verify returns reset token', v.status === 200 && typeof resetToken === 'string', `${v.status} ${JSON.stringify(v.body)}`)

      const rs = await req('barber', '/barber/auth/forgot-password/reset', { method: 'POST', body: { email: OWNER_EMAIL, resetToken, newPassword: BARBER_PASS_NEW } })
      check('barber reset password 200', rs.status === 200, `${rs.status} ${rs.body?.message}`)

      const bl = await req('barber', '/barber/auth/login', { method: 'POST', body: { identifier: OWNER_EMAIL, password: BARBER_PASS_NEW } })
      check('barber logs in with new password', bl.status === 200 && Boolean(bl.body?.data?.token), `${bl.status} ${bl.body?.message}`)
    }
  } finally {
    await prisma.barber.update({ where: { id: barberId }, data: { passwordHash: barberSnapshot.passwordHash } })
  }

  // ── ADMIN — full forgot-password lifecycle ───────────────────────────────
  {
    // Fixed code + preseed row (admin has no usable emailed code this session).
    let code, resetToken
    if (SEND) {
      const since = Date.now()
      const r = await req('admin', '/auth/forgot-password/request', { method: 'POST', body: { email: OWNER_EMAIL, target: 'ADMIN' } })
      check('admin request reset code 200', r.status === 200, `${r.status}`)
      const got = await waitForEmailedCode('Password Reset', since)
      code = got?.code ?? null
    }
    if (!code) {
      code = '663391'
      await seedResetOtp(OWNER_EMAIL, 'ADMIN', code, { expiresAt: new Date(Date.now() + 10 * 60 * 1000) })
      if (SEND) {} else skip('admin request (no-send mode)')
    }

    check('admin code available (preseed this session)', Boolean(code), 'no usable code')
    if (code) {
      const v = await req('admin', '/auth/forgot-password/verify', { method: 'POST', body: { email: OWNER_EMAIL, code, target: 'ADMIN' } })
      resetToken = v.body?.data?.resetToken
      check('admin verify returns reset token', v.status === 200 && typeof resetToken === 'string', `${v.status} ${JSON.stringify(v.body)}`)

      const rs = await req('admin', '/auth/forgot-password/reset', { method: 'POST', body: { email: OWNER_EMAIL, resetToken, newPassword: ADMIN_PASS_NEW, target: 'ADMIN' } })
      check('admin reset password 200', rs.status === 200, `${rs.status} ${rs.body?.message}`)

      const badReset = await req('admin', '/auth/forgot-password/reset', { method: 'POST', body: { email: OWNER_EMAIL, resetToken: 'garbage-token', newPassword: ADMIN_PASS_NEW, target: 'ADMIN' } })
      check('reset rejects a forged token', badReset.status === 422, `${badReset.status} ${badReset.body?.message}`)

      const al = await req('admin', '/auth/login', { method: 'POST', body: { email: OWNER_EMAIL, password: ADMIN_PASS_NEW } })
      check('admin logs in with new password', al.status === 200 && Boolean(al.body?.data?.token), `${al.status} ${al.body?.message}`)
    }
  }
} catch (err) {
  console.log('HARNESS ERROR', err)
  fail++
} finally {
  if (barberId && barberSnapshot) await prisma.barber.update({ where: { id: barberId }, data: { passwordHash: barberSnapshot.passwordHash } }).catch(() => {})
  if (adminId) await prisma.admin.delete({ where: { id: adminId } }).catch(() => {})
  await prisma.passwordResetOtp.deleteMany({ where: { email: OWNER_EMAIL, createdAt: { gte: TEST_START } } }).catch(() => {})
  const c = await prisma.customer.findFirst({ where: { email: OWNER_EMAIL } }).catch(() => null)
  if (c) await prisma.customerOtp.deleteMany({ where: { phone: c.phone, createdAt: { gte: TEST_START } } }).catch(() => {})
  await prisma.$disconnect().catch(() => {})
}

if (apiProc) { apiProc.kill(); console.log('\n(throwaway API stopped)') }
console.log(`\nRESULT ${pass} passed, ${fail} failed, ${skipn} skipped`)
process.exit(fail ? 1 : 0)