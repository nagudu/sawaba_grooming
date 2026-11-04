import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Menu, ShoppingCart, UserRound, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useScrollPosition } from '../../hooks/useScrollPosition'
import { cn } from '../../utils/cn'
import { ButtonLink } from '../ui/Button'
import ThemePicker from '../ui/ThemePicker'
import { site } from '../../data/services'
import { useCustomerAuth } from '../../store/customerAuth'
import { useShopCart } from '../../store/shopCart'
import { PRIMARY_LINKS, SECONDARY_LINKS, handleBookClick, type NavLinkItem } from './navigation'

interface NavbarProps {
  menuOpen: boolean
  onMobileToggle: () => void
}

export function LogoMark({ className }: { className?: string }) {
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
        <circle cx="18" cy="16" r="8" />
        <circle cx="18" cy="48" r="8" />
        <path d="M24.8 22.8 L52 50" />
        <path d="M24.8 41.2 L52 14" />
      </g>
      <circle cx="34" cy="32" r="2.2" fill="#c9a24b" />
    </svg>
  )
}

const navItemClasses = (isActive: boolean, extra?: string) =>
  cn(
    'group relative inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-2',
    'text-[13px] font-medium tracking-wide transition-colors duration-200 xl:px-3.5',
    isActive ? 'text-gold-300' : 'text-night-300 hover:text-gold-200',
    extra,
  )

function DesktopNavLink({ item, className }: { item: NavLinkItem; className?: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) => navItemClasses(isActive, className)}
    >
      {({ isActive }) => (
        <>
          {item.label}
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-x-3 bottom-1 h-[2px] origin-center rounded-full bg-gold-400 transition-transform duration-300',
              isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-75',
            )}
          />
        </>
      )}
    </NavLink>
  )
}

/** Accessible "More" menu used between lg and xl, where the full row would crowd. */
function MoreMenu({ items }: { items: NavLinkItem[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const isSectionActive = items.some((item) => location.pathname.startsWith(item.to))

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="navbar-more-menu"
        className={navItemClasses(isSectionActive)}
      >
        More
        <ChevronDown
          aria-hidden="true"
          className={cn('ml-1 h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          id="navbar-more-menu"
          className="absolute left-1/2 top-full z-[70] mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-night-700 bg-charcoal p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)]"
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'block rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-200',
                  isActive
                    ? 'bg-gold-500/10 text-gold-300'
                    : 'text-night-200 hover:bg-night-800/70 hover:text-gold-200',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar({ menuOpen, onMobileToggle }: NavbarProps) {
  const scrolled = useScrollPosition(28)
  const location = useLocation()
  const { customer } = useCustomerAuth()
  const { cart } = useShopCart()
  const cartCount = cart?.itemCount ?? 0

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-[50] transition-all duration-500',
        scrolled
          ? 'border-b border-night-800/70 bg-night-950/85 shadow-[0_4px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      {/* Legibility wash while the header is transparent over the hero */}
      {!scrolled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-night-950/85 via-night-950/35 to-transparent"
        />
      )}
      {scrolled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
        />
      )}

      <div className="container-app relative flex h-[72px] items-center justify-between gap-3 sm:gap-4">
        {/* Brand */}
        <Link
          to="/"
          aria-label={`${site.fullName} home`}
          className="group flex shrink-0 items-center gap-2.5"
        >
          <LogoMark className="h-9 w-9 shrink-0 transition-transform duration-300 group-hover:scale-105" />
          <span className="flex flex-col leading-none max-[359px]:hidden">
            <span className="font-display text-[19px] font-semibold tracking-[0.14em] text-night-50">
              {site.name}
            </span>
            <span className="mt-1 hidden text-[8px] font-semibold uppercase tracking-[0.34em] text-gold-500/90 sm:block">
              Grooming Studio
            </span>
          </span>
        </Link>

        {/* Primary links + a "More" menu for the remaining destinations */}
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary navigation">
          {PRIMARY_LINKS.map((item) => (
            <DesktopNavLink key={item.to} item={item} />
          ))}

          <MoreMenu key={location.pathname} items={SECONDARY_LINKS} />
        </nav>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            to="/shop/cart"
            aria-label={`Shopping cart${cartCount > 0 ? `, ${cartCount} item${cartCount === 1 ? '' : 's'}` : ''}`}
            title="Shopping cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-night-700/80 text-night-200 transition-colors duration-200 hover:border-gold-500/70 hover:text-gold-300"
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-night-950">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          <div className="hidden lg:block">
            <ThemePicker />
          </div>

          <Link
            to={customer ? '/account' : '/account/login'}
            aria-label={customer ? 'My account' : 'Customer sign in'}
            title={customer ? `${customer.fullName} (${customer.customerCode})` : 'Returning customer? Sign in'}
            className={cn(
              'hidden h-10 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors duration-200 lg:inline-flex xl:px-4',
              customer
                ? 'border-gold-500/40 bg-gold-500/10 text-gold-300 hover:border-gold-400 hover:bg-gold-500/15'
                : 'border-night-700/80 text-night-200 hover:border-gold-500/70 hover:text-gold-300',
            )}
          >
            <UserRound className="h-[18px] w-[18px]" />
            <span className="hidden xl:inline">{customer ? 'My Account' : 'Sign in'}</span>
          </Link>

          <ButtonLink
            to="/book"
            variant="gold"
            size="sm"
            onClick={handleBookClick}
            className="h-10 px-3 text-[10px] tracking-[0.12em] sm:px-4 sm:text-[11px]"
          >
            Book Now
          </ButtonLink>

          <button
            type="button"
            onClick={onMobileToggle}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-night-700/80 text-night-200 transition-colors duration-200 hover:border-gold-500/70 hover:text-gold-300 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  )
}
