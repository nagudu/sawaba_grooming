import { useState } from 'react'
import { Clock, Download, FileText, Printer, Search, ShieldCheck, XCircle } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import { Button, ButtonLink } from '../components/ui/Button'
import { useToast } from '../components/ui/ToastNotification'
import { formatDate, formatPrice } from '../utils/format'
import { PAYMENT_METHOD_LABELS } from '../utils/payment'
import { trackPayment } from '../api/payments'
import { downloadReceiptPdf } from '../utils/receiptPdf'
import { cn } from '../utils/cn'
import type { PublicPaymentBundle } from '../api/payments'

type HistoryStatus = 'UNPAID' | 'PENDING_VERIFICATION' | 'PAID' | 'REJECTED'

function statusTone(status: HistoryStatus): string {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-500/15 text-emerald-400'
    case 'PENDING_VERIFICATION':
      return 'bg-gold-500/15 text-gold-400'
    case 'REJECTED':
      return 'bg-rose-500/15 text-rose-400'
    default:
      return 'bg-night-700 text-night-300'
  }
}

function friendlyStatus(status: HistoryStatus): string {
  switch (status) {
    case 'UNPAID':
      return 'Payment Required'
    case 'PENDING_VERIFICATION':
      return 'Under Review'
    case 'PAID':
      return 'Verified'
    case 'REJECTED':
      return 'Rejected'
  }
}

export default function PaymentHistoryPage() {
  const { showToast } = useToast()
  const [appointmentId, setAppointmentId] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [bundle, setBundle] = useState<PublicPaymentBundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    const id = appointmentId.trim()
    const tel = phone.trim()
    if (id.length < 2 || tel.length < 7) {
      setError('Enter your appointment ID and the phone number you booked with.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await trackPayment({ appointmentId: id, phone: tel })
      setBundle(data)
      setSearched(true)
    } catch (err) {
      setBundle(null)
      setError(err instanceof Error ? err.message : 'No payment found for those details.')
    } finally {
      setLoading(false)
    }
  }

  const payment = bundle?.payment ?? null
  const appointment = payment?.appointment ?? null
  const canViewReceipt = payment?.status === 'PAID'

  return (
    <PageTransition>
      <PageHero
        eyebrow="My Payments"
        crumb="Payment History"
        title="Your Payment History"
        description="Look up your payments and receipts using your appointment ID and phone number."
        image="/images/pagehero.jpg"
      />

      <section className="bg-night-950 py-16 md:py-20">
        <div className="container-app max-w-3xl">
          {/* Lookup form */}
          <div className="card-lux p-6">
            <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
              <Search className="h-5 w-5 text-gold-500" />
              Find Your Payments
            </h2>
            <p className="mt-1 text-sm text-night-400">
              Enter the appointment ID from your booking confirmation (e.g. APT-20260915-001) and
              the phone number you booked with.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                  Appointment ID
                </span>
                <input
                  type="text"
                  value={appointmentId}
                  onChange={(event) => setAppointmentId(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSearch()
                  }}
                  className="field"
                  placeholder="APT-20260915-001"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                  Phone number
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSearch()
                  }}
                  className="field"
                  placeholder="08012345678"
                />
              </label>
              <div className="flex items-end">
                <Button
                  variant="gold"
                  size="md"
                  loading={loading}
                  onClick={() => void handleSearch()}
                  className="w-full sm:w-auto"
                >
                  Search
                </Button>
              </div>
            </div>
            {error && (
              <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            )}
          </div>

          {/* Result */}
          {searched && payment && (
            <div className="mt-6 space-y-4">
              <div className="card-lux p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-gold-400">
                      #{appointment?.referenceCode ?? payment.appointmentId}
                    </p>
                    <p className="mt-1 font-display text-lg text-night-50">
                      {appointment?.service?.name ?? 'Service'}
                    </p>
                    {appointment && (
                      <p className="mt-0.5 text-sm text-night-400">
                        {formatDate(appointment.appointmentDate)} · {appointment.appointmentTime} ·{' '}
                        {appointment.customerName}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest',
                      statusTone(payment.status as HistoryStatus),
                    )}
                  >
                    {friendlyStatus(payment.status as HistoryStatus)}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-night-800 bg-night-900/50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                      Amount
                    </p>
                    <p className="mt-1 font-display text-xl font-bold text-gold-300">
                      {formatPrice(payment.amount)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-night-800 bg-night-900/50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                      Method
                    </p>
                    <p className="mt-1 text-sm font-semibold text-night-100">
                      {payment.paymentMethod ? PAYMENT_METHOD_LABELS[payment.paymentMethod] : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-night-800 bg-night-900/50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                      Paid on
                    </p>
                    <p className="mt-1 text-sm font-semibold text-night-100">
                      {payment.paymentDate ? formatDate(payment.paymentDate) : '—'}
                    </p>
                  </div>
                </div>

                {payment.status === 'REJECTED' && payment.rejectionReason && (
                  <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    <span className="font-semibold">Reason: </span>
                    {payment.rejectionReason}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  {canViewReceipt ? (
                    <>
                      <ButtonLink to={`/receipt/${payment.accessToken}`} variant="gold" size="md">
                        <FileText className="h-4 w-4" />
                        View Receipt
                      </ButtonLink>
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => {
                          try {
                            downloadReceiptPdf(payment, bundle!.settings)
                            showToast('Receipt downloaded.', 'success')
                          } catch {
                            showToast('Could not generate the PDF.', 'error')
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Download Receipt
                      </Button>
                      <ButtonLink to={`/receipt/${payment.accessToken}`} variant="outline" size="md">
                        <Printer className="h-4 w-4" />
                        Print Receipt
                      </ButtonLink>
                    </>
                  ) : (
                    <>
                      <ButtonLink to={`/pay/${payment.accessToken}`} variant="gold" size="md">
                        {payment.status === 'REJECTED'
                          ? 'Resubmit Payment'
                          : payment.status === 'UNPAID'
                            ? 'Complete Payment'
                            : 'View Status'}
                      </ButtonLink>
                      <span className="inline-flex items-center gap-2 px-2 text-xs text-night-500">
                        {payment.status === 'PENDING_VERIFICATION' ? (
                          <>
                            <Clock className="h-3.5 w-3.5" />
                            Official receipt unlocks after verification
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Official receipt is available once payment is verified
                          </>
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {searched && !payment && !error && (
            <div className="mt-6 rounded-2xl border border-night-700 bg-night-900/40 p-8 text-center">
              <XCircle className="mx-auto h-8 w-8 text-night-500" />
              <p className="mt-3 text-sm text-night-400">No payment found for those details.</p>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-night-500">
            Booked on this device? Your booking confirmation links directly to the payment page.
          </p>
        </div>
      </section>
    </PageTransition>
  )
}
