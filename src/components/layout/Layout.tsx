import { useState } from 'react'
import Navbar from './Navbar'
import MobileMenu from './MobileMenu'
import Footer from './Footer'
import WhatsAppButton from './WhatsAppButton'
import { CatalogProvider } from '../../store/catalog'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <CatalogProvider>
      <div className="flex min-h-screen flex-col bg-night-950">
        <Navbar onMobileOpen={() => setMobileOpen(true)} />
        <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppButton />
      </div>
    </CatalogProvider>
  )
}
