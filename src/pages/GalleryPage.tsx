import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
        imageId="1643899552181-6035a1e0872c"
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
                <motion.div
                  key={active}
                  className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  initial="hidden"
                  animate="show"
                  variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                >
                  {filtered.map((image) => (
                    <motion.div
                      key={image.id}
                      variants={{
                        hidden: { opacity: 0, scale: 0.96 },
                        show: {
                          opacity: 1,
                          scale: 1,
                          transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                        },
                      }}
                    >
                      <GalleryCard image={image} onOpen={(item) => openIndex(item.id)} />
                    </motion.div>
                  ))}
                </motion.div>
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