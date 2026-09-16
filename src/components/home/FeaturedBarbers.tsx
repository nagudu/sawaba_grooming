import { ArrowRight } from 'lucide-react'
import BarberCard from '../barbers/BarberCard'
import SectionTitle from '../ui/SectionTitle'
import { ButtonLink } from '../ui/Button'
import { useCatalog } from '../../store/catalog'

export default function FeaturedBarbers() {
  const { barbers, loading } = useCatalog()
  const featured = barbers.slice(0, 3)

  if (!loading && featured.length === 0) return null

  return (
    <section className="bg-coal py-24 md:py-32">
      <div className="container-app">
        <SectionTitle
          eyebrow="Meet the Team"
          title="Barbers Who Take Pride in Their Work"
          description="Every SAWABA barber is a master of their craft — trained, certified and obsessed with giving you a flawless finish."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-[4/5] animate-pulse rounded-2xl border border-night-800 bg-night-900/60"
                />
              ))
            : featured.map((barber) => <BarberCard key={barber.id} barber={barber} />)}
        </div>

        <div className="mt-12 text-center">
          <ButtonLink to="/barbers" variant="outline" size="md">
            Meet All Barbers
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
