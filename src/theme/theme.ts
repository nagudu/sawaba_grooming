import { useSyncExternalStore } from 'react'

/**
 * Studio appearance themes.
 *
 * Every theme is a curated, professional palette expressed as overrides of the
 * design tokens in index.css (Tailwind v4 @theme variables). Components never
 * hardcode brand colors — they reference tokens like `gold-500` (the ACCENT
 * scale) and the `night-*` surface scale, so swapping the variables re-skins
 * the whole application: navbar, buttons, cards, forms, dashboards, modals,
 * toasts, footer — everywhere — with zero per-component edits.
 *
 * All palettes are dark-first (the brand is a premium barbershop) with
 * light, high-contrast accents: accent surfaces always carry `text-night-950`
 * dark text, so contrast stays WCAG-friendly in every theme.
 */

export interface ThemeDefinition {
  id: string
  name: string
  tagline: string
  /** Two-color swatch preview for pickers. */
  swatch: { bg: string; accent: string }
  /** CSS custom properties applied to :root when the theme is active. */
  vars: Record<string, string>
}

/** Accent (gold-*) ramp — hue varies per theme, tonal structure preserved. */
function accentRamp(
  c100: string, c200: string, c300: string, c400: string,
  c500: string, c600: string, c700: string, c800: string,
  rgb: string,
): Record<string, string> {
  return {
    '--color-gold-100': c100,
    '--color-gold-200': c200,
    '--color-gold-300': c300,
    '--color-gold-400': c400,
    '--color-gold-500': c500,
    '--color-gold-600': c600,
    '--color-gold-700': c700,
    '--color-gold-800': c800,
    '--accent-rgb': rgb,
  }
}

/** Surface ramp (night and charcoal scales) — subtly tinted toward the palette hue. */
function surfaceRamp(
  c700: string, c800: string, c850: string, c900: string, c950: string,
  charcoal: string, graphite: string, coal: string,
): Record<string, string> {
  return {
    '--color-night-700': c700,
    '--color-night-800': c800,
    '--color-night-850': c850,
    '--color-night-900': c900,
    '--color-night-950': c950,
    '--color-charcoal': charcoal,
    '--color-graphite': graphite,
    '--color-coal': coal,
  }
}

const GOLD_ACCENT = accentRamp(
  '#f7ecd4', '#efdcb0', '#e7c978', '#dcb95f',
  '#c9a24b', '#ad8839', '#8a6b2c', '#6b5322',
  '201, 162, 75',
)

const SILVER_ACCENT = accentRamp(
  '#ffffff', '#f4f6f9', '#e3e8f0', '#cdd6e3',
  '#f2f4f8', '#c3cddb', '#94a1b8', '#69758c',
  '235, 239, 245',
)

const NEUTRAL_SURFACE = surfaceRamp(
  '#2a2a2b', '#1a1a1d', '#14141a', '#0f0f13', '#0a0a0c',
  '#1a1a21', '#23232b', '#121216',
)

export const THEMES: ThemeDefinition[] = [
  {
    id: 'elegant-gold',
    name: 'Elegant Black & Gold',
    tagline: 'The signature SAWABA look',
    swatch: { bg: '#0a0a0c', accent: '#c9a24b' },
    vars: { ...GOLD_ACCENT, ...NEUTRAL_SURFACE },
  },
  {
    id: 'navy-gold',
    name: 'Deep Navy & Gold',
    tagline: 'Midnight navy, classic gold',
    swatch: { bg: '#0a0d14', accent: '#c9a24b' },
    vars: {
      ...GOLD_ACCENT,
      ...surfaceRamp(
        '#1b2333', '#131a28', '#10151f', '#0d1119', '#0a0d14',
        '#121722', '#1a2130', '#0d1119',
      ),
    },
  },
  {
    id: 'charcoal-bronze',
    name: 'Charcoal & Bronze',
    tagline: 'Warm industrial bronze',
    swatch: { bg: '#0f0f13', accent: '#b98744' },
    vars: {
      ...accentRamp(
        '#f5e9d8', '#ecd5b5', '#e0bd8a', '#d2a469',
        '#b98744', '#9c6f36', '#7c5729', '#5f4220',
        '185, 135, 68',
      ),
      ...NEUTRAL_SURFACE,
    },
  },
  {
    id: 'green-gold',
    name: 'Dark Green & Gold',
    tagline: 'Racing green, refined gold',
    swatch: { bg: '#081009', accent: '#c9a24b' },
    vars: {
      ...GOLD_ACCENT,
      ...surfaceRamp(
        '#17291d', '#101f15', '#0d1a11', '#0a140c', '#081009',
        '#0d1710', '#132015', '#09110b',
      ),
    },
  },
  {
    id: 'burgundy-gold',
    name: 'Burgundy & Gold',
    tagline: 'Deep wine, timeless gold',
    swatch: { bg: '#0f0709', accent: '#c9a24b' },
    vars: {
      ...GOLD_ACCENT,
      ...surfaceRamp(
        '#2b181e', '#1f1115', '#180d10', '#140a0d', '#0f0709',
        '#170c10', '#20131a', '#100809',
      ),
    },
  },
  {
    id: 'royal-white',
    name: 'Royal Blue & White',
    tagline: 'Regal blue, crisp white',
    swatch: { bg: '#0a0f1e', accent: '#f2f4f8' },
    vars: {
      ...SILVER_ACCENT,
      ...surfaceRamp(
        '#1b2a52', '#141d3a', '#111830', '#0d1326', '#0a0f1e',
        '#101730', '#182142', '#0c1122',
      ),
    },
  },
  {
    id: 'brown-cream',
    name: 'Dark Brown & Cream',
    tagline: 'Espresso brown, soft cream',
    swatch: { bg: '#0e0a07', accent: '#dcc394' },
    vars: {
      ...accentRamp(
        '#faf3e3', '#f3e7cd', '#ecd9ac', '#e2c98c',
        '#dcc394', '#b89f6e', '#93794e', '#6f5b3a',
        '220, 195, 148',
      ),
      ...surfaceRamp(
        '#2a1f16', '#1e1610', '#17110c', '#130e0a', '#0e0a07',
        '#171009', '#201812', '#100b08',
      ),
    },
  },
  {
    id: 'black-white',
    name: 'Black & White',
    tagline: 'Monochrome, maximum edge',
    swatch: { bg: '#0a0a0c', accent: '#f2f2f2' },
    vars: {
      ...accentRamp(
        '#ffffff', '#f2f2f2', '#e5e5e5', '#cfcfcf',
        '#f2f2f2', '#b8b8b8', '#8f8f8f', '#666666',
        '240, 240, 240',
      ),
      ...NEUTRAL_SURFACE,
    },
  },
]

export const DEFAULT_THEME_ID = 'elegant-gold'

const STORAGE_KEY = 'sawaba-theme'
const VARS_KEY = 'sawaba-theme-vars'

function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && THEMES.some((t) => t.id === value)
}

export function getStoredThemeId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemeId(stored) ? stored : DEFAULT_THEME_ID
  } catch {
    return DEFAULT_THEME_ID
  }
}

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

/** Applies the palette to :root and persists it (id + resolved vars for the pre-React boot script). */
export function applyTheme(id: string): void {
  const theme = getTheme(id)
  const root = document.documentElement
  for (const [property, value] of Object.entries(theme.vars)) {
    root.style.setProperty(property, value)
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme.id)
    localStorage.setItem(VARS_KEY, JSON.stringify(theme.vars))
  } catch {
    // Private mode — theme applies for this session only.
  }
  notifyThemeListeners()
}

// ── Tiny external store so any component can read the active theme ──────────

const listeners = new Set<() => void>()

function notifyThemeListeners(): void {
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  // Keep multiple tabs in sync.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) notifyThemeListeners()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme(): { themeId: string; theme: ThemeDefinition; setTheme: (id: string) => void } {
  const themeId = useSyncExternalStore(
    subscribe,
    () => {
      const stored = getStoredThemeId()
      // Re-read on every snapshot so applyTheme() from anywhere updates consumers.
      return stored
    },
    () => DEFAULT_THEME_ID,
  )
  return {
    themeId,
    theme: getTheme(themeId),
    setTheme: applyTheme,
  }
}
