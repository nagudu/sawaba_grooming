import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import SmartImage from '../ui/SmartImage'

interface GalleryImageLike {
  id: string
  src: string
  title: string
  category: string
}

interface ImageLightboxProps {
  images: GalleryImageLike[]
  index: number | null
  onClose: () => void
  onNavigate: (index: number) => void
}

export default function ImageLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: ImageLightboxProps) {
  const [loaded, setLoaded] = useState(false)
  const isOpen = index !== null

  const previous = useCallback(() => {
    if (index === null) return
    onNavigate((index - 1 + images.length) % images.length)
  }, [index, images.length, onNavigate])

  const next = useCallback(() => {
    if (index === null) return
    onNavigate((index + 1) % images.length)
  }, [index, images.length, onNavigate])

  useEffect(() => {
    if (!isOpen) return
    setLoaded(false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') previous()
      if (event.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, previous, next])

  const current = index === null ? null : images[index]

  return (
    <AnimatePresence>
      {isOpen && current && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-night-950/95 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="absolute top-5 right-5 z-10 rounded-xl border border-night-700 bg-night-900/70 p-3 text-night-300 backdrop-blur-md transition-colors hover:text-gold-400"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              previous()
            }}
            aria-label="Previous image"
            className="absolute left-3 z-10 rounded-xl border border-night-700 bg-night-900/70 p-3 text-night-300 backdrop-blur-md transition-colors hover:text-gold-400 md:left-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              next()
            }}
            aria-label="Next image"
            className="absolute right-3 z-10 rounded-xl border border-night-700 bg-night-900/70 p-3 text-night-300 backdrop-blur-md transition-colors hover:text-gold-400 md:right-6"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <motion.figure
            key={current.id}
            className="max-h-[82vh] w-full max-w-5xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-2xl border border-night-700 bg-night-900">
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-night-900">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
                </div>
              )}
              <SmartImage
                src={current.src}
                alt={current.title}
                className="max-h-[72vh] w-full"
                loading="eager"
                onLoad={() => setLoaded(true)}
              />
            </div>
            <figcaption className="mt-4 flex items-center justify-between">
              <div>
                <p className="font-display text-lg text-night-50">
                  {current.title}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-gold-400">
                  {current.category}
                </p>
              </div>
              <p className="text-sm text-night-500">
                {(index ?? 0) + 1} / {images.length}
              </p>
            </figcaption>
          </motion.figure>
        </motion.div>
      )}
    </AnimatePresence>
  )
}