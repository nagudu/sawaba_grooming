/**
 * Google Identity Services (GIS) wiring that is not itself a React component.
 * Kept out of GoogleSignInButton.tsx so that file only exports a component,
 * which keeps Vite's Fast Refresh working while editing the button.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client'

/**
 * The public ("app") client id. It is safe to ship in the browser bundle — it
 * identifies the app, not a secret. The token it helps obtain is still verified
 * on the server against GOOGLE_CLIENT_ID.
 */
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

export interface GoogleCredentialResponse {
  credential?: string
  select_by?: string
}

export interface GoogleInitializeConfig {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  ux_mode?: 'popup' | 'redirect'
  context?: 'signin' | 'signup' | 'continue'
  auto_select?: boolean
}

export interface GoogleButtonConfiguration {
  type: 'standard' | 'icon'
  theme: 'outline' | 'filled_blue' | 'filled_black'
  size: 'large' | 'medium' | 'small'
  text: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment: 'left' | 'center'
  width?: number
  locale?: string
  text_transform?: 'uppercase' | 'lowercase' | 'none'
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleInitializeConfig) => void
          renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

/** Loads the Google Identity Services client exactly once per page. */
export function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google script failed to load')))
      return
    }
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google script failed to load'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

/**
 * Whether Google sign-in has been configured for this deployment. When it has
 * not, the button is not rendered at all and phone/password sign-in is
 * unaffected.
 */
export function isGoogleSignInAvailable(): boolean {
  return GOOGLE_CLIENT_ID.length > 0
}
