/**
 * Registers the service worker (built by vite-plugin-pwa) for offline
 * app-shell caching. Dev mode is unaffected (devOptions.enabled = false).
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('[pwa] service worker registration failed:', error)
    })
  })
}
