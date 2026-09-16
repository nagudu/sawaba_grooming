import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { useCustomerAuth } from '../../store/customerAuth'
import { accountApi } from '../../api/account'
import { cn } from '../../utils/cn'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/account', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/account/bookings', label: 'My Bookings', icon: CalendarDays },
  { to: '/account/payments', label: 'Payments', icon: CreditCard },
  { to: '/account/profile', label: 'Profile', icon: UserRound },
]

/** Fetch the customer's count of appointments awaiting payment — shown as a badge. */
async function fetchPendingCount(): Promise<number> {
  try {
    const result = await accountApi.appointments()
    return result.items.filter(
      (a) =>
        a.payment?.status === 'UNPAID' ||
        a.payment?.status === 'REJECTED',
    ).length
  } catch {
    return 0
  }
}

export default function AccountLayout() {
  const { customer, logout } = useCustomerAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    void fetchPendingCount().then(setPendingCount)
  }, [])

  function handleLogout() {
    logout()
    navigate('/account/login')
  }

  const firstName = customer?.fullName?.split(' ')[0] ?? 'Account'

  return (
    <div className="min-h-screen bg-night-950">
      {/* ── Mobile top bar ── */}
      <div className="flex items-center justify-between border-b border-night-800 bg-night-950 px-5 py-3 lg:hidden">
        <Link to="/account" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15">
            <Scissors className="h-4 w-4 text-gold-400" />
          </span>
          <span className="font-display text-sm font-semibold text-night-100">My Account</span>
        </Link>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Link
              to="/account/bookings"
              className="flex items-center gap-1.5 rounded-full bg-gold-500/15 px-3 py-1 text-[11px] font-bold text-gold-400"
            >
              <Bell className="h-3 w-3" />
              {pendingCount} pending
            </Link>
          )}
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-night-400 hover:text-night-100"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-night-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 border-r border-night-800 bg-night-950 transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-night-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500/15">
              <Scissors className="h-4 w-4 text-gold-400" />
            </span>
            <div>
              <p className="text-sm font-bold text-night-100">{firstName}</p>
              <p className="text-[11px] text-night-500">{customer?.customerCode}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-night-400 hover:text-night-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3">
          <SidebarNav
            items={NAV_ITEMS}
            pendingCount={pendingCount}
            onNavigate={() => setMobileOpen(false)}
          />
          <LogoutButton onLogout={handleLogout} />
        </nav>
      </aside>

      {/* ── Desktop layout ── */}
      <div className="mx-auto flex min-h-screen max-w-7xl px-4 lg:px-8">
        {/* Sidebar — desktop */}
        <aside className="hidden w-60 shrink-0 border-r border-night-800 py-10 lg:block xl:w-64">
          {/* Brand + identity */}
          <div className="mb-6 px-4">
            <div className="flex items-center gap-3 rounded-xl border border-night-800 bg-night-900/50 px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-500/15">
                <UserRound className="h-4 w-4 text-gold-400" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-night-100">{customer?.fullName}</p>
                <p className="text-[11px] text-night-500">{customer?.customerCode}</p>
              </div>
            </div>
          </div>

          {/* Pending payment alert */}
          {pendingCount > 0 && (
            <Link
              to="/account/bookings"
              className="mx-4 mb-4 flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/[0.07] px-3 py-2.5 transition-colors hover:bg-gold-500/10"
            >
              <Bell className="h-4 w-4 shrink-0 text-gold-400" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gold-300">
                  {pendingCount} Payment{pendingCount > 1 ? 's' : ''} Due
                </p>
                <p className="text-[10px] text-night-400">Tap to pay now</p>
              </div>
              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-gold-500/60" />
            </Link>
          )}

          <nav className="px-3">
            <SidebarNav items={NAV_ITEMS} pendingCount={pendingCount} />
            <div className="my-3 h-px bg-night-800" />
            <LogoutButton onLogout={handleLogout} />
          </nav>

          {/* Book now CTA */}
          <div className="mx-4 mt-6">
            <Link
              to="/book"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-bold text-night-950 transition-opacity hover:opacity-90"
            >
              <Scissors className="h-4 w-4" />
              Book Appointment
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 py-8 lg:py-10 lg:pl-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ─── Sidebar nav list ─────────────────────────────────────────────────────────

function SidebarNav({
  items,
  pendingCount,
  onNavigate,
}: {
  items: NavItem[]
  pendingCount: number
  onNavigate?: () => void
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.exact}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-gold-500/10 text-gold-300'
                  : 'text-night-400 hover:bg-night-900/60 hover:text-night-100',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-gold-400' : 'text-night-500 group-hover:text-night-300',
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {/* Pending badge on Bookings */}
                {item.to === '/account/bookings' && pendingCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-night-950">
                    {pendingCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

// ─── Logout button ────────────────────────────────────────────────────────────

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      type="button"
      onClick={onLogout}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-night-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
    >
      <LogOut className="h-4 w-4 shrink-0" />
      Logout
    </button>
  )
}

// ─── Wallet icon re-export for consumers ──────────────────────────────────────
export { Wallet }
