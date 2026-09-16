export type ServiceCategory =
  | 'haircut'
  | 'beard'
  | 'grooming'
  | 'treatment'
  | 'kids'
  | 'vip'

export interface Service {
  id: string
  name: string
  category: ServiceCategory
  tagline: string
  description: string
  longDescription?: string
  price: number
  duration: number
  image: string
  featured?: boolean
  benefits?: string[]
  relatedIds?: string[]
}

export interface Barber {
  id: string
  name: string
  specialty: string
  experienceYears: number
  rating: number
  reviewCount: number
  image: string
  bio: string
  longBio?: string
  serviceIds?: string[]
  gallery?: string[]
}

export type GalleryCategory =
  | 'haircuts'
  | 'fades'
  | 'beards'
  | 'styling'
  | 'kids'
  | 'interior'

export interface GalleryImage {
  id: string
  src: string
  title: string
  category: GalleryCategory
}

export interface Testimonial {
  id: string
  name: string
  image: string
  rating: number
  text: string
  service?: string
  date?: string
}

export interface CustomerInfo {
  fullName: string
  phone: string
  email: string
  notes?: string
}

export interface BookingData {
  serviceId: string | null
  barberId: string | null
  date: string | null
  time: string | null
  customer: CustomerInfo
}