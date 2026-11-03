import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Scissors, ShieldCheck, ShoppingBag, Store, UserRound } from 'lucide-react'
import { dashboardPathForRole, resolveStoredSession } from '../api/session'
import LoadingSpinner from '../components/ui/LoadingSpinner'

interface RoleOption {
  title: string
  description: string
  to: string
  icon: typeof UserRound
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    title: 'Customer',
    description: 'Book appointments, shop the marketplace and track your orders.',
    to: '/account/login',
    icon: UserRound,
  },
  {
    title: 'Vendor',
    description: 'Manage your store, products, orders and withdrawals.',
    to: '/vendor/login',
    icon: Store,
  },
  {
    title: 'Barber',
    description: 'View your schedule, earnings and check in client bookings.',
    to: '/barber/login',
    icon: Scissors,
  },
  {
    title: 'Admin',
    description: 'Sawaba administration and marketplace operations.',
    to: '/admin/login',
    icon: ShieldCheck,
  },
]

/**
 * Unified sign-in entry. If a valid session already exists the user is sent
 * straight to their dashboard; otherwise they pick the account type.
 */
export default function LoginPage() {
  const [target, setTarget] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    void resolveStoredSession().then((session) => {
      if (!active) return
      setTarget(session ? dashboardPathForRole(session.role) : null)
      setChecking(false)
    })
    return () => {
      active = false
    }
  }, [])

  if (checking) {
    return (
      <div className="container-app pt-[112px] pb-20">
        <LoadingSpinner label="Checking your session" />
      </div>
    )
  }

  if (target) {
    return <Navigate to={target} replace />
  }

  return (
    <div className="container-app pt-[112px] pb-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-gold-400">Sign in</span>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Welcome back to Sawaba</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-night-300">
          Choose your account type to continue. You will be taken straight to your dashboard.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <Link
              key={option.to}
              to={option.to}
              className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-gold-500/50 hover:bg-white/[0.06]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-white">{option.title}</span>
                <span className="mt-1 block text-sm text-night-300">{option.description}</span>
              </span>
            </Link>
          )
        })}
      </div>

      <div className="mx-auto mt-8 flex max-w-4xl items-center justify-center gap-2 text-sm text-night-300">
        <ShoppingBag className="h-4 w-4 text-gold-400" aria-hidden="true" />
        <span>
          Just browsing?{' '}
          <Link to="/shop" className="font-medium text-gold-400 hover:underline">
            Visit the marketplace
          </Link>
        </span>
      </div>
    </div>
  )
}
