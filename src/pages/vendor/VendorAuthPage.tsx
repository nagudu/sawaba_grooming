import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Store, ArrowLeft } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/ToastNotification'
import { setVendorToken, vendorApi } from '../../api/vendor'

const inputClass =
  'w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-night-500">{hint}</span>}
    </label>
  )
}

/**
 * Public vendor auth — `mode` prop switches between /vendor/login and
 * /vendor/register. Registration submits the application (status PENDING).
 */
export default function VendorAuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  // Login state
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  // Register state
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    registerPassword: '',
    address: '',
    location: '',
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    businessInfo: '',
  })

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const session = await vendorApi.login(identifier, password)
      setVendorToken(session.token)
      showToast('Welcome back!')
      navigate('/vendor')
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitRegister = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await vendorApi.register({
        businessName: form.businessName,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        password: form.registerPassword,
        address: form.address || undefined,
        location: form.location || undefined,
        bankName: form.bankName || undefined,
        bankAccountName: form.bankAccountName || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
        businessInfo: form.businessInfo || undefined,
      })
      showToast(result.message, 'success')
      navigate('/vendor/login')
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-night-950 px-4 py-12">
      <div className="w-full max-w-2xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-night-400 transition-colors hover:text-gold-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to SAWABA
        </Link>

        <div className="rounded-2xl border border-night-800 bg-night-900/50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl text-night-50">
                {mode === 'login' ? 'Vendor Sign In' : 'Sell on SAWABA'}
              </h1>
              <p className="text-sm text-night-400">
                {mode === 'login'
                  ? 'Access your store dashboard'
                  : 'Apply to sell barbering products on the marketplace'}
              </p>
            </div>
          </div>

          {mode === 'login' ? (
            <form onSubmit={submitLogin} className="mt-7 space-y-4">
              <Field label="Email or phone">
                <input
                  required
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="vendor@example.com"
                  className={inputClass}
                  autoComplete="username"
                />
              </Field>
              <Field label="Password">
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  autoComplete="current-password"
                />
              </Field>
              <Button type="submit" variant="gold" size="lg" fullWidth loading={busy}>
                Sign In
              </Button>
              <p className="text-center text-sm text-night-400">
                New vendor?{' '}
                <Link to="/vendor/register" className="font-semibold text-gold-400 hover:text-gold-300">
                  Apply to sell
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="mt-7 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business / brand name">
                  <input required value={form.businessName} onChange={set('businessName')} placeholder="e.g. Fresh Cuts Supplies" className={inputClass} />
                </Field>
                <Field label="Contact person">
                  <input required value={form.contactName} onChange={set('contactName')} placeholder="Your full name" className={inputClass} />
                </Field>
                <Field label="Email">
                  <input required type="email" value={form.email} onChange={set('email')} placeholder="vendor@example.com" className={inputClass} />
                </Field>
                <Field label="Phone">
                  <input required value={form.phone} onChange={set('phone')} placeholder="0801 234 5678" className={inputClass} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Password" hint="Minimum 8 characters — used to sign in to your dashboard.">
                    <input
                      required
                      type="password"
                      minLength={8}
                      value={form.registerPassword}
                      onChange={set('registerPassword')}
                      placeholder="••••••••"
                      className={inputClass}
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
                <Field label="Business address">
                  <input value={form.address} onChange={set('address')} placeholder="Street address" className={inputClass} />
                </Field>
                <Field label="City / Area">
                  <input value={form.location} onChange={set('location')} placeholder="e.g. Dutse, Abuja" className={inputClass} />
                </Field>
                <Field label="Bank name">
                  <input value={form.bankName} onChange={set('bankName')} placeholder="e.g. GTBank" className={inputClass} />
                </Field>
                <Field label="Account name">
                  <input value={form.bankAccountName} onChange={set('bankAccountName')} placeholder="Account holder" className={inputClass} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Account number" hint="Used for payout settlements after approval.">
                    <input value={form.bankAccountNumber} onChange={set('bankAccountNumber')} placeholder="0123456789" className={inputClass} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="About your business (optional)">
                    <textarea
                      rows={3}
                      value={form.businessInfo}
                      onChange={set('businessInfo')}
                      placeholder="What do you sell? Brands, verification details…"
                      className={`${inputClass} resize-none`}
                    />
                  </Field>
                </div>
              </div>

              <Button type="submit" variant="gold" size="lg" fullWidth loading={busy}>
                Submit Application
              </Button>
              <p className="text-center text-sm text-night-400">
                Already a vendor?{' '}
                <Link to="/vendor/login" className="font-semibold text-gold-400 hover:text-gold-300">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
