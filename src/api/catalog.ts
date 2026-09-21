import { api, type BarberItem, type Paged, type ServiceItem } from './index'
import { cachedJson } from './offlineCache'

/**
 * Public catalog helpers — the single source of truth for services and
 * barbers on the public website. Everything here comes from the backend so
 * admin edits appear immediately; no hardcoded seed arrays.
 */

export interface CatalogService {
  id: number
  name: string
  category: string
  tagline: string
  description: string
  price: number
  duration: number
  image: string | null
  benefits: string[]
}

export interface CatalogBarber {
  id: number
  name: string
  slug: string
  specialty: string
  biography: string
  experience: number
  rating: number
  reviewCount: number
  image: string | null
  services: Array<{ id: number; name: string }>
}

const FALLBACK_IMAGE = ''

function normalizeService(item: ServiceItem & { category?: string }): CatalogService {
  const name = item.name
  return {
    id: item.id,
    name,
    category: (item.category ?? 'HAIRCUTS').toString(),
    tagline: 'Professional SAWABA service',
    description: item.description ?? '',
    price: Number(item.price ?? 0),
    duration: Number(item.duration ?? 30),
    image: item.image ?? FALLBACK_IMAGE,
    // Derived care-bullets so detail pages keep their structure without
    // hardcoded per-service seed data.
    benefits: [
      'Personalised consultation before we start',
      'Delivered by a certified SAWABA professional',
      'Premium products for a lasting finish',
      'Comfortable, relaxed experience',
    ],
  }
}

function normalizeBarber(item: BarberItem & {
  biography?: string | null
  reviewCount?: number
  services?: Array<{ id: number; name: string }>
}): CatalogBarber {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    specialty: item.specialty ?? 'Grooming professional',
    biography: item.biography ?? 'A certified SAWABA professional dedicated to a flawless finish.',
    experience: Number(item.experience ?? 0),
    rating: Number(item.rating ?? 0),
    reviewCount: Number((item as { reviewCount?: number }).reviewCount ?? 0),
    image: item.image ?? FALLBACK_IMAGE,
    services: (item.services ?? []).map((service) => ({ id: service.id, name: service.name })),
  }
}

export async function fetchCatalogServices(): Promise<CatalogService[]> {
  return cachedJson('services', async () => {
    const data = await api.get<Paged<ServiceItem>>('/api/services?perPage=100')
    return data.items.map(normalizeService)
  })
}

export async function fetchCatalogBarbers(): Promise<CatalogBarber[]> {
  return cachedJson('barbers', async () => {
    const data = await api.get<Paged<BarberItem>>('/api/barbers?perPage=100')
    return data.items.map(normalizeBarber)
  })
}
