import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  CreditCard,
  MapPin,
  PackageCheck,
  Printer,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/ToastNotification'
import { shopApi, type ShopOrder } from '../../api/shop'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const ORDER_STATUS: Record<string, string> = {
  AWAITING_PAYMENT: 'Pending Payment',
  PAYMENT_CONFIRMED: 'Paid',
  PROCESSING: 'Processing',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  READY_FOR_PICKUP: 'Ready for Pickup',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  RETURNED: 'Returned',
}

const PAYMENT_STATUS: Record<string, string> = {
  UNPAID: 'Pending Payment',
  PENDING_VERIFICATION: 'Payment Under Review',
  PAID: 'Paid',
  REJECTED: 'Payment Rejected',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
}

const DELIVERY_STEPS = [
  'AWAITING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'PROCESSING',
  'READY_FOR_DISPATCH',
  'SHIPPED',
  'DELIVERED',
]
const PICKUP_STEPS = ['AWAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'COLLECTED']

function tone(status: string): string {
  if (['PAID', 'DELIVERED', 'COLLECTED', 'PAYMENT_CONFIRMED'].includes(status)) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  }
  if (['CANCELLED', 'REJECTED', 'REFUNDED', 'RETURNED'].includes(status)) {
    return 'border-red-500/30 bg-red-500/10 text-red-300'
  }
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
}

/** Account-scoped order detail: tracking, receipts, pickup code, payment history. */
export default function CustomerOrderDetailPage() {
  const { reference = '' } = useParams()
  const { showToast } = useToast()
  const [order, setOrder] = useState<ShopOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setOrder(await shopApi.myOrder(reference))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [reference])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Loading order…</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-10 w-10" />}
        title="Order not found"
        description={error ?? 'This order does not belong to your account.'}
        action={
          <Link to="/account/orders" className="text-sm font-semibold text-gold-400 hover:text-gold-300">
            Back to my orders
          </Link>
        }
      />
    )
  }

  const steps = order.fulfillmentType === 'PICKUP' ? PICKUP_STEPS : DELIVERY_STEPS
  const currentIndex = steps.indexOf(order.status)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-night-400 hover:text-gold-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All orders
          </Link>
          <h1 className="mt-2 font-display text-3xl text-night-50">Order {order.referenceCode}</h1>
          <p className="mt-1 text-sm text-night-400">
            Placed {new Date(order.createdAt).toLocaleString('en-GB')} ·{' '}
            {order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={cn('rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider', tone(order.status))}>
            {ORDER_STATUS[order.status] ?? order.status}
          </span>
          <span className={cn('rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider', tone(order.paymentStatus))}>
            {PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus}
          </span>
        </div>
      </div>

      {/* Tracking */}
      <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
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
            This order was cancelled.
          </p>
        ) : (
          <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {steps.map((step, index) => {
              const done = currentIndex >= 0 && index <= currentIndex
              return (
                <li key={step} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'h-2.5 w-2.5 shrink-0 rounded-full',
                      done ? 'bg-gold-500' : 'bg-night-700',
                      index === currentIndex && 'ring-4 ring-gold-500/20',
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

      {/* Fulfilment */}
      {order.fulfillmentType === 'PICKUP' && order.pickup ? (
        <section className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
              <Store className="h-5 w-5 text-gold-400" /> Store pickup
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
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-night-500">Pickup code</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-gold-300">
                {order.pickup.code ?? '—'}
              </p>
              <p className="mt-2 text-xs text-night-400">
                Bring this code and your order number when collecting.
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
          <div className="flex justify-between border-t border-night-800 pt-2 font-semibold">
            <dt className="text-night-200">Total</dt>
            <dd className="font-display text-xl text-gold-400">{formatPrice(order.totalAmount)}</dd>
          </div>
        </dl>
      </section>

      {/* Payment history */}
      <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
          <CreditCard className="h-5 w-5 text-gold-500" /> Payment history
        </h2>
        <p className="mt-2 text-xs text-night-400">
          Method: {(order.paymentMethod ?? '—').replace(/_/g, ' ')}
          {order.transactionRef ? ` · Reference ${order.transactionRef}` : ''}
          {order.paymentAttempts > 1 ? ` · ${order.paymentAttempts} payment attempts` : ''}
        </p>
        {order.history?.length ? (
          <ol className="mt-4 space-y-3">
            {order.history.map((event) => (
              <li key={event.id} className="flex gap-3 text-xs">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                <div className="min-w-0">
                  <p className="font-semibold text-night-200">
                    {event.type.replace(/_/g, ' ')}
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
          <p className="mt-3 text-xs text-night-500">No payment activity recorded yet.</p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to={`/shop/orders/${encodeURIComponent(order.referenceCode)}/receipt`}
          state={{ phone: order.customerPhone }}
          className="inline-flex items-center gap-2 rounded-lg border border-gold-500/40 px-4 py-2 text-sm font-semibold text-gold-300 hover:bg-gold-500/10"
        >
          <Printer className="h-4 w-4" /> View / print receipt
        </Link>
        <Link
          to={`/shop/orders/${encodeURIComponent(order.referenceCode)}`}
          state={{ phone: order.customerPhone }}
          className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-sm font-semibold text-night-300 hover:border-gold-500/50 hover:text-gold-300"
        >
          <PackageCheck className="h-4 w-4" /> Payment & tracking actions
        </Link>
      </div>
    </div>
  )
}
