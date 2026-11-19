import { useCallback, useEffect, useState } from 'react'
import type { ElementType } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CheckCheck,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Scissors,
  Sparkles,
  Truck,
  XCircle,
} from 'lucide-react'
import { accountApi, type CustomerNotificationItem } from '../../api/account'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import { notifyNotificationsUpdated } from '../../hooks/useUnreadNotificationCount'
import { cn } from '../../utils/cn'

const TYPE_STYLE: Record<string, { icon: ElementType; tone: string }> = {
  ORDER_CONFIRMATION: { icon: PackageCheck, tone: 'border-sky-500/30 bg-sky-500/5 text-sky-300' },
  ORDER_STATUS: { icon: Truck, tone: 'border-gold-500/30 bg-gold-500/5 text-gold-300' },
  PAYMENT_SUCCESS: { icon: CheckCircle2, tone: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300' },
  PAYMENT_FAILED: { icon: XCircle, tone: 'border-rose-500/30 bg-rose-500/5 text-rose-300' },
  ORDER_CANCELLED: { icon: XCircle, tone: 'border-rose-500/30 bg-rose-500/5 text-rose-300' },
  REFUND_UPDATE: { icon: RotateCcw, tone: 'border-sky-500/30 bg-sky-500/5 text-sky-300' },
  PROMOTION: { icon: Sparkles, tone: 'border-gold-500/30 bg-gold-500/5 text-gold-300' },
  WELCOME: { icon: Scissors, tone: 'border-night-700 bg-night-900/60 text-night-300' },
}
const DEFAULT_STYLE = { icon: Bell, tone: 'border-night-700 bg-night-900/60 text-night-300' }

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CustomerNotificationsPage() {
  const [items, setItems] = useState<CustomerNotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const perPage = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await accountApi.notifications({ page, perPage, unread: unreadOnly || undefined })
      setItems(data.items)
      setTotal(data.total)
      setUnreadCount(data.unreadCount)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, unreadOnly, showToast])

  useEffect(() => {
    void load()
  }, [load])

  async function openItem(item: CustomerNotificationItem) {
    if (item.readAt) return
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)))
    setUnreadCount((count) => Math.max(0, count - 1))
    try {
      await accountApi.markNotificationRead(item.id)
      notifyNotificationsUpdated()
      if (unreadOnly) await load()
    } catch {
      // Non-fatal: the badge refreshes on the next load anyway.
    }
  }

  async function markAllRead() {
    try {
      await accountApi.markAllNotificationsRead()
      notifyNotificationsUpdated()
      showToast('All notifications marked as read.')
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-night-50">
            Notifications
            {unreadCount > 0 && (
              <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-bold text-gold-300">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-night-400">Order and delivery updates, and payment confirmations.</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="flex items-center gap-2 rounded-lg bg-night-800 px-3 py-2 text-xs font-semibold text-night-200 transition-colors hover:bg-night-700"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {[
          { value: false, label: 'All' },
          { value: true, label: 'Unread' },
        ].map((tab) => (
          <button
            key={String(tab.value)}
            type="button"
            onClick={() => { setUnreadOnly(tab.value); setPage(1) }}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors',
              unreadOnly === tab.value
                ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                : 'border-night-700 text-night-300 hover:border-gold-500/40',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner label="Loading notifications" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description="Order confirmations, payment updates and delivery progress will appear here."
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const style = TYPE_STYLE[item.type] ?? DEFAULT_STYLE
            const Icon = style.icon
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openItem(item)}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition-colors',
                    style.tone,
                    !item.readAt && 'ring-1 ring-gold-500/25',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', style.tone)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-night-100">{item.title}</p>
                        {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-400" aria-label="Unread" />}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-night-400">{item.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-night-500">
                        {item.orderReference && <span className="font-mono text-night-400">{item.orderReference}</span>}
                        <span>{timeAgo(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>
                {item.orderReference && (
                  <div className="mt-1.5 pl-4">
                    <Link
                      to={`/account/orders/${encodeURIComponent(item.orderReference)}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-400 transition-colors hover:text-gold-300"
                    >
                      View order <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-night-400">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-night-700 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-night-700 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
