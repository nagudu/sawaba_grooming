import { api, type Paged, type GalleryItem } from './index'
import { cachedJson } from './offlineCache'

export interface PublicGalleryImage {
  id: string
  src: string
  title: string
  category: string
}

export const PUBLIC_GALLERY_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'HAIRCUT', label: 'Haircuts' },
  { value: 'FADE', label: 'Fades' },
  { value: 'BEARD', label: 'Beards' },
  { value: 'STYLING', label: 'Styling' },
  { value: 'KIDS', label: 'Kids' },
  { value: 'SALON', label: 'Salon' },
]

export async function fetchGalleryImages(): Promise<PublicGalleryImage[]> {
  return cachedJson('gallery', async () => {
    const data = await api.get<Paged<GalleryItem>>('/api/gallery?page=1&perPage=100')
    return data.items.map((item) => ({
      id: String(item.id),
      src: item.image,
      title: item.title,
      category: item.category,
    }))
  })
}