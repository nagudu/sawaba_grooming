import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Download,
  QrCode,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { formatDate, formatTime } from '../../utils/format'
import { cn } from '../../utils/cn'

export interface BookingQrPanelProps {
  qrPayload: string
  reference: string | null
  paymentStatus: string
  checkedInAt?: string | null
  serviceName?: string | null
  barberName?: string | null
  appointmentDate?: string | null
  appointmentTime?: string | null
  /** Drop the outer card chrome when embedding inside an existing card. */
  bordered?: boolean
}

function QrMeta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-night-800 bg-night-950/40 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-night-500">
        {label}
      </p>
      <p className={cn('mt-0.5 text-sm font-semibold text-night-100', mono && 'font-mono')}>
        {value}
      </p>
    </div>
  )
}

/**
 * Shared customer-facing check-in QR. Used by the guest success modal, the
 * Paystack confirmation page and the public "find my booking" lookup. The QR is
 * shown the moment a booking exists — its badge makes clear it is only valid at
 * check-in once the payment is verified (the scanner enforces this too).
 */
export default function BookingQrPanel({
  qrPayload,
  reference,
  paymentStatus,
  checkedInAt,
  serviceName,
  barberName,
  appointmentDate,
  appointmentTime,
  bordered = true,
}: BookingQrPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const downloadQr = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `sawaba-checkin-${reference ?? 'booking'}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const isPaid = paymentStatus === 'PAID'
  const hasMeta = Boolean(serviceName || barberName || appointmentDate || appointmentTime)

  return (
    <div
      className={cn(
        bordered && 'rounded-2xl border border-night-800 bg-night-900/50 p-5',
      )}
    >
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-white p-3 shadow-lg">
            <QRCodeCanvas
              ref={canvasRef}
              value={qrPayload}
              size={512}
              level="M"
              style={{ width: 172, height: 172 }}
              className="rounded-lg"
            />
          </div>
          <Button variant="outline" size="sm" onClick={downloadQr}>
            <Download className="h-3.5 w-3.5" />
            Download QR Code
          </Button>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="flex items-center justify-center gap-2 font-semibold text-night-50 sm:justify-start">
            <QrCode className="h-4 w-4 text-gold-400" />
            Show this code at check-in
          </p>

          {isPaid ? (
            <p className="text-sm text-night-400">
              Present this QR to your barber when you arrive. It confirms your verified
              payment and checks you in instantly.
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-gold-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your check-in QR is ready, but it is <strong>not valid yet</strong> — it only
                becomes usable once your payment is verified. This code is not proof of payment.
              </span>
            </p>
          )}

          {hasMeta && (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {reference && <QrMeta label="Reference" value={reference} mono />}
              {serviceName && <QrMeta label="Service" value={serviceName} />}
              {appointmentDate && (
                <QrMeta label="Date" value={formatDate(appointmentDate)} />
              )}
              {appointmentTime && (
                <QrMeta label="Time" value={formatTime(appointmentTime)} />
              )}
              {barberName && <QrMeta label="Barber" value={barberName} />}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {isPaid ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                <BadgeCheck className="h-3 w-3" />
                Payment verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-300">
                <Clock className="h-3 w-3" />
                Awaiting payment
              </span>
            )}
            {checkedInAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                <CheckCircle2 className="h-3 w-3" />
                Checked in
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
