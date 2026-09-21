import { useEffect, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { THEMES, useTheme } from '../../theme/theme'
import { cn } from '../../utils/cn'

/**
 * Theme picker — curated premium palettes only. Two variants:
 *  - popover: compact trigger for the navbar
 *  - inline : full labeled grid for settings sections
 */
export default function ThemePicker({ variant = 'popover' }: { variant?: 'popover' | 'inline' }) {
  const { themeId, theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape (popover variant only).
  useEffect(() => {
    if (!open || variant !== 'popover') return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, variant])

  if (variant === 'popover') {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Change theme color"
          title={`Theme: ${theme.name}`}
          className="flex items-center gap-2 rounded-lg p-2 text-night-300 transition-colors hover:text-gold-400"
        >
          <Palette className="h-5 w-5" />
          <span className="hidden h-4 w-4 rounded-full border border-night-600 lg:inline-block" style={{ background: theme.swatch.accent }} />
        </button>

        {open && (
          <div
            role="listbox"
            aria-label="Theme color"
            className="absolute right-0 top-full z-[70] mt-2 w-72 overflow-hidden rounded-xl border border-night-700 bg-charcoal shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8)]"
          >
            <p className="border-b border-night-800 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-500">
              Studio Appearance
            </p>
            <div className="max-h-[320px] overflow-y-auto p-2">
              {THEMES.map((item) => {
                const active = item.id === themeId
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setTheme(item.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      active ? 'bg-gold-500/10' : 'hover:bg-night-800/70',
                    )}
                  >
                    <span
                      className="flex h-8 w-12 shrink-0 overflow-hidden rounded-md border border-night-600"
                      aria-hidden="true"
                    >
                      <span className="h-full w-1/2" style={{ background: item.swatch.bg }} />
                      <span className="h-full w-1/2" style={{ background: item.swatch.accent }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm font-medium', active ? 'text-gold-300' : 'text-night-100')}>
                        {item.name}
                      </span>
                      <span className="block truncate text-[11px] text-night-500">{item.tagline}</span>
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-gold-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((item) => {
          const active = item.id === themeId
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-4 rounded-xl border p-4 text-left transition-all',
                active
                  ? 'border-gold-500 bg-gold-500/10'
                  : 'border-night-700 bg-night-900 hover:border-night-500',
              )}
            >
              <span
                className="flex h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-night-600"
                aria-hidden="true"
              >
                <span className="h-full w-1/2" style={{ background: item.swatch.bg }} />
                <span className="h-full w-1/2" style={{ background: item.swatch.accent }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-semibold', active ? 'text-gold-300' : 'text-night-100')}>
                  {item.name}
                </span>
                <span className="block text-xs text-night-500">{item.tagline}</span>
              </span>
              {active && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500">
                  <Check className="h-3.5 w-3.5 text-night-950" />
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-night-500">
        Applies instantly across the whole site and is remembered on this device.
      </p>
    </div>
  )
}
