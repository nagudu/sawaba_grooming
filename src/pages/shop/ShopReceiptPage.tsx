import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer, ReceiptText } from 'lucide-react'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { shopApi, type ShopOrder } from '../../api/shop'
import { useCustomerAuth } from '../../store/customerAuth'
import { formatPrice } from '../../utils/format'

const PAYMENT_LABELS: Record<string, string> = {
  UNPAID: 'Pending payment',
  PENDING_VERIFICATION: 'Awaiting verification',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
}

/**
 * Printable receipt for a marketplace order.
 *
 * Access follows the same two-factor rule as the order page (reference + phone),
 * except signed-in customers can open their own orders without the phone. The
 * receipt is rendered from server data only — never from a frontend "paid" flag.
 */
export default function ShopReceiptPage() {
  const { reference = '' } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { customer } = useCustomerAuth()

  const [order, setOrder] = useState<ShopOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState(
    (location.state as { phone?: string } | null)?.phone ??
      sessionStorage.getItem(`shop_order_phone_${reference}`) ??
      '',
  )
  const [phoneInput, setPhoneInput] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // A signed tracking token grants read-only access (guest, no login).
      if (token) {
        try {
          setOrder(await shopApi.getTrackedOrder(token))
          return
        } catch {
          // Fall through to account / phone access.
        }
      }
      if (customer) {
        try {
          setOrder(await shopApi.myOrder(reference))
          return
        } catch {
          // Fall through to the phone-based lookup for guest orders.
        }
      }
      if (!phone) {
        setOrder(null)
        return
      }
      setOrder(await shopApi.getOrder(reference, phone))
    } catch (err) {
      setError((err as Error).message)
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [token, customer, phone, reference])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-night-950 pt-[72px] text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Preparing your receipt…</p>
      </div>
    )
  }

  if (!order && !phone && !customer && !token) {
    return (
      <div className="bg-night-950 pt-[112px] pb-20">
        <div className="container-app max-w-md">
          <div className="rounded-2xl border border-night-800 bg-night-900/60 p-6">
            <h1 className="font-display text-2xl text-night-50">Find your receipt</h1>
            <p className="mt-2 text-sm text-night-400">
              Enter the phone number used for order{' '}
              <span className="font-semibold text-gold-400">{reference}</span>.
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
              <button
                type="submit"
                className="w-full rounded-xl bg-gold-500 px-4 py-3 text-sm font-bold text-night-950 hover:bg-gold-400"
              >
                Open receipt
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="bg-night-950 pt-[112px] pb-20">
        <div className="container-app max-w-2xl">
          <EmptyState
            icon={<ReceiptText className="h-10 w-10" />}
            title="Receipt unavailable"
            description={error ?? 'We could not find this order.'}
            action={
              <Link to={`/shop/orders/${reference}`} className="mt-2 text-sm font-semibold text-gold-400">
                Back to order
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const paid = order.paymentStatus === 'PAID'
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="bg-night-950 pt-[96px] pb-20 print:bg-white print:pt-0 print:pb-0">
      <div className="container-app max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            to={`/shop/orders/${encodeURIComponent(order.referenceCode)}${token ? `?token=${encodeURIComponent(token)}` : ''}`}
            state={{ phone }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-night-300 hover:text-gold-300"
          >
            <ArrowLeft className="h-4 w-4" /> Back to order
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-300 hover:bg-gold-500/20"
          >
            <Printer className="h-4 w-4" /> Print / save as PDF
          </button>
        </div>

        <article className="rounded-2xl border border-night-800 bg-night-900/40 p-6 sm:p-10 print:rounded-none print:border-0 print:bg-white print:p-0">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-night-800 pb-6 print:border-gray-300">
            <div>
              <p className="font-display text-2xl tracking-[0.12em] text-night-50 print:text-black">
                SAWABA
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-gold-500 print:text-gray-600">
                Grooming Studio
              </p>
              <p className="mt-3 text-xs text-night-400 print:text-gray-600">
                Unguwa Uku, Sabuwar Abuja, Kano, Nigeria
              </p>
              <p className="text-xs text-night-400 print:text-gray-600">0706 928 8456</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-night-500 print:text-gray-500">
                Payment receipt
              </p>
              <p className="mt-1 font-mono text-sm font-bold text-gold-300 print:text-black">
                {order.referenceCode}
              </p>
              <p className="mt-1 text-xs text-night-400 print:text-gray-600">
                Issued {new Date(order.createdAt).toLocaleString('en-GB')}
              </p>
              <p className="mt-1 text-xs font-semibold print:text-black">
                <span className={paid ? 'text-emerald-400 print:text-black' : 'text-amber-300 print:text-black'}>
                  {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                </span>
              </p>
            </div>
          </header>

          <section className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500 print:text-gray-500">
                Customer
              </p>
              <p className="mt-2 text-sm font-semibold text-night-100 print:text-black">{order.customerName}</p>
              <p className="text-xs text-night-400 print:text-gray-600">{order.customerPhone}</p>
              {order.customerEmail && (
                <p className="text-xs text-night-400 print:text-gray-600">{order.customerEmail}</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500 print:text-gray-500">
                {order.fulfillmentType === 'PICKUP' ? 'Collection' : 'Delivery'}
              </p>
              <p className="mt-2 text-sm text-night-100 print:text-black">
                {order.fulfillmentType === 'PICKUP'
                  ? order.pickup?.shopName ?? 'SAWABA Grooming Studio'
                  : order.deliveryAddress}
              </p>
              {order.fulfillmentType === 'PICKUP' && order.pickup?.code && (
                <p className="mt-1 font-mono text-xs text-gold-300 print:text-black">
                  Pickup code: {order.pickup.code}
                </p>
              )}
              {order.deliveryLocation && (
                <p className="text-xs text-night-400 print:text-gray-600">{order.deliveryLocation}</p>
              )}
              {order.estimatedDeliveryAt && (
                <p className="text-xs text-night-400 print:text-gray-600">
                  Estimated{' '}
                  {new Date(order.estimatedDeliveryAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </section>

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-night-800 text-left text-[11px] uppercase tracking-[0.12em] text-night-500 print:border-gray-300 print:text-gray-500">
                <th className="pb-2">Item</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-night-800/70 print:border-gray-200">
                  <td className="py-2.5">
                    <p className="text-night-100 print:text-black">{item.productName}</p>
                    <p className="text-[11px] text-night-500 print:text-gray-600">
                      {item.vendorName}
                      {item.variationLabel ? ` · ${item.variationLabel}` : ''}
                    </p>
                  </td>
                  <td className="text-center text-night-200 print:text-black">{item.quantity}</td>
                  <td className="text-right text-night-300 print:text-gray-700">{formatPrice(item.unitPrice)}</td>
                  <td className="text-right font-semibold text-night-100 print:text-black">
                    {formatPrice(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-night-400 print:text-gray-600">
              <span>Subtotal ({itemCount} item{itemCount === 1 ? '' : 's'})</span>
              <span className="text-night-100 print:text-black">{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-night-400 print:text-gray-600">
              <span>Delivery</span>
              <span className="text-night-100 print:text-black">
                {order.deliveryFee === 0 ? 'Free' : formatPrice(order.deliveryFee)}
              </span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-night-400 print:text-gray-600">
                <span>Discount</span>
                <span className="text-night-100 print:text-black">-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-night-800 pt-2 text-base font-bold print:border-gray-300">
              <span className="text-night-100 print:text-black">Total paid</span>
              <span className="text-gold-400 print:text-black">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>

          <footer className="mt-8 border-t border-night-800 pt-4 text-[11px] leading-relaxed text-night-500 print:border-gray-300 print:text-gray-600">
            <p>
              Payment method: {(order.paymentMethod ?? '—').replace(/_/g, ' ')}
              {order.transactionRef ? ` · Reference: ${order.transactionRef}` : ''}
            </p>
            <p className="mt-1">
              This receipt is issued for a verified payment recorded on the SAWABA marketplace. Amounts are in
              Nigerian Naira. Keep this document for your records.
            </p>
          </footer>
        </article>
      </div>
    </div>
  )
}
