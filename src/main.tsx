import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './pwa'
import { ShopCartProvider } from './store/shopCart'
import { initNativeBackButton, isNativePlatform } from './lib/native'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShopCartProvider>
      <App />
    </ShopCartProvider>
  </StrictMode>,
)

void registerServiceWorker()
void initNativeChrome()

/** Native-only setup: non-overlaying status bar + Android back button. */
async function initNativeChrome(): Promise<void> {
  if (!isNativePlatform()) return
  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setBackgroundColor({ color: '#0a0a0c' })
  } catch {
    /* status bar plugin unavailable — ignore */
  }

  await initNativeBackButton(async () => {
    try {
      const { App } = await import('@capacitor/app')
      await App.exitApp()
    } catch {
      /* ignore */
    }
  })
}
