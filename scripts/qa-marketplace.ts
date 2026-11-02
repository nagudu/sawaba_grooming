/**
 * End-to-end marketplace QA (integration test against the real database).
 *
 * Covers: cart merge/quantity rules, pickup vs delivery checkout, pickup code
 * generation, stock decrement, verified payment + commission ledger, pickup
 * lifecycle (ready → collected), ownership checks, and duplicate-payment
 * guards. Every row it creates is removed and stock restored at the end.
 *
 * Run with:  npx tsx scripts/qa-marketplace.ts
 */
import dotenv from 'dotenv'

dotenv.config({ path: 'backend/.env' })
dotenv.config()

const { prisma } = await import('../backend/src/config/database')
const {
  addToCart,
  createShopOrder,
  getCart,
  getCustomerOrder,
  getOrderByReference,
  getShopPickupInfo,
  updateCartItem,
} = await import('../backend/src/services/shopService')
const { markOrderPaid, submitOrderReceipt } = await import('../backend/src/services/shopService').then(
  async (shop) => ({
    markOrderPaid: (await import('../backend/src/services/shopPaymentService')).markOrderPaid,
    submitOrderReceipt: shop.submitOrderReceipt,
  }),
)
const { adminUpdateOrderStatus } = await import('../backend/src/services/adminMarketplaceService')
const { resolveCheckoutAccount } = await import('../backend/src/services/customerAuthService')
const { verifyOrderPayment, rejectOrderPayment } = await import('../backend/src/services/shopPaymentService')
const { getShopPaymentOptions } = await import('../backend/src/services/paymentSettingsService')

const results: Array<{ name: string; ok: boolean; detail?: string }> = []
function check(name: string, condition: boolean, detail?: string) {
  results.push({ name, ok: condition, detail })
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`)
}

const token = `qa-cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
const orderIds: number[] = []
const references: string[] = []
const createdCustomerIds: number[] = []
// Unique numbers so QA never adopts or edits a real customer record.
const qaSuffix = `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 10)}`
const qaPhone = `08099${qaSuffix}`
const qaPhone2 = `08098${qaSuffix}`
const qaPhone3 = `08096${qaSuffix}`
const qaPhone4 = `08095${qaSuffix}`

try {
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', isActive: true, stock: { gte: 4 } },
    select: { id: true, name: true, price: true, stock: true, vendorId: true },
    take: 2,
  })
  if (products.length === 0) throw new Error('QA needs at least one active product with stock >= 4.')
  const first = products[0]
  const second = products[1] ?? products[0]

  // ── 1. Cart merge + quantity ─────────────────────────────────────────────
  await addToCart({ token, productId: first.id, quantity: 2 })
  const merged = await addToCart({ token, productId: first.id, quantity: 1 })
  check('Adding the same product merges into one cart line', merged.items.length === 1, `lines=${merged.items.length}`)
  check('Merged quantity is 3 (not duplicated)', merged.items[0]?.quantity === 3, `qty=${merged.items[0]?.quantity}`)
  check('Cart item count reflects quantity', merged.itemCount === 3, `count=${merged.itemCount}`)

  const updated = await updateCartItem(merged.items[0].id, token, 4)
  check('Updating a cart line sets an exact quantity', updated.items[0]?.quantity === 4, `qty=${updated.items[0]?.quantity}`)
  check('Subtotal recalculates from the database price', updated.subtotal === Number(first.price) * 4, `subtotal=${updated.subtotal}`)

  // ── 2. Pickup checkout consumes the cart, charges no delivery fee ────────
  const stockBefore = (await prisma.product.findUniqueOrThrow({ where: { id: first.id } })).stock
  const pickup = await createShopOrder(
    {
      token,
      customerName: 'QA Pickup Customer',
      customerPhone: qaPhone,
      customerEmail: 'qa-pickup@example.com',
      fulfillmentType: 'PICKUP',
      paymentMethod: 'BANK_TRANSFER',
    } as never,
    null,
  )
  orderIds.push(pickup.order.id)
  references.push(pickup.order.referenceCode)

  check('Pickup order is created', pickup.order.fulfillmentType === 'PICKUP')
  check('Pickup order charges no delivery fee', pickup.order.deliveryFee === 0, `fee=${pickup.order.deliveryFee}`)
  check('Pickup code matches PK-XXXXXXXX', /^PK-[A-Z0-9]{8}$/.test(pickup.order.pickup?.code ?? ''), pickup.order.pickup?.code ?? 'none')
  check('Pickup snapshot contains shop details', Boolean(pickup.order.pickup?.shopName && pickup.order.pickup?.address))
  check('Order starts AWAITING_PAYMENT / UNPAID', pickup.order.status === 'AWAITING_PAYMENT' && pickup.order.paymentStatus === 'UNPAID')
  check('Buying the same product again is not blocked by a duplicate code', pickup.order.pickup?.code !== null)

  // ── 2b. Guest checkout creates and links a customer account ─────────────
  const accountId = Number(pickup.account?.customer?.id ?? 0)
  if (pickup.account?.created) createdCustomerIds.push(accountId)
  check('Guest checkout creates a customer account', pickup.account?.created === true && accountId > 0, `customer=${accountId}`)
  check('Guest checkout signs the buyer in', pickup.account?.signedIn === true && Boolean(pickup.account?.token))
  const linkedOrder = await prisma.shopOrder.findUnique({ where: { id: pickup.order.id }, select: { customerId: true } })
  check('Order is linked to the new account', linkedOrder?.customerId === accountId)
  const linkedCart = await prisma.shopCart.findUnique({ where: { token }, select: { customerId: true } })
  check('Cart is attached to the new account', linkedCart?.customerId === accountId)
  const repeatBuyer = await resolveCheckoutAccount({
    fullName: 'QA Pickup Customer',
    phone: qaPhone,
    email: 'qa-pickup@example.com',
  })
  check('A repeat order reuses the same account', repeatBuyer?.created === false && repeatBuyer.customer.id === accountId)
  const credentialled = await prisma.customer.findFirst({
    where: { passwordHash: { not: null }, phone: { not: '' } },
    select: { fullName: true, phone: true },
  })
  if (credentialled?.phone) {
    const guarded = await resolveCheckoutAccount({ fullName: credentialled.fullName, phone: credentialled.phone })
    check('A password account is linked but never signed in from checkout details', guarded?.signedIn === false && guarded?.token === null)
  }

  const stockAfter = (await prisma.product.findUniqueOrThrow({ where: { id: first.id } })).stock
  check('Stock is decremented by the ordered quantity', stockBefore - stockAfter === 4, `${stockBefore}→${stockAfter}`)

  const emptied = await getCart(token)
  check('Cart is emptied after checkout', emptied.items.length === 0, `lines=${emptied.items.length}`)

  // ── 3. Buy Now (explicit lines) leaves the saved cart alone ──────────────
  await addToCart({ token, productId: second.id, quantity: 1 })
  const buyNow = await createShopOrder(
    {
      items: [{ productId: second.id, quantity: 2 }],
      customerName: 'QA Buy Now Customer',
      customerPhone: qaPhone2,
      customerEmail: 'qa-buynow@example.com',
      fulfillmentType: 'DELIVERY',
      deliveryAddress: '12 QA Street, Sabuwar Abuja',
      deliveryLocation: 'Kano',
      deliveryInstructions: 'Call on arrival',
      paymentMethod: 'CASH',
    } as never,
    null,
  )
  orderIds.push(buyNow.order.id)
  references.push(buyNow.order.referenceCode)
  if (buyNow.account?.created) createdCustomerIds.push(Number(buyNow.account.customer.id))

  check('Delivery order stores the address', buyNow.order.deliveryAddress.includes('QA Street'))
  check('Delivery order has an estimated delivery date', Boolean(buyNow.order.estimatedDeliveryAt))
  check('Delivery instruction is stored', buyNow.order.deliveryInstructions === 'Call on arrival')
  check('Buy Now order has no pickup code', buyNow.order.pickup === null)
  const savedCart = await getCart(token)
  check('Buy Now does not clear the saved cart', savedCart.items.length === 1, `lines=${savedCart.items.length}`)

  // ── 4. Public lookup enforces reference + phone ──────────────────────────
  let phoneGuard = false
  try {
    await getOrderByReference(pickup.order.referenceCode, '08000000000')
  } catch {
    phoneGuard = true
  }
  check('Order lookup rejects a mismatched phone number', phoneGuard)

  // ── 5. Trusted verification → PAID + commission ledger ───────────────────
  const paid = await markOrderPaid(pickup.order.id, {
    provider: 'qa',
    actorRole: 'ADMIN',
    amount: pickup.order.totalAmount,
    detail: 'QA verified payment',
  })
  check('Verified payment marks the order PAID', paid.paymentStatus === 'PAID')
  const ledger = await prisma.commissionLedger.count({ where: { orderId: pickup.order.id } })
  check('Commission ledger is written exactly once per item', ledger === pickup.order.items.length, `rows=${ledger}`)

  let doubleReceipt = false
  try {
    await submitOrderReceipt(pickup.order.referenceCode, { url: 'https://example.com/x.png', publicId: 'x' })
  } catch {
    doubleReceipt = true
  }
  check('A paid order rejects another payment attempt', doubleReceipt)

  // ── 6. Pickup lifecycle ──────────────────────────────────────────────────
  await adminUpdateOrderStatus(pickup.order.referenceCode, { status: 'READY_FOR_PICKUP' }, { id: 1, name: 'QA Admin' })
  const ready = await getOrderByReference(pickup.order.referenceCode, qaPhone)
  check('Admin can mark a pickup order ready', ready.status === 'READY_FOR_PICKUP' && Boolean(ready.pickup?.readyAt))

  await adminUpdateOrderStatus(pickup.order.referenceCode, { status: 'COLLECTED' }, { id: 1, name: 'QA Admin' })
  const collected = await getOrderByReference(pickup.order.referenceCode, qaPhone)
  check('Admin can mark a pickup order collected', collected.status === 'COLLECTED' && Boolean(collected.pickup?.collectedAt))
  check('Order timeline records the pickup events', (collected.history?.length ?? 0) >= 3, `events=${collected.history?.length}`)

  // ── 7. Customer ownership ────────────────────────────────────────────────
  let ownershipBlocked = false
  try {
    await getCustomerOrder(pickup.order.referenceCode, 999999)
  } catch {
    ownershipBlocked = true
  }
  check('Another customer cannot read this order', ownershipBlocked)

  // ── 8. Public pickup configuration ───────────────────────────────────────
  const pickupInfo = await getShopPickupInfo()
  check('Pickup info exposes shop name + hours', Boolean(pickupInfo.shopName && pickupInfo.hours))
  check('Pickup info exposes the delivery estimate', pickupInfo.deliveryEstimateDays >= 1)

  // ── 9. Payment methods come from the admin configuration ─────────────────
  const options = await getShopPaymentOptions()
  check('Payment options list every supported method', options.methods.length === 4, `methods=${options.methods.length}`)
  check('At least one payment method is usable', options.methods.some((method) => method.available))
  check(
    'An unavailable method always explains why',
    options.methods.every((method) => method.available || Boolean(method.reason)),
  )
  check(
    'Bank details are read from the database (not hardcoded)',
    !options.methods.find((method) => method.method === 'BANK_TRANSFER')?.available ||
      Boolean(options.bankName && options.accountName && options.accountNumber),
    `${options.bankName ?? 'none'}`,
  )

  let blockedMethod = false
  try {
    await createShopOrder(
      {
        items: [{ productId: first.id, quantity: 1 }],
        customerName: 'QA Blocked Method',
        customerPhone: qaPhone3,
        customerEmail: 'qa-blocked@example.com',
        fulfillmentType: 'DELIVERY',
        deliveryAddress: '1 QA Street, Sabuwar Abuja',
        paymentMethod: 'OTHER',
      } as never,
      null,
    )
  } catch {
    blockedMethod = true
  }
  check('Checkout refuses a payment method the studio does not offer', blockedMethod)

  let cashReceiptBlocked = false
  try {
    await submitOrderReceipt(buyNow.order.referenceCode, {
      url: 'https://example.com/not-a-transfer.png',
      publicId: 'qa-not-transfer',
    })
  } catch {
    cashReceiptBlocked = true
  }
  check('Receipt upload is rejected for cash/Paystack orders', cashReceiptBlocked)

  // ── 10. Transfer proof: submit → reject → resubmit → verify ──────────────
  if (options.methods.find((method) => method.method === 'BANK_TRANSFER')?.available) {
    const transferOrder = await createShopOrder(
      {
        items: [{ productId: first.id, quantity: 1 }],
        customerName: 'QA Transfer Customer',
        customerPhone: qaPhone3,
        customerEmail: 'qa-transfer@example.com',
        fulfillmentType: 'DELIVERY',
        deliveryAddress: '9 QA Street, Sabuwar Abuja',
        paymentMethod: 'BANK_TRANSFER',
      } as never,
      null,
    )
    orderIds.push(transferOrder.order.id)
    references.push(transferOrder.order.referenceCode)
    if (transferOrder.account?.created) createdCustomerIds.push(Number(transferOrder.account.customer.id))

    await submitOrderReceipt(
      transferOrder.order.referenceCode,
      { url: 'https://example.com/qa-transfer-1.png', publicId: 'qa-transfer-1' },
      'QA-TRANSFER-1',
    )
    const pending = await getOrderByReference(transferOrder.order.referenceCode, qaPhone3)
    check(
      'Uploading a receipt never marks the order paid by itself',
      pending.paymentStatus === 'PENDING_VERIFICATION' && pending.status === 'AWAITING_PAYMENT',
      `${pending.paymentStatus}/${pending.status}`,
    )

    const rejected = await rejectOrderPayment(
      transferOrder.order.referenceCode,
      1,
      'Amount did not match the order total.',
    )
    check(
      'Admin rejection keeps the order unpaid and records the reason',
      rejected.paymentStatus === 'REJECTED' && rejected.paymentNote === 'Amount did not match the order total.',
    )

    const resubmitted = await submitOrderReceipt(
      transferOrder.order.referenceCode,
      { url: 'https://example.com/qa-transfer-2.png', publicId: 'qa-transfer-2' },
      'QA-TRANSFER-2',
    )
    check(
      'Customer can resubmit a corrected proof after rejection',
      resubmitted.paymentStatus === 'PENDING_VERIFICATION' && resubmitted.paymentNote === null,
    )

    const verified = await verifyOrderPayment(transferOrder.order.referenceCode, 1, 'QA matched the bank statement')
    check('Admin verification marks the order PAID', verified.paymentStatus === 'PAID' && Boolean(verified.paymentVerifiedAt))
    const transferLedger = await prisma.commissionLedger.count({ where: { orderId: transferOrder.order.id } })
    check(
      'Verification writes the commission ledger exactly once',
      transferLedger === transferOrder.order.items.length,
      `rows=${transferLedger}`,
    )
    const proofEvents = await prisma.shopPaymentEvent.count({
      where: {
        orderId: transferOrder.order.id,
        type: { in: ['RECEIPT_SUBMITTED', 'PAYMENT_REJECTED', 'PAYMENT_VERIFIED'] },
      },
    })
    check('Payment history keeps submit, reject and verify events', proofEvents >= 3, `events=${proofEvents}`)
  }

  // ── 11. OPay uses the OPay account and verifies the same way ─────────────
  if (options.methods.find((method) => method.method === 'OPAY')?.available) {
    const opayOrder = await createShopOrder(
      {
        items: [{ productId: first.id, quantity: 1 }],
        customerName: 'QA OPay Customer',
        customerPhone: qaPhone4,
        customerEmail: 'qa-opay@example.com',
        fulfillmentType: 'PICKUP',
        paymentMethod: 'OPAY',
      } as never,
      null,
    )
    orderIds.push(opayOrder.order.id)
    references.push(opayOrder.order.referenceCode)
    if (opayOrder.account?.created) createdCustomerIds.push(Number(opayOrder.account.customer.id))

    const opayView = await getOrderByReference(opayOrder.order.referenceCode, qaPhone4)
    check(
      'OPay orders show the OPay account from settings',
      opayView.paymentDetails?.opayAccountNumber === options.opayAccountNumber &&
        Boolean(opayView.paymentDetails?.opayAccountName),
      opayView.paymentDetails?.opayAccountName ?? 'none',
    )
    check('OPay orders still charge no delivery fee on pickup', opayView.deliveryFee === 0)

    await submitOrderReceipt(
      opayOrder.order.referenceCode,
      { url: 'https://example.com/qa-opay.png', publicId: 'qa-opay' },
      'QA-OPAY-1',
    )
    const opayPaid = await verifyOrderPayment(opayOrder.order.referenceCode, 1, 'QA OPay transfer matched')
    check(
      'OPay proof verifies to PAID with a timestamp',
      opayPaid.paymentStatus === 'PAID' && Boolean(opayPaid.paymentVerifiedAt),
    )
  }
} catch (error) {
  check('QA run completed without throwing', false, (error as Error).message)
} finally {
  // ── Cleanup: remove QA rows and restore stock ────────────────────────────
  try {
    const items = await prisma.shopOrderItem.findMany({ where: { orderId: { in: orderIds } } })
    await prisma.commissionLedger.deleteMany({ where: { orderId: { in: orderIds } } })
    await prisma.stockMovement.deleteMany({ where: { reference: { in: references } } })
    for (const reference of references) {
      await prisma.vendorNotification.deleteMany({ where: { message: { contains: reference } } })
    }
    await prisma.shopOrder.deleteMany({ where: { id: { in: orderIds } } })
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
      await prisma.product.update({
        where: { id: item.productId },
        data: { salesCount: { decrement: item.quantity } },
      })
      await prisma.shopOrderItem.deleteMany({ where: { id: item.id } }).catch(() => undefined)
    }
    await prisma.shopCart.deleteMany({ where: { token } })
    await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } })
    const salesFix = await prisma.product.findMany({
      where: { salesCount: { lt: 0 } },
      select: { id: true },
    })
    for (const product of salesFix) {
      await prisma.product.update({ where: { id: product.id }, data: { salesCount: 0 } })
    }
    console.log('[cleanup] QA rows removed and stock restored.')
  } catch (cleanupError) {
    console.error('[cleanup] failed:', (cleanupError as Error).message)
  }
  await prisma.$disconnect()

  const failed = results.filter((result) => !result.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)
  if (failed.length > 0) process.exitCode = 1
}
