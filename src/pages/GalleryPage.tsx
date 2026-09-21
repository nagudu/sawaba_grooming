import { useEffect, useState } from 'react'
import { Images } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import PageHero from '../components/layout/PageHero'
import GalleryCard from '../components/gallery/GalleryCard'
import ImageLightbox from '../components/gallery/ImageLightbox'
import EmptyState from '../components/ui/EmptyState'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import {
  fetchGalleryImages,
  PUBLIC_GALLERY_CATEGORIES,
  type PublicGalleryImage,
} from '../api/gallery'
import { cn } from '../utils/cn'

export default function GalleryPage() {
  const [active, setActive] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [images, setImages] = useState<PublicGalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      try {
        const data = await fetchGalleryImages()
        if (!cancelled) {
          setImages(data)
          setError(null)
        }
      } catch {
        if (!cancelled) {
          setError('Could not load the gallery. Please try again later.')
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

  const filtered =
    active === 'all' ? images : images.filter((image) => image.category === active)

  const openIndex = (id: string) => {
    const index = filtered.findIndex((image) => image.id === id)
    setLightboxIndex(index === -1 ? 0 : index)
  }

  return (
    <PageTransition>
      <PageHero
        eyebrow="Gallery"
        crumb="Gallery"
        title="Our Work, On Display"
        description="Browse real results from our chairs — haircuts, fades, beards and the space where the craft happens."
        image="/images/about-3.jpg"
      />

      <section className="bg-night-950 py-24 md:py-32">
        <div className="container-app">
          {loading ? (
            <LoadingSpinner label="Loading gallery" />
          ) : error ? (
            <div className="mt-16">
              <EmptyState
                icon={<Images className="h-10 w-10" />}
                title="Unable to load gallery"
                description={error}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {PUBLIC_GALLERY_CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => {
                      setActive(category.value)
                      setLightboxIndex(null)
                    }}
                    className={cn(
                      'rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-300',
                      active === category.value
                        ? 'border-gold-500 bg-gold-500 text-night-950 shadow-[0_8px_20px_-6px_rgba(201,162,75,0.6)]'
                        : 'border-night-700 text-night-300 hover:border-gold-500/60 hover:text-gold-300',
                    )}
                  >
                    {category.label}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="mt-16">
                  <EmptyState
                    icon={<Images className="h-10 w-10" />}
                    title="No photos in this category"
                    description="We are constantly adding new shots. Try another filter."
                  />
                </div>
              ) : (
                <div
                  key={active}
                  className="mt-14 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4"
                >
                  {filtered.map((image) => (
                    <GalleryCard key={image.id} image={image} onOpen={(item) => openIndex(item.id)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <ImageLightbox
        images={filtered}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </PageTransition>
  )
}