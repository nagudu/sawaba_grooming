import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import TestimonialCard from '../testimonials/TestimonialCard'
import SectionTitle from '../ui/SectionTitle'
import { ButtonLink } from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import LoadingSpinner from '../ui/LoadingSpinner'
import { fetchApprovedReviews, type PublicReview } from '../../api/reviews'

export default function TestimonialsSection() {
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      try {
        const data = await fetchApprovedReviews()
        if (!cancelled) setReviews(data)
      } catch {
        if (!cancelled) setReviews([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="bg-coal py-16 md:py-20">
      <div className="container-app">
        <SectionTitle
          eyebrow="Testimonials"
          title="What Our Customers Say"
          description="Real words from the men who trust SAWABA with their look."
        />

        {loading ? (
          <div className="mt-14 flex justify-center py-10">
            <LoadingSpinner label="Loading reviews" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="mt-14">
            <EmptyState
              icon={<Star className="h-10 w-10" />}
              title="Be the first to share your experience with SAWABA GROOMING STUDIO."
              description="Visited us recently? Tell the world about your visit — your review helps other men book with confidence."
              action={
                <ButtonLink to="/reviews" variant="gold" size="md" className="mt-4">
                  Write a Review
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <>
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

            <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink to="/reviews" variant="gold" size="md">
                View All Reviews
              </ButtonLink>
              <ButtonLink to="/reviews" variant="outline" size="md">
                Write a Review
              </ButtonLink>
            </div>
          </>
        )}
      </div>
    </section>
  )
}