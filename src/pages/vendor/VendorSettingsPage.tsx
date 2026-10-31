import { useEffect, useState } from 'react'
import { AlertTriangle, KeyRound, Store } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/admin/AdminUI'
import { useToast } from '../../components/ui/ToastNotification'
import { vendorApi, type VendorProfile } from '../../api/vendor'

const inputClass =
  'w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none'

export default function VendorSettingsPage() {
  const { showToast } = useToast()
  const [vendor, setVendor] = useState<VendorProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const [form, setForm] = useState({
    contactName: '',
    phone: '',
    address: '',
    location: '',
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    businessInfo: '',
  })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })

  useEffect(() => {
    vendorApi
      .me()
      .then((profile) => {
        setVendor(profile)
        setForm({
          contactName: profile.contactName,
          phone: profile.phone,
          address: profile.address ?? '',
          location: profile.location ?? '',
          bankName: profile.bankName ?? '',
          bankAccountName: profile.bankAccountName ?? '',
          bankAccountNumber: profile.bankAccountNumber ?? '',
          businessInfo: profile.businessInfo ?? '',
        })
      })
      .catch((error) => showToast((error as Error).message, 'error'))
  }, [showToast])

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const updated = await vendorApi.updateProfile(form)
      setVendor(updated)
      showToast('Profile updated.')
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setChangingPassword(true)
    try {
      await vendorApi.changePassword(passwords.currentPassword, passwords.newPassword)
      showToast('Password changed.')
      setPasswords({ currentPassword: '', newPassword: '' })
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-night-50 sm:text-3xl">Settings</h1>
        <p className="mt-1.5 text-sm text-night-400">
          Your business profile, payout details and account security.
        </p>
      </div>

      {vendor && vendor.status !== 'APPROVED' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="text-sm text-amber-100/90">
            <p className="font-semibold">
              Your account status: {vendor.status.replace('_', ' ').toLowerCase()}
            </p>
            {vendor.statusReason && <p className="mt-1">{vendor.statusReason}</p>}
            <p className="mt-1">
              {vendor.status === 'PENDING'
                ? 'Products can be listed once an administrator approves your application.'
                : 'Contact the administrator for details.'}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={saveProfile} className="rounded-2xl border border-night-800 bg-night-900/40 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl text-night-50">Business Profile</h2>
            <p className="text-xs text-night-500">{vendor?.email}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Contact person">
            <input value={form.contactName} onChange={set('contactName')} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={set('phone')} className={inputClass} />
          </Field>
          <Field label="Business address">
            <input value={form.address} onChange={set('address')} className={inputClass} />
          </Field>
          <Field label="City / Area">
            <input value={form.location} onChange={set('location')} className={inputClass} />
          </Field>
        </div>

        <div className="mt-6 border-t border-night-800 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-500">
            Payout details
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Bank name">
              <input value={form.bankName} onChange={set('bankName')} placeholder="e.g. GTBank" className={inputClass} />
            </Field>
            <Field label="Account name">
              <input value={form.bankAccountName} onChange={set('bankAccountName')} className={inputClass} />
            </Field>
            <Field label="Account number">
              <input value={form.bankAccountNumber} onChange={set('bankAccountNumber')} className={inputClass} />
            </Field>
          </div>
        </div>

        <div className="mt-6">
          <Field label="About your business">
            <textarea rows={3} value={form.businessInfo} onChange={set('businessInfo')} className={`${inputClass} resize-none`} />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" variant="gold" size="md" loading={saving}>
            Save Profile
          </Button>
        </div>
      </form>

      <form onSubmit={savePassword} className="rounded-2xl border border-night-800 bg-night-900/40 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/40 bg-gold-500/10 text-gold-400">
            <KeyRound className="h-5 w-5" />
          </span>
          <h2 className="font-display text-xl text-night-50">Change Password</h2>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Current password">
            <input
              required
              type="password"
              value={passwords.currentPassword}
              onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))}
              className={inputClass}
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" hint="Minimum 8 characters.">
            <input
              required
              type="password"
              minLength={8}
              value={passwords.newPassword}
              onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))}
              className={inputClass}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="submit" variant="outline" size="md" loading={changingPassword}>
            Change Password
          </Button>
        </div>
      </form>
    </div>
  )
}
