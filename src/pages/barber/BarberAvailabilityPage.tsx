import { useEffect, useMemo, useState } from 'react'
import { fetchPortalAvailability, savePortalAvailability } from '../../api/barberPortal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Row {
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

const DEFAULT_ROW = (day: number): Row => ({ dayOfWeek: day, startTime: '09:00', endTime: '18:00', isAvailable: day !== 0 })

export default function BarberAvailabilityPage() {
  const [rows, setRows] = useState<Row[]>(DAYS.map((_, i) => DEFAULT_ROW(i)))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const existing = await fetchPortalAvailability()
        setRows(DAYS.map((_, day) => {
          const found = existing.find((e) => e.dayOfWeek === day)
          return found
            ? { dayOfWeek: day, startTime: found.startTime, endTime: found.endTime, isAvailable: found.isAvailable }
            : DEFAULT_ROW(day)
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load availability.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const update = (day: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.dayOfWeek === day ? { ...r, ...patch } : r)))
  }

  const valid = useMemo(
    () => rows.every((r) => !r.isAvailable || r.startTime < r.endTime),
    [rows],
  )

  const save = async () => {
    if (!valid) {
      setError('End time must be after start time on every working day.')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const entries = rows.filter((r) => r.isAvailable)
      await savePortalAvailability(entries)
      setMessage('Availability saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-night-50">My Availability</h1>
        <p className="text-sm text-night-400">
          Set your weekly working hours. The studio assigns appointments only inside these windows.
        </p>
      </div>

      {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {message && <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</p>}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.dayOfWeek} className="flex flex-wrap items-center gap-3 rounded-xl border border-night-800 bg-night-900/60 p-4">
            <label className="flex min-w-[7.5rem] items-center gap-2 text-sm font-medium text-night-100">
              <input
                type="checkbox"
                checked={row.isAvailable}
                onChange={(e) => update(row.dayOfWeek, { isAvailable: e.target.checked })}
                className="h-4 w-4 accent-[#c9a24b]"
              />
              {DAYS[row.dayOfWeek]}
            </label>
            {row.isAvailable && (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="time"
                  value={row.startTime}
                  onChange={(e) => update(row.dayOfWeek, { startTime: e.target.value })}
                  className="rounded-lg border border-night-700 bg-night-900 px-3 py-2 text-night-100 focus:border-gold-500 focus:outline-none"
                />
                <span className="text-night-500">–</span>
                <input
                  type="time"
                  value={row.endTime}
                  onChange={(e) => update(row.dayOfWeek, { endTime: e.target.value })}
                  className="rounded-lg border border-night-700 bg-night-900 px-3 py-2 text-night-100 focus:border-gold-500 focus:outline-none"
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg bg-gold-500 px-4 py-3 text-sm font-semibold text-night-950 hover:bg-gold-400 disabled:opacity-60 md:w-auto"
      >
        {saving ? 'Saving…' : 'Save availability'}
      </button>
    </div>
  )
}
