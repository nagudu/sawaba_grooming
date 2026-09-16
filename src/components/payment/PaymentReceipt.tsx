import { BadgeDollarSign, CalendarDays, Landmark, Send, Scissors, User } from 'lucide-react'
import { formatDate, formatPrice } from '../../utils/format'
import type { PaymentItem, PaymentSettings } from '../../api/payments'

interface PaymentReceiptProps {
  payment: PaymentItem
  settings: PaymentSettings
}

/** Official receipt number, e.g. RCP-20260915-0042 (date verified/paid + payment id). */
export function receiptNumber(payment: PaymentItem): string {
  const stamp = (payment.verifiedAt ?? payment.createdAt).slice(0, 10).replace(/-/g, '')
  return `RCP-${stamp}-${String(payment.id).padStart(4, '0')}`
}

export default function PaymentReceipt({ payment, settings }: PaymentReceiptProps) {
  const appointment = payment.appointment
  const paidDate = payment.paymentDate ?? (payment.verifiedAt ?? '').slice(0, 10)

  return (
    <div
      id="sawaba-receipt"
      className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-night-700 bg-white text-night-950 shadow-2xl"
    >
      <div className="border-b-4 border-gold-500 bg-night-950 px-8 py-7 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {settings.shopLogo ? (
              <img
                src={settings.shopLogo}
                alt={settings.shopName}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold-500/20 text-gold-400">
                <Scissors className="h-6 w-6" />
              </span>
            )}
            <div>
              <p className="font-display text-xl font-semibold">{settings.shopName}</p>
              {settings.shopAddress && (
                <p className="text-xs text-night-300">{settings.shopAddress}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400">
              Payment Receipt
            </p>
            <p className="mt-1 text-xs font-medium text-night-300">
              No. {receiptNumber(payment)}
            </p>
            {appointment?.referenceCode && (
              <p className="mt-1 text-xs font-semibold text-white">
                Appointment #{appointment.referenceCode}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <BadgeDollarSign className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-900">Amount Paid</p>
              <p className="font-display text-2xl font-bold text-emerald-700">
                {formatPrice(payment.amount)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
              Status
            </p>
            <p className="text-sm font-bold text-emerald-600">VERIFIED &amp; PAID</p>
            {payment.verifiedAt && (
              <p className="mt-0.5 text-xs text-emerald-800/70">
                {formatDate(payment.verifiedAt.slice(0, 10))}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-night-200 p-5">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-400">
              <User className="h-3.5 w-3.5" />
              Customer
            </p>
            <p className="mt-2 font-semibold">{appointment?.customerName ?? '—'}</p>
            {appointment?.customerPhone && (
              <p className="mt-0.5 text-sm text-night-500">{appointment.customerPhone}</p>
            )}
            {appointment?.customerEmail && (
              <p className="mt-0.5 text-sm text-night-500">{appointment.customerEmail}</p>
            )}
          </div>

          <div className="rounded-xl border border-night-200 p-5">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-night-400">
              <CalendarDays className="h-3.5 w-3.5" />
              Appointment
            </p>
            {appointment ? (
              <>
                <p className="mt-2 text-sm font-semibold">
                  #{appointment.referenceCode ?? appointment.id}
                </p>
                <p className="mt-0.5 text-sm text-night-500">
                  {formatDate(appointment.appointmentDate)} · {appointment.appointmentTime}
                </p>
                <p className="mt-0.5 text-sm text-night-500">
                  {appointment.service?.name ?? 'Service'} ·{' '}
                  {appointment.barber?.name ?? 'Any barber'}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-night-400">—</p>
            )}
          </div>
        </div>

        {appointment?.service && (
          <div className="mt-6 rounded-xl border border-night-200">
            <div className="flex items-center justify-between border-b border-night-200 px-5 py-3 text-sm">
              <span className="text-night-500">{appointment.service.name}</span>
              <span className="font-semibold">{formatPrice(appointment.service.price)}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-night-500">Amount submitted</span>
              <span className="font-medium">{formatPrice(payment.amount)}</span>
            </div>
            <div className="flex items-center justify-between border-t-2 border-night-200 bg-night-50 px-5 py-3">
              <span className="font-semibold">Total</span>
              <span className="font-display font-bold">{formatPrice(payment.amount)}</span>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl bg-night-50 px-5 py-4">
            <Send className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-night-400">
                Payment Method
              </p>
              <p className="mt-0.5 text-sm font-semibold capitalize">
                {payment.paymentMethod?.toLowerCase().replace('_', ' ') ?? '—'}
              </p>
              {payment.transactionReference && (
                <p className="mt-0.5 text-xs text-night-400">
                  Ref: {payment.transactionReference}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-night-50 px-5 py-4">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-night-400">
                Paid On
              </p>
              <p className="mt-0.5 text-sm font-semibold">{paidDate ? formatDate(paidDate) : '—'}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-dashed border-night-300 pt-5 text-center">
          <p className="text-sm font-medium text-night-500">
            Thank you for choosing {settings.shopName}.
          </p>
          {settings.shopPhone && (
            <p className="mt-1 text-xs text-night-400">
              Questions? Call {settings.shopPhone}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}