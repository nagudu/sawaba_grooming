import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  MapPin,
  PackageCheck,
  Printer,
  ShoppingBag,
  Store,
  Truck,
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
  READY_FOR_PICKUP: 'Ready for Pickup',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  SHIPPED: 'Out for Delivery',
  DELIVERED: 'Delivered',
  COLLECTED: 'Collected',
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

/** Copies a value to the clipboard and confirms it inline. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard blocked (insecure origin): the value is still on screen.
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-night-700 px-2.5 py-1.5 text-[11px] font-semibold text-night-300 transition-colors hover:border-gold-500/50 hover:text-gold-300"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

const DELIVERY_TIMELINE = [
  'AWAITING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'PROCESSING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]
const PICKUP_TIMELINE = [
  'AWAITING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'COLLECTED',
]

function TrackingTimeline({ order }: { order: ShopOrder }) {
  const steps = order.fulfillmentType === 'PICKUP' ? PICKUP_TIMELINE : DELIVERY_TIMELINE
  // Legacy SHIPPED orders map onto the "Out for Delivery" step.
  const currentIndex = steps.indexOf(order.status === 'SHIPPED' ? 'OUT_FOR_DELIVERY' : order.status)
  return (
    <section className="mt-6 rounded-2xl border border-night-800 bg-night-900/40 p-6">
      <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
        {order.fulfillmentType === 'PICKUP' ? (
          <Store className="h-5 w-5 text-gold-500" />
        ) : (
          <Truck className="h-5 w-5 text-gold-500" />
        )}
        {order.fulfillmentType === 'PICKUP' ? 'Pickup tracking' : 'Delivery tracking'}
      </h2>
      {order.status === 'CANCELLED' ? (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          This order was cancelled. Contact support if you were charged.
        </p>
      ) : (
        <ol className="mt-5 space-y-0">
          {steps.map((step, index) => {
            const done = currentIndex >= 0 && index <= currentIndex
            const active = index === currentIndex
            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'mt-1 flex h-3 w-3 shrink-0 rounded-full',
                      done ? 'bg-gold-500' : 'bg-night-700',
                      active && 'ring-4 ring-gold-500/20',
                    )}
                  />
                  {index < steps.length - 1 && (
                    <span className={cn('w-px flex-1', done ? 'bg-gold-500/60' : 'bg-night-800')} />
                  )}
                </div>
                <p
                  className={cn(
                    'pb-5 text-sm',
                    active ? 'font-semibold text-gold-300' : done ? 'text-night-200' : 'text-night-500',
                  )}
                >
                  {STATUS_LABELS[step] ?? step.replace(/_/g, ' ')}
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </section>
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
  const token = searchParams.get('token') ?? ''
  const { showToast } = useToast()

  const [order, setOrder] = useState<ShopOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState<string>(
    (location.state as { phone?: string } | null)?.phone ?? sessionStorage.getItem(`shop_order_phone_${reference}`) ?? '',
  )
  const [phoneInput, setPhoneInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const [receipt, setReceipt] = useState<File | null>(null)
  const [transferRef, setTransferRef] = useState('')

  const load = useCallback(
    async (phoneValue: string) => {
      if (!phoneValue && !token) return
      setLoading(true)
      setError(null)
      try {
        const data = token
          ? await shopApi.getTrackedOrder(token)
          : await shopApi.getOrder(reference, phoneValue)
        setOrder(data)
        if (phoneValue) sessionStorage.setItem(`shop_order_phone_${reference}`, phoneValue)
      } catch (err) {
        setError((err as Error).message)
        setOrder(null)
      } finally {
        setLoading(false)
      }
    },
    [reference, token],
  )

  // Auto-load when a tracking token is present, the phone came from navigation
  // state, or Paystack redirects back.
  useEffect(() => {
    if (phone || token) {
      void load(phone)
    } else {
      setLoading(false)
    }
  }, [phone, token, load])

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
  if (!phone && !token) {
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
  const rejected = order.paymentStatus === 'REJECTED'
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
                  Order Number
                </p>
                <p className="mt-0.5 font-mono text-sm text-night-100">{order.referenceCode}</p>
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
          {(awaitingPayment || rejected) && order.paymentMethod === 'ONLINE' && (
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

          {(awaitingPayment || rejected) && needsReceipt && (
            <div className="mt-6 rounded-2xl border border-night-800 bg-night-900/50 p-6">
              <h2 className="flex items-center gap-2 font-display text-xl text-night-50">
                <Banknote className="h-5 w-5 text-gold-500" /> Pay by {order.paymentMethod === 'OPAY' ? 'OPay' : 'bank transfer'}
              </h2>
              <div className="mt-4 rounded-xl border border-gold-500/30 bg-gold-500/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-night-400">Amount to pay</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-display text-3xl text-gold-300">{formatPrice(order.totalAmount)}</p>
                  <CopyButton value={String(order.totalAmount)} label="Copy amount" />
                </div>
                <p className="mt-1 text-xs text-night-400">
                  Transfer this exact amount and use order {order.referenceCode} as the narration so we can
                  match it quickly.
                </p>
              </div>

              {order.paymentDetails && (
                <div className="mt-3 grid gap-3 rounded-xl border border-night-800 bg-night-950/60 p-4 sm:grid-cols-3">
                  {order.paymentMethod === 'OPAY' ? (
                    <>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">OPay account name</p>
                        <p className="mt-1 text-sm text-night-100">
                          {order.paymentDetails.opayAccountName ?? '—'}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">OPay number</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="font-mono text-lg font-bold tracking-wide text-gold-300">
                            {order.paymentDetails.opayAccountNumber ?? '—'}
                          </p>
                          {order.paymentDetails.opayAccountNumber && (
                            <CopyButton value={order.paymentDetails.opayAccountNumber} label="Copy number" />
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">Bank</p>
                        <p className="mt-1 text-sm text-night-100">{order.paymentDetails.bankName ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">Account name</p>
                        <p className="mt-1 text-sm text-night-100">{order.paymentDetails.accountName ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">Account number</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="font-mono text-lg font-bold tracking-wide text-gold-300">
                            {order.paymentDetails.accountNumber ?? '—'}
                          </p>
                          {order.paymentDetails.accountNumber && (
                            <CopyButton value={order.paymentDetails.accountNumber} label="Copy number" />
                          )}
                        </div>
                      </div>
                    </>
                  )}
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
                    Transaction reference / session ID (optional)
                  </span>
                  <input
                    value={transferRef}
                    onChange={(event) => setTransferRef(event.target.value)}
                    placeholder="e.g. GTB-2026-000123456"
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

          {rejected && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-200">Payment could not be verified</p>
                <p className="mt-1 text-sm leading-relaxed text-red-100/80">
                  Your order is still saved and nothing was cancelled. You can retry the payment above, upload a
                  clearer receipt, or contact the studio with reference {order.referenceCode}.
                </p>
                {order.paymentNote && (
                  <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                    <span className="font-semibold">Reason from the studio:</span> {order.paymentNote}
                  </p>
                )}
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

          {order.pickup && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-gold-500/30 bg-gold-500/5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-500/20 px-6 py-4">
                <h2 className="flex items-center gap-2 font-display text-xl text-night-50">
                  <Store className="h-5 w-5 text-gold-400" /> Store pickup details
                </h2>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(order.pickup?.code ?? order.referenceCode)
                      setCopied(true)
                      showToast('Pickup code copied.')
                    } catch {
                      showToast('Could not copy — please copy it manually.', 'error')
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gold-500/40 px-3 py-1.5 text-xs font-semibold text-gold-300 hover:bg-gold-500/10"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy code'}
                </button>
              </div>
              <div className="grid gap-5 p-6 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">Pickup code</p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-gold-300">
                    {order.pickup.code ?? '—'}
                  </p>
                  <p className="mt-2 text-xs text-night-400">
                    Show this code and your order number at the studio counter.
                  </p>
                </div>
                <div className="text-sm text-night-300">
                  <p className="font-semibold text-night-100">{order.pickup.shopName}</p>
                  {order.pickup.address && (
                    <p className="mt-1 flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                      {order.pickup.address}
                    </p>
                  )}
                  {order.pickup.phone && <p className="mt-1">{order.pickup.phone}</p>}
                  {order.pickup.hours && (
                    <p className="mt-1 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gold-500" />
                      {order.pickup.hours}
                    </p>
                  )}
                  {order.pickup.mapUrl && (
                    <a
                      href={order.pickup.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 underline hover:text-gold-300"
                    >
                      <MapPin className="h-3.5 w-3.5" /> Get directions
                    </a>
                  )}
                </div>
              </div>
              {order.pickup.instructions && (
                <p className="border-t border-gold-500/20 px-6 py-4 text-xs leading-relaxed text-night-300">
                  {order.pickup.instructions}
                </p>
              )}
              <p className="border-t border-gold-500/20 px-6 py-3 text-xs text-night-400">
                {order.pickup.collectedAt
                  ? `Collected on ${new Date(order.pickup.collectedAt).toLocaleString('en-GB')}.`
                  : order.pickup.readyAt
                    ? 'Ready for collection — bring your code during opening hours.'
                    : order.paymentStatus === 'PAID'
                      ? 'We will mark this ready as soon as your items are packed.'
                      : 'Your pickup code is reserved. Collection opens once payment is confirmed.'}
              </p>
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
            <TrackingTimeline order={order} />
          )}

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
              {order.fulfillmentType === 'PICKUP' ? (
                <Store className="h-4 w-4 text-gold-500/70" />
              ) : (
                <PackageCheck className="h-4 w-4 text-gold-500/70" />
              )}
              <span>
                {order.fulfillmentType === 'PICKUP'
                  ? `Store pickup${order.pickup?.shopName ? ` · ${order.pickup.shopName}` : ''}`
                  : `Delivery to: ${order.deliveryAddress}${order.deliveryLocation ? ` · ${order.deliveryLocation}` : ''}`}
                {order.estimatedDeliveryAt
                  ? ` · estimated ${new Date(order.estimatedDeliveryAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  : ''}
              </span>
            </div>
            {order.deliveryInstructions && (
              <p className="mt-2 text-xs text-night-500">Instruction: {order.deliveryInstructions}</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={`/shop/orders/${encodeURIComponent(order.referenceCode)}/receipt${token ? `?token=${encodeURIComponent(token)}` : ''}`}
              state={{ phone }}
              className="inline-flex items-center gap-2 rounded-lg border border-gold-500/40 px-5 py-2.5 text-sm font-semibold text-gold-300 transition-colors hover:bg-gold-500/10"
            >
              <Printer className="h-4 w-4" /> View / print receipt
            </Link>
            {token && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const url =
                      order.trackingUrl ||
                      (token ? `${window.location.origin}/track?token=${encodeURIComponent(token)}` : '')
                    if (!url) {
                      showToast('Tracking link unavailable.', 'error')
                      return
                    }
                    await navigator.clipboard.writeText(url)
                    showToast('Tracking link copied.')
                  } catch {
                    showToast('Could not copy the link.', 'error')
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-5 py-2.5 text-sm text-night-300 transition-colors hover:border-gold-500/60 hover:text-gold-300"
              >
                <Copy className="h-4 w-4" /> Copy tracking link
              </button>
            )}
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
