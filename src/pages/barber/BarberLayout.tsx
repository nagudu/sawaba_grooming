import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CalendarRange,
  CircleUser,
  LayoutDashboard,
  LogOut,
  Scissors,
  Wallet,
  Bell,
  Clock,
} from 'lucide-react'
import { useBarberAuth } from '../../store/barberAuth'
import { cn } from '../../utils/cn'

const NAV = [
  { to: '/barber', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/barber/day-view', label: 'Day View', icon: CalendarRange },
  { to: '/barber/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/barber/earnings', label: 'Earnings', icon: Wallet },
  { to: '/barber/availability', label: 'Availability', icon: Clock },
  { to: '/barber/notifications', label: 'Alerts', icon: Bell },
]

export default function BarberLayout() {
  const { barber, signOut } = useBarberAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    signOut()
    navigate('/barber/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-night-950 md:flex-row">
      {/* Sidebar — tablet/desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-night-800 bg-night-900/60 p-5 md:flex">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10">
            <Scissors className="h-5 w-5 text-gold-400" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-night-50">SAWABA</p>
            <p className="text-[11px] uppercase tracking-widest text-night-500">Barber Portal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gold-500/10 text-gold-300'
                    : 'text-night-300 hover:bg-night-800 hover:text-night-100',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-6 border-t border-night-800 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-night-800 text-night-300">
              <CircleUser className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-night-100">{barber?.name}</p>
              <p className="text-[11px] text-night-500">
                {barber?.barberType === 'EXTERNAL' ? 'External barber' : 'Internal barber'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-night-400 transition-colors hover:bg-night-800 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-night-800 bg-night-900/60 px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-gold-400" />
          <span className="font-display text-sm font-semibold text-night-50">Barber Portal</span>
        </div>
        <button onClick={handleSignOut} aria-label="Sign out" className="text-night-400 hover:text-red-300">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-20 pt-5 md:px-8 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-night-800 bg-night-900/95 backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium',
                isActive ? 'text-gold-300' : 'text-night-500',
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
