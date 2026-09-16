import { Check, Clock } from 'lucide-react'
import type { CatalogService } from '../../api/catalog'
import { formatDuration, formatPrice } from '../../utils/format'
import { ButtonLink } from '../ui/Button'
import { cn } from '../../utils/cn'

interface PricingCardProps {
  service: CatalogService
  highlight?: boolean
}

export default function PricingCard({
  service,
  highlight = false,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        'card-lux card-hover relative flex flex-col p-7',
        highlight &&
          'border-gold-500/50 shadow-[var(--shadow-glow)]',
      )}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold-500 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap text-night-950">
          Most Popular
        </span>
      )}

      <h3 className="font-display text-xl text-night-50">{service.name}</h3>
      <p className="mt-2 min-h-[3rem] text-sm leading-relaxed text-night-400">
        {service.description}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="font-display text-3xl font-semibold text-gold-400">
          {formatPrice(service.price)}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-night-500">
          <Clock className="h-4 w-4" />
          {formatDuration(service.duration)}
        </span>
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {(service.benefits ?? []).slice(0, 3).map((benefit) => (
          <li
            key={benefit}
            className="flex items-start gap-2.5 text-sm text-night-300"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
            {benefit}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex gap-3">
        <ButtonLink to="/book" variant={highlight ? 'gold' : 'outline'} size="sm" className="flex-1">
          Book Now
        </ButtonLink>
        <ButtonLink
          to={`/services/${service.id}`}
          variant="ghost"
          size="sm"
        >
          Details
        </ButtonLink>
      </div>
    </div>
  )
}