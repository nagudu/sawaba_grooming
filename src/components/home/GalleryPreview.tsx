import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import GalleryCard from '../gallery/GalleryCard'
import ImageLightbox from '../gallery/ImageLightbox'
import SectionTitle from '../ui/SectionTitle'
import { ButtonLink } from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import { fetchGalleryImages, type PublicGalleryImage } from '../../api/gallery'

export default function GalleryPreview() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [images, setImages] = useState<PublicGalleryImage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      try {
        const data = await fetchGalleryImages()
        if (!cancelled) {
          setImages(data.slice(0, 6))
        }
      } catch {
        if (!cancelled) {
          setImages([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section className="bg-night-900 py-16 md:py-20">
        <div className="container-app">
          <LoadingSpinner label="Loading gallery" />
        </div>
      </section>
    )
  }

  if (images.length === 0) return null

  return (
    <section className="bg-night-900 py-16 md:py-20">
      <div className="container-app">
        <SectionTitle
          eyebrow="Our Work"
          title="Looks That Speak for Themselves"
          description="A glimpse of the cuts, fades and finishes our clients walk out wearing."
        />

        <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {images.map((image) => (
            <GalleryCard
              key={image.id}
              image={image}
              onOpen={(item) => setLightboxIndex(images.findIndex((i) => i.id === item.id))}
            />
          ))}
        </div>

        <div className="mt-12 text-center">
          <ButtonLink to="/gallery" variant="outline" size="md">
            View Gallery
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </div>

      <ImageLightbox
        images={images}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </section>
  )
}