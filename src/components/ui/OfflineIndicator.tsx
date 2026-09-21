import { useEffect, useState } from 'react'
import { CloudOff, Cloud } from 'lucide-react'

/**
 * Subtle online/offline pill in the corner of the page. Reacts to the
 * browser's online/offline events; when offline it explains that saved
 * (cached) data is being shown instead of pretending everything is live.
 */
export default function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-[70] flex items-center gap-2 rounded-full border border-gold-500/40 bg-night-900/95 px-4 py-2 text-xs font-semibold text-night-100 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md"
    >
      {dismissed ? (
        <>
          <CloudOff className="h-3.5 w-3.5 text-gold-400" />
          <span>Offline Mode — Showing saved data</span>
        </>
      ) : (
        <>
          <CloudOff className="h-3.5 w-3.5 text-gold-400" />
          <span>Offline Mode — Showing saved data</span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="ml-1 rounded-full px-1.5 text-night-400 transition-colors hover:text-night-100"
          >
            <Cloud className="h-3 w-3 rotate-45" />
          </button>
        </>
      )}
    </div>
  )
}
