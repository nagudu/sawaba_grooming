import { useCallback, useEffect, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import {
  fetchPortalNotifications,
  markPortalNotificationsRead,
  type PortalNotification,
} from '../../api/barberPortal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { cn } from '../../utils/cn'

const TYPE_STYLE: Record<string, string> = {
  ASSIGNMENT: 'border-gold-500/40 bg-gold-500/5',
  EARNING: 'border-emerald-500/40 bg-emerald-500/5',
  APPOINTMENT: 'border-blue-500/40 bg-blue-500/5',
  SYSTEM: 'border-night-700 bg-night-900/60',
}

export default function BarberNotificationsPage() {
  const [items, setItems] = useState<PortalNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPortalNotifications({ perPage: 100 })
      setItems(data.items)
      setUnread(data.unreadCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const markAll = async () => {
    try {
      await markPortalNotificationsRead()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold text-night-50">
          Notifications
          {unread > 0 && <span className="ml-2 align-middle text-sm font-normal text-gold-400">{unread} new</span>}
        </h1>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="flex items-center gap-2 rounded-lg bg-night-800 px-3 py-2 text-xs font-medium text-night-200 hover:bg-night-700"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-night-800 bg-night-900/50 px-4 py-12 text-center text-sm text-night-500">
          No notifications yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={cn('rounded-xl border p-4', TYPE_STYLE[n.type] ?? TYPE_STYLE.SYSTEM)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-night-100">{n.title}</p>
                  <p className="text-sm text-night-400">{n.message}</p>
                </div>
                {!n.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold-400" />}
              </div>
              <p className="mt-1.5 text-[11px] text-night-600">{new Date(n.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
