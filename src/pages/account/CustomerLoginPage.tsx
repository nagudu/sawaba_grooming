import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, LoaderCircle, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import { Button } from '../../components/ui/Button'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'
import { isGoogleSignInAvailable } from '../../lib/googleIdentity'
import { useToast } from '../../components/ui/ToastNotification'
import { accountApi, type CustomerProfile } from '../../api/account'
import { useCustomerAuth } from '../../store/customerAuth'
import { cn } from '../../utils/cn'
import { site } from '../../data/services'
import ForgotPasswordModal from '../../components/auth/ForgotPasswordModal'

type Mode = 'otp' | 'password' | 'register'

/** A Google sign-in that succeeded but still needs a real phone number. */
interface PendingGoogleProfile {
  profile: CustomerProfile
}

export default function CustomerLoginPage() {
  const [mode, setMode] = useState<Mode>('otp')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [pendingGoogle, setPendingGoogle] = useState<PendingGoogleProfile | null>(null)
  const [googlePhone, setGooglePhone] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, customer, refresh } = useCustomerAuth()

  const from = (location.state as { from?: string } | null)?.from ?? '/account'

  // A Google account that has just been created still needs a phone number, so
  // hold the redirect while the "one last step" card is on screen. `login()` and
  // `setPendingGoogle()` are called in the same handler, so both are already
  // applied by the time this runs.
  useEffect(() => {
    if (customer && !pendingGoogle) navigate(from, { replace: true })
  }, [customer, pendingGoogle, from, navigate])

  async function handleSendOtp() {
    if (phone.trim().length < 10 || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await accountApi.requestOtp(phone.trim())
      if (!result.found) {
        setError(result.message)
        setMode('register')
        return
      }
      setOtpSent(true)
      setDevCode(result.devCode)
      showToast(result.message, 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyOtp() {
    if (code.trim().length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const { token, customer: profile } = await accountApi.verifyOtp(phone.trim(), code.trim())
      login(profile, token)
      showToast(`Welcome back, ${profile.fullName.split(' ')[0]}!`, 'success')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordLogin() {
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      const { token, customer: profile } = await accountApi.loginPassword(phone.trim(), password)
      login(profile, token)
      showToast(`Welcome back, ${profile.fullName.split(' ')[0]}!`, 'success')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { token, customer: profile } = await accountApi.register({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        password: password || undefined,
      })
      login(profile, token)
      showToast(`Account created. Welcome, ${profile.fullName.split(' ')[0]}!`, 'success')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Receives the Google ID token. Nothing is trusted from it here — the
   * backend verifies the signature/audience and decides whether to sign in,
   * link an existing account, or create one.
   */
  async function handleGoogleCredential(credential: string) {
    if (googleBusy) return
    setGoogleBusy(true)
    setError(null)
    try {
      const result = await accountApi.loginWithGoogle(credential)
      login(result.customer, result.token)
      showToast(
        result.outcome === 'created'
          ? `Account created. Welcome, ${result.customer.fullName.split(' ')[0]}!`
          : `Welcome back, ${result.customer.fullName.split(' ')[0]}!`,
        'success',
      )
      if (result.needsPhone) {
        setPendingGoogle({ profile: result.customer })
        setGooglePhone('')
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.')
    } finally {
      setGoogleBusy(false)
    }
  }

  function handleGoogleCancel() {
    setGoogleBusy(false)
    setError('Google sign-in was cancelled. Your details were not changed.')
  }

  function handleGoogleLoadError(message: string) {
    setGoogleBusy(false)
    setError(message)
  }

  /** Completes a Google-created account by attaching a real phone number. */
  async function handleCompleteGoogleProfile() {
    if (!pendingGoogle) return
    if (googlePhone.trim().length < 10 || googleBusy) return
    setGoogleBusy(true)
    setError(null)
    try {
      const { customer: updated } = await accountApi.updateProfile({ phone: googlePhone.trim() })
      await refresh()
      setPendingGoogle(null)
      showToast('Phone number saved.', 'success')
      navigate(from, { replace: true })
      void updated
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your phone number.')
    } finally {
      setGoogleBusy(false)
    }
  }

  function skipGoogleProfile() {
    setPendingGoogle(null)
    navigate(from, { replace: true })
  }

  return (
    <PageTransition>
      <section className="flex min-h-screen flex-col items-center justify-center gap-8 bg-night-950 px-4 py-16">
        <div className="flex flex-col items-center">
          <svg className="h-14 w-14" viewBox="0 0 64 64" aria-hidden="true">
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
          <span className="mt-3 font-display text-2xl leading-none font-semibold tracking-[0.12em] text-night-50">
            {site.name}
          </span>
          <span className="mt-2 text-[8.5px] font-semibold tracking-[0.32em] text-gold-500 uppercase">
            Grooming Studio
          </span>
        </div>

        <div className="container-app max-w-md">
          <div className="rounded-2xl border border-night-800 bg-night-900/40 p-7">
            {pendingGoogle ? (
              /* ── Google created the account; it needs a phone number ───── */
              <div className="space-y-5">
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10">
                    <ShieldCheck className="h-5 w-5 text-gold-400" />
                  </span>
                  <h2 className="mt-4 font-display text-xl font-semibold text-night-50">
                    One last step
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-night-400">
                    You are signed in as {pendingGoogle.profile.fullName}. Add the phone number
                    we will use for your appointment reminders.
                  </p>
                </div>

                {error && (
                  <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </p>
                )}

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                    Phone number
                  </span>
                  <input
                    type="tel"
                    value={googlePhone}
                    onChange={(event) => setGooglePhone(event.target.value)}
                    className="field"
                    placeholder="e.g. 08012345678"
                    autoComplete="tel"
                    autoFocus
                    onKeyDown={(event) => event.key === 'Enter' && void handleCompleteGoogleProfile()}
                  />
                </label>

                <div className="space-y-3">
                  <Button
                    variant="gold"
                    size="lg"
                    loading={googleBusy}
                    className="w-full"
                    onClick={() => void handleCompleteGoogleProfile()}
                  >
                    Save &amp; Continue
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    className="w-full"
                    disabled={googleBusy}
                    onClick={skipGoogleProfile}
                  >
                    Skip for now
                  </Button>
                </div>

                <p className="text-center text-xs text-night-500">
                  You can add this later in your profile.
                </p>
              </div>
            ) : (
              <>
            {/* ── Google Identity Services ───────────────────────────── */}
            {isGoogleSignInAvailable() && (
              <div className="mb-6">
                <GoogleSignInButton
                  onCredential={(credential) => void handleGoogleCredential(credential)}
                  onCancel={handleGoogleCancel}
                  onError={handleGoogleLoadError}
                  disabled={googleBusy || busy}
                  context={mode === 'register' ? 'signup' : 'signin'}
                />
                <p className="mt-3 text-center text-[11px] leading-relaxed text-night-500">
                  We never see your Google password.
                </p>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-night-800" />
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-night-500 uppercase">
                    or use your phone
                  </span>
                  <span className="h-px flex-1 bg-night-800" />
                </div>
              </div>
            )}

            {/* Mode tabs */}
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-night-800 bg-night-950/60 p-1">
              {(
                [
                  { id: 'otp', label: 'Phone Code' },
                  { id: 'password', label: 'Password' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id)
                    setError(null)
                  }}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                    (mode === tab.id || (tab.id === 'otp' && mode === 'register'))
                      ? 'bg-gold-500/15 text-gold-400'
                      : 'text-night-400 hover:text-night-200',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {error && (
              <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            )}

            {mode !== 'register' ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                    Phone number
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="field"
                    placeholder="e.g. 08012345678"
                    autoComplete="tel"
                  />
                </label>

                {mode === 'otp' && otpSent && (
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                      6-digit code
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                      className="field text-center font-mono text-xl tracking-[0.5em]"
                      placeholder="––––––"
                      autoFocus
                    />
                    {devCode && (
                      <span className="mt-2 block text-xs text-night-500">
                        Test mode — your code: <span className="font-mono text-gold-400">{devCode}</span>
                      </span>
                    )}
                  </label>
                )}

                {mode === 'otp' ? (
                  otpSent ? (
                    <div className="space-y-3">
                      <Button variant="gold" size="lg" loading={busy} className="w-full" onClick={() => void handleVerifyOtp()}>
                        <LogIn className="h-4 w-4" />
                        Verify &amp; Login
                      </Button>
                      <Button
                        variant="ghost"
                        size="md"
                        className="w-full"
                        onClick={() => void handleSendOtp()}
                        disabled={busy}
                      >
                        Resend code
                      </Button>
                    </div>
                  ) : (
                    <Button variant="gold" size="lg" loading={busy} className="w-full" onClick={() => void handleSendOtp()}>
                      <KeyRound className="h-4 w-4" />
                      Send OTP
                    </Button>
                  )
                ) : (
                  <>
                    <label className="block">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                          Password
                        </span>
                        <button
                          type="button"
                          onClick={() => setForgotOpen(true)}
                          className="text-xs font-medium text-gold-400 hover:text-gold-300"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="field"
                        autoComplete="current-password"
                        onKeyDown={(event) => event.key === 'Enter' && void handlePasswordLogin()}
                      />
                    </label>
                    <Button variant="gold" size="lg" loading={busy} className="w-full" onClick={() => void handlePasswordLogin()}>
                      <LogIn className="h-4 w-4" />
                      Login
                    </Button>
                  </>
                )}

                <button
                  type="button"
                  className="w-full text-center text-sm text-gold-400 hover:text-gold-300"
                  onClick={() => {
                    setMode('register')
                    setError(null)
                  }}
                >
                  New here? Create an account
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                    Full name
                  </span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="field" placeholder="e.g. Halifa Shuaibu" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                    Phone number
                  </span>
                  <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="field" placeholder="e.g. 08012345678" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                    Email <span className="font-normal text-night-500">(optional — for codes &amp; receipts)</span>
                  </span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field" placeholder="you@example.com" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                    Password <span className="font-normal text-night-500">(optional)</span>
                  </span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field" placeholder="8+ characters with a number" />
                </label>
                <Button variant="gold" size="lg" loading={busy} className="w-full" onClick={() => void handleRegister()}>
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </Button>
                <button
                  type="button"
                  className="w-full text-center text-sm text-gold-400 hover:text-gold-300"
                  onClick={() => {
                    setMode('otp')
                    setError(null)
                  }}
                >
                  Already have an account? Login
                </button>
              </div>
            )}
              </>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-night-500">
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Working…
              </span>
            ) : (
              'One account per phone number — your booking history stays with you.'
            )}
          </p>
        </div>

        <ForgotPasswordModal
          isOpen={forgotOpen}
          onClose={() => setForgotOpen(false)}
          target="CUSTOMER"
        />
      </section>
    </PageTransition>
  )
}
