import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { dashboardPathForRole, resolveStoredSession } from '../../api/session'
import LoadingSpinner from '../ui/LoadingSpinner'

/**
 * Canonical entry point for a signed-in user. Resolves the stored session and
 * routes to that role's dashboard, or to the login chooser when there is none.
 */
export default function SessionLanding() {
  const [target, setTarget] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    void resolveStoredSession().then((session) => {
      if (!active) return
      setTarget(session ? dashboardPathForRole(session.role) : '/login')
      setChecking(false)
    })
    return () => {
      active = false
    }
  }, [])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-night-950">
        <LoadingSpinner label="Restoring your session…" />
      </div>
    )
  }

  return <Navigate to={target ?? '/login'} replace />
}
