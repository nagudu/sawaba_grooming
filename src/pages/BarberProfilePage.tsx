import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Quote,
  Star,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import GalleryCard from '../components/gallery/GalleryCard'
import ImageLightbox from '../components/gallery/ImageLightbox'
import EmptyState from '../components/ui/EmptyState'
import SmartImage from '../components/ui/SmartImage'
import StarRating from '../components/ui/StarRating'
import { ButtonLink } from '../components/ui/Button'
import { useCatalog } from '../store/catalog'
import { formatPrice } from '../utils/format'
import { useEffect } from 'react'
import { useState } from 'react'
import { api } from '../api'
import type { GalleryImage } from '../types'
import type { GalleryItem } from '../api'
import LoadingSpinner from '../components/ui/LoadingSpinner'

export default function BarberProfilePage() {
  const { id } = useParams()
  const { services, loading, getBarber } = useCatalog()
  const barber = loading ? null : getBarber(id)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [approvedReviews, setApprovedReviews] = useState<Array<{ id: number; customerName: string; rating: number; comment: string; createdAt: string }>>([])
  const [barberGallery, setBarberGallery] = useState<GalleryItem[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [reviewsRes, galleryRes] = await Promise.all([
          api.get<{ items: Array<{ id: number; customerName: string; rating: number; comment: string; createdAt: string }> }>('/api/reviews?approved=true&page=1&perPage=100'),
          api.get<{ items: GalleryItem[] }>('/api/gallery?page=1&perPage=100'),
        ])
        if (cancelled) return
        setApprovedReviews(reviewsRes.items ?? [])
        setBarberGallery((galleryRes.items ?? []).filter((image) => image.barberId && String(image.barberId) === String(id)))
      } catch {
        if (!cancelled) {
          setApprovedReviews([])
          setBarberGallery([])
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <PageTransition>
        <section className="bg-night-950 py-24">
          <div className="container-app flex flex-col items-center gap-4 py-20 text-night-400">
            <LoadingSpinner className="h-8 w-8 text-gold-500" />
            <p className="text-sm">Loading barber profile…</p>
          </div>
        </section>
      </PageTransition>
    )
  }

  if (!barber) {
    return (
      <PageTransition>
        <PageHero
          eyebrow="Barber Not Found"
          crumb="Barbers"
          title="We Couldn't Find That Barber"
        />
        <section className="bg-night-950 py-24">
          <div className="container-app">
            <EmptyState
              title="This profile does not exist"
              description="It may have been removed. Meet the rest of the team instead."
              action={
                <ButtonLink to="/barbers" variant="gold" size="md">
                  Back to Barbers
                </ButtonLink>
              }
            />
          </div>
        </section>
      </PageTransition>
    )
  }

  // Reviews come from the live approved list, filtered to this barber's name.
  const reviews = approvedReviews
    .filter((review) => review.customerName && barber.name.includes(review.customerName.split(' ')[0]))
    .slice(0, 4)
    .map((review) => ({
      id: review.id,
      name: review.customerName,
      rating: review.rating,
      text: review.comment,
      date: new Date(review.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    }))
  const offeredServices = services.filter((service) =>
    barber.services.some((offered) => offered.id === service.id),
  )

  // The barber profile shows real images only when the admin has assigned
  // gallery items; otherwise the section disappears (no fake work photos).
  const galleryImages: GalleryImage[] = barberGallery
    .slice(0, 6)
    .map((image) => ({
      id: `gallery-${image.id}`,
      src: image.image,
      title: image.title ?? `${barber.name} — at work`,
      category: 'haircuts' as const,
    }))

  return (
    <PageTransition>
      <PageHero
        eyebrow={barber.specialty}
        crumb="Barbers"
        title={barber.name}
        description={`${barber.experience}+ years of craft at SAWABA Grooming Salon.`}
        imageId="1567894340315-735d7c361db0"
      />

      <section className="bg-night-950 py-24 md:py-32">
        <div className="container-app">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
            >
              <div className="card-lux sticky top-24 overflow-hidden">
                <SmartImage
                  src={barber.image || undefined}
                  alt={`${barber.name} — ${barber.specialty}`}
                  className="aspect-[4/5] w-full"
                />
                <div className="p-7">
                  <div className="flex items-center gap-3">
                    <BadgeCheck className="h-5 w-5 text-gold-400" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
                      Verified SAWABA Barber
                    </p>
                  </div>
                  <h2 className="mt-3 font-display text-3xl text-night-50">
                    {barber.name}
                  </h2>
                  <p className="mt-1 text-sm text-night-400">{barber.specialty}</p>

                  <div className="mt-5 flex items-center gap-3">
                    <StarRating rating={barber.rating} size={16} />
                    <span className="text-sm font-semibold text-night-200">
                      {barber.rating.toFixed(1)}
                    </span>
                    <span className="text-sm text-night-500">
                      ({reviews.length} approved review{reviews.length === 1 ? '' : 's'})
                    </span>
                  </div>

                  <dl className="mt-6 grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-night-800 bg-night-900/60 p-4 text-center">
                      <dt className="text-xs text-night-500">Experience</dt>
                      <dd className="mt-1 font-display text-2xl text-gold-400">
                        {barber.experience}+ yrs
                      </dd>
                    </div>
                    <div className="rounded-xl border border-night-800 bg-night-900/60 p-4 text-center">
                      <dt className="text-xs text-night-500">Happy Clients</dt>
                      <dd className="mt-1 font-display text-2xl text-gold-400">
                        {barber.reviewCount * 4}+
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-7 flex flex-col gap-3">
                    <ButtonLink
                      to={`/book?barber=${barber.id}`}
                      variant="gold"
                      size="md"
                      fullWidth
                    >
                      Book Appointment
                    </ButtonLink>
                    <Link
                      to="/barbers"
                      className="flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-night-400 transition-colors hover:text-gold-400"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Barbers
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="space-y-14"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div>
                <p className="label-luxe">Biography</p>
                <h2 className="mt-4 font-display text-3xl text-night-50">
                  Meet {barber.name.split(' ')[0]}
                </h2>
                <p className="mt-5 leading-relaxed text-night-400">
                  {barber.biography}
                </p>
              </div>

              <div>
                <p className="label-luxe">Specialties</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {barber.specialty
                    .split('&')
                    .map((part) => part.trim())
                    .map((value) => (
                      <span
                        key={value}
                        className="rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-sm font-semibold text-gold-300"
                      >
                        {value}
                      </span>
                    ))}
                </div>
              </div>

              <div>
                <p className="label-luxe">Services Offered</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {offeredServices.length > 0 ? (
                    offeredServices.map((service) => (
                      <Link
                        key={service!.id}
                        to={`/services/${service!.id}`}
                        className="group flex items-center justify-between rounded-xl border border-night-800 bg-night-900/60 p-4 transition-all duration-300 hover:border-gold-500/40"
                      >
                        <div>
                          <p className="text-sm font-semibold text-night-100">
                            {service!.name}
                          </p>
                          <p className="mt-0.5 text-xs text-night-500">
                            {service!.duration} min
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gold-400">
                          {formatPrice(service!.price)}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-night-500">
                      Check the services menu for availability.
                    </p>
                  )}
                </div>
              </div>

              {galleryImages.length > 0 && (
                <div>
                  <p className="label-luxe">Gallery</p>
                  <h3 className="mt-4 font-display text-3xl text-night-50">
                    Work by {barber.name.split(' ')[0]}
                  </h3>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    {galleryImages.map((image) => (
                      <GalleryCard
                        key={image.id}
                        image={image}
                        onOpen={(item) =>
                          setLightboxIndex(
                            galleryImages.findIndex((i) => i.id === item.id),
                          )
                        }
                        showLabel={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="label-luxe">Reviews</p>
                <h3 className="mt-4 font-display text-3xl text-night-50">
                  What Clients Say
                </h3>
                <div className="mt-6 space-y-5">
                  {reviews.map((review) => (
                    <figure
                      key={review.id}
                      className="card-lux card-hover p-6"
                    >
                      <Quote className="h-6 w-6 text-gold-500/30" />
                      <blockquote className="mt-3 leading-relaxed text-night-300">
                        &ldquo;{review.text}&rdquo;
                      </blockquote>
                      <figcaption className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 font-display text-sm font-semibold text-gold-400">
                            {review.name.charAt(0)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-night-100">
                              {review.name}
                            </p>
                            <p className="text-xs text-night-500">
                              {review.date}
                            </p>
                          </div>
                        </div>
                        <StarRating rating={review.rating} />
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-night-800 pt-8 sm:flex-row">
                <ButtonLink
                  to={`/book?barber=${barber.id}`}
                  variant="gold"
                  size="lg"
                  className="flex-1"
                >
                  <Star className="h-4 w-4 fill-current" />
                  Book Appointment
                </ButtonLink>
                <ButtonLink to="/barbers" variant="outline" size="lg">
                  <Award className="h-4 w-4" />
                  Back to Barbers
                </ButtonLink>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <ImageLightbox
        images={galleryImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </PageTransition>
  )
}