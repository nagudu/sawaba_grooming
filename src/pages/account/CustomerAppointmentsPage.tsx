import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  CalendarDays,
  ChevronRight,
  Clock,
  LoaderCircle,
  Scissors,
  Star,
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
import { PAYMENT_STATUS_LABELS } from '../../utils/payment'
import { cn } from '../../utils/cn'

// ─── Status helpers ───────────────────────────────────────────────────────────

function paymentBadgeStyle(status: PaymentStatus): string {
  switch (status) {
    case 'PAID':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    case 'PENDING_VERIFICATION':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    case 'REJECTED':
      return 'border-red-500/40 bg-red-500/10 text-red-300'
    case 'CANCELLED':
      return 'border-night-600 bg-night-800 text-night-400'
    default: // UNPAID, REFUNDED
      return 'border-gold-500/40 bg-gold-500/10 text-gold-300'
  }
}

function needsPayment(status: PaymentStatus | undefined): boolean {
  return status === 'UNPAID' || status === 'REJECTED'
}

function canCancel(status: AppointmentStatus): boolean {
  return !['COMPLETED', 'CANCELLED', 'IN_PROGRESS'].includes(status)
}

// ─── Single booking card ──────────────────────────────────────────────────────

function BookingCard({
  appointment,
  cancelling,
  onCancel,
}: {
  appointment: AppointmentItem
  cancelling: boolean
  onCancel: () => void
}) {
  const ref =
    appointment.referenceCode ??
    `APT-${String(appointment.id).padStart(4, '0')}`

  const payStatus = appointment.payment?.status
  const requiresPayment = needsPayment(payStatus)
  const payToken = (appointment.payment as unknown as { accessToken?: string } | null)
    ?.accessToken
  const isCash = (
    appointment.payment as unknown as { paymentMethod?: string } | null
  )?.paymentMethod === 'CASH'

  return (
    <div
      className={cn(
        'card-lux overflow-hidden transition-shadow duration-200',
        requiresPayment && 'ring-1 ring-gold-500/30',
      )}
    >
      {/* Payment-required banner */}
      {requiresPayment && (
        <div className="flex items-center gap-2.5 border-b border-gold-500/20 bg-gold-500/[0.06] px-5 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-gold-400" />
          <p className="flex-1 text-xs font-semibold text-gold-300">
            {isCash
              ? 'Cash payment selected — please pay at the salon to confirm this appointment.'
              : payStatus === 'REJECTED'
                ? 'Your previous payment was rejected — please resubmit.'
                : 'Payment is required to secure this appointment.'}
          </p>
          {payToken && (
            <ButtonLink to={`/pay/${payToken}`} variant="gold" size="sm">
              {isCash ? (
                <Banknote className="h-3.5 w-3.5" />
              ) : (
                <Wallet className="h-3.5 w-3.5" />
              )}
              {isCash ? 'Pay at Salon' : 'Pay Now'}
            </ButtonLink>
          )}
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left: service + meta */}
          <div className="min-w-0 space-y-1.5">
            {/* Reference */}
            <p className="font-mono text-[11px] font-bold tracking-wide text-gold-500">
              #{ref}
            </p>

            {/* Service name */}
            <p className="font-display text-lg leading-tight text-night-50">
              {appointment.service?.name ?? 'Service'}
            </p>

            {/* Barber + date + time row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-night-400">
              {(appointment.assignedBarber || appointment.barber) && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 shrink-0 text-night-500" />
                  {appointment.assignedBarber?.name ?? appointment.barber?.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-night-500" />
                {formatDate(appointment.appointmentDate)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0 text-night-500" />
                {formatTime(appointment.appointmentTime)}
              </span>
              {appointment.service?.duration && (
                <span className="flex items-center gap-1">
                  <Scissors className="h-3.5 w-3.5 shrink-0 text-night-500" />
                  {appointment.service.duration} min
                </span>
              )}
            </div>

            {/* Cancellation reason */}
            {appointment.cancellationReason && (
              <p className="mt-1 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">
                {appointment.cancellationReason}
              </p>
            )}
          </div>

          {/* Right: price + status badges */}
          <div className="flex flex-col items-end gap-2">
            <p className="font-display text-xl font-bold text-gold-400">
              {formatPrice(appointment.totalAmount)}
            </p>

            {/* Appointment status */}
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                STATUS_BADGE_STYLES[appointment.status],
              )}
            >
              {APPOINTMENT_STATUS_LABELS[appointment.status]}
            </span>

            {/* Payment status */}
            {payStatus && (
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                  paymentBadgeStyle(payStatus),
                )}
              >
                {payStatus === 'PAID' ? (
                  <span className="flex items-center gap-1">
                    <BadgeCheck className="h-3 w-3" />
                    {PAYMENT_STATUS_LABELS[payStatus]}
                  </span>
                ) : (
                  PAYMENT_STATUS_LABELS[payStatus]
                )}
              </span>
            )}
          </div>
        </div>

        {/* Action row */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-night-800/60 pt-4">
          {/* View detail */}
          <Link
            to={`/account/bookings/${appointment.id}`}
            className="flex items-center gap-1.5 rounded-xl border border-night-700 px-3.5 py-2 text-xs font-semibold text-night-300 transition-colors hover:border-night-500 hover:text-night-100"
          >
            View Details
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          {/* Pay Now (if unpaid/rejected and we have a token) */}
          {requiresPayment && payToken && (
            <ButtonLink to={`/pay/${payToken}`} variant="gold" size="sm">
              <Wallet className="h-3.5 w-3.5" />
              {payStatus === 'REJECTED' ? 'Resubmit Payment' : 'Pay Now'}
            </ButtonLink>
          )}

          {/* View receipt (if paid) */}
          {payStatus === 'PAID' && payToken && (
            <ButtonLink to={`/receipt/${payToken}`} variant="outline" size="sm">
              <BadgeCheck className="h-3.5 w-3.5" />
              View Receipt
            </ButtonLink>
          )}

          {/* Write review (if completed) */}
          {appointment.status === 'COMPLETED' && (
            <ButtonLink to="/reviews" variant="ghost" size="sm">
              <Star className="h-3.5 w-3.5 text-gold-400" />
              Write a Review
            </ButtonLink>
          )}

          {/* Cancel */}
          {canCancel(appointment.status) && (
            <Button
              variant="ghost"
              size="sm"
              loading={cancelling}
              onClick={onCancel}
              className="text-night-500 hover:text-rose-400"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerAppointmentsPage() {
  const [items, setItems] = useState<AppointmentItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const { showToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await accountApi.appointments()
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not load appointments.',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCancel(id: number) {
    if (cancelling) return
    setCancelling(id)
    try {
      await accountApi.cancelAppointment(id, 'Cancelled by customer')
      showToast('Appointment cancelled.', 'success')
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not cancel.', 'error')
    } finally {
      setCancelling(null)
    }
  }

  // Separate unpaid from the rest so unpaid bookings always surface at the top
  const unpaid = items.filter((a) => needsPayment(a.payment?.status))
  const rest = items.filter((a) => !needsPayment(a.payment?.status))

  return (
    <div>
      {/* Page header */}
      <div className="mb-7">
        <p className="label-luxe mb-1">My Account</p>
        <h1 className="font-display text-3xl text-night-50">My Bookings</h1>
        <p className="mt-1.5 text-sm text-night-400">
          Every visit, upcoming appointment and receipt — all in one place.
        </p>
      </div>

      {/* Global pay-now alert */}
      {unpaid.length > 0 && !loading && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
          <div className="flex-1">
            <p className="font-semibold text-gold-300">
              {unpaid.length === 1
                ? '1 booking awaiting payment'
                : `${unpaid.length} bookings awaiting payment`}
            </p>
            <p className="mt-0.5 text-sm text-night-400">
              Complete payment to secure your appointment slot.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-20 text-night-400">
          <LoaderCircle className="h-8 w-8 animate-spin text-gold-500" />
          <p className="text-sm">Loading your bookings…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-night-800 bg-night-900/40 p-10 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-night-600" />
          <p className="mt-4 font-display text-lg text-night-200">No bookings yet</p>
          <p className="mt-1 text-sm text-night-500">
            Book your first appointment and it will appear here.
          </p>
          <ButtonLink to="/book" variant="gold" size="md" className="mt-5">
            Book Your First Visit
          </ButtonLink>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-night-500">
            {total} booking{total === 1 ? '' : 's'} total
          </p>

          {/* Unpaid first */}
          {unpaid.length > 0 && (
            <div className="mb-4 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-500">
                Awaiting Payment
              </p>
              {unpaid.map((a) => (
                <BookingCard
                  key={a.id}
                  appointment={a}
                  cancelling={cancelling === a.id}
                  onCancel={() => void handleCancel(a.id)}
                />
              ))}
            </div>
          )}

          {/* Rest */}
          {rest.length > 0 && (
            <div className="space-y-4">
              {unpaid.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                  All Bookings
                </p>
              )}
              {rest.map((a) => (
                <BookingCard
                  key={a.id}
                  appointment={a}
                  cancelling={cancelling === a.id}
                  onCancel={() => void handleCancel(a.id)}
                />
              ))}
            </div>
          )}

          <p className="mt-6 text-center text-xs text-night-500">
            Want a receipt? Open{' '}
            <Link to="/account/payments" className="text-gold-400 hover:text-gold-300">
              Payments
            </Link>{' '}
            to view, print or download it.
          </p>
        </>
      )}
    </div>
  )
}
