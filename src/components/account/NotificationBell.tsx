import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useUnreadNotificationCount } from '../../hooks/useUnreadNotificationCount'
import { cn } from '../../utils/cn'

/**
 * Customer notification bell with an unread badge. Links to the in-app
 * Notification Center.
 */
export default function NotificationBell({
  className,
  label,
  iconClassName,
}: {
  className?: string
  label?: string
  iconClassName?: string
}) {
  const unread = useUnreadNotificationCount()

  return (
    <Link
      to="/account/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className={cn(
        'relative inline-flex items-center gap-2 rounded-lg text-night-400 transition-colors hover:text-night-100',
        className,
      )}
    >
      <span className="relative inline-flex">
        <Bell className={cn('h-5 w-5', iconClassName)} />
        {unread > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-bold leading-none text-night-950">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </span>
      {label && <span className="text-sm font-semibold">{label}</span>}
    </Link>
  )
}
