import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Phone,
  QrCode,
  RefreshCw,
  Scissors,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react'
import QrCameraScanner from '../../components/qr/QrCameraScanner'
import {
  checkInCustomer,
  updatePortalAppointmentStatus,
  validateQrCode,
  type QrOutcome,
  type QrScanResult,
} from '../../api/barberPortal'
import { formatPrice } from '../../utils/format'
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
  UNAUTHORIZED: { ring: 'border-red-500/50 bg-red-500/[0.07]', badge: 'bg-red-500/15 text-red-300', label: 'Not your booking' },
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

export default function BarberScanPage() {
  const [result, setResult] = useState<QrScanResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookupToken = useCallback(async (token: string) => {
    setBusy(true)
    try {
      setResult(await validateQrCode({ token }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify that code.')
    } finally {
      setBusy(false)
    }
  }, [])

  const lookupReference = useCallback(async (reference: string) => {
    setBusy(true)
    try {
      setResult(await validateQrCode({ reference }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find that booking.')
    } finally {
      setBusy(false)
    }
  }, [])

  // Auto-verify when this page is opened from a scanned QR link
  // (/barber/scan?token=…), so native-camera scans land straight on the result.
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
    if (prefill.token) void lookupToken(prefill.token)
    else if (prefill.reference) void lookupReference(prefill.reference)
  }, [lookupReference, lookupToken, prefill])

  const handleCheckIn = async () => {
    if (!result?.appointment || busy) return
    setBusy(true)
    try {
      setResult(await checkInCustomer(result.appointment.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleStatus = async (to: 'IN_PROGRESS' | 'COMPLETED') => {
    if (!result?.appointment || busy) return
    setBusy(true)
    try {
      await updatePortalAppointmentStatus(result.appointment.id, to)
      if (result.appointment.referenceCode) {
        setResult(await validateQrCode({ reference: result.appointment.referenceCode }))
      } else {
        setResult(await checkInCustomer(result.appointment.id))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError(null)
  }

  const style = result ? OUTCOME_STYLE[result.outcome] : null
  const appointment = result?.appointment ?? null
  const isTerminal = result ? TERMINAL_OUTCOMES.includes(result.outcome) : false

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold-500/30 bg-gold-500/10 text-gold-400">
          <QrCode className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-night-50">Scan Customer QR</h1>
          <p className="text-sm text-night-400">Verify a customer's booking QR, then check them in and run the service.</p>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {!result && (
        <QrCameraScanner onDecode={lookupToken} onManual={lookupReference} />
      )}

      {busy && (
        <p className="flex items-center justify-center gap-2 text-sm text-gold-300">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Verifying…
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

          {/* Customer PII only appears on a fully valid, authorised scan. */}
          {result.valid && appointment && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info icon={<UserRound className="h-4 w-4" />} label="Customer" value={appointment.customerName ?? '—'} />
              <Info
                icon={<Phone className="h-4 w-4" />}
                label="Phone"
                value={
                  appointment.customerPhone ? (
                    <a href={`tel:${appointment.customerPhone}`} className="text-gold-400">
                      {appointment.customerPhone}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
              <Info icon={<Scissors className="h-4 w-4" />} label="Service" value={appointment.service ? `${appointment.service.name} · ${appointment.service.duration} min` : '—'} />
              <Info icon={<CalendarDays className="h-4 w-4" />} label="Date" value={appointment.appointmentDate} />
              <Info icon={<Clock className="h-4 w-4" />} label="Time" value={appointment.appointmentTime} />
              <Info icon={<Wallet className="h-4 w-4" />} label="Amount" value={formatPrice(appointment.totalAmount)} />
              {appointment.payment?.method && (
                <Info icon={<Wallet className="h-4 w-4" />} label="Paid via" value={PAYMENT_METHOD[appointment.payment.method] ?? appointment.payment.method} />
              )}
              {appointment.notes && (
                <div className="sm:col-span-2">
                  <Info icon={<FileText className="h-4 w-4" />} label="Customer instructions" value={appointment.notes} />
                </div>
              )}
            </div>
          )}

          {/* Restricted context — no customer identity for unpaid/cancelled codes. */}
          {!result.valid && appointment && !isTerminal && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info icon={<Scissors className="h-4 w-4" />} label="Service" value={appointment.service?.name ?? '—'} />
              <Info icon={<CalendarDays className="h-4 w-4" />} label="Date" value={appointment.appointmentDate} />
              <Info icon={<Clock className="h-4 w-4" />} label="Time" value={appointment.appointmentTime} />
              <Info icon={<Wallet className="h-4 w-4" />} label="Amount" value={formatPrice(appointment.totalAmount)} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-night-800 pt-4">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
                result.paymentStatus === 'PAID'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-night-700 bg-night-900 text-night-300',
              )}
            >
              {result.paymentStatus === 'PAID' && <BadgeCheck className="h-3 w-3" />}
              {qrPaymentStatusLabel(result.paymentStatus)}
            </span>
            <span className="rounded-full border border-night-700 bg-night-900 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-night-300">
              {qrBookingStatusLabel(result)}
            </span>
            {result.checkedIn && (
              <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                Checked in
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {result.canCheckIn && (
              <button
                onClick={handleCheckIn}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Check in customer
              </button>
            )}
            {result.valid && appointment?.status === 'READY_FOR_SERVICE' && (
              <button
                onClick={() => void handleStatus('IN_PROGRESS')}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-gold-400 disabled:opacity-60"
              >
                <Scissors className="h-4 w-4" />
                Start service
              </button>
            )}
            {result.valid && appointment?.status === 'IN_PROGRESS' && (
              <button
                onClick={() => void handleStatus('COMPLETED')}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete service
              </button>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-sm font-semibold text-night-300 hover:text-night-100"
            >
              <RefreshCw className="h-4 w-4" />
              Scan another
            </button>
          </div>
        </div>
      )}
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
