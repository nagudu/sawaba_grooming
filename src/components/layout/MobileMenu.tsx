import { useEffect, useRef, type ComponentType } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, NavLink } from 'react-router-dom'
import {
  ChevronRight,
  Clock,
  Home,
  Images,
  Info,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { FacebookIcon, InstagramIcon, TikTokIcon, TwitterIcon } from '../icons/SocialIcons'
import { cn } from '../../utils/cn'
import ThemePicker from '../ui/ThemePicker'
import { site } from '../../data/services'
import { useCustomerAuth } from '../../store/customerAuth'
import { useShopCart } from '../../store/shopCart'
import { useCatalog } from '../../store/catalog'
import { ALL_LINKS } from './navigation'

interface MobileMenuProps {
  open: boolean
  onClose: () => void
}

const LINK_ICONS: Record<string, LucideIcon> = {
  '/': Home,
  '/about': Info,
  '/services': Scissors,
  '/barbers': UsersRound,
  '/shop': ShoppingBag,
  '/gallery': Images,
  '/reviews': Star,
  '/pricing': Tag,
  '/track': PackageSearch,
  '/contact': Mail,
}

const SOCIALS: Array<{ href: string; label: string; icon: ComponentType<{ className?: string }> }> = [
  { href: site.instagram, label: 'Instagram', icon: InstagramIcon },
  { href: site.facebook, label: 'Facebook', icon: FacebookIcon },
  { href: site.tiktok, label: 'TikTok', icon: TikTokIcon },
  { href: site.twitter, label: 'X (Twitter)', icon: TwitterIcon },
]

const MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  const reduce = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const { customer } = useCustomerAuth()
  const { cart } = useShopCart()
  const { services, loading } = useCatalog()
  const cartCount = cart?.itemCount ?? 0

  // Dedupe services and cap the list so the menu stays compact.
  const popularServices: typeof services = []
  const seen = new Set<number>()
  for (const service of services) {
    if (seen.has(service.id)) continue
    seen.add(service.id)
    popularServices.push(service)
    if (popularServices.length >= 8) break
  }

  // Lock the page, close on Escape, trap focus, and close if the viewport grows.
  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const onResize = () => {
      if (window.innerWidth >= 1024) onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      openerRef.current?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-menu"
          className="fixed inset-x-0 top-[72px] bottom-0 z-[45] lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.2 }}
        >
          <motion.div
            id="mobile-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
            transition={{ duration: reduce ? 0.15 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full flex-col border-t border-night-800 bg-night-950 shadow-[0_28px_60px_-20px_rgba(0,0,0,0.9)]"
          >
            {/* Compact panel bar */}
            <div className="flex items-center justify-between border-b border-night-800/80 px-4 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-night-500">Menu</span>
              <div className="flex items-center gap-1.5">
                <ThemePicker />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-night-700/80 text-night-200 transition-colors duration-200 hover:border-gold-500/70 hover:text-gold-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div id="mobile-menu-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 pb-8 pt-4">
              {/* Account + cart */}
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to={customer ? '/account' : '/account/login'}
                  onClick={onClose}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-night-800 bg-night-900/60 px-3 text-[13px] font-medium text-night-100 transition-colors hover:border-gold-500/40 hover:text-gold-200"
                >
                  <UserRound className="h-4 w-4 shrink-0 text-gold-400" />
                  <span className="truncate">{customer ? 'My account' : 'Sign in'}</span>
                </Link>
                <Link
                  to="/shop/cart"
                  onClick={onClose}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-night-800 bg-night-900/60 px-3 text-[13px] font-medium text-night-100 transition-colors hover:border-gold-500/40 hover:text-gold-200"
                >
                  <ShoppingCart className="h-4 w-4 shrink-0 text-gold-400" />
                  <span className="truncate">Cart{cartCount > 0 ? ` (${cartCount})` : ''}</span>
                </Link>
              </div>

              {/* Main navigation */}
              <p className="mb-2 mt-5 px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-night-500">
                Explore
              </p>
              <nav aria-label="Mobile navigation" className="grid grid-cols-2 gap-2">
                {ALL_LINKS.map((item, index) => {
                  const Icon = LINK_ICONS[item.to] ?? ChevronRight
                  return (
                    <motion.div
                      key={item.to}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: reduce ? 0 : Math.min(index * 0.018, 0.16),
                        duration: 0.22,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <NavLink
                        to={item.to}
                        end={item.to === '/'}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            'flex min-h-[46px] items-center gap-2.5 rounded-xl border px-3 text-[13.5px] font-medium transition-colors duration-200',
                            isActive
                              ? 'border-gold-500/40 bg-gold-500/10 text-gold-200'
                              : 'border-night-800 bg-night-900/40 text-night-200 hover:border-gold-500/30 hover:bg-night-900 hover:text-gold-200',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0 transition-colors',
                                isActive ? 'text-gold-300' : 'text-gold-500/80',
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </motion.div>
                  )
                })}
              </nav>

              {/* Services */}
              <div className="mb-2 mt-5 flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-night-500">Services</p>
                <Link
                  to="/services"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-400 transition-colors hover:text-gold-300"
                >
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {!loading && popularServices.length > 0 ? (
                <div className="-mx-4 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {popularServices.map((service) => (
                    <Link
                      key={service.id}
                      to={`/services/${service.id}`}
                      onClick={onClose}
                      className="shrink-0 snap-start rounded-full border border-night-700 bg-night-900/60 px-3 py-2 text-[12px] font-medium text-night-200 transition-colors hover:border-gold-500/40 hover:text-gold-200"
                    >
                      {service.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  to="/services"
                  onClick={onClose}
                  className="flex items-center justify-between rounded-xl border border-night-800 bg-night-900/40 px-3 py-3 text-[13px] text-night-200 transition-colors hover:border-gold-500/30 hover:text-gold-200"
                >
                  Browse all services
                  <ChevronRight className="h-4 w-4 text-gold-500" />
                </Link>
              )}

              {/* Contact */}
              <p className="mb-2 mt-5 px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-night-500">
                Visit us
              </p>
              <div className="rounded-2xl border border-night-800 bg-night-900/40 p-3">
                <div className="space-y-1">
                  <a
                    href={`tel:${site.phone}`}
                    className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-[13px] text-night-200 transition-colors hover:text-gold-200"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-gold-500/80" />
                    {site.phone}
                  </a>
                  <a
                    href={`mailto:${site.email}`}
                    className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-[13px] text-night-200 transition-colors hover:text-gold-200"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-gold-500/80" />
                    <span className="truncate">{site.email}</span>
                  </a>
                  <a
                    href={MAP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-[13px] text-night-200 transition-colors hover:text-gold-200"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-gold-500/80" />
                    <span className="truncate">{site.address}</span>
                  </a>
                  <div className="flex items-start gap-2.5 px-1 py-1.5 text-[12px] text-night-400">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-500/80" />
                    <span>
                      Mon–Thu 9am–8pm · Fri 9am–9pm
                      <br />
                      Sat 8am–9pm · Sun 11am–6pm
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2 border-t border-night-800 pt-3">
                  {SOCIALS.map(({ href, label, icon: Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      title={label}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-night-700/80 text-night-300 transition-colors hover:border-gold-500/60 hover:text-gold-300"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                  <Link
                    to="/contact"
                    onClick={onClose}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-gold-400 transition-colors hover:text-gold-300"
                  >
                    Get in touch <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
