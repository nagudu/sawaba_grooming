import { useEffect, useMemo, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import {
  api,
  buildQuery,
  type AppointmentItem,
  type AppointmentStatus,
  type Paged,
  type PaymentStatus,
} from '../../api'
import { ConfirmDialog, EmptyRow, PageHeader, StatusBadge, Td, Th } from '../../components/admin/AdminUI'
import { Button, buttonClasses } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { useToast } from '../../components/ui/ToastNotification'
import { useDebounced } from '../../hooks/useDebounced'
import {
  ALL_APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  getStatusActionLabel,
  getValidNextStatuses,
} from '../../config/appointmentStatuses'
import { cn } from '../../utils/cn'
import { formatDate } from '../../utils/format'

/** Convert HH:mm (24h) → h:mm AM/PM */
function formatTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!match) return time
  const hours = Number(match[1])
  const minutes = match[2]
  const period = hours >= 12 ? 'PM' : 'AM'
  const display = hours % 12 === 0 ? 12 : hours % 12
  return `${display}:${minutes} ${period}`
}

/** Payment statuses that let an appointment move into service states. */
function paymentCoversCost(payment: AppointmentItem['payment']): boolean {
  return !payment || payment.status === 'PAID'
}

function optionDisabled(appointment: AppointmentItem, option: AppointmentStatus): string | undefined {
  if (option === appointment.status) return undefined
  if (!getValidNextStatuses(appointment.status).includes(option)) {
    return 'Not a valid next step from the current status'
  }
  if (
    (option === 'PAYMENT_VERIFIED' || option === 'READY_FOR_SERVICE') &&
    !paymentCoversCost(appointment.payment)
  ) {
    return 'Verify this payment first (Payments page) before moving to service'
  }
  return undefined
}

function paymentChip(status: PaymentStatus): string {
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

export default function AdminAppointmentsPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<AppointmentItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const perPage = 15
  const debouncedSearch = useDebounced(search.trim(), 300)

  const load = async (targetPage = page, targetStatus = statusFilter, query = search) => {
    setLoading(true)
    try {
      const data = await api.get<Paged<AppointmentItem>>(
        `/api/appointments${buildQuery({
          page: targetPage,
          perPage,
          status: targetStatus,
          search: query || undefined,
        })}`,
      )
      setAppointments(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, statusFilter, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const selectStatus = (value: string) => {
    setStatusFilter(value)
    void load(1, value, search)
  }

  // Each call pins the exact appointment id + requested status it started with, so rapid
  // clicks on different rows can never apply one appointment's result to another.
  const changeStatus = async (appointment: AppointmentItem, status: AppointmentStatus) => {
    if (status === appointment.status) return
    const appointmentId = appointment.id
    setBusyId(appointmentId)
    try {
      const updated = await api.patch<AppointmentItem>(
        `/api/appointments/${appointmentId}/status`,
        { status },
      )
      showToast(
        `Appointment for ${updated.customerName} is now ${APPOINTMENT_STATUS_LABELS[updated.status]}.`,
      )
      // Update this row immediately from the authoritative response…
      setAppointments((items) =>
        items.map((item) => (item.id === appointmentId ? { ...item, ...updated } : item)),
      )
      // …then re-sync the list (fresh payment record, counts, current page).
      void load(page, statusFilter, debouncedSearch)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusyId(null)
    }
  }

  const reactivate = async (appointment: AppointmentItem) => {
    setBusyId(appointment.id)
    try {
      await api.post(`/api/appointments/${appointment.id}/reactivate`)
      showToast('Appointment reactivated.')
      void load(page, statusFilter, debouncedSearch)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.del(`/api/appointments/${deleting.id}`)
      setAppointments((items) => items.filter((item) => item.id !== deleting.id))
      setTotal((count) => count - 1)
      showToast('Appointment deleted.')
      setDeleting(null)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage])

  return (
    <div>
      <PageHeader title="Appointments" subtitle="Manage and track all booking requests." />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="field-icon h-4 w-4" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void load(1, statusFilter, event.currentTarget.value)
            }}
            placeholder="Search by customer name, phone or email..."
            className="field pl-11"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => selectStatus('')}
            className={cn(
              buttonClasses('outline', 'md'),
              statusFilter === '' && 'border-gold-500/60 text-gold-300',
            )}
          >
            All
          </button>                          {ALL_APPOINTMENT_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => selectStatus(status)}
              className={cn(
                buttonClasses('outline', 'md'),
                statusFilter === status && 'border-gold-500/60 text-gold-300',
              )}
            >
              {APPOINTMENT_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="card-lux overflow-hidden">
        <div className="flex items-center justify-between border-b border-night-800 px-6 py-4">
          <h2 className="font-display text-lg text-night-50">
            {total} appointment{total === 1 ? '' : 's'}
          </h2>
          <span className="text-xs text-night-500">Page {page} of {totalPages}</span>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading appointments" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Customer</Th>
                  <Th>Service</Th>
                  <Th>Barber</Th>
                  <Th>Date</Th>
                  <Th>Time</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {appointments.length === 0 ? (
                  <EmptyRow colSpan={7} message="No appointments match your filters." />
                ) : (
                  appointments.map((appointment) => (
                    <tr key={appointment.id} className="transition-colors hover:bg-night-900/60">
                      <Td>
                        <p className="font-semibold text-night-100">{appointment.customerName}</p>
                        <p className="text-xs text-night-500">
                          #{appointment.referenceCode ?? appointment.id} · {appointment.customerPhone}
                        </p>
                      </Td>
                      <Td>
                        {appointment.service?.name ?? '—'}
                        <p className="text-xs text-night-500">
                          ₦{appointment.service?.price?.toLocaleString() ?? ''} ·{' '}
                          {appointment.service?.duration ?? ''} min
                        </p>
                      </Td>
                      <Td>{appointment.barber?.name ?? '—'}</Td>
                      <Td>{formatDate(appointment.appointmentDate)}</Td>
                      <Td>{formatTime(appointment.appointmentTime)}</Td>
                      <Td>
                        <div className="space-y-1.5">
                          <StatusBadge
                            status={appointment.status}
                            label={APPOINTMENT_STATUS_LABELS[appointment.status]}
                          />
                          {appointment.payment && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
                                paymentChip(appointment.payment.status),
                              )}
                            >
                              ₦{appointment.payment.amount.toLocaleString()} ·{' '}
                              {appointment.payment.status.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {appointment.status === 'CANCELLED' ? (
                            <>
                              <span
                                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300"
                                title="Reactivate before changing its status"
                              >
                                Cancelled — locked
                              </span>
                              <button
                                type="button"
                                disabled={busyId === appointment.id}
                                onClick={() => void reactivate(appointment)}
                                className="rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-300 transition-colors hover:bg-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {busyId === appointment.id ? 'Reactivating…' : 'Reactivate'}
                              </button>
                            </>
                          ) : (
                            <select
                              key={appointment.id}
                              value={appointment.status}
                              disabled={busyId === appointment.id}
                              onChange={(event) => {
                                const next = event.target.value as AppointmentStatus
                                if (next !== appointment.status) {
                                  void changeStatus(appointment, next)
                                }
                              }}
                              className="rounded-lg border border-night-700 bg-night-900 px-2.5 py-1.5 text-xs font-semibold text-night-200 focus:border-gold-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value={appointment.status} disabled className="text-night-500">
                                {APPOINTMENT_STATUS_LABELS[appointment.status]}
                              </option>
                              {getValidNextStatuses(appointment.status).map((option) => (
                                <option
                                  key={option}
                                  value={option}
                                  disabled={Boolean(optionDisabled(appointment, option))}
                                  title={optionDisabled(appointment, option)}
                                >
                                  {getStatusActionLabel(appointment.status, option)}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleting(appointment)}
                            disabled={busyId === appointment.id}
                            aria-label="Delete appointment"
                            className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title="Delete appointment"
        description={`Are you sure you want to permanently delete the appointment for ${deleting?.customerName ?? ''}? This action cannot be undone.`}
      />
    </div>
  )
}