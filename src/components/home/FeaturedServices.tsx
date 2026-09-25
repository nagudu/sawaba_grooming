import { ArrowRight } from 'lucide-react'
import ServiceCard from '../services/ServiceCard'
import SectionTitle from '../ui/SectionTitle'
import { ButtonLink } from '../ui/Button'
import { useCatalog } from '../../store/catalog'

export default function FeaturedServices() {
  const { services, loading } = useCatalog()
  const featured = services.slice(0, 6)

  if (!loading && featured.length === 0) return null

  return (
    <section className="bg-coal py-16 md:py-20">
      <div className="container-app">
        <SectionTitle
          eyebrow="Our Services"
          title="Crafted for the Modern Man"
          description="From timeless classics to statement fades — every service is delivered with precision, premium products and the SAWABA standard."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-[4/3] animate-pulse rounded-2xl border border-night-800 bg-night-900/60"
                />
              ))
            : featured.map((service) => <ServiceCard key={service.id} service={service} />)}
        </div>

        <div className="mt-12 text-center">
          <ButtonLink to="/services" variant="outline" size="md">
            View All Services
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
