import { useState } from 'react'
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  LoaderCircle,
  QrCode,
  Scissors,
  Search,
  User,
  Wallet,
  XCircle,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import { Button, ButtonLink } from '../components/ui/Button'
import BookingQrPanel from '../components/qr/BookingQrPanel'
import { fetchBookingQr, type PublicBookingQr } from '../api/booking'
import { formatDate, formatPrice, formatTime } from '../utils/format'
import { cn } from '../utils/cn'

/**
 * Public "find my booking" page. No account required — a customer enters the
 * booking reference (or id) and the phone they booked with, and gets their
 * check-in QR back. The QR is shown regardless of payment state; its validity at
 * the door is decided by the scanner (verified payment required).
 */
export default function MyBookingPage() {
  const [reference, setReference] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PublicBookingQr | null>(null)

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault()
    if (reference.trim().length < 3 || phone.trim().length < 7) {
      setError('Enter both your booking reference and the phone number you booked with.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBookingQr({ reference: reference.trim(), phone: phone.trim() })
      setResult(data)
    } catch (err) {
      setResult(null)
      const message = err instanceof Error ? err.message : 'No matching booking found.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const isPaid = result?.paymentStatus === 'PAID'
  const ref = result?.referenceCode ?? (result ? `APT-${String(result.appointmentId).padStart(4, '0')}` : '')

  return (
    <PageTransition>
      <PageHero
        eyebrow="Check-in"
        crumb="Find My Booking"
        title="Find My Booking"
        description="Reopen your check-in QR using your booking reference and the phone number you booked with. No account needed."
        image="/images/pagehero.jpg"
      />

      <section className="bg-night-950 py-16 md:py-20">
        <div className="container-app max-w-2xl">
          <form onSubmit={handleLookup} className="card-lux p-6 md:p-8">
            <h2 className="flex items-center gap-2 font-display text-lg text-night-50">
              <Search className="h-5 w-5 text-gold-500" />
              Look Up Your Booking
            </h2>
            <p className="mt-1 text-sm text-night-400">
              Enter the booking reference from your confirmation (e.g. APT-20260101-001) or your
              appointment ID, plus the phone number you booked with.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                  Booking reference or ID
                </span>
                <input
                  type="text"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className="field"
                  placeholder="e.g. APT-20260101-001"
                  autoComplete="off"
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
                  className="field"
                  placeholder="e.g. 08012345678"
                  autoComplete="tel"
                />
              </label>
            </div>

            {error && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="mt-6">
              <Button type="submit" variant="gold" size="lg" loading={loading} className="w-full sm:w-auto">
                {loading ? 'Searching…' : 'Find My Booking'}
              </Button>
            </div>
          </form>

          {loading && !result && (
            <div className="mt-8 flex flex-col items-center gap-4 py-10 text-night-400">
              <LoaderCircle className="h-8 w-8 animate-spin text-gold-500" />
              <p className="text-sm">Looking up your booking…</p>
            </div>
          )}

          {result && (
            <div className="mt-8 space-y-6">
              {/* Status banner */}
              <div
                className={cn(
                  'flex items-start gap-3 rounded-2xl border px-5 py-4',
                  isPaid
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-gold-500/30 bg-gold-500/[0.06]',
                )}
              >
                {isPaid ? (
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
                )}
                <div>
                  <p className={cn('font-semibold', isPaid ? 'text-emerald-300' : 'text-gold-300')}>
                    {isPaid ? 'Payment verified' : 'Payment not verified yet'}
                  </p>
                  <p className="mt-0.5 text-sm text-night-400">
                    {isPaid
                      ? 'Your booking is confirmed and your QR is ready for check-in.'
                      : 'Your QR is ready, but it cannot be used for check-in until your payment is verified. It is not proof of payment.'}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="card-lux p-6">
                <h3 className="mb-4 font-display text-lg text-night-50">Booking Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Detail icon={User} label="Name" value={result.customerName} />
                  {result.serviceName && (
                    <Detail icon={Scissors} label="Service" value={result.serviceName} />
                  )}
                  {result.barberName && (
                    <Detail icon={User} label="Barber" value={result.barberName} />
                  )}
                  <Detail
                    icon={CalendarDays}
                    label="Date"
                    value={formatDate(result.appointmentDate)}
                  />
                  <Detail
                    icon={Clock}
                    label="Time"
                    value={formatTime(result.appointmentTime)}
                  />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                      Booking Reference
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-bold tracking-wide text-gold-400">
                      #{ref}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                      Amount
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-gold-400">
                      {formatPrice(result.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* QR */}
              <div className="card-lux p-6">
                <h3 className="mb-4 flex items-center gap-2 font-display text-lg text-night-50">
                  <QrCode className="h-5 w-5 text-gold-500" />
                  Your Check-in QR Code
                </h3>
                <BookingQrPanel
                  qrPayload={result.qrPayload}
                  reference={ref}
                  paymentStatus={result.paymentStatus}
                  checkedInAt={result.checkedInAt}
                  serviceName={result.serviceName}
                  barberName={result.barberName}
                  appointmentDate={result.appointmentDate}
                  appointmentTime={result.appointmentTime}
                  bordered={false}
                />
              </div>

              {!isPaid && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink to="/payments" variant="gold" size="md">
                    <Wallet className="h-4 w-4" />
                    Go to Payments
                  </ButtonLink>
                  <ButtonLink to="/book" variant="outline" size="md">
                    Book Another Visit
                  </ButtonLink>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </PageTransition>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-night-800 text-night-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-semibold break-words text-night-100">{value}</p>
      </div>
    </div>
  )
}
