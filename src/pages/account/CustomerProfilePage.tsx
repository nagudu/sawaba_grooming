import { useEffect, useState } from 'react'
import { KeyRound, Save } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/ToastNotification'
import { accountApi } from '../../api/account'
import { useCustomerAuth } from '../../store/customerAuth'
import { api } from '../../api'
import type { BarberItem, ServiceItem } from '../../api'
import { formatLongDate } from '../../utils/format'

function customerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}

export default function CustomerProfilePage() {
  const { customer, refresh } = useCustomerAuth()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [barbers, setBarbers] = useState<BarberItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [preferredBarberId, setPreferredBarberId] = useState<number | null>(null)
  const [favoriteServiceId, setFavoriteServiceId] = useState<number | null>(null)
  const [reminderOptIn, setReminderOptIn] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [hasPassword, setHasPassword] = useState(false)

  useEffect(() => {
    if (!customer) return
    setFullName(customer.fullName)
    setEmail(customer.email ?? '')
    setPreferredBarberId(customer.preferredBarberId)
    setFavoriteServiceId(customer.favoriteServiceId)
    setReminderOptIn(customer.reminderOptIn)
  }, [customer])

  useEffect(() => {
    void (async () => {
      try {
        const [serviceRes, barberRes] = await Promise.all([
          api.get<{ items: ServiceItem[] }>('/api/services?perPage=100'),
          api.get<{ items: BarberItem[] }>('/api/barbers?perPage=100'),
        ])
        setServices(serviceRes.items)
        setBarbers(barberRes.items)
      } catch {
        // selectors stay empty; core profile editing still works
      }
    })()
  }, [])

  useEffect(() => {
    // Whether the account has a password decides if the current-password field is required.
    setHasPassword(Boolean(customer?.lastLoginAt))
  }, [customer])

  async function saveProfile() {
    if (saving) return
    setSaving(true)
    try {
      const { customer: updated } = await accountApi.updateProfile({
        fullName: fullName.trim(),
        email: email.trim() || null,
        preferredBarberId,
        favoriteServiceId,
        reminderOptIn,
      })
      showToast('Profile updated.', 'success')
      await refresh()
      void updated
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function savePassword() {
    if (savingPassword) return
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      showToast('New password needs 8+ characters with a letter and a number.', 'error')
      return
    }
    setSavingPassword(true)
    try {
      await accountApi.changePassword(hasPassword ? currentPassword : null, newPassword)
      showToast('Password updated.', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setHasPassword(true)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update password.', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  if (!customer) return null

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <p className="label-luxe mb-1">My Account</p>
        <h1 className="font-display text-3xl text-night-50">My Profile</h1>
        <p className="mt-1.5 text-sm text-night-400">
          Your details, preferences and customer ID.
        </p>
      </div>
      <div className="space-y-6">
        <div className="grid gap-6">
          {/* Identity card */}
          <div className="card-lux p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gold-500/30 bg-gold-500/10 font-display text-xl font-bold text-gold-400">
                  {customerInitials(customer.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-xl text-night-50">{customer.fullName}</p>
                  <p className="mt-0.5 text-sm text-night-400">{customer.phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 border-t border-night-800 pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 sm:text-right">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                    Customer ID
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold tracking-wide text-gold-400">
                    {customer.customerCode}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                    Member since
                  </p>
                  <p className="mt-1 text-sm font-semibold text-night-100">
                    {formatLongDate(customer.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Editable profile */}
          <div className="rounded-2xl border border-night-800 bg-night-900/40 p-6">
            <h2 className="font-display text-lg text-night-50">Edit Profile</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">Full name</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="field" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">Phone</span>
                <input value={customer.phone} disabled className="field opacity-60" />
                <span className="mt-1 block text-[11px] text-night-500">Phone is your login identity — contact the salon to change it.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field" placeholder="you@example.com" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">Preferred barber</span>
                <select
                  value={preferredBarberId ?? ''}
                  onChange={(event) => setPreferredBarberId(event.target.value ? Number(event.target.value) : null)}
                  className="field"
                >
                  <option value="">No preference</option>
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>{barber.name}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">Favorite service</span>
                <select
                  value={favoriteServiceId ?? ''}
                  onChange={(event) => setFavoriteServiceId(event.target.value ? Number(event.target.value) : null)}
                  className="field"
                >
                  <option value="">No favorite</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={reminderOptIn}
                  onChange={(event) => setReminderOptIn(event.target.checked)}
                  className="h-4 w-4 accent-gold-500"
                />
                <span className="text-sm text-night-300">
                  Send me booking reminders when it's almost time for my next visit
                </span>
              </label>
            </div>
            <Button variant="gold" size="md" loading={saving} className="mt-5" onClick={() => void saveProfile()}>
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>

          {/* Password */}
          <div className="rounded-2xl border border-night-800 bg-night-900/40 p-6">
            <h2 className="font-display text-lg text-night-50">
              {hasPassword ? 'Change Password' : 'Set a Password'}
            </h2>
            <p className="mt-1 text-sm text-night-400">
              {hasPassword
                ? 'Used for quick login with your phone number.'
                : 'Optional — lets you login without waiting for a code.'}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {hasPassword && (
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">Current password</span>
                  <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="field" autoComplete="current-password" />
                </label>
              )}
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">New password</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="field" placeholder="8+ characters with a number" autoComplete="new-password" />
              </label>
            </div>
            <Button variant="outline" size="md" loading={savingPassword} className="mt-5" onClick={() => void savePassword()}>
              <KeyRound className="h-4 w-4" />
              Update Password
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
