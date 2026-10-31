import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Minus, PackageSearch, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Button, ButtonLink } from '../../components/ui/Button'
import { useShopCart } from '../../store/shopCart'
import { useToast } from '../../components/ui/ToastNotification'
import { formatPrice } from '../../utils/format'

export default function CartPage() {
  const { cart, loading, update, remove } = useShopCart()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<number | null>(null)

  // Group lines by vendor — a single checkout can contain several vendors.
  const groups = useMemo(() => {
    const map = new Map<number, { vendorName: string; items: NonNullable<typeof cart>['items'] }>()
    for (const item of cart?.items ?? []) {
      const existing = map.get(item.product.vendor.id)
      if (existing) existing.items.push(item)
      else
        map.set(item.product.vendor.id, {
          vendorName: item.product.vendor.businessName,
          items: [item],
        })
    }
    return [...map.values()]
  }, [cart])

  const changeQuantity = async (itemId: number, quantity: number) => {
    setBusyId(itemId)
    try {
      await update(itemId, quantity)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const dropItem = async (itemId: number) => {
    setBusyId(itemId)
    try {
      await remove(itemId)
      showToast('Item removed from cart.')
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-night-950 pt-[72px] text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Loading your cart…</p>
      </div>
    )
  }

  const itemCount = cart?.itemCount ?? 0

  return (
    <PageTransition>
      <div className="bg-night-950 pt-[96px] pb-20">
        <div className="container-app">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-night-500">
            <Link to="/shop" className="transition-colors hover:text-gold-400">
              Shop
            </Link>
            <span>/</span>
            <span className="text-gold-400">Cart</span>
          </nav>

          <h1 className="font-display text-3xl text-night-50 sm:text-4xl">Your Cart</h1>

          {!cart || cart.items.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<ShoppingCart className="h-10 w-10" />}
                title="Your cart is empty"
                description="Browse the shop and add barber-grade products to your cart."
                action={
                  <ButtonLink to="/shop" variant="gold" size="md" className="mt-2">
                    Browse Shop
                  </ButtonLink>
                }
              />
            </div>
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-3">
              {/* Cart lines, grouped by vendor */}
              <div className="space-y-6 lg:col-span-2">
                {groups.map((group) => (
                  <div key={group.vendorName} className="overflow-hidden rounded-2xl border border-night-800 bg-night-900/40">
                    <div className="border-b border-night-800 bg-night-900/60 px-5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-500">
                        Sold by {group.vendorName}
                      </p>
                    </div>
                    <ul className="divide-y divide-night-800">
                      {group.items.map((item) => (
                        <li key={item.id} className="flex gap-4 p-4 sm:p-5">
                          <Link
                            to={`/shop/${item.product.slug}`}
                            className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-night-800 bg-night-950 sm:h-24 sm:w-24"
                          >
                            {item.product.image ? (
                              <img
                                src={item.product.image}
                                alt={item.product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-night-600">
                                <PackageSearch className="h-7 w-7" />
                              </div>
                            )}
                          </Link>

                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <Link
                                  to={`/shop/${item.product.slug}`}
                                  className="line-clamp-2 text-sm font-semibold text-night-100 hover:text-gold-300"
                                >
                                  {item.product.name}
                                </Link>
                                {item.variation && (
                                  <p className="mt-1 text-xs text-night-500">
                                    {item.variation.name}: {item.variation.value}
                                  </p>
                                )}
                                <p className="mt-1 text-xs text-night-500">
                                  {formatPrice(item.unitPrice)} each
                                </p>
                              </div>
                              <p className="shrink-0 font-display text-lg text-gold-400">
                                {formatPrice(item.lineTotal)}
                              </p>
                            </div>

                            <div className="mt-auto flex items-center justify-between pt-3">
                              <div className="flex items-center rounded-lg border border-night-700">
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(item.id, item.quantity - 1)}
                                  disabled={busyId === item.id}
                                  aria-label="Decrease quantity"
                                  className="p-2 text-night-300 transition-colors hover:text-gold-400 disabled:opacity-40"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-8 text-center text-sm font-semibold text-night-100">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(item.id, Math.min(item.product.stock, item.quantity + 1))}
                                  disabled={busyId === item.id || item.quantity >= item.product.stock}
                                  aria-label="Increase quantity"
                                  className="p-2 text-night-300 transition-colors hover:text-gold-400 disabled:opacity-40"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => dropItem(item.id)}
                                disabled={busyId === item.id}
                                aria-label={`Remove ${item.product.name}`}
                                className="rounded-lg p-2 text-night-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="lg:col-span-1">
                <div className="sticky top-24 rounded-2xl border border-night-800 bg-night-900/60 p-6">
                  <h2 className="font-display text-xl text-night-50">Order Summary</h2>
                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-night-400">Subtotal ({itemCount} item{itemCount === 1 ? '' : 's'})</dt>
                      <dd className="font-semibold text-night-100">{formatPrice(cart.subtotal)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-night-400">Delivery fee</dt>
                      <dd className="text-night-300">Calculated at checkout</dd>
                    </div>
                  </dl>
                  <div className="mt-5 border-t border-night-800 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-night-200">Subtotal today</span>
                      <span className="font-display text-2xl text-gold-400">{formatPrice(cart.subtotal)}</span>
                    </div>
                  </div>
                  <Button
                    variant="gold"
                    size="lg"
                    fullWidth
                    className="mt-6"
                    onClick={() => navigate('/shop/checkout')}
                  >
                    Proceed to Checkout
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Link
                    to="/shop"
                    className="mt-4 block text-center text-sm text-night-400 transition-colors hover:text-gold-300"
                  >
                    Continue shopping
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
