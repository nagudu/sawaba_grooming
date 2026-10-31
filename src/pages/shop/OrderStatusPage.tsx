import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  PackageCheck,
  ShoppingBag,
  Upload,
} from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/ToastNotification'
import { shopApi, type ShopOrder } from '../../api/shop'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Awaiting Payment',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  PROCESSING: 'Processing',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  SHIPPED: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
}

const PAYMENT_LABELS: Record<string, string> = {
  UNPAID: 'Not paid',
  PENDING_VERIFICATION: 'Under review',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
}

function StatusPill({ status, labels }: { status: string; labels: Record<string, string> }) {
  const tone =
    status === 'PAID' || status === 'DELIVERED'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : status === 'PENDING_VERIFICATION' || status === 'AWAITING_PAYMENT' || status === 'PROCESSING'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
        : status === 'REJECTED' || status === 'CANCELLED' || status === 'REFUNDED'
          ? 'border-red-500/40 bg-red-500/10 text-red-300'
          : 'border-sky-500/40 bg-sky-500/10 text-sky-300'
  return (
    <span className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider', tone)}>
      {labels[status] ?? status}
    </span>
  )
}

/**
 * Order confirmation + status page. Shows the full summary, payment state and
 * the payment actions relevant to the chosen method (receipt upload, transfer
 * reference, or Paystack verification on callback return).
 */
export default function OrderStatusPage() {
  const { reference = '' } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()

  const [order, setOrder] = useState<ShopOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState<string>(
    (location.state as { phone?: string } | null)?.phone ?? sessionStorage.getItem(`shop_order_phone_${reference}`) ?? '',
  )
  const [phoneInput, setPhoneInput] = useState('')
  const [busy, setBusy] = useState(false)

  const [receipt, setReceipt] = useState<File | null>(null)
  const [transferRef, setTransferRef] = useState('')

  const load = useCallback(
    async (phoneValue: string) => {
      if (!phoneValue) return
      setLoading(true)
      setError(null)
      try {
        const data = await shopApi.getOrder(reference, phoneValue)
        setOrder(data)
        sessionStorage.setItem(`shop_order_phone_${reference}`, phoneValue)
      } catch (err) {
        setError((err as Error).message)
        setOrder(null)
      } finally {
        setLoading(false)
      }
    },
    [reference],
  )

  // Auto-load when phone came from navigation state, or when Paystack redirects back.
  useEffect(() => {
    if (phone) {
      void load(phone)
    } else {
      setLoading(false)
    }
  }, [phone, load])

  // Paystack callback: ?reference=<paystack-ref> — verify server-side, then reload.
  useEffect(() => {
    const paystackRef = searchParams.get('reference')
    if (!paystackRef || !phone) return
    let cancelled = false
    ;(async () => {
      try {
        await shopApi.verifyPaystack(reference, paystackRef)
        if (!cancelled) showToast('Payment confirmed by Paystack!')
      } catch (err) {
        if (!cancelled) showToast((err as Error).message, 'error')
      } finally {
        if (!cancelled) void load(phone)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams, phone, reference, load, showToast])

  const submitReceipt = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!receipt || !order) return
    setBusy(true)
    try {
      const updated = await shopApi.submitReceipt(order.referenceCode, receipt, transferRef || undefined)
      setOrder(updated)
      showToast('Receipt submitted — your payment is under review.')
      setReceipt(null)
      setTransferRef('')
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitTransferReference = async () => {
    if (!order || !transferRef) return
    setBusy(true)
    try {
      const updated = await shopApi.submitTransferReference(order.referenceCode, transferRef)
      setOrder(updated)
      showToast('Transfer reference recorded — awaiting verification.')
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const payOnline = async () => {
    if (!order) return
    setBusy(true)
    try {
      const init = await shopApi.initPaystack(order.referenceCode)
      window.location.href = init.authorizationUrl
    } catch (err) {
      showToast((err as Error).message, 'error')
      setBusy(false)
    }
  }

  // ── Phone gate (guests arriving by link) ─────────────────────────────────
  if (!phone) {
    return (
      <div className="bg-night-950 pt-[112px] pb-20">
        <div className="container-app max-w-md">
          <div className="rounded-2xl border border-night-800 bg-night-900/60 p-6">
            <h1 className="font-display text-2xl text-night-50">Track your order</h1>
            <p className="mt-2 text-sm text-night-400">
              Enter the reference <span className="font-semibold text-gold-400">{reference}</span> and the
              phone number you ordered with.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                setPhone(phoneInput)
              }}
            >
              <input
                required
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                placeholder="Phone number"
                className="w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none"
              />
              <Button type="submit" variant="gold" size="md" fullWidth>
                View Order
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-night-950 pt-[72px] text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Loading order…</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="bg-night-950 pt-[112px] pb-20">
        <div className="container-app max-w-2xl">
          <EmptyState
            icon={<AlertTriangle className="h-10 w-10" />}
            title="Order not found"
            description={error ?? 'Check the reference and phone number and try again.'}
            action={
              <button
                type="button"
                onClick={() => {
                  setPhone('')
                  setPhoneInput('')
                }}
                className="mt-2 text-sm font-semibold text-gold-400 hover:text-gold-300"
              >
                Try another reference
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const needsReceipt =
    order.paymentMethod === 'BANK_TRANSFER' || order.paymentMethod === 'OPAY'
  const awaitingPayment = order.paymentStatus === 'UNPAID'
  const pendingReview = order.paymentStatus === 'PENDING_VERIFICATION'
  const paid = order.paymentStatus === 'PAID'

  return (
    <PageTransition>
      <div className="bg-night-950 pt-[96px] pb-20">
        <div className="container-app max-w-4xl">
          {/* Header */}
          <div
            className={cn(
              'rounded-2xl border p-6 sm:p-8',
              paid
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : pendingReview
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-night-800 bg-night-900/50',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-500">
                  Order {order.referenceCode}
                </p>
                <h1 className="mt-2 font-display text-3xl text-night-50">
                  {paid ? 'Payment confirmed' : pendingReview ? 'Payment under review' : 'Complete your payment'}
                </h1>
                <p className="mt-2 text-sm text-night-400">
                  Placed {new Date(order.createdAt).toLocaleString('en-GB')} ·{' '}
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusPill status={order.status} labels={STATUS_LABELS} />
                <StatusPill status={order.paymentStatus} labels={PAYMENT_LABELS} />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-night-800 pt-5">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-night-500">Total</p>
                <p className="font-display text-3xl text-gold-400">{formatPrice(order.totalAmount)}</p>
              </div>
              <div className="text-right text-sm text-night-300">
                <p>{order.customerName}</p>
                <p className="text-night-500">{order.customerPhone}</p>
                <p className="mt-1 text-xs text-night-500">
                  {(order.paymentMethod ?? 'Payment method unavailable').replace(/_/g, ' ')}
                  {order.transactionRef ? ` · Ref ${order.transactionRef}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Payment actions */}
          {awaitingPayment && order.paymentMethod === 'ONLINE' && (
            <div className="mt-6 rounded-2xl border border-night-800 bg-night-900/50 p-6">
              <h2 className="flex items-center gap-2 font-display text-xl text-night-50">
                <CreditCard className="h-5 w-5 text-gold-500" /> Pay with Paystack
              </h2>
              <p className="mt-2 text-sm text-night-400">
                Card, bank transfer and USSD through Paystack. Your order is confirmed the moment Paystack
                verifies the transaction on our server.
              </p>
              <Button variant="gold" size="lg" className="mt-4" loading={busy} onClick={payOnline}>
                Pay {formatPrice(order.totalAmount)}
              </Button>
            </div>
          )}

          {awaitingPayment && needsReceipt && (
            <div className="mt-6 rounded-2xl border border-night-800 bg-night-900/50 p-6">
              <h2 className="flex items-center gap-2 font-display text-xl text-night-50">
                <Banknote className="h-5 w-5 text-gold-500" /> Pay by {order.paymentMethod === 'OPAY' ? 'OPay' : 'bank transfer'}
              </h2>
              {order.paymentDetails && (
                <div className="mt-4 grid gap-3 rounded-xl border border-night-800 bg-night-950/60 p-4 sm:grid-cols-3">
                  {order.paymentDetails.bankName && (
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">Bank</p>
                      <p className="mt-1 text-sm text-night-100">{order.paymentDetails.bankName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">Account name</p>
                    <p className="mt-1 text-sm text-night-100">
                      {order.paymentDetails.accountName ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">Account number</p>
                    <p className="mt-1 text-sm text-night-100">
                      {order.paymentDetails.accountNumber ?? '—'}
                    </p>
                  </div>
                </div>
              )}
              {order.paymentDetails?.instructions && (
                <p className="mt-3 text-xs leading-relaxed text-night-400">
                  {order.paymentDetails.instructions}
                </p>
              )}

              <form onSubmit={submitReceipt} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                    Transfer reference (optional)
                  </span>
                  <input
                    value={transferRef}
                    onChange={(event) => setTransferRef(event.target.value)}
                    placeholder="e.g. 0123456789"
                    className="w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                    Upload receipt screenshot
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-night-300 file:mr-3 file:rounded-lg file:border file:border-gold-500/50 file:bg-gold-500/10 file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wider file:text-gold-300 hover:file:bg-gold-500/20"
                  />
                </label>
                <Button type="submit" variant="gold" size="md" loading={busy} disabled={!receipt}>
                  <Upload className="h-4 w-4" />
                  Submit Receipt for Verification
                </Button>
                {!receipt && (
                  <Button type="button" variant="outline" size="md" onClick={submitTransferReference} disabled={busy || !transferRef}>
                    Submit reference only
                  </Button>
                )}
              </form>
            </div>
          )}

          {pendingReview && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-200">Payment under review</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-100/80">
                  Your payment proof has been received. An administrator verifies every transfer against the
                  bank statement — you'll see this order update to <strong>Payment Confirmed</strong> once
                  it's approved. Keep this page handy: your reference is{' '}
                  <span className="font-semibold">{order.referenceCode}</span>.
                </p>
              </div>
            </div>
          )}

          {paid && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-200">Payment verified</p>
                <p className="mt-1 text-sm text-emerald-100/80">
                  Your order is confirmed and the vendor has been notified to prepare it for dispatch.
                </p>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
            <div className="border-b border-night-800 px-6 py-4">
              <h2 className="font-display text-lg text-night-50">Order Items</h2>
            </div>
            <ul className="divide-y divide-night-800">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 px-6 py-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-night-800 bg-night-950">
                    {item.productImage ? (
                      <img src={item.productImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-night-600">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-night-100">{item.productName}</p>
                        {item.variationLabel && (
                          <p className="mt-0.5 text-xs text-night-500">{item.variationLabel}</p>
                        )}
                        <p className="mt-0.5 text-xs text-night-500">
                          Sold by {item.vendorName} · {formatPrice(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg text-gold-400">{formatPrice(item.lineTotal)}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wider text-night-500">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </p>
                        {item.trackingInfo && (
                          <p className="mt-0.5 text-[11px] text-sky-300">{item.trackingInfo}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {order.history && order.history.length > 0 && (
            <section className="mt-6 rounded-2xl border border-night-800 bg-night-900/40 p-6">
              <h2 className="font-display text-lg text-night-50">Order and payment history</h2>
              <ol className="mt-4 space-y-4">
                {order.history.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-night-100">
                        {event.type === 'ITEM_STATUS_CHANGED'
                          ? `${event.detail?.split(':')[0] ?? 'Product'} update`
                          : event.type.replace(/_/g, ' ')}
                        {' · '}
                        {STATUS_LABELS[event.status] ?? event.status.replace(/_/g, ' ')}
                      </p>
                      {event.detail && (
                        <p className="mt-0.5 text-xs text-night-400">{event.detail}</p>
                      )}
                      <p className="mt-1 text-[11px] text-night-600">
                        {new Date(event.createdAt).toLocaleString('en-GB')}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Totals */}
          <div className="mt-6 rounded-2xl border border-night-800 bg-night-900/40 p-6">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-night-400">Subtotal</dt>
                <dd className="text-night-100">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-night-400">Delivery fee</dt>
                <dd className="text-night-100">
                  {order.deliveryFee === 0 ? 'Free' : formatPrice(order.deliveryFee)}
                </dd>
              </div>
              {order.refundedAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-red-300">Refunded</dt>
                  <dd className="text-red-300">-{formatPrice(order.refundedAmount)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-night-800 pt-3">
                <dt className="text-sm font-semibold text-night-200">Total</dt>
                <dd className="font-display text-2xl text-gold-400">{formatPrice(order.totalAmount)}</dd>
              </div>
            </dl>
            <div className="mt-5 flex items-center gap-2 text-xs text-night-500">
              <PackageCheck className="h-4 w-4 text-gold-500/70" />
              Delivery to: {order.deliveryAddress}
              {order.deliveryLocation ? ` · ${order.deliveryLocation}` : ''}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="rounded-lg border border-night-700 px-5 py-2.5 text-sm text-night-300 transition-colors hover:border-gold-500/60 hover:text-gold-300"
            >
              Continue shopping
            </Link>
            <button
              type="button"
              onClick={() => {
                setPhone('')
                setPhoneInput('')
                setError(null)
              }}
              className="rounded-lg border border-night-700 px-5 py-2.5 text-sm text-night-300 transition-colors hover:border-gold-500/60 hover:text-gold-300"
            >
              Look up another order
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
