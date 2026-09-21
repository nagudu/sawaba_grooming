import { useEffect, useState } from 'react'
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, toForm, type GalleryItem, type Paged } from '../../api'
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
  imageUrl: string
}

const EMPTY_FORM: GalleryForm = { title: '', category: 'HAIRCUT', imageUrl: '' }

export default function AdminGalleryPage() {
  const { showToast } = useToast()
  const { notifyError } = useAuthErrorToast()

  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<GalleryItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<GalleryForm>(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<GalleryItem | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
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

  // Local preview of the chosen file — shows exactly how the full image will
  // appear on the public gallery (object-contain, nothing cropped).
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setFormOpen(true)
  }

  const openEdit = (item: GalleryItem) => {
    setEditing(item)
    setForm({ title: item.title, category: item.category, imageUrl: item.image })
    setImageFile(null)
    setFormOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (!imageFile && !form.imageUrl.trim()) {
        showToast('Please choose an image file or provide an image URL.', 'error')
        setSaving(false)
        return
      }

      const payload: Record<string, unknown> = {
        title: form.title.trim() || undefined,
        category: form.category,
      }

      const useMultipart = imageFile !== null
      if (imageFile) {
        payload.image = imageFile
      } else if (form.imageUrl.trim()) {
        payload.image = form.imageUrl.trim()
      }

      if (editing) {
        await api.put(`/api/gallery/${editing.id}`, useMultipart ? toForm(payload) : payload, useMultipart)
        showToast('Gallery item updated.')
      } else {
        await api.post('/api/gallery', useMultipart ? toForm(payload) : payload, useMultipart)
        showToast('Gallery item added.')
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
    if (!deleting) return
    setBusy(true)
    try {
      await api.del(`/api/gallery/${deleting.id}`)
      setItems((current) => current.filter((item) => item.id !== deleting.id))
      showToast('Gallery item deleted.')
      setDeleting(null)
    } catch (error) {
      notifyError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Gallery"
        subtitle="Show off your best work."
        action={
          <Button variant="gold" size="md" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Image
          </Button>
        }
      />

      {loading ? (
        <LoadingSpinner label="Loading gallery" />
      ) : items.length === 0 ? (
        <div className="card-lux p-16 text-center text-sm text-night-500">
          No gallery images yet. Add your first one.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="card-lux group relative overflow-hidden transition-colors hover:border-gold-500/40"
            >
              {/* Same full-image rendering as the public Gallery card:
                  object-contain in a fixed frame — nothing is cropped. */}
              <div className="h-48 w-full bg-night-950/60">
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="p-4">
                <p className="truncate font-display text-sm text-night-100">{item.title}</p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-500">
                  {item.category}
                </p>
              </div>
              <div
                className={cn(
                  'absolute inset-x-0 bottom-full flex justify-end gap-2 p-3 bg-gradient-to-t from-night-950/90 to-transparent',
                  'transition-all duration-300 group-hover:bottom-0',
                )}
              >
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  aria-label="Edit image"
                  className="rounded-lg border border-night-700 bg-night-900/80 p-2 text-night-300 transition-colors hover:border-gold-500/50 hover:text-gold-300"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(item)}
                  aria-label="Delete image"
                  className="rounded-lg border border-night-700 bg-night-900/80 p-2 text-night-300 transition-colors hover:border-red-500/50 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Gallery Image' : 'Add Gallery Image'}
        size="md"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
          className="space-y-5"
        >
          <Field label="Title" hint="Shown on hover / in the lightbox.">
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="field"
              placeholder="Fresh skin fade"
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              className="field"
            >
              {CATEGORIES.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
              Image <span className="normal-case text-night-500">(required)</span>
            </span>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-night-600 bg-night-900 p-4 transition-colors hover:border-gold-500/50',
                imageFile && 'border-gold-500/60',
              )}
            >
              <ImagePlus className="h-5 w-5 shrink-0 text-gold-400" />
              <span className="truncate text-sm text-night-300">
                {imageFile ? imageFile.name : form.imageUrl || 'Choose a file or paste an image URL below'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <input
              value={form.imageUrl}
              onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              className="field mt-3"
              placeholder="https://.../image.jpg (optional when a file is chosen)"
            />
            {previewUrl && (
              <div className="mt-3">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                  Preview — exactly how it appears on the public gallery
                </span>
                <div className="h-48 w-full overflow-hidden rounded-lg border border-night-700 bg-night-950/60">
                  <img
                    src={previewUrl}
                    alt="Upload preview"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="md" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="gold" size="md" type="submit" loading={saving}>
              {editing ? 'Save Changes' : 'Add Image'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
        title="Delete image"
        description="Remove this image from the gallery? This cannot be undone."
      />
    </div>
  )
}