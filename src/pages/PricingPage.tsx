import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Wallet } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import PricingCard from '../components/pricing/PricingCard'
import SectionTitle from '../components/ui/SectionTitle'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { useCatalog } from '../store/catalog'
import { cn } from '../utils/cn'
import { ButtonLink } from '../components/ui/Button'
import { formatDuration, formatPrice } from '../utils/format'

const CATEGORY_LABELS: Record<string, string> = {
  HAIRCUTS: 'Haircuts',
  BEARDS: 'Beards',
  HAIR_AND_BEARD: 'Hair & Beard',
  GROOMING: 'Combo Grooming',
  KIDS: 'Kids',
  TREATMENTS: 'Treatments',
  STYLING: 'Styling',
}

export default function PricingPage() {
  const { services, loading, error } = useCatalog()
  const [category, setCategory] = useState<string>('all')

  const filtered =
    category === 'all'
      ? services
      : services.filter((service) => service.category === category)

  const categories = useMemo(
    () => [
      { value: 'all', label: 'All Services' },
      ...[...new Set(services.map((service) => service.category))].map((value) => ({
        value,
        label: CATEGORY_LABELS[value] ?? value,
      })),
    ],
    [services],
  )

  // Highlight the most popular service (first one, stable across loads).
  const highlightId = services[0]?.id

  return (
    <PageTransition>
      <PageHero
        eyebrow="Pricing"
        crumb="Pricing"
        title="Transparent, Premium Pricing"
        description="No hidden extras. The price we quote is the price you pay — every product and finish included."
        image="/images/pagehero.jpg"
      />

      <section className="bg-night-950 py-16 md:py-20">
        <div className="container-app">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-20 text-night-400">
              <LoadingSpinner className="h-8 w-8 text-gold-500" />
              <p className="text-sm">Loading prices…</p>
            </div>
          ) : error ? (
            <EmptyState title="Could not load prices" description={error} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {categories.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    className={cn(
                      'rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-300',
                      category === item.value
                        ? 'border-gold-500 bg-gold-500 text-night-950 shadow-[0_8px_20px_-6px_rgba(201,162,75,0.6)]'
                        : 'border-night-700 text-night-300 hover:border-gold-500/60 hover:text-gold-300',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <motion.div
                key={category}
                className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              >
                {filtered.map((service) => (
                  <motion.div
                    key={service.id}
                    variants={{
                      hidden: { opacity: 0, y: 24 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                      },
                    }}
                  >
                    <PricingCard
                      service={service}
                      highlight={service.id === highlightId}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </>
          )}
        </div>
      </section>

      <section className="bg-coal py-16 md:py-20">
        <div className="container-app">
          <SectionTitle
            eyebrow="Good to Know"
            title="A Quick Look at Our Price Guide"
            description="All prices include premium products, hot towel service where applicable, and styling."
          />

          {!loading && !error && (
            <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-night-800 bg-night-900/60">
              <div className="grid grid-cols-4 gap-4 border-b border-night-800 px-6 py-4 text-center">
                {['Service', 'Duration', 'Price', 'Action'].map((heading) => (
                  <span
                    key={heading}
                    className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-400"
                  >
                    {heading}
                  </span>
                ))}
              </div>
              <div className="divide-y divide-night-800">
                {filtered.map((service, index) => (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.03 }}
                    className="grid grid-cols-4 items-center gap-4 px-6 py-4 transition-colors hover:bg-night-800/40"
                  >
                    <span className="text-sm font-semibold text-night-100">
                      {service.name}
                    </span>
                    <span className="text-center text-sm text-night-400">
                      {formatDuration(service.duration)}
                    </span>
                    <span className="text-center text-sm font-semibold text-gold-400">
                      {formatPrice(service.price)}
                    </span>
                    <span className="text-center">
                      <ButtonLink
                        to="/book"
                        variant="ghost"
                        size="sm"
                      >
                        Book Now
                      </ButtonLink>
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <Wallet className="h-8 w-8 text-gold-500" />
            <p className="max-w-xl text-sm leading-relaxed text-night-400">
              Not sure what you need? Book an appointment and our barbers will
              recommend the best service for your hair type, face shape and
              lifestyle — at no extra cost.
            </p>
          </div>
        </div>
      </section>
    </PageTransition>
  )
}
