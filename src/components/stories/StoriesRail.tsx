import { useEffect, useState } from 'react'
import { Play, Sparkles } from 'lucide-react'
import { storiesApi, type StoryItem } from '../../api/stories'
import StoryViewer from './StoryViewer'

function labelFor(type: StoryItem['type']): string {
  if (type === 'PRODUCT') return 'Shop'
  if (type === 'BARBER') return 'Book'
  if (type === 'SERVICE') return 'Service'
  return 'Offer'
}

/**
 * Horizontal Sawaba Stories rail for the homepage. Renders nothing when there
 * are no live stories, so the page layout is untouched most of the time.
 */
export default function StoriesRail() {
  const [stories, setStories] = useState<StoryItem[]>([])
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void storiesApi
      .list()
      .then((items) => {
        if (active) setStories(items)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  if (stories.length === 0) return null

  return (
    <section className="border-y border-night-800 bg-night-950" aria-label="Sawaba Stories">
      <div className="container-app py-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Sawaba Stories
            </p>
            <h2 className="mt-1 font-display text-2xl text-night-50 sm:text-3xl">Discover, Book &amp; Shop</h2>
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-night-500">Fresh for 24 hours</p>
        </div>

        <div className="mt-5 flex gap-4 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stories.map((story, index) => (
            <button
              key={story.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              className="group flex w-[78px] shrink-0 flex-col items-center gap-1.5"
              aria-label={`Open story: ${story.title}`}
            >
              <span className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-tr from-gold-600 via-gold-400 to-gold-200 p-[2px] transition-transform duration-200 group-hover:scale-105">
                <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-night-950 bg-night-800">
                  {story.thumbnailUrl || story.image ? (
                    <img
                      src={story.thumbnailUrl ?? story.image ?? ''}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Sparkles className="h-6 w-6 text-gold-400" />
                  )}
                  {story.mediaType === 'VIDEO' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <Play className="h-5 w-5 text-white" aria-hidden="true" />
                    </span>
                  )}
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] font-medium text-night-200">{story.ownerName}</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gold-500/80">
                {labelFor(story.type)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {openIndex !== null && (
        <StoryViewer stories={stories} startIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </section>
  )
}
