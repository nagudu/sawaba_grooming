import { Palette } from 'lucide-react'
import ThemePicker from '../../components/ui/ThemePicker'
import { PageHeader } from '../../components/admin/AdminUI'
import { useTheme } from '../../theme/theme'

/**
 * Admin → Appearance: choose the studio's accent palette. The selection is
 * per-device (each admin's browser) and applies everywhere instantly.
 */
export default function AdminAppearancePage() {
  const { theme } = useTheme()

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Appearance"
        subtitle="Choose the studio's color palette. Applies to the whole site and dashboards, and is remembered on this device."
      />

      <section className="card-lux p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10">
            <Palette className="h-5 w-5 text-gold-400" />
          </span>
          <div>
            <h2 className="font-display text-lg text-night-50">Theme</h2>
            <p className="text-xs text-night-500">
              Currently active: <span className="text-gold-400">{theme.name}</span>
            </p>
          </div>
        </div>
        <ThemePicker variant="inline" />
      </section>
    </div>
  )
}
