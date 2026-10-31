import { useCallback, useEffect, useState } from 'react'
import { MapPin, Phone, ShoppingBag, Truck } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, StatusBadge } from '../../components/admin/AdminUI'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchInput from '../../components/ui/SearchInput'
import { useToast } from '../../components/ui/ToastNotification'
import { vendorApi, type VendorOrderItem } from '../../api/vendor'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'New' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'RETURNED', label: 'Returned' },
]

/** Allowed next states per item status — mirrors the backend flow rules. */
const NEXT_ACTIONS: Record<string, Array<{ status: string; label: string; variant: 'gold' | 'outline' }>> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Confirm Availability', variant: 'gold' },
    { status: 'CANCELLED', label: 'Cancel', variant: 'outline' },
  ],
  CONFIRMED: [
    { status: 'PREPARING', label: 'Start Preparing', variant: 'gold' },
    { status: 'CANCELLED', label: 'Cancel', variant: 'outline' },
  ],
  PREPARING: [
    { status: 'SHIPPED', label: 'Mark Shipped', variant: 'gold' },
    { status: 'CANCELLED', label: 'Cancel', variant: 'outline' },
  ],
  SHIPPED: [{ status: 'DELIVERED', label: 'Mark Delivered', variant: 'gold' }],
}

const inputClass =
  'w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none'

export default function VendorOrdersPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<VendorOrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage] = useState(15)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const [active, setActive] = useState<VendorOrderItem | null>(null)
  const [tracking, setTracking] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await vendorApi.orders({
        page,
        perPage,
        status: status || undefined,
        search: search || undefined,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, status, search, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const advance = async (item: VendorOrderItem, nextStatus: string) => {
    if (nextStatus === 'CANCELLED') {
      const reason = window.prompt('Reason for cancelling this item?')
      if (reason === null) return
      setBusy(true)
      try {
        await vendorApi.updateOrderItem(item.id, { status: 'CANCELLED', cancelReason: reason || 'Cancelled by vendor' })
        showToast('Item cancelled and stock returned.')
        setActive(null)
        await load()
      } catch (error) {
        showToast((error as Error).message, 'error')
      } finally {
        setBusy(false)
      }
      return
    }
    // Shipping: ask for tracking info first.
    if (nextStatus === 'SHIPPED') {
      setActive(item)
      setTracking(item.trackingInfo ?? '')
      return
    }
    setBusy(true)
    try {
      await vendorApi.updateOrderItem(item.id, { status: nextStatus })
      showToast(`Item marked ${nextStatus.toLowerCase().replace('_', ' ')}.`)
      setActive(null)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const shipWithTracking = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!active) return
    setBusy(true)
    try {
      await vendorApi.updateOrderItem(active.id, {
        status: 'SHIPPED',
        trackingInfo: tracking || undefined,
      })
      showToast('Item marked as shipped.')
      setActive(null)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-night-50 sm:text-3xl">Orders</h1>
        <p className="mt-1.5 text-sm text-night-400">
          Your slice of marketplace orders — confirm, prepare, ship and deliver.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search reference, customer, product…" className="md:max-w-sm md:flex-1" />
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value)
                setPage(1)
              }}
              className={cn(
                'rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                status === tab.value
                  ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                  : 'border-night-700 bg-night-900 text-night-400 hover:border-gold-500/40',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16 text-night-400">
          <LoadingSpinner className="h-8 w-8 text-gold-500" />
          <p className="text-sm">Loading orders…</p>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title="No orders found"
          description="Orders for your products will appear here as customers buy."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  {['Order', 'Product', 'Customer', 'Delivery', 'Amount', 'Status', ''].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {items.map((item) => (
                  <tr key={item.id} className={cn('text-sm', item.paymentStatus !== 'PAID' && 'opacity-70')}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-night-100">{item.orderReference}</p>
                      <p className="text-xs text-night-500">
                        {new Date(item.createdAt).toLocaleDateString('en-GB')}
                      </p>
                    </td>
                    <td className="max-w-[220px] px-4 py-4">
                      <p className="truncate font-medium text-night-200">{item.productName}</p>
                      {item.variationLabel && <p className="text-xs text-night-500">{item.variationLabel}</p>}
                      <p className="text-xs text-night-500">Qty {item.quantity}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-night-200">{item.customerName}</p>
                      <p className="flex items-center gap-1 text-xs text-night-500">
                        <Phone className="h-3 w-3" /> {item.customerPhone}
                      </p>
                    </td>
                    <td className="max-w-[180px] px-4 py-4">
                      <p className="truncate text-xs text-night-400">{item.deliveryAddress}</p>
                      {item.deliveryLocation && (
                        <p className="flex items-center gap-1 text-xs text-night-500">
                          <MapPin className="h-3 w-3" /> {item.deliveryLocation}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 font-semibold text-night-100">{formatPrice(item.lineTotal)}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                      {item.paymentStatus !== 'PAID' && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Unpaid
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-end gap-1.5">
                        {(NEXT_ACTIONS[item.status] ?? []).map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            onClick={() => advance(item, action.status)}
                            disabled={item.paymentStatus !== 'PAID'}
                            className={cn(
                              'rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                              action.variant === 'gold'
                                ? 'bg-gold-500 text-night-950 hover:bg-gold-400'
                                : 'border border-night-700 text-night-300 hover:border-red-500/60 hover:text-red-300',
                            )}
                          >
                            {action.label}
                          </button>
                        ))}
                        {item.status === 'DELIVERED' && <StatusBadge status="DELIVERED" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-3 text-sm text-night-400">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Shipping modal */}
      <Modal open={Boolean(active)} onClose={() => setActive(null)} title="Mark item as shipped" size="sm">
        {active && (
          <form onSubmit={shipWithTracking} className="space-y-4">
            <div className="rounded-xl border border-night-800 bg-night-950/50 p-4 text-sm">
              <p className="font-semibold text-night-100">{active.productName}</p>
              <p className="mt-1 text-xs text-night-500">
                {active.orderReference} · {active.customerName}
              </p>
            </div>
            <Field label="Tracking information (optional)" hint="Courier name, waybill number or expected delivery date.">
              <input
                value={tracking}
                onChange={(event) => setTracking(event.target.value)}
                placeholder="e.g. GIG Logistics — WB123456"
                className={inputClass}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="md" onClick={() => setActive(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" size="md" loading={busy}>
                <Truck className="h-4 w-4" />
                Mark Shipped
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
