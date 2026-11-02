import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, NavLink } from 'react-router-dom'
import { ShoppingCart, UserRound, X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { ButtonLink } from '../ui/Button'
import ThemePicker from '../ui/ThemePicker'
import { site } from '../../data/services'
import { useCustomerAuth } from '../../store/customerAuth'
import { useShopCart } from '../../store/shopCart'
import { ALL_LINKS, handleBookClick } from './navigation'
import { LogoMark } from './Navbar'

interface MobileMenuProps {
  open: boolean
  onClose: () => void
}

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  const reduce = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const { customer } = useCustomerAuth()
  const { cart } = useShopCart()
  const cartCount = cart?.itemCount ?? 0

  // Lock the page, close on Escape, and keep focus inside the panel while open.
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
      // Keep Tab within the open panel (modal focus trap).
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
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      openerRef.current?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const panelInitial = reduce ? { opacity: 0 } : { x: '100%' }
  const panelAnimate = reduce ? { opacity: 1 } : { x: 0 }
  const panelExit = reduce ? { opacity: 0 } : { x: '100%' }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className="absolute inset-0 bg-night-950/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={{ duration: reduce ? 0.15 : 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-y-0 right-0 flex h-full w-[90%] max-w-[420px] flex-col border-l border-night-800 bg-night-950 shadow-[-24px_0_60px_-20px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-night-800 px-5 py-4">
              <Link to="/" onClick={onClose} aria-label={`${site.fullName} home`} className="flex items-center gap-2.5">
                <LogoMark className="h-9 w-9" />
                <span className="flex flex-col leading-none">
                  <span className="font-display text-[19px] font-semibold tracking-[0.14em] text-night-50">
                    {site.name}
                  </span>
                  <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.34em] text-gold-500/90">
                    Grooming Studio
                  </span>
                </span>
              </Link>
              <div className="flex items-center gap-1">
                <ThemePicker />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-night-700/80 text-night-200 transition-colors duration-200 hover:border-gold-500/70 hover:text-gold-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-night-500">
                Menu
              </p>
              <nav className="flex flex-col" aria-label="Site navigation">
                {ALL_LINKS.map((item, index) => (
                  <motion.div
                    key={item.to}
                    initial={reduce ? false : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: reduce ? 0 : 0.03 * index, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2.5 text-[17px] font-medium transition-colors duration-200',
                          isActive
                            ? 'bg-gold-500/10 text-gold-300'
                            : 'text-night-200 hover:bg-night-900 hover:text-gold-200',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            aria-hidden="true"
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200',
                              isActive ? 'bg-gold-400' : 'bg-night-700',
                            )}
                          />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  </motion.div>
                ))}
              </nav>

              <div className="my-3 border-t border-night-800" />

              <div className="grid grid-cols-2 gap-2 px-1">
                <Link
                  to={customer ? '/account' : '/account/login'}
                  onClick={onClose}
                  className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-night-800 bg-night-900/60 px-3 text-sm font-medium text-night-200 transition-colors duration-200 hover:border-gold-500/50 hover:text-gold-200"
                >
                  <UserRound className="h-4 w-4 text-gold-400" />
                  {customer ? 'My account' : 'Sign in'}
                </Link>
                <Link
                  to="/shop/cart"
                  onClick={onClose}
                  className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-night-800 bg-night-900/60 px-3 text-sm font-medium text-night-200 transition-colors duration-200 hover:border-gold-500/50 hover:text-gold-200"
                >
                  <ShoppingCart className="h-4 w-4 text-gold-400" />
                  Cart{cartCount > 0 ? ` (${cartCount})` : ''}
                </Link>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="border-t border-night-800 px-5 py-4">
              <ButtonLink
                to="/book"
                variant="gold"
                size="lg"
                fullWidth
                onClick={(event) => {
                  onClose()
                  handleBookClick(event)
                }}
              >
                Book Appointment
              </ButtonLink>
              <p className="mt-3 text-center text-xs text-night-500">{site.phone}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
