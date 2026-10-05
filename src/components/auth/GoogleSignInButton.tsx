import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GOOGLE_CLIENT_ID,
  isGoogleSignInAvailable,
  loadGoogleIdentityServices,
  type GoogleCredentialResponse,
} from '../../lib/googleIdentity'

interface GoogleSignInButtonProps {
  /** Receives the raw Google ID token. Verification happens on the backend. */
  onCredential: (credential: string) => void
  /** Called when the user dismisses the Google popup without choosing an account. */
  onCancel?: () => void
  /** Called for load/initialisation failures. */
  onError?: (message: string) => void
  disabled?: boolean
  /** `signin` reads "Sign in with", `signup` reads "Sign up with". */
  context?: 'signin' | 'signup' | 'continue'
  className?: string
}

/**
 * The official Google Identity Services "Continue with Google" button.
 *
 * Google's own widget renders the button, the official G logo and the account
 * chooser popup — SAWABA never sees a Google password and never builds a look-
 * alike button of its own. We only receive the resulting ID token and hand it
 * to the backend, which verifies it against Google's certificates.
 */
export default function GoogleSignInButton({
  onCredential,
  onCancel,
  onError,
  disabled = false,
  context = 'continue',
  className = '',
}: GoogleSignInButtonProps) {
  const holderRef = useRef<HTMLDivElement | null>(null)
  const pendingRef = useRef(false)
  const cancelTimerRef = useRef<number | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // The parent passes inline callbacks, so their identity changes on every
  // parent render. Keeping them in refs lets the effect below (and therefore the
  // rendered Google button) stay stable instead of being torn down and redrawn
  // on each keystroke elsewhere on the page. The refs are refreshed after every
  // render; they are only ever read from a handler, long after mount.
  const onCredentialRef = useRef(onCredential)
  const onErrorRef = useRef(onError)
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCredentialRef.current = onCredential
    onErrorRef.current = onError
    onCancelRef.current = onCancel
  })

  const clearCancelTimer = useCallback(() => {
    if (cancelTimerRef.current !== null) {
      window.clearTimeout(cancelTimerRef.current)
      cancelTimerRef.current = null
    }
  }, [])

  const handleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      clearCancelTimer()
      pendingRef.current = false
      if (response?.credential) {
        onCredentialRef.current(response.credential)
      } else {
        onErrorRef.current?.('Google did not return a sign-in credential. Please try again.')
      }
    },
    [clearCancelTimer],
  )

  // ── Load the library and register the credential callback ────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false

    loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
          ux_mode: 'popup',
          context,
          auto_select: false,
        })
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        onErrorRef.current?.(
          'Could not load Google sign-in. Check your connection and try again.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [context, handleCredential])

  // ── (Re)draw the button, keeping it as wide as the card allows ───────────
  useEffect(() => {
    const holder = holderRef.current
    if (!ready || !holder || failed) return

    // Redrawing changes the holder's height, which would re-trigger a
    // ResizeObserver watching it. Guarding on the width breaks that loop: the
    // button is only re-rendered when the available width actually changes.
    let lastWidth = 0
    let frame = 0

    const render = (width: number) => {
      if (width === lastWidth) return
      lastWidth = width
      const googleId = window.google?.accounts?.id
      if (!googleId) return
      // Google appends its own markup; clear before each redraw.
      holder.replaceChildren()
      googleId.renderButton(holder, {
        type: 'standard',
        // White button on SAWABA's near-black background — the outline variant
        // is Google's recommended styling for dark surfaces.
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        width,
        text_transform: 'none',
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
      })
    }

    const schedule = (width: number) => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => render(width))
    }

    const measure = () => {
      const available = holder.clientWidth
      schedule(Math.max(200, Math.min(available > 0 ? available : 320, 400)))
    }

    measure()
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(holder)

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [ready, failed])

  // ── Detect a dismissed popup ───────────────────────────────────────────
  // GIS gives no "user closed the popup" callback, so we watch for the window
  // regaining focus: if no credential arrives shortly after, it was dismissed.
  useEffect(() => {
    const onFocus = () => {
      if (!pendingRef.current) return
      clearCancelTimer()
      cancelTimerRef.current = window.setTimeout(() => {
        if (!pendingRef.current) return
        pendingRef.current = false
        onCancelRef.current?.()
      }, 1500)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearCancelTimer()
    }
  }, [clearCancelTimer])

  const onClickCapture = () => {
    if (disabled) return
    pendingRef.current = true
  }

  if (!isGoogleSignInAvailable() || failed) return null

  return (
    <div
      data-google-signin={ready ? 'ready' : 'loading'}
      className={`flex w-full justify-center ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`}
      onClickCapture={onClickCapture}
    >
      <div ref={holderRef} className="flex w-full justify-center overflow-hidden" />
    </div>
  )
}
