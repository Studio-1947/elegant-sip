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
  /** Additional gallery images — the card shows switcher dots when present. */
  images?: string[]
  category: string
  /** Short flavor chips shown on the card, e.g. ["Floral", "Muscatel"]. */
  tastingNotes?: string[]
  /** Cup body on a 1 (light) to 5 (full) scale — drives the card's meter. */
  bodyLevel?: number
  /** Harvest badge on the card, e.g. "Spring 2026 Harvest". */
  harvestLabel?: string
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
      "The first pluck of spring, whole leaf — bright, floral, and carrying the muscatel character Darjeeling first flush is famous for. In three quality tiers.",
    longDescription:
      "The first flush is a race against the sun: leaves picked in the earliest weeks after winter dormancy, when the bush has stored a season's worth of aromatics. Grown above 3,500 ft in the Rungbong Valley, withered long and fired light, this is the grade that brews pale gold rather than red. Choose your tier — Basic, Classic, or Premium — each whole leaf, light in the cup, and best drunk without milk so nothing stands between you and the spring.",
    imageSrc: "/morningdew.webp",
    category: "First Flush",
    tastingNotes: ["Floral", "Muscatel", "Bright finish"],
    bodyLevel: 2,
    harvestLabel: "Spring 2026 Harvest",
    variants: [
      { size: "Basic · 100 g", price: 600, stock: 20 },
      { size: "Classic · 100 g", price: 600, stock: 20 },
      { size: "Premium · 100 g", price: 1000, stock: 20 },
    ],
    origin: {
      origin: "Darjeeling, West Bengal, India",
      estate: "Gopaldhara",
      elevation: "3,500–7,000 ft",
      harvest: "First flush, spring 2026",
      cultivar: "China bush (Camellia sinensis var. sinensis)",
    },
    flavorProfile: { strength: 2, astringency: 2, sweetness: 4, floral: 5, caffeine: 3 },
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
      "Broken-leaf Darjeeling first flush — the same spring character with a quicker, stronger brew.",
    longDescription:
      "Same garden, same pluck, smaller cut. Breaking the leaf exposes more surface to the water, so a broken-leaf first flush gives up its colour and briskness in half the time a whole leaf takes. You keep the muscatel note and trade a little of the floral top end for body — the everyday Darjeeling for people who find whole leaf too delicate for a morning cup.",
    imageSrc: "/origin.webp",
    category: "First Flush",
    tastingNotes: ["Muscatel", "Brisk", "Strong cup"],
    bodyLevel: 3,
    harvestLabel: "Spring 2026 Harvest",
    variants: [
      { size: "Basic · 100 g", price: 500, stock: 20 },
      { size: "Classic · 100 g", price: 600, stock: 20 },
      { size: "Premium · 100 g", price: 700, stock: 20 },
    ],
    origin: {
      origin: "Darjeeling, West Bengal, India",
      estate: "Gopaldhara",
      elevation: "3,500–7,000 ft",
      harvest: "First flush, spring 2026",
      cultivar: "China bush (Camellia sinensis var. sinensis)",
    },
    flavorProfile: { strength: 3, astringency: 3, sweetness: 3, floral: 3, caffeine: 4 },
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
      "A robust mixed broken grade from the Darjeeling spring harvest — strong, brisk, and happy to take milk.",
    longDescription:
      "From the warmer, lower slopes below Kurseong, where the bush wakes earlier and grows faster. That makes a bolder, maltier cup with more colour and less of the ethereal floral note you get at altitude — which is exactly what you want in a tea that has to stand up to milk and sugar. The most versatile grade we sell, and the best value per cup.",
    imageSrc: "/origin.webp",
    category: "First Flush",
    tastingNotes: ["Malty", "Strong", "Milk-friendly"],
    bodyLevel: 4,
    harvestLabel: "Spring 2026 Harvest",
    variants: [
      { size: "Basic · 100 g", price: 150, stock: 20 },
      { size: "Premium · 100 g", price: 300, stock: 20 },
    ],
    origin: {
      origin: "Darjeeling, West Bengal, India",
      estate: "Rohini",
      elevation: "1,500–4,500 ft",
      harvest: "First flush, spring 2026",
      cultivar: "Clonal (Camellia sinensis var. sinensis)",
    },
    flavorProfile: { strength: 4, astringency: 3, sweetness: 3, floral: 2, caffeine: 4 },
    brewingGuide: {
      temperature: "212°F / 100°C",
      time: "3–4 minutes",
      steeps: "2",
      leafAmount: "1 tsp per 8 oz",
      notes: "A full boil and a longer steep bring out the malty depth — this grade takes milk happily.",
    },
  },
  {
    id: "first-flush-fannings",
    name: "First Flush Fannings",
    price: 100,
    description:
      "Fine Darjeeling first flush fannings — fast-brewing and full-strength. The working tea of the Darjeeling hills.",
    longDescription:
      "Fannings are the finest cut: the smallest particles sifted from the same first flush pluck. More surface area means near-instant extraction, a deep coppery colour, and a cup with real backbone. This is not a contemplative tea and does not pretend to be — it is the grade the hills actually drink every morning, and it makes the best masala chai in the catalogue.",
    imageSrc: "/origin.webp",
    category: "First Flush",
    tastingNotes: ["Bold", "Fast-brewing", "Chai-ready"],
    bodyLevel: 5,
    harvestLabel: "Spring 2026 Harvest",
    variants: [
      { size: "Basic · 100 g", price: 100, stock: 20 },
      { size: "Premium · 100 g", price: 200, stock: 20 },
    ],
    origin: {
      origin: "Darjeeling, West Bengal, India",
      estate: "Rohini",
      elevation: "1,500–4,500 ft",
      harvest: "First flush, spring 2026",
      cultivar: "Clonal (Camellia sinensis var. sinensis)",
    },
    flavorProfile: { strength: 5, astringency: 4, sweetness: 2, floral: 1, caffeine: 5 },
    brewingGuide: {
      temperature: "212°F / 100°C",
      time: "2–3 minutes",
      steeps: "1–2",
      leafAmount: "1 tsp per 8 oz",
      notes: "Fannings brew fast and strong — watch the clock, or lean in and make masala chai.",
    },
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
    tastingNotes: ["Fruity", "Muscatel", "Deep"],
    bodyLevel: 4,
    harvestLabel: "Summer 2026 Harvest",
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
    tastingNotes: ["Mellow", "Coppery", "Smooth"],
    bodyLevel: 3,
    harvestLabel: "Autumn 2026 Harvest",
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
