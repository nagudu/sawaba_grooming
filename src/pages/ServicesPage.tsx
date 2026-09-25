import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Scissors } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import ServiceCard from '../components/services/ServiceCard'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useCatalog } from '../store/catalog'
import { cn } from '../utils/cn'

const CATEGORY_LABELS: Record<string, string> = {
  HAIRCUTS: 'Haircuts',
  BEARDS: 'Beards',
  HAIR_AND_BEARD: 'Hair & Beard',
  GROOMING: 'Grooming',
  KIDS: 'Kids',
  TREATMENTS: 'Treatments',
  STYLING: 'Styling',
}

export default function ServicesPage() {
  const { services, loading, error } = useCatalog()
  const [category, setCategory] = useState<string>('all')

  const categories = useMemo(() => {
    const present = [...new Set(services.map((service) => service.category))]
    return [
      { value: 'all', label: 'All Services' },
      ...present.map((value) => ({ value, label: CATEGORY_LABELS[value] ?? value })),
    ]
  }, [services])

  const filtered = category === 'all' ? services : services.filter((service) => service.category === category)

  return (
    <PageTransition>
      <PageHero
        eyebrow="Our Services"
        crumb="Services"
        title="A Service for Every Look"
        description="From timeless classics to statement fades — every service is delivered with precision, premium products and the SAWABA standard."
        image="/images/about-story.jpg"
      />

      <section className="bg-night-950 py-16 md:py-20">
        <div className="container-app">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-16 text-night-400">
              <LoadingSpinner className="h-8 w-8 text-gold-500" />
              <p className="text-sm">Loading services…</p>
            </div>
          ) : error ? (
            <EmptyState
              icon={<Scissors className="h-10 w-10" />}
              title="Could not load services"
              description={error}
            />
          ) : (
            <>
              <div className="flex flex-wrap justify-center gap-2">
                {categories.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                      category === item.value
                        ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                        : 'border-night-700 bg-night-900 text-night-400 hover:border-gold-500/40 hover:text-gold-300',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="mt-10">
                  <EmptyState
                    icon={<Scissors className="h-10 w-10" />}
                    title="No services in this category"
                    description="Try another category, or view all services."
                  />
                </div>
              ) : (
                <motion.div
                  key={category}
                  className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
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
                      <ServiceCard service={service} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </>
          )}
        </div>
      </section>
    </PageTransition>
  )
}
