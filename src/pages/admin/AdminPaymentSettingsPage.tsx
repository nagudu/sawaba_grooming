import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { api } from '../../api'
import type { PaymentMethod } from '../../api'
import type { PaymentSettings } from '../../api/payments'
import { Field, PageHeader } from '../../components/admin/AdminUI'
import { Button } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { useToast } from '../../components/ui/ToastNotification'
import { PAYMENT_METHOD_LABELS } from '../../utils/payment'
import { cn } from '../../utils/cn'

const METHODS: PaymentMethod[] = ['OPAY', 'BANK_TRANSFER', 'CASH', 'OTHER']

const EMPTY_SETTINGS: PaymentSettings = {
  shopName: '',
  shopAddress: '',
  shopPhone: '',
  shopLogo: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  opayAccountName: '',
  opayAccountNumber: '',
  paymentInstructions: '',
  enabledPaymentMethods: [],
  minAmount: 0,
  fullPaymentRequired: true,
  receiptRequired: true,
  onlinePaymentEnabled: false,
}

export default function AdminPaymentSettingsPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()
  const [settings, setSettings] = useState<PaymentSettings>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setSettings(await api.get<PaymentSettings>('/api/admin/payment-settings'))
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = <K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const toggleMethod = (method: PaymentMethod) => {
    setSettings((current) => {
      const enabled = current.enabledPaymentMethods.includes(method)
      return {
        ...current,
        enabledPaymentMethods: enabled
          ? current.enabledPaymentMethods.filter((item) => item !== method)
          : [...current.enabledPaymentMethods, method],
      }
    })
  }

  const canSave = settings.shopName.trim().length > 0

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const updated = await api.put<PaymentSettings>('/api/admin/payment-settings', settings)
      setSettings(updated)
      showToast('Payment settings updated.')
    } catch (error) {
      notifyError(error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner label="Loading payment settings" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Payment Settings"
        subtitle="Details shown on the customer payment page and used to verify receipts."
      />

      <div className="space-y-6">
        <section className="card-lux p-6">
          <h2 className="mb-4 font-display text-lg text-night-50">Shop Information</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Shop name" hint="Shown at the top of the payment page and receipt.">
              <input
                type="text"
                value={settings.shopName}
                onChange={(event) => update('shopName', event.target.value)}
                className="field"
                placeholder="SAWABA Grooming Studio"
              />
            </Field>
            <Field label="Shop phone">
              <input
                type="text"
                value={settings.shopPhone ?? ''}
                onChange={(event) => update('shopPhone', event.target.value)}
                className="field"
                placeholder="+234 800 000 0000"
              />
            </Field>
            <Field label="Shop address">
              <input
                type="text"
                value={settings.shopAddress ?? ''}
                onChange={(event) => update('shopAddress', event.target.value)}
                className="field"
                placeholder="Shop address"
              />
            </Field>
            <Field label="Shop logo URL" hint="Optional image shown on receipts.">
              <input
                type="text"
                value={settings.shopLogo ?? ''}
                onChange={(event) => update('shopLogo', event.target.value)}
                className="field"
                placeholder="https://..."
              />
            </Field>
          </div>
        </section>

        <section className="card-lux p-6">
          <h2 className="mb-1 font-display text-lg text-night-50">Bank Account</h2>
          <p className="mb-4 text-xs text-night-500">Customers pay to this account for transfers.</p>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Bank name">
              <input
                type="text"
                value={settings.bankName ?? ''}
                onChange={(event) => update('bankName', event.target.value)}
                className="field"
                placeholder="GTBank"
              />
            </Field>
            <Field label="Account name">
              <input
                type="text"
                value={settings.accountName ?? ''}
                onChange={(event) => update('accountName', event.target.value)}
                className="field"
                placeholder="Account name"
              />
            </Field>
            <Field label="Account number">
              <input
                type="text"
                value={settings.accountNumber ?? ''}
                onChange={(event) => update('accountNumber', event.target.value)}
                className="field"
                placeholder="0123456789"
              />
            </Field>
          </div>
        </section>

        <section className="card-lux p-6">
          <h2 className="mb-1 font-display text-lg text-night-50">OPay</h2>
          <p className="mb-4 text-xs text-night-500">OPay payment details shown next to the bank account.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="OPay account name">
              <input
                type="text"
                value={settings.opayAccountName ?? ''}
                onChange={(event) => update('opayAccountName', event.target.value)}
                className="field"
                placeholder="Account name"
              />
            </Field>
            <Field label="OPay account number">
              <input
                type="text"
                value={settings.opayAccountNumber ?? ''}
                onChange={(event) => update('opayAccountNumber', event.target.value)}
                className="field"
                placeholder="802 345 6789"
              />
            </Field>
          </div>
        </section>

        <section className="card-lux p-6">
          <h2 className="mb-4 font-display text-lg text-night-50">Payment Rules</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Accepted methods">
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((method) => {
                  const active = settings.enabledPaymentMethods.includes(method)
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => toggleMethod(method)}
                      className={cn(
                        'rounded-xl border px-4 py-3 text-sm font-semibold transition-colors',
                        active
                          ? 'border-gold-500/60 bg-gold-500/10 text-gold-300'
                          : 'border-night-700 bg-night-900 text-night-400 hover:border-night-500',
                      )}
                    >
                      {PAYMENT_METHOD_LABELS[method]}
                    </button>
                  )
                })}
              </div>
            </Field>
            <div className="space-y-4">
              <Field label="Minimum amount (₦)" hint="Reject way-below-expected transfers.">
                <input
                  type="number"
                  min={0}
                  value={settings.minAmount}
                  onChange={(event) => update('minAmount', Number(event.target.value))}
                  className="field"
                />
              </Field>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-night-800 bg-night-900/60 px-4 py-3">
                <span className="text-sm font-semibold text-night-200">
                  Require full prepayment
                  <span className="block text-xs font-normal text-night-500">
                    Block bookings unless fully paid.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.fullPaymentRequired}
                  onChange={(event) => update('fullPaymentRequired', event.target.checked)}
                  className="h-5 w-5 accent-gold-500"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-night-800 bg-night-900/60 px-4 py-3">
                <span className="text-sm font-semibold text-night-200">
                  Require a receipt upload
                  <span className="block text-xs font-normal text-night-500">
                    Mandatory receipt image to submit payment.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.receiptRequired}
                  onChange={(event) => update('receiptRequired', event.target.checked)}
                  className="h-5 w-5 accent-gold-500"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="card-lux p-6">
          <h2 className="mb-4 font-display text-lg text-night-50">Payment Instructions</h2>
          <Field
            label="Instructions"
            hint="Shown to customers on the payment page before the account details."
          >
            <textarea
              rows={4}
              value={settings.paymentInstructions ?? ''}
              onChange={(event) => update('paymentInstructions', event.target.value)}
              className="field resize-none"
              placeholder="1. Transfer the exact amount to either account.&#10;2. Capture a clear screenshot of the transfer confirmation.&#10;3. Upload it below to complete your booking."
            />
          </Field>
        </section>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" size="md" onClick={() => void load()}>
            Discard
          </Button>
          <Button variant="gold" size="md" loading={saving} disabled={!canSave} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  )
}