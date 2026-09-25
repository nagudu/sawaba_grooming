import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import ServiceCard from '../components/services/ServiceCard'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SmartImage from '../components/ui/SmartImage'
import { ButtonLink, Button } from '../components/ui/Button'
import { useCatalog } from '../store/catalog'
import { formatDuration, formatPrice } from '../utils/format'
import { useToast } from '../components/ui/ToastNotification'

const CATEGORY_LABELS: Record<string, string> = {
  HAIRCUTS: 'Haircuts',
  BEARDS: 'Beards',
  HAIR_AND_BEARD: 'Hair & Beard',
  GROOMING: 'Grooming',
  KIDS: 'Kids',
  TREATMENTS: 'Treatments',
  STYLING: 'Styling',
}

export default function ServiceDetailsPage() {
  const { id } = useParams()
  const { loading, getService, getRelatedServices } = useCatalog()
  const toast = useToast()

  const service = loading ? null : getService(id)

  if (loading) {
    return (
      <PageTransition>
        <section className="bg-night-950 py-16">
          <div className="container-app flex flex-col items-center gap-4 py-20 text-night-400">
            <LoadingSpinner className="h-8 w-8 text-gold-500" />
            <p className="text-sm">Loading service…</p>
          </div>
        </section>
      </PageTransition>
    )
  }

  if (!service) {
    return (
      <PageTransition>
        <PageHero
          eyebrow="Service Not Found"
          crumb="Service"
          title="We Couldn't Find That Service"
        />
        <section className="bg-night-950 py-16">
          <div className="container-app">
            <EmptyState
              title="This service does not exist"
              description="It may have moved or been removed. Browse the full menu for available services."
              action={
                <ButtonLink to="/services" variant="gold" size="md">
                  Back to Services
                </ButtonLink>
              }
            />
          </div>
        </section>
      </PageTransition>
    )
  }

  const related = getRelatedServices(service).slice(0, 3)

  const icons = [Sparkles, ShieldCheck, HeartHandshake]

  return (
    <PageTransition>
      <PageHero
        eyebrow={CATEGORY_LABELS[service.category] ?? service.category}
        crumb="Services"
        title={service.name}
        description={service.description}
        image="/images/about-story.jpg"
      />

      <section className="bg-night-950 py-16 md:py-20">
        <div className="container-app">
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
            >
              <div className="overflow-hidden rounded-2xl border border-night-800">
                <SmartImage
                  src={service.image || undefined}
                  alt={service.name}
                  className="aspect-[16/9] w-full"
                />
              </div>

              <p className="label-luxe mt-10">Full Description</p>
              <h2 className="mt-4 font-display text-3xl text-night-50">
                The {service.name} Experience
              </h2>
              <p className="mt-5 leading-relaxed text-night-400">
                {service.description}
              </p>

              <p className="label-luxe mt-10">What's Included</p>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {service.benefits.map((benefit, index) => (
                  <li key={benefit} className="flex items-start gap-3 text-[15px] text-night-200">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-500/50 bg-gold-500/10">
                      {(() => {
                        const Icon = icons[index % icons.length]
                        return <Icon className="h-3.5 w-3.5 text-gold-400" />
                      })()}
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <ButtonLink
                  to={`/book?service=${service.id}`}
                  variant="gold"
                  size="lg"
                >
                  Book This Service
                </ButtonLink>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => toast.showToast(`A booking request for ${service.name} has been saved.`, 'info')}
                >
                  Save for Later
                </Button>
              </div>
            </motion.div>

            <motion.div
              className="space-y-6"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="card-lux sticky top-24 p-7">
                <p className="label-luxe">Service Details</p>
                <h3 className="mt-4 font-display text-2xl text-night-50">
                  {service.name}
                </h3>

                <dl className="mt-6 space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-night-800 bg-night-900/60 px-4 py-3">
                    <dt className="text-sm text-night-400">Price</dt>
                    <dd className="font-display text-2xl font-semibold text-gold-400">
                      {formatPrice(service.price)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-night-800 bg-night-900/60 px-4 py-3">
                    <dt className="text-sm text-night-400">Duration</dt>
                    <dd className="flex items-center gap-2 text-sm font-semibold text-night-100">
                      <Clock className="h-4 w-4 text-gold-500" />
                      {formatDuration(service.duration)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-night-800 bg-night-900/60 px-4 py-3">
                    <dt className="text-sm text-night-400">Category</dt>
                    <dd className="text-sm font-semibold capitalize text-night-100">
                      {CATEGORY_LABELS[service.category] ?? service.category}
                    </dd>
                  </div>
                </dl>

                <div className="mt-7 flex flex-col gap-3">
                  <ButtonLink to={`/book?service=${service.id}`} variant="gold" size="md" fullWidth>
                    Book This Service
                    <ArrowRight className="h-4 w-4" />
                  </ButtonLink>
                  <Link
                    to="/services"
                    className="flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-night-400 transition-colors hover:text-gold-400"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Services
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-coal py-16 md:py-20">
        <div className="container-app">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl text-night-50">
              Related Services
            </h2>
            <ButtonLink to="/services" variant="ghost" size="sm">
              View All
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ServiceCard key={item.id} service={item} />
            ))}
          </div>
        </div>
      </section>
    </PageTransition>
  )
}
