import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getProduct, getVariant } from '../data/products'
import { api, type CartAdjustment, type CartLine, type PricingQuote } from '../lib/api'
import { useAuth } from './AuthContext'

/* ────────────────────────────────────────────────────────────────────────────
 * Cart.
 *
 * The LINES are local — which tea, which tier, how many — because that is the
 * customer's own working state and should survive a refresh without a server
 * round-trip.
 *
 * The MONEY is not. Every total shown at checkout comes from
 * /v1/pricing/quote. The coupon list is no longer in this file at all; the
 * server decides whether a code applies. What is stored locally is only ever a
 * hint, and it is re-validated against the catalogue on hydrate and against the
 * server before anything is paid.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CartItem {
  /*
   * The product SLUG, not the database id.
   *
   * Named explicitly because it used to be called `id`, and callers passed
   * `product.id` — which became a UUID when the catalogue moved to the API.
   * The cart then sent UUIDs where the server expected slugs and every
   * checkout failed with "no longer available". A name that cannot be
   * misread is the fix.
   */
  productSlug: string
  /** Variant size label, e.g. "Classic · 100 g". */
  size: string
  name: string
  /** Unit price in paise — display only, re-priced by the server. */
  price: number
  imageSrc: string
  quantity: number
}

interface CartContextType {
  cart: CartItem[]
  addToCart: (
    product: { productSlug: string; name: string; price: number; imageSrc: string; size: string },
    quantity: number,
  ) => void
  updateQuantity: (productSlug: string, size: string, quantity: number) => void
  removeFromCart: (productSlug: string, size: string) => void
  clearCart: () => void
  cartCount: number
  cartTotal: number
  /** Lines the server changed or dropped on the last quote. Show these. */
  adjustments: CartAdjustment[]
  /* Wishlist */
  /** Product slugs. */
  wishlist: string[]
  toggleWishlist: (productSlug: string) => void
  isWishlisted: (productSlug: string) => boolean
  /* Coupons — validated server-side */
  coupon: string | null
  couponError: string | null
  applyCoupon: (code: string) => Promise<boolean>
  removeCoupon: () => void
  discount: number
  /** Authoritative pricing from the server; null until the first quote lands. */
  quote: PricingQuote | null
  quoting: boolean
  /** Cart lines in the shape the API expects. */
  toCartLines: () => CartLine[]
}

const CartContext = createContext<CartContextType | undefined>(undefined)

/**
 * Parse a localStorage value, falling back whenever it is absent, malformed,
 * or the wrong *shape*. `JSON.parse` succeeding is not enough — localStorage is
 * user-editable, so `{"a":1}` where an array is expected must not reach React.
 */
function safeParse<T>(raw: string | null, fallback: T, isValid: (value: unknown) => boolean): T {
  if (!raw) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

const isArrayOfStrings = (v: unknown): boolean => Array.isArray(v) && v.every((e) => typeof e === 'string')
const isObjectArray = (v: unknown): boolean =>
  Array.isArray(v) && v.every((e) => typeof e === 'object' && e !== null)
const isCouponValue = (v: unknown): boolean => v === null || typeof v === 'string'

/**
 * Re-validate a stored cart against the catalogue snapshot: drop dead products
 * and variants, snap prices back, clamp quantities to stock. localStorage is
 * user-editable and is never the price of record.
 */
function revalidateCart(stored: Partial<CartItem>[]): CartItem[] {
  if (!Array.isArray(stored)) return []
  const seen = new Set<string>()
  const valid: CartItem[] = []
  for (const item of stored) {
    if (!item || typeof item !== 'object') continue
    /* Carts saved before this rename stored the key as `id`. Read either, so
       an existing customer's cart survives the upgrade. */
    const slug = item.productSlug ?? (item as { id?: string }).id
    if (!slug) continue
    const product = getProduct(slug)
    if (!product || product.status === 'coming-soon') continue
    const variant =
      (item.size && getVariant(slug, item.size)) ||
      product.variants.find((v) => v.stock > 0) ||
      product.variants[0]
    if (!variant || variant.stock <= 0) continue

    const key = `${product.slug}__${variant.size}`
    if (seen.has(key)) continue
    seen.add(key)

    valid.push({
      productSlug: product.slug,
      size: variant.size,
      name: product.name,
      price: variant.price,
      imageSrc: product.imageSrc,
      quantity: Math.min(Math.max(1, Math.floor(Number(item.quantity) || 1)), variant.stock),
    })
  }
  return valid
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [cart, setCart] = useState<CartItem[]>(() =>
    revalidateCart(safeParse<Partial<CartItem>[]>(localStorage.getItem('elegant_sip_cart'), [], isObjectArray)),
  )
  const [wishlist, setWishlist] = useState<string[]>(() =>
    safeParse<string[]>(localStorage.getItem('elegant_sip_wishlist'), [], isArrayOfStrings),
  )
  const [coupon, setCoupon] = useState<string | null>(() =>
    safeParse<string | null>(localStorage.getItem('elegant_sip_coupon'), null, isCouponValue),
  )
  const [couponError, setCouponError] = useState<string | null>(null)
  const [quote, setQuote] = useState<PricingQuote | null>(null)
  const [quoting, setQuoting] = useState(false)

  // Skip the write on mount: hydrating state and immediately persisting it back
  // is three redundant localStorage writes on every page load.
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    localStorage.setItem('elegant_sip_cart', JSON.stringify(cart))
    localStorage.setItem('elegant_sip_wishlist', JSON.stringify(wishlist))
    localStorage.setItem('elegant_sip_coupon', JSON.stringify(coupon))
  }, [cart, wishlist, coupon])

  const toCartLines = useCallback(
    (): CartLine[] => cart.map((i) => ({ productSlug: i.productSlug, variantSize: i.size, quantity: i.quantity })),
    [cart],
  )

  /*
   * Ask the server to price the cart whenever it changes.
   *
   * Debounced so dragging a quantity stepper does not fire a request per click,
   * and guarded by a sequence number so a slow earlier response can never
   * overwrite a newer one.
   */
  const sequence = useRef(0)
  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null)
      return
    }
    const mine = ++sequence.current
    setQuoting(true)
    const timer = window.setTimeout(() => {
      void api.pricing
        .quote({
          items: cart.map((i) => ({ productSlug: i.productSlug, variantSize: i.size, quantity: i.quantity })),
          ...(coupon ? { couponCode: coupon } : {}),
        })
        .then((result) => {
          if (mine !== sequence.current) return
          setQuote(result)
          setCouponError(result.couponError)
          // The server rejected the stored code — stop claiming it applies.
          if (coupon && !result.coupon) setCoupon(null)
        })
        .catch(() => {
          if (mine === sequence.current) setQuote(null)
        })
        .finally(() => {
          if (mine === sequence.current) setQuoting(false)
        })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [cart, coupon])

  /* Merge a guest wishlist into the account on sign-in, then follow the server. */
  const mergedWishlist = useRef(false)
  useEffect(() => {
    if (!user) {
      mergedWishlist.current = false
      return
    }
    if (mergedWishlist.current) return
    mergedWishlist.current = true
    void (async () => {
      try {
        const { productSlugs: remote } = await api.wishlist.get()
        const merged = [...new Set([...remote, ...wishlist])]
        const { productSlugs } = await api.wishlist.replace(merged)
        setWishlist(productSlugs)
      } catch {
        // Offline or unauthenticated — keep the local list.
      }
    })()
  }, [user, wishlist])

  const addToCart = useCallback(
    (
      product: { productSlug: string; name: string; price: number; imageSrc: string; size: string },
      quantity: number,
    ) => {
      const variant = getVariant(product.productSlug, product.size)
      const cap = variant?.stock ?? quantity
      setCart((prev) => {
        const existing = prev.find((i) => i.productSlug === product.productSlug && i.size === product.size)
        if (existing) {
          return prev.map((i) =>
            i.productSlug === product.productSlug && i.size === product.size
              ? { ...i, quantity: Math.min(i.quantity + quantity, cap) }
              : i,
          )
        }
        return [...prev, { ...product, quantity: Math.min(quantity, cap) }]
      })
    },
    [],
  )

  const updateQuantity = useCallback((productSlug: string, size: string, quantity: number) => {
    const stock = getVariant(productSlug, size)?.stock ?? 0
    // Clamp first, then decide: clamping after the ≤0 check could strand a line
    // at quantity 0 when the variant has gone out of stock.
    const next = Math.min(Math.floor(quantity), stock)
    if (next <= 0) {
      setCart((prev) => prev.filter((i) => !(i.productSlug === productSlug && i.size === size)))
      return
    }
    setCart((prev) =>
      prev.map((i) => (i.productSlug === productSlug && i.size === size ? { ...i, quantity: next } : i)),
    )
  }, [])

  const removeFromCart = useCallback((productSlug: string, size: string) => {
    setCart((prev) => prev.filter((i) => !(i.productSlug === productSlug && i.size === size)))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setCoupon(null)
    setQuote(null)
  }, [])

  const toggleWishlist = useCallback(
    (productSlug: string) => {
      setWishlist((prev) => {
        const next = prev.includes(productSlug)
          ? prev.filter((p) => p !== productSlug)
          : [...prev, productSlug]
        // Fire-and-forget: a signed-in customer's list follows them, but a
        // failed sync must not block the interaction.
        if (user) void api.wishlist.replace(next).catch(() => {})
        return next
      })
    },
    [user],
  )

  const isWishlisted = useCallback((productSlug: string) => wishlist.includes(productSlug), [wishlist])

  /** Validated by the server — the storefront no longer knows any codes. */
  const applyCoupon = useCallback(
    async (code: string): Promise<boolean> => {
      const normalized = code.trim().toUpperCase()
      if (!normalized) return false
      const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0)
      try {
        const result = await api.pricing.validateCoupon(normalized, subtotal)
        if (result.valid) {
          setCoupon(normalized)
          setCouponError(null)
          return true
        }
        setCouponError(result.message ?? `"${normalized}" is not a valid code.`)
        return false
      } catch {
        setCouponError('We could not check that code just now. Please try again.')
        return false
      }
    },
    [cart],
  )

  const removeCoupon = useCallback(() => {
    setCoupon(null)
    setCouponError(null)
  }, [])

  const cartCount = cart.reduce((a, i) => a + i.quantity, 0)
  // Optimistic subtotal for instant feedback; the quote is authoritative.
  const cartTotal = quote?.subtotal ?? cart.reduce((a, i) => a + i.price * i.quantity, 0)
  const discount = quote?.discount ?? 0

  const value = useMemo(
    () => ({
      cart,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      cartCount,
      cartTotal,
      adjustments: quote?.adjustments ?? [],
      wishlist,
      toggleWishlist,
      isWishlisted,
      coupon,
      couponError,
      applyCoupon,
      removeCoupon,
      discount,
      quote,
      quoting,
      toCartLines,
    }),
    [
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
      couponError,
      applyCoupon,
      removeCoupon,
      discount,
      quote,
      quoting,
      toCartLines,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within a CartProvider')
  return context
}
