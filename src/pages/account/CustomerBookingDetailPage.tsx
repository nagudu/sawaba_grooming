import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  Hash,
  LoaderCircle,
  Scissors,
  User,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Button, ButtonLink } from '../../components/ui/Button'
import { useToast } from '../../components/ui/ToastNotification'
import { accountApi } from '../../api/account'
import type { AppointmentItem, AppointmentStatus, PaymentStatus } from '../../api'
import { formatDate, formatPrice, formatTime } from '../../utils/format'
import {
  APPOINTMENT_STATUS_LABELS,
  STATUS_BADGE_STYLES,
} from '../../config/appointmentStatuses'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../../utils/payment'
import { cn } from '../../utils/cn'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paymentStatusStyle(status: PaymentStatus): string {
  switch (status) {
    case 'PAID':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    case 'PENDING_VERIFICATION':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    case 'REJECTED':
      return 'border-red-500/40 bg-red-500/10 text-red-300'
    case 'REFUNDED':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-300'
    case 'CANCELLED':
      return 'border-night-600 bg-night-800 text-night-400'
    default:
      return 'border-gold-500/40 bg-gold-500/10 text-gold-300'
  }
}

function canCancel(status: AppointmentStatus): boolean {
  return !['COMPLETED', 'CANCELLED', 'IN_PROGRESS'].includes(status)
}

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailRow({
  icon: Icon,
  label,
  value,
  valueClass,
  mono,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  valueClass?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-night-800 bg-night-900/40 p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-night-800 text-night-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
          {label}
        </p>
        <p
          className={cn(
            'mt-0.5 text-sm font-semibold break-words',
            mono ? 'font-mono tracking-wide' : '',
            valueClass ?? 'text-night-100',
          )}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-night-50">
      {title}
    </h2>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerBookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [appointment, setAppointment] = useState<AppointmentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(async () => {
    if (!id || Number.isNaN(Number(id))) {
      setLoadError('Invalid booking ID.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const data = await accountApi.getAppointment(Number(id))
      setAppointment(data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Booking not found.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCancel() {
    if (!appointment || cancelling) return
    setCancelling(true)
    try {
      await accountApi.cancelAppointment(appointment.id, 'Cancelled by customer')
      showToast('Appointment cancelled.', 'success')
      // Refresh to show updated status
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not cancel.', 'error')
    } finally {
      setCancelling(false)
    }
  }

  // ── Payment-related derived values ──
  const payStatus = appointment?.payment?.status
  // The backend serialises accessToken onto the payment object even though the
  // AppointmentItem type only declares a subset of fields — cast it out.
  const payToken = (
    appointment?.payment as unknown as { accessToken?: string } | null | undefined
  )?.accessToken

  const needsPayment = payStatus === 'UNPAID' || payStatus === 'REJECTED'
  const isPaid = payStatus === 'PAID'

  // Extended payment fields also present at runtime (included by backend)
  type ExtPayment = {
    transactionReference?: string | null
    paymentDate?: string | null
    rejectionReason?: string | null
    verifiedAt?: string | null
    accessToken?: string
    paymentMethod?: 'CASH' | 'OPAY' | 'BANK_TRANSFER' | 'ONLINE' | 'OTHER' | null
  }
  const extPay = (appointment?.payment ?? null) as (NonNullable<typeof appointment>['payment'] & ExtPayment) | null | undefined
  const isCash = extPay?.paymentMethod === 'CASH'

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-night-400">
        <LoaderCircle className="h-8 w-8 animate-spin text-gold-500" />
        <p className="text-sm">Loading booking details…</p>
      </div>
    )
  }

  // ── Error ──
  if (loadError || !appointment) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
        <XCircle className="mx-auto h-10 w-10 text-rose-400" />
        <h2 className="mt-4 font-display text-xl text-night-50">Booking Not Found</h2>
        <p className="mt-2 text-sm text-night-400">
          {loadError ?? 'This booking could not be loaded.'}
        </p>
        <ButtonLink to="/account/bookings" variant="gold" size="md" className="mt-6">
          Back to My Bookings
        </ButtonLink>
      </div>
    )
  }

  const ref =
    appointment.referenceCode ??
    `APT-${String(appointment.id).padStart(4, '0')}`

  return (
    <div className="space-y-8">
      {/* Back nav + header */}
      <div>
        <Link
          to="/account/bookings"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-night-400 transition-colors hover:text-night-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Bookings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-luxe mb-1">Booking Details</p>
            <h1 className="font-display text-3xl text-night-50">#{ref}</h1>
          </div>
          {/* Top-level status badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
                STATUS_BADGE_STYLES[appointment.status],
              )}
            >
              {APPOINTMENT_STATUS_LABELS[appointment.status]}
            </span>
            {payStatus && (
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
                  paymentStatusStyle(payStatus),
                )}
              >
                {isPaid && <BadgeCheck className="h-3 w-3" />}
                {PAYMENT_STATUS_LABELS[payStatus]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Payment action banner ── */}
      {needsPayment && payToken && (
        <div className="rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
            <div className="flex-1">
              {isCash ? (
                <>
                  <p className="font-semibold text-gold-300">Pay at the Salon</p>
                  <p className="mt-0.5 text-sm text-night-400">
                    You have selected Cash Payment. Please pay{' '}
                    <span className="font-bold text-gold-400">{formatPrice(appointment.totalAmount)}</span> at
                    SAWABA GROOMING STUDIO before your appointment can be confirmed. No receipt
                    needed — our team confirms it in person.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gold-300">
                    {payStatus === 'REJECTED'
                      ? 'Payment rejected — please resubmit'
                      : 'Payment required to secure this slot'}
                  </p>
                  <p className="mt-0.5 text-sm text-night-400">
                    {payStatus === 'REJECTED'
                      ? extPay?.rejectionReason
                        ? `Reason: ${extPay.rejectionReason}`
                        : 'Your receipt could not be verified. Please upload a new one.'
                      : 'Your appointment is reserved but will not be confirmed until payment is complete.'}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLink to={`/pay/${payToken}`} variant={isCash ? 'outline' : 'gold'} size="md">
              <Wallet className="h-4 w-4" />
              {isCash
                ? 'View Payment Details'
                : payStatus === 'REJECTED'
                  ? 'Resubmit Payment'
                  : `Pay ${formatPrice(appointment.totalAmount)}`}
            </ButtonLink>
          </div>
        </div>
      )}

      {/* ── Paid confirmation banner ── */}
      {isPaid && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-300">
              {isCash ? 'Payment Completed — Cash Received' : 'Payment Verified'}
            </p>
            <p className="mt-0.5 text-sm text-night-400">
              {isCash
                ? 'Your cash payment was received at the salon and your appointment is confirmed.'
                : 'Your appointment is confirmed and ready for service.'}
            </p>
          </div>
          {payToken && (
            <ButtonLink to={`/receipt/${payToken}`} variant="outline" size="sm">
              <FileText className="h-3.5 w-3.5" />
              Receipt
            </ButtonLink>
          )}
        </div>
      )}

      {/* ── Appointment details ── */}
      <section>
        <SectionHeader title="Appointment Details" />
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow
            icon={Hash}
            label="Booking Reference"
            value={`#${ref}`}
            valueClass="text-gold-400"
            mono
          />
          <DetailRow
            icon={CreditCard}
            label="Service Price"
            value={formatPrice(appointment.totalAmount)}
            valueClass="text-gold-400"
          />
          <DetailRow
            icon={Scissors}
            label="Service"
            value={
              appointment.service
                ? `${appointment.service.name} · ${appointment.service.duration} min`
                : '—'
            }
          />
          <DetailRow
            icon={User}
            label={appointment.assignedBarber ? 'Your Barber' : 'Barber'}
            value={appointment.assignedBarber?.name ?? appointment.barber?.name ?? 'Any available'}
          />
          <DetailRow
            icon={CalendarDays}
            label="Date"
            value={formatDate(appointment.appointmentDate)}
          />
          <DetailRow
            icon={Clock}
            label="Time"
            value={formatTime(appointment.appointmentTime)}
          />
          {appointment.notes && (
            <div className="sm:col-span-2">
              <DetailRow icon={FileText} label="Notes" value={appointment.notes} />
            </div>
          )}
        </div>
      </section>

      {/* ── Payment details ── */}
      {appointment.payment && (
        <section>
          <SectionHeader title="Payment Details" />
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow
              icon={CreditCard}
              label="Payment Status"
              value={PAYMENT_STATUS_LABELS[payStatus!]}
              valueClass={
                isPaid
                  ? 'text-emerald-300'
                  : needsPayment
                    ? 'text-gold-300'
                    : 'text-night-200'
              }
            />
            <DetailRow
              icon={Wallet}
              label="Amount"
              value={formatPrice(appointment.payment.amount)}
              valueClass="text-gold-400"
            />
            {appointment.payment.paymentMethod && (
              <DetailRow
                icon={CreditCard}
                label="Payment Method"
                value={PAYMENT_METHOD_LABELS[appointment.payment.paymentMethod]}
              />
            )}
            {extPay?.transactionReference && (
              <DetailRow
                icon={Hash}
                label="Transaction Reference"
                value={extPay.transactionReference}
                mono
              />
            )}
            {extPay?.paymentDate && (
              <DetailRow
                icon={CalendarDays}
                label="Payment Date"
                value={formatDate(extPay.paymentDate)}
              />
            )}
            {extPay?.verifiedAt && (
              <DetailRow
                icon={BadgeCheck}
                label="Verified At"
                value={formatDate(new Date(extPay.verifiedAt).toISOString().slice(0, 10))}
                valueClass="text-emerald-300"
              />
            )}
            {extPay?.rejectionReason && (
              <div className="sm:col-span-2">
                <DetailRow
                  icon={XCircle}
                  label="Rejection Reason"
                  value={extPay.rejectionReason}
                  valueClass="text-red-300"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Actions ── */}
      <section className="flex flex-wrap gap-3 border-t border-night-800 pt-6">
        {/* Pay now (receipt/online methods) — cash uses "View Payment Details" above */}
        {needsPayment && payToken && !isCash && (
          <ButtonLink to={`/pay/${payToken}`} variant="gold" size="md">
            <Wallet className="h-4 w-4" />
            {payStatus === 'REJECTED' ? 'Resubmit Payment' : 'Pay Now'}
          </ButtonLink>
        )}

        {/* Cash unpaid: open the payment page for details */}
        {needsPayment && payToken && isCash && (
          <ButtonLink to={`/pay/${payToken}`} variant="outline" size="md">
            <Banknote className="h-4 w-4" />
            Pay at Salon — Details
          </ButtonLink>
        )}

        {/* Check payment status */}
        {payStatus === 'PENDING_VERIFICATION' && payToken && (
          <ButtonLink to={`/pay/${payToken}`} variant="outline" size="md">
            <Clock className="h-4 w-4" />
            Check Payment Status
          </ButtonLink>
        )}

        {/* Receipt (paid) */}
        {isPaid && payToken && (
          <>
            <ButtonLink to={`/receipt/${payToken}`} variant="outline" size="md">
              <FileText className="h-4 w-4" />
              View Receipt
            </ButtonLink>
            <button
              type="button"
              onClick={() =>
                window.open(`/receipt/${payToken}?print=1`, '_blank', 'noopener')
              }
              className="flex items-center gap-2 rounded-xl border border-night-700 px-4 py-2.5 text-sm font-semibold text-night-300 transition-colors hover:border-night-500 hover:text-night-100"
            >
              <FileText className="h-4 w-4" />
              Print / Download
            </button>
          </>
        )}

        {/* Cancel */}
        {canCancel(appointment.status) && (
          <Button
            variant="ghost"
            size="md"
            loading={cancelling}
            onClick={() => void handleCancel()}
            className="text-night-500 hover:text-rose-400"
          >
            <XCircle className="h-4 w-4" />
            Cancel Appointment
          </Button>
        )}

        {/* Book again */}
        <ButtonLink
          to={
            appointment.service
              ? `/book?service=${appointment.serviceId}${appointment.barberId ? `&barber=${appointment.barberId}` : ''}`
              : '/book'
          }
          variant="ghost"
          size="md"
        >
          <Scissors className="h-4 w-4" />
          Book Again
        </ButtonLink>

        <Button
          variant="ghost"
          size="md"
          onClick={() => navigate('/account/bookings')}
          className="text-night-500"
        >
          <ArrowLeft className="h-4 w-4" />
          All Bookings
        </Button>
      </section>
    </div>
  )
}
