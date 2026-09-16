import { ArrowUpRight, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CatalogService } from '../../api/catalog'
import { formatDuration, formatPrice } from '../../utils/format'
import SmartImage from '../ui/SmartImage'
import { ButtonLink } from '../ui/Button'

interface ServiceCardProps {
  service: CatalogService
}

export default function ServiceCard({ service }: ServiceCardProps) {
  return (
    <div className="card-lux card-hover group flex flex-col overflow-hidden">
      <Link
        to={`/services/${service.id}`}
        className="relative block aspect-[4/3] overflow-hidden"
        aria-label={`View ${service.name} details`}
      >
        <SmartImage
          src={service.image || undefined}
          alt={service.name}
          className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night-950/70 via-transparent to-transparent" />
        <span className="absolute right-4 bottom-4 rounded-full border border-gold-500/40 bg-night-950/70 px-3 py-1 text-[11px] font-semibold tracking-wide text-gold-300 backdrop-blur-sm">
          {formatPrice(service.price)}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs text-night-500">
          <Clock className="h-3.5 w-3.5 text-gold-500" />
          <span>{formatDuration(service.duration)}</span>
        </div>
        <h3 className="mt-2 font-display text-xl text-night-50">
          <Link
            to={`/services/${service.id}`}
            className="transition-colors hover:text-gold-400"
          >
            {service.name}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-night-400">
          {service.description}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <ButtonLink
            to="/book"
            variant="outline"
            size="sm"
            className="flex-1"
          >
            Book Now
          </ButtonLink>
          <Link
            to={`/services/${service.id}`}
            aria-label={`View ${service.name} details`}
            className="rounded-lg border border-night-700 p-2 text-night-400 transition-colors hover:border-gold-500 hover:text-gold-400"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}