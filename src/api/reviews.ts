import { api, type Paged, type ReviewItem } from './index'

export interface PublicReview {
  id: string
  name: string
  image: string | null
  rating: number
  text: string
  service: string | null
  date: string
}

export async function fetchApprovedReviews(): Promise<PublicReview[]> {
  const data = await api.get<Paged<ReviewItem>>('/api/reviews?approved=true&page=1&perPage=100')
  return data.items.map((item) => ({
    id: String(item.id),
    name: item.customerName,
    image: item.customerImage,
    rating: item.rating,
    text: item.comment,
    service: item.serviceName,
    date: item.createdAt,
  }))
}

export interface SubmitReviewInput {
  customerName: string
  customerPhone?: string | null
  customerEmail?: string | null
  serviceId?: number | null
  serviceName?: string | null
  rating: number
  comment: string
}

export async function submitReview(input: SubmitReviewInput): Promise<void> {
  await api.post('/api/reviews', input)
}