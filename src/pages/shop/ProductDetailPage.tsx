import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  MapPin,
  Minus,
  PackageSearch,
  Play,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck,
  X,
  ZoomIn,
} from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import StarRating from '../../components/ui/StarRating'
import { Button } from '../../components/ui/Button'
import { useShopCart } from '../../store/shopCart'
import { useCustomerAuth } from '../../store/customerAuth'
import { shopApi, type ShopPickupInfo, type ShopProductDetail, type ShopReview } from '../../api/shop'
import { setBuyNow } from '../../utils/buyNow'
import { formatPrice } from '../../utils/format'
import { useToast } from '../../components/ui/ToastNotification'
import { cn } from '../../utils/cn'

export default function ProductDetailPage() {
  const { slug = '' } = useParams()
  const { add, adding } = useShopCart()
  const { customer } = useCustomerAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [product, setProduct] = useState<ShopProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [variationId, setVariationId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [zoomActive, setZoomActive] = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [pickupInfo, setPickupInfo] = useState<ShopPickupInfo | null>(null)

  const [reviews, setReviews] = useState<ShopReview[]>([])
  const [reviewTotal, setReviewTotal] = useState(0)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const detail = await shopApi.product(slug)
      setProduct(detail)
      setSelectedImage(0)
      setVariationId(null)
      setQuantity(1)
      const reviewPage = await shopApi.reviews(detail.id, 1)
      setReviews(reviewPage.items)
      setReviewTotal(reviewPage.total)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    shopApi.pickupInfo().then(setPickupInfo).catch(() => undefined)
  }, [])

  const selectedVariation =
    product?.variations.find((item) => item.id === variationId) ?? null
  const unitPrice = product
    ? Math.max(0, product.price + (selectedVariation?.priceDelta ?? 0))
    : 0
  const outOfStock = (product?.stock ?? 0) <= 0
  const maxStock = Math.max(
    0,
    Math.min(product?.stock ?? 0, selectedVariation?.stock ?? product?.stock ?? 0),
  )
  const discountPercent =
    product?.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0

  const handleAdd = async () => {
    if (!product) return
    try {
      await add({ productId: product.id, variationId, quantity })
      showToast(`"${product.name}" added to cart.`)
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
  }

  /** Buy Now checks out ONLY this product — the saved cart is left untouched. */
  const handleBuyNow = () => {
    if (!product) return
    setBuyNow({
      productId: product.id,
      variationId,
      quantity,
      name: product.name,
      slug: product.slug,
      image:
        product.images[selectedImage]?.mediaType === 'VIDEO'
          ? product.images[selectedImage]?.thumbnailUrl ?? product.image
          : product.images[selectedImage]?.url ?? product.image,
      unitPrice,
      variationLabel: selectedVariation
        ? `${selectedVariation.name}: ${selectedVariation.value}`
        : null,
      vendorName: product.vendor.businessName,
      stock: maxStock,
    })
    navigate('/shop/checkout?mode=buy-now')
  }

  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!product) return
    setSubmitting(true)
    try {
      const result = await shopApi.submitReview(product.id, {
        rating,
        comment,
        customerName: customer?.fullName,
      })
      showToast(result ? 'Review submitted — thank you!' : 'Review submitted — thank you!', 'success')
      setComment('')
      const reviewPage = await shopApi.reviews(product.id, 1)
      setReviews(reviewPage.items)
      setReviewTotal(reviewPage.total)
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-night-950 pt-[72px] text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Loading product…</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="bg-night-950 pt-[112px] pb-20">
        <div className="container-app">
          <EmptyState
            icon={<PackageSearch className="h-10 w-10" />}
            title="Product unavailable"
            description={error ?? 'This product could not be found.'}
            action={
              <Link
                to="/shop"
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-gold-400 hover:text-gold-300"
              >
                <ArrowLeft className="h-4 w-4" /> Back to shop
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const images =
    product.images.length > 0
      ? product.images
      : [
          {
            id: 0,
            url: '',
            alt: product.name,
            mediaType: 'IMAGE',
            thumbnailUrl: null,
            duration: null,
            isPrimary: true,
            sortOrder: 0,
          },
        ]
  const activeMedia = images[selectedImage]
  const isActiveVideo = activeMedia?.mediaType === 'VIDEO' && Boolean(activeMedia.url)

  return (
    <PageTransition>
      <div className="bg-night-950 pt-[96px] pb-20">
        <div className="container-app">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-night-500">
            <Link to="/shop" className="transition-colors hover:text-gold-400">
              Shop
            </Link>
            <span>/</span>
            <span className="truncate text-gold-400">{product.name}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Gallery */}
            <div className="space-y-4">
              <div
                className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl border border-night-800 bg-night-900"
                onMouseEnter={() => setZoomActive(true)}
                onMouseLeave={() => setZoomActive(false)}
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect()
                  const x = ((event.clientX - rect.left) / rect.width) * 100
                  const y = ((event.clientY - rect.top) / rect.height) * 100
                  setZoomOrigin(`${x}% ${y}%`)
                }}
                onClick={() => !isActiveVideo && activeMedia?.url && setLightboxOpen(true)}
              >
                {isActiveVideo ? (
                  <video
                    src={activeMedia?.url}
                    poster={activeMedia?.thumbnailUrl ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                    className="h-full w-full bg-black object-contain"
                  />
                ) : activeMedia?.url ? (
                  <img
                    src={activeMedia.url}
                    alt={activeMedia.alt ?? product.name}
                    className="h-full w-full object-cover transition-transform duration-200"
                    style={{
                      transform: zoomActive ? 'scale(2)' : 'scale(1)',
                      transformOrigin: zoomOrigin,
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-night-600">
                    <PackageSearch className="h-16 w-16" />
                  </div>
                )}
                {activeMedia?.url && !isActiveVideo && (
                  <span className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-night-950/80 px-3 py-1.5 text-[11px] font-semibold text-night-200 opacity-0 transition-opacity group-hover:opacity-100">
                    <ZoomIn className="h-3.5 w-3.5 text-gold-400" /> Hover to zoom · click for full size
                  </span>
                )}
              </div>
              {product.images.length > 1 && (
                <div className="grid grid-cols-5 gap-3">
                  {product.images.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedImage(index)}
                      aria-label={`View ${image.mediaType === 'VIDEO' ? 'video' : 'image'} ${index + 1}`}
                      className={cn(
                        'relative aspect-square overflow-hidden rounded-lg border transition-all',
                        selectedImage === index
                          ? 'border-gold-500 ring-1 ring-gold-500/50'
                          : 'border-night-800 opacity-70 hover:opacity-100',
                      )}
                    >
                      <img
                        src={image.mediaType === 'VIDEO' ? image.thumbnailUrl ?? image.url : image.url}
                        alt={image.alt ?? ''}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {image.mediaType === 'VIDEO' ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-4 w-4 text-white" aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-500">
                  {product.brand ?? product.category?.name ?? 'SAWABA Shop'}
                </p>
                <h1 className="mt-2 font-display text-3xl leading-tight text-night-50 sm:text-4xl">
                  {product.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <StarRating rating={product.rating} size={15} />
                  <span className="text-sm text-night-400">
                    {product.rating.toFixed(1)} ({product.reviewCount} review
                    {product.reviewCount === 1 ? '' : 's'})
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-night-500">
                    <Store className="h-3.5 w-3.5 text-gold-500/80" />
                    Sold by {product.vendor.businessName}
                  </span>
                </div>
              </div>

              <div className="flex items-end gap-3">
                <p className="font-display text-4xl text-gold-400">{formatPrice(unitPrice)}</p>
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <p className="pb-1 text-lg text-night-500 line-through">
                    {formatPrice(product.compareAtPrice)}
                  </p>
                )}
                {discountPercent > 0 && (
                  <span className="mb-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-bold text-white">
                    -{discountPercent}% off
                  </span>
                )}
              </div>

              <p className="whitespace-pre-line text-sm leading-relaxed text-night-300">
                {product.description}
              </p>

              {/* Variations */}
              {product.variations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-400">
                    Options
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setVariationId(null)}
                      className={cn(
                        'rounded-lg border px-3.5 py-2 text-sm transition-colors',
                        variationId === null
                          ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                          : 'border-night-700 text-night-300 hover:border-gold-500/50',
                      )}
                    >
                      Default
                    </button>
                    {product.variations.map((variation) => (
                      <button
                        key={variation.id}
                        type="button"
                        onClick={() => {
                          setVariationId(variation.id)
                          setQuantity((current) => Math.min(current, Math.max(1, variation.stock)))
                        }}
                        disabled={variation.stock <= 0}
                        className={cn(
                          'rounded-lg border px-3.5 py-2 text-sm transition-colors',
                          variationId === variation.id
                            ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                            : 'border-night-700 text-night-300 hover:border-gold-500/50',
                          variation.stock <= 0 && 'cursor-not-allowed line-through opacity-40',
                        )}
                      >
                        {variation.name}: {variation.value}
                        {variation.priceDelta !== 0 && (
                          <span className="ml-1.5 text-xs text-gold-500/80">
                            {variation.priceDelta > 0 ? '+' : ''}
                            {formatPrice(variation.priceDelta)}
                          </span>
                        )}
                        {variation.stock <= 0 && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wider text-red-400">Sold out</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity + actions */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center rounded-lg border border-night-700">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    aria-label="Decrease quantity"
                    className="p-3 text-night-300 transition-colors hover:text-gold-400"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold text-night-100">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.min(Math.max(1, maxStock), current + 1))}
                    aria-label="Increase quantity"
                    disabled={quantity >= maxStock}
                    className="p-3 text-night-300 transition-colors hover:text-gold-400 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className={cn('text-sm', outOfStock ? 'text-red-400' : 'text-night-400')}>
                  {outOfStock
                    ? 'Out of stock'
                    : `${maxStock} unit${maxStock === 1 ? '' : 's'} available`}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={handleAdd}
                  disabled={outOfStock || adding}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Add to Cart
                </Button>
                <Button variant="gold" size="lg" className="flex-1" onClick={handleBuyNow} disabled={outOfStock || adding}>
                  Buy Now
                </Button>
              </div>

              {/* Delivery info */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-3 rounded-xl border border-night-800 bg-night-900/50 p-4">
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
                  <div>
                    <p className="text-sm font-semibold text-night-100">Delivery</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-night-400">
                      Dispatched after payment confirmation, within ~{pickupInfo?.deliveryEstimateDays ?? 3} day
                      {(pickupInfo?.deliveryEstimateDays ?? 3) === 1 ? '' : 's'}. Fee shown at checkout.
                    </p>
                  </div>
                </div>
                {pickupInfo?.enabled !== false && (
                  <div className="flex items-start gap-3 rounded-xl border border-night-800 bg-night-900/50 p-4">
                    <Store className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
                    <div>
                      <p className="text-sm font-semibold text-night-100">Store pickup</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-night-400">
                        Collect free from {pickupInfo?.shopName ?? 'the studio'} — you get a unique pickup code
                        after ordering.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 rounded-xl border border-night-800 bg-night-900/50 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
                  <div>
                    <p className="text-sm font-semibold text-night-100">Secure payment</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-night-400">
                      Paystack card payments or admin-verified bank transfer / OPay.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews */}
          <section className="mt-12 rounded-2xl border border-night-800 bg-night-900/40 p-6">
            <h2 className="font-display text-xl text-night-50">Product specifications</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              {[
                { label: 'Brand', value: product.brand ?? '—' },
                { label: 'Category', value: product.category?.name ?? 'Salon supplies' },
                { label: 'Seller', value: product.vendor.businessName },
                { label: 'Availability', value: outOfStock ? 'Out of stock' : `${product.stock} in stock` },
                { label: 'Condition', value: 'Brand new' },
                ...(pickupInfo?.phone ? [{ label: 'Seller support', value: pickupInfo.phone }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 border-b border-night-800 py-2.5">
                  <dt className="text-night-400">{row.label}</dt>
                  <dd className="text-right font-medium text-night-100">{row.value}</dd>
                </div>
              ))}
            </dl>
            {product.variations.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                  Available sizes & colours
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {product.variations.map((variation) => (
                    <li
                      key={variation.id}
                      className="rounded-lg border border-night-700 px-2.5 py-1 text-xs text-night-200"
                    >
                      {variation.name}: {variation.value}
                      <span className="ml-1.5 text-night-500">
                        {variation.stock > 0 ? `${variation.stock} left` : 'sold out'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pickupInfo && (
              <div className="mt-5 grid gap-3 rounded-xl border border-night-800 bg-night-950/50 p-4 text-xs text-night-300 sm:grid-cols-2">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                  Pickup: {pickupInfo.shopName}, {pickupInfo.address}
                </p>
                <p className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                  {pickupInfo.hours}
                </p>
              </div>
            )}
          </section>

          <div className="mt-16">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl text-night-50">
                Reviews ({reviewTotal})
              </h2>
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-3">
              {/* Write a review */}
              <div className="rounded-2xl border border-night-800 bg-night-900/50 p-5">
                <h3 className="text-sm font-semibold text-night-100">Write a review</h3>
                <p className="mt-1 text-xs text-night-500">
                  Available after a verified purchase of this product.
                </p>
                <form onSubmit={submitReview} className="mt-4 space-y-4">
                  <div>
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
                      Rating
                    </span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRating(value)}
                          aria-label={`${value} star${value === 1 ? '' : 's'}`}
                          className="p-1"
                        >
                          <Star
                            className={cn(
                              'h-6 w-6 transition-colors',
                              value <= rating
                                ? 'fill-gold-400 text-gold-400'
                                : 'fill-night-700 text-night-700 hover:text-gold-500',
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    required
                    minLength={3}
                    rows={4}
                    placeholder="Share your experience with this product…"
                    className="w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none"
                  />
                  <Button type="submit" variant="gold" size="md" fullWidth loading={submitting}>
                    Submit Review
                  </Button>
                </form>
              </div>

              {/* Review list */}
              <div className="lg:col-span-2">
                {reviews.length === 0 ? (
                  <EmptyState
                    icon={<Star className="h-10 w-10" />}
                    title="No reviews yet"
                    description="Be the first to review this product after your purchase."
                  />
                ) : (
                  <ul className="space-y-4">
                    {reviews.map((review) => (
                      <li
                        key={review.id}
                        className="rounded-2xl border border-night-800 bg-night-900/40 p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 text-sm font-bold text-gold-400">
                              {review.customerName.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-night-100">{review.customerName}</p>
                              <p className="text-[11px] text-night-500">
                                {new Date(review.createdAt).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                          <StarRating rating={review.rating} size={13} />
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-night-300">{review.comment}</p>
                        {review.reply && (
                          <div className="mt-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-500">
                              Vendor reply
                            </p>
                            <p className="mt-1 text-sm text-night-300">{review.reply}</p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {lightboxOpen && activeMedia && activeMedia.url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product image"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-night-950/95 p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            aria-label="Close image"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 rounded-full border border-night-700 bg-night-900/80 p-2 text-night-200 hover:text-gold-300"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={activeMedia.url}
            alt={activeMedia.alt ?? product.name}
            className="max-h-[90vh] w-auto max-w-full rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </PageTransition>
  )
}
