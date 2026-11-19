import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, ImagePlus, Play, Plus, Search, Share2, Trash2, Video, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { ConfirmDialog, Field, PageHeader, StatusBadge } from '../../components/admin/AdminUI'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/ToastNotification'
import { storiesApi, type StoryItem, type StoryType } from '../../api/stories'
import { marketplaceAdminApi } from '../../api/marketplaceAdmin'
import {
  fetchCatalogBarbers,
  fetchCatalogServices,
  type CatalogBarber,
  type CatalogService,
} from '../../api/catalog'
import { formatPrice } from '../../utils/format'
import { shareStory } from '../../lib/storyShare'
import {
  IMAGE_ACCEPT,
  VIDEO_ACCEPT,
  validateMediaFile,
  type ProductMediaType,
} from '../../lib/mediaUpload'

const inputClass =
  'w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-2.5 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'EXPIRED', label: 'Expired' },
]

const EMPTY_FORM = {
  type: 'PRODUCT' as StoryType,
  title: '',
  caption: '',
  ctaLabel: '',
  productId: '',
  serviceId: '',
  barberId: '',
  offerUrl: '',
  price: '',
  compareAtPrice: '',
  expiresInHours: '24',
  status: 'APPROVED' as 'APPROVED' | 'DRAFT',
}

function typeLabel(type: StoryType): string {
  if (type === 'PRODUCT') return 'Product'
  if (type === 'BARBER') return 'Barber'
  if (type === 'SERVICE') return 'Service'
  return 'Promotion'
}

export default function AdminStoriesPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState<StoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)

  const [products, setProducts] = useState<Array<{ id: number; name: string }>>([])
  const [services, setServices] = useState<CatalogService[]>([])
  const [barbers, setBarbers] = useState<CatalogBarber[]>([])

  const [rejectTarget, setRejectTarget] = useState<StoryItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<StoryItem | null>(null)

  const perPage = 12

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await storiesApi.adminList({
        status: status || undefined,
        type: typeFilter || undefined,
        search: search || undefined,
        page,
        perPage,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [status, typeFilter, search, page, showToast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void marketplaceAdminApi.products({ perPage: 100 }).then((res) => setProducts(res.items.map((p) => ({ id: p.id, name: p.name })))).catch(() => undefined)
    void fetchCatalogServices().then(setServices).catch(() => undefined)
    void fetchCatalogBarbers().then(setBarbers).catch(() => undefined)
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
    if (!imageFile && !videoFile) {
      showToast('Add an image or a video for the story.', 'error')
      return
    }
    if (form.type === 'PRODUCT' && !form.productId) {
      showToast('Select a product for this story.', 'error')
      return
    }
    if (form.type === 'SERVICE' && !form.serviceId) {
      showToast('Select a service for this story.', 'error')
      return
    }
    if (form.type === 'BARBER' && !form.barberId) {
      showToast('Select a barber for this story.', 'error')
      return
    }
    if (form.type === 'PROMOTION' && !form.offerUrl && !form.productId) {
      showToast('Add an offer link or link a product.', 'error')
      return
    }

    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('type', form.type)
      fd.set('title', form.title)
      if (form.caption) fd.set('caption', form.caption)
      if (form.ctaLabel) fd.set('ctaLabel', form.ctaLabel)
      if (form.productId) fd.set('productId', form.productId)
      if (form.serviceId) fd.set('serviceId', form.serviceId)
      if (form.barberId) fd.set('barberId', form.barberId)
      if (form.offerUrl) fd.set('offerUrl', form.offerUrl)
      if (form.price) fd.set('price', form.price)
      if (form.compareAtPrice) fd.set('compareAtPrice', form.compareAtPrice)
      fd.set('expiresInHours', form.expiresInHours || '24')
      fd.set('status', form.status)
      if (imageFile) fd.append('image', imageFile)
      if (videoFile) fd.append('video', videoFile)
      await storiesApi.adminCreate(fd)
      showToast(form.status === 'DRAFT' ? 'Story saved as a draft.' : 'Story published.')
      setEditorOpen(false)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function approve(item: StoryItem) {
    setBusy(true)
    try {
      await storiesApi.adminModerate(item.id, 'APPROVE')
      showToast('Story approved and live.')
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function submitReject(event: React.FormEvent) {
    event.preventDefault()
    if (!rejectTarget) return
    setBusy(true)
    try {
      await storiesApi.adminModerate(rejectTarget.id, 'REJECT', rejectReason || undefined)
      showToast('Story rejected.')
      setRejectTarget(null)
      setRejectReason('')
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
      await storiesApi.adminDelete(deleteTarget.id)
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

  async function promote(item: StoryItem) {
    setBusy(true)
    try {
      const result = await storiesApi.adminPromote(item.id)
      showToast(
        result.targeted === 0
          ? 'No customers have opted in to WhatsApp updates yet.'
          : `Promotion sent to ${result.sent} of ${result.targeted} opted-in customer(s).`,
      )
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sawaba Stories"
        subtitle="Publish 24-hour stories, moderate vendor submissions and track views."
        action={<Button variant="gold" size="md" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> New story</Button>}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-night-500" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="Search stories…"
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
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
          <select
            value={typeFilter}
            onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}
            className="rounded-full border border-night-700 bg-night-900 px-3 py-1.5 text-[11px] font-semibold text-night-200"
          >
            <option value="">All types</option>
            <option value="PRODUCT">Product</option>
            <option value="SERVICE">Service</option>
            <option value="BARBER">Barber</option>
            <option value="PROMOTION">Promotion</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading stories" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ImagePlus className="h-10 w-10" />}
          title="No stories yet"
          description="Publish your first story to show it on the homepage."
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
                  <Eye className="h-3 w-3" /> {item.viewCount}
                </span>
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-400">{typeLabel(item.type)}</span>
                  <span className="truncate text-[11px] text-night-400">{item.ownerName}</span>
                </div>
                <p className="line-clamp-2 text-sm font-semibold text-night-100">{item.title}</p>
                {item.price != null && (
                  <p className="text-xs text-night-300">
                    {formatPrice(item.price)}
                    {item.compareAtPrice != null && item.compareAtPrice > item.price && (
                      <span className="ml-2 text-night-500 line-through">{formatPrice(item.compareAtPrice)}</span>
                    )}
                  </p>
                )}
                <p className="text-[11px] text-night-500">
                  Expires {new Date(item.expiresAt).toLocaleString('en-GB')}
                </p>
                {item.rejectedReason && <p className="text-[11px] text-rose-300">{item.rejectedReason}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.status === 'PENDING' || item.status === 'REJECTED' ? (
                    <Button variant="gold" size="sm" loading={busy} onClick={() => void approve(item)}>Approve</Button>
                  ) : null}
                  {item.status !== 'REJECTED' && item.status !== 'EXPIRED' ? (
                    <Button variant="outline" size="sm" onClick={() => { setRejectTarget(item); setRejectReason('') }}>Reject</Button>
                  ) : null}
                  <button type="button" onClick={() => void share(item)} className="rounded-lg border border-night-700 px-3 py-1.5 text-[11px] font-semibold text-night-200 hover:border-gold-500/40 hover:text-gold-300" aria-label="Share to WhatsApp">
                    <Share2 className="mr-1 inline h-3.5 w-3.5" /> Share
                  </button>
                  {item.status === 'APPROVED' ? (
                    <button type="button" disabled={busy} onClick={() => void promote(item)} className="rounded-lg border border-gold-500/40 px-3 py-1.5 text-[11px] font-semibold text-gold-300 hover:bg-gold-500/10 disabled:opacity-50" aria-label="Promote to opted-in customers">
                      Promote
                    </button>
                  ) : null}
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

      {/* Create story */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title="New story" size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Story type">
              <select value={form.type} onChange={(event) => setForm((f) => ({ ...f, type: event.target.value as StoryType }))} className={inputClass}>
                <option value="PRODUCT">Product — Shop Now</option>
                <option value="SERVICE">Service — View Service</option>
                <option value="BARBER">Barber — Book Now</option>
                <option value="PROMOTION">Promotion — Explore Offer</option>
              </select>
            </Field>
            <Field label="Publish">
              <select value={form.status} onChange={(event) => setForm((f) => ({ ...f, status: event.target.value as 'APPROVED' | 'DRAFT' }))} className={inputClass}>
                <option value="APPROVED">Publish now</option>
                <option value="DRAFT">Save as draft</option>
              </select>
            </Field>
          </div>

          <Field label="Title">
            <input required minLength={3} maxLength={160} value={form.title} onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))} className={inputClass} placeholder="e.g. Fresh fade, now available" />
          </Field>
          <Field label="Caption" hint="Shown over the story. Keep it short and inviting.">
            <textarea rows={3} maxLength={1000} value={form.caption} onChange={(event) => setForm((f) => ({ ...f, caption: event.target.value }))} className={inputClass} placeholder="Book this look today…" />
          </Field>

          {form.type === 'PRODUCT' && (
            <Field label="Product">
              <select value={form.productId} onChange={(event) => setForm((f) => ({ ...f, productId: event.target.value }))} className={inputClass}>
                <option value="">Select a product…</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>
          )}
          {form.type === 'SERVICE' && (
            <Field label="Service">
              <select value={form.serviceId} onChange={(event) => setForm((f) => ({ ...f, serviceId: event.target.value }))} className={inputClass}>
                <option value="">Select a service…</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </Field>
          )}
          {form.type === 'BARBER' && (
            <Field label="Barber">
              <select value={form.barberId} onChange={(event) => setForm((f) => ({ ...f, barberId: event.target.value }))} className={inputClass}>
                <option value="">Select a barber…</option>
                {barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
              </select>
            </Field>
          )}
          {form.type === 'PROMOTION' && (
            <Field label="Offer link" hint="Internal page (e.g. /shop) or an official sawabagroomingstudio.com.ng page.">
              <input value={form.offerUrl} onChange={(event) => setForm((f) => ({ ...f, offerUrl: event.target.value }))} className={inputClass} placeholder="/shop or https://sawabagroomingstudio.com.ng/" />
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Price (optional)">
              <input inputMode="numeric" value={form.price} onChange={(event) => setForm((f) => ({ ...f, price: event.target.value }))} className={inputClass} placeholder="e.g. 15000" />
            </Field>
            <Field label="Compare-at (optional)">
              <input inputMode="numeric" value={form.compareAtPrice} onChange={(event) => setForm((f) => ({ ...f, compareAtPrice: event.target.value }))} className={inputClass} placeholder="e.g. 20000" />
            </Field>
            <Field label="Expires in (hours)">
              <input type="number" min={1} max={168} value={form.expiresInHours} onChange={(event) => setForm((f) => ({ ...f, expiresInHours: event.target.value }))} className={inputClass} />
            </Field>
          </div>

          <div className="space-y-3 rounded-xl border border-night-800 bg-night-950/40 p-4">
            <p className="text-sm font-medium text-night-100">Media</p>
            <p className="text-xs text-night-500">Upload an image or a short video. If you add both, the image becomes the video poster.</p>
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
            <Button type="submit" variant="gold" size="md" loading={busy}>Publish story</Button>
          </div>
        </form>
      </Modal>

      {/* Reject */}
      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject story" size="sm">
        <form onSubmit={submitReject} className="space-y-4">
          <p className="text-sm text-night-300">Rejecting <strong>{rejectTarget?.title}</strong> hides it from customers and notifies the vendor.</p>
          <Field label="Reason">
            <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className={inputClass} placeholder="e.g. Image does not meet guidelines" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="md" onClick={() => setRejectTarget(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="gold" size="md" loading={busy}>Reject story</Button>
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
