import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  accountApi,
  getCustomerToken,
  setCustomerToken,
  type CustomerProfile,
} from '../api/account'

interface CustomerAuthContextValue {
  customer: CustomerProfile | null
  loading: boolean
  login: (customer: CustomerProfile, token: string) => void
  logout: () => void
  refresh: () => Promise<void>
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null)

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getCustomerToken()) {
      setCustomer(null)
      setLoading(false)
      return
    }
    try {
      const { customer: profile } = await accountApi.me()
      setCustomer(profile)
    } catch {
      setCustomerToken(null)
      setCustomer(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback((profile: CustomerProfile, token: string) => {
    setCustomerToken(token)
    setCustomer(profile)
  }, [])

  const logout = useCallback(() => {
    setCustomerToken(null)
    setCustomer(null)
  }, [])

  const value = useMemo(
    () => ({ customer, loading, login, logout, refresh }),
    [customer, loading, login, logout, refresh],
  )

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider')
  return ctx
}
