import { createContext, useContext, useEffect, useState } from 'react'
import {
  fetchCatalogBarbers,
  fetchCatalogServices,
  type CatalogBarber,
  type CatalogService,
} from '../api/catalog'

/**
 * Shared catalog provider — loads services + barbers from the backend once
 * per session and shares them with every public page. Replaces the old
 * hardcoded data arrays so admin edits are always live on the website.
 */

interface CatalogState {
  services: CatalogService[]
  barbers: CatalogBarber[]
  loading: boolean
  error: string | null
  getService: (id: string | number | undefined) => CatalogService | null
  getBarber: (id: string | number | undefined) => CatalogBarber | null
  getRelatedServices: (service: CatalogService, limit?: number) => CatalogService[]
}

const CatalogContext = createContext<CatalogState | null>(null)

const EMPTY: CatalogState = {
  services: [],
  barbers: [],
  loading: true,
  error: null,
  getService: () => null,
  getBarber: () => null,
  getRelatedServices: () => [],
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CatalogState>(EMPTY)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }))
      try {
        const [services, barbers] = await Promise.all([
          fetchCatalogServices(),
          fetchCatalogBarbers(),
        ])
        if (cancelled) return

        const getService = (id: string | number | undefined) =>
          id === undefined ? null : services.find((service) => String(service.id) === String(id)) ?? null
        const getBarber = (id: string | number | undefined) =>
          id === undefined ? null : barbers.find((barber) => String(barber.id) === String(id)) ?? null
        const getRelatedServices = (service: CatalogService, limit = 3) =>
          services.filter((item) => item.id !== service.id).slice(0, limit)

        setState({ services, barbers, loading: false, error: null, getService, getBarber, getRelatedServices })
      } catch (error) {
        if (cancelled) return
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Could not load services and barbers.',
        }))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>
}

export function useCatalog(): CatalogState {
  const context = useContext(CatalogContext)
  if (!context) return EMPTY
  return context
}
