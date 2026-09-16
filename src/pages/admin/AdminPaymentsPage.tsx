import { useEffect, useMemo, useState } from 'react'
import { Banknote, Eye, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { api, buildQuery, type Paged, type PaymentMethod, type PaymentStatus } from '../../api'
import { ConfirmDialog, EmptyRow, PageHeader, StatusBadge, Td, Th } from '../../components/admin/AdminUI'
import Modal from '../../components/ui/Modal'
import { Button, buttonClasses } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { useToast } from '../../components/ui/ToastNotification'
import { useDebounced } from '../../hooks/useDebounced'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../../utils/payment'
import SmartImage from '../../components/ui/SmartImage'
import { formatDate, formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'
import type { PaymentItem } from '../../api/payments'

const PAYMENT_STATUS_FILTERS: Array<{ value: PaymentStatus | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'PENDING_VERIFICATION', label: 'Awaiting Review' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PAID', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PAYMENT_METHOD_FILTERS: Array<{ value: PaymentMethod | ''; label: string }> = [
  { value: '', label: 'All Methods' },
  { value: 'OPAY', label: 'OPay' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
]

function statusTone(status: PaymentStatus): string {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-500/15 text-emerald-400'
    case 'PENDING_VERIFICATION':
      return 'bg-gold-500/15 text-gold-400'
    case 'REJECTED':
      return 'bg-rose-500/15 text-rose-400'
    case 'CANCELLED':
      return 'bg-night-700 text-night-400'
    default:
      return 'bg-night-800 text-night-400'
  }
}

export default function AdminPaymentsPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('')
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [viewing, setViewing] = useState<PaymentItem | null>(null)
  const [verifying, setVerifying] = useState<PaymentItem | null>(null)
  const [rejecting, setRejecting] = useState<PaymentItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  /** Cash has no receipt to check — confirmation is "I received the money in person". */
  const [confirmingCash, setConfirmingCash] = useState<PaymentItem | null>(null)
  const [cashNote, setCashNote] = useState('Cash received at salon.')

  const perPage = 15
  const debouncedSearch = useDebounced(search.trim(), 300)

  const load = async (
    targetPage = page,
    targetStatus = statusFilter,
    targetMethod = methodFilter,
    query = search,
  ) => {
    setLoading(true)
    try {
      const data = await api.get<Paged<PaymentItem>>(
        `/api/admin/payments${buildQuery({
          page: targetPage,
          perPage,
          status: targetStatus,
          method: targetMethod,
          search: query || undefined,
        })}`,
      )
      setPayments(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, statusFilter, methodFilter, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, methodFilter])

  const doVerify = async () => {
    if (!verifying) return
    setBusy(true)
    try {
      await api.post(`/api/admin/payments/${verifying.id}/verify`)
      showToast(`Payment #${verifying.id} verified. Appointment confirmed.`)
      setVerifying(null)
      void load(page)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const doReject = async () => {
    if (!rejecting) return
    if (rejectReason.trim().length < 5) {
      showToast('Please provide a reason (at least 5 characters).', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post(`/api/admin/payments/${rejecting.id}/reject`, { reason: rejectReason.trim() })
      showToast(`Payment #${rejecting.id} rejected.`)
      setRejecting(null)
      setRejectReason('')
      void load(page)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const doConfirmCash = async () => {
    if (!confirmingCash) return
    setBusy(true)
    try {
      await api.post(`/api/admin/payments/${confirmingCash.id}/confirm-cash`, {
        note: cashNote.trim() || 'Cash received at salon.',
      })
      showToast(`Cash confirmed for #${confirmingCash.appointment?.referenceCode ?? confirmingCash.id}. Appointment confirmed.`)
      setConfirmingCash(null)
      setCashNote('Cash received at salon.')
      void load(page)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage])

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Review customer receipts, verify payments and manage refunds."
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="field-icon h-4 w-4" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void load(1, statusFilter, methodFilter, event.currentTarget.value)
            }}
            placeholder="Search by customer name, phone or payment id..."
            className="field pl-11"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PAYMENT_STATUS_FILTERS.map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={cn(
                buttonClasses('outline', 'sm'),
                statusFilter === option.value && 'border-gold-500/60 text-gold-300',
              )}
            >
              {option.label}
            </button>
          ))}
          <select
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value as PaymentMethod | '')}
            className="rounded-lg border border-night-700 bg-night-900 px-3 py-2 text-xs font-semibold text-night-200 focus:border-gold-500 focus:outline-none"
          >
            {PAYMENT_METHOD_FILTERS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-lux overflow-hidden">
        <div className="flex items-center justify-between border-b border-night-800 px-6 py-4">
          <h2 className="font-display text-lg text-night-50">
            {total} payment{total === 1 ? '' : 's'}
          </h2>
          <span className="text-xs text-night-500">Page {page} of {totalPages}</span>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading payments" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Customer</Th>
                  <Th>Service</Th>
                  <Th>Amount</Th>
                  <Th>Method</Th>
                  <Th>Receipt</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {payments.length === 0 ? (
                  <EmptyRow colSpan={8} message="No payments match your filters." />
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-night-900/60">
                      <Td>
                        <p className="font-semibold text-night-100">
                          {payment.appointment?.customerName ?? '—'}
                        </p>
                        <p className="text-xs text-night-500">
                          #{payment.appointment?.referenceCode ?? payment.appointmentId} ·{' '}
                          {payment.appointment?.customerPhone ?? ''}
                        </p>
                      </Td>
                      <Td>
                        {payment.appointment?.service?.name ?? '—'}
                        {payment.appointment && (
                          <p className="text-xs text-night-500">
                            {formatDate(payment.appointment.appointmentDate)} ·{' '}
                            {payment.appointment.appointmentTime}
                          </p>
                        )}
                      </Td>
                      <Td>
                        <span className="font-semibold text-gold-300">
                          {formatPrice(payment.amount)}
                        </span>
                        {payment.appointment && payment.appointment.totalAmount !== payment.amount && (
                          <p className="text-[11px] text-night-500">
                            Expected {formatPrice(payment.appointment.totalAmount)}
                          </p>
                        )}
                      </Td>
                      <Td>
                        {payment.paymentMethod ? (
                          <span className="text-sm capitalize text-night-200">
                            {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                          </span>
                        ) : (
                          <span className="text-xs text-night-500">—</span>
                        )}
                        {payment.transactionReference && (
                          <p className="max-w-[140px] truncate text-[11px] text-night-500">
                            {payment.transactionReference}
                          </p>
                        )}
                      </Td>
                      <Td>
                        {payment.receiptUrl ? (
                          <button
                            type="button"
                            onClick={() => setViewing(payment)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-night-700 px-2.5 py-1.5 text-xs font-semibold text-night-300 transition-colors hover:border-gold-500/50 hover:text-gold-300"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        ) : (
                          <span className="text-xs text-night-500">None</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-sm text-night-200">
                          {formatDate(payment.paymentDate ?? payment.createdAt.slice(0, 10))}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest',
                            statusTone(payment.status),
                          )}
                        >
                          {PAYMENT_STATUS_LABELS[payment.status]}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewing(payment)}
                            aria-label="View payment"
                            className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-gold-500/40 hover:text-gold-300"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {payment.status === 'PENDING_VERIFICATION' && payment.paymentMethod !== 'CASH' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setVerifying(payment)}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Verify Receipt
                              </Button>
                              <button
                                type="button"
                                onClick={() => setRejecting(payment)}
                                aria-label="Reject payment"
                                className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {payment.paymentMethod === 'CASH' &&
                            payment.status !== 'PAID' &&
                            payment.status !== 'CANCELLED' &&
                            payment.status !== 'REFUNDED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmingCash(payment)}
                              >
                                <Banknote className="h-3.5 w-3.5" />
                                Mark Cash as Paid
                              </Button>
                            )}
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-night-800 bg-night-900/40 px-6 py-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
              Previous
            </Button>
            <span className="px-2 text-sm text-night-400">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => void load(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        size="lg"
        title={`Payment #${viewing?.id ?? ''}`}
      >
        {viewing && <PaymentDetail payment={viewing} />}
      </Modal>

      <ConfirmDialog
        open={verifying !== null}
        onClose={() => setVerifying(null)}
        onConfirm={() => void doVerify()}
        busy={busy}
        title="Verify payment"
        description={`Confirm that you have received ${verifying ? formatPrice(verifying.amount) : ''} from ${verifying?.appointment?.customerName ?? 'this customer'}? The appointment will be marked ready for service.`}
        confirmLabel="Verify Payment"
      />

      <Modal
        open={confirmingCash !== null}
        onClose={() => setConfirmingCash(null)}
        size="md"
        title="Confirm Cash Payment"
      >
        {confirmingCash && (
          <div>
            <p className="text-sm text-night-300">
              Are you sure you have received{' '}
              <span className="font-bold text-gold-300">{formatPrice(confirmingCash.amount)}</span> cash
              from this customer?
            </p>
            <dl className="mt-4 space-y-2.5 rounded-xl border border-night-800 bg-night-900/60 p-4">
              <div className="flex justify-between gap-4">
                <dt className="text-xs font-semibold uppercase tracking-widest text-night-500">Customer</dt>
                <dd className="text-sm font-medium text-night-100">{confirmingCash.appointment?.customerName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-xs font-semibold uppercase tracking-widest text-night-500">Booking</dt>
                <dd className="font-mono text-sm font-bold text-gold-400">
                  #{confirmingCash.appointment?.referenceCode ?? confirmingCash.appointmentId}
                </dd>
              </div>
              {confirmingCash.appointment?.service && (
                <div className="flex justify-between gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-night-500">Service</dt>
                  <dd className="text-sm font-medium text-night-100">{confirmingCash.appointment.service.name}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-xs font-semibold uppercase tracking-widest text-night-500">Amount</dt>
                <dd className="text-sm font-bold text-night-100">{formatPrice(confirmingCash.amount)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-night-500">
              No receipt is needed for cash — this records the money as received in person and
              confirms the appointment.
            </p>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                Audit note (optional)
              </span>
              <input
                type="text"
                value={cashNote}
                onChange={(event) => setCashNote(event.target.value)}
                className="field"
                placeholder="e.g. Cash received at salon."
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" size="md" onClick={() => setConfirmingCash(null)}>
                Cancel
              </Button>
              <Button variant="gold" size="md" loading={busy} onClick={() => void doConfirmCash()}>
                <Banknote className="h-4 w-4" />
                Confirm Cash Payment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        size="md"
        title={`Reject payment #${rejecting?.id ?? ''}`}
      >
        <div>
          <p className="text-sm text-night-400">
            Rejecting will return this customer to the payment step so they can re-upload a
            receipt. Please explain why so they can fix it.
          </p>
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
              Reason
            </span>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. Receipt is unclear, please upload a readable image."
              className="field resize-none"
            />
          </label>
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" size="md" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="dark" size="md" loading={busy} onClick={() => void doReject()}>
              Reject Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PaymentDetail({ payment }: { payment: PaymentItem }) {
  const appointment = payment.appointment
  const rows: Array<{ label: string; value: string }> = []
  if (appointment) {
    rows.push({ label: 'Appointment', value: `#${appointment.referenceCode ?? appointment.id}` })
    rows.push({ label: 'Customer', value: appointment.customerName })
    if (appointment.customerPhone) rows.push({ label: 'Phone', value: appointment.customerPhone })
    if (appointment.customerEmail) rows.push({ label: 'Email', value: appointment.customerEmail })
    rows.push({
      label: 'Appointment',
      value: `${formatDate(appointment.appointmentDate)} · ${appointment.appointmentTime}`,
    })
    if (appointment.service) {
      rows.push({
        label: 'Service',
        value: `${appointment.service.name} · ${formatPrice(appointment.service.price)}`,
      })
    }
    if (appointment.barber) rows.push({ label: 'Barber', value: appointment.barber.name })
  }
  rows.push({
    label: 'Status',
    value: `${PAYMENT_STATUS_LABELS[payment.status]} (${payment.status})`,
  })
  if (payment.paymentMethod) {
    rows.push({ label: 'Method', value: PAYMENT_METHOD_LABELS[payment.paymentMethod] })
  }
  if (payment.transactionReference) rows.push({ label: 'Reference', value: payment.transactionReference })
  if (payment.paymentDate) rows.push({ label: 'Payment date', value: formatDate(payment.paymentDate) })
  if (payment.verifiedAt) {
    rows.push({
      label: 'Verified at',
      value: new Date(payment.verifiedAt).toLocaleString('en-GB'),
    })
  }
  if (payment.rejectionReason) rows.push({ label: 'Rejection reason', value: payment.rejectionReason })

  return (
    <div>
      {payment.receiptUrl && (
        <div className="mb-5 overflow-hidden rounded-xl border border-night-700">
          <SmartImage
            src={payment.receiptUrl}
            alt="Payment receipt"
            className="max-h-96 w-full object-cover"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-night-800 bg-night-900/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
            Amount
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-gold-300">
            {formatPrice(payment.amount)}
          </p>
          {appointment && appointment.totalAmount !== payment.amount && (
            <p className="text-xs text-night-500">Expected {formatPrice(appointment.totalAmount)}</p>
          )}
        </div>
        <div className="rounded-xl border border-night-800 bg-night-900/60 p-4">
          <StatusBadge status={payment.status} />
          {payment.note && (
            <p className="mt-3 text-xs leading-relaxed text-night-300">
              <span className="font-semibold text-night-400">Note: </span>
              {payment.note}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 border-b border-night-800/70 pb-2">
            <dt className="text-xs font-semibold uppercase tracking-widest text-night-500">
              {row.label}
            </dt>
            <dd className="text-sm font-medium break-words text-right text-night-100">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}