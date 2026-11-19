import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { formatPrice } from '../../utils/format'
import { storiesApi, getStoryViewerKey, type StoryItem } from '../../api/stories'
import { shareStory } from '../../lib/storyShare'
import { useToast } from '../ui/ToastNotification'

interface StoryViewerProps {
  stories: StoryItem[]
  startIndex: number
  onClose: () => void
}

const IMAGE_DURATION_MS = 5000

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function typeLabel(type: StoryItem['type']): string {
  if (type === 'PRODUCT') return 'Product'
  if (type === 'BARBER') return 'Barber'
  if (type === 'SERVICE') return 'Service'
  return 'Offer'
}

export default function StoryViewer({ stories, startIndex, onClose }: StoryViewerProps) {
  const { showToast } = useToast()
  const [index, setIndex] = useState(Math.min(Math.max(0, startIndex), stories.length - 1))
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const [ended, setEnded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const story = stories[index]

  const goNext = useCallback(() => {
    setIndex((current) => {
      if (current < stories.length - 1) return current + 1
      setEnded(true)
      return current
    })
  }, [stories.length])

  const goPrev = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1))
  }, [])

  const restart = useCallback(() => {
    setEnded(false)
    setIndex(0)
  }, [])

  // Lock the page and support keyboard navigation while the viewer is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight') goNext()
      else if (event.key === 'ArrowLeft') goPrev()
      else if (event.key === ' ') {
        event.preventDefault()
        setPaused((value) => !value)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [goNext, goPrev, onClose])

  // Reset playback when moving to another story and record a unique view.
  useEffect(() => {
    setProgress(0)
    setEnded(false)
    void storiesApi.view(story.id, getStoryViewerKey()).catch(() => undefined)
    if (stories[index + 1]?.image) {
      const preload = new Image()
      preload.src = stories[index + 1].image as string
    }
  }, [index, story.id, stories])

  // Image stories auto-advance after 5 seconds (paused when requested).
  useEffect(() => {
    if (story.mediaType === 'VIDEO' || paused || ended) return
    setProgress(0)
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const value = Math.min(1, (Date.now() - startedAt) / IMAGE_DURATION_MS)
      setProgress(value)
      if (value >= 1) {
        window.clearInterval(timer)
        goNext()
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [index, paused, ended, story.mediaType, goNext])

  // Keep the video element in sync with pause/mute.
  useEffect(() => {
    const video = videoRef.current
    if (!video || story.mediaType !== 'VIDEO') return
    video.muted = muted
    if (paused || ended) {
      video.pause()
      return
    }
    video.play().catch(() => {
      // Autoplay can be blocked with sound; retry muted.
      video.muted = true
      setMuted(true)
      void video.play().catch(() => undefined)
    })
  }, [index, paused, ended, muted, story.mediaType])

  async function handleShare() {
    try {
      const result = await shareStory(story)
      if (result === 'shared') showToast('Share sheet opened. Choose WhatsApp to post it to your status.')
      else if (result === 'whatsapp') showToast('WhatsApp opened. You can post the story media to your status.')
    } catch {
      showToast('Could not open sharing on this device.', 'error')
    }
  }

  const ctaIsInternal = Boolean(story.ctaHref && story.ctaHref.startsWith('/'))
  const ctaClassName =
    'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-night-950 transition hover:bg-gold-400'

  return (
    <div className="fixed inset-0 z-[100] bg-black" role="dialog" aria-modal="true" aria-label={`Story: ${story.title}`}>
      <div className="relative mx-auto flex h-full w-full max-w-[520px] flex-col">
        {/* Progress bars */}
        <div className="absolute inset-x-0 top-0 z-30 flex gap-1 px-2 pt-2">
          {stories.map((item, itemIndex) => (
            <span key={item.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full rounded-full bg-white transition-[width] duration-100"
                style={{
                  width: itemIndex < index ? '100%' : itemIndex === index ? `${Math.round(progress * 100)}%` : '0%',
                }}
              />
            </span>
          ))}
        </div>

        {/* Header */}
        <div className="absolute inset-x-0 top-5 z-30 flex items-center gap-2.5 px-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-400/60 bg-night-900 text-sm font-bold text-gold-300">
            {story.ownerName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{story.ownerName}</p>
            <p className="text-[11px] text-white/70">
              {typeLabel(story.type)} · {timeAgo(story.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Unmute story' : 'Mute story'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="Share story to WhatsApp"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close stories"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Media */}
        <div className="relative flex-1 overflow-hidden bg-black">
          {story.mediaType === 'VIDEO' && story.video ? (
            <video
              key={story.video}
              ref={videoRef}
              src={story.video}
              poster={story.thumbnailUrl ?? undefined}
              className="h-full w-full object-contain"
              playsInline
              muted={muted}
              preload="auto"
              onTimeUpdate={(event) => {
                const video = event.currentTarget
                if (video.duration > 0) setProgress(Math.min(1, video.currentTime / video.duration))
              }}
              onEnded={goNext}
            />
          ) : story.image ? (
            <img src={story.image} alt={story.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-white/60">Story media unavailable</div>
          )}

          {/* Gradient scrims */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black via-black/60 to-transparent" />

          {/* Skip zones */}
          <button
            type="button"
            aria-label="Previous story"
            onClick={goPrev}
            className="absolute inset-y-20 left-0 z-20 w-[30%]"
          />
          <button
            type="button"
            aria-label="Next story"
            onClick={goNext}
            className="absolute inset-y-20 right-0 z-20 w-[34%]"
          />
          <button
            type="button"
            aria-label={paused ? 'Resume story' : 'Pause story'}
            onClick={() => setPaused((value) => !value)}
            className="absolute left-1/2 top-1/2 z-20 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
          >
            {paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
          </button>

          {/* Caption + CTA */}
          <div className="absolute inset-x-0 bottom-0 z-30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
            {story.price != null && (
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-xl font-bold text-gold-300">{formatPrice(story.price)}</span>
                {story.compareAtPrice != null && story.compareAtPrice > story.price && (
                  <span className="text-sm text-white/60 line-through">{formatPrice(story.compareAtPrice)}</span>
                )}
              </div>
            )}
            <h2 className="font-display text-xl leading-snug text-white">{story.title}</h2>
            {story.caption && (
              <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-white/80">
                {story.caption}
              </p>
            )}
            {story.ctaHref && (
              <div className="mt-4">
                {ctaIsInternal ? (
                  <Link to={story.ctaHref} onClick={onClose} className={ctaClassName}>
                    {story.ctaLabel}
                  </Link>
                ) : (
                  <a
                    href={story.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={ctaClassName}
                  >
                    {story.ctaLabel}
                  </a>
                )}
              </div>
            )}
            <div className="mt-3 flex items-center justify-center gap-4 text-white/70">
              <button type="button" onClick={goPrev} disabled={index === 0} className="inline-flex items-center gap-1 text-xs disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button type="button" onClick={goNext} className="inline-flex items-center gap-1 text-xs">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* End card */}
          {ended && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-sm">
              <p className="text-lg font-semibold text-white">You&rsquo;re all caught up</p>
              <p className="text-sm text-white/70">Discover more from Sawaba Grooming Studio.</p>
              <div className="flex gap-3">
                <button type="button" onClick={restart} className={cn(ctaClassName, 'w-auto px-4')}>
                  <RotateCcw className="h-4 w-4" /> Replay
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-xl border border-white/25 px-4 py-3 text-sm text-white hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
