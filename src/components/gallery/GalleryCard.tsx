import { useState } from 'react'
import { ImageOff, Plus } from 'lucide-react'
import { cn } from '../../utils/cn'

interface GalleryImageLike {
  id: string
  src: string
  title: string
  category: string
}

interface GalleryCardProps {
  image: GalleryImageLike
  onOpen: (image: GalleryImageLike) => void
  className?: string
  showLabel?: boolean
}

/**
 * Gallery card — uniform, professional portfolio tile.
 *
 * Every card uses the same 4:5 frame (`aspect-[4/5]`) and `object-cover`, so
 * any image the admin uploads — portrait, landscape or square — fills the
 * tile edge-to-edge, never stretched or letterboxed. The caption overlay and
 * hover treatment keep the wall looking premium and consistent.
 */
export default function GalleryCard({
  image,
  onOpen,
  className,
  showLabel = true,
}: GalleryCardProps) {
  const [failed, setFailed] = useState(false)

  return (
    <button
      type="button"
      onClick={() => onOpen(image)}
      aria-label={`Open ${image.title}`}
      className={cn(
        'group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border border-night-800 bg-night-900 text-left transition-all duration-300 hover:border-gold-500/60 hover:shadow-[0_20px_50px_-20px_rgba(201,162,75,0.35)]',
        className,
      )}
    >
      {failed ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-night-950/60 p-4">
          <ImageOff className="h-7 w-7 text-night-600" />
          <span className="text-center text-[10px] font-semibold tracking-[0.18em] text-night-500 uppercase">
            {image.title}
          </span>
        </span>
      ) : (
        <img
          src={image.src}
          alt={image.title}
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
      )}

      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-950/90 via-night-950/15 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 scale-75 items-center justify-center rounded-full border border-gold-500/70 bg-night-950/50 text-gold-300 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
          <Plus className="h-5 w-5" />
        </span>
      </span>

      {showLabel && (
        <span className="pointer-events-none absolute right-4 bottom-4 left-4">
          <span className="block translate-y-1 text-sm font-semibold text-night-50 drop-shadow-md transition-transform duration-300 group-hover:translate-y-0">
            {image.title}
          </span>
          <span className="mt-1 block text-[10px] tracking-[0.2em] text-gold-400 uppercase">
            {image.category}
          </span>
        </span>
      )}
    </button>
  )
}