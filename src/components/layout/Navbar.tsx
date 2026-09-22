import { Menu, UserRound } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useScrollPosition } from '../../hooks/useScrollPosition'
import { cn } from '../../utils/cn'
import { ButtonLink } from '../ui/Button'
import ThemePicker from '../ui/ThemePicker'
import { site } from '../../data/services'
import { useCustomerAuth } from '../../store/customerAuth'

interface NavbarProps {
  onMobileOpen: () => void
}

const links = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/barbers', label: 'Barbers' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/contact', label: 'Contact' },
]

function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0a0a0c" />
      <g
        fill="none"
        stroke="#c9a24b"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="24" cy="30" r="9" />
        <path d="M30 24 L44 12" />
        <path d="M34 24 L50 12" />
        <path d="M24 39 L24 52" />
      </g>
      <circle cx="44" cy="20" r="1.6" fill="#c9a24b" />
    </svg>
  )
}

export default function Navbar({ onMobileOpen }: NavbarProps) {
  const scrolled = useScrollPosition(28)
  const { customer } = useCustomerAuth()

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-[50] transition-all duration-500',
        scrolled
          ? 'border-b border-night-800/60 bg-night-950/80 shadow-[0_4px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      {scrolled && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
          aria-hidden="true"
        />
      )}

      <div className="container-app flex h-[72px] items-center justify-between gap-4">
        {/* Brand */}
        <Link
          to="/"
          aria-label={`${site.fullName} home`}
          className="group flex shrink-0 items-center gap-3"
        >
          <LogoMark className="h-9 w-9 shrink-0 transition-transform duration-300 group-hover:scale-105" />
          <span className="flex flex-col">
            <span className="font-display text-xl leading-none font-semibold tracking-[0.12em] text-night-50">
              {site.name}
            </span>
            <span className="mt-1.5 text-[8.5px] font-semibold tracking-[0.32em] text-gold-500 uppercase">
              Grooming Studio
            </span>
          </span>
        </Link>

        {/* Primary nav */}
        <nav
          className="hidden items-center gap-1 xl:flex"
          aria-label="Primary navigation"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'group relative rounded-full px-3.5 py-2 text-[13px] font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gold-500/10 text-gold-300'
                    : 'text-night-300 hover:bg-night-800/50 hover:text-gold-400',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  <span
                    className={cn(
                      'absolute inset-x-3 bottom-1 h-[1.5px] origin-left rounded-full bg-gold-400 transition-transform duration-300',
                      isActive
                        ? 'scale-x-100'
                        : 'scale-x-0 group-hover:scale-x-50',
                    )}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemePicker />

          <Link
            to={customer ? '/account' : '/account/login'}
            aria-label={customer ? 'My account' : 'Customer login'}
            title={
              customer
                ? `${customer.fullName} (${customer.customerCode})`
                : 'Returning customer? Login'
            }
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-200',
              customer
                ? 'border-gold-500/40 bg-gold-500/10 text-gold-300 hover:border-gold-400 hover:bg-gold-500/15'
                : 'border-night-700 text-night-200 hover:border-gold-500/70 hover:text-gold-300',
            )}
          >
            <UserRound className="h-4 w-4" />
            <span className="hidden xl:inline">
              {customer ? 'My Account' : 'Login'}
            </span>
          </Link>

          <ButtonLink
            to="/book"
            variant="gold"
            size="sm"
            className="hidden lg:inline-flex"
            onClick={(event) => {
              // Already on /book → smooth-scroll to the form instead of a no-op reload.
              if (window.location.pathname === '/book') {
                const target = document.getElementById('booking-form')
                if (target) {
                  event.preventDefault()
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }
            }}
          >
            Book Now
          </ButtonLink>

          <button
            type="button"
            onClick={onMobileOpen}
            aria-label="Open menu"
            className="rounded-lg p-2 text-night-300 transition-colors hover:text-gold-400 xl:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  )
}