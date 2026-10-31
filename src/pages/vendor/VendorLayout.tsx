import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  Store,
  Wallet,
  X,
} from 'lucide-react'
import { getVendorToken, setVendorToken, vendorApi, type VendorProfile } from '../../api/vendor'
import { cn } from '../../utils/cn'
import ScrollToTop from '../../components/layout/ScrollToTop'

const NAV_ITEMS = [
  { to: '/vendor', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/vendor/products', label: 'Products', icon: Package },
  { to: '/vendor/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/vendor/earnings', label: 'Earnings & Payouts', icon: Wallet },
  { to: '/vendor/settings', label: 'Settings', icon: Store },
]

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending Approval',
  APPROVED: 'Approved',
  SUSPENDED: 'Suspended',
  REJECTED: 'Rejected',
}

export default function VendorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [vendor, setVendor] = useState<VendorProfile | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!getVendorToken()) {
      navigate('/vendor/login', { replace: true })
      return
    }
    vendorApi
      .me()
      .then(setVendor)
      .catch(() => {
        setVendorToken(null)
        navigate('/vendor/login', { replace: true })
      })
  }, [navigate])

  const logout = () => {
    setVendorToken(null)
    navigate('/vendor/login')
  }

  const statusTone =
    vendor?.status === 'APPROVED'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : vendor?.status === 'PENDING'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
        : 'border-red-500/40 bg-red-500/10 text-red-300'

  return (
    <div className="min-h-screen bg-night-950">
      <ScrollToTop />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-night-800 bg-coal lg:block">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 px-5 py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
              <Store className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg text-night-50">Vendor Portal</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-500">
                SAWABA Marketplace
              </p>
            </div>
          </div>

          <nav className="mt-2 flex-1 space-y-1 px-3">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200',
                    isActive
                      ? 'border border-gold-500/40 bg-gold-500/10 text-gold-300'
                      : 'border border-transparent text-night-400 hover:bg-night-900 hover:text-night-100',
                  )
                }
              >
                <Icon className="h-4.5 w-4.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-night-800 p-4">
            {vendor && (
              <div className="mb-3 rounded-xl p-2">
                <p className="truncate text-sm font-semibold text-night-100">{vendor.businessName}</p>
                <p className="truncate text-xs text-night-500">{vendor.email}</p>
                <span className={cn('mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', statusTone)}>
                  {STATUS_LABELS[vendor.status] ?? vendor.status}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-night-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-night-800 bg-coal">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 rounded-lg p-2 text-night-400 hover:text-gold-400"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-3 px-5 py-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
                  <Store className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-lg text-night-50">Vendor Portal</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-500">
                    SAWABA Marketplace
                  </p>
                </div>
              </div>
              <nav className="mt-2 flex-1 space-y-1 px-3">
                {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                        isActive
                          ? 'border border-gold-500/40 bg-gold-500/10 text-gold-300'
                          : 'border border-transparent text-night-400 hover:bg-night-900',
                      )
                    }
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-night-800 p-4">
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-night-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  Sign Out
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-night-800 bg-night-950/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-night-700 p-2 text-night-300 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 text-sm text-night-500 lg:flex">
            <Bell className="h-4 w-4 text-gold-500" />
            Manage your store on the SAWABA Marketplace
          </div>
          <a
            href="/shop"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded-lg border border-night-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-night-300 transition-colors hover:border-gold-500/50 hover:text-gold-300"
          >
            View Shop
          </a>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
