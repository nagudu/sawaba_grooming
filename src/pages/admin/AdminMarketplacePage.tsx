import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Download,
  FileText,
  LayoutDashboard,
  Package,
  Pencil,
  Plus,
  Settings2,
  ShoppingBag,
  Star,
  Store,
  Wallet,
  XCircle,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog, EmptyRow, Field, PageHeader, StatCard, StatusBadge, Td, Th } from '../../components/admin/AdminUI'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchInput from '../../components/ui/SearchInput'
import { useToast } from '../../components/ui/ToastNotification'
import { cn } from '../../utils/cn'
import { formatPrice } from '../../utils/format'
import {
  marketplaceAdminApi,
  type AdminCategory,
  type AdminOrder,
  type AdminOrderDetail,
  type AdminProduct,
  type AdminVendor,
  type MarketplaceOverview,
  type MarketplaceSettings,
  type PayoutRow,
  type ReviewRow,
} from '../../api/marketplaceAdmin'

type Tab = 'overview' | 'vendors' | 'products' | 'orders' | 'finance' | 'reviews' | 'settings'

const TABS: Array<{ value: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'vendors', label: 'Vendors', icon: Store },
  { value: 'products', label: 'Products', icon: Package },
  { value: 'orders', label: 'Orders', icon: ShoppingBag },
  { value: 'finance', label: 'Finance', icon: Wallet },
  { value: 'reviews', label: 'Reviews', icon: Star },
  { value: 'settings', label: 'Settings', icon: Settings2 },
]

const inputClass =
  'w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none'

// ─── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [data, setData] = useState<MarketplaceOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    marketplaceAdminApi
      .overview()
      .then(setData)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Loading marketplace overview…</p>
      </div>
    )
  }
  if (error || !data) {
    return <EmptyState icon={<AlertTriangle className="h-10 w-10" />} title="Could not load overview" description={error ?? ''} />
  }

  return (
    <div className="space-y-8">
      {/* Finance */}
      <div>
        <h2 className="mb-4 font-display text-xl text-night-50">Financial Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Gross Sales" value={formatPrice(data.finance.grossSales)} icon={<Banknote className="h-5 w-5" />} accent />
          <StatCard label="Successful Payments" value={formatPrice(data.finance.successfulPayments)} icon={<CheckCircle2 className="h-5 w-5" />} />
          <StatCard label="Pending Payments" value={formatPrice(data.finance.pendingPayments)} icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard label="Marketplace Commission" value={formatPrice(data.finance.marketplaceCommission)} icon={<Wallet className="h-5 w-5" />} />
          <StatCard label="Vendor Liability" value={formatPrice(data.finance.vendorLiability)} icon={<Store className="h-5 w-5" />} />
          <StatCard label="Completed Payouts" value={formatPrice(data.finance.completedPayouts)} icon={<Banknote className="h-5 w-5" />} />
          <StatCard label="Refunds" value={formatPrice(data.finance.refunds)} icon={<XCircle className="h-5 w-5" />} />
          <StatCard label="Net Marketplace Revenue" value={formatPrice(data.finance.netMarketplaceRevenue)} icon={<CheckCircle2 className="h-5 w-5" />} accent />
        </div>
        <p className="mt-3 text-xs text-night-500">
          Only verified (PAID) payments count as revenue — pending, failed and unverified payments are excluded.
        </p>
      </div>

      {/* Vendors + products + orders */}
      <div className="grid gap-4 lg:grid-cols-3">
        <button type="button" onClick={() => onNavigate('vendors')} className="card-lux p-5 text-left transition-colors hover:border-gold-500/50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Vendors</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <p className="text-night-200">Total: <span className="font-bold text-night-50">{data.vendors.total}</span></p>
            <p className="text-amber-300">Pending: <span className="font-bold">{data.vendors.pending}</span></p>
            <p className="text-emerald-300">Approved: <span className="font-bold">{data.vendors.approved}</span></p>
            <p className="text-red-300">Suspended: <span className="font-bold">{data.vendors.suspended}</span></p>
          </div>
        </button>
        <button type="button" onClick={() => onNavigate('products')} className="card-lux p-5 text-left transition-colors hover:border-gold-500/50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Products</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <p className="text-night-200">Total: <span className="font-bold text-night-50">{data.products.total}</span></p>
            <p className="text-emerald-300">Active: <span className="font-bold">{data.products.active}</span></p>
            <p className="text-amber-300">Pending review: <span className="font-bold">{data.products.pendingReview}</span></p>
            <p className="text-red-300">Out of stock: <span className="font-bold">{data.products.outOfStock}</span></p>
          </div>
        </button>
        <button type="button" onClick={() => onNavigate('orders')} className="card-lux p-5 text-left transition-colors hover:border-gold-500/50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">Orders</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <p className="text-night-200">Total: <span className="font-bold text-night-50">{data.orders.total}</span></p>
            <p className="text-amber-300">Awaiting payment: <span className="font-bold">{data.orders.awaitingPayment}</span></p>
            <p className="text-sky-300">Processing: <span className="font-bold">{data.orders.processing}</span></p>
            <p className="text-emerald-300">Delivered: <span className="font-bold">{data.orders.delivered}</span></p>
          </div>
        </button>
      </div>

      {/* Pending applications */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-night-50">Vendor Applications</h2>
          <button type="button" onClick={() => onNavigate('vendors')} className="text-sm font-semibold text-gold-400 hover:text-gold-300">
            Manage vendors
          </button>
        </div>
        {data.pendingVendorApplications.length === 0 ? (
          <EmptyState icon={<Store className="h-10 w-10" />} title="No pending applications" description="New vendor applications will appear here for review." />
        ) : (
          <ul className="space-y-3">
            {data.pendingVendorApplications.map((application) => (
              <li key={application.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div>
                  <p className="text-sm font-semibold text-night-100">{application.businessName}</p>
                  <p className="text-xs text-night-400">
                    {application.contactName} · applied {new Date(application.createdAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
                <button type="button" onClick={() => onNavigate('vendors')} className="rounded-lg border border-gold-500/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gold-300 hover:bg-gold-500/10">
                  Review
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent orders */}
      <div>
        <h2 className="mb-4 font-display text-xl text-night-50">Recent Orders</h2>
        <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Reference</Th>
                  <Th>Customer</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Payment</Th>
                  <Th className="text-right">Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {data.recentOrders.length === 0 ? (
                  <EmptyRow message="No orders yet." colSpan={5} />
                ) : (
                  data.recentOrders.map((order) => (
                    <tr key={order.referenceCode} className="text-sm">
                      <Td className="font-semibold text-night-100">{order.referenceCode}</Td>
                      <Td>{order.customerName}</Td>
                      <Td className="text-right text-night-100">{formatPrice(order.totalAmount)}</Td>
                      <Td className="text-right"><StatusBadge status={order.paymentStatus} /></Td>
                      <Td className="text-right"><StatusBadge status={order.status} /></Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Vendors tab ─────────────────────────────────────────────────────────────

function VendorsTab() {
  const { showToast } = useToast()
  const [vendors, setVendors] = useState<AdminVendor[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const [active, setActive] = useState<AdminVendor | null>(null)
  const [actionStatus, setActionStatus] = useState('')
  const [reason, setReason] = useState('')
  const [commissionRate, setCommissionRate] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await marketplaceAdminApi.vendors({ status: status || undefined, search: search || undefined, page, perPage: 15 })
      setVendors(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [status, search, page, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const openAction = (vendor: AdminVendor) => {
    setActive(vendor)
    setActionStatus(vendor.status === 'PENDING' ? 'APPROVED' : vendor.status === 'APPROVED' ? 'SUSPENDED' : 'APPROVED')
    setReason('')
    setCommissionRate(vendor.commissionRate !== null ? String(vendor.commissionRate) : '')
  }

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!active) return
    setBusy(true)
    try {
      await marketplaceAdminApi.updateVendorStatus(active.id, {
        status: actionStatus,
        reason: reason || undefined,
        commissionRate: commissionRate === '' ? undefined : Number(commissionRate),
      })
      showToast(`Vendor ${actionStatus.toLowerCase()}.`)
      setActive(null)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 15))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search business, contact, email…" className="md:max-w-sm md:flex-1" />
        <div className="flex flex-wrap gap-2">
          {[
            { value: '', label: 'All' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'SUSPENDED', label: 'Suspended' },
            { value: 'REJECTED', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setStatus(tab.value); setPage(1) }}
              className={cn('rounded-full border px-4 py-2 text-xs font-semibold transition-colors', status === tab.value ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-night-700 bg-night-900 text-night-400 hover:border-gold-500/40')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16 text-night-400">
          <LoadingSpinner className="h-8 w-8 text-gold-500" />
        </div>
      ) : vendors.length === 0 ? (
        <EmptyState icon={<Store className="h-10 w-10" />} title="No vendors found" description="Applications from the public vendor signup appear here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Business</Th>
                  <Th>Contact</Th>
                  <Th>Bank</Th>
                  <Th className="text-right">Products</Th>
                  <Th className="text-right">Sales</Th>
                  <Th className="text-right">Commission</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="text-sm">
                    <Td>
                      <p className="font-semibold text-night-100">{vendor.businessName}</p>
                      <p className="text-xs text-night-500">{vendor.location ?? vendor.address ?? '—'}</p>
                    </Td>
                    <Td>
                      <p className="text-night-200">{vendor.contactName}</p>
                      <p className="text-xs text-night-500">{vendor.email}</p>
                      <p className="text-xs text-night-500">{vendor.phone}</p>
                    </Td>
                    <Td className="text-xs text-night-400">
                      {vendor.bankName ? `${vendor.bankName} · ${vendor.bankAccountNumber}` : '—'}
                    </Td>
                    <Td className="text-right text-night-200">{vendor.productCount ?? 0}</Td>
                    <Td className="text-right text-night-100">{formatPrice(vendor.totalSales ?? 0)}</Td>
                    <Td className="text-right text-night-200">
                      {vendor.commissionRate !== null ? `${vendor.commissionRate}%` : 'Default'}
                    </Td>
                    <Td className="text-right"><StatusBadge status={vendor.status} /></Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => openAction(vendor)}
                        className="rounded-lg border border-night-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-night-200 transition-colors hover:border-gold-500/60 hover:text-gold-300"
                      >
                        Manage
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40">Previous</button>
          <span className="px-3 text-sm text-night-400">Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={Boolean(active)} onClose={() => setActive(null)} title={active ? `Manage: ${active.businessName}` : ''} size="md">
        {active && (
          <form onSubmit={submitAction} className="space-y-4">
            {active.businessInfo && (
              <div className="rounded-xl border border-night-800 bg-night-950/50 p-4 text-sm text-night-300">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">About</p>
                <p className="mt-1 whitespace-pre-line">{active.businessInfo}</p>
              </div>
            )}
            <Field label="New status" hint="Approving also publishes this vendor's pending-review products. Suspending hides their products from the shop.">
              <select value={actionStatus} onChange={(event) => setActionStatus(event.target.value)} className={inputClass}>
                <option value="APPROVED">Approve</option>
                <option value="SUSPENDED">Suspend</option>
                <option value="REJECTED">Reject</option>
                <option value="PENDING">Move back to pending</option>
              </select>
            </Field>
            <Field label="Reason / note (shown to the vendor)">
              <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Documents verified" className={inputClass} />
            </Field>
            <Field label="Vendor commission override (%)" hint={`Leave blank to use the marketplace default. Applied as a percentage of each sale.`}>
              <input type="number" min={0} max={100} step="0.01" value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)} placeholder="Default" className={inputClass} />
            </Field>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="md" onClick={() => setActive(null)} disabled={busy}>Cancel</Button>
              <Button type="submit" variant="gold" size="md" loading={busy}>Apply</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

// ─── Products tab ────────────────────────────────────────────────────────────

function ProductsTab() {
  const { showToast } = useToast()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [rejectTarget, setRejectTarget] = useState<AdminProduct | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', description: '', commissionRate: '', isActive: true })
  const [busy, setBusy] = useState(false)
  const [productEditor, setProductEditor] = useState<AdminProduct | 'new' | null>(null)
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    brand: '',
    sku: '',
    categoryId: '',
    price: '',
    compareAtPrice: '',
    stock: '0',
    status: 'DRAFT' as 'DRAFT' | 'ACTIVE',
    isActive: true,
  })
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newImages, setNewImages] = useState<File[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await marketplaceAdminApi.products({ status: status || undefined, search: search || undefined, page, perPage: 15 })
      setProducts(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [status, search, page, showToast])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    marketplaceAdminApi.categories().then(setCategories).catch(() => undefined)
  }, [])

  const approve = async (product: AdminProduct) => {
    try {
      await marketplaceAdminApi.moderateProduct(product.id, 'APPROVED')
      showToast(`"${product.name}" is now live.`)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const submitReject = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!rejectTarget) return
    setBusy(true)
    try {
      await marketplaceAdminApi.moderateProduct(rejectTarget.id, 'REJECTED', rejectReason || undefined)
      showToast('Product rejected.')
      setRejectTarget(null)
      setRejectReason('')
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await marketplaceAdminApi.deleteProduct(deleteTarget.id)
      showToast('Product deleted.')
      setDeleteTarget(null)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const openProductEditor = (product?: AdminProduct) => {
    setProductEditor(product ?? 'new')
    setProductForm(product
      ? {
          name: product.name,
          description: product.description,
          brand: product.brand ?? '',
          sku: product.sku ?? '',
          categoryId: product.category ? String(product.category.id) : '',
          price: String(product.price),
          compareAtPrice: product.compareAtPrice === null ? '' : String(product.compareAtPrice),
          stock: String(product.stock),
          status: product.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
          isActive: product.isActive,
        }
      : {
          name: '',
          description: '',
          brand: '',
          sku: '',
          categoryId: '',
          price: '',
          compareAtPrice: '',
          stock: '0',
          status: 'DRAFT',
          isActive: true,
        })
    setExistingImages(product?.images.map((image) => image.url) ?? [])
    setNewImages([])
  }

  const submitProduct = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!productEditor) return
    if (existingImages.length + newImages.length === 0) {
      showToast('Upload at least one product image.', 'error')
      return
    }
    if (existingImages.length + newImages.length > 8) {
      showToast('A maximum of 8 product images is allowed.', 'error')
      return
    }
    setBusy(true)
    try {
      const body = new FormData()
      body.set('name', productForm.name)
      body.set('description', productForm.description)
      body.set('brand', productForm.brand)
      body.set('sku', productForm.sku)
      body.set('categoryId', productForm.categoryId)
      body.set('price', productForm.price)
      body.set('compareAtPrice', productForm.compareAtPrice)
      body.set('stock', productForm.stock)
      body.set('status', productForm.status)
      body.set('isActive', String(productForm.isActive))
      body.set('existingImages', JSON.stringify(existingImages))
      newImages.forEach((image) => body.append('images', image))

      if (productEditor === 'new') {
        await marketplaceAdminApi.createProduct(body)
        showToast(productForm.status === 'ACTIVE' ? 'Official-store product published.' : 'Product saved as a draft.')
      } else {
        await marketplaceAdminApi.updateProduct(productEditor.id, body)
        showToast('Product updated.')
      }
      setProductEditor(null)
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleProductAvailability = async (product: AdminProduct) => {
    try {
      await marketplaceAdminApi.setProductAvailability(product.id, !product.isActive)
      showToast(product.isActive ? 'Product is now unavailable.' : 'Product is now available.')
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const createCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await marketplaceAdminApi.createCategory({
        name: catForm.name,
        description: catForm.description || undefined,
        commissionRate: catForm.commissionRate === '' ? null : Number(catForm.commissionRate),
        isActive: catForm.isActive,
      })
      showToast('Category created.')
      setCatOpen(false)
      setCatForm({ name: '', description: '', commissionRate: '', isActive: true })
      setCategories(await marketplaceAdminApi.categories())
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 15))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-gold-500/30 bg-gradient-to-r from-gold-500/10 via-night-900/80 to-night-900/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl text-night-50">Add My Products</h2>
          <p className="mt-1 text-sm text-night-400">
            Manage Sawaba Grooming Studio Official Store products and publish them directly to the public Shop.
          </p>
        </div>
        <Button
          type="button"
          variant="gold"
          size="md"
          onClick={() => openProductEditor()}
          className="shrink-0 shadow-lg shadow-gold-500/15"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products…" className="md:max-w-sm md:flex-1" />
        <div className="flex flex-wrap gap-2">
          {[
            { value: '', label: 'All' },
            { value: 'DRAFT', label: 'Drafts' },
            { value: 'PENDING_REVIEW', label: 'Pending Review' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'ARCHIVED', label: 'Archived' },
          ].map((tab) => (
            <button key={tab.value} type="button" onClick={() => { setStatus(tab.value); setPage(1) }} className={cn('rounded-full border px-4 py-2 text-xs font-semibold transition-colors', status === tab.value ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-night-700 bg-night-900 text-night-400 hover:border-gold-500/40')}>
              {tab.label}
            </button>
          ))}
          <button type="button" onClick={() => setCatOpen(true)} className="rounded-full border border-gold-500/50 px-4 py-2 text-xs font-semibold text-gold-300 hover:bg-gold-500/10">
            + Category
          </button>
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span key={category.id} className={cn('rounded-full border px-3 py-1.5 text-xs', category.isActive ? 'border-night-700 bg-night-900 text-night-300' : 'border-red-500/40 bg-red-500/10 text-red-300')}>
              {category.name}
              <span className="ml-1.5 text-night-500">({category.productCount})</span>
              {category.commissionRate !== null && <span className="ml-1.5 text-gold-500">{category.commissionRate}%</span>}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16 text-night-400">
          <LoadingSpinner className="h-8 w-8 text-gold-500" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState icon={<Package className="h-10 w-10" />} title="No products found" description="Add an official-store product or review products submitted by vendors." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Product</Th>
                  <Th>Vendor</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Stock</Th>
                  <Th className="text-right">Sales</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {products.map((product) => (
                  <tr key={product.id} className="text-sm">
                    <Td>
                      <div className="flex items-center gap-3">
                        {product.images[0] ? (
                          <img src={product.images[0].url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-night-800 object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-night-800 text-night-600"><Package className="h-4 w-4" /></span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-night-100">{product.name}</p>
                          {product.brand && <p className="text-xs text-night-500">{product.brand}</p>}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-night-300">{product.vendor.businessName}</Td>
                    <Td className="text-night-400">{product.category?.name ?? '—'}</Td>
                    <Td className="text-right text-night-100">
                      {formatPrice(product.price)}
                      {product.compareAtPrice !== null && product.compareAtPrice > product.price && (
                        <span className="ml-1 text-xs text-night-500 line-through">{formatPrice(product.compareAtPrice)}</span>
                      )}
                    </Td>
                    <Td className={cn('text-right', product.stock === 0 ? 'text-red-300' : 'text-night-200')}>{product.stock}</Td>
                    <Td className="text-right text-night-200">{product.salesCount}</Td>
                    <Td className="text-right"><StatusBadge status={product.status} /></Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => openProductEditor(product)} className="rounded-lg border border-night-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-300 hover:border-gold-500/60 hover:text-gold-300" aria-label={`Edit ${product.name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {product.status === 'ACTIVE' && (
                          <button type="button" onClick={() => void toggleProductAvailability(product)} className={cn('rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider', product.isActive ? 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10' : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10')}>
                            {product.isActive ? 'Disable' : 'Enable'}
                          </button>
                        )}
                        {product.status === 'PENDING_REVIEW' && (
                          <button type="button" onClick={() => approve(product)} className="rounded-lg bg-emerald-500/90 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-400">
                            Approve
                          </button>
                        )}
                        {product.status !== 'REJECTED' && product.status !== 'ARCHIVED' && (
                          <button type="button" onClick={() => { setRejectTarget(product); setRejectReason('') }} className="rounded-lg border border-night-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-300 hover:border-red-500/60 hover:text-red-300">
                            Reject
                          </button>
                        )}
                        <button type="button" onClick={() => setDeleteTarget(product)} className="rounded-lg border border-night-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-300 hover:border-red-500/60 hover:text-red-300">
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40">Previous</button>
          <span className="px-3 text-sm text-night-400">Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Reject modal */}
      <Modal
        open={productEditor !== null}
        onClose={() => { if (!busy) setProductEditor(null) }}
        title={productEditor === 'new' ? 'Add official-store product' : 'Edit product'}
        size="lg"
      >
        <form onSubmit={submitProduct} className="space-y-5">
          <p className="text-xs text-night-400">
            New products are automatically assigned to Sawaba Grooming Studio Official Store. Vendor products keep their existing owner.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name">
              <input required minLength={3} maxLength={200} value={productForm.name} onChange={(event) => setProductForm((form) => ({ ...form, name: event.target.value }))} className={inputClass} />
            </Field>
            <Field label="SKU">
              <input maxLength={100} value={productForm.sku} onChange={(event) => setProductForm((form) => ({ ...form, sku: event.target.value }))} placeholder="Optional unique SKU" className={inputClass} />
            </Field>
            <Field label="Category">
              <select value={productForm.categoryId} onChange={(event) => setProductForm((form) => ({ ...form, categoryId: event.target.value }))} className={inputClass}>
                <option value="">Uncategorized</option>
                {categories.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Brand">
              <input maxLength={120} value={productForm.brand} onChange={(event) => setProductForm((form) => ({ ...form, brand: event.target.value }))} className={inputClass} />
            </Field>
            <Field label="Selling / discount price (₦)">
              <input required type="number" min="1" step="0.01" value={productForm.price} onChange={(event) => setProductForm((form) => ({ ...form, price: event.target.value }))} className={inputClass} />
            </Field>
            <Field label="Regular price before discount (₦)">
              <input type="number" min="0" step="0.01" value={productForm.compareAtPrice} onChange={(event) => setProductForm((form) => ({ ...form, compareAtPrice: event.target.value }))} className={inputClass} />
            </Field>
            <Field label="Stock quantity">
              <input required type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm((form) => ({ ...form, stock: event.target.value }))} className={inputClass} />
            </Field>
            <Field label="Availability">
              <select value={String(productForm.isActive)} onChange={(event) => setProductForm((form) => ({ ...form, isActive: event.target.value === 'true' }))} className={inputClass}>
                <option value="true">Available</option>
                <option value="false">Unavailable</option>
              </select>
            </Field>
            <Field label="Save as">
              <select value={productForm.status} onChange={(event) => setProductForm((form) => ({ ...form, status: event.target.value as 'DRAFT' | 'ACTIVE' }))} className={inputClass}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Publish</option>
              </select>
            </Field>
            <Field label="Product images (up to 8)">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                multiple
                onChange={(event) => {
                  const picked = Array.from(event.target.files ?? [])
                  setNewImages((current) => [...current, ...picked].slice(0, Math.max(0, 8 - existingImages.length)))
                  event.target.value = ''
                }}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea required minLength={10} maxLength={5000} rows={5} value={productForm.description} onChange={(event) => setProductForm((form) => ({ ...form, description: event.target.value }))} className={inputClass} />
          </Field>
          {(existingImages.length > 0 || newImages.length > 0) && (
            <div className="flex flex-wrap gap-3">
              {existingImages.map((url, index) => (
                <div key={`${url}-${index}`} className="relative">
                  <img src={url} alt={`Product image ${index + 1}`} className="h-16 w-16 rounded-lg border border-night-700 object-cover" />
                  <button type="button" onClick={() => setExistingImages((items) => items.filter((_, imageIndex) => imageIndex !== index))} className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 text-xs text-white" aria-label="Remove existing image">×</button>
                </div>
              ))}
              {newImages.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex max-w-28 items-center gap-1 rounded-lg border border-night-700 px-2 py-1 text-[10px] text-night-300">
                  <span className="truncate">{file.name}</span>
                  <button type="button" onClick={() => setNewImages((items) => items.filter((_, imageIndex) => imageIndex !== index))} aria-label={`Remove ${file.name}`} className="text-red-300">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="md" onClick={() => setProductEditor(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="gold" size="md" loading={busy}>
              {productForm.status === 'ACTIVE' ? 'Publish product' : 'Save draft'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject modal */}
      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject product" size="sm">
        <form onSubmit={submitReject} className="space-y-4">
          <p className="text-sm text-night-300">
            Rejecting <span className="font-semibold text-night-100">{rejectTarget?.name}</span> hides it from the shop and notifies the vendor.
          </p>
          <Field label="Reason">
            <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="e.g. Images do not meet guidelines" className={inputClass} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="md" onClick={() => setRejectTarget(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="gold" size="md" loading={busy}>Reject</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete product?" description={`"${deleteTarget?.name}" will be removed. Products with past orders are archived instead so history stays intact.`} confirmLabel="Delete" busy={busy} />

      {/* Category modal */}
      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="Add category" size="sm">
        <form onSubmit={createCategory} className="space-y-4">
          <Field label="Name">
            <input required value={catForm.name} onChange={(event) => setCatForm({ ...catForm, name: event.target.value })} placeholder="e.g. Hair Dyes" className={inputClass} />
          </Field>
          <Field label="Description">
            <input value={catForm.description} onChange={(event) => setCatForm({ ...catForm, description: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Category commission override (%)" hint="Leave blank to use the marketplace default for this category.">
            <input type="number" min={0} max={100} step="0.01" value={catForm.commissionRate} onChange={(event) => setCatForm({ ...catForm, commissionRate: event.target.value })} placeholder="Default" className={inputClass} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="md" onClick={() => setCatOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="gold" size="md" loading={busy}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Orders tab ──────────────────────────────────────────────────────────────

function OrdersTab() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [active, setActive] = useState<AdminOrderDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundAmount, setRefundAmount] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await marketplaceAdminApi.orders({
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        perPage: 15,
      })
      setOrders(result.items)
      setTotal(result.total)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [status, paymentStatus, search, from, to, page, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const openOrder = async (reference: string) => {
    try {
      setActive(await marketplaceAdminApi.order(reference))
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await action()
      showToast(message)
      if (active) setActive(await marketplaceAdminApi.order(active.referenceCode))
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitRefund = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!active) return
    await run(async () => {
      const refund = await marketplaceAdminApi.createRefund(active.referenceCode, {
        reason: refundReason,
        amount: refundAmount ? Number(refundAmount) : undefined,
      })
      await marketplaceAdminApi.resolveRefund(refund.id, 'APPROVED', 'Admin-issued refund')
      setRefundOpen(false)
      setRefundReason('')
      setRefundAmount('')
    }, 'Refund completed — ledger reversed and payment refunded.')
  }

  const totalPages = Math.max(1, Math.ceil(total / 15))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Reference, customer, phone, email…" className="md:max-w-sm md:flex-1" />
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" className="h-11 rounded-xl border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" className="h-11 rounded-xl border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Order status" className="h-11 rounded-xl border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none">
            <option value="">All statuses</option>
            {['AWAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map((value) => (
              <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} aria-label="Payment status" className="h-11 rounded-xl border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none">
            <option value="">All payments</option>
            {['UNPAID', 'PENDING_VERIFICATION', 'PAID', 'REJECTED', 'REFUNDED'].map((value) => (
              <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem('adminToken') || localStorage.getItem('token')
                const url = marketplaceAdminApi.exportOrdersCsvUrl({ from: from || undefined, to: to || undefined })
                const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                if (!res.ok) throw new Error('Export failed')
                const blob = await res.blob()
                const objectUrl = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = objectUrl
                a.download = 'marketplace-orders.csv'
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(objectUrl)
              } catch {
                showToast('Failed to export orders CSV', 'error')
              }
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-night-700 px-4 text-xs font-semibold uppercase tracking-wider text-night-300 transition-colors hover:border-gold-500/60 hover:text-gold-300"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16 text-night-400">
          <LoadingSpinner className="h-8 w-8 text-gold-500" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-10 w-10" />} title="No orders found" description="Shop orders appear here once customers start buying." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-night-800 bg-night-900/60">
                <tr>
                  <Th>Reference</Th>
                  <Th>Customer</Th>
                  <Th>Vendors</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Method</Th>
                  <Th className="text-right">Payment</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Date</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {orders.map((order) => (
                  <tr key={order.id} onClick={() => openOrder(order.referenceCode)} className="cursor-pointer text-sm transition-colors hover:bg-night-900/60">
                    <Td className="font-semibold text-night-100">{order.referenceCode}</Td>
                    <Td>
                      <p className="text-night-200">{order.customerName}</p>
                      <p className="text-xs text-night-500">{order.customerPhone}</p>
                    </Td>
                    <Td className="max-w-[180px] truncate text-xs text-night-400">{order.vendorNames.join(' + ')}</Td>
                    <Td className="text-right font-semibold text-night-100">{formatPrice(order.totalAmount)}</Td>
                    <Td className="text-night-300">{(order.paymentMethod ?? '—').replace('_', ' ')}</Td>
                    <Td className="text-right"><StatusBadge status={order.paymentStatus} /></Td>
                    <Td className="text-right"><StatusBadge status={order.status} /></Td>
                    <Td className="text-right text-xs text-night-400">{new Date(order.createdAt).toLocaleDateString('en-GB')}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40">Previous</button>
          <span className="px-3 text-sm text-night-400">Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 hover:border-gold-500/60 disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Order detail modal */}
      <Modal open={Boolean(active)} onClose={() => setActive(null)} title={active ? `Order ${active.referenceCode}` : ''} size="xl">
        {active && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={active.status} />
              <StatusBadge status={active.paymentStatus} />
              <span className="text-sm text-night-400">
                {(active.paymentMethod ?? '—').replace('_', ' ')} · {active.vendorNames.join(' + ')}
              </span>
              <span className="ml-auto font-display text-2xl text-gold-400">{formatPrice(active.totalAmount)}</span>
            </div>

            {/* Receipt + verify */}
            {active.paymentStatus === 'PENDING_VERIFICATION' && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-200">Payment awaiting verification</p>
                <p className="mt-1 text-xs text-amber-100/80">
                  Verify the transfer against your bank statement before confirming. A receipt alone is not proof of payment.
                </p>
                {active.receiptUrl && (
                  <a href={active.receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-semibold text-gold-300 underline">
                    View uploaded receipt
                  </a>
                )}
                {active.transactionRef && (
                  <p className="mt-1 text-xs text-amber-100/80">Customer reference: {active.transactionRef}</p>
                )}
                <div className="mt-3 flex gap-3">
                  <Button variant="gold" size="sm" loading={busy} onClick={() => run(() => marketplaceAdminApi.verifyOrderPayment(active.referenceCode), 'Payment verified — commission ledger created.')}>
                    <CheckCircle2 className="h-4 w-4" />
                    Verify & Mark Paid
                  </Button>
                  <Button variant="outline" size="sm" loading={busy} onClick={() => run(() => marketplaceAdminApi.rejectOrderPayment(active.referenceCode, 'Could not match this transfer.'), 'Payment rejected.')}>
                    Reject
                  </Button>
                </div>
              </div>
            )}

            {/* Items */}
            <div className="overflow-hidden rounded-xl border border-night-800">
              <table className="w-full">
                <thead className="border-b border-night-800 bg-night-950/60">
                  <tr>
                    <Th>Item</Th>
                    <Th>Vendor</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Line</Th>
                    <Th className="text-right">Rate</Th>
                    <Th className="text-right">Commission</Th>
                    <Th className="text-right">Vendor Net</Th>
                    <Th className="text-right">Fulfillment</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-night-800 text-sm">
                  {active.items.map((item) => (
                    <tr key={item.id}>
                      <Td className="text-night-100">
                        {item.productName}
                        {item.variationLabel && <span className="block text-xs text-night-500">{item.variationLabel}</span>}
                      </Td>
                      <Td className="text-night-300">{item.vendorName}</Td>
                      <Td className="text-right text-night-200">{item.quantity}</Td>
                      <Td className="text-right text-night-100">{formatPrice(item.lineTotal)}</Td>
                      <Td className="text-right text-night-400">{Number(item.commissionRate)}%</Td>
                      <Td className="text-right text-night-300">{formatPrice(Number(item.commissionAmount))}</Td>
                      <Td className="text-right font-semibold text-gold-300">{formatPrice(Number(item.vendorNet))}</Td>
                      <Td className="text-right"><StatusBadge status={item.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Delivery + customer */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-night-800 bg-night-950/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">Customer</p>
                <p className="mt-2 text-sm text-night-100">{active.customerName}</p>
                <p className="text-xs text-night-400">{active.customerPhone} {active.customerEmail ? `· ${active.customerEmail}` : ''}</p>
                <p className="mt-2 text-xs text-night-400">{active.deliveryAddress}{active.deliveryLocation ? ` · ${active.deliveryLocation}` : ''}</p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-night-500">Payment reference</p>
                <p className="mt-1 break-all text-xs text-night-200">{active.transactionRef ?? 'Not provided'}</p>
                {active.paymentVerifiedAt && (
                  <p className="mt-1 text-[11px] text-emerald-300">
                    Verified {new Date(active.paymentVerifiedAt).toLocaleString('en-GB')}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-night-800 bg-night-950/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">Order and payment history</p>
                <ul className="mt-2 space-y-1.5">
                  {active.events.slice(0, 6).map((event) => (
                    <li key={event.id} className="text-xs text-night-400">
                      <span className="font-semibold text-night-200">{event.type.replace(/_/g, ' ')}</span> — {event.detail ?? event.status}
                      <span className="ml-1 text-night-600">{new Date(event.createdAt).toLocaleString('en-GB')}</span>
                    </li>
                  ))}
                  {active.events.length === 0 && <li className="text-xs text-night-500">No events.</li>}
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 border-t border-night-800 pt-4">
              {active.paymentStatus === 'PAID' && active.status === 'PAYMENT_CONFIRMED' && (
                <Button variant="gold" size="sm" loading={busy} onClick={() => run(() => marketplaceAdminApi.updateOrderStatus(active.referenceCode, 'PROCESSING'), 'Order moved to processing.')}>
                  Start Processing
                </Button>
              )}
              {active.paymentStatus === 'PAID' && active.status === 'PROCESSING' && (
                <Button variant="outline" size="sm" loading={busy} onClick={() => run(() => marketplaceAdminApi.updateOrderStatus(active.referenceCode, 'READY_FOR_DISPATCH'), 'Order is ready for dispatch.')}>
                  Ready for Dispatch
                </Button>
              )}
              {active.paymentStatus === 'PAID' && ['PAYMENT_CONFIRMED', 'PROCESSING', 'READY_FOR_DISPATCH'].includes(active.status) && (
                <Button variant="gold" size="sm" loading={busy} onClick={() => run(() => marketplaceAdminApi.updateOrderStatus(active.referenceCode, 'SHIPPED'), 'Order marked shipped.')}>
                  Mark Shipped
                </Button>
              )}
              {active.paymentStatus === 'PAID' && ['PAYMENT_CONFIRMED', 'PROCESSING', 'READY_FOR_DISPATCH', 'SHIPPED'].includes(active.status) && (
                <Button variant="gold" size="sm" loading={busy} onClick={() => run(() => marketplaceAdminApi.updateOrderStatus(active.referenceCode, 'DELIVERED'), 'Order marked delivered.')}>
                  Mark Delivered
                </Button>
              )}
              {active.paymentStatus === 'PAID' && !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(active.status) && (
                <Button variant="outline" size="sm" loading={busy} onClick={() => setRefundOpen(true)}>
                  Issue Refund
                </Button>
              )}
              {active.paymentStatus !== 'PAID' && active.status !== 'CANCELLED' && (
                <Button variant="outline" size="sm" loading={busy} onClick={() => run(() => marketplaceAdminApi.updateOrderStatus(active.referenceCode, 'CANCELLED', 'Cancelled by admin'), 'Order cancelled and stock returned.')}>
                  Cancel Order
                </Button>
              )}
            </div>

            {/* Refunds history */}
            {active.refunds.length > 0 && (
              <div className="rounded-xl border border-night-800 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-500">Refunds</p>
                <ul className="mt-2 space-y-1.5">
                  {active.refunds.map((refund) => (
                    <li key={refund.id} className="text-xs text-night-400">
                      {formatPrice(refund.amount)} · {refund.status} — {refund.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Refund modal */}
      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Issue refund" size="sm">
        <form onSubmit={submitRefund} className="space-y-4">
          <p className="text-sm text-night-300">
            Refunding order <span className="font-semibold text-night-100">{active?.referenceCode}</span>. The commission ledger
            is reversed (history is kept, never deleted) and the payment is marked refunded.
          </p>
          <Field label="Amount (₦)" hint={`Up to ${active ? formatPrice(active.totalAmount - active.refundedAmount) : ''} remaining`}>
            <input required type="number" min={1} step="0.01" max={active ? active.totalAmount - active.refundedAmount : undefined} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder={active ? String(active.totalAmount - active.refundedAmount) : ''} className={inputClass} />
          </Field>
          <Field label="Reason">
            <input required value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="e.g. Customer returned damaged item" className={inputClass} />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="md" onClick={() => setRefundOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="gold" size="md" loading={busy}>Complete Refund</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Finance tab (ledger + payouts) ─────────────────────────────────────────

function FinanceTab() {
  const { showToast } = useToast()
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof marketplaceAdminApi.ledger>> | null>(null)
  const [payoutFilter, setPayoutFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [payTarget, setPayTarget] = useState<PayoutRow | null>(null)
  const [payRef, setPayRef] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [payoutResult, ledgerResult] = await Promise.all([
        marketplaceAdminApi.payouts({ status: payoutFilter || undefined, perPage: 25 }),
        marketplaceAdminApi.ledger({ perPage: 25 }),
      ])
      setPayouts(payoutResult.items)
      setLedger(ledgerResult)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [payoutFilter, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const process = async (payout: PayoutRow, action: 'APPROVED' | 'REJECTED' | 'PAID') => {
    setBusy(true)
    try {
      await marketplaceAdminApi.processPayout(payout.id, action, action === 'PAID' ? { transactionRef: payRef || undefined } : undefined)
      showToast(`Payout ${action.toLowerCase()}.`)
      setPayTarget(null)
      setPayRef('')
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !ledger) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Ledger totals */}
      {ledger && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Sales (Ledger)" value={formatPrice(ledger.totals.salePrice)} icon={<Banknote className="h-5 w-5" />} accent />
          <StatCard label="Commission Earned" value={formatPrice(ledger.totals.commissionAmount)} icon={<Wallet className="h-5 w-5" />} />
          <StatCard label="Vendor Net" value={formatPrice(ledger.totals.vendorNet)} icon={<Store className="h-5 w-5" />} />
          <StatCard label="Reversed" value={formatPrice(ledger.totals.reversedAmount)} icon={<XCircle className="h-5 w-5" />} />
        </div>
      )}

      {/* Payouts */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-night-50">Payout Requests</h2>
          <div className="flex gap-2">
            {['', 'REQUESTED', 'APPROVED', 'PAID', 'REJECTED'].map((value) => (
              <button key={value} type="button" onClick={() => setPayoutFilter(value)} className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', payoutFilter === value ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-night-700 bg-night-900 text-night-400')}>
                {value === '' ? 'All' : value}
              </button>
            ))}
          </div>
        </div>

        {payouts.length === 0 ? (
          <EmptyState icon={<Banknote className="h-10 w-10" />} title="No payout requests" description="Vendor payout requests appear here for processing." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-night-800 bg-night-900/60">
                  <tr>
                    <Th>Reference</Th>
                    <Th>Vendor</Th>
                    <Th>Bank Details</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="text-right">Status</Th>
                    <Th className="text-right">Action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-night-800">
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="text-sm">
                      <Td className="font-semibold text-night-100">{payout.referenceCode}</Td>
                      <Td className="text-night-200">{payout.vendorName}</Td>
                      <Td className="text-xs text-night-400">{payout.bankName ? `${payout.bankName} · ${payout.accountNumber} · ${payout.accountName}` : '—'}</Td>
                      <Td className="text-right font-semibold text-night-100">{formatPrice(payout.amount)}</Td>
                      <Td className="text-right"><StatusBadge status={payout.status} /></Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {payout.status === 'REQUESTED' && (
                            <>
                              <button type="button" disabled={busy} onClick={() => process(payout, 'APPROVED')} className="rounded-lg bg-emerald-500/90 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-400 disabled:opacity-40">Approve</button>
                              <button type="button" disabled={busy} onClick={() => process(payout, 'REJECTED')} className="rounded-lg border border-night-700 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-300 hover:border-red-500/60 hover:text-red-300 disabled:opacity-40">Reject</button>
                            </>
                          )}
                          {payout.status === 'APPROVED' && (
                            <button type="button" disabled={busy} onClick={() => { setPayTarget(payout); setPayRef('') }} className="rounded-lg bg-gold-500 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-950 hover:bg-gold-400 disabled:opacity-40">Mark Paid</button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Ledger */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-night-50">Commission Ledger</h2>
          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem('adminToken') || localStorage.getItem('token')
                const url = marketplaceAdminApi.exportLedgerCsvUrl({})
                const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                if (!res.ok) throw new Error('Export failed')
                const blob = await res.blob()
                const objectUrl = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = objectUrl
                a.download = 'commission-ledger.csv'
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(objectUrl)
              } catch {
                showToast('Failed to export ledger CSV', 'error')
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-night-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-night-300 hover:border-gold-500/60 hover:text-gold-300"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
        {!ledger || ledger.items.length === 0 ? (
          <EmptyState icon={<FileText className="h-10 w-10" />} title="No ledger entries" description="Commission entries are created automatically when order payments are verified." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px]">
                <thead className="border-b border-night-800 bg-night-900/60">
                  <tr>
                    <Th>Order</Th>
                    <Th>Vendor</Th>
                    <Th>Product</Th>
                    <Th className="text-right">Sale</Th>
                    <Th className="text-right">Rate</Th>
                    <Th className="text-right">Commission</Th>
                    <Th className="text-right">Vendor Net</Th>
                    <Th className="text-right">Settlement</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-night-800">
                  {ledger.items.map((entry) => (
                    <tr key={entry.id} className="text-sm">
                      <Td className="font-semibold text-night-100">{entry.orderReference}</Td>
                      <Td className="text-night-200">{entry.vendorName}</Td>
                      <Td className="max-w-[180px] truncate text-night-300">{entry.productName}</Td>
                      <Td className="text-right text-night-100">{formatPrice(entry.salePrice)}</Td>
                      <Td className="text-right text-night-400">{entry.commissionRate}%</Td>
                      <Td className="text-right text-night-200">{formatPrice(entry.commissionAmount)}</Td>
                      <Td className="text-right font-semibold text-gold-300">
                        {formatPrice(entry.vendorNet)}
                        {entry.reversedAmount > 0 && <span className="block text-[10px] text-red-300">{formatPrice(entry.reversedAmount)} reversed</span>}
                      </Td>
                      <Td className="text-right"><StatusBadge status={entry.settlementStatus} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={Boolean(payTarget)} onClose={() => setPayTarget(null)} title="Confirm payout" size="sm">
        {payTarget && (
          <div className="space-y-4">
            <p className="text-sm text-night-300">
              Confirm you have sent <span className="font-semibold text-gold-300">{formatPrice(payTarget.amount)}</span> to{' '}
              <span className="font-semibold text-night-100">{payTarget.vendorName}</span>{' '}
              ({payTarget.bankName} · {payTarget.accountNumber}). This settles the ledger entries — they cannot be
              paid twice.
            </p>
            <Field label="Transfer reference (optional)">
              <input value={payRef} onChange={(event) => setPayRef(event.target.value)} placeholder="Bank transfer reference" className={inputClass} />
            </Field>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="md" onClick={() => setPayTarget(null)} disabled={busy}>Cancel</Button>
              <Button variant="gold" size="md" loading={busy} onClick={() => process(payTarget, 'PAID')}>
                Mark as Paid
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Reviews tab ─────────────────────────────────────────────────────────────

function ReviewsTab() {
  const { showToast } = useToast()
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await marketplaceAdminApi.reviews({ status: status || undefined, perPage: 30 })
      setReviews(result.items)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [status, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const moderate = async (id: number, action: 'APPROVED' | 'REJECTED') => {
    try {
      await marketplaceAdminApi.moderateReview(id, action)
      showToast(action === 'APPROVED' ? 'Review approved.' : 'Review rejected.')
      await load()
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { value: '', label: 'All' },
          { value: 'PENDING', label: 'Pending' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
        ].map((tab) => (
          <button key={tab.value} type="button" onClick={() => setStatus(tab.value)} className={cn('rounded-full border px-4 py-2 text-xs font-semibold', status === tab.value ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-night-700 bg-night-900 text-night-400')}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-16 text-night-400">
          <LoadingSpinner className="h-8 w-8 text-gold-500" />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState icon={<Star className="h-10 w-10" />} title="No product reviews" description="Verified-buyer reviews appear here for moderation." />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-2xl border border-night-800 bg-night-900/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-night-100">
                    {review.productName} <span className="text-xs font-normal text-night-500">· {review.vendorName}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-night-500">
                    {review.customerName} · {new Date(review.createdAt).toLocaleDateString('en-GB')} ·{' '}
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={review.status} />
                  {review.status === 'PENDING' && (
                    <>
                      <button type="button" onClick={() => moderate(review.id, 'APPROVED')} className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-400">Approve</button>
                      <button type="button" onClick={() => moderate(review.id, 'REJECTED')} className="rounded-lg border border-night-700 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-night-300 hover:border-red-500/60 hover:text-red-300">Reject</button>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-night-300">{review.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Settings tab ────────────────────────────────────────────────────────────

function SettingsTab() {
  const { showToast } = useToast()
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    marketplaceAdminApi
      .settings()
      .then(setSettings)
      .catch((error) => showToast((error as Error).message, 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!settings) return
    setSaving(true)
    try {
      const updated = await marketplaceAdminApi.updateSettings(settings)
      setSettings(updated)
      showToast('Marketplace settings saved.')
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
      </div>
    )
  }

  const toggle = (key: keyof MarketplaceSettings, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-night-800 bg-night-950/40 p-4">
      <span>
        <span className="block text-sm font-semibold text-night-100">{label}</span>
        <span className="mt-0.5 block text-xs text-night-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={Boolean(settings[key])}
        onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })}
        className="mt-1 h-5 w-5 shrink-0 accent-[#c9a24b]"
      />
    </label>
  )

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6">
      <div className="rounded-2xl border border-night-800 bg-night-900/40 p-6">
        <h2 className="font-display text-xl text-night-50">Commission</h2>
        <p className="mt-1 text-xs text-night-500">
          The commission rate is frozen onto each sale when it happens — changing it here never rewrites
          historical transactions.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Default commission type">
            <select
              value={settings.commissionType}
              onChange={(event) => setSettings({ ...settings, commissionType: event.target.value as MarketplaceSettings['commissionType'] })}
              className={inputClass}
            >
              <option value="PERCENTAGE">Percentage of each sale</option>
              <option value="FIXED">Fixed ₦ fee per order line</option>
            </select>
          </Field>
          <Field label={settings.commissionType === 'FIXED' ? 'Fixed fee (₦ per line)' : 'Default commission (%)'}>
            <input
              required
              type="number"
              min={0}
              max={settings.commissionType === 'FIXED' ? 1000000 : 100}
              step="0.01"
              value={settings.defaultCommissionRate}
              onChange={(event) => setSettings({ ...settings, defaultCommissionRate: Number(event.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Earnings release delay (days)" hint="Vendor earnings become withdrawable this many days after delivery.">
            <input required type="number" min={0} max={90} value={settings.releaseDelayDays} onChange={(event) => setSettings({ ...settings, releaseDelayDays: Number(event.target.value) })} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-night-800 bg-night-900/40 p-6">
        <h2 className="font-display text-xl text-night-50">Delivery</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Delivery fee (₦)">
            <input required type="number" min={0} step="0.01" value={settings.deliveryFee} onChange={(event) => setSettings({ ...settings, deliveryFee: Number(event.target.value) })} className={inputClass} />
          </Field>
          <Field label="Free delivery above (₦)" hint="Set 0 to always charge the delivery fee.">
            <input required type="number" min={0} step="0.01" value={settings.freeDeliveryThreshold} onChange={(event) => setSettings({ ...settings, freeDeliveryThreshold: Number(event.target.value) })} className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Delivery locations" hint="Comma-separated — shown as suggestions at checkout.">
              <input value={settings.deliveryLocations} onChange={(event) => setSettings({ ...settings, deliveryLocations: event.target.value })} placeholder="Dutse, Kubwa, Gwarinpa" className={inputClass} />
            </Field>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {toggle('requireProductApproval', 'Require product approval', 'New and edited products must be approved by an admin before appearing in the shop.')}
        {toggle('allowGuestCheckout', 'Allow guest checkout', 'Customers without an account can place orders.')}
        {toggle('vendorRegistrationOpen', 'Vendor registration open', 'When off, the public vendor application form is closed.')}
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="gold" size="md" loading={saving}>
          Save Settings
        </Button>
      </div>
    </form>
  )
}

// ─── Page shell ──────────────────────────────────────────────────────────────

export default function AdminMarketplacePage({ initialTab }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'overview')

  return (
    <div>
      <PageHeader
        title="Marketplace"
        subtitle="Multi-vendor shop — vendors, products, orders, commissions and payouts."
        icon={<ShoppingBag className="h-5 w-5" />}
        action={
          <Link
            to="/shop"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl border border-night-700 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-night-300 transition-colors hover:border-gold-500/60 hover:text-gold-300"
          >
            <Store className="h-4 w-4" />
            View Shop
          </Link>
        }
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
              tab === item.value
                ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                : 'border-night-700 bg-night-900 text-night-400 hover:border-gold-500/40 hover:text-gold-300',
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab onNavigate={setTab} />}
      {tab === 'vendors' && <VendorsTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'finance' && <FinanceTab />}
      {tab === 'reviews' && <ReviewsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  )
}
