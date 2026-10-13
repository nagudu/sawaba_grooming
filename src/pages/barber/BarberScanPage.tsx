import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  Scissors,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react'
import {
  checkInCustomer,
  updatePortalAppointmentStatus,
  validateQrCode,
  type QrOutcome,
  type QrScanResult,
} from '../../api/barberPortal'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const READER_REGION_ID = 'sawaba-qr-reader-region'

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

const PAYMENT_LABEL: Record<string, string> = {
  PAID: 'Paid',
  PENDING_VERIFICATION: 'Pending verification',
  UNPAID: 'Unpaid',
  REJECTED: 'Failed',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
  NONE: 'No payment',
}

const TERMINAL_OUTCOMES: QrOutcome[] = ['NOT_FOUND', 'INVALID_TOKEN', 'UNAUTHORIZED', 'REVOKED']

export default function BarberScanPage() {
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [result, setResult] = useState<QrScanResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualRef, setManualRef] = useState('')

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const decodedRef = useRef<(text: string) => void>(() => {})

  const stopScanner = useCallback(async () => {
    const instance = scannerRef.current
    if (!instance) {
      setCameraOn(false)
      return
    }
    scannerRef.current = null
    try {
      await instance.stop()
      instance.clear()
    } catch {
      // already stopped
    }
    setCameraOn(false)
  }, [])

  const applyResult = useCallback((next: QrScanResult) => {
    setResult(next)
    setError(null)
  }, [])

  const lookupToken = useCallback(
    async (token: string) => {
      setBusy(true)
      try {
        applyResult(await validateQrCode({ token }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not verify that code.')
      } finally {
        setBusy(false)
      }
    },
    [applyResult],
  )

  const lookupReference = useCallback(
    async (reference: string) => {
      const value = reference.trim()
      if (!value) return
      setBusy(true)
      try {
        applyResult(await validateQrCode({ reference: value }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not find that booking.')
      } finally {
        setBusy(false)
      }
    },
    [applyResult],
  )

  const handleDecoded = useCallback(
    (text: string) => {
      void stopScanner().then(() => lookupToken(text))
    },
    [stopScanner, lookupToken],
  )

  useEffect(() => {
    decodedRef.current = handleDecoded
  }, [handleDecoded])

  const startScanner = useCallback(async () => {
    if (scannerRef.current) return
    setCameraError(null)
    const region = document.getElementById(READER_REGION_ID)
    if (!region) return
    const instance = new Html5Qrcode(READER_REGION_ID, { verbose: false })
    scannerRef.current = instance
    try {
      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => decodedRef.current(decoded),
        () => {},
      )
      setCameraOn(true)
    } catch {
      scannerRef.current = null
      setCameraError(
        'Camera is unavailable on this device/browser. Grant camera permission, or enter the booking reference below.',
      )
    }
  }, [])

  useEffect(() => {
    return () => {
      void stopScanner()
    }
  }, [stopScanner])

  // Auto-start the camera once the reader region is mounted (first load and
  // after "Scan another"). Never fights a manual stop because it only runs when
  // there is no result on screen and no scanner already active.
  useEffect(() => {
    if (!result && !cameraOn && !scannerRef.current) {
      void startScanner()
    }
  }, [result, cameraOn, startScanner])

  const handleCheckIn = async () => {
    if (!result?.appointment || busy) return
    setBusy(true)
    try {
      const next = await checkInCustomer(result.appointment.id)
      applyResult(next)
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
        applyResult(await validateQrCode({ reference: result.appointment.referenceCode }))
      } else {
        await handleCheckIn()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setResult(null)
    setManualRef('')
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
          <h1 className="font-display text-2xl font-semibold text-night-50">Check-in Scanner</h1>
          <p className="text-sm text-night-400">Scan a customer's booking QR to verify payment and check them in.</p>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {!result && (
        <div className="space-y-4 rounded-2xl border border-night-800 bg-night-900/50 p-4 sm:p-5">
          <div className="relative overflow-hidden rounded-xl border border-night-800 bg-black">
            <div id={READER_REGION_ID} className="min-h-[220px] w-full [&_video]:w-full" />
            {!cameraOn && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-night-500">
                {cameraError ? <CameraOff className="h-8 w-8" /> : <Camera className="h-8 w-8" />}
                <p className="max-w-xs px-6 text-center text-xs">{cameraError ?? 'Camera is off.'}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!cameraOn ? (
              <button
                type="button"
                onClick={() => void startScanner()}
                className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 hover:bg-gold-400"
              >
                <Camera className="h-4 w-4" />
                Start camera
              </button>
            ) : (
              <button
                onClick={() => void stopScanner()}
                className="inline-flex items-center gap-2 rounded-lg border border-night-700 px-4 py-2 text-sm font-semibold text-night-300 hover:text-night-100"
              >
                <CameraOff className="h-4 w-4" />
                Stop camera
              </button>
            )}
          </div>

      <div className="rounded-xl border border-night-800 bg-night-900/60 p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
              Manual lookup
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void lookupReference(manualRef)
              }}
              className="flex gap-2"
            >
              <input
                value={manualRef}
                onChange={(e) => setManualRef(e.target.value)}
                placeholder="Booking reference e.g. APT-20260101-001"
                className="min-w-0 flex-1 rounded-lg border border-night-700 bg-night-950 px-3 py-2 text-sm text-night-100 placeholder:text-night-600 focus:border-gold-500/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !manualRef.trim()}
                className="inline-flex items-center gap-2 rounded-lg border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-300 hover:bg-gold-500/20 disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                Verify
              </button>
            </form>
          </div>
        </div>
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
              {PAYMENT_LABEL[result.paymentStatus] ?? result.paymentStatus}
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
