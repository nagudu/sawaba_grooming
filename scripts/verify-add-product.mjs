/**
 * Add-Product workflow verification (fixes QA for "Selected category is unavailable").
 *
 *   admin login → ensure categories exist (creates the starter set via the
 *   REAL admin endpoint when the table is empty) → admin edit round-trip →
 *   public shop lists them → vendor registers + is approved → multipart
 *   product creation with a REAL categoryId → invalid categoryId still
 *   rejected (validation intact) → admin approves → product visible in the
 *   public Shop → cleanup (QA product deleted, QA vendor rejected).
 *
 * Categories are intentionally LEFT IN THE DATABASE: they are real records
 * managed from Admin → Marketplace, not test fixtures.
 *
 * Run from project root: node scripts/verify-add-product.mjs
 * Secrets are read from backend/.env and NEVER printed.
 */
import { readFileSync } from 'node:fs'

const BASE = process.env.API_BASE || 'http://localhost:5000/api'

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

async function req(method, path, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
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

const STARTER_CATEGORIES = [
  { name: 'Hair Dye', description: 'Permanent and semi-permanent hair dyes in every shade.', sortOrder: 1 },
  { name: 'Shampoo & Conditioner', description: 'Cleansers and conditioners for all hair types.', sortOrder: 2 },
  { name: 'Hair Oils & Moisturizers', description: 'Oils, creams and moisturizers for healthy hair.', sortOrder: 3 },
  { name: 'Styling & Treatments', description: 'Gels, pomades, masks and treatment products.', sortOrder: 4 },
  { name: 'Clippers & Trimmers', description: 'Barbering equipment, blades and grooming tools.', sortOrder: 5 },
  { name: 'Shaving & Aftershave', description: 'Razor care, aftershave and grooming accessories.', sortOrder: 6 },
]

const uniq = Date.now().toString(36)
const QA_VENDOR = {
  businessName: `QA AddProduct Shop ${uniq}`,
  contactName: 'QA Vendor',
  email: `qa-addproduct-${uniq}@example.com`,
  phone: '08011119999',
  password: 'testpass123',
  address: '1 QA Street, Dutse',
  location: 'Dutse',
  bankName: 'QA Bank',
  bankAccountName: 'QA Vendor',
  bankAccountNumber: '0123456789',
  businessInfo: 'QA vendor for add-product verification run.',
}

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function run() {
  console.log(`Add-Product verification — base ${BASE}\n`)

  // ── 1. Admin login ──────────────────────────────────────────────────────
  console.log('1. Admin login')
  const login = await req('POST', '/auth/login', {
    body: { email: env.ADMIN_SEED_EMAIL, password: env.ADMIN_SEED_PASSWORD },
  })
  const adminToken = data(login)?.token
  check('admin logs in', Boolean(adminToken), msg(login))
  if (!adminToken) return finish()

  // ── 2. Categories exist (create the starter set when the table is empty) ─
  console.log('2. Marketplace categories')
  let cats = data(await req('GET', '/admin/marketplace/categories', { token: adminToken })) ?? []
  check('admin category list loads', Array.isArray(cats), 'list failed')
  if (cats.length === 0) {
    for (const starter of STARTER_CATEGORIES) {
      const created = await req('POST', '/admin/marketplace/categories', {
        token: adminToken,
        body: { ...starter, isActive: true },
      })
      check(`created category "${starter.name}"`, Boolean(data(created)?.id), msg(created))
    }
    cats = data(await req('GET', '/admin/marketplace/categories', { token: adminToken })) ?? []
  } else {
    console.log(`    ${cats.length} categories already present — keeping them`)
  }
  check('category list is non-empty', cats.length > 0)

  // Admin can also MANAGE categories (edit round-trip on the first one).
  const first = cats[0]
  const edited = await req('PUT', `/admin/marketplace/categories/${first.id}`, {
    token: adminToken,
    body: {
      name: first.name,
      description: first.description ?? '',
      commissionRate: first.commissionRate ?? null,
      isActive: true,
      sortOrder: first.sortOrder ?? 0,
    },
  })
  check('admin can edit a category', edited.status < 300, msg(edited))

  // ── 3. Public shop API serves them (this feeds the vendor dropdown) ─────
  console.log('3. Public category API')
  const publicCats = data(await req('GET', '/shop/categories')) ?? []
  check('public /shop/categories returns data', publicCats.length > 0, `count=${publicCats.length}`)
  const publicIds = new Set(publicCats.map((c) => c.id))
  const chosen = publicCats[0]
  check('public IDs match admin IDs', cats.some((c) => c.id === chosen?.id))

  // ── 4. Vendor registers + gets approved ────────────────────────────────
  console.log('4. Vendor registration + approval')
  const reg = await req('POST', '/vendor/register', { body: QA_VENDOR })
  check('vendor registers', reg.status < 300, msg(reg))
  const listV = await req('GET', `/admin/marketplace/vendors?search=${encodeURIComponent(QA_VENDOR.email)}`, {
    token: adminToken,
  })
  const vendorId = data(listV)?.items?.[0]?.id ?? data(listV)?.items?.[0]?.vendor?.id
  check('vendor application listed', Boolean(vendorId), msg(listV))
  const approve = await req('PATCH', `/admin/marketplace/vendors/${vendorId}/status`, {
    token: adminToken,
    body: { status: 'APPROVED', reason: 'QA approval' },
  })
  check('vendor approved', approve.status < 300, msg(approve))

  const vLogin = await req('POST', '/vendor/login', {
    body: { identifier: QA_VENDOR.email, password: QA_VENDOR.password },
  })
  const vendorToken = data(vLogin)?.token
  check('vendor logs in', Boolean(vendorToken), msg(vLogin))
  if (!vendorToken) return finish()

  // ── 5. Add Product with an INVALID category still rejected ─────────────
  console.log('5. Category validation is intact')
  const badFd = new FormData()
  badFd.set('name', `QA Should Fail ${uniq}`)
  badFd.set('description', 'This product must be rejected: category id 999999 does not exist.')
  badFd.set('price', '500')
  badFd.set('stock', '1')
  badFd.set('categoryId', '999999')
  badFd.append('images', new File([PNG_1PX], 'x.png', { type: 'image/png' }))
  const badRes = await fetch(`${BASE}/vendor/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vendorToken}` },
    body: badFd,
  })
  const badJson = await badRes.json().catch(() => null)
  check(
    'invalid category id rejected with the real error',
    badRes.status >= 400 && /category is unavailable/i.test(badJson?.message ?? ''),
    `status=${badRes.status} msg=${badJson?.message}`,
  )

  // ── 6. Add Product with a REAL category succeeds ───────────────────────
  console.log('6. Add Product (multipart: image, price, stock, category)')
  const fd = new FormData()
  fd.set('name', `QA Verified Product ${uniq}`)
  fd.set('description', 'Verification product proving the Add Product workflow end-to-end.')
  fd.set('brand', 'QA Brand')
  fd.set('categoryId', String(chosen.id))
  fd.set('price', '3500')
  fd.set('stock', '7')
  fd.set('status', 'PENDING_REVIEW')
  fd.append('images', new File([PNG_1PX], 'qa-addproduct.png', { type: 'image/png' }))
  const prodRes = await fetch(`${BASE}/vendor/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${vendorToken}` },
    body: fd,
  })
  const prodJson = await prodRes.json().catch(() => null)
  const productId = prodJson?.data?.id
  check('product saved with a valid category', prodRes.status < 300, prodJson?.message || `HTTP ${prodRes.status}`)
  console.log(`    create HTTP ${prodRes.status} · chosen=${chosen.id} · response.category=${JSON.stringify(prodJson?.data?.category ?? null)}`)
  check('product carries the chosen category', prodJson?.data?.category?.id === chosen.id,
    JSON.stringify(prodJson?.data?.category ?? null))

  // ── 7. Admin approves + it shows in the public Shop ────────────────────
  console.log('7. Moderation + public Shop')
  const mod = await req('POST', `/admin/marketplace/products/${productId}/moderate`, {
    token: adminToken,
    body: { action: 'APPROVED' },
  })
  check('admin approves product', mod.status < 300, msg(mod))

  const shop = data(await req('GET', '/shop/products?perPage=48')) ?? {}
  const listed = (shop.items ?? []).find((p) => p.id === productId)
  check('product appears in the public Shop', Boolean(listed), `total=${shop.total}`)
  check('listed product shows its category', listed?.category?.id === chosen.id,
    JSON.stringify(listed?.category ?? null))

  // ── 8. Cleanup: remove QA product + QA vendor (categories stay) ────────
  console.log('8. Cleanup (categories are kept)')
  const del = await req('DELETE', `/vendor/products/${productId}`, { token: vendorToken })
  check('QA product deleted', del.status < 300, msg(del))
  const reject = await req('PATCH', `/admin/marketplace/vendors/${vendorId}/status`, {
    token: adminToken,
    body: { status: 'REJECTED', reason: 'QA cleanup' },
  })
  check('QA vendor rejected', reject.status < 300, msg(reject))

  return finish()
}

function finish() {
  console.log(`\n─── ${passed} passed, ${failed} failed ───`)
  if (failures.length) {
    console.log('Failures:')
    for (const f of failures) console.log(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log('Categories in DB (managed via Admin → Marketplace):')
  process.exit(0)
}

run().catch((error) => {
  console.error('FATAL', error)
  process.exit(1)
})
