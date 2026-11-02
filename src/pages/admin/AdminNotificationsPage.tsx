import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Eye,
  EyeOff,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  Smartphone,
} from 'lucide-react'
import { Field, PageHeader, StatusBadge, Td, Th } from '../../components/admin/AdminUI'
import { Button } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_LABELS,
  notificationAdminApi,
  type NotificationChannel,
  type NotificationEvent,
  type NotificationHistoryRow,
  type NotificationSettings,
  type NotificationSettingsUpdate,
  type NotificationStatus,
  type NotificationTemplate,
} from '../../api/notificationAdmin'
import { cn } from '../../utils/cn'

type Tab = 'channels' | 'events' | 'templates' | 'history'

const TABS: { id: Tab; label: string }[] = [
  { id: 'channels', label: 'Channels & Credentials' },
  { id: 'events', label: 'Events' },
  { id: 'templates', label: 'Templates' },
  { id: 'history', label: 'History' },
]

const CHANNEL_ICONS: Record<NotificationChannel, typeof Mail> = {
  EMAIL: Mail,
  SMS: Smartphone,
  WHATSAPP: MessageCircle,
}

const ALL_EVENTS: NotificationEvent[] = [...NOTIFICATION_EVENTS]

function defaultMatrix(): Record<string, NotificationChannel[]> {
  const matrix: Record<string, NotificationChannel[]> = {}
  for (const event of ALL_EVENTS) matrix[event] = [...NOTIFICATION_CHANNELS]
  return matrix
}

/** A password-ish input with a show/hide toggle, showing a masked "unchanged" hint. */
function SecretField({
  label,
  hint,
  value,
  onChange,
  hasStored,
  last4,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  hasStored: boolean
  last4: string | null
}) {
  const [show, setShow] = useState(false)
  const placeholder = hasStored ? `••••••••${last4 ? ` (${last4})` : ''} — leave blank to keep` : 'Not set'
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="field pr-11"
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-night-500 hover:text-night-300"
          aria-label={show ? 'Hide value' : 'Show value'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-gold-500"
      />
      <span>
        <span className="block text-sm font-semibold text-night-100">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-night-500">{hint}</span>}
      </span>
    </label>
  )
}

export default function AdminNotificationsPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [tab, setTab] = useState<Tab>('channels')
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [matrix, setMatrix] = useState<Record<string, NotificationChannel[]>>(defaultMatrix())
  const [secrets, setSecrets] = useState({ smsApiKey: '', whatsappToken: '', emailApiKey: '', smtpPassword: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<NotificationChannel | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await notificationAdminApi.getSettings()
      setSettings(data)
      setMatrix(data.eventChannels ? { ...defaultMatrix(), ...data.eventChannels } : defaultMatrix())
      setSecrets({ smsApiKey: '', whatsappToken: '', emailApiKey: '', smtpPassword: '' })
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = (updates: Partial<NotificationSettings>) =>
    setSettings((current) => (current ? { ...current, ...updates } : current))

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const payload: NotificationSettingsUpdate = {
        emailEnabled: settings.emailEnabled,
        smsEnabled: settings.smsEnabled,
        whatsappEnabled: settings.whatsappEnabled,
        smsProvider: settings.smsProvider,
        smsSenderId: settings.smsSenderId,
        smsBaseUrl: settings.smsBaseUrl,
        whatsappPhoneNumberId: settings.whatsappPhoneNumberId,
        whatsappDisplayNumber: settings.whatsappDisplayNumber,
        whatsappApiVersion: settings.whatsappApiVersion,
        emailProvider: settings.emailProvider,
        fromEmail: settings.fromEmail,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUser: settings.smtpUser,
        smtpSecure: settings.smtpSecure,
        eventChannels: matrix,
      }
      if (secrets.smsApiKey.trim()) payload.smsApiKey = secrets.smsApiKey.trim()
      if (secrets.whatsappToken.trim()) payload.whatsappToken = secrets.whatsappToken.trim()
      if (secrets.emailApiKey.trim()) payload.emailApiKey = secrets.emailApiKey.trim()
      if (secrets.smtpPassword.trim()) payload.smtpPassword = secrets.smtpPassword.trim()

      const updated = await notificationAdminApi.updateSettings(payload)
      setSettings(updated)
      setSecrets({ smsApiKey: '', whatsappToken: '', emailApiKey: '', smtpPassword: '' })
      showToast('Notification settings saved.')
    } catch (error) {
      notifyError(error)
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async (channel: NotificationChannel) => {
    setTesting(channel)
    try {
      const result = await notificationAdminApi.sendTest({ channel })
      showToast(
        result.status === 'SENT'
          ? `Test ${channel} dispatched.`
          : `Test ${channel} not sent (${result.status ?? 'skipped'}) — check configuration.`,
        result.status === 'SENT' ? 'success' : 'error',
      )
    } catch (error) {
      notifyError(error)
    } finally {
      setTesting(null)
    }
  }

  const toggleMatrix = (event: string, channel: NotificationChannel) => {
    setMatrix((current) => {
      const enabled = current[event] ?? []
      return {
        ...current,
        [event]: enabled.includes(channel)
          ? enabled.filter((c) => c !== channel)
          : [...enabled, channel],
      }
    })
  }

  if (loading || !settings) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner label="Loading notification settings" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Notifications"
        subtitle="Configure SMS, WhatsApp and Email delivery, choose which events notify customers, and review delivery history."
        icon={<Bell className="h-5 w-5" />}
        action={
          <Button variant="gold" size="md" loading={saving} onClick={() => void save()}>
            <Save className="h-4 w-4" /> Save Settings
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-xl border px-4 py-2 text-sm font-semibold transition',
              tab === item.id
                ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
                : 'border-transparent text-night-400 hover:bg-night-900 hover:text-night-100',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'channels' && (
        <ChannelsTab
          settings={settings}
          patch={patch}
          secrets={secrets}
          setSecrets={setSecrets}
          testing={testing}
          onTest={sendTest}
        />
      )}

      {tab === 'events' && <EventsTab matrix={matrix} onToggle={toggleMatrix} settings={settings} />}

      {tab === 'templates' && <TemplatesTab notifyError={notifyError} showToast={showToast} />}

      {tab === 'history' && <HistoryTab notifyError={notifyError} showToast={showToast} />}

      <p className="mt-6 text-xs text-night-500">
        {settings.isEncryptionConfigured
          ? 'Credentials are encrypted at rest.'
          : 'ENCRYPTION_KEY is not set — credentials are stored unencrypted. Set it in the server environment.'}
      </p>
    </div>
  )
}

// ─── Channels & credentials ────────────────────────────────────────────────

function ChannelsTab({
  settings,
  patch,
  secrets,
  setSecrets,
  testing,
  onTest,
}: {
  settings: NotificationSettings
  patch: (updates: Partial<NotificationSettings>) => void
  secrets: { smsApiKey: string; whatsappToken: string; emailApiKey: string; smtpPassword: string }
  setSecrets: (updater: (current: typeof secrets) => typeof secrets) => void
  testing: NotificationChannel | null
  onTest: (channel: NotificationChannel) => void
}) {
  return (
    <div className="space-y-6">
      <section className="card-lux p-6">
        <h2 className="font-display text-lg text-night-50">Channels</h2>
        <p className="mt-1 text-sm text-night-400">
          Each channel is independent. A channel only sends when enabled here <em>and</em> the customer has opted in.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(['EMAIL', 'SMS', 'WHATSAPP'] as NotificationChannel[]).map((channel) => {
            const Icon = CHANNEL_ICONS[channel]
            const enabled =
              channel === 'EMAIL' ? settings.emailEnabled : channel === 'SMS' ? settings.smsEnabled : settings.whatsappEnabled
            const configured =
              channel === 'EMAIL'
                ? settings.isEmailConfigured
                : channel === 'SMS'
                  ? settings.isSmsConfigured
                  : settings.isWhatsAppConfigured
            return (
              <div key={channel} className="rounded-xl border border-night-800 bg-night-900/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-night-100">
                    <Icon className="h-4 w-4 text-gold-400" /> {channel}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      configured ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-night-600 bg-night-800 text-night-400',
                    )}
                  >
                    {configured ? 'Configured' : 'Not configured'}
                  </span>
                </div>
                <div className="mt-4">
                  <Toggle
                    checked={enabled}
                    label="Enabled"
                    onChange={(value) =>
                      patch(
                        channel === 'EMAIL'
                          ? { emailEnabled: value }
                          : channel === 'SMS'
                            ? { smsEnabled: value }
                            : { whatsappEnabled: value },
                      )
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  loading={testing === channel}
                  disabled={!configured}
                  onClick={() => onTest(channel)}
                >
                  <Send className="h-3.5 w-3.5" /> Send test
                </Button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card-lux p-6">
        <h2 className="font-display text-lg text-night-50">SMS — Termii</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Sender ID">
            <input
              className="field"
              value={settings.smsSenderId ?? ''}
              onChange={(event) => patch({ smsSenderId: event.target.value })}
              placeholder="e.g. SAWABA"
            />
          </Field>
          <Field label="API base URL" hint="Leave blank to use the default Termii endpoint.">
            <input
              className="field"
              value={settings.smsBaseUrl ?? ''}
              onChange={(event) => patch({ smsBaseUrl: event.target.value })}
              placeholder="https://api.ng.termii.com"
            />
          </Field>
          <SecretField
            label="API key"
            value={secrets.smsApiKey}
            onChange={(value) => setSecrets((current) => ({ ...current, smsApiKey: value }))}
            hasStored={settings.hasSmsApiKey}
            last4={settings.smsApiKeyLast4}
          />
        </div>
      </section>

      <section className="card-lux p-6">
        <h2 className="font-display text-lg text-night-50">WhatsApp — Meta Cloud API</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Phone number ID">
            <input
              className="field"
              value={settings.whatsappPhoneNumberId ?? ''}
              onChange={(event) => patch({ whatsappPhoneNumberId: event.target.value })}
            />
          </Field>
          <Field label="Display number">
            <input
              className="field"
              value={settings.whatsappDisplayNumber ?? ''}
              onChange={(event) => patch({ whatsappDisplayNumber: event.target.value })}
              placeholder="e.g. +234 801 234 5678"
            />
          </Field>
          <Field label="API version" hint="Defaults to v19.0 when blank.">
            <input
              className="field"
              value={settings.whatsappApiVersion ?? ''}
              onChange={(event) => patch({ whatsappApiVersion: event.target.value })}
              placeholder="v19.0"
            />
          </Field>
          <SecretField
            label="Access token"
            value={secrets.whatsappToken}
            onChange={(value) => setSecrets((current) => ({ ...current, whatsappToken: value }))}
            hasStored={settings.hasWhatsappToken}
            last4={settings.whatsappTokenLast4}
          />
        </div>
      </section>

      <section className="card-lux p-6">
        <h2 className="font-display text-lg text-night-50">Email</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Provider">
            <select
              className="field"
              value={settings.emailProvider}
              onChange={(event) => patch({ emailProvider: event.target.value })}
            >
              <option value="resend">Resend (recommended)</option>
              <option value="smtp">SMTP</option>
            </select>
          </Field>
          <Field label="From address">
            <input
              className="field"
              value={settings.fromEmail ?? ''}
              onChange={(event) => patch({ fromEmail: event.target.value })}
              placeholder="no-reply@sawabasalon.com"
            />
          </Field>
          <SecretField
            label="Resend API key"
            value={secrets.emailApiKey}
            onChange={(value) => setSecrets((current) => ({ ...current, emailApiKey: value }))}
            hasStored={settings.hasEmailApiKey}
            last4={settings.emailApiKeyLast4}
          />
        </div>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-night-400">SMTP (fallback)</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Host">
            <input
              className="field"
              value={settings.smtpHost ?? ''}
              onChange={(event) => patch({ smtpHost: event.target.value })}
              placeholder="smtp.example.com"
            />
          </Field>
          <Field label="Port">
            <input
              type="number"
              className="field"
              value={settings.smtpPort ?? ''}
              onChange={(event) => patch({ smtpPort: event.target.value ? Number(event.target.value) : null })}
              placeholder="587"
            />
          </Field>
          <Field label="Username">
            <input
              className="field"
              value={settings.smtpUser ?? ''}
              onChange={(event) => patch({ smtpUser: event.target.value })}
            />
          </Field>
          <SecretField
            label="Password"
            value={secrets.smtpPassword}
            onChange={(value) => setSecrets((current) => ({ ...current, smtpPassword: value }))}
            hasStored={settings.hasSmtpPassword}
            last4={settings.smtpPasswordLast4}
          />
          <div className="sm:col-span-2">
            <Toggle
              checked={settings.smtpSecure}
              label="Use TLS (port 465)"
              onChange={(value) => patch({ smtpSecure: value })}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Events matrix ─────────────────────────────────────────────────────────

function EventsTab({
  matrix,
  onToggle,
  settings,
}: {
  matrix: Record<string, NotificationChannel[]>
  onToggle: (event: string, channel: NotificationChannel) => void
  settings: NotificationSettings
}) {
  return (
    <section className="card-lux p-6">
      <h2 className="font-display text-lg text-night-50">Events</h2>
      <p className="mt-1 text-sm text-night-400">
        Choose which channels notify the customer for each event. A channel also needs to be enabled and configured above,
        and the customer must be opted in.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-night-800">
              <Th>Event</Th>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <Th key={channel} className="text-center">
                  {channel}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_EVENTS.map((event) => (
              <tr key={event} className="border-b border-night-900">
                <Td>{NOTIFICATION_EVENT_LABELS[event] ?? event}</Td>
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const checked = (matrix[event] ?? []).includes(channel)
                  const channelReady =
                    channel === 'EMAIL'
                      ? settings.isEmailConfigured
                      : channel === 'SMS'
                        ? settings.isSmsConfigured
                        : settings.isWhatsAppConfigured
                  return (
                    <td key={channel} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!channelReady}
                        onChange={() => onToggle(event, channel)}
                        className="h-4 w-4 accent-gold-500 disabled:opacity-30"
                        aria-label={`${event} via ${channel}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Templates ─────────────────────────────────────────────────────────────

function TemplatesTab({
  notifyError,
  showToast,
}: {
  notifyError: (error: unknown) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}) {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    event: 'BOOKING_CONFIRMATION' as NotificationEvent,
    channel: 'EMAIL' as NotificationChannel,
    name: '',
    subject: '',
    body: '',
    isActive: true,
  })

  const load = async () => {
    setLoading(true)
    try {
      setTemplates(await notificationAdminApi.templates())
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const editTemplate = (template: NotificationTemplate) => {
    setForm({
      event: template.event,
      channel: template.channel,
      name: template.name,
      subject: template.subject,
      body: template.body,
      isActive: template.isActive,
    })
  }

  const reset = () =>
    setForm({ event: 'BOOKING_CONFIRMATION', channel: 'EMAIL', name: '', subject: '', body: '', isActive: true })

  const saveTemplate = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      showToast('Name, subject and body are required.', 'error')
      return
    }
    setSaving(true)
    try {
      await notificationAdminApi.upsertTemplate({
        name: form.name.trim(),
        event: form.event,
        channel: form.channel,
        subject: form.subject.trim(),
        body: form.body.trim(),
        isActive: form.isActive,
      })
      showToast('Template saved.')
      await load()
    } catch (error) {
      notifyError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="card-lux p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-night-50">Templates</h2>
          <Button variant="outline" size="sm" onClick={reset}>
            New template
          </Button>
        </div>
        <p className="mt-1 text-sm text-night-400">
          Per-event / per-channel copy. Without a template, a branded default is used.
        </p>
        {loading ? (
          <div className="py-10">
            <LoadingSpinner label="Loading templates" />
          </div>
        ) : templates.length === 0 ? (
          <p className="py-8 text-sm text-night-500">No custom templates yet — defaults are in use.</p>
        ) : (
          <ul className="mt-4 divide-y divide-night-900">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-night-100">{template.name}</p>
                  <p className="text-xs text-night-500">
                    {NOTIFICATION_EVENT_LABELS[template.event] ?? template.event} · {template.channel}
                    {template.isActive ? '' : ' · inactive'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => editTemplate(template)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-lux p-6">
        <h2 className="font-display text-lg text-night-50">Editor</h2>
        <div className="mt-4 space-y-4">
          <Field label="Event">
            <select
              className="field"
              value={form.event}
              onChange={(event) => setForm((f) => ({ ...f, event: event.target.value as NotificationEvent }))}
            >
              {ALL_EVENTS.map((event) => (
                <option key={event} value={event}>
                  {NOTIFICATION_EVENT_LABELS[event] ?? event}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Channel">
            <select
              className="field"
              value={form.channel}
              onChange={(event) => setForm((f) => ({ ...f, channel: event.target.value as NotificationChannel }))}
            >
              {NOTIFICATION_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Template name" hint="Unique identifier for this template.">
            <input
              className="field"
              value={form.name}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              placeholder="e.g. booking-confirmation-email"
            />
          </Field>
          <Field label="Subject">
            <input
              className="field"
              value={form.subject}
              onChange={(event) => setForm((f) => ({ ...f, subject: event.target.value }))}
            />
          </Field>
          <Field label="Body">
            <textarea
              className="field min-h-[160px]"
              value={form.body}
              onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))}
            />
          </Field>
          <Toggle
            checked={form.isActive}
            label="Active"
            onChange={(value) => setForm((f) => ({ ...f, isActive: value }))}
          />
          <Button variant="gold" size="md" loading={saving} onClick={() => void saveTemplate()}>
            <Save className="h-4 w-4" /> Save Template
          </Button>
        </div>
      </section>
    </div>
  )
}

// ─── History ───────────────────────────────────────────────────────────────

function HistoryTab({
  notifyError,
  showToast,
}: {
  notifyError: (error: unknown) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}) {
  const [rows, setRows] = useState<NotificationHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<NotificationStatus | ''>('')
  const [channel, setChannel] = useState<NotificationChannel | ''>('')
  const [retrying, setRetrying] = useState<number | null>(null)

  const perPage = 20
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total])

  const load = async () => {
    setLoading(true)
    try {
      const result = await notificationAdminApi.history({
        status: status || undefined,
        channel: channel || undefined,
        page,
        perPage,
      })
      setRows(result.items)
      setTotal(result.total)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, channel])

  const retry = async (id: number) => {
    setRetrying(id)
    try {
      const result = await notificationAdminApi.retry(id)
      showToast(result.status === 'SENT' ? 'Notification re-sent.' : `Retry result: ${result.status ?? 'skipped'}.`)
      await load()
    } catch (error) {
      notifyError(error)
    } finally {
      setRetrying(null)
    }
  }

  return (
    <section className="card-lux p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-night-50">Delivery history</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-auto" value={status} onChange={(event) => { setStatus(event.target.value as NotificationStatus | ''); setPage(1) }}>
            <option value="">All statuses</option>
            {(['SENT', 'FAILED', 'SKIPPED', 'PENDING'] as NotificationStatus[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="field w-auto" value={channel} onChange={(event) => { setChannel(event.target.value as NotificationChannel | ''); setPage(1) }}>
            <option value="">All channels</option>
            {NOTIFICATION_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10">
          <LoadingSpinner label="Loading history" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-sm text-night-500">No notifications match these filters.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-night-800">
                <Th>When</Th>
                <Th>Event</Th>
                <Th>Channel</Th>
                <Th>Recipient</Th>
                <Th>Status</Th>
                <Th>Detail</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-night-900">
                  <Td className="whitespace-nowrap text-xs text-night-400">
                    {new Date(row.createdAt).toLocaleString()}
                  </Td>
                  <Td className="text-xs">{NOTIFICATION_EVENT_LABELS[row.type] ?? row.type}</Td>
                  <Td className="text-xs">{row.channel}</Td>
                  <Td className="text-xs">
                    {row.customer?.fullName ?? '—'}
                    {row.customer?.phone && <span className="block text-night-500">{row.customer.phone}</span>}
                  </Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                  <Td className="max-w-[220px] text-xs text-night-500">
                    {row.error ?? row.providerMessageId ?? row.provider ?? '—'}
                  </Td>
                  <Td>
                    {row.status === 'FAILED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        loading={retrying === row.id}
                        onClick={() => void retry(row.id)}
                      >
                        Retry
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-night-400">
          <span>
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
