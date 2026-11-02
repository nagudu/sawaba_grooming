import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  CreditCard,
  History,
  MapPin,
  PackageSearch,
  Printer,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
} from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/ToastNotification'
import { shopApi, type ShopOrder } from '../../api/shop'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const ORDER_STATUS: Record<string, string> = {
  AWAITING_PAYMENT: 'Awaiting Payment',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  PROCESSING: 'Processing',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  READY_FOR_PICKUP: 'Ready for Pickup',
  SHIPPED: 'Out for Delivery',
  DELIVERED: 'Delivered',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
}

const PAYMENT_STATUS: Record<string, string> = {
  UNPAID: 'Not Paid',
  PENDING_VERIFICATION: 'Under Review',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
}

const DELIVERY_STEPS = ['AWAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'DELIVERED']
const PICKUP_STEPS = ['AWAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'COLLECTED']

function tone(status: string): string {
  if (['PAID', 'DELIVERED', 'COLLECTED', 'PAYMENT_CONFIRMED'].includes(status)) {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  }
  if (['CANCELLED', 'REJECTED', 'REFUNDED', 'RETURNED'].includes(status)) {
    return 'border-red-500/40 bg-red-500/10 text-red-300'
  }
  return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
}

function Pill({ status, labels }: { status: string; labels: Record<string, string> }) {
  return (
    <span className={cn('inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider', tone(status))}>
      {labels[status] ?? status.replace(/_/g, ' ')}
    </span>
  )
}

function Timeline({ order }: { order: ShopOrder }) {
  const steps = order.fulfillmentType === 'PICKUP' ? PICKUP_STEPS : DELIVERY_STEPS
  const current = steps.indexOf(order.status)
  return (
    <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
        {order.fulfillmentType === 'PICKUP' ? <Store className="h-5 w-5 text-gold-500" /> : <Truck className="h-5 w-5 text-gold-500" />}
        {order.fulfillmentType === 'PICKUP' ? 'Pickup tracking' : 'Delivery tracking'}
      </h2>
      {order.status === 'CANCELLED' ? (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          This order was cancelled.
        </p>
      ) : (
        <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-2 sm:grid sm:grid-cols-3 lg:grid-cols-6">
          {steps.map((step, index) => {
            const done = current >= 0 && index <= current
            return (
              <li key={step} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    done ? 'bg-gold-500' : 'bg-night-700',
                    index === current && 'ring-4 ring-gold-500/20',
                  )}
                />
                <span className={done ? 'text-night-100' : 'text-night-500'}>
                  {ORDER_STATUS[step] ?? step}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function LookupForm({
  reference,
  contact,
  setReference,
  setContact,
  onSubmit,
  busy,
  error,
}: {
  reference: string
  contact: string
  setReference: (value: string) => void
  setContact: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  busy: boolean
  error: string | null
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-night-800 bg-night-900/60 p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
          <PackageSearch className="h-5 w-5" />
        </span>
        <h1 className="mt-4 font-display text-2xl text-night-50">Track your order</h1>
        <p className="mt-2 text-sm text-night-400">
          Enter your order number and the phone number or email you used at checkout. No account needed.
        </p>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
              Order number
            </span>
            <input
              required
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. SGS-2026-0001"
              className="w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
              Phone or email
            </span>
            <input
              required
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="0801 234 5678 or you@example.com"
              className="w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none"
            />
          </label>
          <Button type="submit" variant="gold" size="lg" fullWidth loading={busy}>
            <Search className="h-4 w-4" /> Find my order
          </Button>
        </form>

        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-night-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500/70" />
          For your privacy we only show an order when the order number and contact details match.
        </p>
      </div>
    </div>
  )
}

function OrderDetails({
  order,
  token,
  onCopy,
  copied,
}: {
  order: ShopOrder
  token: string
  onCopy: () => void
  copied: boolean
}) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const receiptHref = `/shop/orders/${encodeURIComponent(order.referenceCode)}/receipt?token=${encodeURIComponent(token)}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-night-800 bg-night-900/50 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-500">
              Order {order.referenceCode}
            </p>
            <h1 className="mt-2 font-display text-3xl text-night-50">Order details</h1>
            <p className="mt-2 text-sm text-night-400">
              Placed {new Date(order.createdAt).toLocaleString('en-GB')} · {itemCount} item{itemCount === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Pill status={order.status} labels={ORDER_STATUS} />
            <Pill status={order.paymentStatus} labels={PAYMENT_STATUS} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-night-800 pt-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-night-500">Total</p>
            <p className="font-display text-3xl text-gold-400">{formatPrice(order.totalAmount)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-2 rounded-lg border border-gold-500/40 px-4 py-2 text-sm font-semibold text-gold-300 transition-colors hover:bg-gold-500/10"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Link copied' : 'Copy tracking link'}
            </button>
            <Link
              to={receiptHref}
              className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-sm font-semibold text-night-300 transition-colors hover:border-gold-500/50 hover:text-gold-300"
            >
              <Printer className="h-4 w-4" /> Receipt
            </Link>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-night-500">
          Bookmark this page or keep the tracking link — it opens this order without signing in.
        </p>
      </div>

      <Timeline order={order} />

      {/* Customer + payment */}
      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
            <UserRound className="h-5 w-5 text-gold-500" /> Customer
          </h2>
          <p className="mt-3 text-sm font-semibold text-night-100">{order.customerName}</p>
          <p className="mt-1 text-sm text-night-300">{order.customerPhone}</p>
          {order.customerEmail && <p className="text-sm text-night-300">{order.customerEmail}</p>}
        </section>
        <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
            <CreditCard className="h-5 w-5 text-gold-500" /> Payment
          </h2>
          <p className="mt-3 text-sm text-night-200">
            Method: <span className="text-night-100">{(order.paymentMethod ?? '—').replace(/_/g, ' ')}</span>
          </p>
          <p className="mt-1 text-sm text-night-200">
            Status: <span className="text-night-100">{PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus}</span>
          </p>
          {order.transactionRef && <p className="mt-1 text-xs text-night-500">Transaction ref: {order.transactionRef}</p>}
          {order.paymentAttempts > 1 && (
            <p className="mt-1 text-xs text-night-500">{order.paymentAttempts} payment attempts</p>
          )}
          {order.paymentNote && (
            <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {order.paymentNote}
            </p>
          )}
        </section>
      </div>

      {/* Fulfilment */}
      {order.fulfillmentType === 'PICKUP' && order.pickup ? (
        <section className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
            <Store className="h-5 w-5 text-gold-400" /> Store pickup
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">Pickup code</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-gold-300">
                {order.pickup.code ?? '—'}
              </p>
              <p className="mt-2 text-xs text-night-400">Bring this code and your order number when collecting.</p>
            </div>
            <div className="text-sm text-night-300">
              <p className="font-semibold text-night-100">{order.pickup.shopName}</p>
              {order.pickup.address && (
                <p className="mt-1 flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" /> {order.pickup.address}
                </p>
              )}
              {order.pickup.phone && <p className="mt-1">{order.pickup.phone}</p>}
              {order.pickup.hours && (
                <p className="mt-1 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gold-500" /> {order.pickup.hours}
                </p>
              )}
              {order.pickup.mapUrl && (
                <a
                  href={order.pickup.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 underline"
                >
                  <MapPin className="h-3.5 w-3.5" /> Get directions
                </a>
              )}
            </div>
          </div>
          {order.pickup.instructions && (
            <p className="mt-4 border-t border-gold-500/20 pt-3 text-xs leading-relaxed text-night-300">
              {order.pickup.instructions}
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
            <Truck className="h-5 w-5 text-gold-500" /> Delivery information
          </h2>
          <p className="mt-3 text-sm text-night-100">{order.deliveryAddress}</p>
          {order.deliveryLocation && <p className="text-xs text-night-400">{order.deliveryLocation}</p>}
          {order.deliveryInstructions && (
            <p className="mt-2 text-xs text-night-400">Instruction: {order.deliveryInstructions}</p>
          )}
          <p className="mt-2 flex items-center gap-2 text-xs text-night-400">
            <Clock className="h-3.5 w-3.5 text-gold-500" />
            {order.estimatedDeliveryAt
              ? `Estimated delivery ${new Date(order.estimatedDeliveryAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}`
              : 'Estimated delivery confirmed after payment.'}
          </p>
        </section>
      )}

      {/* Items */}
      <section className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
        <h2 className="border-b border-night-800 px-5 py-4 font-display text-lg text-night-50">Items</h2>
        <ul className="divide-y divide-night-800">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-3 px-5 py-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-night-800 bg-night-950">
                {item.productImage ? (
                  <img src={item.productImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-night-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-night-100">{item.productName}</p>
                <p className="mt-0.5 text-xs text-night-500">
                  {item.vendorName} · Qty {item.quantity}
                  {item.variationLabel ? ` · ${item.variationLabel}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-night-500">
                  {formatPrice(item.unitPrice)} each · {ORDER_STATUS[item.status] ?? item.status.replace(/_/g, ' ')}
                </p>
                {item.trackingInfo && <p className="mt-0.5 text-xs text-sky-300">{item.trackingInfo}</p>}
              </div>
              <p className="shrink-0 text-sm font-semibold text-night-100">{formatPrice(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-night-800 p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-night-400">Subtotal</dt>
            <dd className="text-night-100">{formatPrice(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-night-400">Delivery</dt>
            <dd className="text-night-100">{order.deliveryFee === 0 ? 'Free' : formatPrice(order.deliveryFee)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-night-400">Discount</dt>
              <dd className="text-night-100">-{formatPrice(order.discount)}</dd>
            </div>
          )}
          {order.refundedAmount > 0 && (
            <div className="flex justify-between">
              <dt className="text-red-300">Refunded</dt>
              <dd className="text-red-300">-{formatPrice(order.refundedAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-night-800 pt-2 font-semibold">
            <dt className="text-night-200">Total</dt>
            <dd className="font-display text-xl text-gold-400">{formatPrice(order.totalAmount)}</dd>
          </div>
        </dl>
      </section>

      {/* History */}
      <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
          <History className="h-5 w-5 text-gold-500" /> Order history
        </h2>
        {order.history?.length ? (
          <ol className="mt-4 space-y-3">
            {order.history.map((event) => (
              <li key={event.id} className="flex gap-3 text-xs">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                <div className="min-w-0">
                  <p className="font-semibold text-night-200">
                    {event.type === 'ITEM_STATUS_CHANGED'
                      ? `${event.detail?.split(':')[0] ?? 'Product'} update`
                      : event.type.replace(/_/g, ' ')}
                    {event.status ? ` · ${event.status.replace(/_/g, ' ')}` : ''}
                  </p>
                  {event.detail && <p className="mt-0.5 text-night-400">{event.detail}</p>}
                  <p className="mt-0.5 text-[10px] text-night-600">
                    {new Date(event.createdAt).toLocaleString('en-GB')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-xs text-night-500">Updates will appear here as your order progresses.</p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to={receiptHref}
          className="inline-flex items-center gap-2 rounded-lg border border-gold-500/40 px-5 py-2.5 text-sm font-semibold text-gold-300 transition-colors hover:bg-gold-500/10"
        >
          <Printer className="h-4 w-4" /> View / print receipt
        </Link>
        <Link
          to="/shop"
          className="rounded-lg border border-night-700 px-5 py-2.5 text-sm text-night-300 transition-colors hover:border-gold-500/60 hover:text-gold-300"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  )
}

/**
 * Guest order tracking. A signed, expiring token in the URL (`?token=`) opens
 * the order read-only — no account, no OTP. Without a token, the customer can
 * look up an order with its number plus the phone or email used at checkout.
 */
export default function TrackOrderPage() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [order, setOrder] = useState<ShopOrder | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadByToken = useCallback(async (value: string) => {
    setLoading(true)
    setError(null)
    try {
      setOrder(await shopApi.getTrackedOrder(value))
    } catch (err) {
      setError((err as Error).message)
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token && !order) void loadByToken(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const submitLookup = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await shopApi.lookupOrder(reference.trim(), contact.trim())
      setOrder(result.order)
      setSearchParams({ token: result.token }, { replace: true })
      showToast('Order found.')
    } catch (err) {
      setError((err as Error).message)
      setOrder(null)
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/track?token=${encodeURIComponent(token)}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
      showToast('Tracking link copied.')
    } catch {
      showToast('Could not copy the link. Please copy it from the address bar.', 'error')
    }
  }

  return (
    <PageTransition>
      <div className="bg-night-950 pt-[96px] pb-20">
        <div className="container-app max-w-4xl">
          {loading ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-night-400">
              <LoadingSpinner className="h-8 w-8 text-gold-500" />
              <p className="text-sm">Loading your order…</p>
            </div>
          ) : order ? (
            <OrderDetails order={order} token={token} onCopy={copyLink} copied={copied} />
          ) : (
            <LookupForm
              reference={reference}
              contact={contact}
              setReference={setReference}
              setContact={setContact}
              onSubmit={submitLookup}
              busy={busy}
              error={error}
            />
          )}
        </div>
      </div>
    </PageTransition>
  )
}
