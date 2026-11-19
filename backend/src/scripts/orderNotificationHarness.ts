import 'dotenv/config'

import type { AddressInfo } from 'node:net'
import bcrypt from 'bcryptjs'
import { app } from '../app'
import { prisma } from '../config/database'
import { env } from '../config/env'
import { invalidateNotificationConfig } from '../services/notificationConfigService'
import { markOrderPaid } from '../services/shopPaymentService'
import { notifyOrderStatus } from '../services/notificationEvents'

/**
 * Order-notification workflow harness. Boots the real Express app in-process and
 * proves the purchase→delivery notification guarantees end to end:
 *
 *   1. nothing is sent before the payment is verified,
 *   2. ORDER_CONFIRMATION + PAYMENT_SUCCESS fire exactly once after verification,
 *   3. re-verification does not duplicate them (idempotent),
 *   4. every status change (PROCESSING → OUT_FOR_DELIVERY → DELIVERED) produces
 *      exactly one in-app update, deduped by status,
 *   5. the customer inbox API lists history with the order number + unread count
 *      and supports mark-read / mark-all-read.
 *
 * External channels are switched off for the run so no real email/SMS/WhatsApp is
 * sent; the in-app rows (what the Notification Center shows) are asserted.
 *
 *   tsx src/scripts/orderNotificationHarness.ts
 */

const results: string[] = []
let failures = 0

function check(label: string, ok: boolean, detail = ''): void {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

async function waitFor(run: () => Promise<boolean>, timeoutMs = 6000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await run()) return true
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return false
}

async function main(): Promise<void> {
  const stamp = Date.now().toString(36)
  const forwardedFor = `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.7`
  const server = app.listen(0)
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const { port } = server.address() as AddressInfo
  const BASE = `http://127.0.0.1:${port}`

  const request = async (method: string, path: string, options: { token?: string; json?: unknown } = {}) => {
    const headers: Record<string, string> = { 'X-Forwarded-For': forwardedFor }
    if (options.token) headers.Authorization = `Bearer ${options.token}`
    if (options.json !== undefined) headers['Content-Type'] = 'application/json'
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    })
    const payload = (await response.json().catch(() => ({}))) as { data?: any; message?: string }
    return { status: response.status, data: payload.data, message: payload.message }
  }

  const originalSettings = await prisma.notificationSetting.findUnique({ where: { id: 1 } })
  let vendorId = 0
  let productId = 0
  let customerId = 0
  let orderId = 0

  try {
    // Silence external channels so the run is hermetic (in-app rows still write).
    await prisma.notificationSetting.upsert({
      where: { id: 1 },
      update: { emailEnabled: false, smsEnabled: false, whatsappEnabled: false },
      create: { id: 1, emailEnabled: false, smsEnabled: false, whatsappEnabled: false },
    })
    invalidateNotificationConfig()

    // ── Fixtures ─────────────────────────────────────────────────────────────
    const vendor = await prisma.vendor.create({
      data: {
        businessName: `Notify Vendor ${stamp}`,
        contactName: 'Notify QA',
        slug: `notify-vendor-${stamp}`,
        email: `notify-${stamp}@sawaba.test`,
        phone: `+23486${stamp.replace(/\D/g, '').slice(-9).padStart(9, '6')}`,
        passwordHash: await bcrypt.hash('NotifyPass1!', 10),
        status: 'APPROVED',
        isActive: true,
        commissionRate: 10,
        approvedAt: new Date(),
      },
    })
    vendorId = vendor.id
    const product = await prisma.product.create({
      data: { vendorId, name: `Notify Product ${stamp}`, slug: `notify-product-${stamp}`, description: 'Notify QA', price: 5000, stock: 10, status: 'ACTIVE', isActive: true },
    })
    productId = product.id

    const phone = `080${stamp.replace(/\D/g, '').slice(-8).padStart(8, '3')}`
    const customer = await prisma.customer.create({
      data: {
        fullName: 'Notify QA Customer',
        phone,
        email: `notify-customer-${stamp}@sawaba.test`,
        passwordHash: await bcrypt.hash('NotifyCustomer1!', 10),
      },
    })
    customerId = customer.id

    const order = await prisma.shopOrder.create({
      data: {
        referenceCode: `SGS-NT${stamp.toUpperCase().slice(0, 6)}`,
        customerId,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        deliveryAddress: '12 Notification Way',
        deliveryLocation: 'Wuse',
        fulfillmentType: 'DELIVERY',
        subtotal: 5000,
        totalAmount: 5000,
        status: 'AWAITING_PAYMENT',
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'UNPAID',
        items: {
          create: [
            { vendorId, productId, productName: product.name, unitPrice: 5000, quantity: 1, lineTotal: 5000, commissionRate: 10, commissionAmount: 500, vendorNet: 4500, status: 'PENDING' },
          ],
        },
        payment: { create: { amount: 5000, paymentMethod: 'BANK_TRANSFER', status: 'UNPAID' } },
      },
    })
    orderId = order.id

    const inApp = (where: Record<string, unknown> = {}) =>
      prisma.customerNotification.count({ where: { customerId, channel: 'IN_APP', orderId, ...where } })
    const hasKey = (key: string) =>
      prisma.customerNotification.findUnique({ where: { dedupeKey: key } }).then((row) => Boolean(row))

    // ── 1. Nothing before verification ───────────────────────────────────────
    check('No notification before payment is verified', (await inApp()) === 0, `count ${await inApp()}`)
    check('No ORDER_CONFIRMATION row pre-payment', !(await hasKey(`order:${orderId}:ORDER_CONFIRMATION:IN_APP`)))

    // ── 2. Verified payment fires confirmation + payment success ─────────────
    await markOrderPaid(orderId, {
      provider: 'HARNESS',
      detail: 'Harness verified payment',
      actorRole: 'TEST',
      amount: 5000,
    })

    const confirmed = await waitFor(() => hasKey(`order:${orderId}:ORDER_CONFIRMATION:IN_APP`))
    check('ORDER_CONFIRMATION sent after verified payment', confirmed)
    const paymentOk = await waitFor(() => hasKey(`order:${orderId}:PAYMENT_SUCCESS:IN_APP`))
    check('PAYMENT_SUCCESS sent after verified payment', paymentOk)

    const confirmRow = await prisma.customerNotification.findUnique({
      where: { dedupeKey: `order:${orderId}:ORDER_CONFIRMATION:IN_APP` },
    })
    check('Confirmation includes the order number', Boolean(confirmRow?.message.includes(order.referenceCode)),
      confirmRow?.message.slice(0, 60))
    check('Confirmation includes a tracking link', Boolean(confirmRow?.message.includes('track') || confirmRow?.message.includes('http')),
      '')

    const afterPaid = await inApp()
    await new Promise((resolve) => setTimeout(resolve, 400))

    // ── 3. Idempotent: re-verifying must not duplicate ───────────────────────
    await markOrderPaid(orderId, {
      provider: 'HARNESS',
      detail: 'Harness verified payment again',
      actorRole: 'TEST',
      amount: 5000,
    })
    await new Promise((resolve) => setTimeout(resolve, 400))
    check('Re-verification does not duplicate notifications', (await inApp()) === afterPaid, `${afterPaid} → ${await inApp()}`)

    // ── 4. Each status change notifies exactly once ──────────────────────────
    const adminToken = (await request('POST', '/api/auth/login', {
      json: { email: env.adminSeed.email, password: env.adminSeed.password },
    })).data?.token as string | undefined
    check('admin login', Boolean(adminToken))

    const move = (status: string) =>
      request('PATCH', `/api/admin/marketplace/orders/${order.referenceCode}/status`, { token: adminToken, json: { status } })

    for (const status of ['PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      const res = await move(status)
      const key = `order:${orderId}:ORDER_STATUS:${status}:IN_APP`
      const fired = await waitFor(() => hasKey(key))
      check(`Status ${status} notifies the customer`, res.status === 200 && fired, `http ${res.status}`)
    }

    // Re-firing the same status must not create a second row.
    const orderWithItems = await prisma.shopOrder.findUnique({ where: { id: orderId }, include: { items: true } })
    if (orderWithItems) {
      await notifyOrderStatus(orderWithItems, 'DELIVERED')
      await notifyOrderStatus(orderWithItems, 'DELIVERED')
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
    check('Repeated status update is deduped', (await inApp({ dedupeKey: `order:${orderId}:ORDER_STATUS:DELIVERED:IN_APP` })) === 1)

    // ── 5. Customer inbox API ────────────────────────────────────────────────
    const customerToken = (await request('POST', '/api/account/login', {
      json: { identifier: phone, password: 'NotifyCustomer1!' },
    })).data?.token as string | undefined
    check('customer login', Boolean(customerToken))

    const inbox = await request('GET', '/api/account/notifications?perPage=50', { token: customerToken })
    check('Inbox lists notification history', inbox.status === 200 && Array.isArray(inbox.data?.items) && inbox.data.items.length > 0,
      `status ${inbox.status}`)
    check('Inbox items carry the order number',
      Boolean(inbox.data?.items?.some((n: any) => n.orderReference === order.referenceCode)))
    check('Inbox never exposes payment info', !JSON.stringify(inbox.data ?? {}).toLowerCase().includes('card'))

    const unreadBefore = (await request('GET', '/api/account/notifications/unread-count', { token: customerToken })).data?.count ?? 0
    check('Unread count is positive', unreadBefore > 0, `count ${unreadBefore}`)

    const firstId = inbox.data?.items?.[0]?.id as number | undefined
    if (firstId) {
      await request('POST', `/api/account/notifications/${firstId}/read`, { token: customerToken })
      const unreadAfterOne = (await request('GET', '/api/account/notifications/unread-count', { token: customerToken })).data?.count ?? 0
      check('Marking one read decrements the unread count', unreadAfterOne === unreadBefore - 1, `${unreadBefore} → ${unreadAfterOne}`)
    }

    await request('POST', '/api/account/notifications/read-all', { token: customerToken })
    const unreadAfterAll = (await request('GET', '/api/account/notifications/unread-count', { token: customerToken })).data?.count ?? -1
    check('Mark-all-read clears the unread count', unreadAfterAll === 0, `count ${unreadAfterAll}`)
  } finally {
    if (customerId) await prisma.customerNotification.deleteMany({ where: { customerId } }).catch(() => undefined)
    if (orderId) {
      // CommissionLedger references both the order and its items (no cascade),
      // so it must go before the items and the order.
      await prisma.customerNotification.deleteMany({ where: { orderId } }).catch(() => undefined)
      await prisma.commissionLedger.deleteMany({ where: { orderId } }).catch(() => undefined)
      await prisma.shopPaymentEvent.deleteMany({ where: { orderId } }).catch(() => undefined)
      await prisma.shopRefund.deleteMany({ where: { orderId } }).catch(() => undefined)
      await prisma.shopOrderItem.deleteMany({ where: { orderId } }).catch(() => undefined)
      await prisma.shopOrder.delete({ where: { id: orderId } }).catch(() => undefined)
    }
    if (productId) await prisma.product.delete({ where: { id: productId } }).catch(() => undefined)
    if (vendorId) await prisma.vendor.delete({ where: { id: vendorId } }).catch(() => undefined)
    if (customerId) await prisma.customer.delete({ where: { id: customerId } }).catch(() => undefined)

    if (originalSettings) {
      await prisma.notificationSetting
        .update({
          where: { id: 1 },
          data: {
            emailEnabled: originalSettings.emailEnabled,
            smsEnabled: originalSettings.smsEnabled,
            whatsappEnabled: originalSettings.whatsappEnabled,
          },
        })
        .catch(() => undefined)
    } else {
      await prisma.notificationSetting.delete({ where: { id: 1 } }).catch(() => undefined)
    }
    invalidateNotificationConfig()

    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  console.log(results.join('\n'))
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error('[notifications-flow] crashed:', error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
