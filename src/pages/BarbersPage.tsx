import { useDebounced } from '../hooks/useDebounced'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Users } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import BarberCard from '../components/barbers/BarberCard'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useCatalog } from '../store/catalog'

export default function BarbersPage() {
  const { barbers, loading, error } = useCatalog()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query.trim().toLowerCase(), 250)

  const filtered = barbers.filter((barber) => {
    if (!debouncedQuery) return true
    const haystack = `${barber.name} ${barber.specialty} ${barber.biography}`.toLowerCase()
    return haystack.includes(debouncedQuery)
  })

  return (
    <PageTransition>
      <PageHero
        eyebrow="Our Team"
        crumb="Barbers"
        title="The Masters Behind the Chair"
        description="Meet the barbers who make SAWABA what it is — trained, certified and genuinely invested in your look."
        image="/images/about-2.jpg"
      />

      <section className="bg-night-950 py-24 md:py-32">
        <div className="container-app">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-night-800 bg-night-900 px-5 py-1 transition-colors focus-within:border-gold-500">
            <Search className="h-5 w-5 text-night-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or specialty..."
              className="w-full bg-transparent py-3.5 text-sm text-night-100 placeholder:text-night-500 focus:outline-none"
              aria-label="Search barbers"
            />
          </div>

          {loading ? (
            <div className="mt-16 flex flex-col items-center gap-4 py-16 text-night-400">
              <LoadingSpinner className="h-8 w-8 text-gold-500" />
              <p className="text-sm">Loading our team…</p>
            </div>
          ) : error ? (
            <div className="mt-16">
              <EmptyState
                icon={<Users className="h-10 w-10" />}
                title="Could not load the team"
                description={error}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-16">
              <EmptyState
                icon={<Users className="h-10 w-10" />}
                title="No barbers found"
                description={`No results for "${query}". Try a different name or specialty.`}
              />
            </div>
          ) : (
            <motion.div
              key={debouncedQuery}
              className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            >
              {filtered.map((barber) => (
                <motion.div
                  key={barber.id}
                  variants={{
                    hidden: { opacity: 0, y: 24 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                    },
                  }}
                >
                  <BarberCard barber={barber} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>
    </PageTransition>
  )
}
