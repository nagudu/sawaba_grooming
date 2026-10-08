import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Lock, Mail, Scissors } from 'lucide-react'
import { useAdminAuth } from '../../store/adminAuth'
import { useToast } from '../../components/ui/ToastNotification'
import ForgotPasswordModal from '../../components/auth/ForgotPasswordModal'

export default function AdminLoginPage() {
  const { login } = useAdminAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      showToast('Welcome back, admin.')
      navigate('/admin', { replace: true })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Login failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-night-950 px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,162,75,0.07),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="card-lux p-8">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
              <Scissors className="h-6 w-6" />
            </span>
            <h1 className="mt-5 font-display text-2xl text-night-50">SAWABA Admin</h1>
            <p className="mt-1.5 text-sm text-night-400">
              Sign in to manage your salon.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                Email
              </span>
              <div className="relative">
                <Mail className="field-icon h-4 w-4" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@sawabasalon.com"
                  className="field pl-11"
                />
              </div>
            </label>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                  Password
                </span>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs text-gold-400 transition-colors hover:text-gold-300"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="field-icon h-4 w-4" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="field pl-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-night-400 hover:text-night-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-night-950 transition-all duration-300 hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Sign In
            </button>
          </form>

          <a
            href="/"
            className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-night-400 transition-colors hover:text-gold-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-night-600">
          Authorized personnel only.
        </p>
      </motion.div>

      <ForgotPasswordModal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
        defaultEmail={email}
        target="ADMIN"
        onSuccess={(resetEmail) => setEmail(resetEmail)}
      />
    </div>
  )
}