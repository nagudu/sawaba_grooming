import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, CreditCard, Landmark, PackageSearch, Smartphone } from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { useShopCart } from '../../store/shopCart'
import { useCustomerAuth } from '../../store/customerAuth'
import { useToast } from '../../components/ui/ToastNotification'
import { shopApi, type ShopSettings } from '../../api/shop'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

type Method = 'ONLINE' | 'BANK_TRANSFER' | 'OPAY' | 'CASH'

const METHODS: Array<{ value: Method; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'ONLINE', label: 'Card / Bank / USSD', hint: 'Paystack — verified instantly', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', hint: 'Upload receipt — verified by admin', icon: Landmark },
  { value: 'OPAY', label: 'OPay Transfer', hint: 'Upload receipt — verified by admin', icon: Smartphone },
  { value: 'CASH', label: 'Pay on Delivery', hint: 'Cash when your order arrives', icon: Banknote },
]

const inputClass =
  'w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
        {label}
      </span>
      {children}
    </label>
  )
}

export default function CheckoutPage() {
  const { cart, loading, refresh } = useShopCart()
  const { customer } = useCustomerAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [customerName, setCustomerName] = useState(customer?.fullName ?? '')
  const [customerPhone, setCustomerPhone] = useState(customer?.phone ?? '')
  const [customerEmail, setCustomerEmail] = useState(customer?.email ?? '')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<Method>('ONLINE')

  useEffect(() => {
    shopApi.settings().then(setSettings).catch(() => undefined)
  }, [])

  useEffect(() => {
    // Prefill from the customer account once it loads.
    if (customer) {
      setCustomerName((current) => current || customer.fullName)
      setCustomerPhone((current) => current || customer.phone)
      setCustomerEmail((current) => current || (customer.email ?? ''))
    }
  }, [customer])

  const deliveryFee = useMemo(() => {
    if (!settings || !cart) return 0
    if (settings.freeDeliveryThreshold > 0 && cart.subtotal >= settings.freeDeliveryThreshold) return 0
    return settings.deliveryFee
  }, [settings, cart])

  const total = (cart?.subtotal ?? 0) + deliveryFee

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!cart || cart.items.length === 0) return
    setSubmitting(true)
    try {
      const order = await shopApi.checkout({
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        deliveryAddress,
        deliveryLocation: deliveryLocation || undefined,
        notes: notes || undefined,
        paymentMethod,
      })
      await refresh()

      if (paymentMethod === 'ONLINE') {
        // Start Paystack and redirect to their hosted checkout.
        const init = await shopApi.initPaystack(order.referenceCode)
        window.location.href = init.authorizationUrl
        return
      }
      showToast(`Order ${order.referenceCode} placed!`)
      navigate(`/shop/orders/${order.referenceCode}`, {
        state: { phone: customerPhone },
      })
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-night-950 pt-[72px] text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Loading checkout…</p>
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="bg-night-950 pt-[112px] pb-20">
        <div className="container-app">
          <EmptyState
            icon={<PackageSearch className="h-10 w-10" />}
            title="Your cart is empty"
            description="Add products to your cart before checking out."
            action={
              <Link to="/shop" className="mt-2 text-sm font-semibold text-gold-400 hover:text-gold-300">
                Browse the shop
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="bg-night-950 pt-[96px] pb-20">
        <div className="container-app">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-night-500">
            <Link to="/shop" className="transition-colors hover:text-gold-400">Shop</Link>
            <span>/</span>
            <Link to="/shop/cart" className="transition-colors hover:text-gold-400">Cart</Link>
            <span>/</span>
            <span className="text-gold-400">Checkout</span>
          </nav>

          <h1 className="font-display text-3xl text-night-50 sm:text-4xl">Checkout</h1>
          {!customer && settings?.allowGuestCheckout !== false && (
            <p className="mt-2 text-sm text-night-400">
              Checking out as a guest.{' '}
              <Link to="/account/login" className="text-gold-400 hover:text-gold-300">
                Sign in
              </Link>{' '}
              to track orders in your account.
            </p>
          )}

          <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-5">
            {/* Details */}
            <div className="space-y-6 lg:col-span-3">
              <div className="rounded-2xl border border-night-800 bg-night-900/40 p-6">
                <h2 className="font-display text-xl text-night-50">Contact & Delivery</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <input
                      required
                      minLength={2}
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Your full name"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Phone number">
                    <input
                      required
                      minLength={7}
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="0801 234 5678"
                      className={inputClass}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Email (for order updates)">
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(event) => setCustomerEmail(event.target.value)}
                        placeholder="you@example.com"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Delivery address">
                      <input
                        required
                        minLength={5}
                        value={deliveryAddress}
                        onChange={(event) => setDeliveryAddress(event.target.value)}
                        placeholder="House number, street, area"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="City / Area">
                    <input
                      value={deliveryLocation}
                      onChange={(event) => setDeliveryLocation(event.target.value)}
                      placeholder="e.g. Dutse, Abuja"
                      list="shop-delivery-locations"
                      className={inputClass}
                    />
                    <datalist id="shop-delivery-locations">
                      {(settings?.deliveryLocations ?? []).map((location) => (
                        <option key={location} value={location} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Order notes (optional)">
                    <input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Any instructions…"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl border border-night-800 bg-night-900/40 p-6">
                <h2 className="font-display text-xl text-night-50">Payment Method</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {METHODS.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                        paymentMethod === method.value
                          ? 'border-gold-500 bg-gold-500/10'
                          : 'border-night-700 hover:border-gold-500/40',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                          paymentMethod === method.value
                            ? 'border-gold-500/50 bg-gold-500/15 text-gold-400'
                            : 'border-night-700 bg-night-900 text-night-400',
                        )}
                      >
                        <method.icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-night-100">{method.label}</span>
                        <span className="mt-0.5 block text-xs text-night-500">{method.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {paymentMethod !== 'ONLINE' && paymentMethod !== 'CASH' && (
                  <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                    After placing the order you'll see the bank / OPay details and can upload your transfer
                    receipt. An admin verifies every transfer before your order is confirmed.
                  </p>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="lg:col-span-2">
              <div className="sticky top-24 rounded-2xl border border-night-800 bg-night-900/60 p-6">
                <h2 className="font-display text-xl text-night-50">Your Order</h2>
                <ul className="mt-5 space-y-3">
                  {cart.items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-night-200">
                          {item.product.name}{' '}
                          <span className="text-night-500">× {item.quantity}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-night-500">
                          {item.product.vendor.businessName}
                          {item.variation ? ` · ${item.variation.value}` : ''}
                        </p>
                      </div>
                      <p className="shrink-0 text-night-100">{formatPrice(item.lineTotal)}</p>
                    </li>
                  ))}
                </ul>

                <dl className="mt-5 space-y-2.5 border-t border-night-800 pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-night-400">Subtotal</dt>
                    <dd className="text-night-100">{formatPrice(cart.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-night-400">Delivery</dt>
                    <dd className="text-night-100">
                      {deliveryFee === 0 ? 'Free' : formatPrice(deliveryFee)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between border-t border-night-800 pt-4">
                  <span className="text-sm font-semibold text-night-200">Total</span>
                  <span className="font-display text-2xl text-gold-400">{formatPrice(total)}</span>
                </div>

                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  fullWidth
                  className="mt-6"
                  loading={submitting}
                >
                  {paymentMethod === 'ONLINE' ? `Pay ${formatPrice(total)} with Paystack` : 'Place Order'}
                </Button>

                <p className="mt-3 text-center text-[11px] leading-relaxed text-night-500">
                  Prices and stock are re-checked on our server before the order is created. Payment is
                  only confirmed after trusted verification.
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </PageTransition>
  )
}
