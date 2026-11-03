/** Capacitor/WebView helpers that degrade gracefully on the web. */

interface CapacitorWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean
    getPlatform?: () => string
  }
}

export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as unknown as CapacitorWindow).Capacitor?.isNativePlatform?.())
}

/**
 * Opens a URL outside the app shell when running natively (system browser) and
 * falls back to a normal navigation on the web. Used for Paystack and print
 * receipts, which must not navigate the bundled WebView away from the app.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return
  if (isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
      return
    } catch {
      // Fall through to a normal navigation if the plugin is unavailable.
    }
  }
  window.location.assign(url)
}

/** Wires the Android hardware back button to browser history when native. */
export async function initNativeBackButton(onExit: () => void): Promise<() => void> {
  if (!isNativePlatform()) return () => undefined
  try {
    const { App } = await import('@capacitor/app')
    const handle = await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else void onExit()
    })
    return () => void handle.remove()
  } catch {
    return () => undefined
  }
}
