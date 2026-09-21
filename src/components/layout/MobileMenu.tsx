import { AnimatePresence, motion } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { ButtonLink } from '../ui/Button'
import ThemePicker from '../ui/ThemePicker'
import { site } from '../../data/services'

interface MobileMenuProps {
  open: boolean
  onClose: () => void
}

const links = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/barbers', label: 'Barbers' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
]

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="absolute inset-0 bg-night-950/95 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            className="relative flex h-full flex-col px-6 pt-5 pb-8"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xl font-semibold tracking-wide text-night-50">
                {site.name}
              </span>
              <div className="flex items-center gap-1">
                <ThemePicker />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="rounded-lg p-2 text-night-400 transition-colors hover:text-gold-400"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <nav className="mt-12 flex flex-1 flex-col gap-1" aria-label="Mobile navigation">
              {links.map((link, index) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 32 }}
                  transition={{ delay: 0.05 * (index + 1), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <NavLink
                    to={link.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-4 py-3.5 font-display text-2xl font-medium transition-colors duration-200',
                        isActive
                          ? 'text-gold-400'
                          : 'text-night-200 hover:text-gold-400',
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </motion.div>
              ))}
            </nav>

            <div className="mt-auto">
              <ButtonLink
                to="/book"
                onClick={onClose}
                variant="gold"
                size="lg"
                fullWidth
              >
                Book Appointment
              </ButtonLink>
              <p className="mt-6 text-center text-xs text-night-500">
                {site.phone}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}