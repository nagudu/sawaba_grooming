import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Package,
  PackageCheck,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
import { vendorApi, type VendorDashboardData } from '../../api/vendor'
import { formatPrice } from '../../utils/format'
import { StatusBadge } from '../../components/admin/AdminUI'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function Stat({ label, value, icon, accent = false }: { label: string; value: number | string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className={`card-lux p-5 ${accent ? 'border-gold-500/40 bg-gradient-to-br from-gold-500/10 to-transparent' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">{label}</p>
          <p className="mt-2 font-display text-3xl text-night-50">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-night-700 bg-night-900 text-gold-400">
          {icon}
        </span>
      </div>
    </div>
  )
}

export default function VendorDashboardPage() {
  const [data, setData] = useState<VendorDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    vendorApi
      .dashboard()
      .then(setData)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Loading dashboard…</p>
      </div>
    )
  }

  if (error || !data) {
    return <EmptyState icon={<AlertTriangle className="h-10 w-10" />} title="Could not load dashboard" description={error ?? 'Please try again.'} />
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-night-50 sm:text-3xl">Dashboard</h1>
        <p className="mt-1.5 text-sm text-night-400">Your store at a glance — products, orders and earnings.</p>
      </div>

      {/* Earnings */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Available Balance" value={formatPrice(data.earnings.available)} icon={<Wallet className="h-5 w-5" />} accent />
        <Stat label="Pending Earnings" value={formatPrice(data.earnings.pending)} icon={<Package className="h-5 w-5" />} />
        <Stat label="Paid Out" value={formatPrice(data.earnings.paid)} icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat label="Total Sales" value={formatPrice(data.earnings.totalSales)} icon={<ShoppingCart className="h-5 w-5" />} />
      </div>

      {/* Products + orders */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total Products" value={data.products.total} icon={<Package className="h-5 w-5" />} />
        <Stat label="Active" value={data.products.active} icon={<PackageCheck className="h-5 w-5" />} />
        <Stat label="Out of Stock" value={data.products.outOfStock} icon={<AlertTriangle className="h-5 w-5" />} />
        <Stat label="Pending Approval" value={data.products.pendingReview} icon={<Bell className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="New Orders" value={data.orders.new} icon={<ShoppingCart className="h-5 w-5" />} accent />
        <Stat label="Processing" value={data.orders.processing} icon={<Package className="h-5 w-5" />} />
        <Stat label="Completed" value={data.orders.completed} icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat label="Cancelled" value={data.orders.cancelled} icon={<AlertTriangle className="h-5 w-5" />} />
        <Stat label="Returned" value={data.orders.returned} icon={<Bell className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-night-50">Recent Orders</h2>
            <Link to="/vendor/orders" className="text-sm font-semibold text-gold-400 hover:text-gold-300">
              View all
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="h-10 w-10" />} title="No orders yet" description="Orders for your products will appear here." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="border-b border-night-800 bg-night-900/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400">Order</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400">Product</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400">Customer</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400">Amount</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-night-800">
                    {data.recentOrders.map((order) => (
                      <tr key={order.itemId} className="text-sm">
                        <td className="px-4 py-3 font-semibold text-night-100">{order.orderReference}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-night-300">
                          {order.productName} <span className="text-night-500">× {order.quantity}</span>
                        </td>
                        <td className="px-4 py-3 text-night-300">{order.customerName}</td>
                        <td className="px-4 py-3 text-right text-night-100">{formatPrice(order.lineTotal)}</td>
                        <td className="px-4 py-3 text-right">
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-night-50">Notifications</h2>
          </div>
          {data.notifications.length === 0 ? (
            <EmptyState icon={<Bell className="h-10 w-10" />} title="Nothing yet" description="Order and payment alerts will appear here." />
          ) : (
            <ul className="space-y-3">
              {data.notifications.map((notification) => (
                <li key={notification.id} className="rounded-xl border border-night-800 bg-night-900/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-night-100">{notification.title}</p>
                    {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-500" />}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-night-400">{notification.message}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-night-600">
                    {new Date(notification.createdAt).toLocaleString('en-GB')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
