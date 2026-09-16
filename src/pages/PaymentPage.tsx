import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  Globe,
  Hash,
  Landmark,
  LoaderCircle,
  RefreshCw,
  Scissors,
  Search,
  ShieldCheck,
  User,
  Wallet,
  XCircle,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import { Button, ButtonLink } from '../components/ui/Button'
import SmartImage from '../components/ui/SmartImage'
import { useToast } from '../components/ui/ToastNotification'
import ReceiptUploadCard from '../components/payment/ReceiptUploadCard'
import { cn } from '../utils/cn'
import { formatDate, formatPrice, formatTime } from '../utils/format'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../utils/payment'
import {
  declareCashPayment,
  fetchPayment,
  initializePaystack,
  submitPaymentWithProgress,
  trackPayment,
} from '../api/payments'
import type { PaymentItem, PaymentSettings, PublicPaymentBundle } from '../api/payments'
import type { PaymentMethod } from '../api'

const METHOD_ORDER: PaymentMethod[] = ['ONLINE', 'OPAY', 'BANK_TRANSFER', 'CASH', 'OTHER']

export default function PaymentPage() {
  const { token } = useParams<{ token: string }>()
  const { showToast } = useToast()

  const [bundle, setBundle] = useState<PublicPaymentBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  const [amountPaid, setAmountPaid] = useState('')
  const [ref, setRef] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const summaryRef = useRef<HTMLDivElement>(null)

  const [payingOnline, setPayingOnline] = useState(false)
  const [trackOpen, setTrackOpen] = useState(false)
  const [trackId, setTrackId] = useState('')
  const [trackPhone, setTrackPhone] = useState('')
  const [tracking, setTracking] = useState(false)

  async function load() {
    if (!token) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchPayment(token)
      setBundle(data)
      setAmountPaid(String(data.payment.amount ?? 0))
      const firstEnabled = data.settings.enabledPaymentMethods?.[0]
      if (firstEnabled) setMethod(firstEnabled)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Payment not found.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const payment: PaymentItem | null = bundle?.payment ?? null
  const settings: PaymentSettings | null = bundle?.settings ?? null
  const appointment = payment?.appointment ?? null
  const expected = payment?.appointment?.totalAmount ?? payment?.amount ?? 0
  const enabledMethods = METHOD_ORDER.filter((m) =>
    m === 'ONLINE'
      ? Boolean(settings?.onlinePaymentEnabled)
      : settings?.enabledPaymentMethods?.length
        ? settings.enabledPaymentMethods.includes(m)
        : ['OPAY', 'BANK_TRANSFER', 'CASH'].includes(m),
  )
  const reference = appointment?.referenceCode ?? `APT-${String(payment?.appointmentId ?? 0).padStart(4, '0')}`
  const isManualTransfer = method === 'OPAY' || method === 'BANK_TRANSFER'
  /** Receipt-based methods only — cash never asks for an upload, online verifies with Paystack. */
  const needsReceipt = method === 'OPAY' || method === 'BANK_TRANSFER' || method === 'OTHER'

  const [declaringCash, setDeclaringCash] = useState(false)

  async function handleDeclareCash() {
    if (!token || declaringCash) return
    setDeclaringCash(true)
    try {
      const data = await declareCashPayment(token)
      setBundle(data)
      showToast('Cash payment selected — see you at the salon!', 'success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not record cash selection.', 'error')
    } finally {
      setDeclaringCash(false)
    }
  }

  async function handleSubmit() {
    if (!token || !payment || submitting) return
    const parsed = Number(amountPaid)
    if (settings?.receiptRequired !== false && !receiptFile) {
      setUploadError('Please upload your payment receipt before submitting.')
      summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast('Enter a valid amount you paid.', 'error')
      return
    }
    if (parsed < (settings?.minAmount ?? 0)) {
      showToast(`Amount must be at least ${formatPrice(settings?.minAmount ?? 0)}.`, 'error')
      return
    }
    if (!paymentDate) {
      showToast('Provide the date you made the payment.', 'error')
      return
    }
    setSubmitting(true)
    setProgress(0)
    try {
      await submitPaymentWithProgress(
        token,
        {
          paymentMethod: method,
          amountPaid: parsed,
          transactionReference: ref.trim(),
          paymentDate,
          note: note.trim() || null,
        },
        receiptFile,
        setProgress,
      )
      setReceiptFile(null)
      setRef('')
      setNote('')
      setUploadError(null)
      showToast('Receipt submitted. Your payment is now under review.', 'success')
      await load()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not submit receipt.', 'error')
    } finally {
      setSubmitting(false)
      setProgress(0)
    }
  }

  async function handlePayOnline() {
    if (!token || !payment || payingOnline) return
    setPayingOnline(true)
    try {
      const init = await initializePaystack(token)
      // Full redirect to Paystack's hosted checkout; the customer returns to
      // /payments/callback, which re-verifies server-side before confirming.
      window.location.assign(init.authorizationUrl)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start online payment.', 'error')
      setPayingOnline(false)
    }
  }

  async function handleTrack() {
    const appointmentId = trackId.trim()
    if (appointmentId.length < 2 || trackPhone.trim().length < 7) {
      showToast('Enter both your appointment ID and phone number.', 'error')
      return
    }
    setTracking(true)
    try {
      const data = await trackPayment({ appointmentId, phone: trackPhone.trim() })
      setBundle(data)
      setAmountPaid(String(data.payment.amount))
      setTrackOpen(false)
      setLoadError(null)
      showToast('Found your payment details.', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No matching payment found.', 'error')
    } finally {
      setTracking(false)
    }
  }

  function renderSummaryCard() {
    if (!payment) return null
    return (
      <div ref={summaryRef} className="card-lux p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
            <FileText className="h-5 w-5 text-gold-500" />
            Payment Summary
          </h2>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest',
              payment.status === 'PAID' && 'bg-emerald-500/15 text-emerald-400',
              payment.status === 'PENDING_VERIFICATION' && 'bg-gold-500/15 text-gold-400',
              payment.status === 'REJECTED' && 'bg-rose-500/15 text-rose-400',
              payment.status === 'CANCELLED' && 'bg-night-700 text-night-400',
              (payment.status === 'UNPAID' || payment.status === 'REFUNDED') && 'bg-night-700 text-night-300',
            )}
          >
            {PAYMENT_STATUS_LABELS[payment.status]}
          </span>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
              <Hash className="h-3 w-3" /> Appointment ID
            </dt>
            <dd className="mt-1 font-mono text-sm font-bold tracking-wide text-gold-400">
              #{reference}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
              <User className="h-3 w-3" /> Customer
            </dt>
            <dd className="mt-1 text-sm font-semibold text-night-100">
              {appointment?.customerName ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
              <Scissors className="h-3 w-3" /> Service
            </dt>
            <dd className="mt-1 text-sm font-semibold text-night-100">
              {appointment?.service
                ? `${appointment.service.name} · ${appointment.service.duration} min`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
              <CalendarDays className="h-3 w-3" /> Date &amp; Time
            </dt>
            <dd className="mt-1 text-sm font-semibold text-night-100">
              {appointment ? `${formatDate(appointment.appointmentDate)} · ${formatTime(appointment.appointmentTime)}` : '—'}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-400">
              Amount Due
            </p>
            <p className="font-display text-3xl font-bold text-gold-400">{formatPrice(expected)}</p>
          </div>
          <p className="text-xs text-night-400">
            {settings?.fullPaymentRequired === false
              ? `Minimum payment: ${formatPrice(settings?.minAmount ?? 0)}`
              : 'Pay the full amount shown above'}
          </p>
        </div>
      </div>
    )
  }

  function renderPaymentForm() {
    return (
      <div className="mt-8 border-t border-night-800 pt-7">
        {/* Step 1-2: choose method + transfer */}
        <h3 className="flex items-center gap-2 font-display text-lg text-night-50">
          <Wallet className="h-5 w-5 text-gold-500" />
          Choose Payment Method
        </h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {enabledMethods.map((m) => (
            <button
              key={m}
              type="button"
              disabled={submitting}
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={cn(
                'flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed',
                method === m
                  ? 'border-gold-500 bg-gold-500/10'
                  : 'border-night-700 bg-night-900/50 hover:border-gold-500/50',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  method === m ? 'bg-gold-500/20 text-gold-400' : 'bg-night-800 text-night-400',
                )}
              >
                {m === 'BANK_TRANSFER' && <Landmark className="h-5 w-5" />}
                {m === 'OPAY' && <CreditCard className="h-5 w-5" />}
                {m === 'ONLINE' && <Globe className="h-5 w-5" />}
                {m === 'CASH' && <Banknote className="h-5 w-5" />}
                {m === 'OTHER' && <Wallet className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-night-100">
                  {PAYMENT_METHOD_LABELS[m]}
                </span>
                <span className="block text-[11px] text-night-500">
                  {m === 'BANK_TRANSFER' && 'Transfer to our bank account'}
                  {m === 'OPAY' && 'Transfer via OPay'}
                  {m === 'ONLINE' && 'Card, bank & USSD via Paystack'}
                  {m === 'CASH' && 'Pay at the salon'}
                  {m === 'OTHER' && 'Another supported method'}
                </span>
              </span>
            </button>
          ))}
        </div>

        {method === 'ONLINE' && (
          <div className="mt-6 rounded-2xl border border-night-700 bg-night-900/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-base text-night-50">Pay Online with Paystack</p>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Secure checkout
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gold-500/25 bg-gold-500/[0.05] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                  Amount
                </p>
                <p className="mt-1 font-display text-xl font-bold text-gold-400">
                  {formatPrice(expected)}
                </p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                  Reference
                </p>
                <p className="mt-1 font-mono text-sm font-bold tracking-wide text-night-100">
                  {reference}
                </p>
              </div>
              <div className="rounded-xl border border-night-700 bg-night-950/60 p-5 text-sm leading-relaxed text-night-300">
                Cards, bank transfer, USSD and mobile money are supported. You will be redirected
                to Paystack's secure checkout page to complete the payment, then brought back here
                for automatic confirmation.
              </div>
            </div>
            <Button
              variant="gold"
              size="lg"
              loading={payingOnline}
              onClick={() => void handlePayOnline()}
              className="mt-5 w-full sm:w-auto"
            >
              <Globe className="h-4 w-4" />
              {payingOnline ? 'Opening Paystack…' : `Pay ${formatPrice(expected)} Online`}
            </Button>
            <p className="mt-3 text-xs text-night-500">
              Your payment is confirmed automatically once Paystack verifies the transaction — no
              receipt upload needed.
            </p>
          </div>
        )}

        {/* Transfer instructions with account details */}
        {isManualTransfer && (
          <div className="mt-6 rounded-2xl border border-night-700 bg-night-900/50 p-5">
            <p className="font-display text-base text-night-50">
              {method === 'OPAY' ? 'Pay by OPay Transfer' : 'Pay by Bank Transfer'}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {method === 'BANK_TRANSFER' && settings?.bankName && (
                <AccountCard
                  icon={<Landmark className="h-5 w-5" />}
                  bank={settings.bankName}
                  accountName={settings.accountName}
                  accountNumber={settings.accountNumber}
                />
              )}
              {method === 'OPAY' && settings?.opayAccountName && (
                <AccountCard
                  icon={<CreditCard className="h-5 w-5" />}
                  bank="OPay"
                  accountName={settings.opayAccountName}
                  accountNumber={settings.opayAccountNumber}
                />
              )}
              <div className="rounded-xl border border-gold-500/25 bg-gold-500/[0.05] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                  Amount
                </p>
                <p className="mt-1 font-display text-xl font-bold text-gold-400">
                  {formatPrice(expected)}
                </p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                  Reference
                </p>
                <p className="mt-1 font-mono text-sm font-bold tracking-wide text-night-100">
                  {reference}
                </p>
              </div>
            </div>

            <ol className="mt-5 space-y-2.5">
              {[
                `Transfer exactly ${formatPrice(expected)} to the account above. Use "${reference}" as the transfer reference/narration.`,
                'Take a screenshot or photo of your successful payment receipt.',
                'Upload the receipt in the upload area below.',
                'Click "Submit Payment".',
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm text-night-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-xs font-bold text-gold-400">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            {settings?.paymentInstructions && (
              <p className="mt-4 rounded-xl border border-night-700 bg-night-950/60 px-4 py-3 text-xs leading-relaxed text-night-400">
                {settings.paymentInstructions}
              </p>
            )}
          </div>
        )}

        {/* Cash: pay at the salon — no receipt, admin confirms in person */}
        {method === 'CASH' && (
          <div className="mt-6 rounded-2xl border border-night-700 bg-night-900/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-display text-base text-night-50">
                <Banknote className="h-5 w-5 text-gold-500" />
                Pay at the Salon
              </p>
              <span className="flex items-center gap-1.5 rounded-full bg-gold-500/10 px-3 py-1 text-[11px] font-semibold text-gold-400">
                No receipt needed
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-night-300">
              You have selected <span className="font-semibold text-night-100">Cash Payment</span>.
              Please pay <span className="font-bold text-gold-400">{formatPrice(expected)}</span> at
              SAWABA GROOMING SALON before your appointment can be confirmed.
            </p>
            <ul className="mt-4 space-y-2.5">
              {[
                'Bring the exact amount — cash only.',
                'Our team confirms your payment in person at the front desk.',
                'Your appointment is confirmed the moment we receive the cash.',
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm text-night-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-xs font-bold text-gold-400">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="gold"
              size="lg"
              loading={declaringCash}
              onClick={() => void handleDeclareCash()}
              className="mt-5 w-full sm:w-auto"
            >
              <Banknote className="h-4 w-4" />
              {declaringCash ? 'Recording…' : 'I Will Pay Cash at the Salon'}
            </Button>
            <p className="mt-3 text-xs text-night-500">
              Booking reference: <span className="font-mono font-bold text-night-300">{reference}</span>
            </p>
          </div>
        )}

        {/* Step 3: upload receipt (receipt-based methods only) */}
        {needsReceipt && (
        <div className="mt-8">
          <h3 className="flex items-center gap-2 font-display text-lg text-night-50">
            <FileText className="h-5 w-5 text-gold-500" />
            Upload Payment Receipt
            {settings?.receiptRequired === false && (
              <span className="text-xs font-normal text-night-500">(optional)</span>
            )}
          </h3>
          <p className="mt-1 text-sm text-night-400">
            Take a photo or choose a screenshot of your payment receipt
          </p>
          <div className="mt-4">
            <ReceiptUploadCard
              file={receiptFile}
              onChange={(file) => {
                setReceiptFile(file)
                setUploadError(null)
              }}
              onError={setUploadError}
              disabled={submitting}
            />
          </div>
          {uploadError && (
            <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {uploadError}
            </p>
          )}
        </div>

        )}

        {needsReceipt && (
        <>
        <details className="mt-6 rounded-xl border border-night-800 bg-night-900/40 px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-night-300">
            Payment details <span className="font-normal text-night-500">(date, amount, reference — optional)</span>
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                Date you paid
              </span>
              <input
                type="date"
                value={paymentDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                Amount paid (₦)
              </span>
              <input
                type="number"
                min={0}
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                Transaction reference
              </span>
              <input
                type="text"
                value={ref}
                onChange={(event) => setRef(event.target.value)}
                className="field"
                placeholder="e.g. bank transfer reference"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                Note
              </span>
              <textarea
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="field resize-none"
                placeholder="Anything our team should know?"
              />
            </label>
          </div>
        </details>

        {/* Step 4: submit */}
        <div className="mt-7">
          {submitting && (
            <div className="mb-4">
              <div className="h-2 overflow-hidden rounded-full bg-night-800">
                <div
                  className="h-full rounded-full bg-gold-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 flex items-center gap-2 text-xs text-night-400">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-gold-500" />
                Uploading receipt… {progress}%
              </p>
            </div>
          )}
          <Button
            variant="gold"
            size="lg"
            loading={submitting}
            onClick={() => void handleSubmit()}
            className="w-full sm:w-auto"
          >
            {submitting ? 'Submitting Payment…' : 'Submit Payment'}
          </Button>
          <p className="mt-3 text-xs text-night-500">
            Our team verifies your receipt and confirms your appointment. You will see the
            status update on this page.
          </p>
        </div>
        </>
        )}
      </div>
    )
  }

  function renderStatusPanel() {
    if (!payment) return null

    if (payment.status === 'PAID') {
      return (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 md:p-8">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <BadgeCheck className="h-7 w-7" />
            </span>
            <div>
              <h2 className="font-display text-2xl text-night-50">Payment Verified</h2>
              <p className="mt-1 text-sm text-night-400">
                Your payment has been confirmed. Your appointment is booked and ready for service.
              </p>
            </div>
          </div>

          {/* Appointment confirmation card */}
          {appointment && (
            <div className="mt-6 grid gap-3 rounded-xl border border-emerald-500/20 bg-night-950/60 p-5 sm:grid-cols-2">
              {appointment.service && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Service</p>
                  <p className="mt-0.5 text-sm font-semibold text-night-100">
                    {appointment.service.name}
                    <span className="ml-2 text-night-400">· {appointment.service.duration} min</span>
                  </p>
                </div>
              )}
              {appointment.barber && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Barber</p>
                  <p className="mt-0.5 text-sm font-semibold text-night-100">{appointment.barber.name}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Date</p>
                <p className="mt-0.5 text-sm font-semibold text-night-100">
                  {formatDate(appointment.appointmentDate)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Time</p>
                <p className="mt-0.5 text-sm font-semibold text-night-100">
                  {formatTime(appointment.appointmentTime)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Amount Paid</p>
                <p className="mt-0.5 text-sm font-bold text-emerald-400">{formatPrice(payment.amount)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Booking Ref</p>
                <p className="mt-0.5 font-mono text-sm font-bold tracking-wide text-gold-400">
                  #{appointment.referenceCode ?? appointment.id}
                </p>
              </div>
            </div>
          )}

          {payment.receiptUrl && (
            <div className="mt-6 max-w-xs overflow-hidden rounded-xl border border-night-700">
              <SmartImage src={payment.receiptUrl} alt="Payment receipt" className="aspect-[4/3] w-full object-cover" />
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to={`/receipt/${token}`} variant="gold" size="md">
              <FileText className="h-4 w-4" />
              View Official Receipt
            </ButtonLink>
            <ButtonLink to="/book" variant="outline" size="md">
              Book Another Visit
            </ButtonLink>
          </div>
        </div>
      )
    }

    if (payment.status === 'CANCELLED') {
      return (
        <StatusCard
          icon={<XCircle className="h-7 w-7" />}
          tone="rose"
          title="Payment Cancelled"
          subtitle="This appointment was cancelled, so its payment is no longer active. Book a new appointment to continue."
        />
      )
    }

    if (payment.status === 'PENDING_VERIFICATION') {
      const cash = payment.paymentMethod === 'CASH'
      return (
        <div className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-6 md:p-8">
          <StatusHeader icon={<Clock className="h-7 w-7" />} title={cash ? 'Cash Payment Selected' : 'Payment Under Review'} />
          <p className="mt-3 text-sm text-night-400">
            {cash
              ? 'Please pay at the salon before your appointment is confirmed. Our team will mark this payment as received when you arrive — no receipt needed.'
              : 'We received your payment receipt and our team will verify it shortly. This usually takes a few minutes during working hours.'}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailRow label="Appointment ID" value={`#${reference}`} />
            <DetailRow label="Amount" value={formatPrice(payment.amount)} />
            <DetailRow
              label="Method"
              value={payment.paymentMethod ? PAYMENT_METHOD_LABELS[payment.paymentMethod] : '—'}
            />
            {payment.transactionReference && (
              <DetailRow label="Reference" value={payment.transactionReference} />
            )}
            {payment.paymentDate && <DetailRow label="Paid on" value={formatDate(payment.paymentDate)} />}
          </div>

          {payment.receiptUrl && (
            <div className="mt-6 max-w-xs overflow-hidden rounded-xl border border-night-700">
              <SmartImage src={payment.receiptUrl} alt="Uploaded receipt" className="aspect-[4/3] w-full object-cover" />
            </div>
          )}

          <p className="mt-6 flex items-center gap-2 text-xs text-night-500">
            <Clock className="h-3.5 w-3.5" />
            Saved your link? Use “Track payment” below to re-open this page anytime.
          </p>
        </div>
      )
    }

    if (payment.status === 'REJECTED') {
      return (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 md:p-8">
          <StatusHeader icon={<XCircle className="h-7 w-7" />} title="Payment Rejected" />
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="font-semibold">Reason: </span>
            {payment.rejectionReason ?? 'The receipt could not be verified.'}
          </p>
          <p className="mt-4 text-sm text-night-400">
            Please review the reason and submit a new receipt below. Any previously uploaded
            receipt has been replaced.
          </p>
          {renderPaymentForm()}
        </div>
      )
    }

    // UNPAID / REFUNDED: the main payment flow — unless cash was already
    // declared, in which case show the "Pay at the Salon" confirmation state.
    if (payment.paymentMethod === 'CASH') {
      return (
        <div className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-6 md:p-8">
          <StatusHeader icon={<Banknote className="h-7 w-7" />} title="Cash Payment Selected" />
          <p className="mt-3 text-sm leading-relaxed text-night-400">
            Please pay{' '}
            <span className="font-bold text-gold-400">{formatPrice(payment.amount)}</span> at
            SAWABA GROOMING SALON before your appointment is confirmed. No receipt needed — our
            team marks this payment as received the moment you pay in person.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <DetailRow label="Booking Reference" value={`#${reference}`} />
            <DetailRow label="Amount Due" value={formatPrice(payment.amount)} />
            <DetailRow label="Payment Method" value={PAYMENT_METHOD_LABELS.CASH} />
            <DetailRow label="Payment Status" value="Unpaid — pay at the salon" />
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-night-500">
            <Clock className="h-3.5 w-3.5" />
            Bring your booking reference along. Saved this link? Use “Track payment” below to
            re-open it anytime.
          </p>
        </div>
      )
    }
    return (
      <div className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-6 md:p-8">
        <StatusHeader icon={<Banknote className="h-7 w-7" />} title="Payment Required" />
        <p className="mt-3 text-sm text-night-400">
          Please complete payment for your appointment using any of the methods below.
        </p>
        {renderPaymentForm()}
      </div>
    )
  }

  return (
    <PageTransition>
      <PageHero
        eyebrow="Secure Payment"
        crumb="Payment"
        title="Pay for Your Appointment"
        description="Complete your appointment payment securely and receive confirmation once verified."
        imageId="1563013544-824ae1b704d3"
      />

      <section className="bg-night-950 py-24 md:py-32">
        <div className="container-app max-w-3xl">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-20 text-night-400">
              <LoaderCircle className="h-8 w-8 animate-spin text-gold-500" />
              <p className="text-sm">Loading payment details…</p>
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
              <XCircle className="mx-auto h-10 w-10 text-rose-400" />
              <h2 className="mt-4 font-display text-xl text-night-50">Payment Not Found</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-night-400">{loadError}</p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setTrackOpen((open) => !open)}
                >
                  <Search className="h-4 w-4" />
                  Track Payment
                </Button>
                <ButtonLink to="/book" variant="gold" size="md">
                  Book Appointment
                </ButtonLink>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {renderSummaryCard()}
              {renderStatusPanel()}

              {!trackOpen && (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setTrackOpen(true)}
                    className="flex items-center gap-2 text-sm text-gold-400 hover:text-gold-300"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh payment status
                  </button>
                  <p className="text-xs text-night-500">Saved your booking? Track it below.</p>
                </div>
              )}

              {trackOpen && (
                <div className="rounded-2xl border border-night-700 bg-night-900/40 p-6">
                  <h3 className="flex items-center gap-2 font-display text-lg text-night-50">
                    <Search className="h-5 w-5 text-gold-500" />
                    Track Your Payment
                  </h3>
                  <p className="mt-1 text-sm text-night-400">
                    Enter the appointment ID and the phone number you booked with.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                        Appointment ID
                      </span>
                      <input
                        type="text"
                        value={trackId}
                        onChange={(event) => setTrackId(event.target.value)}
                        className="field"
                        placeholder="e.g. APT-20260915-001"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                        Phone number
                      </span>
                      <input
                        type="tel"
                        value={trackPhone}
                        onChange={(event) => setTrackPhone(event.target.value)}
                        className="field"
                        placeholder="e.g. 08012345678"
                      />
                    </label>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <Button variant="gold" size="md" loading={tracking} onClick={() => void handleTrack()}>
                      Track Payment
                    </Button>
                    <Button variant="ghost" size="md" onClick={() => setTrackOpen(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </PageTransition>
  )
}

function StatusHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-400">
        {icon}
      </span>
      <h2 className="font-display text-2xl text-night-50">{title}</h2>
    </div>
  )
}

function StatusCard({
  icon,
  title,
  subtitle,
  tone = 'gold',
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  tone?: 'gold' | 'rose' | 'emerald'
}) {
  const tones = {
    gold: 'border-gold-500/30 bg-gold-500/5 text-gold-400',
    rose: 'border-rose-500/30 bg-rose-500/5 text-rose-400',
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  }
  return (
    <div className={cn('rounded-2xl border p-6 md:p-8', tones[tone])}>
      <StatusHeader icon={icon} title={title} />
      <p className="mt-3 text-sm text-night-400">{subtitle}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-night-800 bg-night-900/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">{label}</p>
      <p className="mt-1 text-sm font-semibold break-words text-night-100">{value}</p>
    </div>
  )
}

function AccountCard({
  icon,
  bank,
  accountName,
  accountNumber,
}: {
  icon: React.ReactNode
  bank: string
  accountName: string | null
  accountNumber: string | null
}) {
  return (
    <div className="rounded-xl border border-night-700 bg-night-900/50 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500/15 text-gold-400">
          {icon}
        </span>
        <p className="font-display text-lg text-night-50">{bank}</p>
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
        Account name
      </p>
      <p className="mt-0.5 text-sm font-semibold text-night-100">{accountName ?? '—'}</p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
        Account number
      </p>
      <p className="mt-0.5 font-mono text-lg font-bold tracking-widest text-gold-400">
        {accountNumber ?? '—'}
      </p>
    </div>
  )
}
