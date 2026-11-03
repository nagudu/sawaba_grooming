import { Play } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface ThumbMedia {
  url: string
  mediaType?: string | null
  thumbnailUrl?: string | null
  alt?: string | null
  isPrimary?: boolean
}

/**
 * Compact product media thumbnail. Renders images as <img> and videos as a real
 * <video> (poster frame + play badge) so uploaded videos are visible in the
 * dashboard lists, not just on the storefront.
 */
export default function ProductMediaThumb({
  media,
  className,
  showPlayBadge = true,
  fallback = null,
}: {
  media: ThumbMedia | null | undefined
  className?: string
  showPlayBadge?: boolean
  fallback?: React.ReactNode
}) {
  if (!media?.url) return <>{fallback}</>

  if (media.mediaType === 'VIDEO') {
    return (
      <span className={cn('relative block overflow-hidden', className)}>
        <video
          src={media.url}
          poster={media.thumbnailUrl ?? undefined}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        {showPlayBadge ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55">
              <Play className="h-3.5 w-3.5 text-white" aria-hidden="true" />
            </span>
          </span>
        ) : null}
      </span>
    )
  }

  return <img src={media.url} alt={media.alt ?? ''} loading="lazy" className={className} />
}

/** Picks the primary media for a product, falling back to the first item. */
export function primaryProductMedia(media: ThumbMedia[] | null | undefined): ThumbMedia | null {
  if (!media || media.length === 0) return null
  return media.find((item) => item.isPrimary) ?? media[0]
}
