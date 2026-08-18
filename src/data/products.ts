/* ────────────────────────────────────────────────────────────────────────────
 * Elegant Sip — single source of truth for all shop + content data.
 * Products, reviews, testimonials, FAQs, and journal articles
 * all live here so the shop, quiz, cart, and pages can never drift apart.
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
  /** Display label, e.g. "50 g tin" */
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
      { size: "Basic · 100 g", price: 1000, stock: 20 },
      { size: "Classic · 100 g", price: 600, stock: 20 },
      { size: "Premium · 100 g", price: 600, stock: 20 },
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
    price: 700,
    description:
      "Broken-leaf first flush — the same spring character with a quicker, stronger brew.",
    imageSrc: "/origin.webp",
    category: "First Flush",
    variants: [{ size: "100 g", price: 700, stock: 20 }],
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
    price: 300,
    description:
      "A robust mixed broken grade from the spring harvest — strong, brisk, and happy to take milk.",
    imageSrc: "/origin.webp",
    category: "First Flush",
    variants: [{ size: "100 g", price: 300, stock: 20 }],
  },
  {
    id: "first-flush-fannings",
    name: "First Flush Fannings",
    price: 200,
    description:
      "Fine first flush fannings — fast-brewing and full-strength. The working tea of the Darjeeling hills.",
    imageSrc: "/origin.webp",
    category: "First Flush",
    variants: [{ size: "100 g", price: 200, stock: 20 }],
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

/* ── Reviews ──────────────────────────────────────────────────────────────── */

// New catalogue starts unreviewed — customer reviews accumulate via the
// product-page review form (see lib/localReviews.ts).
export const REVIEWS: Record<string, Review[]> = {}

export const getReviews = (id: string | undefined): Review[] =>
  id ? REVIEWS[id] ?? [] : []

export const getRating = (id: string | undefined): { average: number; count: number } => {
  const reviews = getReviews(id)
  if (reviews.length === 0) return { average: 0, count: 0 }
  const average = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
  return { average: Math.round(average * 10) / 10, count: reviews.length }
}

/* ── Gardens (origin profiles — "the garden is the brand") ────────────────── */

export interface Garden {
  id: string
  name: string
  region: string
  elevation: string
  imageSrc: string
  story: string[]
  productIds: string[]
}

export const GARDENS: Garden[] = [
  {
    id: "wuyi-rock-garden",
    name: "Wuyi Rock Garden",
    region: "Wuyi Mountains, Fujian",
    elevation: "3,200 ft",
    imageSrc: "/origin.webp",
    story: [
      "The Wuyi Mountains are a UNESCO landscape of sheer cliffs and mineral-rich rocky soil — the birthplace of oolong itself. Tea bushes here grow in narrow gorges where reflected warmth from the rock walls and constant mist create the slow growth that concentrates flavor.",
      "Our partner plots sit at 3,200 feet, planted with Dahongpao cultivar bushes. After the spring pluck, the leaves are withered over charcoal and slow-roasted in small batches — the craft behind Ember Charm's cinnamon-and-cacao depth and the mineral 'yan yun' finish that oolong lovers chase.",
    ],
    productIds: [],
  },
  {
    id: "cloud-mist-gardens",
    name: "Cloud Mist Gardens",
    region: "Hengxian, Guangxi",
    elevation: "2,800 ft",
    imageSrc: "/craft.webp",
    story: [
      "Hengxian is the jasmine capital of the world, and Cloud Mist Gardens is where our green tea and its scenting flowers grow within sight of each other. The garden picks only on dewy mornings, before sunrise, when the leaf is at its most delicate.",
      "Morning Dew is scented here the traditional way: fresh night-blooming jasmine layered with the tea over three consecutive nights, never sprayed, never flavored. The result is a leaf that carries the garden's morning into your cup.",
    ],
    productIds: [],
  },
  {
    id: "white-tea-valley",
    name: "White Tea Valley",
    region: "Fuding, Fujian",
    elevation: "1,800 ft",
    imageSrc: "/experience.webp",
    story: [
      "Fuding is the historic home of white tea, where the Fuding Fada cultivar grows fat, downy buds prized for Bai Mu Dan. The valley's tea is among the least processed in the world — withered in the sun until it simply is what it is.",
      "Summer Breeze starts here as classic white peony, then meets organic lemongrass and sun-ripened citrus peel. Minimal intervention is the entire philosophy: the leaf is dried, rested, and packed within weeks of the late-spring pluck.",
    ],
    productIds: [],
  },
]

export const getGardenByEstate = (estate: string | undefined): Garden | undefined =>
  GARDENS.find((g) => g.name === estate)

/* ── Testimonials (homepage social proof) ─────────────────────────────────── */

export interface Testimonial {
  quote: string
  name: string
  location: string
  rating: number
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I've been a tea drinker for twenty years and Elegant Sip is the first brand that made me understand what single-origin actually means. The First Flush Whole Leaf is a masterclass.",
    name: "Charlotte V.",
    location: "London, UK",
    rating: 5,
  },
  {
    quote:
      "Ordered a few tins as a gift, ended up keeping them for myself. The brewing cards made every steep feel intentional. This is what luxury tea should be.",
    name: "David O.",
    location: "Austin, TX",
    rating: 5,
  },
  {
    quote:
      "The Taste Matcher quiz recommended the First Flush Broken Leaf and it was spot on — I've already reordered twice. Beautifully packed, arrives fresh, tastes like the hills.",
    name: "Sofia R.",
    location: "Toronto, CA",
    rating: 5,
  },
  {
    quote:
      "You can taste the care in every leaf. The direct-from-garden story isn't marketing here — it's the whole point, and the tea proves it.",
    name: "Kenji T.",
    location: "Seattle, WA",
    rating: 5,
  },
]

/* ── FAQs ─────────────────────────────────────────────────────────────────── */

export interface Faq {
  question: string
  answer: string
  category: string
}

export const FAQS: Faq[] = [
  {
    category: "Orders & Shipping",
    question: "How fast is shipping, and is it really free?",
    answer:
      "Orders of ₹4,000 or more ship free anywhere in India. Standard delivery takes 2–4 business days; express options are available at checkout. Every order ships within 24 hours of being packed — we pack close to harvest so the leaf arrives as fresh as possible.",
  },
  {
    category: "Orders & Shipping",
    question: "Do you ship internationally?",
    answer:
      "Yes — we ship worldwide. International delivery typically takes 5–10 business days, and duties are calculated at checkout so there are no surprises on arrival.",
  },
  {
    category: "Orders & Shipping",
    question: "Can I change or cancel my order after placing it?",
    answer:
      "If your order hasn't shipped yet (usually within the first few hours), email elegantsipdarjeeling@gmail.com and we'll update or cancel it for you. Once it's with the carrier, we'll help you redirect it instead.",
  },
  {
    category: "Returns & Guarantee",
    question: "What if I don't love a tea?",
    answer:
      "The Elegant Sip Promise: if any tea doesn't live up to your expectations, tell us within 30 days and we'll replace it or refund you — no return shipping, no questions, no forms. We'd rather you find your perfect cup than force a box.",
  },
  {
    category: "Returns & Guarantee",
    question: "How fresh is the tea when it arrives?",
    answer:
      "We roast and pack in small batches close to harvest, and our packaging is nitrogen-flushed and light-proof. Most orders are within weeks of their pack date — and the pack date is printed on every tin.",
  },
  {
    category: "Brewing",
    question: "What's the best way to brew single-origin tea?",
    answer:
      "Every product ships with a brewing card (temperature, time, leaf amount, and steep counts). The golden rule: greener teas need cooler water, darker teas need hotter. Follow the card and adjust to taste — your palate is the final authority.",
  },
  {
    category: "Brewing",
    question: "How many steeps can I get from one serving of leaves?",
    answer:
      "Whole-leaf tea is designed to be re-steeped. Our oolongs (Ember Charm) can deliver 5–6 steepings, greens (Morning Dew) about 3, and whites (Summer Breeze) 3–4. Each steep reveals a new layer — that's the journey.",
  },
  {
    category: "Brewing",
    question: "Where are your teas grown, really?",
    answer:
      "Every tea is single-origin from an identified garden: Wuyi Mountains (Fujian), Cloud Mist Gardens (Guangxi), and White Tea Valley (Fuding). We buy direct from the estates — no auction houses, no blending, no anonymity. The garden is named on every tin.",
  },
]

/* ── Journal ──────────────────────────────────────────────────────────────── */

export interface JournalArticle {
  id: string
  title: string
  excerpt: string
  category: string
  author: string
  date: string
  readTime: string
  imageSrc: string
  imageAlt: string
  body: string[]
}

export const JOURNAL: JournalArticle[] = [
  {
    id: "art-of-first-flush",
    title: "The Art of the First Flush",
    excerpt:
      "The first harvest of spring is a race against the sun. Why the earliest pluck of the year commands the highest prices — and the most patience.",
    category: "Craft",
    author: "The Elegant Sip Tasting Team",
    date: "March 12, 2026",
    readTime: "4 min read",
    imageSrc: "/origin.webp",
    imageAlt: "Highland tea terraces at first light",
    body: [
      "Every spring, tea gardens hold their breath. The first flush — the first harvest of new leaves after winter dormancy — is brief, unpredictable, and irreplaceable. In Darjeeling and the high gardens of Guangxi, pickers rise before dawn because the leaves change character by the hour. What is picked at sunrise carries morning dew in its cells; what is picked at noon has already begun to harden against the sun.",
      "Why does the first flush command such reverence? Because those first leaves spent the winter storing everything the plant needs for a new season: amino acids, sugars, and the delicate aromatic compounds that define a tea's character. Later harvests are more robust and more productive, but they can never reproduce the ethereal brightness of the first few weeks.",
      "At Elegant Sip, we buy first-flush lots directly from the estates, then freeze the harvest date and garden name onto every tin. When you brew a first-flush green tea, you are tasting a specific morning in a specific valley — an event that will never occur again in exactly the same way.",
      "That is the true luxury of single-origin tea: not rarity for its own sake, but the honest record of a place and a moment. Every cup is a snapshot of weather, soil, and timing — and no two are identical.",
    ],
  },
  {
    id: "field-guide-to-steeping",
    title: "A Field Guide to Steeping",
    excerpt:
      "Temperature, time, leaf amount, and the often-misunderstood art of the re-steep. Everything you need to stop guessing and start tasting.",
    category: "Brewing",
    author: "The Elegant Sip Tasting Team",
    date: "January 28, 2026",
    readTime: "5 min read",
    imageSrc: "/craft.webp",
    imageAlt: "Tea leaves being hand-processed",
    body: [
      "Ninety percent of disappointing tea is not the leaf's fault — it is a temperature problem. Boiling water is the default of most kitchens, and it is simply wrong for delicate teas. Green and white teas contain delicate aromatics that scorch above 185°F, turning sweet leaves bitter. Darker, more oxidized teas need the heat to release their depth.",
      "The second variable people ignore is time. A green tea steeped for three minutes instead of two is not 'stronger' in a good way — it is astringent in a bad one. Whole-leaf tea rewards precision: measure your leaves, time your steep, and let the leaf, not the clock, be the judge.",
      "And then there is the re-steep — the single greatest value in whole-leaf tea. A quality oolong can deliver five or six steepings, each revealing a different face of the leaf. The first steep is the introduction; the third is often the masterpiece. Resteeping is not thrift; it is the intended experience.",
      "Every Elegant Sip tin ships with a brewing card tuned to that specific tea — temperature, time, leaf amount, and steep counts. Follow it once, then adjust to your palate. Within a week, you will taste the difference between a habit and a ritual.",
    ],
  },
  {
    id: "from-mist-to-cup",
    title: "From Mist to Cup: Our Sourcing Journey",
    excerpt:
      "No auction houses, no middlemen, no anonymity. How we built direct relationships with the gardens that grow the leaves we sell.",
    category: "Sourcing",
    author: "The Elegant Sip Tasting Team",
    date: "November 5, 2025",
    readTime: "6 min read",
    imageSrc: "/harvest.webp",
    imageAlt: "Tea plantation at harvest",
    body: [
      "The tea auction system is efficient, anonymous, and — for anyone who cares where their tea comes from — deeply unsatisfying. Leaf from a hundred gardens is blended into lots, graded by brokers, and sold by number. The farmer who grew the tea is often paid the least in the chain.",
      "We chose a different path. Our buyers spend the harvest seasons on the ground in Wuyi, Guangxi, and Fuding, tasting from the withering racks and walking the terraces with the growers. We buy whole lots directly from identified estates, and we pay a premium for the privilege of knowing exactly whose hands made our tea.",
      "This is not charity; it is quality control. When you buy direct, the grower can afford to pick at the perfect moment instead of the most profitable one. They can afford to hand-roll instead of machine-roll, to slow-oxidize instead of rush. The result is leaf that tastes like a place — because it is.",
      "It also means our supply is finite. When a first-flush lot is gone, it's gone until next spring. That scarcity is not marketing; it is the honest consequence of refusing to blend our way out of a good harvest. We'd rather run out of a tea than run out of standards.",
    ],
  },
]

export const getArticle = (id: string | undefined): JournalArticle | undefined =>
  JOURNAL.find((a) => a.id === id)

/* ── Taste Matcher quiz mapping ───────────────────────────────────────────── */

export const QUIZ_OPTIONS: Record<string, string> = {
  "Strong & bold": "first-flush-broken-leaf",
  "Light & floral": "first-flush-whole-leaf",
  "Sweet & aromatic": "first-flush-whole-leaf",
  "Fresh & grassy": "first-flush-fannings",
  Spicy: "first-flush-broken-mixed",
}
