import { useEffect, useState } from 'react'
import { CalendarCheck, CalendarDays, Clock, Wallet, Banknote } from 'lucide-react'
import {
  fetchPortalOverview,
  updatePortalAppointmentStatus,
  type PortalOverview,
} from '../../api/barberPortal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useBarberAuth } from '../../store/barberAuth'
import { formatPrice as formatNaira } from '../../utils/format'

const STATUS_LABEL: Record<string, string> = {
  PAYMENT_REQUIRED: 'Awaiting payment',
  PAYMENT_SUBMITTED: 'Verifying payment',
  PAYMENT_VERIFIED: 'Payment verified',
  READY_FOR_SERVICE: 'Ready',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export default function BarberDashboardPage() {
  const { barber } = useBarberAuth()
  const [overview, setOverview] = useState<PortalOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setOverview(await fetchPortalOverview())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const startOrComplete = async (id: number, to: 'IN_PROGRESS' | 'COMPLETED') => {
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

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>
  if (!overview) return <p className="py-20 text-center text-night-400">{error ?? 'Dashboard unavailable.'}</p>

  const commissionLabel =
    overview.commissionType === 'PERCENTAGE'
      ? `${overview.commissionValue}%`
      : formatNaira(overview.commissionValue)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-night-50">
          Welcome back, {barber?.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-night-400">Here's your day at a glance.</p>
      </header>

      {/* Stat cards — mobile: 2 cols, desktop: 4 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Today" value={String(overview.todayCount)} />
        <StatCard icon={Clock} label="Upcoming" value={String(overview.daysUpcomingCount)} />
        <StatCard icon={Banknote} label="Today's earnings" value={formatNaira(overview.todayEarnings)} />
        <StatCard icon={Wallet} label="Pending commission" value={formatNaira(overview.pendingCommission)} />
        <StatCard icon={CalendarCheck} label="Completed" value={String(overview.completedCount)} />
        <StatCard icon={Clock} label="Awaiting start" value={String(overview.pendingCount)} />
        <StatCard icon={Wallet} label="This month" value={formatNaira(overview.monthEarnings)} />
        <StatCard icon={Banknote} label="Commission rate" value={commissionLabel} />
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {/* Due soon */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-night-400">Today's queue</h2>
        {overview.dueSoon.length === 0 ? (
          <p className="rounded-xl border border-night-800 bg-night-900/50 px-4 py-8 text-center text-sm text-night-500">
            No appointments waiting right now.
          </p>
        ) : (
          <ul className="space-y-3">
            {overview.dueSoon.map((a) => (
              <li key={a.id} className="rounded-xl border border-night-800 bg-night-900/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-night-50">{a.customerName}</p>
                    <p className="text-sm text-night-400">
                      {a.appointmentTime} · {a.service?.name ?? 'Service'} · {formatNaira(a.totalAmount)}
                    </p>
                  </div>
                  <span className="rounded-full bg-night-800 px-3 py-1 text-[11px] font-medium text-night-300">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  {a.status === 'READY_FOR_SERVICE' && (
                    <button
                      onClick={() => startOrComplete(a.id, 'IN_PROGRESS')}
                      disabled={busyId === a.id}
                      className="rounded-lg bg-gold-500 px-4 py-2 text-xs font-semibold text-night-950 transition hover:bg-gold-400 disabled:opacity-60"
                    >
                      {busyId === a.id ? 'Starting…' : 'Start service'}
                    </button>
                  )}
                  {a.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => startOrComplete(a.id, 'COMPLETED')}
                      disabled={busyId === a.id}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-night-950 transition hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {busyId === a.id ? 'Saving…' : 'Mark completed'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent notifications */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-night-400">Recent activity</h2>
        {overview.notifications.length === 0 ? (
          <p className="rounded-xl border border-night-800 bg-night-900/50 px-4 py-8 text-center text-sm text-night-500">
            Nothing new yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {overview.notifications.map((n) => (
              <li key={n.id} className="rounded-xl border border-night-800 bg-night-900/60 px-4 py-3">
                <p className="text-sm font-semibold text-night-100">{n.title}</p>
                <p className="text-sm text-night-400">{n.message}</p>
                <p className="mt-1 text-[11px] text-night-600">
                  {new Date(n.createdAt).toLocaleString()}
                  {!n.readAt && <span className="ml-2 text-gold-400">● new</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-night-800 bg-night-900/60 p-4">
      <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-[11px] uppercase tracking-wider text-night-500">{label}</p>
      <p className="mt-0.5 truncate font-display text-lg font-semibold text-night-50">{value}</p>
    </div>
  )
}
