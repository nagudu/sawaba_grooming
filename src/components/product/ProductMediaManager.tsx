import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2, Video } from 'lucide-react'
import {
  IMAGE_ACCEPT,
  MAX_IMAGES,
  MAX_VIDEO_SECONDS,
  MAX_VIDEOS,
  VIDEO_ACCEPT,
  displayUrl,
  mediaCounts,
  readVideoDuration,
  validateMediaFile,
  type MediaManagerState,
  type PendingMedia,
  type ProductMediaType,
} from '../../lib/mediaUpload'

interface ProductMediaManagerProps {
  value: MediaManagerState
  onChange: (next: MediaManagerState) => void
  disabled?: boolean
}

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

/**
 * Shared image/video editor for vendor and admin product forms. Existing media
 * can be reordered, removed and set as primary; new files are validated and
 * previewed before upload.
 */
export default function ProductMediaManager({ value, onChange, disabled }: ProductMediaManagerProps) {
  const imageInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const counts = mediaCounts(value)

  function setPrimary(key: string) {
    onChange({ ...value, primaryKey: key })
  }

  function removeExisting(id: number) {
    const existing = value.existing.filter((item) => item.id !== id)
    const primaryKey =
      value.primaryKey === `existing:${id}`
        ? existing[0]
          ? `existing:${existing[0].id}`
          : value.pending[0]
            ? `pending:${value.pending[0].key}`
            : null
        : value.primaryKey
    onChange({ ...value, existing, primaryKey })
  }

  function removePending(key: string) {
    const item = value.pending.find((entry) => entry.key === key)
    if (item) URL.revokeObjectURL(item.previewUrl)
    const pending = value.pending.filter((entry) => entry.key !== key)
    const primaryKey =
      value.primaryKey === `pending:${key}`
        ? pending[0]
          ? `pending:${pending[0].key}`
          : value.existing[0]
            ? `existing:${value.existing[0].id}`
            : null
        : value.primaryKey
    onChange({ ...value, pending, primaryKey })
  }

  async function handleAdd(files: FileList | null, mediaType: ProductMediaType) {
    if (!files || files.length === 0) return
    setError(null)
    const added: PendingMedia[] = []
    let imageCount = counts.images
    let videoCount = counts.videos

    for (const file of Array.from(files)) {
      const problem = validateMediaFile(file, mediaType)
      if (problem) {
        setError(problem)
        continue
      }
      if (mediaType === 'IMAGE' && imageCount >= MAX_IMAGES) {
        setError(`A maximum of ${MAX_IMAGES} images is allowed.`)
        break
      }
      if (mediaType === 'VIDEO' && videoCount >= MAX_VIDEOS) {
        setError(`A maximum of ${MAX_VIDEOS} videos is allowed.`)
        break
      }

      let duration: number | null = null
      if (mediaType === 'VIDEO') {
        setBusy(true)
        duration = await readVideoDuration(file)
        setBusy(false)
        if (duration != null && duration > MAX_VIDEO_SECONDS) {
          setError(`${file.name}: videos must be ${MAX_VIDEO_SECONDS} seconds or shorter.`)
          continue
        }
      }

      added.push({
        key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        mediaType,
        previewUrl: URL.createObjectURL(file),
        duration,
      })
      if (mediaType === 'IMAGE') imageCount += 1
      else videoCount += 1
    }

    if (added.length > 0) {
      const primaryKey = value.primaryKey ?? (value.existing[0] ? `existing:${value.existing[0].id}` : `pending:${added[0].key}`)
      onChange({ ...value, pending: [...value.pending, ...added], primaryKey })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">Product media</p>
          <p className="text-xs text-night-400">
            {counts.images}/{MAX_IMAGES} images · {counts.videos}/{MAX_VIDEOS} videos ·{' '}
            {MAX_VIDEO_SECONDS}s max video
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={imageInput}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => {
              void handleAdd(event.target.files, 'IMAGE')
              event.target.value = ''
            }}
          />
          <input
            ref={videoInput}
            type="file"
            accept={VIDEO_ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => {
              void handleAdd(event.target.files, 'VIDEO')
              event.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => imageInput.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-night-100 transition hover:border-gold-500/40 hover:text-white disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Add images
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => videoInput.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-medium text-night-100 transition hover:border-gold-500/40 hover:text-white disabled:opacity-50"
          >
            <Video className="h-4 w-4" aria-hidden="true" /> Add videos
          </button>
        </div>
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}

      {value.existing.length === 0 && value.pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-night-400">
          Add at least one image or video.
        </p>
      ) : (
        <div className="space-y-4">
          {value.existing.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-night-400">Current media</p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {value.existing.map((item, index) => {
                  const key = `existing:${item.id}`
                  const isPrimary = value.primaryKey === key
                  const isVideo = item.mediaType === 'VIDEO'
                  return (
                    <li key={key} className="relative overflow-hidden rounded-xl border border-white/10 bg-night-900">
                      <div className="relative aspect-square w-full bg-night-950">
                        {isVideo ? (
                          <video
                            src={item.url}
                            poster={item.thumbnailUrl ?? undefined}
                            controls
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full bg-black object-cover"
                          />
                        ) : (
                          <img
                            src={displayUrl(item)}
                            alt={item.alt ?? ''}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        )}
                        {isVideo ? (
                          <span className="pointer-events-none absolute left-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Video
                          </span>
                        ) : null}
                        {isPrimary ? (
                          <span className="absolute left-2 top-2 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-semibold text-night-950">
                            Main
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-1 p-2">
                        <div className="flex gap-1">
                          <button type="button" disabled={disabled || index === 0} onClick={() => onChange({ ...value, existing: moveItem(value.existing, index, -1) })} className="rounded p-1 text-night-300 hover:text-white disabled:opacity-30" aria-label="Move earlier">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button type="button" disabled={disabled || index === value.existing.length - 1} onClick={() => onChange({ ...value, existing: moveItem(value.existing, index, 1) })} className="rounded p-1 text-night-300 hover:text-white disabled:opacity-30" aria-label="Move later">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex gap-1">
                          {!isPrimary ? (
                            <button type="button" disabled={disabled} onClick={() => setPrimary(key)} className="rounded p-1 text-night-300 hover:text-gold-400" aria-label="Set as main image">
                              <Star className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button type="button" disabled={disabled} onClick={() => removeExisting(item.id)} className="rounded p-1 text-night-300 hover:text-red-400" aria-label="Remove media">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {value.pending.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-night-400">New uploads</p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {value.pending.map((item, index) => {
                  const key = `pending:${item.key}`
                  const isPrimary = value.primaryKey === key
                  const isVideo = item.mediaType === 'VIDEO'
                  return (
                    <li key={item.key} className="relative overflow-hidden rounded-xl border border-white/10 bg-night-900">
                      <div className="relative aspect-square w-full bg-night-950">
                        {isVideo ? (
                          <video src={item.previewUrl} className="h-full w-full bg-black object-cover" controls muted playsInline preload="metadata" />
                        ) : (
                          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                        )}
                        {isVideo ? (
                          <span className="pointer-events-none absolute left-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Video
                          </span>
                        ) : null}
                        {isPrimary ? (
                          <span className="absolute left-2 top-2 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-semibold text-night-950">
                            Main
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-1 p-2">
                        <div className="flex gap-1">
                          <button type="button" disabled={disabled || index === 0} onClick={() => onChange({ ...value, pending: moveItem(value.pending, index, -1) })} className="rounded p-1 text-night-300 hover:text-white disabled:opacity-30" aria-label="Move earlier">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button type="button" disabled={disabled || index === value.pending.length - 1} onClick={() => onChange({ ...value, pending: moveItem(value.pending, index, 1) })} className="rounded p-1 text-night-300 hover:text-white disabled:opacity-30" aria-label="Move later">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex gap-1">
                          {!isPrimary ? (
                            <button type="button" disabled={disabled} onClick={() => setPrimary(key)} className="rounded p-1 text-night-300 hover:text-gold-400" aria-label="Set as main media">
                              <Star className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button type="button" disabled={disabled} onClick={() => removePending(item.key)} className="rounded p-1 text-night-300 hover:text-red-400" aria-label="Remove media">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
