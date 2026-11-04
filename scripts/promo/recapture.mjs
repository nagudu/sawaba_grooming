import { execSync } from 'node:child_process'
import { existsSync, statSync, mkdirSync } from 'node:fs'
import path from 'node:path'

/** Re-captures authenticated pages with a verified token injection, plus a recording. */

const APP = 'http://localhost:5173'
const API = 'http://localhost:5000'
const SESSION = 'promo2'
mkdirSync(path.resolve('promo/clips'), { recursive: true })

const FFMPEG_DIR = path.resolve('node_modules/ffmpeg-static')
const ENV = { ...process.env, PATH: `${FFMPEG_DIR};${process.env.PATH}` }

function ab(cmd) {
  try {
    return execSync(`agent-browser --session ${SESSION} ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: ENV })
  } catch (error) {
    console.log(`[warn] ${cmd.slice(0, 60)} :: ${`${error.stdout ?? ''}${error.stderr ?? ''}`.trim().slice(0, 200)}`)
    return ''
  }
}

function go(urlPath, settle = 2200) {
  ab(`open "${APP}${urlPath}"`)
  ab('wait --load load')
  ab(`wait ${settle}`)
}

function shot(name) {
  ab(`screenshot promo/shots/${name}.png`)
  console.log(`shot ${name}`)
}

function shotFull(name) {
  ab(`screenshot --full promo/marketing/screens-full/${name}.png`)
  console.log(`full ${name}`)
}

function setToken(key, token) {
  go('/', 1200)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    ab(`eval "localStorage.setItem('${key}','${token}')"`)
    ab('wait 300')
    const value = ab(`eval "localStorage.getItem('${key}')"`).replace(/"/g, '').trim()
    if (value.length > 10) return
    ab('wait 800')
  }
  throw new Error(`Could not persist ${key}`)
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

  ab('close')
  ab('set viewport 1920 1080 1')

  setToken('sawaba_customer_token', customer)
  setToken('sawaba_shop_cart_token', cart.token)
  go('/account', 2400); shot('11-customer-dashboard')
  go('/account/orders', 2400); shot('12-my-orders'); shotFull('my-orders')
  go('/account/orders/SGS-PROMO1', 2400); shot('13-order-detail')
  go('/account/bookings', 2000); shot('14-my-bookings')
  go('/account/payments', 2000); shot('37-customer-payments')
  go('/shop/cart', 2000); shot('08-cart')
  go('/shop/checkout', 2200); shot('09-checkout')

  setToken('sawaba_admin_token', admin)
  go('/admin', 2400); shot('15-admin-dashboard'); shotFull('admin-dashboard')
  go('/admin/appointments', 2200); shot('16-admin-appointments')
  go('/admin/barbers', 2000); shot('17-admin-barbers')
  go('/admin/services', 2000); shot('18-admin-services')
  go('/admin/customers', 2000); shot('19-admin-customers')
  go('/admin/shop-payments', 2200); shot('35-admin-shop-payments')
  go('/admin/marketplace', 2600); shot('20-admin-marketplace'); shotFull('admin-marketplace')
  go('/admin/withdrawals', 2000); shot('21-admin-withdrawals')
  go('/admin/pickup', 2000); shot('22-admin-pickup')
  go('/admin/reviews', 1800); shot('23-admin-reviews')

  setToken('barber_token', barber)
  go('/barber', 2400); shot('24-barber-dashboard'); shotFull('barber-dashboard')
  go('/barber/appointments', 2200); shot('25-barber-appointments')

  setToken('sawaba_vendor_token', vendor)
  go('/vendor', 2400); shot('26-vendor-dashboard')
  go('/vendor/products', 2400); shot('27-vendor-products'); shotFull('vendor-products')
  go('/vendor/orders', 2200); shot('28-vendor-orders')
  go('/vendor/earnings', 2400); shot('29-vendor-wallet'); shotFull('vendor-wallet')
  go('/vendor/settings', 2000); shot('30-vendor-settings')

  ab('set viewport 390 844 3')
  go('/shop', 2400); shot('31-mobile-shop')
  go('/shop/professional-cordless-hair-clipper', 2200); shot('32-mobile-product')
  go('/account/orders', 2200); shot('33-mobile-orders')
  go('/track', 1800); shot('34-mobile-track')

  // ── Recording (MP4 / H.264, 1x scale to keep the encoder real-time) ──
  ab('set viewport 1440 900 1')
  go('/', 1500)
  ab('record start promo/clips/storefront.mp4 --fps 24 --cursor')
  ab('wait 1500')
  ab('scroll down 900'); ab('wait 1300')
  ab('scroll up 900'); ab('wait 900')
  go('/shop', 2200)
  ab('wait 1400')
  ab('scroll down 700'); ab('wait 1400')
  go('/shop/professional-cordless-hair-clipper', 2400)
  ab('wait 1600')
  ab('scroll down 500'); ab('wait 1400')
  ab('record stop')
  ab('close')

  const file = path.resolve('promo/clips/storefront.mp4')
  console.log('recording exists:', existsSync(file), existsSync(file) ? `${(statSync(file).size / 1024).toFixed(0)} KB` : '')
  console.log('done')
}

main().catch((error) => {
  console.error('[recapture] failed:', error)
  process.exitCode = 1
})
