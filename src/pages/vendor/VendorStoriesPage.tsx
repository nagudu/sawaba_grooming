import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, ImagePlus, Play, Plus, Share2, Sparkles, Trash2, Video, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { ConfirmDialog, Field, StatusBadge } from '../../components/admin/AdminUI'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import { storiesApi, type StoryItem, type StoryType } from '../../api/stories'
import { vendorApi, type VendorProduct } from '../../api/vendor'
import { formatPrice } from '../../utils/format'
import { shareStory } from '../../lib/storyShare'
import { IMAGE_ACCEPT, VIDEO_ACCEPT, validateMediaFile, type ProductMediaType } from '../../lib/mediaUpload'

const inputClass =
  'w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-2.5 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none'

const EMPTY_FORM = {
  type: 'PRODUCT' as StoryType,
  title: '',
  caption: '',
  productId: '',
  price: '',
  compareAtPrice: '',
  expiresInHours: '24',
}

export default function VendorStoriesPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<StoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [products, setProducts] = useState<VendorProduct[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)

  const [deleteTarget, setDeleteTarget] = useState<StoryItem | null>(null)
  const perPage = 12

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await storiesApi.vendorList({ status: status || undefined, page, perPage })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [status, page, showToast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void vendorApi.products({ perPage: 100 }).then((res) => setProducts(res.items)).catch(() => undefined)
  }, [])

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
      if (videoPreview) URL.revokeObjectURL(videoPreview)
    }
  }, [imagePreview, videoPreview])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  function openCreate() {
    setForm(EMPTY_FORM)
    setImageFile(null)
    setVideoFile(null)
    setImagePreview(null)
    setVideoPreview(null)
    setEditorOpen(true)
  }

  function pickMedia(file: File | undefined, type: ProductMediaType) {
    if (!file) return
    const problem = validateMediaFile(file, type)
    if (problem) {
      showToast(problem, 'error')
      return
    }
    if (type === 'IMAGE') {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    } else {
      if (videoPreview) URL.revokeObjectURL(videoPreview)
      setVideoFile(file)
      setVideoPreview(URL.createObjectURL(file))
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.productId) {
      showToast('Select one of your products.', 'error')
      return
    }
    if (!imageFile && !videoFile) {
      showToast('Add an image or a video for the story.', 'error')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('type', form.type)
      fd.set('title', form.title)
      if (form.caption) fd.set('caption', form.caption)
      fd.set('productId', form.productId)
      if (form.price) fd.set('price', form.price)
      if (form.compareAtPrice) fd.set('compareAtPrice', form.compareAtPrice)
      fd.set('expiresInHours', form.expiresInHours || '24')
      if (imageFile) fd.append('image', imageFile)
      if (videoFile) fd.append('video', videoFile)
      await storiesApi.vendorCreate(fd)
      showToast('Story submitted — it goes live once Sawaba approves it.')
      setEditorOpen(false)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await storiesApi.vendorDelete(deleteTarget.id)
      showToast('Story deleted.')
      setDeleteTarget(null)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function share(item: StoryItem) {
    try {
      await shareStory(item)
      showToast('Share sheet opened. Choose WhatsApp to post it to your status.')
    } catch {
      showToast('Could not open sharing on this device.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400">
            <Sparkles className="h-3.5 w-3.5" /> Sawaba Stories
          </p>
          <h1 className="mt-1 font-display text-2xl text-night-50">Your product stories</h1>
          <p className="mt-1 text-sm text-night-400">Share products, prices and demos. Every story is 24 hours and reviewed by Sawaba.</p>
        </div>
        <Button variant="gold" size="md" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> New story</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { value: '', label: 'All' },
          { value: 'PENDING', label: 'Pending' },
          { value: 'APPROVED', label: 'Live' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'EXPIRED', label: 'Expired' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => { setStatus(tab.value); setPage(1) }}
            className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
              status === tab.value
                ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                : 'border-night-700 text-night-300 hover:border-gold-500/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading your stories" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ImagePlus className="h-10 w-10" />}
          title="No stories yet"
          description="Create a product story to reach customers on the homepage."
          action={<Button variant="gold" size="md" onClick={openCreate}>Create a story</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
              <div className="relative aspect-[4/5] bg-night-950">
                {item.mediaType === 'VIDEO' && item.video ? (
                  <video src={item.video} poster={item.thumbnailUrl ?? undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : item.image ? (
                  <img src={item.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-night-600"><ImagePlus className="h-10 w-10" /></div>
                )}
                {item.mediaType === 'VIDEO' && (
                  <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55"><Play className="h-5 w-5 text-white" /></span></span>
                )}
                <span className="absolute left-3 top-3"><StatusBadge status={item.status} /></span>
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                  <Eye className="h-3 w-3" /> {item.viewCount} views
                </span>
              </div>
              <div className="space-y-2 p-4">
                <p className="line-clamp-2 text-sm font-semibold text-night-100">{item.title}</p>
                {item.caption && <p className="line-clamp-2 text-xs text-night-400">{item.caption}</p>}
                {item.price != null && (
                  <p className="text-xs text-night-300">
                    {formatPrice(item.price)}
                    {item.compareAtPrice != null && item.compareAtPrice > item.price && (
                      <span className="ml-2 text-night-500 line-through">{formatPrice(item.compareAtPrice)}</span>
                    )}
                  </p>
                )}
                <p className="text-[11px] text-night-500">Expires {new Date(item.expiresAt).toLocaleString('en-GB')}</p>
                {item.status === 'REJECTED' && item.rejectedReason && (
                  <p className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-300">{item.rejectedReason}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button type="button" onClick={() => void share(item)} className="rounded-lg border border-night-700 px-3 py-1.5 text-[11px] font-semibold text-night-200 hover:border-gold-500/40 hover:text-gold-300">
                    <Share2 className="mr-1 inline h-3.5 w-3.5" /> Share to WhatsApp
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(item)} className="ml-auto rounded-lg border border-rose-500/30 px-3 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/10" aria-label="Delete story">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-night-400">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-night-700 px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-night-700 px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title="New product story" size="lg">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Product">
            <select value={form.productId} onChange={(event) => setForm((f) => ({ ...f, productId: event.target.value }))} className={inputClass}>
              <option value="">Select one of your products…</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </Field>
          <Field label="Story type">
            <select value={form.type} onChange={(event) => setForm((f) => ({ ...f, type: event.target.value as StoryType }))} className={inputClass}>
              <option value="PRODUCT">Product — Shop Now</option>
              <option value="PROMOTION">Promotion — Explore Offer</option>
            </select>
          </Field>
          <Field label="Title">
            <input required minLength={3} maxLength={160} value={form.title} onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))} className={inputClass} placeholder="e.g. New arrivals this week" />
          </Field>
          <Field label="Caption" hint="A short, friendly line about the product.">
            <textarea rows={3} maxLength={1000} value={form.caption} onChange={(event) => setForm((f) => ({ ...f, caption: event.target.value }))} className={inputClass} placeholder="Tap Shop Now to order before it sells out." />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Price (optional)">
              <input inputMode="numeric" value={form.price} onChange={(event) => setForm((f) => ({ ...f, price: event.target.value }))} className={inputClass} placeholder="Product price" />
            </Field>
            <Field label="Compare-at (optional)">
              <input inputMode="numeric" value={form.compareAtPrice} onChange={(event) => setForm((f) => ({ ...f, compareAtPrice: event.target.value }))} className={inputClass} placeholder="Original price" />
            </Field>
            <Field label="Expires in (hours)">
              <input type="number" min={1} max={168} value={form.expiresInHours} onChange={(event) => setForm((f) => ({ ...f, expiresInHours: event.target.value }))} className={inputClass} />
            </Field>
          </div>

          <div className="space-y-3 rounded-xl border border-night-800 bg-night-950/40 p-4">
            <p className="text-sm font-medium text-night-100">Media</p>
            <p className="text-xs text-night-500">Add an image or a short video showing the product.</p>
            <div className="flex flex-wrap gap-2">
              <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(event) => { pickMedia(event.target.files?.[0], 'IMAGE'); event.target.value = '' }} />
              <input ref={videoInput} type="file" accept={VIDEO_ACCEPT} className="hidden" onChange={(event) => { pickMedia(event.target.files?.[0], 'VIDEO'); event.target.value = '' }} />
              <Button type="button" variant="outline" size="sm" onClick={() => imageInput.current?.click()}><ImagePlus className="mr-1 h-4 w-4" /> {imageFile ? 'Change image' : 'Add image'}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => videoInput.current?.click()}><Video className="mr-1 h-4 w-4" /> {videoFile ? 'Change video' : 'Add video'}</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {imagePreview && (
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-night-700">
                  <img src={imagePreview} alt="Story preview" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => { URL.revokeObjectURL(imagePreview); setImagePreview(null); setImageFile(null) }} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white" aria-label="Remove image"><X className="h-3 w-3" /></button>
                </div>
              )}
              {videoPreview && (
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-night-700">
                  <video src={videoPreview} className="h-full w-full object-cover" muted playsInline />
                  <button type="button" onClick={() => { URL.revokeObjectURL(videoPreview); setVideoPreview(null); setVideoFile(null) }} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white" aria-label="Remove video"><X className="h-3 w-3" /></button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-night-800 pt-4">
            <Button type="button" variant="outline" size="md" onClick={() => setEditorOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="gold" size="md" loading={busy}>Submit for review</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete story?"
        description={`"${deleteTarget?.title ?? 'This story'}" and its media will be permanently removed.`}
        confirmLabel="Delete"
        busy={busy}
      />
    </div>
  )
}
