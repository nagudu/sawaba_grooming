import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Clock,
  CreditCard,
  Download,
  FileText,
  LoaderCircle,
  Printer,
  RefreshCw,
  Scissors,
  User,
  Wallet,
  XCircle,
} from 'lucide-react'
import { ButtonLink } from '../../components/ui/Button'
import { useToast } from '../../components/ui/ToastNotification'
import { accountApi, type CustomerPaymentItem } from '../../api/account'
import { formatDate, formatPrice, formatTime } from '../../utils/format'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../../utils/payment'
import { cn } from '../../utils/cn'
import type { PaymentStatus } from '../../api'

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusStyle(status: PaymentStatus): string {
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
    default: // UNPAID
      return 'border-gold-500/40 bg-gold-500/10 text-gold-300'
  }
}

function statusIcon(status: PaymentStatus) {
  switch (status) {
    case 'PAID':
      return <BadgeCheck className="h-3.5 w-3.5" />
    case 'REJECTED':
      return <XCircle className="h-3.5 w-3.5" />
    case 'CANCELLED':
      return <XCircle className="h-3.5 w-3.5" />
    case 'PENDING_VERIFICATION':
      return <RefreshCw className="h-3.5 w-3.5 animate-spin" />
    default:
      return <Wallet className="h-3.5 w-3.5" />
  }
}

function needsPayment(status: PaymentStatus): boolean {
  return status === 'UNPAID' || status === 'REJECTED'
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type Filter = 'all' | 'unpaid' | 'pending' | 'paid' | 'other'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Action Required' },
  { key: 'pending', label: 'Under Review' },
  { key: 'paid', label: 'Paid' },
  { key: 'other', label: 'Other' },
]

function applyFilter(items: CustomerPaymentItem[], filter: Filter): CustomerPaymentItem[] {
  switch (filter) {
    case 'unpaid':
      return items.filter((p) => needsPayment(p.status))
    case 'pending':
      return items.filter((p) => p.status === 'PENDING_VERIFICATION')
    case 'paid':
      return items.filter((p) => p.status === 'PAID')
    case 'other':
      return items.filter((p) =>
        ['REFUNDED', 'CANCELLED'].includes(p.status),
      )
    default:
      return items
  }
}

// ─── Single payment card ──────────────────────────────────────────────────────

function PaymentCard({ payment }: { payment: CustomerPaymentItem }) {
  const ref =
    payment.referenceCode ??
    `APT-${String(payment.appointmentId).padStart(4, '0')}`

  return (
    <div
      className={cn(
        'card-lux overflow-hidden',
        needsPayment(payment.status) && 'ring-1 ring-gold-500/30',
      )}
    >
      {/* Unpaid / rejected banner */}
      {needsPayment(payment.status) && (
        <div className="flex items-center gap-2.5 border-b border-gold-500/20 bg-gold-500/[0.06] px-5 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-gold-400" />
          <p className="flex-1 text-xs font-semibold text-gold-300">
            {payment.status === 'REJECTED'
              ? 'Payment was rejected — please resubmit your receipt.'
              : 'Payment required to secure your appointment.'}
          </p>
          <ButtonLink to={`/pay/${payment.accessToken}`} variant="gold" size="sm">
            <Wallet className="h-3.5 w-3.5" />
            {payment.status === 'REJECTED' ? 'Resubmit' : 'Pay Now'}
          </ButtonLink>
        </div>
      )}

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left: appointment info */}
          <div className="min-w-0 space-y-1.5">
            {/* Reference */}
            <p className="font-mono text-[11px] font-bold tracking-wide text-gold-500">
              #{ref}
            </p>

            {/* Service name */}
            <p className="font-display text-lg leading-tight text-night-50">
              {payment.serviceName ?? 'Appointment'}
            </p>

            {/* Barber + date + time */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-night-400">
              {payment.barberName && (
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5 shrink-0 text-night-500" />
                  {payment.barberName}
                </span>
              )}
              {payment.appointmentDate && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-night-500" />
                  {formatDate(payment.appointmentDate)}
                </span>
              )}
              {payment.appointmentTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-night-500" />
                  {formatTime(payment.appointmentTime)}
                </span>
              )}
            </div>

            {/* Payment meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-night-500">
              {payment.paymentMethod && (
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3 shrink-0" />
                  {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                </span>
              )}
              {payment.transactionReference && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3 shrink-0" />
                  Ref: {payment.transactionReference}
                </span>
              )}
              {payment.paymentDate && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  Paid {formatDate(payment.paymentDate)}
                </span>
              )}
              {payment.verifiedAt && (
                <span className="flex items-center gap-1">
                  <BadgeCheck className="h-3 w-3 shrink-0 text-emerald-400" />
                  Verified {formatDate(new Date(payment.verifiedAt).toISOString().slice(0, 10))}
                </span>
              )}
            </div>
          </div>

          {/* Right: amount + status */}
          <div className="flex flex-col items-end gap-2">
            <p className="font-display text-xl font-bold text-gold-400">
              {formatPrice(payment.amount)}
            </p>
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                statusStyle(payment.status),
              )}
            >
              {statusIcon(payment.status)}
              {PAYMENT_STATUS_LABELS[payment.status]}
            </span>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-night-800/60 pt-4">
          {/* Pay / resubmit */}
          {needsPayment(payment.status) && (
            <ButtonLink to={`/pay/${payment.accessToken}`} variant="gold" size="sm">
              <Wallet className="h-3.5 w-3.5" />
              {payment.status === 'REJECTED' ? 'Resubmit Payment' : 'Pay Now'}
            </ButtonLink>
          )}

          {/* View payment page */}
          {payment.status === 'PENDING_VERIFICATION' && (
            <ButtonLink to={`/pay/${payment.accessToken}`} variant="outline" size="sm">
              <RefreshCw className="h-3.5 w-3.5" />
              View Status
            </ButtonLink>
          )}

          {/* Receipt actions (paid only) */}
          {payment.status === 'PAID' && (
            <>
              <ButtonLink to={`/receipt/${payment.accessToken}`} variant="outline" size="sm">
                <Scissors className="h-3.5 w-3.5" />
                View Receipt
              </ButtonLink>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `/receipt/${payment.accessToken}?print=1`,
                    '_blank',
                    'noopener',
                  )
                }
                className="flex items-center gap-1.5 rounded-xl border border-night-700 px-3 py-1.5 text-xs font-semibold text-night-300 transition-colors hover:border-night-500 hover:text-night-100"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `/receipt/${payment.accessToken}?print=1`,
                    '_blank',
                    'noopener',
                  )
                }
                className="flex items-center gap-1.5 rounded-xl border border-night-700 px-3 py-1.5 text-xs font-semibold text-night-300 transition-colors hover:border-night-500 hover:text-night-100"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerPaymentsPage() {
  const [items, setItems] = useState<CustomerPaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const { showToast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await accountApi.payments()
      setItems(result.items)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not load payments.',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  const unpaidCount = items.filter((p) => needsPayment(p.status)).length
  const filtered = applyFilter(items, filter)

  return (
    <div>
      {/* Page header */}
      <div className="mb-7">
        <p className="label-luxe mb-1">My Account</p>
        <h1 className="font-display text-3xl text-night-50">Payments</h1>
        <p className="mt-1.5 text-sm text-night-400">
          Your payment history, receipts and pending payments.
        </p>
      </div>

      {/* Unpaid alert */}
      {unpaidCount > 0 && !loading && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
          <div className="flex-1">
            <p className="font-semibold text-gold-300">
              {unpaidCount === 1
                ? '1 payment action required'
                : `${unpaidCount} payments need attention`}
            </p>
            <p className="mt-0.5 text-sm text-night-400">
              Complete your payment to confirm your appointment slot.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilter('unpaid')}
            className="shrink-0 text-xs font-semibold text-gold-400 hover:text-gold-300"
          >
            Show only
          </button>
        </div>
      )}

      {/* Filter tabs */}
      {items.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count =
              f.key === 'all'
                ? items.length
                : applyFilter(items, f.key).length
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  filter === f.key
                    ? 'border-gold-500 bg-gold-500/10 text-gold-300'
                    : 'border-night-800 text-night-400 hover:border-night-600 hover:text-night-200',
                )}
              >
                {f.label}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-20 text-night-400">
          <LoaderCircle className="h-8 w-8 animate-spin text-gold-500" />
          <p className="text-sm">Loading your payments…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-night-800 bg-night-900/40 p-10 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-night-600" />
          <p className="mt-4 font-display text-lg text-night-200">No payments yet</p>
          <p className="mt-1 text-sm text-night-500">
            Payments appear here after you book and pay for an appointment.
          </p>
          <ButtonLink to="/book" variant="gold" size="md" className="mt-5">
            Book an Appointment
          </ButtonLink>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-night-800 bg-night-900/40 p-8 text-center">
          <p className="text-sm text-night-400">
            No payments match this filter.{' '}
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-gold-400 hover:text-gold-300"
            >
              Show all
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} />
          ))}
        </div>
      )}
    </div>
  )
}
