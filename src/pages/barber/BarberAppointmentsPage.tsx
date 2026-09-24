import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange } from 'lucide-react'
import { fetchPortalAppointments, updatePortalAppointmentStatus, type PortalAppointment } from '../../api/barberPortal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
] as const

const STATUS_STYLE: Record<string, string> = {
  PAYMENT_REQUIRED: 'bg-night-800 text-night-300',
  PAYMENT_SUBMITTED: 'bg-amber-500/15 text-amber-300',
  PAYMENT_VERIFIED: 'bg-emerald-500/15 text-emerald-300',
  READY_FOR_SERVICE: 'bg-gold-500/15 text-gold-300',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-300',
  COMPLETED: 'bg-emerald-500/15 text-emerald-300',
  CANCELLED: 'bg-red-500/15 text-red-300',
}

const STATUS_LABEL: Record<string, string> = {
  PAYMENT_REQUIRED: 'Awaiting payment',
  PAYMENT_SUBMITTED: 'Verifying payment',
  PAYMENT_VERIFIED: 'Payment verified',
  READY_FOR_SERVICE: 'Ready to start',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function BarberAppointmentsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('today')
  const [items, setItems] = useState<PortalAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const t = todayKey()
    try {
      const data =
        tab === 'today'
          ? await fetchPortalAppointments({ from: t, to: t, perPage: 100 })
          : tab === 'upcoming'
            ? await fetchPortalAppointments({ from: t, perPage: 100 })
            : await fetchPortalAppointments({ to: t, perPage: 100 })
      let rows = data.items
      if (tab === 'upcoming') rows = rows.filter((a) => a.appointmentDate > t && a.status !== 'CANCELLED')
      if (tab === 'past') rows = rows.filter((a) => a.appointmentDate < t || a.status === 'COMPLETED' || a.status === 'CANCELLED')
      rows = rows.sort((a, b) =>
        tab === 'past'
          ? b.appointmentDate.localeCompare(a.appointmentDate) || b.appointmentTime.localeCompare(a.appointmentTime)
          : a.appointmentDate.localeCompare(b.appointmentDate) || a.appointmentTime.localeCompare(b.appointmentTime),
      )
      setItems(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (id: number, to: 'IN_PROGRESS' | 'COMPLETED') => {
    setBusyId(id)
    try {
      await updatePortalAppointmentStatus(id, to)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-night-50">My Appointments</h1>
        <Link
          to="/barber/day-view"
          className="inline-flex items-center gap-2 rounded-lg border border-night-700 bg-night-900/60 px-3 py-2 text-xs font-medium text-night-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
        >
          <CalendarRange className="h-4 w-4" />
          Day view
        </Link>
      </div>

      <div className="flex gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === key ? 'bg-gold-500 text-night-950' : 'bg-night-800 text-night-300 hover:text-night-100',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-night-800 bg-night-900/50 px-4 py-12 text-center text-sm text-night-500">
          No {tab} appointments.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-night-800 bg-night-900/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-night-50">{a.customerName}</p>
                    <span className="rounded bg-night-800 px-2 py-0.5 text-[10px] font-mono text-night-400">
                      {a.referenceCode ?? `#${a.id}`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-night-400">
                    {a.appointmentDate} · {a.appointmentTime} · {a.service?.name ?? 'Service'}
                  </p>
                  <p className="text-sm text-night-400">
                    {formatPrice(a.totalAmount)}
                    {a.customerPhone && <> · <a href={`tel:${a.customerPhone}`} className="text-gold-400">{a.customerPhone}</a></>}
                  </p>
                </div>
                <span className={cn('rounded-full px-3 py-1 text-[11px] font-medium', STATUS_STYLE[a.status] ?? 'bg-night-800 text-night-300')}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
              </div>

              {(a.status === 'READY_FOR_SERVICE' || a.status === 'IN_PROGRESS') && (
                <div className="mt-3 flex gap-2">
                  {a.status === 'READY_FOR_SERVICE' && (
                    <button
                      onClick={() => act(a.id, 'IN_PROGRESS')}
                      disabled={busyId === a.id}
                      className="rounded-lg bg-gold-500 px-4 py-2 text-xs font-semibold text-night-950 hover:bg-gold-400 disabled:opacity-60"
                    >
                      {busyId === a.id ? 'Starting…' : 'Start service'}
                    </button>
                  )}
                  {a.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => act(a.id, 'COMPLETED')}
                      disabled={busyId === a.id}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-night-950 hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {busyId === a.id ? 'Saving…' : 'Mark completed'}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
