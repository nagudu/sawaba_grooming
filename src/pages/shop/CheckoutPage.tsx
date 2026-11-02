import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Landmark,
  MapPin,
  PackageSearch,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  Copy,
} from 'lucide-react'
import PageTransition from '../../components/ui/PageTransition'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { useShopCart } from '../../store/shopCart'
import { useCustomerAuth } from '../../store/customerAuth'
import { useToast } from '../../components/ui/ToastNotification'
import { shopApi, type ShopPaymentOptions, type ShopPickupInfo, type ShopSettings } from '../../api/shop'
import { clearBuyNow, getBuyNow } from '../../utils/buyNow'
import { formatPrice } from '../../utils/format'
import { cn } from '../../utils/cn'

type Method = 'ONLINE' | 'BANK_TRANSFER' | 'OPAY' | 'CASH'
type Fulfillment = 'DELIVERY' | 'PICKUP'

const METHODS: Array<{
  value: Method
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: 'ONLINE', label: 'Card, bank or USSD', hint: 'Paystack — verified instantly', icon: CreditCard },
  { value: 'BANK_TRANSFER', label: 'Bank transfer', hint: 'Upload your receipt for verification', icon: Landmark },
  { value: 'OPAY', label: 'OPay transfer', hint: 'Upload your receipt for verification', icon: Smartphone },
  { value: 'CASH', label: 'Pay on delivery', hint: 'Cash when your order arrives', icon: Banknote },
]

const inputClass =
  'w-full rounded-xl border border-night-700 bg-night-900/80 px-3.5 py-3 text-sm text-night-100 placeholder:text-night-500 focus:border-gold-500/70 focus:outline-none'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-night-500">{hint}</span>}
    </label>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard blocked (insecure origin): the value is still visible above.
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-night-700 px-2.5 py-1.5 text-[11px] font-semibold text-night-300 transition-colors hover:border-gold-500/50 hover:text-gold-300"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

function StepBadge({ index, active, done }: { index: number; active: boolean; done: boolean }) {
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
        done
          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
          : active
            ? 'border-gold-500 bg-gold-500/15 text-gold-300'
            : 'border-night-700 text-night-500',
      )}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : index}
    </span>
  )
}

/**
 * Three-step checkout (details → fulfilment → payment), modelled on the flow
 * shoppers already know from Jumia/AliExpress. Buy Now (`?mode=buy-now`)
 * checks out a single product without touching the saved cart.
 */
export default function CheckoutPage() {
  const { cart, loading, refresh } = useShopCart()
  const { customer } = useCustomerAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const isBuyNow = searchParams.get('mode') === 'buy-now'
  const buyNowItem = useMemo(() => (isBuyNow ? getBuyNow() : null), [isBuyNow])

  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [pickupInfo, setPickupInfo] = useState<ShopPickupInfo | null>(null)
  const [paymentOptions, setPaymentOptions] = useState<ShopPaymentOptions | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(0)

  const [customerName, setCustomerName] = useState(customer?.fullName ?? '')
  const [customerPhone, setCustomerPhone] = useState(customer?.phone ?? '')
  const [customerEmail, setCustomerEmail] = useState(customer?.email ?? '')
  const [fulfillmentChoice, setFulfillment] = useState<Fulfillment>('DELIVERY')
  // Derived (not an effect): if the studio disables pickup, checkout falls back
  // to home delivery immediately without a second render pass.
  const fulfillment: Fulfillment =
    pickupInfo && !pickupInfo.enabled ? 'DELIVERY' : fulfillmentChoice
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [deliveryInstructions, setDeliveryInstructions] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<Method>('ONLINE')

  useEffect(() => {
    shopApi.settings().then(setSettings).catch(() => undefined)
    shopApi.pickupInfo().then(setPickupInfo).catch(() => undefined)
    shopApi.paymentOptions().then(setPaymentOptions).catch(() => undefined)
  }, [])

  // Only offer methods the server says are usable: enabled by the admin AND
  // fully configured (account details / Paystack key). Until the options load,
  // the full list is shown optimistically.
  const availableMethods = useMemo(
    () =>
      paymentOptions
        ? METHODS.filter((method) =>
            paymentOptions.methods.some((option) => option.method === method.value && option.available),
          )
        : METHODS,
    [paymentOptions],
  )

  useEffect(() => {
    if (availableMethods.length > 0 && !availableMethods.some((method) => method.value === paymentMethod)) {
      setPaymentMethod(availableMethods[0].value)
    }
  }, [availableMethods, paymentMethod])

  useEffect(() => {
    if (!customer) return
    setCustomerName((current) => current || customer.fullName)
    setCustomerPhone((current) => current || customer.phone)
    setCustomerEmail((current) => current || (customer.email ?? ''))
  }, [customer])

  const lines = useMemo(() => {
    if (buyNowItem) {
      return [
        {
          key: `buy-now-${buyNowItem.productId}`,
          name: buyNowItem.name,
          image: buyNowItem.image,
          quantity: buyNowItem.quantity,
          unitPrice: buyNowItem.unitPrice,
          lineTotal: Math.round(buyNowItem.unitPrice * buyNowItem.quantity * 100) / 100,
          vendorName: buyNowItem.vendorName,
          variationLabel: buyNowItem.variationLabel,
        },
      ]
    }
    return (cart?.items ?? []).map((item) => ({
      key: `cart-${item.id}`,
      name: item.product.name,
      image: item.product.image,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      vendorName: item.product.vendor.businessName,
      variationLabel: item.variation ? `${item.variation.name}: ${item.variation.value}` : null,
    }))
  }, [buyNowItem, cart])

  const subtotal = useMemo(
    () => Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100,
    [lines],
  )

  const deliveryFee = useMemo(() => {
    if (fulfillment === 'PICKUP' || !settings) return 0
    if (settings.freeDeliveryThreshold > 0 && subtotal >= settings.freeDeliveryThreshold) return 0
    return settings.deliveryFee
  }, [fulfillment, settings, subtotal])

  const total = Math.round((subtotal + deliveryFee) * 100) / 100
  const estimateDays = pickupInfo?.deliveryEstimateDays ?? 3

  const detailsValid =
    customerName.trim().length >= 2 && customerPhone.replace(/\D/g, '').length >= 7

  const fulfillmentValid = fulfillment === 'PICKUP' || deliveryAddress.trim().length >= 5

  const paymentValid = paymentMethod !== 'ONLINE' || /\S+@\S+\.\S+/.test(customerEmail)

  const goNext = () => {
    if (step === 0) {
      if (!detailsValid) {
        showToast('Please enter your full name and a valid phone number.', 'error')
        return
      }
      setStep(1)
      return
    }
    if (step === 1) {
      if (!fulfillmentValid) {
        showToast('Please enter the address where we should deliver your order.', 'error')
        return
      }
      setStep(2)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (lines.length === 0) return
    if (!detailsValid) {
      setStep(0)
      showToast('Please complete your contact details.', 'error')
      return
    }
    if (!fulfillmentValid) {
      setStep(1)
      showToast('Please provide a delivery address.', 'error')
      return
    }
    if (!paymentValid) {
      setStep(2)
      showToast('An email address is required for online card payments.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const { order, tracking } = await shopApi.checkout({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        fulfillmentType: fulfillment,
        deliveryAddress: fulfillment === 'DELIVERY' ? deliveryAddress.trim() : undefined,
        deliveryLocation: fulfillment === 'DELIVERY' ? deliveryLocation.trim() || undefined : undefined,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod,
        items: buyNowItem
          ? [
              {
                productId: buyNowItem.productId,
                variationId: buyNowItem.variationId,
                quantity: buyNowItem.quantity,
              },
            ]
          : undefined,
      })

      // The order exists server-side now; a reload can never duplicate it.
      clearBuyNow()
      if (!buyNowItem) await refresh()

      // Guests are not given an account — the order is tracked with a signed,
      // expiring link. Stash the phone so a Paystack return can still open it.
      sessionStorage.setItem(`shop_order_phone_${order.referenceCode}`, customerPhone)

      if (paymentMethod === 'ONLINE') {
        try {
          const init = await shopApi.initPaystack(order.referenceCode)
          window.location.href = init.authorizationUrl
          return
        } catch (payError) {
          showToast(
            `${(payError as Error).message} Your order ${order.referenceCode} is saved — you can retry payment from the order page.`,
            'error',
          )
        }
      }

      showToast(
        `Order ${order.referenceCode} placed. Save your secure tracking link to follow it anytime.`,
        'success',
      )
      navigate(`/shop/orders/${order.referenceCode}?token=${encodeURIComponent(tracking.token)}`)
    } catch (error) {
      showToast((error as Error).message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !buyNowItem) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-night-950 pt-[72px] text-night-400">
        <LoadingSpinner className="h-8 w-8 text-gold-500" />
        <p className="text-sm">Loading checkout…</p>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="bg-night-950 pt-[112px] pb-20">
        <div className="container-app">
          <EmptyState
            icon={<PackageSearch className="h-10 w-10" />}
            title="Nothing to check out"
            description={
              isBuyNow
                ? 'Your Buy Now selection expired. Please choose the product again.'
                : 'Add products to your cart before checking out.'
            }
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
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-night-500"
          >
            <Link to="/shop" className="transition-colors hover:text-gold-400">Shop</Link>
            <span>/</span>
            {!buyNowItem && (
              <>
                <Link to="/shop/cart" className="transition-colors hover:text-gold-400">Cart</Link>
                <span>/</span>
              </>
            )}
            <span className="text-gold-400">Checkout</span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl text-night-50 sm:text-4xl">Secure Checkout</h1>
              <p className="mt-2 text-sm text-night-400">
                {buyNowItem
                  ? 'Buying this item now — your saved cart stays exactly as it is.'
                  : `${lines.length} product${lines.length === 1 ? '' : 's'} from ${new Set(lines.map((line) => line.vendorName)).size} seller${new Set(lines.map((line) => line.vendorName)).size === 1 ? '' : 's'}.`}
              </p>
            </div>
            {!customer && settings?.allowGuestCheckout !== false && (
              <p className="text-sm text-night-400">
                No account needed — after checkout we'll give you a secure link to track this order
                anytime.{' '}
                <Link to="/account/login" className="font-semibold text-gold-400 hover:text-gold-300">
                  Already have an account?
                </Link>
              </p>
            )}
          </div>

          {/* Progress */}
          <ol className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            {['Your details', 'Delivery or pickup', 'Payment'].map((label, index) => (
              <li key={label} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => index < step && setStep(index)}
                  className={cn('flex items-center gap-2', index < step ? 'cursor-pointer' : 'cursor-default')}
                >
                  <StepBadge index={index + 1} active={step === index} done={step > index} />
                  <span
                    className={cn(
                      'font-semibold',
                      step === index ? 'text-gold-300' : step > index ? 'text-emerald-300' : 'text-night-500',
                    )}
                  >
                    {label}
                  </span>
                </button>
                {index < 2 && <span className="hidden h-px w-8 bg-night-700 sm:block" />}
              </li>
            ))}
          </ol>

          <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              {/* Step 1 — contact */}
              <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <StepBadge index={1} active={step === 0} done={step > 0} />
                  <h2 className="font-display text-xl text-night-50">Your details</h2>
                </div>
                {step === 0 ? (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Full name">
                      <input
                        required
                        minLength={2}
                        autoComplete="name"
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        placeholder="Your full name"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Phone number">
                      <input
                        required
                        inputMode="tel"
                        minLength={7}
                        autoComplete="tel"
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        placeholder="0801 234 5678"
                        className={inputClass}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field
                        label="Email address"
                        hint="We send your receipt and order updates here. Required for card payments."
                      >
                        <input
                          type="email"
                          autoComplete="email"
                          value={customerEmail}
                          onChange={(event) => setCustomerEmail(event.target.value)}
                          placeholder="you@example.com"
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-night-300">
                    <span>
                      {customerName} · {customerPhone}
                      {customerEmail ? ` · ${customerEmail}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(0)}
                      className="text-xs font-semibold text-gold-400 hover:text-gold-300"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </section>

              {/* Step 2 — fulfilment */}
              <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <StepBadge index={2} active={step === 1} done={step > 1} />
                  <h2 className="font-display text-xl text-night-50">Delivery or pickup</h2>
                </div>

                {step === 1 ? (
                  <div className="mt-5 space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setFulfillment('DELIVERY')}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                          fulfillment === 'DELIVERY'
                            ? 'border-gold-500 bg-gold-500/10'
                            : 'border-night-700 hover:border-gold-500/40',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                            fulfillment === 'DELIVERY'
                              ? 'border-gold-500/50 bg-gold-500/15 text-gold-400'
                              : 'border-night-700 bg-night-900 text-night-400',
                          )}
                        >
                          <Truck className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-night-100">Home delivery</span>
                          <span className="mt-0.5 block text-xs text-night-500">
                            {deliveryFee === 0 ? 'Free delivery' : `${formatPrice(deliveryFee)} delivery fee`}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => pickupInfo?.enabled !== false && setFulfillment('PICKUP')}
                        disabled={pickupInfo?.enabled === false}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                          fulfillment === 'PICKUP'
                            ? 'border-gold-500 bg-gold-500/10'
                            : 'border-night-700 hover:border-gold-500/40',
                          pickupInfo?.enabled === false && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                            fulfillment === 'PICKUP'
                              ? 'border-gold-500/50 bg-gold-500/15 text-gold-400'
                              : 'border-night-700 bg-night-900 text-night-400',
                          )}
                        >
                          <Store className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-night-100">Store pickup</span>
                          <span className="mt-0.5 block text-xs text-night-500">
                            Collect at the studio — no delivery fee
                          </span>
                        </span>
                      </button>
                    </div>

                    {fulfillment === 'DELIVERY' ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Delivery address">
                            <input
                              required
                              minLength={5}
                              autoComplete="street-address"
                              value={deliveryAddress}
                              onChange={(event) => setDeliveryAddress(event.target.value)}
                              placeholder="House number, street, area"
                              className={inputClass}
                            />
                          </Field>
                        </div>
                        <Field label="City / area">
                          <input
                            value={deliveryLocation}
                            onChange={(event) => setDeliveryLocation(event.target.value)}
                            placeholder="e.g. Sabuwar Abuja, Kano"
                            list="shop-delivery-locations"
                            className={inputClass}
                          />
                          <datalist id="shop-delivery-locations">
                            {(pickupInfo?.deliveryLocations ?? settings?.deliveryLocations ?? []).map((location) => (
                              <option key={location} value={location} />
                            ))}
                          </datalist>
                        </Field>
                        <Field label="Delivery instructions (optional)">
                          <input
                            value={deliveryInstructions}
                            onChange={(event) => setDeliveryInstructions(event.target.value)}
                            placeholder="Landmark, gate colour, best time…"
                            className={inputClass}
                          />
                        </Field>
                        <div className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 text-xs text-sky-200">
                          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            Estimated delivery: within {estimateDays} business day{estimateDays === 1 ? '' : 's'} after
                            payment confirmation. You can track every update on your order page.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-4 sm:p-5">
                        <p className="flex items-center gap-2 text-sm font-semibold text-gold-300">
                          <Store className="h-4 w-4" /> Collect from
                        </p>
                        <p className="mt-2 text-sm font-semibold text-night-100">
                          {pickupInfo?.shopName ?? 'SAWABA Grooming Studio'}
                        </p>
                        <p className="mt-1 flex items-start gap-2 text-sm text-night-300">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                          {pickupInfo?.address || 'Unguwa Uku, Sabuwar Abuja, Kano, Nigeria'}
                        </p>
                        {pickupInfo?.phone && <p className="mt-1 text-sm text-night-300">{pickupInfo.phone}</p>}
                        <p className="mt-1 flex items-center gap-2 text-sm text-night-300">
                          <Clock className="h-4 w-4 text-gold-500" />
                          {pickupInfo?.hours ?? 'Mon – Sat, 9:00am – 7:00pm'}
                        </p>
                        <p className="mt-3 text-xs leading-relaxed text-night-400">
                          {pickupInfo?.instructions ??
                            'Bring your order number and pickup code. A staff member will confirm them and hand over your items.'}
                        </p>
                        {pickupInfo?.mapUrl && (
                          <a
                            href={pickupInfo.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-gold-400 underline hover:text-gold-300"
                          >
                            <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
                          </a>
                        )}
                        <p className="mt-3 rounded-lg border border-night-700 bg-night-900/70 p-3 text-xs text-night-300">
                          A unique pickup code is generated for your order once it is placed. Keep it safe — it is
                          checked when you collect.
                        </p>
                      </div>
                    )}

                    <Field label="Order note (optional)">
                      <input
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Anything else we should know?"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-night-300">
                    <span>
                      {fulfillment === 'PICKUP'
                        ? `Store pickup · ${pickupInfo?.shopName ?? 'SAWABA Grooming Studio'}`
                        : `Home delivery · ${deliveryAddress}${deliveryLocation ? `, ${deliveryLocation}` : ''}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs font-semibold text-gold-400 hover:text-gold-300"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </section>

              {/* Step 3 — payment */}
              <section className="rounded-2xl border border-night-800 bg-night-900/40 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <StepBadge index={3} active={step === 2} done={false} />
                  <h2 className="font-display text-xl text-night-50">Payment</h2>
                </div>

                {step === 2 ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {availableMethods.map((method) => (
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

                    {availableMethods.length === 0 && (
                      <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                        No payment method is available right now. Your order is not lost — please contact the studio
                        and we will complete it for you.
                      </p>
                    )}

                    {paymentMethod === 'ONLINE' && (
                      <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs leading-relaxed text-emerald-200">
                        You'll be redirected to Paystack to pay securely. We confirm your order only after Paystack
                        verifies the transaction on our server — never from the browser.
                      </p>
                    )}
                    {paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'OPAY' ? (
                      <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-4 sm:p-5">
                        <h3 className="flex items-center gap-2 font-display text-lg text-night-50">
                          {paymentMethod === 'OPAY' ? <Smartphone className="h-5 w-5 text-gold-500" /> : <Landmark className="h-5 w-5 text-gold-500" />}
                          {paymentMethod === 'OPAY' ? 'OPay payment' : 'Bank transfer payment'}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-night-400">
                          Pay the exact amount below to the studio's {paymentMethod === 'OPAY' ? 'OPay' : 'bank'} account.
                          Transfer the full amount, then upload your receipt and enter the transaction reference from
                          your order page — an administrator verifies every transfer before the order is confirmed.
                          Nothing is marked paid automatically.
                        </p>

                        <div className="mt-4 rounded-xl border border-night-800 bg-night-950/60 p-4 sm:p-5">
                          <dl className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Amount to pay</dt>
                              <dd className="mt-1 flex items-center justify-between gap-3">
                                <span className="font-display text-3xl text-gold-300">{formatPrice(total)}</span>
                                <CopyButton value={String(total)} label="Copy amount" />
                              </dd>
                            </div>
                            {paymentMethod === 'OPAY' ? (
                              <>
                                <div>
                                  <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">
                                    OPay account name
                                  </dt>
                                  <dd className="mt-1 text-sm text-night-100">
                                    {paymentOptions?.opayAccountName || '—'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">OPay number</dt>
                                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-lg font-bold tracking-wide text-gold-300">
                                      {paymentOptions?.opayAccountNumber || '—'}
                                    </span>
                                    {paymentOptions?.opayAccountNumber && (
                                      <CopyButton value={paymentOptions.opayAccountNumber} label="Copy number" />
                                    )}
                                  </dd>
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">Bank</dt>
                                  <dd className="mt-1 text-sm text-night-100">{paymentOptions?.bankName || '—'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">
                                    Account name
                                  </dt>
                                  <dd className="mt-1 text-sm text-night-100">{paymentOptions?.accountName || '—'}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] uppercase tracking-[0.14em] text-night-500">
                                    Account number
                                  </dt>
                                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-lg font-bold tracking-wide text-gold-300">
                                      {paymentOptions?.accountNumber || '—'}
                                    </span>
                                    {paymentOptions?.accountNumber && (
                                      <CopyButton value={paymentOptions.accountNumber} label="Copy number" />
                                    )}
                                  </dd>
                                </div>
                              </>
                            )}
                          </dl>

                          {(paymentOptions?.instructions || paymentOptions?.shopName) && (
                            <p className="mt-4 text-xs leading-relaxed text-night-400">
                              {paymentOptions?.instructions ??
                                `Please pay ${paymentOptions?.shopName ?? 'the studio'} via the account details above.`}
                            </p>
                          )}

                          <p className="mt-4 text-xs leading-relaxed text-night-400">
                            Once the order is placed, you will be able to upload your payment receipt and enter the
                            transaction reference on the order page — an administrator verifies every transfer before the
                            order is marked paid. Nothing is marked paid automatically from the browser.
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {paymentMethod === 'CASH' && (
                      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                        Pay cash when your order is delivered{fulfillment === 'PICKUP' ? ' or collected at the studio' : ''}.
                        The order is confirmed once payment is received.
                      </p>
                    )}

                    <div className="flex items-start gap-2 rounded-xl border border-night-800 bg-night-950/50 p-3 text-xs text-night-400">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                      <span>
                        Prices, stock and delivery fees are re-checked on our server when you place the order. If
                        anything changed you'll be told before you pay.
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="mt-4 text-xs font-semibold text-gold-400 hover:text-gold-300"
                  >
                    Continue to payment
                  </button>
                )}
              </section>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-night-300 hover:text-gold-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {step === 0 ? 'Back' : 'Previous step'}
                </button>
                {step < 2 && (
                  <Button type="button" variant="gold" size="md" onClick={goNext}>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="lg:col-span-2">
              <div className="sticky top-24 rounded-2xl border border-night-800 bg-night-900/60 p-5 sm:p-6">
                <h2 className="font-display text-xl text-night-50">Order summary</h2>
                <ul className="mt-4 space-y-3">
                  {lines.map((line) => (
                    <li key={line.key} className="flex items-start gap-3 text-sm">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-night-800 bg-night-950">
                        {line.image ? (
                          <img src={line.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-night-600">
                            <PackageSearch className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-night-200">{line.name}</p>
                        <p className="mt-0.5 text-[11px] text-night-500">
                          {line.vendorName} · × {line.quantity}
                          {line.variationLabel ? ` · ${line.variationLabel}` : ''}
                        </p>
                      </div>
                      <p className="shrink-0 text-night-100">{formatPrice(line.lineTotal)}</p>
                    </li>
                  ))}
                </ul>

                <dl className="mt-4 space-y-2.5 border-t border-night-800 pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-night-400">Subtotal</dt>
                    <dd className="text-night-100">{formatPrice(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-night-400">Delivery</dt>
                    <dd className="text-night-100">
                      {fulfillment === 'PICKUP' ? 'Pickup — free' : deliveryFee === 0 ? 'Free' : formatPrice(deliveryFee)}
                    </dd>
                  </div>
                  {fulfillment === 'DELIVERY' && (
                    <div className="flex justify-between">
                      <dt className="text-night-400">Estimated arrival</dt>
                      <dd className="text-night-300">~{estimateDays} day{estimateDays === 1 ? '' : 's'}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-4 flex items-center justify-between border-t border-night-800 pt-4">
                  <span className="text-sm font-semibold text-night-200">Total</span>
                  <span className="font-display text-2xl text-gold-400">{formatPrice(total)}</span>
                </div>

                {step === 2 ? (
                  <Button type="submit" variant="gold" size="lg" fullWidth className="mt-5" loading={submitting}>
                    {paymentMethod === 'ONLINE'
                      ? `Pay ${formatPrice(total)}`
                      : paymentMethod === 'CASH'
                        ? `Place order · ${formatPrice(total)}`
                        : `Place order · ${formatPrice(total)}`}
                  </Button>
                ) : (
                  <Button type="button" variant="gold" size="lg" fullWidth className="mt-5" onClick={goNext}>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}

                <p className="mt-3 text-center text-[11px] leading-relaxed text-night-500">
                  Secure checkout · your order number is issued the moment the order is placed.
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </PageTransition>
  )
}
