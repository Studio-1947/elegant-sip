import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface CartItem {
  id: string
  name: string
  price: number
  imageSrc: string
  quantity: number
}

interface CartContextType {
  cart: CartItem[]
  addToCart: (product: { id: string; name: string; price: number; imageSrc: string }, quantity: number) => void
  updateQuantity: (id: string, quantity: number) => void
  removeFromCart: (id: string) => void
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() =>
    safeParse<CartItem[]>(localStorage.getItem('elegant_sip_cart'), []),
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

  const addToCart = (product: { id: string; name: string; price: number; imageSrc: string }, quantity: number) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id)
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        )
      }
      return [...prevCart, { ...product, quantity }]
    })
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
      return
    }
    setCart((prevCart) =>
      prevCart.map((item) => (item.id === id ? { ...item, quantity } : item))
    )
  }

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id))
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
