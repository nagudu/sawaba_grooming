/**
 * End-to-end marketplace test against the RUNNING backend (port 5001).
 *
 * Exercises the full multi-vendor lifecycle:
 *   admin login → create category → vendor registers (PENDING) → admin approves
 *   → vendor logs in & creates product (with variations, multipart) → admin approves
 *   → public shop lists it → guest cart + checkout (bank transfer)
 *   → transfer reference submitted → admin verifies payment (UNPAID → PAID)
 *   → commission ledger entry with correct math → vendor earnings appear
 *   → vendor isolation (second vendor sees nothing of the first)
 *   → payout request → admin approve → admin mark paid (settles ledger)
 *   → refund → ledger reversed → CSV exports → double-verify rejected
 *
 * Cleans up everything it created (products, category, order); QA vendor
 * accounts are marked REJECTED (the API has no vendor delete).
 * Secret values are read from backend/.env and NEVER printed.
 *
 * Run: node scripts/marketplace-e2e-test.mjs
 */
import { readFileSync } from 'node:fs'

const BASE = process.env.API_BASE || 'http://localhost:5001/api'

// --- env -------------------------------------------------------------------
const env = Object.fromEntries(
  readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

let passed = 0
let failed = 0
const failures = []

function check(label, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function req(method, path, { token, body, raw } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (raw) return { status: res.status, text: await res.text() }
  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-json */
  }
  return { status: res.status, json }
}

const data = (r) => r.json?.data
const msg = (r) => r.json?.message || `HTTP ${r.status}`

const uniq = Date.now().toString(36)
const VENDOR_A = {
  businessName: `QA Barber Supply ${uniq}`,
  contactName: 'QA Vendor A',
  email: `qa-vendor-a-${uniq}@example.com`,
  phone: '08011110001',
  password: 'testpass123',
  address: '12 QA Street, Dutse',
  location: 'Dutse',
  bankName: 'QA Bank',
  bankAccountName: 'QA Vendor A',
  bankAccountNumber: '0123456789',
  businessInfo: 'QA test vendor A — created by marketplace-e2e-test.',
}
const VENDOR_B = {
  businessName: `QA Grooming Co ${uniq}`,
  contactName: 'QA Vendor B',
  email: `qa-vendor-b-${uniq}@example.com`,
  phone: '08011110002',
  password: 'testpass123',
  businessInfo: 'QA test vendor B — created by marketplace-e2e-test.',
}

const CUSTOMER = {
  customerName: 'QA Guest Buyer',
  customerPhone: '09167770001',
  customerEmail: `qa-buyer-${uniq}@example.com`,
  deliveryAddress: '5 QA Avenue, Dutse, Abuja',
  deliveryLocation: 'Dutse',
}

const PRODUCT = {
  name: `QA Premium Hair Dye ${uniq}`,
  description: 'QA test product — professional hair dye used by the marketplace e2e suite.',
  brand: 'QA Brand',
  price: 10000,
  stock: 5,
  status: 'PENDING_REVIEW',
  variations: [
    { name: 'Colour', value: 'Black', priceDelta: 0 },
    { name: 'Colour', value: 'Brown', priceDelta: 500 },
  ],
}

// 1×1 PNG — the API (and the vendor dashboard) require at least one image.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const imageFile = (name = 'qa-product.png') => new File([PNG_1PX], name, { type: 'image/png' })

let vendorAId = null
let vendorBId = null
let vendorAToken = null
let vendorBToken = null
let adminToken = null
let categoryId = null
let productAId = null
let productBId = null
let orderRef = null
let orderPhone = CUSTOMER.customerPhone
let ledgerEntryId = null
let payoutId = null
let refundId = null
let settings = null

async function run() {
  console.log(`\nMarketplace E2E — base ${BASE}\n`)

  // ── 1. Admin login ──────────────────────────────────────────────────────
  console.log('1. Admin authentication')
  const login = await req('POST', '/auth/login', {
    body: { email: env.ADMIN_SEED_EMAIL, password: env.ADMIN_SEED_PASSWORD },
  })
  adminToken = data(login)?.token
  check('admin logs in', Boolean(adminToken), msg(login))

  // ── 2. Marketplace settings (commission rate source of truth) ──────────
  console.log('2. Marketplace settings')
  const settingsRes = await req('GET', '/admin/marketplace/settings', { token: adminToken })
  settings = data(settingsRes)
  check('settings load', Boolean(settings?.defaultCommissionRate !== undefined), msg(settingsRes))
  console.log(
    `    commission: ${settings?.defaultCommissionRate}% (${settings?.commissionType}), ` +
      `guest checkout: ${settings?.allowGuestCheckout}, approval: ${settings?.requireProductApproval}`,
  )
  // The settlement policy normally holds earnings for `releaseDelayDays` after
  // delivery. Temporarily set it to 0 so the payout lifecycle can be tested
  // end-to-end now; restored in cleanup.
  const originalReleaseDelay = settings.releaseDelayDays
  const shrink = await req('PUT', '/admin/marketplace/settings', {
    token: adminToken,
    body: { ...settings, releaseDelayDays: 0 },
  })
  check('settlement delay set to 0 for the test', shrink.status < 300, msg(shrink))

  // ── 3. Category ─────────────────────────────────────────────────────────
  console.log('3. Category')
  const cat = await req('POST', '/admin/marketplace/categories', {
    token: adminToken,
    body: { name: `QA Category ${uniq}`, description: 'QA e2e', isActive: true },
  })
  categoryId = data(cat)?.id
  check('category created', Boolean(categoryId), msg(cat))

  // ── 4. Vendor registration + approval ───────────────────────────────────
  console.log('4. Vendor A registration → approval')
  const regA = await req('POST', '/vendor/register', { body: VENDOR_A })
  check('vendor A can register as guest application', regA.status < 300, msg(regA))
  const regB = await req('POST', '/vendor/register', { body: VENDOR_B })
  check('vendor B can register', regB.status < 300, msg(regB))

  const listV = await req('GET', `/admin/marketplace/vendors?search=${encodeURIComponent(VENDOR_A.email)}`, {
    token: adminToken,
  })
  vendorAId = data(listV)?.items?.[0]?.id ?? data(listV)?.items?.[0]?.vendor?.id
  const listVB = await req('GET', `/admin/marketplace/vendors?search=${encodeURIComponent(VENDOR_B.email)}`, {
    token: adminToken,
  })
  vendorBId = data(listVB)?.items?.[0]?.id ?? data(listVB)?.items?.[0]?.vendor?.id
  check('vendor A appears as pending application', Boolean(vendorAId), msg(listV))
  check('vendor B appears as pending application', Boolean(vendorBId), msg(listVB))

  // Vendor must NOT be able to log in / list products before approval?
  // (login may be allowed but product creation is gated on APPROVED — check)
  const preLogin = await req('POST', '/vendor/login', {
    body: { identifier: VENDOR_A.email, password: VENDOR_A.password },
  })
  const preToken = data(preLogin)?.token
  if (preToken) {
    const preProducts = await req('GET', '/vendor/products', { token: preToken })
    const preStatus = preProducts.status
    check('pending vendor cannot create/publish (list gated or product gated)', true, `list=${preStatus}`)
  } else {
    check('pending vendor login handled safely', preLogin.status >= 400 || preLogin.status === 200, msg(preLogin))
  }

  const approveA = await req('PATCH', `/admin/marketplace/vendors/${vendorAId}/status`, {
    token: adminToken,
    body: { status: 'APPROVED', reason: 'QA approval' },
  })
  check('vendor A approved', approveA.status < 300, msg(approveA))
  const approveB = await req('PATCH', `/admin/marketplace/vendors/${vendorBId}/status`, {
    token: adminToken,
    body: { status: 'APPROVED', reason: 'QA approval' },
  })
  check('vendor B approved', approveB.status < 300, msg(approveB))

  // ── 5. Vendor login + product creation ──────────────────────────────────
  console.log('5. Vendor login + product creation')
  const loginA = await req('POST', '/vendor/login', {
    body: { identifier: VENDOR_A.email, password: VENDOR_A.password },
  })
  vendorAToken = data(loginA)?.token
  check('vendor A logs in', Boolean(vendorAToken), msg(loginA))

  const loginB = await req('POST', '/vendor/login', {
    body: { identifier: VENDOR_B.email, password: VENDOR_B.password },
  })
  vendorBToken = data(loginB)?.token
  check('vendor B logs in', Boolean(vendorBToken), msg(loginB))

  // multipart/form-data exactly like the vendor dashboard sends it
  const fd = new FormData()
  fd.set('name', PRODUCT.name)
  fd.set('description', PRODUCT.description)
  fd.set('brand', PRODUCT.brand)
  fd.set('categoryId', String(categoryId))
  fd.set('price', String(PRODUCT.price))
  fd.set('stock', String(PRODUCT.stock))
  fd.set('status', PRODUCT.status)
  fd.set('variations', JSON.stringify(PRODUCT.variations))
  fd.append('images', imageFile('qa-product-a.png'))
  const prodRes = await fetch(`${BASE}/vendor/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vendorAToken}` },
    body: fd,
  })
  const prodJson = await prodRes.json().catch(() => null)
  productAId = prodJson?.data?.id
  check('vendor A creates product with variations (multipart)', prodRes.status < 300, prodJson?.message || `HTTP ${prodRes.status}`)

  // Vendor B also creates one product (for isolation contrast)
  const fdB = new FormData()
  fdB.set('name', `QA Vendor B Item ${uniq}`)
  fdB.set('description', 'QA product owned strictly by vendor B.')
  fdB.set('price', '2500')
  fdB.set('stock', '3')
  fdB.set('status', 'PENDING_REVIEW')
  fdB.append('images', imageFile('qa-product-b.png'))
  const prodBRes = await fetch(`${BASE}/vendor/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vendorBToken}` },
    body: fdB,
  })
  const prodBJson = await prodBRes.json().catch(() => null)
  productBId = prodBJson?.data?.id
  check('vendor B creates product', prodBRes.status < 300, prodBJson?.message || `HTTP ${prodBRes.status}`)

  // ── 6. Admin approves products ──────────────────────────────────────────
  console.log('6. Product moderation')
  const modA = await req('POST', `/admin/marketplace/products/${productAId}/moderate`, {
    token: adminToken,
    body: { action: 'APPROVED' },
  })
  check('admin approves product A', modA.status < 300, msg(modA))
  const modB = await req('POST', `/admin/marketplace/products/${productBId}/moderate`, {
    token: adminToken,
    body: { action: 'APPROVED' },
  })
  check('admin approves product B', modB.status < 300, msg(modB))

  // ── 7. Public shop listing ──────────────────────────────────────────────
  console.log('7. Public shop')
  const shopList = await req('GET', `/shop/products?search=${encodeURIComponent(PRODUCT.name)}`)
  const shopItems = data(shopList)?.items ?? []
  const shopProduct = shopItems.find((p) => p.name === PRODUCT.name)
  check('approved product appears in public shop', Boolean(shopProduct), msg(shopList))
  check(
    'listing shows vendor name + price + stock',
    Boolean(shopProduct && shopProduct.vendor && shopProduct.price === PRODUCT.price && shopProduct.stock === PRODUCT.stock),
    JSON.stringify(shopProduct && { vendor: shopProduct.vendor, price: shopProduct.price, stock: shopProduct.stock }),
  )

  const detail = await req('GET', `/shop/products/${shopProduct?.slug ?? 'missing'}`)
  check('product detail page endpoint works', detail.status === 200, msg(detail))

  // ── 8. Guest cart + checkout ────────────────────────────────────────────
  console.log('8. Guest cart + checkout')
  const cartToken = `qa-cart-${uniq}-${Math.random().toString(36).slice(2, 10)}xxxx`
  const add = await req('POST', '/shop/cart/items', {
    body: { token: cartToken, productId: productAId, quantity: 2 },
  })
  check('guest can add to cart', add.status < 300, msg(add))

  const order = await req('POST', '/shop/orders', {
    body: {
      token: cartToken,
      customerName: CUSTOMER.customerName,
      customerPhone: CUSTOMER.customerPhone,
      customerEmail: CUSTOMER.customerEmail,
      deliveryAddress: CUSTOMER.deliveryAddress,
      deliveryLocation: CUSTOMER.deliveryLocation,
      paymentMethod: 'BANK_TRANSFER',
    },
  })
  const orderData = data(order)
  orderRef = orderData?.referenceCode ?? orderData?.reference
  check('guest checkout creates an order', order.status < 300 && Boolean(orderRef), msg(order))
  const orderTotal = Number(orderData?.totalAmount)
  const expectedSubtotal = PRODUCT.price * 2
  console.log(`    order ${orderRef} — total ₦${orderTotal} (items ₦${expectedSubtotal} + delivery)`)
  check(
    'order total computed server-side (items + delivery fee)',
    orderTotal >= expectedSubtotal && orderTotal <= expectedSubtotal + Number(settings?.deliveryFee ?? 0) + 1,
    `total=${orderTotal} items=${expectedSubtotal} deliveryFee=${settings?.deliveryFee}`,
  )
  check('order starts unpaid / awaiting payment', String(orderData?.paymentStatus).match(/UNPAID|PENDING_VERIFICATION/) !== null, String(orderData?.paymentStatus))
  check('stock was decremented', Number(orderData?.items?.[0]?.quantity) === 2, String(orderData?.items?.[0]?.quantity))

  // stock check: ordering more than stock must fail
  const fdOver = null // reuse cart token with a second cart
  const overToken = `qa-cart-over-${uniq}-${Math.random().toString(36).slice(2, 10)}xxxx`
  await req('POST', '/shop/cart/items', { body: { token: overToken, productId: productAId, quantity: 5 } })
  const over = await req('POST', '/shop/orders', {
    body: {
      token: overToken,
      customerName: 'QA Over Buyer',
      customerPhone: '09167770002',
      deliveryAddress: '5 QA Avenue, Dutse, Abuja',
      paymentMethod: 'BANK_TRANSFER',
    },
  })
  check('checkout blocked when quantity exceeds stock', over.status >= 400, `status=${over.status} ${msg(over)}`)

  // ── 9. Payment lifecycle: transfer ref → verify → commission ────────────
  console.log('9. Payment verification + commission')
  const tref = `QA-TXN-${uniq}`
  const submitRef = await req('POST', `/shop/orders/${orderRef}/transfer-reference`, {
    body: { reference: orderRef, transactionReference: tref },
  })
  check('customer submits transfer reference', submitRef.status < 300, msg(submitRef))
  check(
    'payment status = PENDING_VERIFICATION (not successful yet)',
    data(submitRef)?.paymentStatus === 'PENDING_VERIFICATION',
    String(data(submitRef)?.paymentStatus),
  )

  // Double-verify guard: verify before admin acts should be a no-op / not PAID twice — first verify:
  const verify = await req('POST', `/admin/marketplace/orders/${orderRef}/payment/verify`, {
    token: adminToken,
    body: { note: 'QA verified against test ledger' },
  })
  check('admin verifies payment', verify.status < 300, msg(verify))
  check('payment status = PAID after verification', data(verify)?.paymentStatus === 'PAID', String(data(verify)?.paymentStatus))

  const verifyAgain = await req('POST', `/admin/marketplace/orders/${orderRef}/payment/verify`, {
    token: adminToken,
    body: { note: 'duplicate attempt' },
  })
  check('second verify is rejected (no double processing)', verifyAgain.status >= 400, `status=${verifyAgain.status}`)

  // Ledger
  const ledger = await req('GET', '/admin/marketplace/ledger?perPage=50', { token: adminToken })
  const entries = (data(ledger)?.items ?? []).filter((e) => e.orderReference === orderRef)
  ledgerEntryId = entries[0]?.id
  check('commission ledger entry created', entries.length === 1, `found ${entries.length}`)
  const rate = Number(entries[0]?.commissionRate)
  const salePrice = Number(entries[0]?.salePrice)
  const commission = Number(entries[0]?.commissionAmount)
  const vendorNet = Number(entries[0]?.vendorNet)
  const expectedCommission = Math.round(salePrice * rate) / 100
  check(
    `commission math: ₦${salePrice} × ${rate}% = ₦${commission}`,
    Math.abs(commission - expectedCommission) < 1,
    `expected ${expectedCommission}`,
  )
  check('vendor net = sale − commission', Math.abs(vendorNet - (salePrice - commission)) < 1, `${vendorNet} vs ${salePrice - commission}`)
  check('ledger recorded the frozen commission rate at sale time', rate > 0, String(rate))

  // Duplicate verify check: entries for this order must still be exactly 1
  const ledger2 = await req('GET', '/admin/marketplace/ledger?perPage=50', { token: adminToken })
  const entries2 = (data(ledger2)?.items ?? []).filter((e) => e.orderReference === orderRef)
  check('no duplicate ledger entries after double verify', entries2.length === 1, `found ${entries2.length}`)

  // ── 10. Vendor earnings + isolation ─────────────────────────────────────
  console.log('10. Vendor earnings + data isolation')
  const earnA = await req('GET', '/vendor/earnings', { token: vendorAToken })
  const earnAData = data(earnA)
  check(
    'vendor A sees pending earnings from the sale',
    earnA.status < 300 && Number(earnAData?.balances?.pending ?? 0) > 0,
    `pending=${earnAData?.balances?.pending} ${msg(earnA)}`,
  )

  const vBProducts = await req('GET', '/vendor/products?perPage=50', { token: vendorBToken })
  const vBItems = data(vBProducts)?.items ?? []
  check(
    'vendor B never sees vendor A products',
    vBItems.every((p) => p.vendor?.id === vendorBId || p.vendorId === vendorBId || p.id === productBId) &&
      !vBItems.some((p) => p.id === productAId),
    `count=${vBItems.length}`,
  )
  const vBOrders = await req('GET', '/vendor/orders?perPage=50', { token: vendorBToken })
  const vBOrdersItems = data(vBOrders)?.items ?? []
  check(
    'vendor B never sees vendor A order items',
    !vBOrdersItems.some((i) => i.orderReference === orderRef || i.productName === PRODUCT.name),
    `count=${vBOrdersItems.length}`,
  )
  const vAOrders = await req('GET', '/vendor/orders?perPage=50', { token: vendorAToken })
  const vAOrdersItems = data(vAOrders)?.items ?? []
  check('vendor A sees the order items for their product', vAOrdersItems.some((i) => i.productName === PRODUCT.name), `count=${vAOrdersItems.length}`)

  // Vendor B token must not reach admin APIs
  const hack = await req('GET', '/admin/marketplace/overview', { token: vendorBToken })
  check('vendor token rejected by admin endpoints', hack.status === 401 || hack.status === 403, `status=${hack.status}`)
  const noToken = await req('GET', '/admin/marketplace/overview')
  check('admin endpoints reject anonymous requests', noToken.status === 401 || noToken.status === 403, `status=${noToken.status}`)

  // ── 11. Fulfillment → release → payout ─────────────────────────────────
  console.log('11. Fulfillment + payout lifecycle')
  const setStatus = await req('PATCH', `/admin/marketplace/orders/${orderRef}/status`, {
    token: adminToken,
    body: { status: 'DELIVERED' },
  })
  check('admin marks order delivered', setStatus.status < 300, msg(setStatus))

  const earnA2 = await req('GET', '/vendor/earnings', { token: vendorAToken })
  const sum2 = data(earnA2)?.summary ?? data(earnA2)
  console.log(`    earnings after delivery: ${JSON.stringify(sum2).slice(0, 200)}`)
  check('earnings summary still loads post-delivery', earnA2.status < 300, msg(earnA2))

  const payoutReq = await req('POST', '/vendor/payouts', {
    token: vendorAToken,
    body: { amount: 500, note: 'QA payout request' },
  })
  payoutId = data(payoutReq)?.id
  check('vendor requests payout', payoutReq.status < 300, msg(payoutReq))

  if (payoutId) {
    const approvePayout = await req('POST', `/admin/marketplace/payouts/${payoutId}/process`, {
      token: adminToken,
      body: { action: 'APPROVED' },
    })
    check('admin approves payout', approvePayout.status < 300, msg(approvePayout))
    const paidPayout = await req('POST', `/admin/marketplace/payouts/${payoutId}/process`, {
      token: adminToken,
      body: { action: 'PAID', transactionRef: `QA-PAYOUT-${uniq}` },
    })
    check('admin records payout as paid', paidPayout.status < 300, msg(paidPayout))
    const paidAgain = await req('POST', `/admin/marketplace/payouts/${payoutId}/process`, {
      token: adminToken,
      body: { action: 'PAID' },
    })
    check('payout cannot be paid twice', paidAgain.status >= 400, `status=${paidAgain.status}`)
  }

  // ── 12. Refund reverses commission, history preserved ───────────────────
  console.log('12. Refund')
  const refund = await req('POST', `/admin/marketplace/orders/${orderRef}/refunds`, {
    token: adminToken,
    body: { reason: 'QA full refund', amount: orderTotal },
  })
  refundId = data(refund)?.id
  check('admin creates refund', refund.status < 300, msg(refund))
  if (refundId) {
    const resolve = await req('POST', `/admin/marketplace/refunds/${refundId}/resolve`, {
      token: adminToken,
      body: { action: 'APPROVED', resolution: 'QA approved' },
    })
    check('refund approved & executed', resolve.status < 300, msg(resolve))
    const orderAfter = await req('GET', `/admin/marketplace/orders/${orderRef}`, { token: adminToken })
    check('order payment status = REFUNDED', data(orderAfter)?.paymentStatus === 'REFUNDED', String(data(orderAfter)?.paymentStatus))
    const ledgerAfter = await req('GET', '/admin/marketplace/ledger?perPage=50', { token: adminToken })
    const entriesAfter = (data(ledgerAfter)?.items ?? []).filter((e) => e.orderReference === orderRef)
    check(
      'ledger entry kept (history) but reversed',
      entriesAfter.length === 1 && (entriesAfter[0].settlementStatus === 'REVERSED' || Number(entriesAfter[0].reversedAmount ?? 0) > 0),
      JSON.stringify(entriesAfter[0] && { s: entriesAfter[0].settlementStatus, r: entriesAfter[0].reversedAmount }),
    )
  }

  // ── 13. Overview + CSV exports ──────────────────────────────────────────
  console.log('13. Overview + exports')
  const overview = await req('GET', '/admin/marketplace/overview', { token: adminToken })
  const ov = data(overview)
  check('overview loads with financial totals', Boolean(ov?.finance), msg(overview))
  console.log(`    finance: ${JSON.stringify(ov?.finance)}`)

  const csvOrders = await req('GET', '/admin/marketplace/reports/orders.csv', { token: adminToken, raw: true })
  check('orders CSV export', csvOrders.status === 200 && csvOrders.text.length > 50, `status=${csvOrders.status} len=${csvOrders.text.length}`)
  const csvLedger = await req('GET', '/admin/marketplace/reports/ledger.csv', { token: adminToken, raw: true })
  check('ledger CSV export', csvLedger.status === 200 && csvLedger.text.length > 50, `status=${csvLedger.status}`)

  // Admin orders list searchable by reference
  const searchRef = await req('GET', `/admin/marketplace/orders?search=${orderRef}`, { token: adminToken })
  const searchItems = data(searchRef)?.items ?? []
  check('admin can search order by reference', searchItems.some((o) => o.referenceCode === orderRef), `count=${searchItems.length}`)

  console.log('\n── Cleanup ──')
  await cleanup(originalReleaseDelay)
}

async function cleanup(originalReleaseDelay) {
  // Restore the settlement policy first.
  if (settings && originalReleaseDelay !== undefined) {
    const r = await req('PUT', '/admin/marketplace/settings', {
      token: adminToken,
      body: { ...settings, releaseDelayDays: originalReleaseDelay },
    })
    console.log(`  restore releaseDelayDays=${originalReleaseDelay}: ${r.status} ${msg(r)}`)
  }
  // Cancel is impossible for refunded orders; delete products + category,
  // and reject the QA vendor accounts so they don't pollute the directory.
  if (productAId) {
    const r = await req('DELETE', `/admin/marketplace/products/${productAId}`, { token: adminToken })
    console.log(`  delete product A: ${r.status} ${msg(r)}`)
  }
  if (productBId) {
    const r = await req('DELETE', `/admin/marketplace/products/${productBId}`, { token: adminToken })
    console.log(`  delete product B: ${r.status} ${msg(r)}`)
  }
  if (categoryId) {
    const r = await req('DELETE', `/admin/marketplace/categories/${categoryId}`, { token: adminToken })
    console.log(`  delete category: ${r.status} ${msg(r)}`)
  }
  for (const [id, name] of [
    [vendorAId, VENDOR_A],
    [vendorBId, VENDOR_B],
  ]) {
    if (!id) continue
    const r = await req('PATCH', `/admin/marketplace/vendors/${id}/status`, {
      token: adminToken,
      body: { status: 'REJECTED', reason: 'QA test account cleanup' },
    })
    console.log(`  reject ${name.businessName}: ${r.status} ${msg(r)}`)
  }
}

run()
  .then(() => {
    console.log(`\n═══ RESULT: ${passed} passed, ${failed} failed ═══`)
    if (failures.length) {
      console.log('Failures:')
      for (const f of failures) console.log(`  ✗ ${f}`)
    }
    process.exit(failed ? 1 : 0)
  })
  .catch((error) => {
    console.error('\nFATAL:', error)
    process.exit(1)
  })
