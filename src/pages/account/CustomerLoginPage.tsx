import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { KeyRound, LoaderCircle, LogIn, UserPlus } from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import PageHero from '../../components/layout/PageHero'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/ToastNotification'
import { accountApi } from '../../api/account'
import { useCustomerAuth } from '../../store/customerAuth'
import { cn } from '../../utils/cn'

type Mode = 'otp' | 'password' | 'register'

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
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, customer } = useCustomerAuth()

  const from = (location.state as { from?: string } | null)?.from ?? '/account'

  useEffect(() => {
    if (customer) navigate(from, { replace: true })
  }, [customer, from, navigate])

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

  return (
    <PageTransition>
      <PageHero
        eyebrow="Customer Account"
        crumb="Login"
        title="Returning Customer? Login"
        description="Your details are saved — booking again takes seconds."
        imageId="1563013544-824ae1b704d3"
      />

      <section className="bg-night-950 py-24">
        <div className="container-app max-w-md">
          <div className="rounded-2xl border border-night-800 bg-night-900/40 p-7">
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
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                        Password
                      </span>
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
      </section>
    </PageTransition>
  )
}
