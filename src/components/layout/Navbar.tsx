import { Menu, UserRound } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useScrollPosition } from '../../hooks/useScrollPosition'
import { cn } from '../../utils/cn'
import { ButtonLink } from '../ui/Button'
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

export default function Navbar({ onMobileOpen }: NavbarProps) {
  const scrolled = useScrollPosition(28)
  const { customer } = useCustomerAuth()

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-[50] transition-all duration-500',
        scrolled
          ? 'bg-night-950/90 border-b border-night-800/60 shadow-[0_4px_24px_rgba(0,0,0,0.55)] backdrop-blur-lg'
          : 'bg-transparent',
      )}
    >
      <div className="container-app flex h-[72px] items-center justify-between">
        <Link
          to="/"
          aria-label={`${site.fullName} home`}
          className="flex items-center gap-2.5"
        >
          <svg
            className="h-8 w-8 shrink-0"
            viewBox="0 0 64 64"
            aria-hidden="true"
          >
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
          <span className="font-display text-xl font-semibold tracking-wide text-night-50">
            {site.name}
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Primary navigation"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-200',
                  isActive
                    ? 'text-gold-400'
                    : 'text-night-300 hover:text-gold-400',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  {isActive && (
                    <span className="absolute right-3 left-3 bottom-0.5 h-[1.5px] rounded-full bg-gold-500" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to={customer ? '/account' : '/account/login'}
            aria-label={customer ? 'My account' : 'Customer login'}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
              customer ? 'text-gold-400' : 'text-night-300 hover:text-gold-400',
            )}
            title={customer ? `${customer.fullName} (${customer.customerCode})` : 'Returning customer? Login'}
          >
            <UserRound className="h-5 w-5" />
            <span className="hidden lg:inline">{customer ? 'My Account' : 'Login'}</span>
          </Link>
          <ButtonLink
            to="/book"
            variant="gold"
            size="sm"
            className="hidden lg:flex"
          >
            Book Now
          </ButtonLink>
          <button
            type="button"
            onClick={onMobileOpen}
            aria-label="Open menu"
            className="rounded-lg p-2 text-night-300 transition-colors hover:text-gold-400 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  )
}