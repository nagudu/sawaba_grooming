import { ArrowUpRight, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CatalogBarber } from '../../api/catalog'
import SmartImage from '../ui/SmartImage'
import { ButtonLink } from '../ui/Button'

interface BarberCardProps {
  barber: CatalogBarber
}

export default function BarberCard({ barber }: BarberCardProps) {
  return (
    <div className="card-lux card-hover group overflow-hidden">
      <Link
        to={`/barbers/${barber.id}`}
        className="relative block aspect-[4/5] overflow-hidden"
        aria-label={`View ${barber.name} profile`}
      >
        <SmartImage
          src={barber.image || undefined}
          alt={`${barber.name} — ${barber.specialty}`}
          className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/20 to-transparent" />
        <div className="absolute right-4 bottom-4 left-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
            {barber.specialty}
          </p>
          <h3 className="mt-1 font-display text-2xl text-night-50">
            {barber.name}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-night-300">
            <Star className="h-4 w-4 fill-gold-400 text-gold-400" />
            <span className="font-medium">{barber.rating.toFixed(1)}</span>
            <span className="text-night-500">
              ({barber.reviewCount} reviews)
            </span>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-3 p-4">
        <ButtonLink
          to={`/barbers/${barber.id}`}
          variant="ghost"
          size="sm"
          className="flex-1"
        >
          View Profile
        </ButtonLink>
        <ButtonLink
          to="/book"
          variant="gold"
          size="sm"
          className="flex-1"
        >
          Book Now
        </ButtonLink>
      </div>
    </div>
  )
}

export function BarberRowLink({ barber }: { barber: CatalogBarber }) {
  return (
    <Link
      to={`/barbers/${barber.id}`}
      className="group flex items-center gap-4 rounded-xl border border-night-800 bg-night-900/60 p-3 pr-4 transition-all duration-300 hover:border-gold-500/40"
    >
      <SmartImage
        src={barber.image || undefined}
        alt={barber.name}
        className="h-14 w-14 rounded-lg"
      />
      <div className="flex-1">
        <p className="text-sm font-semibold text-night-100">{barber.name}</p>
        <p className="text-xs text-night-500">{barber.specialty}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-night-500 transition-colors group-hover:text-gold-400" />
    </Link>
  )
}