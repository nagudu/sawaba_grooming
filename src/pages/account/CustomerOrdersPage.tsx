import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Clipboard, History, PackageCheck, ShoppingBag } from 'lucide-react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/ToastNotification'
import { useCustomerAuth } from '../../store/customerAuth'
import { shopApi, type ShopOrder } from '../../api/shop'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const ORDER_STATUS: Record<string, string> = {
  AWAITING_PAYMENT: 'Pending Payment',
  PAYMENT_CONFIRMED: 'Paid / Confirmed',
  PROCESSING: 'Processing',
  READY_FOR_DISPATCH: 'Ready for Dispatch',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
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

function badgeTone(status: string): string {
  if (['PAID', 'DELIVERED', 'PAYMENT_CONFIRMED'].includes(status)) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  }
  if (['CANCELLED', 'REJECTED', 'REFUNDED', 'RETURNED'].includes(status)) {
    return 'border-red-500/30 bg-red-500/10 text-red-300'
  }
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
}

export default function CustomerOrdersPage() {
  const { customer } = useCustomerAuth()
  const { showToast } = useToast()
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [copiedReference, setCopiedReference] = useState<string | null>(null)
  const perPage = 15

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await shopApi.myOrders(page)
      setOrders(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  async function copyPickupCode(reference: string) {
    try {
      await navigator.clipboard.writeText(reference)
      setCopiedReference(reference)
      showToast('Pickup code copied.')
    } catch {
      showToast('Could not copy the pickup code. Please copy it manually.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label-luxe mb-1">Marketplace</p>
        <h1 className="font-display text-3xl text-night-50">My Orders</h1>
        <p className="mt-2 text-sm text-night-400">
          Manage marketplace purchases, payment status, pickup references, and delivery updates from your existing SAWABA account.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16 text-night-400">
          <LoadingSpinner className="h-8 w-8 text-gold-500" />
          <p className="text-sm">Loading your orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title="No marketplace orders yet"
          description="Your shop purchases and their delivery updates will appear here."
          action={
            <Link to="/shop" className="text-sm font-semibold text-gold-400 hover:text-gold-300">
              Browse the Shop
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-400">
                    Order {order.referenceCode}
                  </p>
                  <p className="mt-1 text-xs text-night-500">
                    Placed {new Date(order.createdAt).toLocaleString('en-GB')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={cn('rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider', badgeTone(order.status))}>
                    {ORDER_STATUS[order.status] ?? order.status.replace(/_/g, ' ')}
                  </span>
                  <span className={cn('rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider', badgeTone(order.paymentStatus))}>
                    {PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-night-400">
                    Pickup / collection code
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold tracking-wider text-gold-300">
                    {order.referenceCode}
                  </p>
                  <p className="mt-1 text-[11px] text-night-500">
                    Keep this order reference handy for collection or order support.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyPickupCode(order.referenceCode)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gold-500/30 px-3 py-2 text-xs font-semibold text-gold-300 transition-colors hover:bg-gold-500/10"
                  aria-label={`Copy pickup code ${order.referenceCode}`}
                >
                  {copiedReference === order.referenceCode ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Clipboard className="h-3.5 w-3.5" />
                  )}
                  {copiedReference === order.referenceCode ? 'Copied' : 'Copy code'}
                </button>
              </div>

              <div className="mt-4 divide-y divide-night-800">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-night-800 bg-night-950">
                      {item.productImage ? (
                        <img src={item.productImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-night-600">
                          <PackageCheck className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-night-100">{item.productName}</p>
                      <p className="mt-0.5 text-xs text-night-500">
                        {item.vendorName} · Qty {item.quantity} · {item.status.replace(/_/g, ' ')}
                        {item.trackingInfo ? ` · ${item.trackingInfo}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-night-100">{formatPrice(item.lineTotal)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-night-800 pt-4">
                <p className="text-sm text-night-400">
                  Total <span className="ml-1 font-display text-lg text-gold-400">{formatPrice(order.totalAmount)}</span>
                </p>
                <Link
                  to={`/shop/orders/${encodeURIComponent(order.referenceCode)}`}
                  state={{ phone: customer?.phone }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gold-500/40 px-4 py-2 text-xs font-semibold text-gold-300 transition-colors hover:bg-gold-500/10"
                >
                  Order details & updates <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <section className="mt-5 border-t border-night-800 pt-4" aria-label={`Order history for ${order.referenceCode}`}>
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                  <History className="h-3.5 w-3.5 text-gold-400" />
                  Order history
                </h2>
                {order.history?.length ? (
                  <ol className="mt-3 space-y-3">
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
                  <p className="mt-2 text-xs text-night-500">
                    Order and payment updates will appear here as they are recorded.
                  </p>
                )}
              </section>
            </article>
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 disabled:opacity-40">
            Previous
          </button>
          <span className="text-sm text-night-400">Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  )
}
