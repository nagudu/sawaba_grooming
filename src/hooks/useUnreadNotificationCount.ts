import { useEffect, useState } from 'react'
import { accountApi, getCustomerToken } from '../api/account'

/** Fired after the inbox marks notifications read, so the bell badge refreshes. */
export const NOTIFICATIONS_UPDATED_EVENT = 'sawaba:notifications-updated'

export function notifyNotificationsUpdated(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT))
}

/**
 * Live unread-notification count for the customer bell. Refreshes on mount,
 * on window focus, on a slow interval, and whenever the inbox marks items read.
 */
export function useUnreadNotificationCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!getCustomerToken()) return
    let active = true

    const refresh = () => {
      accountApi
        .notificationUnreadCount()
        .then((result) => {
          if (active) setCount(result.count)
        })
        .catch(() => undefined)
    }

    refresh()
    const interval = window.setInterval(refresh, 60_000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh)
    }
  }, [])

  return count
}
