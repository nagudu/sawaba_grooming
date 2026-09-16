import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Contact2,
  CreditCard,
  Gauge,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  UsersRound,
  Scissors,
  ShieldCheck,
  Star,
  Users,
  X,
} from 'lucide-react'
import { useAdminAuth } from '../../store/adminAuth'
import { cn } from '../../utils/cn'
import ScrollToTop from '../../components/layout/ScrollToTop'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/services', label: 'Services', icon: Scissors },
  { to: '/admin/barbers', label: 'Barbers', icon: Users },
  { to: '/admin/customers', label: 'Customers', icon: UsersRound },
  { to: '/admin/gallery', label: 'Gallery', icon: Images },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/contacts', label: 'Contact Messages', icon: Contact2 },
  { to: '/admin/payment-settings', label: 'Payment Settings', icon: Settings2 },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { admin, logout } = useAdminAuth()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
          <Scissors className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display text-lg text-night-50">SAWABA</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-500">
            Admin Panel
          </p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
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
        {admin && (
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 font-display text-sm font-semibold text-gold-400">
              {admin.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-night-100">{admin.name}</p>
              <p className="truncate text-xs text-night-500">{admin.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/admin/login')
          }}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-night-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-night-950">
      <ScrollToTop />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-night-800 bg-coal lg:block">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-night-950/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-night-800 bg-coal">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 rounded-lg p-2 text-night-400 hover:text-gold-400"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-night-800 bg-night-950/90 px-6 backdrop-blur">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-night-700 p-2 text-night-300 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 text-sm text-night-500 lg:flex">
            <Gauge className="h-4 w-4 text-gold-500" />
            Management Console
          </div>
          <NavLink
            to="/"
            className="flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-night-300 transition-colors hover:border-gold-500/50 hover:text-gold-300"
          >
            <ShieldCheck className="h-4 w-4" />
            View Site
          </NavLink>
        </header>

        <main className="p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}