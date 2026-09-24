import { useCallback, useEffect, useState } from 'react'
import { fetchPortalEarnings, type PortalEarning } from '../../api/barberPortal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { formatPrice } from '../../utils/format'
import { useBarberAuth } from '../../store/barberAuth'
import { cn } from '../../utils/cn'

const FILTERS = ['ALL', 'PENDING', 'EARNED', 'PAID'] as const

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-night-800 text-night-300',
  EARNED: 'bg-emerald-500/15 text-emerald-300',
  PAID: 'bg-gold-500/15 text-gold-300',
  CANCELLED: 'bg-red-500/15 text-red-300',
}

export default function BarberEarningsPage() {
  const { barber } = useBarberAuth()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')
  const [items, setItems] = useState<PortalEarning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPortalEarnings({
        earningStatus: filter === 'ALL' ? undefined : filter,
        perPage: 100,
      })
      setItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load earnings.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const commissionLabel =
    barber?.commissionType === 'FIXED'
      ? `${formatPrice(barber.commissionValue)} fixed`
      : `${barber?.commissionValue ?? 0}%`

  const totalEarned = items.filter((e) => e.status === 'EARNED' || e.status === 'PAID').reduce((s, e) => s + e.commissionAmount, 0)
  const pending = items.filter((e) => e.status === 'PENDING').reduce((s, e) => s + e.commissionAmount, 0)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold text-night-50">My Earnings</h1>
        <span className="rounded-full bg-night-800 px-3 py-1 text-xs font-medium text-night-300">
          Commission: {commissionLabel}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-night-800 bg-night-900/60 p-4">
          <p className="text-[11px] uppercase tracking-wider text-night-500">Earned (listed)</p>
          <p className="mt-1 font-display text-lg font-semibold text-emerald-300">{formatPrice(totalEarned)}</p>
        </div>
        <div className="rounded-xl border border-night-800 bg-night-900/60 p-4">
          <p className="text-[11px] uppercase tracking-wider text-night-500">Awaiting payment</p>
          <p className="mt-1 font-display text-lg font-semibold text-night-100">{formatPrice(pending)}</p>
        </div>
        <div className="rounded-xl border border-night-800 bg-night-900/60 p-4">
          <p className="text-[11px] uppercase tracking-wider text-night-500">Records</p>
          <p className="mt-1 font-display text-lg font-semibold text-night-100">{items.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-medium transition-colors',
              filter === f ? 'bg-gold-500 text-night-950' : 'bg-night-800 text-night-300 hover:text-night-100',
            )}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
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
          No earnings records yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => (
            <li key={e.id} className="rounded-xl border border-night-800 bg-night-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-night-50">
                    {formatPrice(e.commissionAmount)}
                    <span className="ml-2 text-xs font-normal text-night-500">
                      of {formatPrice(e.serviceAmount)} · {e.commissionRateSnapshot}{e.commissionType === 'PERCENTAGE' ? '%' : ' (fixed)'}
                    </span>
                  </p>
                  <p className="text-sm text-night-400">
                    {e.referenceCode ?? `Appointment #${e.appointmentId}`} · {e.appointmentDate} · {e.customerName}
                  </p>
                </div>
                <span className={cn('rounded-full px-3 py-1 text-[11px] font-medium', STATUS_STYLE[e.status] ?? '')}>
                  {e.status}
                </span>
              </div>
              {e.paidAt && (
                <p className="mt-1 text-[11px] text-night-600">Paid out {new Date(e.paidAt).toLocaleDateString()}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
