import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { shopApi, type CartView } from '../api/shop'

interface ShopCartContextValue {
  cart: CartView | null
  loading: boolean
  adding: boolean
  refresh: () => Promise<void>
  add: (input: {
    productId: number
    variationId?: number | null
    quantity?: number
  }) => Promise<CartView>
  update: (itemId: number, quantity: number) => Promise<CartView>
  remove: (itemId: number) => Promise<CartView>
  clear: () => Promise<void>
}

const ShopCartContext = createContext<ShopCartContextValue | null>(null)

/**
 * Global cart state — backed by the SERVER cart (guest token in localStorage,
 * customer JWT when signed in) so prices/stock always reflect the database.
 */
export function ShopCartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartView | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const next = await shopApi.getCart()
      setCart(next)
    } catch {
      // Offline or server down — keep whatever we had; the cart page shows errors.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const add = useCallback(
    async (input: { productId: number; variationId?: number | null; quantity?: number }) => {
      setAdding(true)
      try {
        const next = await shopApi.addToCart(input)
        setCart(next)
        return next
      } finally {
        setAdding(false)
      }
    },
    [],
  )

  const update = useCallback(async (itemId: number, quantity: number) => {
    const next = await shopApi.updateCartItem(itemId, quantity)
    setCart(next)
    return next
  }, [])

  const remove = useCallback(async (itemId: number) => {
    const next = await shopApi.removeCartItem(itemId)
    setCart(next)
    return next
  }, [])

  const clear = useCallback(async () => {
    await shopApi.clearCart()
    setCart((current) => (current ? { ...current, items: [], subtotal: 0, itemCount: 0 } : current))
  }, [])

  const value = useMemo(
    () => ({ cart, loading, adding, refresh, add, update, remove, clear }),
    [cart, loading, adding, refresh, add, update, remove, clear],
  )

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>
}

export function useShopCart(): ShopCartContextValue {
  const ctx = useContext(ShopCartContext)
  if (!ctx) throw new Error('useShopCart must be used within ShopCartProvider')
  return ctx
}
