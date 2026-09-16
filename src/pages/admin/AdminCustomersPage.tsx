import { useEffect, useState } from 'react'
import { BellRing, Pencil, Search, Users } from 'lucide-react'
import { api, buildQuery, type Paged } from '../../api'
import { EmptyRow, Field, PageHeader, Td, Th } from '../../components/admin/AdminUI'
import { Button } from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { useDebounced } from '../../hooks/useDebounced'
import { useToast } from '../../components/ui/ToastNotification'
import { formatPrice } from '../../utils/format'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

interface CustomerStats {
  totalAppointments: number
  completed: number
  cancelled: number
  pending: number
  totalSpent: number
}

interface CustomerListItem {
  id: number
  customerCode: string
  fullName: string
  phone: string
  email: string | null
  isActive: boolean
  createdAt: string
  stats: CustomerStats
  lastVisit: {
    id: number
    date: string
    status: string
    serviceName: string | null
    barberName: string | null
  } | null
}

interface CustomerDetail {
  customer: {
    id: number
    customerCode: string
    fullName: string
    phone: string
    email: string | null
    avatarUrl: string | null
    reminderOptIn: boolean
    isActive: boolean
    createdAt: string
    lastLoginAt: string | null
  }
  stats: CustomerStats
  upcoming: AppointmentItem | null
  appointments: AppointmentItem[]
  favoriteServices: Array<{ serviceId: number; name: string; count: number }>
}

interface AppointmentItem {
  id: number
  referenceCode: string | null
  appointmentDate: string
  appointmentTime: string
  status: string
  service?: { name: string } | null
  barber?: { name: string } | null
  payment?: { status: string; amount: number | string } | null
}

const perPage = 12

export default function AdminCustomersPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ fullName: '', email: '', reminderOptIn: false })
  const [saving, setSaving] = useState(false)
  const [reminding, setReminding] = useState(false)

  const debouncedSearch = useDebounced(search.trim(), 300)

  const load = async (targetPage = page, query = search) => {
    setLoading(true)
    try {
      const data = await api.get<Paged<CustomerListItem>>(
        `/api/admin/customers${buildQuery({ page: targetPage, perPage, search: query || undefined })}`,
      )
      setCustomers(data.items)
      setTotal(data.total)
      setPage(data.page)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const openDetail = async (id: number) => {
    setDetailLoading(true)
    setDetail(null)
    try {
      const data = await api.get<CustomerDetail>(`/api/admin/customers/${id}`)
      setDetail(data)
    } catch (error) {
      notifyError(error)
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleActive = async (customer: CustomerListItem) => {
    try {
      await api.patch(`/api/admin/customers/${customer.id}`, { isActive: !customer.isActive })
      setCustomers((items) =>
        items.map((item) => (item.id === customer.id ? { ...item, isActive: !item.isActive } : item)),
      )
      showToast(customer.isActive ? `${customer.fullName} deactivated.` : `${customer.fullName} reactivated.`)
    } catch (error) {
      notifyError(error)
    }
  }

  const openEdit = () => {
    if (!detail) return
    setEditForm({
      fullName: detail.customer.fullName,
      email: detail.customer.email ?? '',
      reminderOptIn: detail.customer.reminderOptIn,
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!detail) return
    setSaving(true)
    try {
      await api.patch(`/api/admin/customers/${detail.customer.id}`, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim() || null,
        reminderOptIn: editForm.reminderOptIn,
      })
      showToast('Customer updated.')
      setEditOpen(false)
      await load()
      await openDetail(detail.customer.id)
    } catch (error) {
      notifyError(error)
    } finally {
      setSaving(false)
    }
  }

  const sendReminders = async () => {
    setReminding(true)
    try {
      const result = await api.post<{ sent: number; skipped: number }>(
        '/api/admin/customers/reminders/due',
        {},
      )
      showToast(
        result.sent > 0
          ? `Reminders sent to ${result.sent} customer${result.sent === 1 ? '' : 's'} (${result.skipped} not due).`
          : `No customers are due for a reminder right now (${result.skipped} checked).`,
        result.sent > 0 ? 'success' : 'info',
      )
    } catch (error) {
      notifyError(error)
    } finally {
      setReminding(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Every customer account, their visits, spending and booking history."
        action={
          <Button variant="outline" size="md" loading={reminding} onClick={() => void sendReminders()}>
            <BellRing className="h-4 w-4" /> Send due reminders
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="field pl-9"
            placeholder="Search name, phone, email or CUS-code…"
          />
        </div>
        <p className="text-xs text-night-500">
          {total} customer{total === 1 ? '' : 's'}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-night-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-night-900/80 text-[11px] uppercase tracking-[0.14em] text-night-500">
              <tr>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th>Visits</Th>
                <Th>Total spent</Th>
                <Th>Last visit</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-night-800 bg-night-950">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <LoadingSpinner className="mx-auto h-7 w-7 text-gold-500" />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <EmptyRow colSpan={6} message="No customers found." />
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer transition-colors hover:bg-night-900/60"
                    onClick={() => void openDetail(customer.id)}
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-night-700 bg-night-900 text-sm font-bold text-gold-400">
                          {customer.fullName.charAt(0)}
                        </span>
                        <div>
                          <p className="font-semibold text-night-100">{customer.fullName}</p>
                          <p className="font-mono text-xs text-gold-400/80">{customer.customerCode}</p>
                          {customer.email && <p className="text-xs text-night-500">{customer.email}</p>}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-night-300">{customer.phone}</Td>
                    <Td>
                      <span className="font-semibold text-night-100">{customer.stats.totalAppointments}</span>
                      <span className="ml-2 text-xs text-night-500">
                        ({customer.stats.completed} done
                        {customer.stats.cancelled > 0 ? `, ${customer.stats.cancelled} cancel` : ''})
                      </span>
                    </Td>
                    <Td className="font-semibold text-gold-300">{formatPrice(customer.stats.totalSpent)}</Td>
                    <Td>
                      {customer.lastVisit ? (
                        <div>
                          <p className="text-night-200">{formatDate(customer.lastVisit.date)}</p>
                          <p className="text-xs text-night-500">
                            {customer.lastVisit.serviceName ?? '—'} · {customer.lastVisit.status}
                          </p>
                        </div>
                      ) : (
                        <span className="text-night-500">—</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div
                        className="flex items-center justify-end gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => void toggleActive(customer)}
                          className={cn(
                            'inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors',
                            customer.isActive
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-night-600 bg-night-800 text-night-400 hover:border-gold-500/40 hover:text-gold-300',
                          )}
                        >
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void openDetail(customer.id)}
                          aria-label="View customer"
                          className="rounded-lg border border-night-700 p-2 text-night-500 transition-colors hover:border-gold-500/40 hover:text-gold-300"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-night-400">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => void load(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
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

      <Modal open={detailLoading || detail !== null} onClose={() => setDetail(null)} title="Customer details">
        {detailLoading || !detail ? (
          <div className="py-14 text-center">
            <LoadingSpinner className="mx-auto h-8 w-8 text-gold-500" />
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-night-800 bg-night-900/50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 text-lg font-bold text-gold-400">
                  {detail.customer.fullName.charAt(0)}
                </span>
                <div>
                  <p className="font-display text-lg text-night-50">{detail.customer.fullName}</p>
                  <p className="font-mono text-xs text-gold-400/80">{detail.customer.customerCode}</p>
                  <p className="text-xs text-night-500">
                    {detail.customer.phone}
                    {detail.customer.email ? ` · ${detail.customer.email}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-night-500">
                    Member since{' '}
                    {new Date(detail.customer.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {detail.customer.lastLoginAt
                      ? ` · last login ${new Date(detail.customer.lastLoginAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
                    detail.customer.isActive
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-night-600 bg-night-800 text-night-400',
                  )}
                >
                  {detail.customer.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="text-[11px] text-night-500">
                  Reminders: {detail.customer.reminderOptIn ? 'opted in' : 'off'}
                </span>
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="h-3.5 w-3.5" /> Edit profile
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total visits', value: detail.stats.totalAppointments },
                { label: 'Completed', value: detail.stats.completed },
                { label: 'Cancelled', value: detail.stats.cancelled },
                { label: 'Pending', value: detail.stats.pending },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-night-800 bg-night-900/50 p-3 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">{stat.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold text-night-50">{stat.value}</p>
                </div>
              ))}
              <div className="col-span-2 rounded-xl border border-gold-500/30 bg-gold-500/5 p-3 text-center sm:col-span-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Total spent</p>
                <p className="mt-1 font-display text-2xl font-bold text-gold-300">
                  {formatPrice(detail.stats.totalSpent)}
                </p>
              </div>
            </div>

            {detail.upcoming && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
                  Upcoming appointment
                </p>
                <p className="mt-1 font-semibold text-night-100">
                  {detail.upcoming.service?.name ?? 'Service'} · {formatDate(detail.upcoming.appointmentDate)} at{' '}
                  {detail.upcoming.appointmentTime}
                </p>
                <p className="text-xs text-night-500">
                  #{detail.upcoming.referenceCode ?? detail.upcoming.id} ·{' '}
                  {detail.upcoming.barber?.name ?? 'Any barber'} · status {detail.upcoming.status}
                </p>
              </div>
            )}

            {detail.favoriteServices.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                  Favorite services
                </p>
                <div className="flex flex-wrap gap-2">
                  {detail.favoriteServices.map((favorite: { serviceId: number; name: string; count: number }) => (
                    <span
                      key={favorite.serviceId}
                      className="rounded-full border border-night-700 bg-night-900 px-3 py-1 text-xs text-night-200"
                    >
                      {favorite.name} · {favorite.count}×
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                Booking history ({detail.appointments.length})
              </p>
              {detail.appointments.length === 0 ? (
                <p className="rounded-xl border border-night-800 bg-night-900/40 p-4 text-sm text-night-500">
                  No appointments yet.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-night-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-night-900/80 uppercase tracking-wider text-night-500">
                      <tr>
                        <Th>Date</Th>
                        <Th>Service</Th>
                        <Th>Barber</Th>
                        <Th>Amount</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-night-800">
                      {detail.appointments.map((appointment) => (
                        <tr key={appointment.id}>
                          <Td className="text-night-300">{formatDate(appointment.appointmentDate)}</Td>
                          <Td className="text-night-200">{appointment.service?.name ?? '—'}</Td>
                          <Td className="text-night-400">{appointment.barber?.name ?? 'Any'}</Td>
                          <Td className="text-gold-300">
                            {appointment.payment ? formatPrice(Number(appointment.payment.amount)) : '—'}
                          </Td>
                          <Td>
                            <span className="text-night-300">{appointment.status}</span>
                            {appointment.payment && appointment.payment.status !== 'UNPAID' && (
                              <span className="ml-1 text-[10px] text-night-500">({appointment.payment.status})</span>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit customer">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void saveEdit()
          }}
        >
          <Field label="Full name">
            <input
              value={editForm.fullName}
              onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })}
              className="field"
              required
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={editForm.email}
              onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
              className="field"
              placeholder="customer@example.com"
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={editForm.reminderOptIn}
              onChange={(event) => setEditForm({ ...editForm, reminderOptIn: event.target.checked })}
              className="h-4 w-4 accent-gold-500"
            />
            <span className="text-sm text-night-300">Booking reminders opted in</span>
          </label>
          <p className="text-xs text-night-500">
            Phone is the customer&apos;s identity anchor and cannot be changed here.
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" size="md" type="button" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="gold" size="md" type="submit" loading={saving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <div className="flex items-center gap-2 text-xs text-night-500">
        <Users className="h-3.5 w-3.5" /> Searching matches name, phone (any format), email and CUS-code.
      </div>
    </div>
  )
}
