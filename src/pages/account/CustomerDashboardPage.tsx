import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CalendarPlus,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  LoaderCircle,
  RotateCcw,
  Scissors,
  Sparkles,
  User,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Button, ButtonLink } from '../../components/ui/Button'
import { useToast } from '../../components/ui/ToastNotification'
import { accountApi, type CustomerSummary } from '../../api/account'
import { useCustomerAuth } from '../../store/customerAuth'
import { formatDate, formatPrice, formatTime } from '../../utils/format'
import {
  APPOINTMENT_STATUS_LABELS,
  STATUS_BADGE_STYLES,
} from '../../config/appointmentStatuses'
import { PAYMENT_STATUS_LABELS } from '../../utils/payment'
import type { AppointmentItem } from '../../api'
import { cn } from '../../utils/cn'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paymentBadgeStyle(status: string): string {
  if (status === 'PAID') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  if (status === 'PENDING_VERIFICATION') return 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  if (status === 'REJECTED') return 'border-red-500/40 bg-red-500/10 text-red-300'
  return 'border-gold-500/40 bg-gold-500/10 text-gold-300'
}

function needsPayment(appointment: AppointmentItem): boolean {
  return (
    appointment.payment?.status === 'UNPAID' ||
    appointment.payment?.status === 'REJECTED'
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function CustomerDashboardPage() {
  const { customer } = useCustomerAuth()
  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const { showToast } = useToast()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSummary(await accountApi.summary())
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not load your dashboard.',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  async function cancelAppointment(id: number) {
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

  function bookAgain() {
    if (!summary?.usual) {
      navigate('/book')
      return
    }
    const { service, barberId } = summary.usual
    navigate(`/book?service=${service.id}${barberId ? `&barber=${barberId}` : ''}`)
  }

  const firstName = customer?.fullName.split(' ')[0] ?? 'there'
  const upcoming = summary?.upcoming?.[0] ?? null
  const unpaidAppointments = summary?.upcoming?.filter(needsPayment) ?? []
  const pendingCount = unpaidAppointments.length

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <p className="label-luxe mb-1">My Account</p>
        <h1 className="font-display text-3xl text-night-50">
          Welcome back, {firstName} 👋
        </h1>
        {customer && (
          <p className="mt-1 text-sm text-night-500">
            Customer ID:{' '}
            <span className="font-mono font-semibold text-night-300">
              {customer.customerCode}
            </span>
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-20 text-night-400">
          <LoaderCircle className="h-8 w-8 animate-spin text-gold-500" />
          <p className="text-sm">Loading your dashboard…</p>
        </div>
      ) : !summary ? (
        <p className="py-20 text-center text-night-400">
          Could not load your dashboard. Please refresh.
        </p>
      ) : (
        <>
          {/* ── Pending payment alert ── */}
          {pendingCount > 0 && (
            <div className="rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
                <div className="flex-1">
                  <p className="font-semibold text-gold-300">
                    {pendingCount === 1
                      ? '1 appointment awaiting payment'
                      : `${pendingCount} appointments awaiting payment`}
                  </p>
                  <p className="mt-0.5 text-sm text-night-400">
                    Your slot is not secured until payment is complete.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {unpaidAppointments.slice(0, 2).map((apt) => {
                  const payToken = (
                    apt.payment as unknown as { accessToken?: string } | null
                  )?.accessToken
                  return payToken ? (
                    <ButtonLink
                      key={apt.id}
                      to={`/pay/${payToken}`}
                      variant="gold"
                      size="sm"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Pay for {apt.service?.name ?? `Booking #${apt.id}`}
                    </ButtonLink>
                  ) : null
                })}
                {pendingCount > 2 && (
                  <ButtonLink to="/account/bookings" variant="outline" size="sm">
                    View all {pendingCount}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </ButtonLink>
                )}
              </div>
            </div>
          )}

          {/* ── Stats ── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Visits"
              value={String(summary.stats.totalAppointments)}
              icon={CalendarDays}
            />
            <StatCard
              label="Completed"
              value={String(summary.stats.completed)}
              icon={CheckCircle2}
              tone="emerald"
            />
            <StatCard
              label="Upcoming"
              value={String(summary.upcomingCount)}
              icon={Clock}
              to="/account/bookings"
              tone={pendingCount > 0 ? 'gold' : undefined}
              badge={pendingCount > 0 ? `${pendingCount} unpaid` : undefined}
            />
            <StatCard
              label="Total Spent"
              value={formatPrice(summary.stats.totalSpent)}
              icon={CreditCard}
              to="/account/payments"
            />
          </div>

          {/* ── Upcoming appointment ── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl text-night-50">Next Appointment</h2>
              <Link
                to="/account/bookings"
                className="text-sm text-gold-400 hover:text-gold-300"
              >
                View all
              </Link>
            </div>

            {upcoming ? (
              <UpcomingCard
                appointment={upcoming}
                cancelling={cancelling === upcoming.id}
                onCancel={() => void cancelAppointment(upcoming.id)}
              />
            ) : (
              <div className="rounded-2xl border border-night-800 bg-night-900/40 p-6 text-sm text-night-400">
                No upcoming appointments. Your chair is waiting —{' '}
                <Link to="/book" className="text-gold-400 hover:text-gold-300">
                  book your next visit
                </Link>
                .
              </div>
            )}
          </section>

          {/* ── Book Again ── */}
          <div className="rounded-2xl border border-gold-500/25 bg-gold-500/[0.05] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  {summary.usual?.isFavorite ? 'Your Favourite Service' : 'Your Usual Service'}
                </p>
                {summary.usual ? (
                  <>
                    <p className="mt-1 font-display text-2xl text-night-50">
                      {summary.usual.service.name}
                    </p>
                    <p className="mt-1 text-sm text-night-400">
                      {formatPrice(summary.usual.service.price)} · booked{' '}
                      {summary.usual.timesBooked}× · last {summary.usual.lastBooked}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-night-400">
                    Book your first appointment and we will remember your favourite here.
                  </p>
                )}
              </div>
              <Button variant="gold" size="lg" onClick={bookAgain}>
                <RotateCcw className="h-4 w-4" />
                Book Again
              </Button>
            </div>
          </div>

          {/* ── Quick actions ── */}
          <section>
            <h2 className="mb-3 font-display text-xl text-night-50">Quick Actions</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { to: '/book', label: 'Book Appointment', icon: CalendarPlus },
                { to: '/account/bookings', label: 'My Bookings', icon: Scissors },
                { to: '/account/payments', label: 'Payments', icon: CreditCard },
                { to: '/account/profile', label: 'My Profile', icon: UserRound },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="card-lux flex items-center gap-3 p-4 transition-all duration-200 hover:border-gold-500/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 text-gold-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold text-night-100">{label}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Recent bookings ── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl text-night-50">Recent Bookings</h2>
              <Link
                to="/account/bookings"
                className="text-sm text-gold-400 hover:text-gold-300"
              >
                View all
              </Link>
            </div>
            {summary.recent.length ? (
              <div className="overflow-x-auto rounded-2xl border border-night-800">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-night-900/60 text-[11px] uppercase tracking-[0.14em] text-night-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Service</th>
                      <th className="hidden px-5 py-3 font-semibold sm:table-cell">Barber</th>
                      <th className="px-5 py-3 font-semibold">Amount</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent.map((apt) => (
                      <tr
                        key={apt.id}
                        className="border-t border-night-800/70 transition-colors hover:bg-night-900/40"
                      >
                        <td className="px-5 py-3.5 text-night-300">
                          {formatDate(apt.appointmentDate)}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-night-100">
                            {apt.service?.name ?? '—'}
                          </p>
                          <p className="text-[11px] text-night-500">
                            {formatTime(apt.appointmentTime)}
                          </p>
                        </td>
                        <td className="hidden px-5 py-3.5 text-night-400 sm:table-cell">
                          {apt.assignedBarber?.name ?? apt.barber?.name ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-night-100">
                          {formatPrice(apt.totalAmount)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                              STATUS_BADGE_STYLES[apt.status],
                            )}
                          >
                            {APPOINTMENT_STATUS_LABELS[apt.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-2xl border border-night-800 bg-night-900/40 p-6 text-sm text-night-400">
                No past bookings yet.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  to,
  tone,
  badge,
}: {
  label: string
  value: string
  icon: React.ElementType
  to?: string
  tone?: 'gold' | 'emerald'
  badge?: string
}) {
  const inner = (
    <div className="card-lux flex items-center gap-4 p-5 transition-all duration-200 hover:border-gold-500/30">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          tone === 'emerald'
            ? 'bg-emerald-500/15 text-emerald-400'
            : tone === 'gold'
              ? 'bg-gold-500/15 text-gold-400'
              : 'bg-night-800 text-night-400',
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
          {label}
        </p>
        <p className="mt-0.5 font-display text-2xl font-bold text-night-50">{value}</p>
        {badge && (
          <p className="mt-0.5 text-[10px] font-semibold text-gold-400">{badge}</p>
        )}
      </div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ─── Upcoming appointment card ────────────────────────────────────────────────

function UpcomingCard({
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
  const payToken = (
    appointment.payment as unknown as { accessToken?: string } | null
  )?.accessToken
  const requiresPayment = payStatus === 'UNPAID' || payStatus === 'REJECTED'
  const isCash = (
    appointment.payment as unknown as { paymentMethod?: string } | null
  )?.paymentMethod === 'CASH'

  return (
    <div
      className={cn(
        'card-lux overflow-hidden',
        requiresPayment && 'ring-1 ring-gold-500/30',
      )}
    >
      {/* Payment-required banner */}
      {requiresPayment && payToken && (
        <div className="flex items-center gap-2.5 border-b border-gold-500/20 bg-gold-500/[0.06] px-5 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-gold-400" />
          <p className="flex-1 text-xs font-semibold text-gold-300">
            {isCash
              ? 'Cash payment selected — pay at the salon to confirm.'
              : 'Payment required to secure this appointment'}
          </p>
          <ButtonLink to={`/pay/${payToken}`} variant="gold" size="sm">
            {isCash ? <Banknote className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}
            {isCash ? 'Pay at Salon' : 'Pay Now'}
          </ButtonLink>
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="font-mono text-[11px] font-bold tracking-wide text-gold-500">
              #{ref}
            </p>
            <p className="font-display text-2xl text-night-50">
              {appointment.service?.name ?? 'Service'}
            </p>
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
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <p className="font-display text-xl font-bold text-gold-400">
              {formatPrice(appointment.totalAmount)}
            </p>
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                STATUS_BADGE_STYLES[appointment.status],
              )}
            >
              {APPOINTMENT_STATUS_LABELS[appointment.status]}
            </span>
            {payStatus && (
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                  paymentBadgeStyle(payStatus),
                )}
              >
                {payStatus === 'PAID' && (
                  <BadgeCheck className="mr-1 inline h-3 w-3" />
                )}
                {PAYMENT_STATUS_LABELS[payStatus]}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-night-800/60 pt-4">
          <ButtonLink
            to={`/account/bookings/${appointment.id}`}
            variant="outline"
            size="sm"
          >
            View Details
          </ButtonLink>
          {payStatus === 'PAID' && payToken && (
            <ButtonLink to={`/receipt/${payToken}`} variant="outline" size="sm">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />
              Receipt
            </ButtonLink>
          )}
          {!['COMPLETED', 'CANCELLED', 'IN_PROGRESS'].includes(
            appointment.status,
          ) && (
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
