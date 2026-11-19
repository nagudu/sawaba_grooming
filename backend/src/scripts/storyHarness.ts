import 'dotenv/config'
process.env.UPLOAD_DRIVER = 'local'

import type { AddressInfo } from 'node:net'
import bcrypt from 'bcryptjs'
import { app } from '../app'
import { prisma } from '../config/database'
import { env } from '../config/env'
import {
  cleanupExpiredStories,
  createStory,
  deleteStory,
  expireStories,
  listPublicStories,
  listVendorStories,
  moderateStory,
  updateStory,
} from '../services/storyService'

/**
 * Sawaba Stories harness — boots the real Express app in-process (local upload
 * driver) and verifies the full lifecycle: admin publish, vendor submit,
 * moderation, public feed, unique views, role permissions and 24h expiry.
 *
 *   tsx src/scripts/storyHarness.ts
 */

let failures = 0
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  PASS  ${name}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function expectError(name: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
    check(name, false, 'expected the call to be rejected')
  } catch {
    check(name, true)
  }
}

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQAY3Y2wAAAAAElFTkSuQmCC',
  'base64',
)

async function ensureAdmin() {
  const email = env.adminSeed.email.toLowerCase()
  const existing = await prisma.admin.findUnique({ where: { email } })
  if (existing) return existing
  return prisma.admin.create({
    data: {
      name: env.adminSeed.name,
      email,
      password: await bcrypt.hash(env.adminSeed.password, 12),
      role: 'ADMIN',
    },
  })
}

async function ensureVendorAndProduct() {
  const email = 'story-harness-vendor@sawaba.test'
  const passwordHash = await bcrypt.hash('StoryHarness123!', 10)
  const vendor = await prisma.vendor.upsert({
    where: { email },
    update: { status: 'APPROVED', isActive: true, passwordHash },
    create: {
      businessName: 'Story Harness Store',
      contactName: 'Harness Vendor',
      slug: `story-harness-${Date.now()}`,
      email,
      phone: '2347000000001',
      passwordHash,
      status: 'APPROVED',
      isActive: true,
    },
  })
  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      name: 'Harness Beard Oil',
      slug: `harness-beard-oil-${Date.now()}`,
      description: 'Harness test product.',
      price: 12500,
      compareAtPrice: 15000,
      stock: 25,
      status: 'ACTIVE',
      isActive: true,
    },
  })
  return { vendor, product }
}

async function main(): Promise<void> {
  const admin = await ensureAdmin()
  const { vendor, product } = await ensureVendorAndProduct()

  const server = app.listen(0)
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const { port } = server.address() as AddressInfo
  const base = `http://127.0.0.1:${port}`

  const createdStoryIds: number[] = []

  try {
    console.log('── Sawaba Stories harness ───────────────────────────────────')

    // ── Route guards (no session) ────────────────────────────────────────────
    const feed = await fetch(`${base}/api/stories`)
    const feedBody = (await feed.json()) as { success: boolean }
    check('Public feed responds 200', feed.status === 200 && feedBody.success === true, `status ${feed.status}`)

    const noAuthAdmin = await fetch(`${base}/api/admin/stories`, { method: 'POST' })
    check('Admin create without a session is 401', noAuthAdmin.status === 401, `status ${noAuthAdmin.status}`)

    const noAuthVendor = await fetch(`${base}/api/vendor/stories`, { method: 'POST' })
    check('Vendor create without a session is 401', noAuthVendor.status === 401, `status ${noAuthVendor.status}`)

    const badView = await fetch(`${base}/api/stories/1/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewerKey: 'short' }),
    })
    check('View needs a valid viewer key (422/404)', badView.status === 422 || badView.status === 404, `status ${badView.status}`)

    // ── Admin publishes a product story over HTTP (multipart) ─────────────────
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.adminSeed.email, password: env.adminSeed.password }),
    })
    const loginBody = (await login.json()) as { data?: { token?: string } }
    const token = loginBody.data?.token
    check('Admin login returns a token', Boolean(token), `status ${login.status}`)
    if (!token) throw new Error('cannot continue without an admin token')

    const form = new FormData()
    form.set('type', 'PRODUCT')
    form.set('title', 'Harness product story')
    form.set('caption', 'Fresh from the harness')
    form.set('productId', String(product.id))
    form.set('expiresInHours', '24')
    form.set('status', 'APPROVED')
    form.append('image', new Blob([TINY_PNG], { type: 'image/png' }), 'story.png')

    const created = await fetch(`${base}/api/admin/stories`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const createdBody = (await created.json()) as {
      success: boolean
      data?: { id: number; status: string; ctaHref: string | null; mediaType: string }
    }
    const adminStory = createdBody.data
    check('Admin publishes a story (201)', created.status === 201 && createdBody.success === true, `status ${created.status}`)
    check('Admin story is APPROVED', adminStory?.status === 'APPROVED', adminStory?.status)
    check('Admin product story links to the product', adminStory?.ctaHref === `/shop/${product.slug}`, String(adminStory?.ctaHref))
    check('Image upload stored as IMAGE media', adminStory?.mediaType === 'IMAGE', adminStory?.mediaType)
    if (adminStory) createdStoryIds.push(adminStory.id)

    // ── Public feed + unique views ────────────────────────────────────────────
    const publicFeed = await fetch(`${base}/api/stories`)
    const publicBody = (await publicFeed.json()) as { data: Array<{ id: number }> }
    check('Approved story appears in the public feed', publicBody.data.some((s) => s.id === adminStory?.id))

    if (adminStory) {
      const viewerKey = `harness-${Date.now()}`
      const first = await fetch(`${base}/api/stories/${adminStory.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewerKey }),
      })
      const firstBody = (await first.json()) as { data: { counted: boolean; viewCount: number } }
      check('First view is counted', firstBody.data.counted === true && firstBody.data.viewCount >= 1, JSON.stringify(firstBody.data))

      const again = await fetch(`${base}/api/stories/${adminStory.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewerKey }),
      })
      const againBody = (await again.json()) as { data: { counted: boolean; viewCount: number } }
      check('Duplicate view is not counted again', againBody.data.counted === false && againBody.data.viewCount === firstBody.data.viewCount, JSON.stringify(againBody.data))

      const otherViewer = await fetch(`${base}/api/stories/${adminStory.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewerKey: `harness-other-${Date.now()}` }),
      })
      const otherBody = (await otherViewer.json()) as { data: { counted: boolean; viewCount: number } }
      check('A different viewer increments the count', otherBody.data.counted === true && otherBody.data.viewCount === firstBody.data.viewCount + 1, JSON.stringify(otherBody.data))
    }

    // ── Vendor moderation lifecycle (service layer) ───────────────────────────
    const vendorStory = await createStory(
      {
        type: 'PRODUCT',
        title: 'Vendor product story',
        caption: 'Demo of the beard oil',
        productId: product.id,
        mediaType: 'IMAGE',
        image: '/uploads/harness-vendor-story.jpg',
      },
      { role: 'VENDOR', vendorId: vendor.id },
    )
    createdStoryIds.push(vendorStory.id)
    check('Vendor story starts PENDING', vendorStory.status === 'PENDING', vendorStory.status)

    const publicBefore = await listPublicStories()
    check('Pending vendor story is hidden from the public feed', !publicBefore.some((s) => s.id === vendorStory.id))

    const vendorList = await listVendorStories(vendor.id, {})
    check('Vendor sees their own story', vendorList.items.some((s) => s.id === vendorStory.id))

    await expectError('Vendor cannot use another store’s product', () =>
      createStory(
        { type: 'PRODUCT', title: 'Stolen product', productId: 9_999_999, mediaType: 'IMAGE', image: '/uploads/x.jpg' },
        { role: 'VENDOR', vendorId: vendor.id },
      ),
    )
    await expectError('Vendor cannot publish non-product story types', () =>
      createStory(
        { type: 'SERVICE', title: 'Bad type', serviceId: 1, mediaType: 'IMAGE', image: '/uploads/x.jpg' },
        { role: 'VENDOR', vendorId: vendor.id },
      ),
    )
    await expectError('Vendor cannot edit an admin story', () =>
      updateStory(adminStory!.id, { title: 'hijacked' }, { role: 'VENDOR', vendorId: vendor.id }),
    )
    await expectError('Vendor cannot delete an admin story', () =>
      deleteStory(adminStory!.id, { role: 'VENDOR', vendorId: vendor.id }),
    )

    await moderateStory(vendorStory.id, 'APPROVE', null, { id: admin.id })
    const publicAfterApprove = await listPublicStories()
    check('Approved vendor story goes live', publicAfterApprove.some((s) => s.id === vendorStory.id))

    const rejected = await moderateStory(vendorStory.id, 'REJECT', 'Does not meet guidelines', { id: admin.id })
    check('Reject sets status and reason', rejected.status === 'REJECTED' && rejected.rejectedReason === 'Does not meet guidelines', rejected.rejectedReason ?? '')
    const publicAfterReject = await listPublicStories()
    check('Rejected story is hidden', !publicAfterReject.some((s) => s.id === vendorStory.id))

    // ── Expiry + purge ────────────────────────────────────────────────────────
    const expiredCandidate = await createStory(
      { type: 'PROMOTION', title: 'Expiring offer', offerUrl: '/shop', mediaType: 'IMAGE', image: '/uploads/expiring.jpg' },
      { role: 'ADMIN', adminId: admin.id },
    )
    createdStoryIds.push(expiredCandidate.id)
    await prisma.story.update({ where: { id: expiredCandidate.id }, data: { expiresAt: new Date(Date.now() - 60_000) } })
    const publicAfterExpiry = await listPublicStories()
    check('Expired story drops out of the feed', !publicAfterExpiry.some((s) => s.id === expiredCandidate.id))
    await expireStories()
    const expiredRow = await prisma.story.findUnique({ where: { id: expiredCandidate.id }, select: { status: true } })
    check('expireStories marks the row EXPIRED', expiredRow?.status === 'EXPIRED', expiredRow?.status)

    const purgedCandidate = await createStory(
      { type: 'PROMOTION', title: 'Old offer', offerUrl: '/shop', mediaType: 'IMAGE', image: '/uploads/old.jpg' },
      { role: 'ADMIN', adminId: admin.id },
    )
    await prisma.story.update({ where: { id: purgedCandidate.id }, data: { expiresAt: new Date(Date.now() - 25 * 3_600_000) } })
    const cleanup = await cleanupExpiredStories()
    const purgedRow = await prisma.story.findUnique({ where: { id: purgedCandidate.id }, select: { id: true } })
    check('Cleanup purges stories older than the grace window', purgedRow === null && cleanup.deleted >= 1, `deleted ${cleanup.deleted}`)
  } finally {
    await prisma.story.deleteMany({ where: { id: { in: createdStoryIds } } }).catch(() => undefined)
    await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined)
    await prisma.vendor.delete({ where: { id: vendor.id } }).catch(() => undefined)
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  console.log('')
  console.log(failures === 0 ? 'All Story checks passed.' : `${failures} Story check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error('[story-harness] failed:', error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
