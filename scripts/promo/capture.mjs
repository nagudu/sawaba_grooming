import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Captures the real Sawaba Grooming Studio UI for the promotional video.
 * Uses agent-browser, logging in by injecting the real JWTs into localStorage
 * (obtained from the live backend) so navigation is deterministic.
 */

const APP = 'http://localhost:5173'
const API = 'http://localhost:5000'
const SESSION = 'promo'
const SHOTS = path.resolve('promo/shots')
mkdirSync(SHOTS, { recursive: true })
mkdirSync(path.resolve('promo/clips'), { recursive: true })
mkdirSync(path.resolve('promo/audio'), { recursive: true })
mkdirSync(path.resolve('promo/marketing/screens-full'), { recursive: true })

const FFMPEG_DIR = path.resolve('node_modules/ffmpeg-static')
const ENV = { ...process.env, PATH: `${FFMPEG_DIR};${process.env.PATH}` }

function ab(cmd) {
  const line = `agent-browser --session ${SESSION} ${cmd}`
  try {
    return execSync(line, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: ENV })
  } catch (error) {
    const detail = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().slice(0, 300)
    console.log(`[warn] ${cmd.slice(0, 70)} :: ${detail}`)
    return ''
  }
}

function go(urlPath, settle = 1500) {
  ab(`open "${APP}${urlPath}"`)
  ab('wait --load load')
  ab(`wait ${settle}`)
}

function shot(name, full = false) {
  ab(`screenshot ${full ? '--full ' : ''}promo/shots/${name}.png`)
  console.log(`shot ${name}`)
}

function shotFull(name) {
  ab(`screenshot --full promo/marketing/screens-full/${name}.png`)
  console.log(`full ${name}`)
}

function login(key, token) {
  ab(`eval "localStorage.setItem('${key}','${token}')"`)
}

async function postJson(payloadPath, body) {
  const response = await fetch(`${API}${payloadPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.9.9.9' },
    body: JSON.stringify(body),
  })
  return (await response.json()).data
}

async function main() {
  const admin = (await postJson('/api/auth/login', { email: 'admin@sawabasalon.com', password: 'ChangeMe123!' })).token
  const customer = (await postJson('/api/account/login', { identifier: 'promo.customer@sawaba.test', password: 'PromoCustomer1!' })).token
  const vendor = (await postJson('/api/vendor/login', { identifier: 'promo.vendor@sawaba.test', password: 'PromoVendor1!' })).token
  const barber = (await postJson('/api/barber/auth/login', { identifier: 'promo.barber@sawaba.test', password: 'PromoBarber1!' })).token
  const cart = await postJson('/api/shop/cart/items', { productId: 26, quantity: 1 })

  console.log('tokens ready')

  ab('close')
  ab('set viewport 1920 1080 1')
  go('/')

  // ── Public storefront ─────────────────────────────────────────────
  shot('01-home')
  go('/services')
  shot('02-services')
  go('/barbers')
  shot('03-barbers')
  go('/book', 2200)
  shot('04-booking')
  go('/shop', 2200)
  shot('05-shop')
  go('/shop/professional-cordless-hair-clipper', 2000)
  shot('06-product')
  go('/shop/mg-7t-hair-trimmer', 2000)
  shot('07-product-2')
  login('sawaba_shop_cart_token', cart.token)
  go('/shop/cart', 1800)
  shot('08-cart')
  go('/shop/checkout', 2000)
  shot('09-checkout')
  go('/track', 1600)
  shot('10-track')

  // ── Customer ──────────────────────────────────────────────────────
  go('/', 500)
  login('sawaba_customer_token', customer)
  go('/account', 2200)
  shot('11-customer-dashboard')
  go('/account/orders', 2200)
  shot('12-my-orders')
  go('/account/orders/SGS-PROMO1', 2200)
  shot('13-order-detail')
  go('/account/bookings', 1800)
  shot('14-my-bookings')

  // ── Admin ─────────────────────────────────────────────────────────
  go('/', 500)
  login('sawaba_admin_token', admin)
  go('/admin', 2200)
  shot('15-admin-dashboard')
  go('/admin/appointments', 2000)
  shot('16-admin-appointments')
  go('/admin/barbers', 1800)
  shot('17-admin-barbers')
  go('/admin/services', 1800)
  shot('18-admin-services')
  go('/admin/customers', 1800)
  shot('19-admin-customers')
  go('/admin/marketplace', 2400)
  shot('20-admin-marketplace')
  go('/admin/withdrawals', 1800)
  shot('21-admin-withdrawals')
  go('/admin/pickup', 1800)
  shot('22-admin-pickup')
  go('/admin/reviews', 1600)
  shot('23-admin-reviews')

  // ── Barber portal ─────────────────────────────────────────────────
  go('/', 500)
  login('barber_token', barber)
  go('/barber', 2200)
  shot('24-barber-dashboard')
  go('/barber/appointments', 2000)
  shot('25-barber-appointments')

  // ── Vendor ────────────────────────────────────────────────────────
  go('/', 500)
  login('sawaba_vendor_token', vendor)
  go('/vendor', 2200)
  shot('26-vendor-dashboard')
  go('/vendor/products', 2200)
  shot('27-vendor-products')
  go('/vendor/orders', 2000)
  shot('28-vendor-orders')
  go('/vendor/earnings', 2200)
  shot('29-vendor-wallet')
  go('/vendor/settings', 1800)
  shot('30-vendor-settings')

  // ── Mobile ────────────────────────────────────────────────────────
  ab('set viewport 390 844 3')
  go('/shop', 2200)
  shot('31-mobile-shop')
  go('/shop/professional-cordless-hair-clipper', 2000)
  shot('32-mobile-product')
  go('/account/orders', 2000)
  shot('33-mobile-orders')
  go('/track', 1600)
  shot('34-mobile-track')

  ab('set viewport 1920 1080 1')

  // ── Full-page marketing screenshots (nothing cut off) ─────────────
  for (const [name, route] of [
    ['home', '/'],
    ['services', '/services'],
    ['barbers', '/barbers'],
    ['shop', '/shop'],
    ['product', '/shop/professional-cordless-hair-clipper'],
    ['gallery', '/gallery'],
  ]) {
    go(route, 2000)
    shotFull(name)
  }

  // ── Live recording: storefront browse ─────────────────────────────
  go('/', 1200)
  ab('record start promo/clips/storefront.mp4 --fps 24 --cursor')
  ab('wait 1200')
  ab('scroll down 900')
  ab('wait 1200')
  ab('scroll up 900')
  ab('wait 800')
  go('/shop', 1800)
  ab('wait 1200')
  ab('scroll down 700')
  ab('wait 1200')
  go('/shop/professional-cordless-hair-clipper', 2000)
  ab('wait 1500')
  ab('scroll down 500')
  ab('wait 1200')
  ab('record stop')
  console.log('recording storefront done')

  ab('close')
  console.log('capture complete')
}

main().catch((error) => {
  console.error('[capture] failed:', error)
  process.exitCode = 1
})
