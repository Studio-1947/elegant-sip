import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getVariant, getProduct } from '../data/products'

export interface CartItem {
  /** Product id */
  id: string
  /** Variant size label, e.g. "50 g tin" */
  size: string
  name: string
  /** Unit price for this variant — always re-validated against the catalog. */
  price: number
  imageSrc: string
  quantity: number
}

interface CartContextType {
  cart: CartItem[]
  addToCart: (product: { id: string; name: string; price: number; imageSrc: string; size: string }, quantity: number) => void
  updateQuantity: (id: string, size: string, quantity: number) => void
  removeFromCart: (id: string, size: string) => void
  clearCart: () => void
  cartCount: number
  cartTotal: number
  /* Wishlist */
  wishlist: string[]
  toggleWishlist: (id: string) => void
  isWishlisted: (id: string) => boolean
  /* Coupons */
  coupon: string | null
  applyCoupon: (code: string) => boolean
  removeCoupon: () => void
  discount: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const COUPONS: Record<string, number> = {
  SIP10: 0.1,
  WELCOME10: 0.1,
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Re-validate a stored cart against the catalog: drop items whose product or
 * variant no longer exists, snap prices back to the catalog (localStorage is
 * user-editable and must never be the price of record), migrate pre-variant
 * items to the default variant, and clamp quantities to available stock.
 */
function revalidateCart(stored: Partial<CartItem>[]): CartItem[] {
  const seen = new Set<string>()
  const valid: CartItem[] = []
  for (const item of stored) {
    if (!item.id) continue
    const product = getProduct(item.id)
    if (!product) continue
    const variant = (item.size && getVariant(item.id, item.size)) || product.variants[0]
    if (!variant || variant.stock <= 0) continue
    const key = `${item.id}__${variant.size}`
    if (seen.has(key)) continue
    seen.add(key)
    const quantity = Math.min(Math.max(1, Math.floor(item.quantity ?? 1)), variant.stock)
    valid.push({
      id: product.id,
      size: variant.size,
      name: product.name,
      price: variant.price,
      imageSrc: product.imageSrc,
      quantity,
    })
  }
  return valid
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() =>
    revalidateCart(safeParse<Partial<CartItem>[]>(localStorage.getItem('elegant_sip_cart'), [])),
  )
  const [wishlist, setWishlist] = useState<string[]>(() =>
    safeParse<string[]>(localStorage.getItem('elegant_sip_wishlist'), []),
  )
  const [coupon, setCoupon] = useState<string | null>(() =>
    safeParse<string | null>(localStorage.getItem('elegant_sip_coupon'), null),
  )

  useEffect(() => {
    localStorage.setItem('elegant_sip_cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    localStorage.setItem('elegant_sip_wishlist', JSON.stringify(wishlist))
  }, [wishlist])

  useEffect(() => {
    localStorage.setItem('elegant_sip_coupon', JSON.stringify(coupon))
  }, [coupon])

  const stockFor = (id: string, size: string) => getVariant(id, size)?.stock ?? 0

  const addToCart = (product: { id: string; name: string; price: number; imageSrc: string; size: string }, quantity: number) => {
    const stock = stockFor(product.id, product.size)
    if (stock <= 0) return
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id && item.size === product.size)
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id && item.size === product.size
            ? { ...item, quantity: Math.min(item.quantity + quantity, stock) }
            : item
        )
      }
      return [...prevCart, { ...product, quantity: Math.min(quantity, stock) }]
    })
  }

  const updateQuantity = (id: string, size: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id, size)
      return
    }
    const stock = stockFor(id, size)
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id && item.size === size ? { ...item, quantity: Math.min(quantity, stock) } : item
      )
    )
  }

  const removeFromCart = (id: string, size: string) => {
    setCart((prevCart) => prevCart.filter((item) => !(item.id === id && item.size === size)))
  }

  const clearCart = () => setCart([])

  const toggleWishlist = (id: string) => {
    setWishlist((prev) => {
      const has = prev.includes(id)
      return has ? prev.filter((w) => w !== id) : [...prev, id]
    })
  }

  const isWishlisted = (id: string) => wishlist.includes(id)

  const applyCoupon = (code: string): boolean => {
    const normalized = code.trim().toUpperCase()
    if (COUPONS[normalized] !== undefined) {
      setCoupon(normalized)
      return true
    }
    return false
  }

  const removeCoupon = () => setCoupon(null)

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0)
  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const discount = coupon && COUPONS[coupon] ? Math.round(cartTotal * COUPONS[coupon] * 100) / 100 : 0

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        cartCount,
        cartTotal,
        wishlist,
        toggleWishlist,
        isWishlisted,
        coupon,
        applyCoupon,
        removeCoupon,
        discount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
