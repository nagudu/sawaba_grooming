/**
 * Registers the service worker (built by vite-plugin-pwa) for offline
 * app-shell caching. Dev mode is unaffected (devOptions.enabled = false).
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Check for a new deployment on every load so stale bundles are replaced.
        void registration.update()

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            // New worker is live and there was already a controller: reload once
            // so the user immediately gets the freshly deployed app shell.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload()
            }
          })
        })
      })
      .catch((error) => {
        console.warn('[pwa] service worker registration failed:', error)
      })
  })
}
