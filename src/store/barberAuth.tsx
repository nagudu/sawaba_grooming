import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearBarberToken,
  fetchBarberMe,
  getBarberToken,
  type BarberProfile,
} from '../api/barberPortal'

interface BarberAuthState {
  barber: BarberProfile | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => void
}

const BarberAuthContext = createContext<BarberAuthState>({
  barber: null,
  loading: true,
  refresh: async () => {},
  signOut: () => {},
})

export function BarberAuthProvider({ children }: { children: React.ReactNode }) {
  const [barber, setBarber] = useState<BarberProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getBarberToken()) {
      setBarber(null)
      setLoading(false)
      return
    }
    try {
      setBarber(await fetchBarberMe())
    } catch {
      clearBarberToken()
      setBarber(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(() => {
    clearBarberToken()
    setBarber(null)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ barber, loading, refresh, signOut }), [barber, loading, refresh, signOut])
  return <BarberAuthContext.Provider value={value}>{children}</BarberAuthContext.Provider>
}

export function useBarberAuth(): BarberAuthState {
  return useContext(BarberAuthContext)
}
