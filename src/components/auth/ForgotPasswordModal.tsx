import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, KeyRound, LoaderCircle, Lock, Mail, ShieldAlert, X, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { authApi } from '../../api'
import { useToast } from '../ui/ToastNotification'

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  defaultEmail?: string
  target?: 'ADMIN' | 'CUSTOMER'
  onSuccess?: (email: string) => void
}

type Step = 'email' | 'code' | 'password' | 'success'

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  defaultEmail = '',
  target = 'ADMIN',
  onSuccess,
}: ForgotPasswordModalProps) {
  const { showToast } = useToast()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(defaultEmail)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail)
      setStep('email')
      setCode('')
      setNewPassword('')
      setConfirmPassword('')
      setError(null)
      setDevCode(null)
    }
  }, [isOpen, defaultEmail])

  if (!isOpen) return null

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.forgotPasswordRequest(email.trim(), target)
      setDevCode(res.devCode ?? null)
      showToast('Verification code sent to your email.', 'success')
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request code.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim().length !== 6 || loading) return
    setLoading(true)
    setError(null)
    try {
      await authApi.forgotPasswordVerify(email.trim(), code.trim(), target)
      showToast('Code verified! Please enter your new password.', 'success')
      setStep('password')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await authApi.forgotPasswordReset(email.trim(), code.trim(), newPassword, target)
      setStep('success')
      showToast('Password reset successfully!', 'success')
      setTimeout(() => {
        onSuccess?.(email.trim())
        onClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="relative w-full max-w-md rounded-2xl border border-gold-500/30 bg-night-900 p-6 shadow-2xl sm:p-8"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-night-400 transition-colors hover:bg-night-800 hover:text-night-100"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
              {step === 'code' ? (
                <KeyRound className="h-6 w-6" />
              ) : step === 'password' ? (
                <Lock className="h-6 w-6" />
              ) : step === 'success' ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              ) : (
                <Mail className="h-6 w-6" />
              )}
            </span>
            <h2 className="mt-4 font-display text-xl font-bold text-night-50">
              {step === 'code'
                ? 'Verify Security Code'
                : step === 'password'
                  ? 'Set New Password'
                  : step === 'success'
                    ? 'Password Updated!'
                    : 'Forgot Password?'}
            </h2>
            <p className="mt-1 text-xs text-night-400">
              {step === 'code'
                ? `Enter the 6-digit code sent to ${email}`
                : step === 'password'
                  ? 'Choose a strong password with letters and numbers.'
                  : step === 'success'
                    ? 'You can now sign in with your new password.'
                    : `Enter your ${target === 'ADMIN' ? 'admin' : 'account'} email to receive a password reset code.`}
            </p>
          </div>

          {/* Stepper Progress */}
          <div className="my-5 flex items-center justify-center gap-2">
            {(['email', 'code', 'password'] as const).map((s, idx) => {
              const isActive = step === s
              const isDone =
                (s === 'email' && (step === 'code' || step === 'password' || step === 'success')) ||
                (s === 'code' && (step === 'password' || step === 'success')) ||
                step === 'success'
              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'w-8 bg-gold-500'
                        : isDone
                          ? 'w-2 bg-gold-500/80'
                          : 'w-2 bg-night-700'
                    }`}
                  />
                  {idx < 2 && <span className="h-0.5 w-2 bg-night-800" />}
                </div>
              )
            })}
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                  Email Address
                </span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-night-700 bg-night-950/70 py-2.5 pl-10 pr-4 text-sm text-night-100 placeholder:text-night-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                    autoFocus
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 text-xs font-semibold uppercase tracking-wider text-night-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Send Reset Code
              </button>
            </form>
          )}

          {/* Step 2: Code */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                  6-Digit Verification Code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full rounded-xl border border-night-700 bg-night-950/70 py-3 text-center font-mono text-2xl tracking-[0.4em] text-gold-400 placeholder:text-night-700 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                  autoFocus
                />
              </label>

              {devCode && (
                <div className="rounded-lg border border-gold-500/30 bg-gold-500/10 p-2.5 text-center text-xs text-gold-300">
                  Dev/Test Code: <span className="font-mono font-bold tracking-widest text-gold-400">{devCode}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.trim().length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 text-xs font-semibold uppercase tracking-wider text-night-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Verify Code
              </button>

              <div className="flex items-center justify-between text-xs text-night-400 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="hover:text-night-200"
                >
                  Change email
                </button>
                <button
                  type="button"
                  onClick={(e) => handleRequestCode(e)}
                  disabled={loading}
                  className="text-gold-400 hover:text-gold-300 disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                  New Password
                </span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-night-700 bg-night-950/70 py-2.5 pl-10 pr-10 text-sm text-night-100 placeholder:text-night-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-night-400 hover:text-night-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                  Confirm New Password
                </span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-night-700 bg-night-950/70 py-2.5 pl-10 pr-10 text-sm text-night-100 placeholder:text-night-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                  />
                </div>
              </label>

              <div className="text-[11px] text-night-500 space-y-1">
                <p className={newPassword.length >= 8 ? 'text-emerald-400' : ''}>• At least 8 characters</p>
                <p className={/[A-Za-z]/.test(newPassword) && /\d/.test(newPassword) ? 'text-emerald-400' : ''}>
                  • Contains both letters and numbers
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 text-xs font-semibold uppercase tracking-wider text-night-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Reset Password
              </button>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="py-4 text-center">
              <p className="text-sm text-night-300">
                Your password has been reset successfully. Redirecting you to sign in...
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
