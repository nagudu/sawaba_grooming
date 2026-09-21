import { useEffect, useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'
import { api, buildQuery, type Paged } from '../../api'
import { EmptyRow, PageHeader, StatusBadge, Td, Th } from '../../components/admin/AdminUI'
import { Button, buttonClasses } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { cn } from '../../utils/cn'

/**
 * Admin → Barber Earnings (requirement #11, #17, #18).
 * Commission data is admin-only and comes exclusively from the backend
 * snapshot ledger — the public site never sees any of this.
 */

interface EarningRow {
  id: number
  appointmentId: number
  referenceCode: string | null
  appointmentDate: string
  customerName: string
  customerLocation: string | null
  barberId: number
  barberName: string | null
  barberTypeSnapshot: 'INTERNAL' | 'EXTERNAL'
  barberLocation: string | null
  commissionType: 'PERCENTAGE' | 'FIXED'
  commissionRateSnapshot: number
  serviceAmount: number
  commissionAmount: number
  studioAmount: number
  status: 'PENDING' | 'EARNED' | 'PAID' | 'CANCELLED'
  paidAt: string | null
}

interface SummaryRow {
  barberId: number
  barberName: string
  barberType: 'INTERNAL' | 'EXTERNAL'
  barberLocation: string | null
  totalAppointments: number
  totalServiceRevenue: number
  totalCommission: number
  studioRevenue: number
  paidCommission: number
  pendingCommission: number
}

interface ReportTotals {
  totals: {
    barberRevenue: number
    internalCommission: number
    externalCommission: number
    paidCommission: number
    pendingCommission: number
    studioRevenue: number
  }
}

const naira = (n: number) => `₦${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

function dateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function AdminBarberEarningsPage() {
  const { notifyError } = useAuthErrorToast()

  const [rows, setRows] = useState<EarningRow[]>([])
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [totals, setTotals] = useState<ReportTotals['totals'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<number | null>(null)

  // Filters (#17, #18)
  const [barberType, setBarberType] = useState<'' | 'INTERNAL' | 'EXTERNAL'>('')
  const [location, setLocation] = useState('')
  const [status, setStatus] = useState<'' | EarningRow['status']>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filters = useMemo(
    () => ({
      barberType: barberType || undefined,
      location: location.trim() || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [barberType, location, status, from, to],
  )

  const load = async () => {
    setLoading(true)
    try {
      const qs = buildQuery({ ...filters, perPage: 50 })
      const [list, sum, rep] = await Promise.all([
        api.get<Paged<EarningRow>>(`/api/admin/barber-earnings${qs}`),
        api.get<SummaryRow[]>(`/api/admin/barber-earnings/summary${qs}`),
        api.get<ReportTotals>(`/api/admin/barber-earnings/report${qs}`),
      ])
      setRows(list.items)
      setSummary(sum)
      setTotals(rep.totals)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberType, status, from, to])

  const applyPreset = (kind: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date()
    if (kind === 'all') {
      setFrom('')
      setTo('')
      return
    }
    if (kind === 'today') {
      setFrom(dateInput(now))
      setTo(dateInput(now))
      return
    }
    if (kind === 'week') {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      setFrom(dateInput(start))
      setTo(dateInput(now))
      return
    }
    setFrom(dateInput(new Date(now.getFullYear(), now.getMonth(), 1)))
    setTo(dateInput(now))
  }

  const markPaid = async (row: EarningRow) => {
    setMarkingId(row.id)
    try {
      const updated = await api.post<EarningRow>(`/api/admin/barber-earnings/${row.id}/paid`, {})
      setRows((items) => items.map((item) => (item.id === row.id ? { ...item, ...updated } : item)))
      void load()
    } catch (error) {
      notifyError(error)
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Barber Earnings"
        subtitle="Commission ledger per barber — snapshots are frozen at booking time, so later rate changes never rewrite history."
      />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={barberType}
            onChange={(e) => setBarberType(e.target.value as '' | 'INTERNAL' | 'EXTERNAL')}
            className="field"
            aria-label="Filter by barber type"
          >
            <option value="">All types</option>
            <option value="INTERNAL">Internal</option>
            <option value="EXTERNAL">External</option>
          </select>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
            placeholder="Location — e.g. Jigawa"
            className="field"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | EarningRow['status'])}
            className="field"
            aria-label="Filter by commission status"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="EARNED">Earned</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field" aria-label="From date" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field" aria-label="To date" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['today', 'Today'],
              ['week', 'This Week'],
              ['month', 'This Month'],
              ['all', 'All Time'],
            ] as const
          ).map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => applyPreset(kind)} className={buttonClasses('outline', 'sm')}>
              {label}
            </button>
          ))}
          <Button variant="gold" size="sm" onClick={() => void load()}>Apply</Button>
        </div>
      </div>

      {/* Report totals (#18) */}
      {totals && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ['Barber Revenue', totals.barberRevenue],
            ['Internal Commission', totals.internalCommission],
            ['External Commission', totals.externalCommission],
            ['Paid Commission', totals.paidCommission],
            ['Pending Commission', totals.pendingCommission],
            ['Studio Revenue', totals.studioRevenue],
          ].map(([label, value]) => (
            <div key={label as string} className="card-lux p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">{label}</p>
              <p className="mt-1 font-display text-xl text-night-50">{naira(value as number)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-barber summary (#11) */}
      {summary.length > 0 && (
        <div className="card-lux mb-6 overflow-hidden">
          <div className="border-b border-night-800 px-6 py-4">
            <h2 className="font-display text-lg text-night-50">Per-barber summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Barber</Th>
                  <Th>Type</Th>
                  <Th>Bookings</Th>
                  <Th>Revenue</Th>
                  <Th>Commission</Th>
                  <Th>Studio Revenue</Th>
                  <Th>Paid</Th>
                  <Th>Pending</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {summary.map((s) => (
                  <tr key={s.barberId} className="transition-colors hover:bg-night-900/60">
                    <Td>
                      <p className="font-semibold text-night-100">{s.barberName}</p>
                      {s.barberLocation && <p className="text-[11px] text-night-500">📍 {s.barberLocation}</p>}
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                          s.barberType === 'EXTERNAL'
                            ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                            : 'border-sky-500/40 bg-sky-500/10 text-sky-300',
                        )}
                      >
                        {s.barberType === 'EXTERNAL' ? 'External' : 'Internal'}
                      </span>
                    </Td>
                    <Td>{s.totalAppointments}</Td>
                    <Td>{naira(s.totalServiceRevenue)}</Td>
                    <Td className="font-semibold text-gold-300">{naira(s.totalCommission)}</Td>
                    <Td>{naira(s.studioRevenue)}</Td>
                    <Td className="text-emerald-300">{naira(s.paidCommission)}</Td>
                    <Td className="text-night-300">{naira(s.pendingCommission)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="card-lux overflow-hidden">
        <div className="flex items-center justify-between border-b border-night-800 px-6 py-4">
          <h2 className="font-display text-lg text-night-50">Commission ledger</h2>
          <Wallet className="h-4 w-4 text-gold-400" />
        </div>
        {loading ? (
          <LoadingSpinner label="Loading earnings" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Appointment</Th>
                  <Th>Barber</Th>
                  <Th>Snapshot</Th>
                  <Th>Service</Th>
                  <Th>Commission</Th>
                  <Th>Studio</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {rows.length === 0 ? (
                  <EmptyRow colSpan={8} message="No commission records match your filters." />
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-night-900/60">
                      <Td>
                        <p className="font-semibold text-night-100">#{row.referenceCode ?? row.appointmentId}</p>
                        <p className="text-xs text-night-500">
                          {row.customerName}
                          {row.customerLocation ? ` · ${row.customerLocation}` : ''} · {row.appointmentDate}
                        </p>
                      </Td>
                      <Td>
                        {row.barberName ?? `#${row.barberId}`}
                        <p className="text-[11px] text-night-500">
                          {row.barberTypeSnapshot === 'EXTERNAL' ? 'External' : 'Internal'}
                          {row.barberLocation ? ` · ${row.barberLocation}` : ''}
                        </p>
                      </Td>
                      <Td className="text-xs text-night-400">
                        {row.commissionType === 'PERCENTAGE' ? `${row.commissionRateSnapshot}%` : `${naira(row.commissionRateSnapshot)} fixed`}
                      </Td>
                      <Td>{naira(row.serviceAmount)}</Td>
                      <Td className="font-semibold text-gold-300">{naira(row.commissionAmount)}</Td>
                      <Td>{naira(row.studioAmount)}</Td>
                      <Td>
                        <StatusBadge
                          status={row.status}
                          label={row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                        />
                        {row.status === 'PAID' && row.paidAt && (
                          <p className="mt-1 text-[10px] text-night-600">{new Date(row.paidAt).toLocaleDateString()}</p>
                        )}
                      </Td>
                      <Td className="text-right">
                        {row.status === 'EARNED' ? (
                          <button
                            type="button"
                            disabled={markingId === row.id}
                            onClick={() => void markPaid(row)}
                            className="rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-300 transition-colors hover:bg-gold-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {markingId === row.id ? 'Marking…' : 'Mark as Paid'}
                          </button>
                        ) : (
                          <span className="text-xs text-night-600">—</span>
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
