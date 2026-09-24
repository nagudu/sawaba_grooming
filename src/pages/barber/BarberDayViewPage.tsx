import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Phone } from 'lucide-react'
import {
  fetchPortalAppointments,
  fetchPortalAvailability,
  updatePortalAppointmentStatus,
  type PortalAppointment,
} from '../../api/barberPortal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

/**
 * Day View — a single-day timeline of the barber's own appointments.
 *
 * Data comes from the existing portal appointments endpoint (scoped to the
 * JWT's barber; `from`/`to` pin it to one date) and the availability endpoint
 * supplies the working-hours window so the grid highlights the barber's own
 * schedule. Appointments are absolutely positioned by time+duration, like a
 * real calendar. One request per load — no polling loops.
 */

const START_HOUR = 7 // grid begins 07:00
const END_HOUR = 22 // grid ends 22:00
const PX_PER_HOUR = 104 // row height; tall enough for a 1-hour block to fit name/time/price/actions

const STATUS_STYLE: Record<string, string> = {
  PAYMENT_REQUIRED: 'border-night-600 bg-night-800/80 text-night-300',
  PAYMENT_SUBMITTED: 'border-amber-500/50 bg-amber-500/15 text-amber-200',
  PAYMENT_VERIFIED: 'border-sky-500/50 bg-sky-500/15 text-sky-200',
  READY_FOR_SERVICE: 'border-gold-500/60 bg-gold-500/15 text-gold-200',
  IN_PROGRESS: 'border-blue-500/60 bg-blue-500/20 text-blue-100',
  COMPLETED: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
  CANCELLED: 'border-red-500/40 bg-red-500/10 text-red-300 line-through decoration-red-400/50',
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function shiftDay(key: string, days: number): string {
  const date = fromKey(key)
  date.setDate(date.getDate() + days)
  return toKey(date)
}

/** "HH:mm" → minutes past midnight (NaN-safe). */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function prettyTime(time: string): string {
  const total = toMinutes(time)
  const h24 = Math.floor(total / 60)
  const mins = total % 60
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(mins).padStart(2, '0')} ${suffix}`
}

interface BlockLayout {
  column: number
  /** How many columns this appointment's overlap cluster spans. */
  clusterColumns: number
}

/**
 * Layout pass: appointments that genuinely overlap share side-by-side
 * columns; each overlap *cluster* gets its own column count so an isolated
 * appointment keeps the full row width (only truly conflicting times shrink).
 */
function layoutBlocks(items: PortalAppointment[]): Map<number, BlockLayout> {
  const sorted = [...items].sort((a, b) => toMinutes(a.appointmentTime) - toMinutes(b.appointmentTime))
  const layoutOf = new Map<number, BlockLayout>()

  let clusterEnd = -1 // max end-minute within the current cluster
  let columnEnds: number[] = [] // end-minute per occupied column in the cluster
  let clusterMembers: number[] = [] // ids placed in the current cluster

  for (const item of sorted) {
    const start = toMinutes(item.appointmentTime)
    const duration = Math.max(item.service?.duration ?? 30, 15)
    const end = start + duration

    // Back-to-back (start >= cluster end) starts a fresh cluster.
    if (start >= clusterEnd) {
      clusterEnd = end
      columnEnds = [end]
      clusterMembers = [item.id]
      layoutOf.set(item.id, { column: 0, clusterColumns: 1 })
      continue
    }

    let column = columnEnds.findIndex((ends) => ends <= start)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(end)
    } else {
      columnEnds[column] = end
    }
    clusterEnd = Math.max(clusterEnd, end)
    // Record the item's own column BEFORE the retroactive pass, so widening
    // the cluster never loses it (its `existing` lookup must succeed).
    layoutOf.set(item.id, { column, clusterColumns: columnEnds.length })
    clusterMembers.push(item.id)
    // A new column widens the whole cluster — every member already placed
    // (earlier in time, processed before this one) must shrink to match.
    for (const memberId of clusterMembers) {
      const existing = layoutOf.get(memberId)
      layoutOf.set(memberId, { column: existing?.column ?? 0, clusterColumns: columnEnds.length })
    }
  }
  return layoutOf
}

export default function BarberDayViewPage() {
  const [dateKey, setDateKey] = useState(() => toKey(new Date()))
  const [items, setItems] = useState<PortalAppointment[]>([])
  const [workingHours, setWorkingHours] = useState<{ start: string; end: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async (key: string) => {
    setLoading(true)
    setError(null)
    try {
      const [data, availability] = await Promise.all([
        fetchPortalAppointments({ from: key, to: key, perPage: 100 }),
        fetchPortalAvailability().catch(() => []),
      ])
      setItems(data.items)
      const row = availability.find((a) => a.dayOfWeek === fromKey(key).getDay() && a.isAvailable)
      setWorkingHours(row ? { start: row.startTime, end: row.endTime } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the day view.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(dateKey)
  }, [dateKey, load])

  const selected = useMemo(() => fromKey(dateKey), [dateKey])
  const isToday = dateKey === toKey(new Date())

  // Now-line position in minutes; only meaningful for today.
  const now = useMemo(() => {
    const d = new Date()
    return { minutes: d.getHours() * 60 + d.getMinutes(), key: toKey(d) }
  }, [items]) // recompute when data refreshes; fine-grained ticking isn't needed for a status line

  const showNowLine = isToday && now.minutes >= START_HOUR * 60 && now.minutes <= END_HOUR * 60

  // Grid extent: pad to cover appointments outside working hours, but default
  // to the standard window so an empty day still looks like a calendar.
  const dayStart = workingHours ? toMinutes(workingHours.start) : 9 * 60
  const dayEnd = workingHours ? toMinutes(workingHours.end) : 18 * 60
  const earliest = items.length ? Math.min(...items.map((a) => toMinutes(a.appointmentTime))) : dayStart
  const latestEnd = items.length
    ? Math.max(...items.map((a) => toMinutes(a.appointmentTime) + Math.max(a.service?.duration ?? 30, 15)))
    : dayEnd
  const gridStart = Math.min(START_HOUR * 60, Math.floor(earliest / 60) * 60)
  const gridEnd = Math.max(END_HOUR * 60, Math.ceil(latestEnd / 60) * 60)
  const gridHeight = ((gridEnd - gridStart) / 60) * PX_PER_HOUR

  const columns = useMemo(() => layoutBlocks(items), [items])

  const act = async (id: number, to: 'IN_PROGRESS' | 'COMPLETED') => {
    setBusyId(id)
    try {
      await updatePortalAppointmentStatus(id, to)
      await load(dateKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setBusyId(null)
    }
  }

  const hours = useMemo(() => {
    const list: number[] = []
    for (let h = gridStart / 60; h < gridEnd / 60; h += 1) list.push(h)
    return list
  }, [gridStart, gridEnd])

  const activeCount = items.filter((a) => a.status !== 'CANCELLED').length

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-night-50">Day View</h1>
          <p className="text-sm text-night-400">
            {DAY_NAMES[selected.getDay()]}, {MONTH_NAMES[selected.getMonth()]} {selected.getDate()}{' '}
            {selected.getFullYear()}
            {activeCount > 0 && <span className="ml-2 text-gold-400">· {activeCount} appointment{activeCount === 1 ? '' : 's'}</span>}
          </p>
        </div>
        <Link
          to="/barber/appointments"
          className="inline-flex items-center gap-2 rounded-lg border border-night-700 bg-night-900/60 px-3 py-2 text-xs font-medium text-night-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
        >
          <CalendarRange className="h-4 w-4" />
          List view
        </Link>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setDateKey((k) => shiftDay(k, -1))}
          aria-label="Previous day"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-night-700 bg-night-900/60 text-night-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDateKey(toKey(new Date()))}
            className={cn(
              'rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
              isToday ? 'bg-gold-500/15 text-gold-300' : 'border border-night-700 bg-night-900/60 text-night-300 hover:text-night-100',
            )}
          >
            Today
          </button>
          <label className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
            <input
              type="date"
              value={dateKey}
              onChange={(event) => event.target.value && setDateKey(event.target.value)}
              className="field appearance-none bg-night-900/60 py-2 pl-9 pr-3 text-xs"
              aria-label="Pick a date"
            />
          </label>
        </div>
        <button
          onClick={() => setDateKey((k) => shiftDay(k, 1))}
          aria-label="Next day"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-night-700 bg-night-900/60 text-night-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-night-800 bg-night-900/40">
          {workingHours && (
            <p className="border-b border-night-800 bg-night-900/60 px-4 py-2 text-[11px] uppercase tracking-wider text-night-500">
              Working hours {prettyTime(workingHours.start)} – {prettyTime(workingHours.end)}
            </p>
          )}
          <div className="relative flex">
            {/* Hour labels column */}
            <div className="w-16 shrink-0 select-none border-r border-night-800 sm:w-20" style={{ height: gridHeight }}>
              {hours.map((h) => (
                <div key={h} className="absolute left-0 w-full pr-2 text-right text-[11px] text-night-500" style={{ top: ((h * 60 - gridStart) / 60) * PX_PER_HOUR - 7 }}>
                  {prettyTime(`${String(h).padStart(2, '0')}:00`)}
                </div>
              ))}
            </div>

            {/* Timeline grid */}
            <div className="relative min-w-0 flex-1" style={{ height: gridHeight }}>
              {/* Hour lines + working-hours tint */}
              {hours.map((h) => (
                <div
                  key={h}
                  className={cn('absolute inset-x-0 border-t', h * 60 >= dayStart && h * 60 < dayEnd ? 'border-night-700/70' : 'border-night-800/60')}
                  style={{ top: ((h * 60 - gridStart) / 60) * PX_PER_HOUR }}
                />
              ))}
              {workingHours && (
                <div
                  className="absolute inset-x-0 bg-gold-500/[0.04]"
                  style={{ top: ((dayStart - gridStart) / 60) * PX_PER_HOUR, height: ((dayEnd - dayStart) / 60) * PX_PER_HOUR }}
                />
              )}

              {/* Now line */}
              {showNowLine && (
                <div className="absolute inset-x-0 z-20" style={{ top: ((now.minutes - gridStart) / 60) * PX_PER_HOUR }}>
                  <div className="relative border-t-2 border-red-400/70">
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-400" />
                  </div>
                </div>
              )}

              {/* Appointment blocks */}
              {items.map((a) => {
                const start = toMinutes(a.appointmentTime)
                const duration = Math.max(a.service?.duration ?? 30, 15)
                const { column, clusterColumns } = columns.get(a.id) ?? { column: 0, clusterColumns: 1 }
                const widthPct = 100 / clusterColumns
                const cancelled = a.status === 'CANCELLED'
                // Sub-45-minute blocks are a single line tall at this density —
                // collapse to a compact row (name · time); status is conveyed by
                // the block's color. Full details/actions live in taller blocks
                // and the list/dashboard views.
                const compact = duration < 45
                return (
                  <div
                    key={a.id}
                    title={`${a.customerName} · ${prettyTime(a.appointmentTime)} · ${a.service?.name ?? 'Service'} · ${STATUS_LABEL[a.status] ?? a.status}`}
                    className={cn(
                      'absolute z-10 overflow-hidden rounded-lg border transition-shadow hover:z-30 hover:shadow-lg',
                      compact ? 'flex items-center gap-2 px-2' : 'p-2.5',
                      STATUS_STYLE[a.status] ?? 'border-night-600 bg-night-800 text-night-200',
                    )}
                    style={{
                      top: ((start - gridStart) / 60) * PX_PER_HOUR + 2,
                      height: (duration / 60) * PX_PER_HOUR - 4,
                      left: `calc(${column * widthPct}% + 4px)`,
                      width: `calc(${widthPct}% - 8px)`,
                    }}
                  >
                    {compact ? (
                      <Link
                        to="/barber/appointments"
                        className="flex min-w-0 flex-1 items-center gap-2"
                        title="Open in list view for details and actions"
                      >
                        <span className="min-w-0 truncate text-[11px] font-semibold">{a.customerName}</span>
                        <span className="ml-auto shrink-0 text-[10px] opacity-80">{prettyTime(a.appointmentTime)}</span>
                      </Link>
                    ) : (
                      <>
                    <div className="flex items-start justify-between gap-1">
                      <p className="min-w-0 truncate text-xs font-semibold">{a.customerName}</p>
                      <span className="shrink-0 rounded bg-black/20 px-1.5 py-0.5 text-[9px] font-mono">{a.referenceCode ?? `#${a.id}`}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] opacity-90">
                      {prettyTime(a.appointmentTime)} · {a.service?.name ?? 'Service'}
                    </p>
                    {duration >= 60 && (
                      <p className="truncate text-[11px] opacity-75">
                        {formatPrice(a.totalAmount)}
                        {a.customerPhone && <> · <a href={`tel:${a.customerPhone}`} className="underline decoration-dotted">{a.customerPhone}</a></>}
                      </p>
                    )}
                    {/* Status + actions share one wrapping row so a 1-hour block stays unclipped. */}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-black/25 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide">
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                      {!cancelled && a.status === 'READY_FOR_SERVICE' && (
                        <button
                          onClick={() => void act(a.id, 'IN_PROGRESS')}
                          disabled={busyId === a.id}
                          className="rounded bg-gold-500 px-2 py-1 text-[10px] font-semibold text-night-950 hover:bg-gold-400 disabled:opacity-60"
                        >
                          {busyId === a.id ? '…' : 'Start'}
                        </button>
                      )}
                      {!cancelled && a.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => void act(a.id, 'COMPLETED')}
                          disabled={busyId === a.id}
                          className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-night-950 hover:bg-emerald-400 disabled:opacity-60"
                        >
                          {busyId === a.id ? '…' : 'Complete'}
                        </button>
                      )}
                    </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {items.length === 0 && (
            <p className="border-t border-night-800 px-4 py-10 text-center text-sm text-night-500">
              No appointments on this day — enjoy the quiet.
            </p>
          )}
        </div>
      )}

      {items.some((a) => a.customerPhone) && (
        <p className="flex items-center gap-1.5 text-[11px] text-night-500">
          <Phone className="h-3 w-3" /> Tap a phone number to call the customer.
        </p>
      )}
    </div>
  )
}
