import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ImagePlus, Package, Pause, Play, Plus, Trash2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog, Field, StatusBadge } from '../../components/admin/AdminUI'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchInput from '../../components/ui/SearchInput'
import { useToast } from '../../components/ui/ToastNotification'
import { vendorApi, type VendorProduct } from '../../api/vendor'
import { shopApi, type ShopCategory } from '../../api/shop'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
]

interface VariationDraft {
  name: string
  value: string
  priceDelta: string
}

const EMPTY_FORM = {
  name: '',
  description: '',
  brand: '',
  categoryId: '',
  price: '',
  compareAtPrice: '',
  stock: '',
  lowStockThreshold: '5',
  status: 'PENDING_REVIEW' as 'PENDING_REVIEW' | 'DRAFT',
}

const inputClass =
  'w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none'

export default function VendorProductsPage() {
  const { showToast } = useToast()
  const [products, setProducts] = useState<VendorProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage] = useState(12)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<VendorProduct | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [variations, setVariations] = useState<VariationDraft[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [existingImages, setExistingImages] = useState<VendorProduct['images']>([])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VendorProduct | null>(null)
  const [categories, setCategories] = useState<ShopCategory[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await vendorApi.products({
        page,
        perPage,
        status: status || undefined,
        search: search || undefined,
      })
      setProducts(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, status, search, showToast])

  useEffect(() => {
    void load()
  }, [load])

  // Categories come straight from the database via the public shop API so the
  // dropdown can never offer an ID that the backend does not recognise.
  useEffect(() => {
    shopApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setVariations([])
    setFiles([])
    setExistingImages([])
    setEditorOpen(true)
  }

  const openEdit = (product: VendorProduct) => {
    setEditing(product)
    setForm({
      name: product.name,
      description: product.description ?? '',
      brand: product.brand ?? '',
      categoryId: product.category ? String(product.category.id) : '',
      price: String(product.price),
      compareAtPrice: product.compareAtPrice !== null ? String(product.compareAtPrice) : '',
      stock: String(product.stock),
      lowStockThreshold: String(product.lowStockThreshold),
      status: 'PENDING_REVIEW',
    })
    setVariations(
      product.variations.map((variation) => ({
        name: variation.name,
        value: variation.value,
        priceDelta: String(variation.priceDelta),
      })),
    )
    setFiles([])
    setExistingImages(product.images)
    setEditorOpen(true)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (files.length === 0 && existingImages.length === 0) {
      showToast('Add at least one product image.', 'error')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('name', form.name)
      fd.set('description', form.description)
      fd.set('brand', form.brand)
      if (form.categoryId) fd.set('categoryId', form.categoryId)
      fd.set('price', form.price)
      if (form.compareAtPrice) fd.set('compareAtPrice', form.compareAtPrice)
      fd.set('stock', form.stock)
      fd.set('lowStockThreshold', form.lowStockThreshold)
      fd.set('status', form.status)
      if (variations.length > 0) {
        fd.set(
          'variations',
          JSON.stringify(
            variations
              .filter((item) => item.name && item.value)
              .map((item) => ({
                name: item.name,
                value: item.value,
                priceDelta: Number(item.priceDelta) || 0,
              })),
          ),
        )
      }
      for (const file of files) fd.append('images', file)

      if (editing) {
        await vendorApi.updateProduct(editing.id, fd)
        showToast('Product updated.')
      } else {
        await vendorApi.createProduct(fd)
        showToast('Product created.')
      }
      setEditorOpen(false)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (product: VendorProduct) => {
    try {
      await vendorApi.toggleProduct(product.id, !product.isActive)
      showToast(product.isActive ? 'Listing paused.' : 'Listing reactivated.')
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await vendorApi.deleteProduct(deleteTarget.id)
      showToast('Product removed.')
      setDeleteTarget(null)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-night-50 sm:text-3xl">Products</h1>
          <p className="mt-1.5 text-sm text-night-400">
            {total} product{total === 1 ? '' : 's'} in your store
          </p>
        </div>
        <Button variant="gold" size="md" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products…" className="md:max-w-sm md:flex-1" />
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value)
                setPage(1)
              }}
              className={cn(
                'rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
                status === tab.value
                  ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                  : 'border-night-700 bg-night-900 text-night-400 hover:border-gold-500/40',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16 text-night-400">
          <LoadingSpinner className="h-8 w-8 text-gold-500" />
          <p className="text-sm">Loading products…</p>
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No products found"
          description="Add your first product to start selling on the SAWABA Marketplace."
          action={
            <Button variant="gold" size="md" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-night-800 bg-night-900/40"
              >
                <div className="relative aspect-[4/3] bg-night-950">
                  {product.images[0] ? (
                    <img src={product.images[0].url} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-night-700">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                  <span className="absolute top-3 left-3">
                    <StatusBadge status={product.status} />
                  </span>
                  {!product.isActive && product.status === 'ACTIVE' && (
                    <span className="absolute top-3 right-3 rounded-full border border-night-600 bg-night-950/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-night-300">
                      Paused
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold text-night-100">{product.name}</p>
                    <p className="shrink-0 font-display text-base text-gold-400">{formatPrice(product.price)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-night-500">
                    <span>{product.stock} in stock</span>
                    <span>·</span>
                    <span>{product.salesCount} sold</span>
                    <span>·</span>
                    <span>{product.reviewCount} reviews</span>
                    {product.category && (
                      <>
                        <span>·</span>
                        <span>{product.category.name}</span>
                      </>
                    )}
                  </div>
                  {product.rejectionReason && product.status === 'REJECTED' && (
                    <p className="flex items-start gap-1.5 text-xs text-red-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {product.rejectionReason}
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      className="flex-1 rounded-lg border border-night-700 px-3 py-2 text-xs font-semibold text-night-200 transition-colors hover:border-gold-500/60 hover:text-gold-300"
                    >
                      Edit
                    </button>
                    {product.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => toggle(product)}
                        title={product.isActive ? 'Pause listing' : 'Reactivate listing'}
                        className="rounded-lg border border-night-700 p-2 text-night-400 transition-colors hover:border-gold-500/60 hover:text-gold-300"
                      >
                        {product.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(product)}
                      title="Delete product"
                      className="rounded-lg border border-night-700 p-2 text-night-400 transition-colors hover:border-red-500/60 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-3 text-sm text-night-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Editor modal ─────────────────────────────────────────────── */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} size="lg">
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Product name">
                <input required minLength={3} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Soft Care Hair Dye — Black" className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description" hint="Minimum 10 characters — include size, usage, ingredients.">
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </div>
            <Field label="Brand">
              <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} placeholder="e.g. SoftCare" className={inputClass} />
            </Field>
            <Field
              label="Category"
              hint={
                categories.length > 0
                  ? 'Choose the category buyers will browse under.'
                  : 'No categories yet — the admin can add them under Marketplace → + Category.'
              }
            >
              <select
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                className={inputClass}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Selling price (₦)">
              <input required type="number" min={1} step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="5000" className={inputClass} />
            </Field>
            <Field label="Compare-at price (optional)">
              <input type="number" min={0} step="0.01" value={form.compareAtPrice} onChange={(event) => setForm({ ...form, compareAtPrice: event.target.value })} placeholder="7000" className={inputClass} />
            </Field>
            <Field label="Stock quantity">
              <input required type="number" min={0} value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} placeholder="20" className={inputClass} />
            </Field>
            <Field label="Low-stock alert at">
              <input type="number" min={0} value={form.lowStockThreshold} onChange={(event) => setForm({ ...form, lowStockThreshold: event.target.value })} className={inputClass} />
            </Field>
          </div>

          {/* Variations */}
          <div className="rounded-xl border border-night-800 bg-night-950/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                Variations (colour, size, volume…)
              </p>
              <button
                type="button"
                onClick={() => setVariations((current) => [...current, { name: '', value: '', priceDelta: '0' }])}
                className="text-xs font-semibold text-gold-400 hover:text-gold-300"
              >
                + Add variation
              </button>
            </div>
            {variations.length > 0 && (
              <div className="mt-3 space-y-2">
                {variations.map((variation, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={variation.name}
                      onChange={(event) =>
                        setVariations((current) =>
                          current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                        )
                      }
                      placeholder="Name (e.g. Colour)"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      value={variation.value}
                      onChange={(event) =>
                        setVariations((current) =>
                          current.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)),
                        )
                      }
                      placeholder="Value (e.g. Black)"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      value={variation.priceDelta}
                      onChange={(event) =>
                        setVariations((current) =>
                          current.map((item, i) => (i === index ? { ...item, priceDelta: event.target.value } : item)),
                        )
                      }
                      type="number"
                      step="0.01"
                      placeholder="±₦"
                      className={`${inputClass} w-24`}
                    />
                    <button
                      type="button"
                      onClick={() => setVariations((current) => current.filter((_, i) => i !== index))}
                      aria-label="Remove variation"
                      className="rounded-lg border border-night-700 px-3 text-night-400 hover:border-red-500/60 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Images */}
          <div className="rounded-xl border border-night-800 bg-night-950/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">Images (max 8)</p>
            {existingImages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {existingImages.map((image) => (
                  <div key={image.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-night-700">
                    <img src={image.url} alt={image.alt ?? ''} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-night-600 p-4 transition-colors hover:border-gold-500/50">
              <ImagePlus className="h-5 w-5 text-gold-500" />
              <span className="text-sm text-night-300">
                {files.length > 0 ? `${files.length} new image(s) selected` : 'Choose product photos'}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 8))}
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-night-800 pt-4">
            <Button type="button" variant="outline" size="md" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" size="md" loading={saving}>
              {editing ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete product?"
        description={
          deleteTarget && deleteTarget.images.length > 0
            ? `"${deleteTarget.name}" will be removed from the shop. Products with existing orders are archived instead so order history stays intact.`
            : `"${deleteTarget?.name}" will be permanently removed.`
        }
        confirmLabel="Delete"
      />
    </div>
  )
}
