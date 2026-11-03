/**
 * Product media: shared types, client-side validation, direct Cloudinary
 * uploads with progress, and the payload builder used by the vendor/admin forms.
 */

export type ProductMediaType = 'IMAGE' | 'VIDEO'

export interface ProductMediaItem {
  id: number
  url: string
  alt?: string | null
  mediaType: string
  thumbnailUrl: string | null
  duration: number | null
  isPrimary: boolean
  sortOrder: number
}

export interface PendingMedia {
  key: string
  file: File
  mediaType: ProductMediaType
  previewUrl: string
  duration: number | null
}

export interface MediaManagerState {
  /** Existing media kept for this product, in display order. */
  existing: ProductMediaItem[]
  /** New files to upload, in order. */
  pending: PendingMedia[]
  /** 'existing:<id>' | 'pending:<key>' | null */
  primaryKey: string | null
}

export const MAX_IMAGES = 8
export const MAX_VIDEOS = 4
export const MAX_IMAGE_MB = 4
export const MAX_VIDEO_MB = 50
export const MAX_VIDEO_SECONDS = 60

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif'
export const VIDEO_ACCEPT = 'video/mp4,video/webm'

const IMAGE_TYPES = new Set(IMAGE_ACCEPT.split(','))
const VIDEO_TYPES = new Set(VIDEO_ACCEPT.split(','))

export interface UploadSignature {
  direct: boolean
  cloudName?: string
  apiKey?: string
  timestamp?: number
  signature?: string
  folder?: string
  uploadUrl?: string
  transformation?: string
}

export type SignatureFetcher = (resourceType: ProductMediaType) => Promise<UploadSignature>

export interface UploadedMedia {
  url: string
  mediaType: ProductMediaType
  publicId: string | null
  thumbnailUrl: string | null
  duration: number | null
}

export function emptyMediaState(): MediaManagerState {
  return { existing: [], pending: [], primaryKey: null }
}

export function mediaStateFromExisting(media: ProductMediaItem[]): MediaManagerState {
  const existing = [...media].sort((a, b) => a.sortOrder - b.sortOrder)
  const primary = existing.find((item) => item.isPrimary) ?? existing[0] ?? null
  return { existing, pending: [], primaryKey: primary ? `existing:${primary.id}` : null }
}

export function mediaCounts(state: MediaManagerState): { images: number; videos: number } {
  const images =
    state.existing.filter((item) => item.mediaType !== 'VIDEO').length +
    state.pending.filter((item) => item.mediaType === 'IMAGE').length
  const videos =
    state.existing.filter((item) => item.mediaType === 'VIDEO').length +
    state.pending.filter((item) => item.mediaType === 'VIDEO').length
  return { images, videos }
}

export function validateMediaFile(file: File, mediaType: ProductMediaType): string | null {
  if (mediaType === 'IMAGE') {
    if (!IMAGE_TYPES.has(file.type)) return `${file.name}: only JPEG, PNG, WEBP, GIF or AVIF images are allowed.`
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return `${file.name}: images must be under ${MAX_IMAGE_MB}MB.`
  } else {
    if (!VIDEO_TYPES.has(file.type)) return `${file.name}: only MP4 or WebM videos are allowed.`
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) return `${file.name}: videos must be under ${MAX_VIDEO_MB}MB.`
  }
  return null
}

export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const seconds = Number.isFinite(video.duration) ? Math.round(video.duration) : null
      URL.revokeObjectURL(url)
      resolve(seconds)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}

export function displayUrl(item: { url: string; mediaType: string; thumbnailUrl: string | null }): string {
  return item.mediaType === 'VIDEO' ? item.thumbnailUrl ?? item.url : item.url
}

function uploadDirect(
  file: File,
  signature: UploadSignature,
  mediaType: ProductMediaType,
  onProgress?: (percent: number) => void,
): Promise<UploadedMedia> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('api_key', signature.apiKey ?? '')
    form.append('timestamp', String(signature.timestamp ?? ''))
    form.append('folder', signature.folder ?? '')
    if (signature.transformation) form.append('transformation', signature.transformation)
    form.append('signature', signature.signature ?? '')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', signature.uploadUrl ?? '')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (${xhr.status}). Please try again.`))
        return
      }
      try {
        const result = JSON.parse(xhr.responseText) as {
          secure_url?: string
          public_id?: string
          duration?: number
        }
        if (!result.secure_url) throw new Error('missing url')
        resolve({
          url: result.secure_url,
          mediaType,
          publicId: result.public_id ?? null,
          thumbnailUrl: mediaType === 'VIDEO' ? result.secure_url.replace(/\.[a-z0-9]+$/i, '.jpg') : null,
          duration:
            mediaType === 'VIDEO' && typeof result.duration === 'number' ? Math.round(result.duration) : null,
        })
      } catch {
        reject(new Error('Upload failed: unexpected response from storage.'))
      }
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'))
    xhr.send(form)
  })
}

export interface ProductMediaPayload {
  existingMedia: string
  mediaJson?: string
  images: File[]
  videos: File[]
  primaryUrl?: string
}

/**
 * Uploads pending media (direct to Cloudinary when configured, otherwise leaves
 * the files for the server-side multipart fallback) and builds the form payload.
 */
export async function buildProductMediaPayload(
  state: MediaManagerState,
  fetchSignature: SignatureFetcher,
  onProgress?: (key: string, percent: number) => void,
): Promise<ProductMediaPayload> {
  const existingMedia = state.existing.map((item) => ({
    id: item.id,
    isPrimary: state.primaryKey === `existing:${item.id}`,
  }))

  const direct: UploadedMedia[] = []
  const images: File[] = []
  const videos: File[] = []
  let directAvailable: boolean | null = null
  let primaryUrl: string | undefined

  for (const pending of state.pending) {
    if (directAvailable === null) {
      try {
        const signature = await fetchSignature(pending.mediaType)
        directAvailable = signature.direct
      } catch {
        directAvailable = false
      }
    }

    const isPrimary = state.primaryKey === `pending:${pending.key}`
    if (directAvailable) {
      const signature = await fetchSignature(pending.mediaType)
      const uploaded = await uploadDirect(pending.file, signature, pending.mediaType, (percent) =>
        onProgress?.(pending.key, percent),
      )
      direct.push(uploaded)
      if (isPrimary) primaryUrl = uploaded.url
    } else if (pending.mediaType === 'VIDEO') {
      videos.push(pending.file)
    } else {
      images.push(pending.file)
    }
  }

  const payload: ProductMediaPayload = {
    existingMedia: JSON.stringify(existingMedia),
    images,
    videos,
  }
  if (direct.length > 0) payload.mediaJson = JSON.stringify(direct)
  if (primaryUrl) payload.primaryUrl = primaryUrl
  return payload
}
