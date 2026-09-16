import { useEffect, useState } from 'react'
import { Send, Star } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import TestimonialCard from '../components/testimonials/TestimonialCard'
import StarRatingInput from '../components/ui/StarRatingInput'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/ToastNotification'
import { fetchApprovedReviews, submitReview, type PublicReview } from '../api/reviews'
import { fetchBookingServices } from '../api/booking'
import type { ServiceItem } from '../api'
import { EMAIL_PATTERN, PHONE_PATTERN } from '../utils/validation'
import { cn } from '../utils/cn'

interface ReviewForm {
  name: string
  phone: string
  email: string
  serviceId: number | null
  rating: number
  comment: string
  errors: Record<string, string | undefined>
}

const INITIAL_FORM: ReviewForm = {
  name: '',
  phone: '',
  email: '',
  serviceId: null,
  rating: 5,
  comment: '',
  errors: {},
}

const MAX_COMMENT = 2000

export default function ReviewsPage() {
  const { showToast } = useToast()
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<ReviewForm>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      try {
        const [reviewData, serviceData] = await Promise.all([
          fetchApprovedReviews(),
          fetchBookingServices(),
        ])
        if (!cancelled) {
          setReviews(reviewData)
          setServices(serviceData.items)
        }
      } catch {
        if (!cancelled) {
          setReviews([])
          setServices([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const setField = (field: keyof ReviewForm, value: string | number | null) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      errors: { ...current.errors, [field]: undefined },
    }))
  }

  const validate = (): boolean => {
    const errors: ReviewForm['errors'] = {}
    if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
    if (!form.phone.trim()) errors.phone = 'Phone number is required.'
    else if (!PHONE_PATTERN.test(form.phone.trim()))
      errors.phone = 'Please enter a valid phone number.'
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim()))
      errors.email = 'Please enter a valid email address.'
    if (form.comment.trim().length < 5) errors.comment = 'Review must be at least 5 characters.'
    else if (form.comment.trim().length > MAX_COMMENT)
      errors.comment = `Review must be ${MAX_COMMENT} characters or fewer.`
    setForm((current) => ({ ...current, errors }))
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const chosen = services.find((service) => service.id === form.serviceId) ?? null
      await submitReview({
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        customerEmail: form.email.trim() || null,
        serviceId: chosen?.id ?? null,
        serviceName: chosen?.name ?? null,
        rating: form.rating,
        comment: form.comment.trim(),
      })
      setSubmitted(true)
      setForm({ ...INITIAL_FORM, errors: {} })
      showToast('Thank you for your review! It is awaiting approval.', 'success')
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to submit review. Please try again.',
        'error',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <PageHero
        eyebrow="Reviews"
        crumb="Reviews"
        title="What Our Customers Say"
        description="Real feedback from real men who trust SAWABA with their look."
        imageId="1703792684940-a05aa0f1188f"
      />

      <section className="bg-night-950 py-24 md:py-32">
        <div className="container-app">
          <div id="write-review" className="mx-auto max-w-3xl scroll-mt-28">
            <div className="card-lux p-8 md:p-10">
              {submitted ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-500/15">
                    <Star className="h-7 w-7 text-gold-400" />
                  </span>
                  <h3 className="mt-6 font-display text-2xl text-night-50">Thank You!</h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-night-400">
                    Thank you for your review! Your feedback has been submitted successfully and is
                    awaiting approval.
                  </p>
                  <Button
                    variant="outline"
                    size="md"
                    className="mt-8"
                    onClick={() => setSubmitted(false)}
                  >
                    Write Another Review
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-gold-500" />
                    <h3 className="font-display text-2xl text-night-50">Write a Review</h3>
                  </div>

                  <div className="mt-7 grid gap-6 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(event) => setField('name', event.target.value)}
                        className={cn('field', form.errors.name && 'border-red-400/70')}
                        placeholder="e.g. Austin Okafor"
                        aria-invalid={Boolean(form.errors.name)}
                      />
                      {form.errors.name && (
                        <span className="mt-1.5 block text-xs text-red-400">{form.errors.name}</span>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(event) => setField('phone', event.target.value)}
                        className={cn('field', form.errors.phone && 'border-red-400/70')}
                        placeholder="e.g. +234 801 234 5678"
                        aria-invalid={Boolean(form.errors.phone)}
                      />
                      {form.errors.phone && (
                        <span className="mt-1.5 block text-xs text-red-400">{form.errors.phone}</span>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                        Email Address (optional)
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => setField('email', event.target.value)}
                        className={cn('field', form.errors.email && 'border-red-400/70')}
                        placeholder="e.g. john@example.com"
                        aria-invalid={Boolean(form.errors.email)}
                      />
                      {form.errors.email && (
                        <span className="mt-1.5 block text-xs text-red-400">{form.errors.email}</span>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                        Service (optional)
                      </label>
                      <select
                        value={form.serviceId ?? ''}
                        onChange={(event) =>
                          setField('serviceId', event.target.value ? Number(event.target.value) : null)
                        }
                        className="field"
                      >
                        <option value="">Select a service…</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                        Your Rating
                      </label>
                      <StarRatingInput
                        value={form.rating}
                        onChange={(rating) => setField('rating', rating)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="mb-2 flex items-center justify-between">
                        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-night-400">
                          Your Experience
                        </label>
                        <span className="text-[11px] text-night-500">
                          {form.comment.trim().length} / {MAX_COMMENT}
                        </span>
                      </div>
                      <textarea
                        value={form.comment}
                        onChange={(event) => setField('comment', event.target.value)}
                        rows={5}
                        className={cn(
                          'field resize-none',
                          form.errors.comment && 'border-red-400/70',
                        )}
                        placeholder="Tell us about your visit — the service, the finish, the room."
                        aria-invalid={Boolean(form.errors.comment)}
                      />
                      {form.errors.comment && (
                        <span className="mt-1.5 block text-xs text-red-400">
                          {form.errors.comment}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-night-500">
                      Reviews are moderated before they go live.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => {
                          setForm({ ...INITIAL_FORM, errors: {} })
                          showToast('Review cancelled.', 'info')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" variant="gold" size="md" loading={submitting}>
                        Submit Review
                        {!submitting && <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="mt-24">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-gold-500" />
              <h2 className="font-display text-3xl text-night-50">Client Reviews</h2>
            </div>

            {loading ? (
              <div className="mt-14">
                <LoadingSpinner label="Loading reviews" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="mt-14">
                <EmptyState
                  icon={<Star className="h-10 w-10" />}
                  title="Be the first to share your experience with SAWABA GROOMING SALON."
                  description="Your feedback helps others book with confidence. Write a quick review above — it is public once approved."
                  action={
                    <Button
                      variant="gold"
                      size="md"
                      className="mt-4"
                      onClick={() => {
                        setSubmitted(false)
                        document.getElementById('write-review')?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      Write a Review
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {reviews.map((review) => (
                  <TestimonialCard
                    key={review.id}
                    testimonial={{
                      id: review.id,
                      name: review.name,
                      image: review.image ?? '',
                      rating: review.rating,
                      text: review.text,
                      service: review.service ?? undefined,
                      date: review.date,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </PageTransition>
  )
}