import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PackageSearch, ShoppingBag, Store, Truck } from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import PageHero from '../../components/layout/PageHero'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchInput from '../../components/ui/SearchInput'
import StarRating from '../../components/ui/StarRating'
import { useShopCart } from '../../store/shopCart'
import { shopApi, type ShopProduct } from '../../api/shop'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'
import { useToast } from '../../components/ui/ToastNotification'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'popular', label: 'Best Selling' },
]

function ProductCard({ product }: { product: ShopProduct }) {
  const { add, adding } = useShopCart()
  const { showToast } = useToast()
  const outOfStock = product.stock <= 0

  const handleAdd = async () => {
    try {
      await add({ productId: product.id, quantity: 1 })
      showToast(`"${product.name}" added to cart.`)
    } catch (error) {
      showToast((error as Error).message, 'error')
    }
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-night-800 bg-night-900/60 transition-all duration-300 hover:border-gold-500/40"
    >
      <Link to={`/shop/${product.slug}`} className="relative block aspect-square overflow-hidden bg-night-950">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-night-600">
            <PackageSearch className="h-12 w-12" />
          </div>
        )}
        {product.compareAtPrice && product.compareAtPrice > product.price && (
          <span className="absolute top-3 left-3 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Save {formatPrice(Math.round(product.compareAtPrice - product.price))}
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-night-950/70 text-xs font-bold uppercase tracking-[0.2em] text-night-300">
            Out of stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] text-night-500">
          <span className="truncate">{product.brand ?? product.category?.name ?? 'SAWABA Shop'}</span>
          <span className="shrink-0 truncate text-gold-500/80">{product.vendor.businessName}</span>
        </div>

        <Link
          to={`/shop/${product.slug}`}
          className="line-clamp-2 text-sm font-semibold leading-snug text-night-100 transition-colors hover:text-gold-300"
        >
          {product.name}
        </Link>

        <div className="flex items-center gap-2">
          <StarRating rating={product.rating} size={12} />
          <span className="text-[11px] text-night-500">({product.reviewCount})</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div>
            <p className="font-display text-lg text-gold-400">{formatPrice(product.price)}</p>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <p className="text-xs text-night-500 line-through">
                {formatPrice(product.compareAtPrice)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock || adding}
            className="rounded-lg border border-gold-500/50 bg-gold-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gold-300 transition-all hover:bg-gold-500 hover:text-night-950 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        </div>
        {product.stock > 0 && product.stock <= product.lowStockThreshold && (
          <p className="text-[11px] font-semibold text-amber-400">Only {product.stock} left</p>
        )}
      </div>
    </motion.div>
  )
}

export default function ShopPage() {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof shopApi.categories>>>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage] = useState(12)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [brand, setBrand] = useState('all')
  const [sort, setSort] = useState('newest')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await shopApi.products({
        search: search.trim() || undefined,
        category: category === 'all' ? undefined : category,
        brand: brand === 'all' ? undefined : brand,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sort,
        page,
        perPage,
      })
      setProducts(result.items)
      setTotal(result.total)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [search, category, brand, sort, minPrice, maxPrice, page, perPage])

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1)
  }, [search, category, brand, sort, minPrice, maxPrice])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  useEffect(() => {
    shopApi.categories().then(setCategories).catch(() => undefined)
    shopApi.brands().then(setBrands).catch(() => undefined)
  }, [])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage])

  return (
    <PageTransition>
      <PageHero
        eyebrow="The SAWABA Shop"
        crumb="Shop"
        title="Barber-Grade Products, Delivered"
        description="Hair dyes, shampoos, clippers, oils and salon supplies — from SAWABA and trusted independent vendors, in one checkout."
        image="/images/pagehero.jpg"
      />

      <section className="bg-night-950 py-12 md:py-16">
        <div className="container-app">
          {/* ── Filters ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 rounded-2xl border border-night-800 bg-night-900/50 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search products, brands…"
                className="md:max-w-sm md:flex-1"
              />
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  aria-label="Filter by category"
                  className="h-11 rounded-xl border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none"
                >
                  <option value="all">All categories</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.name} ({item.productCount})
                    </option>
                  ))}
                </select>

                <select
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  aria-label="Filter by brand"
                  className="h-11 rounded-xl border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none"
                >
                  <option value="all">All brands</option>
                  {brands.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  aria-label="Sort products"
                  className="h-11 rounded-xl border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-500">
                Price (₦)
              </span>
              <input
                type="number"
                min={0}
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="Min"
                aria-label="Minimum price"
                className="h-10 w-24 rounded-lg border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none"
              />
              <span className="text-night-600">—</span>
              <input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="Max"
                aria-label="Maximum price"
                className="h-10 w-24 rounded-lg border border-night-700 bg-night-900/80 px-3 text-sm text-night-100 focus:border-gold-500/70 focus:outline-none"
              />
              {(minPrice || maxPrice || category !== 'all' || brand !== 'all' || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice('')
                    setMaxPrice('')
                    setCategory('all')
                    setBrand('all')
                    setSearch('')
                  }}
                  className="text-xs font-semibold text-gold-500 transition-colors hover:text-gold-300"
                >
                  Clear filters
                </button>
              )}
              <span className="ml-auto text-xs text-night-500">
                {total} product{total === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* ── Grid ────────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-20 text-night-400">
              <LoadingSpinner className="h-8 w-8 text-gold-500" />
              <p className="text-sm">Loading products…</p>
            </div>
          ) : error ? (
            <div className="mt-10">
              <EmptyState
                icon={<Store className="h-10 w-10" />}
                title="Could not load products"
                description={error}
              />
            </div>
          ) : products.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<Store className="h-10 w-10" />}
                title="No products found"
                description="Try a different search or clear your filters."
              />
            </div>
          ) : (
            <motion.div
              className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4"
              initial="hidden"
              animate="show"
              key={`${page}-${sort}-${category}-${brand}-${search}`}
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </motion.div>
          )}

          {/* ── Pagination ──────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 transition-colors hover:border-gold-500/60 hover:text-gold-300 disabled:opacity-40"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).slice(0, 7).map((_, index) => {
                const pageNumber = index + 1
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={cn(
                      'h-10 w-10 rounded-lg border text-sm font-semibold transition-colors',
                      page === pageNumber
                        ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                        : 'border-night-700 text-night-300 hover:border-gold-500/60',
                    )}
                  >
                    {pageNumber}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-night-700 px-4 py-2 text-sm text-night-300 transition-colors hover:border-gold-500/60 hover:text-gold-300 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

          {/* ── Delivery info ───────────────────────────────────────── */}
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Truck, title: 'Fast Delivery', text: 'Dispatch within 24h on confirmed orders.' },
              { icon: ShoppingBag, title: 'Secure Checkout', text: 'Paystack-verified payments & admin-checked transfers.' },
              { icon: Store, title: 'Trusted Vendors', text: 'Every seller is reviewed and approved by SAWABA.' },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-night-800 bg-night-900/40 p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold-500/30 bg-gold-500/10 text-gold-400">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-night-100">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-night-400">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageTransition>
  )
}
