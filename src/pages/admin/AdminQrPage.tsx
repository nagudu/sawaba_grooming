import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  Phone,
  QrCode,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Scissors,
  ShieldOff,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react'
import { api } from '../../api'
import {
  qrApi,
  type QrActivityStats,
  type QrScanLogItem,
} from '../../api/qr'
import type { QrOutcome, QrScanHistoryEntry, QrScanResult } from '../../api/qrTypes'
import {
  ConfirmDialog,
  EmptyRow,
  PageHeader,
  StatCard,
  StatusBadge,
  Td,
  Th,
} from '../../components/admin/AdminUI'
import Modal from '../../components/ui/Modal'
import QrCameraScanner from '../../components/qr/QrCameraScanner'
import { Button } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { formatDate, formatPrice, formatTime } from '../../utils/format'
import { qrBookingStatusLabel, qrPaymentStatusLabel } from '../../utils/scanStatus'
import { cn } from '../../utils/cn'

const OUTCOME_STYLE: Record<QrOutcome, { ring: string; badge: string; label: string }> = {
  VALID: { ring: 'border-emerald-500/50 bg-emerald-500/[0.07]', badge: 'bg-emerald-500/15 text-emerald-300', label: 'Valid booking' },
  CHECKED_IN: { ring: 'border-emerald-500/50 bg-emerald-500/[0.07]', badge: 'bg-emerald-500/15 text-emerald-300', label: 'Checked in' },
  ALREADY_CHECKED_IN: { ring: 'border-sky-500/50 bg-sky-500/[0.07]', badge: 'bg-sky-500/15 text-sky-300', label: 'Already checked in' },
  PAYMENT_NOT_VERIFIED: { ring: 'border-amber-500/50 bg-amber-500/[0.07]', badge: 'bg-amber-500/15 text-amber-300', label: 'Payment not verified' },
  PAYMENT_MISMATCH: { ring: 'border-amber-500/50 bg-amber-500/[0.07]', badge: 'bg-amber-500/15 text-amber-300', label: 'Payment mismatch' },
  CANCELLED: { ring: 'border-red-500/50 bg-red-500/[0.07]', badge: 'bg-red-500/15 text-red-300', label: 'Cancelled' },
  REVOKED: { ring: 'border-red-500/50 bg-red-500/[0.07]', badge: 'bg-red-500/15 text-red-300', label: 'QR revoked' },
  UNAUTHORIZED: { ring: 'border-red-500/50 bg-red-500/[0.07]', badge: 'bg-red-500/15 text-red-300', label: 'Unauthorized' },
  NOT_FOUND: { ring: 'border-night-700 bg-night-900/60', badge: 'bg-night-800 text-night-300', label: 'Not found' },
  INVALID_TOKEN: { ring: 'border-night-700 bg-night-900/60', badge: 'bg-night-800 text-night-300', label: 'Unrecognised code' },
}

const PAYMENT_METHOD: Record<string, string> = {
  CASH: 'Cash',
  OPAY: 'OPay',
  BANK_TRANSFER: 'Bank transfer',
  ONLINE: 'Online',
  OTHER: 'Other',
}

const TERMINAL_OUTCOMES: QrOutcome[] = ['NOT_FOUND', 'INVALID_TOKEN', 'UNAUTHORIZED', 'REVOKED']

// ─── Scanner tab ──────────────────────────────────────────────────────────────

function QrScannerPanel() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [result, setResult] = useState<QrScanResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState<{ token?: string; reference?: string } | null>(null)
  const [history, setHistory] = useState<QrScanHistoryEntry[]>([])

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)

  const applyQuery = useCallback(
    async (query: { token?: string; reference?: string }) => {
      setBusy(true)
      setError(null)
      try {
        const next = await qrApi.adminValidate(query)
        setLastQuery(query)
        setResult(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not verify that code.')
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const refresh = useCallback(async () => {
    if (lastQuery) await applyQuery(lastQuery)
  }, [applyQuery, lastQuery])

  // Auto-verify a booking when opened from a scanned QR link
  // (/admin/qr?token=<token>) so a native-camera scan lands straight on details.
  const [searchParams] = useSearchParams()
  const prefill = useMemo<{ token?: string; reference?: string } | null>(() => {
    const token = searchParams.get('token')?.trim()
    if (token) return { token }
    const reference = (searchParams.get('ref') ?? searchParams.get('reference'))?.trim()
    return reference ? { reference } : null
  }, [searchParams])
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !prefill) return
    prefilled.current = true
    void applyQuery(prefill)
  }, [applyQuery, prefill])

  // Load the check-in / scan history whenever a booking surfaces.
  const appointmentId = result?.appointment?.id ?? null
  useEffect(() => {
    if (!appointmentId) {
      setHistory([])
      return
    }
    let active = true
    qrApi
      .appointmentHistory(appointmentId)
      .then((rows) => {
        if (active) setHistory(rows)
      })
      .catch(() => {
        if (active) setHistory([])
      })
    return () => {
      active = false
    }
  }, [appointmentId, busy])

  const handleCheckIn = async () => {
    if (!result?.appointment || busy) return
    setBusy(true)
    try {
      const next = await qrApi.adminCheckIn(result.appointment.id)
      setResult(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyPayment = async () => {
    const paymentId = result?.appointment?.payment?.id
    if (!paymentId || busy) return
    setBusy(true)
    try {
      await api.post(`/api/admin/payments/${paymentId}/verify`)
      showToast('Payment verified. The booking is now ready for service.')
      await refresh()
    } catch (err) {
      notifyError(err)
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmCash = async () => {
    const paymentId = result?.appointment?.payment?.id
    if (!paymentId || busy) return
    setBusy(true)
    try {
      await api.post(`/api/admin/payments/${paymentId}/confirm-cash`, {
        note: 'Cash received at salon (QR check-in).',
      })
      showToast('Cash marked as received.')
      await refresh()
    } catch (err) {
      notifyError(err)
    } finally {
      setBusy(false)
    }
  }

  const handleRejectPayment = async () => {
    const paymentId = result?.appointment?.payment?.id
    if (!paymentId || busy) return
    if (rejectReason.trim().length < 5) {
      showToast('Please provide a reason (min 5 characters).', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post(`/api/admin/payments/${paymentId}/reject`, { reason: rejectReason.trim() })
      showToast('Payment rejected. The customer can resubmit.')
      setRejectOpen(false)
      setRejectReason('')
      await refresh()
    } catch (err) {
      notifyError(err)
    } finally {
      setBusy(false)
    }
  }

  const doRegenerate = async () => {
    if (!appointmentId || busy) return
    setBusy(true)
    try {
      await qrApi.regenerate(appointmentId)
      showToast('New QR generated. The previous code no longer works.')
      setRegenerating(false)
      await refresh()
    } catch (err) {
      notifyError(err)
    } finally {
      setBusy(false)
    }
  }

  const doRevoke = async () => {
    if (!appointmentId || busy) return
    setBusy(true)
    try {
      await qrApi.revoke(appointmentId)
      showToast('QR code revoked.')
      setRevoking(false)
      await refresh()
    } catch (err) {
      notifyError(err)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError(null)
    setLastQuery(null)
    setHistory([])
  }

  const style = result ? OUTCOME_STYLE[result.outcome] : null
  const apt = result?.appointment ?? null
  const payment = apt?.payment ?? null
  const isTerminal = result ? TERMINAL_OUTCOMES.includes(result.outcome) : false
  const canVerify = payment?.status === 'PENDING_VERIFICATION'
  const canConfirmCash =
    payment?.method === 'CASH' &&
    payment.status !== 'PAID' &&
    apt?.status !== 'CANCELLED' &&
    apt?.status !== 'REFUNDED'

  return (
    <div className="space-y-5">
      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {!result && (
        <QrCameraScanner
          onDecode={(token) => void applyQuery({ token })}
          onManual={(reference) => void applyQuery({ reference })}
        />
      )}

      {busy && (
        <p className="flex items-center justify-center gap-2 text-sm text-gold-300">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Working…
        </p>
      )}

      {result && style && (
        <div className={cn('space-y-4 rounded-2xl border p-5', style.ring)}>
          <div className="flex items-start gap-3">
            {result.valid ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
            ) : isTerminal ? (
              <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
            )}
            <div className="min-w-0 flex-1">
              <span className={cn('inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider', style.badge)}>
                {style.label}
              </span>
              <p className="mt-2 text-sm text-night-200">{result.message}</p>
            </div>
          </div>

          {apt && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info icon={<UserRound className="h-4 w-4" />} label="Customer" value={apt.customerName ?? '—'} />
              <Info
                icon={<Phone className="h-4 w-4" />}
                label="Phone"
                value={apt.customerPhone ? <a href={`tel:${apt.customerPhone}`} className="text-gold-400">{apt.customerPhone}</a> : '—'}
              />
              <Info icon={<Mail className="h-4 w-4" />} label="Email" value={apt.customerEmail ?? '—'} />
              <Info icon={<Scissors className="h-4 w-4" />} label="Service" value={apt.service ? `${apt.service.name} · ${apt.service.duration} min` : '—'} />
              <Info icon={<CalendarDays className="h-4 w-4" />} label="Date" value={formatDate(apt.appointmentDate)} />
              <Info icon={<Clock className="h-4 w-4" />} label="Time" value={formatTime(apt.appointmentTime)} />
              <Info icon={<UserRound className="h-4 w-4" />} label="Barber" value={apt.barberName ?? '—'} />
              <Info icon={<FileText className="h-4 w-4" />} label="Reference" value={apt.referenceCode ?? `#${apt.id}`} />
              <Info icon={<Wallet className="h-4 w-4" />} label="Amount" value={formatPrice(apt.totalAmount)} />
              <Info
                icon={<BadgeCheck className="h-4 w-4" />}
                label="Payment status"
                value={qrPaymentStatusLabel(result.paymentStatus)}
              />
              {payment?.method && (
                <Info icon={<Wallet className="h-4 w-4" />} label="Method" value={PAYMENT_METHOD[payment.method] ?? payment.method} />
              )}
              {payment?.transactionReference && (
                <Info icon={<FileText className="h-4 w-4" />} label="Transaction ref" value={payment.transactionReference} />
              )}
              {apt.notes && (
                <div className="sm:col-span-2">
                  <Info icon={<FileText className="h-4 w-4" />} label="Customer instructions" value={apt.notes} />
                </div>
              )}
              {payment?.rejectionReason && (
                <div className="sm:col-span-2">
                  <Info icon={<XCircle className="h-4 w-4" />} label="Rejection reason" value={payment.rejectionReason} />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-night-800 pt-4">
            <span className="rounded-full border border-night-700 bg-night-900 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-night-300">
              Booking: {qrBookingStatusLabel(result)}
            </span>
            {result.checkedIn && (
              <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                Checked in
              </span>
            )}
          </div>

          {/* Payment-verification workflow (never triggered by scanning itself) */}
          {(canVerify || canConfirmCash || payment?.receiptUrl) && (
            <div className="space-y-3 rounded-xl border border-night-800 bg-night-950/40 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                Payment verification
              </p>
              <p className="text-xs text-night-400">
                Scanning only reveals payment status. Marking a payment as paid requires the
                authorised action below.
              </p>
              <div className="flex flex-wrap gap-2">
                {payment?.receiptUrl && (
                  <a
                    href={payment.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-sm font-semibold text-night-200 hover:text-night-100"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View receipt
                  </a>
                )}
                {canVerify && (
                  <button
                    onClick={() => void handleVerifyPayment()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-gold-400 disabled:opacity-60"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    Verify payment
                  </button>
                )}
                {canVerify && (
                  <button
                    onClick={() => setRejectOpen(true)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject payment
                  </button>
                )}
                {canConfirmCash && (
                  <button
                    onClick={() => void handleConfirmCash()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-emerald-400 disabled:opacity-60"
                  >
                    <Banknote className="h-4 w-4" />
                    Confirm cash received
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {result.canCheckIn && (
              <button
                onClick={() => void handleCheckIn()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Check in customer
              </button>
            )}
            {apt && (
              <>
                <button
                  onClick={() => setRegenerating(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-sm font-semibold text-night-300 hover:text-night-100 disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" />
                  Regenerate QR
                </button>
                <button
                  onClick={() => setRevoking(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-sm font-semibold text-night-300 hover:text-night-100 disabled:opacity-60"
                >
                  <ShieldOff className="h-4 w-4" />
                  Revoke QR
                </button>
              </>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-sm font-semibold text-night-300 hover:text-night-100"
            >
              <RefreshCw className="h-4 w-4" />
              Scan another
            </button>
          </div>

          {/* Check-in history */}
          {apt && (
            <div className="rounded-xl border border-night-800 bg-night-950/40 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                Check-in history
              </p>
              {history.length === 0 ? (
                <p className="text-xs text-night-500">No scans recorded for this booking yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-night-200">{entry.outcome.replace(/_/g, ' ')}</p>
                        <p className="text-night-500">
                          {entry.barberName ? `Barber: ${entry.barberName}` : entry.adminId ? `Admin #${entry.adminId}` : entry.actorRole}
                          {entry.detail ? ` · ${entry.detail}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-night-500">{formatStamp(entry.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject payment" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-night-300">
            Explain why this payment is being rejected. The appointment returns to
            Payment Rejected so the customer can resubmit.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="e.g. Receipt amount does not match the service price."
            className="w-full rounded-lg border border-night-700 bg-night-950 px-3 py-2 text-sm text-night-100 placeholder:text-night-600 focus:border-gold-500/60 focus:outline-none"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" size="md" onClick={() => setRejectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="gold"
              size="md"
              onClick={() => void handleRejectPayment()}
              loading={busy}
              className="bg-red-500 hover:bg-red-400 shadow-none"
            >
              Reject payment
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={regenerating}
        onClose={() => setRegenerating(false)}
        onConfirm={() => void doRegenerate()}
        busy={busy}
        confirmLabel="Regenerate QR"
        title="Regenerate QR code?"
        description={`A new check-in QR will be issued for ${
          apt?.referenceCode ?? (appointmentId ? `appointment #${appointmentId}` : 'this booking')
        }. The customer's existing code will stop working immediately.`}
      />

      <ConfirmDialog
        open={revoking}
        onClose={() => setRevoking(false)}
        onConfirm={() => void doRevoke()}
        busy={busy}
        confirmLabel="Revoke QR"
        title="Revoke QR code?"
        description={`The check-in QR for ${
          apt?.referenceCode ?? (appointmentId ? `appointment #${appointmentId}` : 'this booking')
        } will be disabled until a new one is generated.`}
      />
    </div>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-night-800 bg-night-950/40 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-night-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-night-100 break-words">{value}</p>
    </div>
  )
}

// ─── Activity tab ─────────────────────────────────────────────────────────────

const OUTCOME_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All outcomes' },
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'VALID', label: 'Valid scans' },
  { value: 'ALREADY_CHECKED_IN', label: 'Duplicate' },
  { value: 'PAYMENT_NOT_VERIFIED', label: 'Payment not verified' },
  { value: 'PAYMENT_MISMATCH', label: 'Payment mismatch' },
  { value: 'UNAUTHORIZED', label: 'Unauthorized' },
  { value: 'REVOKED', label: 'Revoked' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NOT_FOUND', label: 'Not found' },
  { value: 'INVALID_TOKEN', label: 'Invalid code' },
]

const SOURCE_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All sources' },
  { value: 'QR', label: 'QR scan' },
  { value: 'MANUAL', label: 'Manual lookup' },
  { value: 'ADMIN', label: 'Admin action' },
]

const OUTCOME_BADGE: Record<string, string> = {
  CHECKED_IN: 'CHECKED_IN',
  VALID: 'PAID',
  ALREADY_CHECKED_IN: 'IN_PROGRESS',
  PAYMENT_NOT_VERIFIED: 'PENDING',
  PAYMENT_MISMATCH: 'PAYMENT_REJECTED',
  REVOKED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  UNAUTHORIZED: 'PAYMENT_REJECTED',
  NOT_FOUND: 'UNPAID',
  INVALID_TOKEN: 'UNPAID',
}

function formatStamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function QrActivityPanel() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [items, setItems] = useState<QrScanLogItem[]>([])
  const [stats, setStats] = useState<QrActivityStats | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [outcome, setOutcome] = useState('')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState<QrScanLogItem | null>(null)
  const [revoking, setRevoking] = useState<QrScanLogItem | null>(null)

  const perPage = 15

  const load = async (targetPage = page, targetOutcome = outcome, targetSource = source) => {
    setLoading(true)
    try {
      const data = await qrApi.activity({
        page: targetPage,
        perPage,
        outcome: targetOutcome || undefined,
        source: targetSource || undefined,
      })
      setItems(data.items)
      setStats(data.stats)
      setTotal(data.total)
      setPage(data.page)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, outcome, source)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, source])

  const doRegenerate = async () => {
    if (!regenerating?.appointmentId) return
    setBusy(true)
    try {
      await qrApi.regenerate(regenerating.appointmentId)
      showToast('New QR generated. The previous code no longer works.')
      setRegenerating(null)
      void load(page)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const doRevoke = async () => {
    if (!revoking?.appointmentId) return
    setBusy(true)
    try {
      await qrApi.revoke(revoking.appointmentId)
      showToast('QR code revoked.')
      setRevoking(null)
      void load(page)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  const selectClass =
    'rounded-lg border border-night-700 bg-night-900 px-3 py-2 text-sm text-night-200 focus:border-gold-500/60 focus:outline-none'

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total scans" value={stats.total} icon={<ScanLine className="h-5 w-5" />} />
          <StatCard label="Valid" value={stats.valid} icon={<QrCode className="h-5 w-5" />} accent />
          <StatCard label="Rejected" value={stats.rejected} icon={<ShieldOff className="h-5 w-5" />} />
          <StatCard label="Check-ins" value={stats.checkIns} icon={<ScanLine className="h-5 w-5" />} />
          <StatCard label="Last 7 days" value={stats.last7Days} icon={<RefreshCw className="h-5 w-5" />} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {OUTCOME_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select className={selectClass} value={source} onChange={(e) => setSource(e.target.value)}>
          {SOURCE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={() => void load(page)} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="card-lux overflow-hidden">
        <div className="flex items-center justify-between border-b border-night-800 px-6 py-4">
          <h2 className="font-display text-lg text-night-50">
            {total} scan{total === 1 ? '' : 's'}
          </h2>
          <span className="text-xs text-night-500">
            Page {page} of {Math.max(1, Math.ceil(total / perPage))}
          </span>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading scan activity" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>When</Th>
                  <Th>Outcome</Th>
                  <Th>Source</Th>
                  <Th>Booking</Th>
                  <Th>Actor</Th>
                  <Th>Detail</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {items.length === 0 ? (
                  <EmptyRow colSpan={7} message="No QR scan activity yet." />
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-night-900/60">
                      <Td>
                        <p className="whitespace-nowrap text-night-200">{formatStamp(item.createdAt)}</p>
                        {item.ip && <p className="text-xs text-night-500">{item.ip}</p>}
                      </Td>
                      <Td>
                        <StatusBadge status={OUTCOME_BADGE[item.outcome] ?? item.outcome} label={item.outcome} />
                      </Td>
                      <Td>
                        <span className="text-xs font-semibold uppercase tracking-wider text-night-400">
                          {item.source}
                        </span>
                      </Td>
                      <Td>
                        <p className="font-mono text-xs text-night-200">
                          {item.referenceCode ?? (item.appointmentId ? `#${item.appointmentId}` : '—')}
                        </p>
                        {item.customerName && <p className="text-xs text-night-500">{item.customerName}</p>}
                      </Td>
                      <Td>
                        {item.barberName ? (
                          <p className="text-night-200">{item.barberName}</p>
                        ) : item.adminId ? (
                          <p className="text-night-200">Admin #{item.adminId}</p>
                        ) : (
                          <p className="text-night-500">—</p>
                        )}
                      </Td>
                      <Td>
                        <p className="max-w-[240px] text-xs text-night-400">{item.detail ?? '—'}</p>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-2">
                          {item.appointmentId && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setRegenerating(item)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                                Regenerate
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setRevoking(item)}>
                                <ShieldOff className="h-3.5 w-3.5" />
                                Revoke
                              </Button>
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > perPage && (
          <div className="flex items-center justify-end gap-2 border-t border-night-800 bg-night-900/40 px-6 py-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
              Previous
            </Button>
            <span className="px-2 text-sm text-night-400">
              {page} / {Math.max(1, Math.ceil(total / perPage))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(total / perPage)}
              onClick={() => void load(page + 1)}
            >
              Next
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={regenerating !== null}
          onClose={() => setRegenerating(null)}
          onConfirm={() => void doRegenerate()}
          busy={busy}
          confirmLabel="Regenerate QR"
          title="Regenerate QR code?"
          description={`A new check-in QR will be issued for ${
            regenerating?.referenceCode ?? `appointment #${regenerating?.appointmentId}`
          }. The customer's existing code will stop working immediately.`}
        />

        <ConfirmDialog
          open={revoking !== null}
          onClose={() => setRevoking(null)}
          onConfirm={() => void doRevoke()}
          busy={busy}
          confirmLabel="Revoke QR"
          title="Revoke QR code?"
          description={`The check-in QR for ${
            revoking?.referenceCode ?? `appointment #${revoking?.appointmentId}`
          } will be disabled until a new one is generated.`}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'scanner' | 'activity'

export default function AdminQrPage() {
  const [tab, setTab] = useState<Tab>('scanner')

  return (
    <div>
      <PageHeader
        title="QR Code Scanner"
        subtitle="Scan a customer's booking QR to inspect the appointment, verify payment and check them in."
        icon={<QrCode className="h-5 w-5" />}
      />

      <div className="mb-6 inline-flex rounded-xl border border-night-800 bg-night-900/60 p-1">
        {([
          { id: 'scanner' as Tab, label: 'Scanner', icon: QrCode },
          { id: 'activity' as Tab, label: 'Scan Activity', icon: ScanLine },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              tab === id ? 'bg-gold-500 text-night-950' : 'text-night-300 hover:text-night-100',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'scanner' ? <QrScannerPanel /> : <QrActivityPanel />}
    </div>
  )
}
