import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock,
  Phone,
  Scissors,
  Star,
  User,
  Zap,
} from 'lucide-react'
import type { BarberItem, ServiceItem } from '../../api/index'
import { accountApi } from '../../api/account'
import { useCustomerAuth } from '../../store/customerAuth'
import {
  fetchBookingBarbers,
  fetchBookingServices,
  submitBookingRequest,
  to24Hour,
} from '../../api/booking'
import { getTimeSlots } from '../../data/timeslots'
import { formatDate, formatPrice } from '../../utils/format'
import { validateField } from '../../utils/validation'
import { Button, ButtonLink } from '../ui/Button'
import Modal from '../ui/Modal'
import { useToast } from '../ui/ToastNotification'
import { cn } from '../../utils/cn'

// ─── Constants ────────────────────────────────────────────────────────────────

interface BookingFormProps {
  initialServiceId?: string | null
  initialBarberId?: string | null
}

const ANY_BARBER_ID = 0
const DAY_COUNT = 14
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

function firstAvailableSlot(date: string): string | null {
  return getTimeSlots(date).find((slot) => slot.available)?.time ?? null
}

/**
 * Fallback rule: a barber with zero service assignments is treated as available
 * for all services (single-salon, admin hasn't configured assignments yet).
 */
function barberCanDoService(barber: BarberItem, serviceId: number): boolean {
  const assigned = barber.services ?? []
  if (assigned.length === 0) return true
  return assigned.some((s) => s.id === serviceId)
}

function renderStars(rating: number) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3 w-3',
            i < full
              ? 'fill-gold-400 text-gold-400'
              : i === full && half
                ? 'fill-gold-400/50 text-gold-400'
                : 'fill-transparent text-night-600',
          )}
        />
      ))}
      <span className="ml-1 text-[11px] font-semibold text-gold-400">{rating.toFixed(1)}</span>
    </span>
  )
}

// ─── Barber avatar fallback SVG ───────────────────────────────────────────────

function BarberAvatarFallback({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex items-center justify-center bg-night-800 text-night-500',
        className,
      )}
    >
      {/* Scissors + person silhouette */}
      <svg
        viewBox="0 0 40 40"
        fill="none"
        className="h-1/2 w-1/2"
        aria-hidden="true"
      >
        <circle cx="20" cy="13" r="7" fill="#3a3a40" />
        <path
          d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14"
          stroke="#3a3a40"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M26 8 l4 4 m-4 0 l4-4"
          stroke="#c9a24b"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

// ─── Barber image component ───────────────────────────────────────────────────

function BarberPhoto({
  src,
  name,
  className,
}: {
  src: string | null | undefined
  name: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return <BarberAvatarFallback className={className} />
  }

  return (
    <img
      src={src}
      alt={name}
      className={cn('object-cover', className)}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
    />
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function BarberCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-night-800 bg-night-900/60 p-4 animate-pulse">
      <div className="mx-auto h-20 w-20 rounded-full bg-night-800" />
      <div className="space-y-2 text-center">
        <div className="mx-auto h-4 w-24 rounded bg-night-800" />
        <div className="mx-auto h-3 w-32 rounded bg-night-800/70" />
        <div className="mx-auto h-3 w-16 rounded bg-night-800/50" />
      </div>
    </div>
  )
}

// ─── Barber card ──────────────────────────────────────────────────────────────

function BarberCard({
  barber,
  selected,
  onClick,
}: {
  barber: BarberItem
  selected: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative flex w-full flex-col items-center gap-3 rounded-2xl border p-4 text-center',
        'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
        selected
          ? 'border-gold-500 bg-gold-500/[0.07] shadow-[var(--shadow-glow)]'
          : 'border-night-800 bg-night-900/40 hover:border-gold-500/40 hover:bg-night-900/70',
      )}
      aria-pressed={selected}
    >
      {/* Selected check badge */}
      <AnimatePresence>
        {selected && (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-gold-500"
          >
            <Check className="h-3 w-3 text-night-950" />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Photo */}
      <div className="relative">
        <BarberPhoto
          src={barber.image}
          name={barber.name}
          className="h-20 w-20 rounded-full ring-2 ring-night-700"
        />
        {selected && (
          <span className="absolute inset-0 rounded-full ring-2 ring-gold-500 ring-offset-2 ring-offset-charcoal" />
        )}
        {/* Online dot */}
        <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-charcoal bg-emerald-500" />
      </div>

      {/* Name */}
      <div className="w-full min-w-0 space-y-1">
        <p
          className={cn(
            'truncate font-display text-sm font-semibold leading-tight',
            selected ? 'text-gold-300' : 'text-night-50',
          )}
        >
          {barber.name}
        </p>

        {barber.specialty && (
          <p className="truncate text-[11px] leading-tight text-night-400">
            {barber.specialty}
          </p>
        )}

        {/* Rating */}
        {barber.rating > 0 && (
          <div className="flex justify-center pt-0.5">
            {renderStars(barber.rating)}
          </div>
        )}

        {/* Experience */}
        {barber.experience > 0 && (
          <p className="text-[11px] text-night-500">
            {barber.experience} yr{barber.experience !== 1 ? 's' : ''} exp
          </p>
        )}

        {/* Availability badge */}
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Available
        </span>
      </div>
    </motion.button>
  )
}

// ─── "Any Available" card ─────────────────────────────────────────────────────

function AnyBarberCard({
  selected,
  onClick,
}: {
  selected: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative flex w-full flex-col items-center gap-3 rounded-2xl border p-4 text-center',
        'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500',
        selected
          ? 'border-gold-500 bg-gold-500/[0.07] shadow-[var(--shadow-glow)]'
          : 'border-night-800 bg-night-900/40 hover:border-gold-500/40 hover:bg-night-900/70',
      )}
      aria-pressed={selected}
    >
      <AnimatePresence>
        {selected && (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-gold-500"
          >
            <Check className="h-3 w-3 text-night-950" />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Icon avatar */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-gold-500/40 bg-gold-500/10">
        <Zap className="h-8 w-8 text-gold-400" />
      </div>

      <div className="w-full space-y-1">
        <p
          className={cn(
            'font-display text-sm font-semibold',
            selected ? 'text-gold-300' : 'text-night-50',
          )}
        >
          Any Available
        </p>
        <p className="text-[11px] leading-snug text-night-400">
          We'll assign the next free barber for you
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-400">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
          Recommended
        </span>
      </div>
    </motion.button>
  )
}

// ─── Booking state ────────────────────────────────────────────────────────────

interface BookingState {
  serviceId: number | null
  barberId: number
  date: string
  time: string | null
  customer: { fullName: string; phone: string; email: string; notes: string }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingForm({
  initialServiceId,
  initialBarberId,
}: BookingFormProps) {
  const { showToast } = useToast()

  const today = toISODate(new Date())
  const days = useMemo(() => {
    const base = new Date()
    return Array.from({ length: DAY_COUNT }, (_, index) => {
      const date = new Date(base)
      date.setDate(base.getDate() + index)
      return toISODate(date)
    })
  }, [])

  // ── API data ────────────────────────────────────────────────────────────────
  const [apiServices, setApiServices] = useState<ServiceItem[]>([])
  const [apiBarbers, setApiBarbers] = useState<BarberItem[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [servicesRes, barbersRes] = await Promise.all([
          fetchBookingServices(),
          fetchBookingBarbers(),
        ])
        if (cancelled) return
        setApiServices(servicesRes.items)
        setApiBarbers(barbersRes.items)

        const matchedService = initialServiceId
          ? servicesRes.items.find(
              (s) => s.slug === initialServiceId || String(s.id) === initialServiceId,
            )
          : null
        const matchedBarber = initialBarberId
          ? barbersRes.items.find(
              (b) => b.slug === initialBarberId || String(b.id) === initialBarberId,
            )
          : null

        setBooking((current) => ({
          ...current,
          serviceId: matchedService
            ? matchedService.id
            : (servicesRes.items[0]?.id ?? null),
          barberId: matchedBarber ? matchedBarber.id : ANY_BARBER_ID,
        }))
      } catch (err) {
        if (cancelled) return
        setDataError(
          err instanceof Error ? err.message : 'Failed to load booking data. Please refresh.',
        )
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Booking state ───────────────────────────────────────────────────────────
  const [booking, setBooking] = useState<BookingState>(() => ({
    serviceId: null,
    barberId: ANY_BARBER_ID,
    date: today,
    time: firstAvailableSlot(today),
    customer: { fullName: '', phone: '', email: '', notes: '' },
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [paymentToken, setPaymentToken] = useState<string | null>(null)
  const [bookingRef, setBookingRef] = useState<string | null>(null)
  const [confirmedService, setConfirmedService] = useState<ServiceItem | null>(null)
  const [confirmedBarber, setConfirmedBarber] = useState<BarberItem | null>(null)
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null)
  const [confirmedTime, setConfirmedTime] = useState<string | null>(null)

  // ── Logged-in prefill ───────────────────────────────────────────────────────
  const { customer: loggedIn } = useCustomerAuth()
  const prefilledRef = useRef(false)
  useEffect(() => {
    if (!loggedIn || prefilledRef.current) return
    prefilledRef.current = true
    void (async () => {
      try {
        const prefill = await accountApi.prefill()
        setBooking((current) => ({
          ...current,
          customer: {
            ...current.customer,
            fullName: prefill.fullName || current.customer.fullName,
            phone: prefill.phone || current.customer.phone,
            email: prefill.email ?? current.customer.email,
          },
          serviceId: prefill.usualService?.id ?? current.serviceId,
          barberId:
            prefill.usualBarberId ?? prefill.preferredBarberId ?? current.barberId,
        }))
      } catch {
        // prefill is best-effort
      }
    })()
  }, [loggedIn])

  // ── Derived values ──────────────────────────────────────────────────────────
  const selectedService = apiServices.find((s) => s.id === booking.serviceId) ?? null

  const availableBarbers = useMemo(() => {
    if (!booking.serviceId) return apiBarbers
    return apiBarbers.filter((b) => barberCanDoService(b, booking.serviceId!))
  }, [apiBarbers, booking.serviceId])

  const selectedBarber =
    booking.barberId !== ANY_BARBER_ID
      ? (apiBarbers.find((b) => b.id === booking.barberId) ?? null)
      : null

  const barberName =
    booking.barberId === ANY_BARBER_ID ? 'Any Available' : (selectedBarber?.name ?? '')

  // ── Interactions ────────────────────────────────────────────────────────────
  const selectService = (serviceId: number) =>
    setBooking((current) => {
      const barberStillValid =
        current.barberId === ANY_BARBER_ID ||
        apiBarbers.some(
          (b) => b.id === current.barberId && barberCanDoService(b, serviceId),
        )
      return {
        ...current,
        serviceId,
        barberId: barberStillValid ? current.barberId : ANY_BARBER_ID,
      }
    })

  const selectDate = (date: string) =>
    setBooking((current) => ({ ...current, date, time: firstAvailableSlot(date) }))

  // ── Submit ──────────────────────────────────────────────────────────────────
  const submitBooking = async () => {
    if (submitting) return
    const { serviceId, barberId, date, time, customer } = booking
    if (!serviceId || !date || !time) {
      showToast('Please pick a service and an open time slot.', 'error')
      return
    }
    const { fullName, phone, email } = customer
    const nextErrors = {
      fullName: validateField('Full name', fullName, { required: true, min: 2 }),
      phone: validateField('Phone number', phone, { required: true, phone: true }),
      email: validateField('Email address', email, { email: true }),
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) {
      showToast('Please fix the highlighted fields.', 'error')
      return
    }

    setSubmitting(true)
    try {
      let services = apiServices
      let barbers = apiBarbers
      if (services.length === 0 || barbers.length === 0) {
        const [sRes, bRes] = await Promise.all([
          fetchBookingServices(),
          fetchBookingBarbers(),
        ])
        services = sRes.items
        barbers = bRes.items
      }

      const matchedService = services.find((s) => s.id === serviceId)
      if (!matchedService) throw new Error('The selected service is not available right now.')

      let resolvedBarberId: number
      if (barberId !== ANY_BARBER_ID) {
        const chosen = barbers.find((b) => b.id === barberId)
        if (!chosen) throw new Error('The selected barber is no longer available.')
        resolvedBarberId = chosen.id
      } else {
        const eligible = barbers.filter((b) => barberCanDoService(b, matchedService.id))
        if (eligible.length === 0)
          throw new Error('No barber is available for the selected service right now.')
        resolvedBarberId = eligible[0].id
      }

      const result = await submitBookingRequest({
        customerName: fullName.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || null,
        serviceId: matchedService.id,
        barberId: resolvedBarberId,
        appointmentDate: date,
        appointmentTime: to24Hour(time),
        notes: customer.notes?.trim() || null,
      })
      setPaymentToken(result.payment?.accessToken ?? null)
      setBookingRef(result.appointment?.referenceCode ?? null)
      // Capture details for the confirmation modal
      setConfirmedService(matchedService)
      setConfirmedBarber(barbers.find((b) => b.id === resolvedBarberId) ?? null)
      setConfirmedDate(date)
      setConfirmedTime(time)
      setSuccess(true)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Booking failed. Please try again.'
      if (/time slot|no longer available/i.test(message)) {
        setBooking((current) => ({
          ...current,
          time: firstAvailableSlot(current.date ?? today),
        }))
        showToast('That time was just taken. We picked the next open slot.', 'error')
      } else {
        showToast(message, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setBooking({
      serviceId: apiServices[0]?.id ?? null,
      barberId: ANY_BARBER_ID,
      date: today,
      time: firstAvailableSlot(today),
      customer: { fullName: '', phone: '', email: '', notes: '' },
    })
    setPaymentToken(null)
    setBookingRef(null)
    setSuccess(false)
  }

  const canSubmit = Boolean(
    selectedService &&
      booking.time &&
      !validateField('Full name', booking.customer.fullName, { required: true, min: 2 }) &&
      !validateField('Phone number', booking.customer.phone, { required: true, phone: true }),
  )

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="card-lux p-6 md:p-10">
        <div className="mb-8 h-16 animate-pulse rounded-xl bg-night-800/50" />
        <div className="space-y-8">
          {/* Service skeletons */}
          <div className="space-y-3">
            <div className="h-5 w-32 animate-pulse rounded bg-night-800" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-night-800/60" />
              ))}
            </div>
          </div>
          {/* Barber skeletons */}
          <div className="space-y-3">
            <div className="h-5 w-40 animate-pulse rounded bg-night-800" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <BarberCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (dataError) {
    return (
      <div className="card-lux flex min-h-[320px] flex-col items-center justify-center gap-4 p-10 text-center">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-night-300">{dataError}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="card-lux p-6 md:p-10">

        {/* ── Recap header ── */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-night-800 pb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/15 text-gold-400">
              <Scissors className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-2xl text-night-50">Book Your Chair</h2>
              <p className="text-sm text-night-400">
                One screen. Two fields. Done in seconds.
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-semibold text-gold-400">
              {selectedService ? formatPrice(selectedService.price) : '—'}
            </p>
            <p className="text-xs text-night-500">
              {selectedService ? `${selectedService.duration} min` : ''} · {barberName}
            </p>
            <p className="text-xs text-night-500">
              {booking.date ? formatDate(booking.date) : ''}
              {booking.time ? ` · ${booking.time}` : ''}
            </p>
          </div>
        </div>

        <div className="space-y-10">

          {/* ── Step 1: Service ── */}
          <section>
            <SectionHeading index="1" title="Pick a service" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {apiServices.map((item) => {
                const selected = booking.serviceId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectService(item.id)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200',
                      selected
                        ? 'border-gold-500 bg-gold-500/10 shadow-[var(--shadow-glow)]'
                        : 'border-night-800 hover:border-gold-500/40',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-night-50">
                        {item.name}
                      </span>
                      <span className="text-xs text-night-500">{item.duration} min</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          selected ? 'text-gold-400' : 'text-night-300',
                        )}
                      >
                        {formatPrice(item.price)}
                      </span>
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full border transition-all',
                          selected
                            ? 'border-gold-500 bg-gold-500 text-night-950'
                            : 'border-night-600',
                        )}
                      >
                        {selected && <Check className="h-2.5 w-2.5" />}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Step 2: Barber ── */}
          <section>
            <SectionHeading
              index="2"
              title="Choose your barber"
              hint="Select a preference, or let us pick for you"
            />

            {/* Sub-label showing which service is filtering */}
            {selectedService && (
              <p className="mt-1 text-xs text-night-500">
                Showing barbers available for{' '}
                <span className="font-semibold text-gold-500">{selectedService.name}</span>
              </p>
            )}

            {/* No barbers at all */}
            {apiBarbers.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-night-800 bg-night-900/40 px-6 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-night-800">
                  <User className="h-7 w-7 text-night-500" />
                </span>
                <div>
                  <p className="font-display text-base text-night-200">No Barbers Available</p>
                  <p className="mt-1 text-sm text-night-500">
                    Our barbers are currently unavailable. Please try another time or contact
                    us directly.
                  </p>
                </div>
                <a
                  href="tel:+2347069288456"
                  className="inline-flex items-center gap-2 rounded-xl border border-gold-500/40 px-5 py-2.5 text-sm font-semibold text-gold-400 transition-colors hover:border-gold-500 hover:bg-gold-500/10"
                >
                  <Phone className="h-4 w-4" />
                  Contact Us
                </a>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {/* "Any Available" card — always first */}
                <AnyBarberCard
                  selected={booking.barberId === ANY_BARBER_ID}
                  onClick={() => setBooking((b) => ({ ...b, barberId: ANY_BARBER_ID }))}
                />

                {/* Individual barber cards */}
                {availableBarbers.map((barber) => (
                  <BarberCard
                    key={barber.id}
                    barber={barber}
                    selected={booking.barberId === barber.id}
                    onClick={() => setBooking((b) => ({ ...b, barberId: barber.id }))}
                  />
                ))}

                {/* If service is selected but no barbers match (and not the fallback) */}
                {availableBarbers.length === 0 && booking.serviceId !== null && (
                  <div className="col-span-full flex items-center gap-2 rounded-xl border border-night-800 px-4 py-3 text-sm text-night-400">
                    <AlertCircle className="h-4 w-4 shrink-0 text-gold-500" />
                    No barbers are specifically assigned to this service yet — "Any Available"
                    will be used.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Step 3: Date & time ── */}
          <section>
            <SectionHeading
              index="3"
              title="Pick a date & time"
              hint="Next open slot is pre-selected"
            />
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {days.map((date) => {
                const cellDate = new Date(`${date}T00:00:00`)
                const selected = booking.date === date
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => selectDate(date)}
                    className={cn(
                      'flex min-w-[68px] flex-col items-center rounded-xl border px-3 py-2.5 transition-all duration-200',
                      selected
                        ? 'border-gold-500 bg-gold-500 text-night-950 shadow-[0_8px_20px_-6px_rgba(201,162,75,0.6)]'
                        : 'border-night-800 hover:border-gold-500/40',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-widest',
                        selected ? 'text-night-900' : 'text-night-500',
                      )}
                    >
                      {date === today ? 'Today' : DAY_LABELS[cellDate.getDay()]}
                    </span>
                    <span
                      className={cn(
                        'font-display text-lg font-semibold',
                        selected ? 'text-night-950' : 'text-night-100',
                      )}
                    >
                      {cellDate.getDate()}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-5">
              {booking.date && getTimeSlots(booking.date).some((slot) => slot.available) ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {getTimeSlots(booking.date).map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setBooking((b) => ({ ...b, time: slot.time }))}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-all duration-200',
                        !slot.available &&
                          'cursor-not-allowed border-night-800 text-night-700 line-through',
                        slot.available &&
                          booking.time !== slot.time &&
                          'border-night-700 text-night-200 hover:border-gold-500/60 hover:text-gold-300',
                        slot.available &&
                          booking.time === slot.time &&
                          'border-gold-500 bg-gold-500 text-night-950 shadow-[0_8px_20px_-6px_rgba(201,162,75,0.6)]',
                      )}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-2 rounded-xl border border-night-800 px-4 py-3 text-sm text-night-400">
                  <AlertCircle className="h-4 w-4 text-gold-500" />
                  No open slots on this day — pick another date above.
                </p>
              )}
            </div>
          </section>

          {/* ── Step 4: Details ── */}
          <section>
            <SectionHeading
              index="4"
              title="Your details"
              hint="Name and phone — that's all we need"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <CustomerField
                label="Full Name"
                type="text"
                value={booking.customer.fullName}
                error={errors.fullName}
                placeholder="e.g. John Adeyemi"
                onChange={(value) =>
                  setBooking((b) => ({
                    ...b,
                    customer: { ...b.customer, fullName: value },
                  }))
                }
              />
              <CustomerField
                label="Phone Number"
                type="tel"
                value={booking.customer.phone}
                error={errors.phone}
                placeholder="e.g. +234 706 928 8456"
                onChange={(value) =>
                  setBooking((b) => ({
                    ...b,
                    customer: { ...b.customer, phone: value },
                  }))
                }
              />
              <div className="sm:col-span-2">
                <CustomerField
                  label="Email (optional)"
                  type="email"
                  value={booking.customer.email}
                  error={errors.email}
                  placeholder="For your receipt — e.g. john@example.com"
                  onChange={(value) =>
                    setBooking((b) => ({
                      ...b,
                      customer: { ...b.customer, email: value },
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <CustomerField
                  label="Notes (optional)"
                  type="text"
                  value={booking.customer.notes}
                  placeholder="Anything we should know?"
                  onChange={(value) =>
                    setBooking((b) => ({
                      ...b,
                      customer: { ...b.customer, notes: value },
                    }))
                  }
                />
              </div>
            </div>
          </section>
        </div>

        {/* ── Confirm bar ── */}
        <div className="mt-10 flex flex-col gap-4 border-t border-night-800 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-night-400">
            <Clock className="h-4 w-4 text-gold-500" />
            {selectedService?.name} · {booking.date ? formatDate(booking.date) : ''}
            {booking.time ? ` · ${booking.time}` : ''}
          </p>
          <Button
            variant="gold"
            size="lg"
            loading={submitting}
            onClick={submitBooking}
            disabled={!canSubmit}
            className="w-full sm:w-auto"
          >
            Confirm Booking
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Success modal ── */}
      <Modal
        open={success}
        onClose={() => {
          setSuccess(false)
          reset()
        }}
        size="md"
        title="Booking Confirmed"
      >
        <div className="flex flex-col items-center py-4 text-center">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-500/15"
          >
            <BadgeCheck className="h-9 w-9 text-gold-400" />
          </motion.span>

          <h3 className="mt-4 font-display text-2xl text-night-50">Booking Received</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-night-400">
            Your appointment request is in. Complete payment below to secure your slot.
          </p>

          {/* Appointment summary */}
          {(confirmedService || confirmedBarber || confirmedDate) && (
            <div className="mt-5 w-full rounded-xl border border-night-800 bg-night-900/60 p-4 text-left">
              <div className="grid gap-3 sm:grid-cols-2">
                {confirmedService && (
                  <div className="flex items-start gap-2.5">
                    <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-night-500">
                        Service
                      </p>
                      <p className="text-sm font-semibold text-night-100">
                        {confirmedService.name}
                      </p>
                      <p className="text-xs text-night-500">
                        {confirmedService.duration} min · {formatPrice(confirmedService.price)}
                      </p>
                    </div>
                  </div>
                )}
                {confirmedBarber && (
                  <div className="flex items-start gap-2.5">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-night-500">
                        Barber
                      </p>
                      <p className="text-sm font-semibold text-night-100">
                        {confirmedBarber.name}
                      </p>
                    </div>
                  </div>
                )}
                {confirmedDate && (
                  <div className="flex items-start gap-2.5">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-night-500">
                        Date
                      </p>
                      <p className="text-sm font-semibold text-night-100">
                        {formatDate(confirmedDate)}
                      </p>
                    </div>
                  </div>
                )}
                {confirmedTime && (
                  <div className="flex items-start gap-2.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-night-500">
                        Time
                      </p>
                      <p className="text-sm font-semibold text-night-100">
                        {confirmedTime}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reference + amount */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold-500/20 bg-gold-500/[0.05] px-3 py-2.5">
                {bookingRef && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-night-500">
                      Booking Ref
                    </p>
                    <p className="font-mono text-sm font-bold tracking-wide text-gold-400">
                      #{bookingRef}
                    </p>
                  </div>
                )}
                {confirmedService && (
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-night-500">
                      Amount Due
                    </p>
                    <p className="text-sm font-bold text-gold-400">
                      {formatPrice(confirmedService.price)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex w-full flex-col gap-3">
            {paymentToken && (
              <ButtonLink
                to={`/pay/${paymentToken}`}
                variant="gold"
                size="md"
                onClick={() => setSuccess(false)}
                className="w-full justify-center"
              >
                <ArrowRight className="h-4 w-4" />
                Pay Now to Secure Your Slot
              </ButtonLink>
            )}
            <div className="flex gap-3">
              <ButtonLink
                to="/"
                variant="outline"
                size="md"
                onClick={() => setSuccess(false)}
                className="flex-1 justify-center"
              >
                Back to Home
              </ButtonLink>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setSuccess(false)
                  reset()
                }}
                className="flex-1"
              >
                Book Another
              </Button>
            </div>
          </div>

          <ButtonLink
            to="/reviews"
            variant="ghost"
            size="md"
            className="mt-2 text-night-500"
            onClick={() => setSuccess(false)}
          >
            <Star className="h-4 w-4 text-gold-400" />
            Leave a Review
          </ButtonLink>
        </div>
      </Modal>
    </motion.div>
  )
}

// ─── Supporting components ────────────────────────────────────────────────────

function SectionHeading({
  index,
  title,
  hint,
}: {
  index: string
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gold-500/15 text-[11px] font-bold text-gold-400">
          {index}
        </span>
        <h3 className="font-display text-base text-night-50">{title}</h3>
      </div>
      {hint && <span className="text-xs text-night-500">{hint}</span>}
    </div>
  )
}

function CustomerField({
  label,
  type = 'text',
  value,
  error,
  placeholder,
  onChange,
}: {
  label: string
  type?: string
  value: string
  error?: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn('field', error && 'border-red-400/70')}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="mt-1.5 block text-xs text-red-400">{error}</span>}
    </label>
  )
}
