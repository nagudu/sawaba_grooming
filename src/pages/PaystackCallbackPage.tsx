import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock,
  FileText,
  LoaderCircle,
  Scissors,
  User,
  XCircle,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import { Button, ButtonLink } from '../components/ui/Button'
import { useToast } from '../components/ui/ToastNotification'
import { verifyPaystack } from '../api/payments'
import type { PublicPaymentBundle } from '../api/payments'
import { formatDate, formatPrice, formatTime } from '../utils/format'

/**
 * Landing page Paystack redirects the customer back to.
 *
 * The browser redirect is NEVER trusted: this page immediately asks our
 * backend to re-verify the transaction directly with Paystack. Only then is
 * the payment marked verified — the same rule the webhook path follows.
 *
 * URL shape: /payments/callback?token=<paymentAccessToken>&reference=<paystack-ref>
 */
export default function PaystackCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const token = params.get('token')
  const reference = params.get('reference') ?? params.get('trxref')

  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('')
  const [bundle, setBundle] = useState<PublicPaymentBundle | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    if (!token || !reference) {
      setState('error')
      setMessage('This payment confirmation link is incomplete. Please open your payment page again.')
      return
    }

    setState('verifying')
    verifyPaystack(token, reference)
      .then((result) => {
        setBundle(result)
        setState('success')
        showToast('Payment verified successfully.', 'success')
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Payment verification failed.')
        setState('error')
      })
  }, [token, reference, showToast])

  const payment = bundle?.payment ?? null
  const appointment = payment?.appointment ?? null

  return (
    <PageTransition>
      <PageHero
        eyebrow="Online Payment"
        crumb="Payment Confirmation"
        title={
          state === 'success'
            ? 'Appointment Confirmed'
            : state === 'error'
              ? 'Payment Not Confirmed'
              : 'Confirming Payment'
        }
        description="We re-check every transaction directly with Paystack before confirming — the redirect alone is never enough."
        imageId="1563013544-824ae1b704d3"
      />

      <section className="bg-night-950 py-24 md:py-32">
        <div className="container-app max-w-xl">

          {/* ── Verifying ── */}
          {state === 'verifying' && (
            <div className="rounded-2xl border border-gold-500/30 bg-gold-500/5 p-10 text-center">
              <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-gold-500" />
              <h2 className="mt-5 font-display text-2xl text-night-50">Verifying your payment…</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-night-400">
                Checking your transaction directly with Paystack. This only takes a moment — please
                keep this page open.
              </p>
            </div>
          )}

          {/* ── Success ── */}
          {state === 'success' && (
            <div className="space-y-4">
              {/* Header banner */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <BadgeCheck className="h-9 w-9" />
                </span>
                <h2 className="mt-4 font-display text-2xl text-night-50">Payment Successful</h2>
                {payment && (
                  <p className="mt-2 font-display text-4xl font-bold text-emerald-400">
                    {formatPrice(payment.amount)}
                  </p>
                )}
                <p className="mx-auto mt-3 max-w-sm text-sm text-night-400">
                  Paystack confirmed your transaction. Your appointment is now booked and ready
                  for service.
                </p>
              </div>

              {/* Appointment details card */}
              {appointment && (
                <div className="card-lux p-6">
                  <h3 className="mb-4 font-display text-lg text-night-50">Booking Confirmation</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {appointment.service && (
                      <div className="flex items-start gap-3">
                        <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                            Service
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-night-100">
                            {appointment.service.name}
                          </p>
                          <p className="text-xs text-night-500">
                            {appointment.service.duration} min · {formatPrice(appointment.service.price)}
                          </p>
                        </div>
                      </div>
                    )}
                    {appointment.barber && (
                      <div className="flex items-start gap-3">
                        <User className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                            Barber
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-night-100">
                            {appointment.barber.name}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                          Date
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-night-100">
                          {formatDate(appointment.appointmentDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                          Time
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-night-100">
                          {formatTime(appointment.appointmentTime)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reference + amount row */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-500/25 bg-gold-500/[0.06] px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                        Booking Reference
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-bold tracking-wide text-gold-400">
                        #{appointment.referenceCode ?? appointment.id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">
                        Amount Paid
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-emerald-400">
                        {formatPrice(payment?.amount ?? appointment.totalAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink to={`/receipt/${token}`} variant="gold" size="md">
                  <FileText className="h-4 w-4" />
                  View Official Receipt
                </ButtonLink>
                <ButtonLink to={`/pay/${token}`} variant="outline" size="md">
                  Payment Details
                </ButtonLink>
                <ButtonLink to="/" variant="ghost" size="md">
                  Back to Home
                </ButtonLink>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {state === 'error' && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-10 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
                <XCircle className="h-9 w-9" />
              </span>
              <h2 className="mt-5 font-display text-2xl text-night-50">Payment Not Confirmed</h2>
              <p className="mx-auto mt-2 max-w-sm rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {message}
              </p>
              <p className="mx-auto mt-3 max-w-sm text-sm text-night-400">
                If you completed the payment, your appointment page will show the verified status
                once the confirmation syncs — or you can upload your bank receipt instead.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button variant="gold" size="md" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-4 w-4" />
                  Back to Payment
                </Button>
                {token && (
                  <ButtonLink to={`/pay/${token}`} variant="outline" size="md">
                    Payment Page
                  </ButtonLink>
                )}
              </div>
            </div>
          )}

        </div>
      </section>
    </PageTransition>
  )
}
