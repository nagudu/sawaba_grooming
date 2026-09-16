import { Plus } from 'lucide-react'
import SmartImage from '../ui/SmartImage'
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

export default function GalleryCard({
  image,
  onOpen,
  className,
  showLabel = true,
}: GalleryCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(image)}
      aria-label={`Open ${image.title}`}
      className={cn(
        'group relative block w-full overflow-hidden rounded-xl border border-night-800 bg-night-900 text-left transition-all duration-300 hover:border-gold-500/50',
        className,
      )}
    >
      <SmartImage
        src={image.src}
        alt={image.title}
        className="aspect-[4/3] w-full transition-transform duration-700 ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-night-950/80 via-night-950/10 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 scale-75 items-center justify-center rounded-full border border-gold-500/60 bg-night-950/60 text-gold-400 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
          <Plus className="h-5 w-5" />
        </span>
      </div>
      {showLabel && (
        <div className="absolute right-4 bottom-4 left-4 translate-y-1 transition-transform duration-300 group-hover:translate-y-0">
          <p className="text-sm font-semibold text-night-50">{image.title}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-gold-400">
            {image.category}
          </p>
        </div>
      )}
    </button>
  )
}