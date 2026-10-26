import { Link, Navigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, QrCode, ShieldCheck, TriangleAlert } from 'lucide-react'
import { getAdminToken } from '../api'
import { getBarberToken } from '../api/barberPortal'

/**
 * Compatibility landing for previously-issued QR *links* (/qr/<token>).
 *
 * Current QR codes no longer contain a URL — they encode only the opaque token
 * and are meant to be read by the in-app scanner. This route exists solely so
 * any link-shaped QR generated before that fix still resolves gracefully: it
 * never shows a booking to an anonymous visitor; it forwards signed-in staff to
 * the scanner with the token, or asks them to sign in first.
 */
export default function QrScanLandingPage() {
  const { token } = useParams<{ token: string }>()
  const cleanToken = (token ?? '').trim()

  const shell = (children: React.ReactNode) => (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-night-950 px-6 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,162,75,0.07),transparent_60%)]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="card-lux p-8">{children}</div>
      </motion.div>
    </div>
  )

  if (!cleanToken) {
    return shell(
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 text-red-400">
          <TriangleAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-5 font-display text-2xl text-night-50">Invalid check-in link</h1>
        <p className="mt-1.5 text-sm text-night-400">
          This link is missing its booking code. Ask the customer to show the QR code again.
        </p>
        <Link
          to="/"
          className="mt-6 text-sm font-semibold text-night-400 transition-colors hover:text-gold-400"
        >
          Back to website
        </Link>
      </div>,
    )
  }

  const scanQuery = `?token=${encodeURIComponent(cleanToken)}`

  // Already signed in — hand the token to the right scanner.
  if (getAdminToken()) return <Navigate to={`/admin/qr${scanQuery}`} replace />
  if (getBarberToken()) return <Navigate to={`/barber/scan${scanQuery}`} replace />

  const selfPath = `/qr/${encodeURIComponent(cleanToken)}`

  return shell(
    <div className="flex flex-col items-center text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
        <QrCode className="h-6 w-6" />
      </span>
      <h1 className="mt-5 font-display text-2xl text-night-50">SAWABA Check-In</h1>
      <p className="mt-1.5 text-sm text-night-400">
        This is a staff check-in code. Sign in to verify the booking and check the customer in.
      </p>

      <div className="mt-8 grid w-full gap-3">
        <Link
          to={`/admin/login?redirect=${encodeURIComponent(selfPath)}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-night-950 transition-all duration-300 hover:bg-gold-400"
        >
          <LogIn className="h-4 w-4" />
          Admin sign in
        </Link>
        <Link
          to={`/barber/login?redirect=${encodeURIComponent(selfPath)}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-night-700 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-night-100 transition-all duration-300 hover:border-gold-500/50 hover:text-gold-300"
        >
          <LogIn className="h-4 w-4" />
          Barber sign in
        </Link>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-night-600">
        <ShieldCheck className="h-3.5 w-3.5" />
        Authorized personnel only
      </p>
    </div>,
  )
}
