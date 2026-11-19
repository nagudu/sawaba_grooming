import { formatPrice } from '../utils/format'
import type { StoryItem } from '../api/stories'

/** Official website included in every shared caption. */
export const SAWABA_OFFICIAL_URL = 'https://sawabagroomingstudio.com.ng/'

function absoluteLink(story: StoryItem): string | null {
  if (!story.ctaHref) return null
  try {
    return new URL(story.ctaHref, SAWABA_OFFICIAL_URL).toString()
  } catch {
    return SAWABA_OFFICIAL_URL
  }
}

/** Attractive, policy-safe caption for WhatsApp / Status sharing. */
export function storyCaption(story: StoryItem): string {
  const lines: string[] = []
  lines.push(`✨ ${story.title}`)
  if (story.caption) lines.push(story.caption)
  if (story.price != null) {
    const price = formatPrice(story.price)
    const compare = story.compareAtPrice != null && story.compareAtPrice > story.price
      ? ` (was ${formatPrice(story.compareAtPrice)})`
      : ''
    lines.push(`💰 ${price}${compare}`)
  }
  const link = absoluteLink(story)
  if (link) lines.push(`👉 ${link}`)
  lines.push(`${SAWABA_OFFICIAL_URL}`)
  return lines.filter(Boolean).join('\n')
}

function storyMediaUrl(story: StoryItem): string | null {
  return story.mediaType === 'VIDEO' ? story.video ?? story.image : story.image ?? story.thumbnailUrl
}

function extensionFor(url: string, fallback: string): string {
  const match = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)
  return match ? match[1].toLowerCase() : fallback
}

export type ShareResult = 'shared' | 'whatsapp' | 'cancelled'

/**
 * Opens the device share sheet (WhatsApp appears there on mobile). Sharing is
 * always user-initiated; the app never posts to anyone's WhatsApp account.
 * Falls back to a wa.me text share when the Web Share API is unavailable.
 */
export async function shareStory(story: StoryItem): Promise<ShareResult> {
  const text = storyCaption(story)
  const mediaUrl = storyMediaUrl(story)

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    // Prefer sharing the actual image/video (supported on mobile Chrome/Safari),
    // which lets the user pick WhatsApp Status in the native sheet.
    if (mediaUrl && typeof navigator.canShare === 'function') {
      try {
        const response = await fetch(mediaUrl)
        if (response.ok) {
          const blob = await response.blob()
          const ext = extensionFor(mediaUrl, story.mediaType === 'VIDEO' ? 'mp4' : 'jpg')
          const file = new File([blob], `sawaba-story.${ext}`, { type: blob.type || 'application/octet-stream' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text, title: story.title })
            return 'shared'
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return 'cancelled'
        // Fall through to a text share.
      }
    }
    try {
      await navigator.share({ title: story.title, text, url: SAWABA_OFFICIAL_URL })
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled'
    }
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  return 'whatsapp'
}

/** Downloads the story media so it can be posted to WhatsApp Status manually. */
export async function downloadStoryMedia(story: StoryItem): Promise<void> {
  const url = storyMediaUrl(story)
  if (!url) throw new Error('This story has no downloadable media.')
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not download the story media.')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `sawaba-story.${extensionFor(url, story.mediaType === 'VIDEO' ? 'mp4' : 'jpg')}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
}

export async function copyStoryCaption(story: StoryItem): Promise<void> {
  await navigator.clipboard.writeText(storyCaption(story))
}
