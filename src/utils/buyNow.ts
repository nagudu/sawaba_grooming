/**
 * "Buy Now" payload.
 *
 * Buy Now must check out ONLY the selected product — it must never consume or
 * modify the shopper's saved cart. The selection is held in sessionStorage for
 * the single checkout visit; the server re-prices it from the database, so the
 * display snapshot below is never trusted for money.
 */
export interface BuyNowItem {
  productId: number
  variationId: number | null
  quantity: number
  /** Display-only snapshot — the server recalculates every amount. */
  name: string
  slug: string
  image: string | null
  unitPrice: number
  variationLabel: string | null
  vendorName: string
  stock: number
}

const KEY = 'sawaba_buy_now_item'

export function setBuyNow(item: BuyNowItem): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(item))
  } catch {
    // Private-mode storage failures must not block the purchase flow.
  }
}

export function getBuyNow(): BuyNowItem | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BuyNowItem
    if (!parsed || typeof parsed.productId !== 'number' || !(parsed.quantity > 0)) return null
    return parsed
  } catch {
    return null
  }
}

export function clearBuyNow(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
