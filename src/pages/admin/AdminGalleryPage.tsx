import { useEffect, useState } from 'react'
import { ImagePlus, Play, Trash2, Video } from 'lucide-react'
import { api, type GalleryItem, type GalleryMediaType, type Paged } from '../../api'
import { ConfirmDialog, Field, PageHeader } from '../../components/admin/AdminUI'
import { Button } from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useAuthErrorToast } from '../../hooks/useAuthErrorToast'
import { useToast } from '../../components/ui/ToastNotification'
import { cn } from '../../utils/cn'

const CATEGORIES: Array<{ label: string; value: string }> = [
  { label: 'Haircut', value: 'HAIRCUT' },
  { label: 'Fade', value: 'FADE' },
  { label: 'Beard', value: 'BEARD' },
  { label: 'Styling', value: 'STYLING' },
  { label: 'Kids', value: 'KIDS' },
  { label: 'Salon', value: 'SALON' },
]

interface GalleryForm {
  title: string
  category: string
  mediaType: GalleryMediaType
  imageUrl: string
  videoUrl: string
}

const EMPTY_FORM: GalleryForm = {
  title: '',
  category: 'HAIRCUT',
  mediaType: 'IMAGE',
  imageUrl: '',
  videoUrl: '',
}

/** Grabs a single frame from a video file in the browser to use as its poster. */
async function generatePoster(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const videoEl = document.createElement('video')
    const cleanup = () => URL.revokeObjectURL(url)

    videoEl.preload = 'metadata'
    videoEl.muted = true
    videoEl.playsInline = true
    videoEl.src = url

    videoEl.onloadeddata = () => {
      videoEl.currentTime = Math.min(0.2, (videoEl.duration || 1) / 10)
    }
    videoEl.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = videoEl.videoWidth
        canvas.height = videoEl.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx || !canvas.width || !canvas.height) {
          cleanup()
          resolve(null)
          return
        }
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            cleanup()
            resolve(blob ? new File([blob], 'poster.jpg', { type: 'image/jpeg' }) : null)
          },
          'image/jpeg',
          0.85,
        )
      } catch {
        cleanup()
        resolve(null)
      }
    }
    videoEl.onerror = () => {
      cleanup()
      resolve(null)
    }
  })
}

export default function AdminGalleryPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<GalleryItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<GalleryForm>(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<GalleryItem | null>(null)
  const [busy, setBusy] = useState(false)

  const isVideo = form.mediaType === 'VIDEO'

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  useEffect(() => {
    if (!videoFile) {
      setVideoPreview(null)
      return
    }
    const url = URL.createObjectURL(videoFile)
    setVideoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [videoFile])

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      const data = await api.get<Paged<GalleryItem>>('/api/gallery?page=1&perPage=100')
      setItems(data.items)
    } catch (error) {
      notifyError(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setVideoFile(null)
    setFormOpen(true)
  }

  const openEdit = (item: GalleryItem) => {
    setEditing(item)
    setForm({
      title: item.title,
      category: item.category,
      mediaType: item.mediaType ?? 'IMAGE',
      imageUrl: item.image ?? '',
      videoUrl: item.video ?? '',
    })
    setImageFile(null)
    setVideoFile(null)
    setFormOpen(true)
  }

  const onVideoFileChange = async (file: File | null) => {
    setVideoFile(file)
    if (file && !imageFile) {
      const poster = await generatePoster(file)
      if (poster) setImageFile(poster)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const hasImage = Boolean(imageFile) || form.imageUrl.trim().length > 0
      const hasVideo = Boolean(videoFile) || form.videoUrl.trim().length > 0

      if (!editing && isVideo && !hasVideo) {
        showToast('Please choose a video file or provide a video URL.', 'error')
        setSaving(false)
        return
      }
      if (!editing && !isVideo && !hasImage) {
        showToast('Please choose an image file or provide an image URL.', 'error')
        setSaving(false)
        return
      }

      const payload: Record<string, unknown> = {
        title: form.title.trim() || undefined,
        category: form.category,
        mediaType: form.mediaType,
      }

      let useMultipart = false

      if (videoFile) {
        payload.video = videoFile
        useMultipart = true
      } else if (form.videoUrl.trim()) {
        payload.video = form.videoUrl.trim()
      }

      if (imageFile) {
        payload.image = imageFile
        useMultipart = true
      } else if (form.imageUrl.trim()) {
        payload.image = form.imageUrl.trim()
      }

      if (editing) {
        await api.put(`/api/gallery/${editing.id}`, useMultipart ? toFormData(payload) : payload, useMultipart)
        showToast('Gallery item updated.')
      } else {
        await api.post('/api/gallery', useMultipart ? toFormData(payload) : payload, useMultipart)
        showToast(isVideo ? 'Video added to gallery.' : 'Gallery image added.')
      }
      setFormOpen(false)
      await load()
    } catch (error) {
      notifyError(error)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    setBusy(true)
    try {
      if (deleting) {
        await api.del(`/api/gallery/${deleting.id}`)
        showToast('Gallery item deleted.')
      }
      setDeleting(null)
      await load()
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gallery"
        subtitle="Upload images and short videos of your best work."
        action={
          <Button onClick={openCreate}>
            <ImagePlus className="h-4 w-4" />
            Add media
          </Button>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <p className="text-center text-night-400">No gallery media yet. Add your first image or video.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const itemIsVideo = item.mediaType === 'VIDEO' && item.video
            return (
              <div
                key={item.id}
                className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-night-800 bg-night-900"
              >
                {itemIsVideo ? (
                  <video
                    src={item.video ?? undefined}
                    poster={item.image || undefined}
                    muted
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={item.image ?? undefined}
                    alt={item.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}

                {itemIsVideo && (
                  <span className="pointer-events-none absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-night-950/70 backdrop-blur">
                    <Play className="h-4 w-4 translate-x-[0.5px] fill-white text-white" />
                  </span>
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-950/90 via-transparent to-transparent" />

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-night-50">{item.title}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-gold-400">
                      {item.category}
                      {itemIsVideo ? ' · Video' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleting(item)}
                    className="shrink-0 rounded-lg border border-night-700 bg-night-950/70 p-2 text-night-300 transition-colors hover:border-red-500/60 hover:text-red-400"
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="absolute inset-0"
                  aria-label={`Edit ${item.title}`}
                />
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit gallery media' : 'Add gallery media'}
        size="lg"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
          className="space-y-5"
        >
          <Field label="Title" hint="Shown on hover / in the viewer.">
            <input
              className="field"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Fresh skin fade"
            />
          </Field>

          <Field label="Category">
            <select
              className="field"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {CATEGORIES.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
              Media type
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, mediaType: 'IMAGE' })}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors',
                  !isVideo
                    ? 'border-gold-500 bg-gold-500/10 text-gold-300'
                    : 'border-night-700 text-night-300 hover:border-gold-500/50',
                )}
              >
                <ImagePlus className="h-4 w-4" />
                Image
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, mediaType: 'VIDEO' })}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors',
                  isVideo
                    ? 'border-gold-500 bg-gold-500/10 text-gold-300'
                    : 'border-night-700 text-night-300 hover:border-gold-500/50',
                )}
              >
                <Video className="h-4 w-4" />
                Video
              </button>
            </div>
          </div>

          {isVideo && (
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                Video <span className="normal-case text-night-500">(MP4, WEBM, MOV · max 50MB)</span>
              </span>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-night-600 bg-night-900 p-4 transition-colors hover:border-gold-500/50',
                  videoFile && 'border-gold-500/60',
                )}
              >
                <Video className="h-5 w-5 shrink-0 text-gold-400" />
                <span className="truncate text-sm text-night-300">
                  {videoFile ? videoFile.name : form.videoUrl || 'Choose a video file or paste a video URL below'}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v"
                  className="hidden"
                  onChange={(event) => void onVideoFileChange(event.target.files?.[0] ?? null)}
                />
              </label>
              <input
                className="field mt-3"
                value={form.videoUrl}
                onChange={(event) => setForm({ ...form, videoUrl: event.target.value })}
                placeholder="https://.../clip.mp4 (optional when a file is chosen)"
              />
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
              {isVideo ? 'Poster image' : 'Image'}{' '}
              {!isVideo && <span className="normal-case text-night-500">(required)</span>}
              {isVideo && <span className="normal-case text-night-500">(optional — auto-generated)</span>}
            </span>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-night-600 bg-night-900 p-4 transition-colors hover:border-gold-500/50',
                imageFile && 'border-gold-500/60',
              )}
            >
              <ImagePlus className="h-5 w-5 shrink-0 text-gold-400" />
              <span className="truncate text-sm text-night-300">
                {imageFile
                  ? imageFile.name
                  : form.imageUrl || (isVideo ? 'Choose a poster image (or auto from the video)' : 'Choose a file or paste an image URL below')}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <input
              className="field mt-3"
              value={form.imageUrl}
              onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              placeholder="https://.../image.jpg (optional when a file is chosen)"
            />
          </div>

          {(videoPreview || imagePreview || (!isVideo && form.imageUrl) || (isVideo && form.videoUrl)) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {isVideo && (
                <div>
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                    Preview
                  </span>
                  <div className="aspect-[4/5] overflow-hidden rounded-lg border border-night-700 bg-black">
                    <video
                      src={videoPreview ?? form.videoUrl}
                      poster={(imagePreview ?? form.imageUrl) || undefined}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              )}
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                  {isVideo ? 'Poster tile' : 'Preview — exactly how it appears on the public gallery'}
                </span>
                <div className="aspect-[4/5] overflow-hidden rounded-lg border border-night-700 bg-night-950/60">
                  {(imagePreview ?? form.imageUrl) ? (
                    <img
                      src={imagePreview ?? form.imageUrl}
                      alt="Preview"
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-night-600">
                      <ImagePlus className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : isVideo ? 'Add video' : 'Add image'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title="Delete gallery item"
        description="Remove this media from the gallery? This cannot be undone."
      />
    </div>
  )
}

/** Local multipart helper — File values pass through, everything else is stringified. */
function toFormData(data: Record<string, unknown>): FormData {
  const form = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    if (value instanceof Blob) {
      form.append(key, value)
    } else {
      form.append(key, String(value))
    }
  }
  return form
}
