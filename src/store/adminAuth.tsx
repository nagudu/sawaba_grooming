import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api, clearAdminSession, setAdminToken, type AdminProfile } from '../api'

interface AdminAuthContextValue {
  admin: AdminProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(() => {
    try {
      const raw = localStorage.getItem('sawaba_admin_profile')
      return raw ? (JSON.parse(raw) as AdminProfile) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const data = await api.post<{ token: string; admin: AdminProfile }>('/api/auth/login', {
        email,
        password,
      })
      setAdminToken(data.token)
      setAdmin(data.admin)
      localStorage.setItem('sawaba_admin_profile', JSON.stringify(data.admin))
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const data = await api.get<{ admin: AdminProfile }>('/api/auth/me')
    setAdmin(data.admin)
    localStorage.setItem('sawaba_admin_profile', JSON.stringify(data.admin))
  }, [])

  const logout = useCallback(() => {
    clearAdminSession()
    setAdmin(null)
  }, [])

  const value = useMemo(
    () => ({ admin, loading, login, logout, refreshProfile }),
    [admin, loading, login, logout, refreshProfile],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}