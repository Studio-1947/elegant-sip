/* ────────────────────────────────────────────────────────────────────────────
 * Elegant Sip — product catalogue: types, products, and catalogue helpers.
 * Site content (reviews, gardens, testimonials, FAQs, journal, quiz) lives in
 * content.ts and is re-exported below so consumers import from one place.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface TeaOrigin {
  origin: string
  estate: string
  elevation: string
  harvest: string
  cultivar: string
}

export interface FlavorProfile {
  strength: number
  astringency: number
  sweetness: number
  floral: number
  caffeine: number
}

export interface BrewingGuide {
  temperature: string
  time: string
  steeps: string
  leafAmount: string
  notes: string
}

export interface Review {
  id: string
  author: string
  rating: number
  date: string
  text: string
  verified?: boolean
}

export interface ProductVariant {
  /** Display label, e.g. "Classic · 100 g" */
  size: string
  price: number
  /** Units left in the current lot; 0 renders as sold out. */
  stock: number
}

export interface Product {
  id: string
  name: string
  /** Base "from" price — the lowest variant price. */
  price: number
  /** Catalogue drafts render as "Coming Soon" and cannot be purchased. Defaults to active. */
  status?: 'active' | 'coming-soon'
  compareAtPrice?: number
  description: string
  longDescription?: string
  imageSrc: string
  category: string
  variants: ProductVariant[]
  origin?: TeaOrigin
  flavorProfile?: FlavorProfile
  brewingGuide?: BrewingGuide
}

/* ── Products ─────────────────────────────────────────────────────────────── */

export const PRODUCTS: Product[] = [
  /* ── First Flush (Black Tea) ── */
  {
    id: "first-flush-whole-leaf",
    name: "First Flush Whole Leaf",
    price: 600,
    description:
      "The first pluck of spring, whole leaf — bright, floral, and carrying the muscatel character Darjeeling's first flush is famous for. Available in three quality tiers.",
    longDescription:
      "The first flush is a race against the sun: leaves picked in the earliest weeks after winter dormancy, when the plant has stored a season's worth of aromatics. Choose your tier — Basic, Classic, or Premium — each whole leaf, light in the cup, and best drunk without milk so nothing stands between you and the spring.",
    imageSrc: "/morningdew.webp",
    category: "First Flush",
    variants: [
      { size: "Basic · 100 g", price: 600, stock: 20 },
      { size: "Classic · 100 g", price: 600, stock: 20 },
      { size: "Premium · 100 g", price: 1000, stock: 20 },
    ],
    brewingGuide: {
      temperature: "194°F / 90°C",
      time: "3–4 minutes",
      steeps: "2–3",
      leafAmount: "1 tsp per 8 oz",
      notes: "Skip the milk — first flush is prized for its bright muscatel aromatics, and a slightly cooler pour keeps them intact.",
    },
  },
  {
    id: "first-flush-broken-leaf",
    name: "First Flush Broken Leaf",
    price: 500,
    description:
      "Broken-leaf first flush — the same spring character with a quicker, stronger brew.",
    imageSrc: "/origin.webp",
    category: "First Flush",
    variants: [
      { size: "Basic · 100 g", price: 500, stock: 20 },
      { size: "Classic · 100 g", price: 600, stock: 20 },
      { size: "Premium · 100 g", price: 700, stock: 20 },
    ],
    brewingGuide: {
      temperature: "203°F / 95°C",
      time: "2–3 minutes",
      steeps: "2",
      leafAmount: "1 tsp per 8 oz",
      notes: "Broken leaf brews faster and stronger than whole leaf — shorten the steep rather than the leaf.",
    },
  },
  {
    id: "first-flush-broken-mixed",
    name: "First Flush Broken Mixed",
    price: 150,
    description:
      "A robust mixed broken grade from the spring harvest — strong, brisk, and happy to take milk.",
    imageSrc: "/origin.webp",
    category: "First Flush",
    variants: [
      { size: "Basic · 100 g", price: 150, stock: 20 },
      { size: "Premium · 100 g", price: 300, stock: 20 },
    ],
  },
  {
    id: "first-flush-fannings",
    name: "First Flush Fannings",
    price: 100,
    description:
      "Fine first flush fannings — fast-brewing and full-strength. The working tea of the Darjeeling hills.",
    imageSrc: "/origin.webp",
    category: "First Flush",
    variants: [
      { size: "Basic · 100 g", price: 100, stock: 20 },
      { size: "Premium · 100 g", price: 200, stock: 20 },
    ],
  },

  /* ── Second Flush (Black Tea) — arriving after the summer pluck ── */
  {
    id: "second-flush",
    name: "Second Flush",
    price: 0,
    status: "coming-soon",
    description:
      "The summer pluck brings the deeper, fruitier side of Darjeeling. The lots are still with the garden — arriving after the summer harvest.",
    imageSrc: "/summerbreeze.webp",
    category: "Second Flush",
    variants: [{ size: "100 g", price: 0, stock: 0 }],
  },

  /* ── Autumn (Third) Flush — arriving after the autumn pluck ── */
  {
    id: "autumn-flush",
    name: "Third Flush",
    price: 0,
    status: "coming-soon",
    description:
      "The third pluck of the year rounds things out with a mellow, coppery cup. Arriving after the autumn harvest.",
    imageSrc: "/origin.webp",
    category: "Third Flush",
    variants: [{ size: "100 g", price: 0, stock: 0 }],
  },
]

export const getProduct = (id: string | undefined): Product | undefined =>
  PRODUCTS.find((p) => p.id === id)

export const getVariant = (productId: string, size: string): ProductVariant | undefined =>
  getProduct(productId)?.variants.find((v) => v.size === size)

/** First purchasable variant, falling back to the base variant when everything is sold out. */
export const getDefaultVariant = (product: Product): ProductVariant =>
  product.variants.find((v) => v.stock > 0) ?? product.variants[0]

export const isInStock = (product: Product): boolean =>
  product.variants.some((v) => v.stock > 0)

/* ── Site content (reviews, gardens, testimonials, FAQs, journal, quiz) ───── */

export * from './content'
