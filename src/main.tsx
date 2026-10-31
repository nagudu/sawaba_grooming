import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './pwa'
import { ShopCartProvider } from './store/shopCart'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ShopCartProvider>
      <App />
    </ShopCartProvider>
  </StrictMode>,
)

void registerServiceWorker()
