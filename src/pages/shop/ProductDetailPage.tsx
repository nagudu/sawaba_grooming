import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, PackageSearch, Minus, Plus, ShoppingBag, Star, Truck, Store, ShieldCheck } from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import StarRating from '../../components/ui/StarRating'
import { Button } from '../../components/ui/Button'
import { useShopCart } from '../../store/shopCart'
import { useCustomerAuth } from '../../store/customerAuth'
import { shopApi, type ShopProductDetail, type ShopReview } from '../../api/shop'
import { formatPrice } from '../../utils/format'
import { useToast } from '../../components/ui/ToastNotification'
import { cn } from '../../utils/cn'

export default function ProductDetailPage() {
  const { slug = '' } = useParams()
  const { add, adding } = useShopCart()
  const { customer } = useCustomerAuth()
  const { showToast } = useToast()

  const [product, setProduct] = useState<ShopProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [variationId, setVariationId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)

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

  const selectedVariation =
    product?.variations.find((item) => item.id === variationId) ?? null
  const unitPrice = product
    ? Math.max(0, product.price + (selectedVariation?.priceDelta ?? 0))
    : 0
  const outOfStock = (product?.stock ?? 0) <= 0

  const handleAdd = async () => {
    if (!product) return
    try {
      await add({ productId: product.id, variationId, quantity })
      showToast(`"${product.name}" added to cart.`)
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
  }

  const handleBuyNow = async () => {
    if (!product) return
    try {
      await add({ productId: product.id, variationId, quantity })
      window.location.href = '/shop/checkout'
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
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

  const images = product.images.length > 0 ? product.images : [{ id: 0, url: '', alt: product.name }]

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
              <div className="aspect-square overflow-hidden rounded-2xl border border-night-800 bg-night-900">
                {images[selectedImage]?.url ? (
                  <img
                    src={images[selectedImage].url}
                    alt={images[selectedImage].alt ?? product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-night-600">
                    <PackageSearch className="h-16 w-16" />
                  </div>
                )}
              </div>
              {product.images.length > 1 && (
                <div className="grid grid-cols-5 gap-3">
                  {product.images.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedImage(index)}
                      aria-label={`View image ${index + 1}`}
                      className={cn(
                        'aspect-square overflow-hidden rounded-lg border transition-all',
                        selectedImage === index
                          ? 'border-gold-500 ring-1 ring-gold-500/50'
                          : 'border-night-800 opacity-70 hover:opacity-100',
                      )}
                    >
                      <img src={image.url} alt={image.alt ?? ''} className="h-full w-full object-cover" />
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
                        onClick={() => setVariationId(variation.id)}
                        className={cn(
                          'rounded-lg border px-3.5 py-2 text-sm transition-colors',
                          variationId === variation.id
                            ? 'border-gold-500 bg-gold-500/15 text-gold-300'
                            : 'border-night-700 text-night-300 hover:border-gold-500/50',
                        )}
                      >
                        {variation.name}: {variation.value}
                        {variation.priceDelta !== 0 && (
                          <span className="ml-1.5 text-xs text-gold-500/80">
                            {variation.priceDelta > 0 ? '+' : ''}
                            {formatPrice(variation.priceDelta)}
                          </span>
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
                    onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))}
                    aria-label="Increase quantity"
                    className="p-3 text-night-300 transition-colors hover:text-gold-400"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className={cn('text-sm', outOfStock ? 'text-red-400' : 'text-night-400')}>
                  {outOfStock
                    ? 'Out of stock'
                    : `${product.stock} unit${product.stock === 1 ? '' : 's'} available`}
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl border border-night-800 bg-night-900/50 p-4">
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
                  <div>
                    <p className="text-sm font-semibold text-night-100">Delivery</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-night-400">
                      Dispatched by the vendor within 24 hours of payment confirmation. Delivery fee shown
                      at checkout.
                    </p>
                  </div>
                </div>
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
    </PageTransition>
  )
}
