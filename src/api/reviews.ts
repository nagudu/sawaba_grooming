import { api, type Paged, type ReviewItem } from './index'
import { cachedJson } from './offlineCache'

export interface PublicReview {
  id: string
  name: string
  image: string | null
  rating: number
  text: string
  service: string | null
  barberId: number | null
  date: string
}

export async function fetchApprovedReviews(barberId?: number): Promise<PublicReview[]> {
  const query = barberId
    ? `/api/reviews?approved=true&page=1&perPage=100&barberId=${barberId}`
    : '/api/reviews?approved=true&page=1&perPage=100'
  return cachedJson(`reviews:${barberId ?? 'all'}`, async () => {
    const data = await api.get<Paged<ReviewItem>>(query)
    return data.items.map((item) => ({
      id: String(item.id),
      name: item.customerName,
      image: item.customerImage,
      rating: item.rating,
      text: item.comment,
      service: item.serviceName,
      barberId: (item as { barberId?: number | null }).barberId ?? null,
      date: item.createdAt,
    }))
  })
}

export interface SubmitReviewInput {
  customerName: string
  customerPhone?: string | null
  customerEmail?: string | null
  serviceId?: number | null
  serviceName?: string | null
  barberId?: number | null
  rating: number
  comment: string
}

export async function submitReview(input: SubmitReviewInput): Promise<void> {
  await api.post('/api/reviews', input)
}