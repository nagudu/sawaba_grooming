import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Scissors } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useBarberAuth } from '../../store/barberAuth'
import { barberLogin } from '../../api/barberPortal'

export default function BarberLoginPage() {
  const { barber, loading, refresh } = useBarberAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && barber) {
    return <Navigate to="/barber" replace />
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await barberLogin(identifier.trim(), password)
      await refresh()
      navigate('/barber', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-night-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-night-800 bg-night-900/70 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10">
            <Scissors className="h-6 w-6 text-gold-400" />
          </span>
          <h1 className="font-display text-2xl font-semibold text-night-50">Barber Portal</h1>
          <p className="mt-1 text-sm text-night-400">Sign in with the credentials from the studio.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-night-400">
            Email or phone
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-night-700 bg-night-900 px-4 py-3 text-sm text-night-100 focus:border-gold-500 focus:outline-none"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-night-400">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-night-700 bg-night-900 px-4 py-3 text-sm text-night-100 focus:border-gold-500 focus:outline-none"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
          )}

          <Button type="submit" variant="gold" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
