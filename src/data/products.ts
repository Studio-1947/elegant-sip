/* ────────────────────────────────────────────────────────────────────────────
 * Elegant Sip — single source of truth for all shop + content data.
 * Products, the bundle, reviews, testimonials, FAQs, and journal articles
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

export interface Product {
  id: string
  name: string
  price: number
  compareAtPrice?: number
  description: string
  longDescription?: string
  imageSrc: string
  category: string
  origin?: TeaOrigin
  flavorProfile?: FlavorProfile
  brewingGuide?: BrewingGuide
  isBundle?: boolean
  contains?: string[]
}

/* ── Products ─────────────────────────────────────────────────────────────── */

export const PRODUCTS: Product[] = [
  {
    id: "ember-charm",
    name: "Ember Charm",
    price: 28,
    description:
      "A deeply oxidized roasted oolong tea layered with warm cinnamon wood, dark cacao, and roasted chestnut notes. Perfect for slow, contemplative afternoons.",
    longDescription:
      "Ember Charm begins its life in the Wuyi Mountains, where rocky mineral soils give Dahongpao its signature 'yan yun' — the mineral, stone-fruit depth that oolong lovers chase. After a spring harvest at 3,200 feet, the leaves are withered over charcoal and slow-roasted until the sugars caramelize into cinnamon, cacao, and roasted chestnut. The result is a tea that drinks like a fireside conversation: warm, unhurried, and worth the third and fourth steep.",
    imageSrc: "/embercharm.webp",
    category: "Oolong",
    origin: {
      origin: "Wuyi Mountains, Fujian",
      estate: "Wuyi Rock Garden",
      elevation: "3,200 ft",
      harvest: "Spring Roasted 2026",
      cultivar: "Dahongpao",
    },
    flavorProfile: { strength: 5, astringency: 3, sweetness: 2, floral: 1, caffeine: 4 },
    brewingGuide: {
      temperature: "205°F / 96°C",
      time: "45 seconds",
      steeps: "Up to 6",
      leafAmount: "1 tbsp per 8 oz",
      notes: "Increase steeping time by 10 seconds each steep. The roasted notes deepen dramatically by steep three.",
    },
  },
  {
    id: "morning-dew",
    name: "Morning Dew",
    price: 24,
    description:
      "Ethereal first-flush green tea leaves hand-harvested at dawn and naturally scented with night-blooming jasmine flowers. Bright, floral, and clarifying.",
    longDescription:
      "Harvested before sunrise in the mist of Guangxi's Cloud Mist Gardens, Morning Dew captures the first light of the garden in a cup. The leaves are picked only on dewy mornings, then gently fixed and naturally scented over three nights with fresh jasmine blossoms — never artificial flavor. The first sip is bright and vegetal; the finish lingers with jasmine and a whisper of sweetness. Clarity in leaf form.",
    imageSrc: "/morningdew.webp",
    category: "Green",
    origin: {
      origin: "Hengxian, Guangxi",
      estate: "Cloud Mist Gardens",
      elevation: "2,800 ft",
      harvest: "Early Spring 2026",
      cultivar: "Yabukita",
    },
    flavorProfile: { strength: 2, astringency: 3, sweetness: 3, floral: 5, caffeine: 2 },
    brewingGuide: {
      temperature: "175°F / 80°C",
      time: "2 minutes",
      steeps: "3",
      leafAmount: "1 tsp per 8 oz",
      notes: "Cooler water protects the delicate jasmine. Never boil green tea — bitterness is a temperature problem, not a leaf problem.",
    },
  },
  {
    id: "summer-breeze",
    name: "Summer Breeze",
    price: 26,
    description:
      "A delicate sun-dried white peony tea balanced with organic lemongrass and sun-ripened citrus peels. Refreshing, crisp, and clean.",
    longDescription:
      "White peony (Bai Mu Dan) is among the least processed teas in the world — withered and sun-dried until it simply is what it is. Summer Breeze pairs that honeyed softness with organic lemongrass and sun-ripened citrus peels for a tea that tastes like an open window. It is barely there, and that is the point: refreshing, crisp, and clean enough to drink all afternoon, hot or iced.",
    imageSrc: "/summerbreeze.webp",
    category: "White",
    origin: {
      origin: "Fuding, Fujian",
      estate: "White Tea Valley",
      elevation: "1,800 ft",
      harvest: "Late Spring 2026",
      cultivar: "Fuding Fada",
    },
    flavorProfile: { strength: 1, astringency: 1, sweetness: 4, floral: 3, caffeine: 1 },
    brewingGuide: {
      temperature: "185°F / 85°C",
      time: "3 minutes",
      steeps: "3–4",
      leafAmount: "1.5 tbsp per 8 oz",
      notes: "Excellent over ice — brew double strength, then pour over ice for a crisp iced tea with no bitterness.",
    },
  },
  {
    id: "elegant-trio",
    name: "The Elegant Trio",
    price: 66,
    compareAtPrice: 78,
    description:
      "All three signature blends — Ember Charm, Morning Dew, and Summer Breeze — in one curated collection. The complete journey from dark to light.",
    longDescription:
      "The complete Elegant Sip journey in one box. Ember Charm for slow evenings, Morning Dew for bright mornings, and Summer Breeze for golden afternoons — each in its full 50g pack, each with its brewing card. The perfect introduction to single-origin tea, or a beautifully considered gift.",
    imageSrc: "/tea1_1.png",
    category: "Collection",
    isBundle: true,
    contains: ["ember-charm", "morning-dew", "summer-breeze"],
  },
]

export const getProduct = (id: string | undefined): Product | undefined =>
  PRODUCTS.find((p) => p.id === id)

export const BUNDLE_SAVINGS = 12

/* ── Reviews ──────────────────────────────────────────────────────────────── */

export const REVIEWS: Record<string, Review[]> = {
  "ember-charm": [
    {
      id: "ec-1",
      author: "Marcus W.",
      rating: 5,
      date: "July 2026",
      text: "The roasted depth is unreal. Steep three is where it transforms — smoky chestnut and dark chocolate. My new evening ritual.",
      verified: true,
    },
    {
      id: "ec-2",
      author: "Priya S.",
      rating: 5,
      date: "June 2026",
      text: "Rich without being bitter. You can tell this was slow-roasted properly. Gave a tin to my father-in-law and he immediately ordered his own.",
      verified: true,
    },
    {
      id: "ec-3",
      author: "Daniel R.",
      rating: 4,
      date: "May 2026",
      text: "Very bold — exactly as described. I dialed back the steep to 30 seconds and it's perfect for me. Generous leaf-to-cup ratio.",
    },
  ],
  "morning-dew": [
    {
      id: "md-1",
      author: "Elena K.",
      rating: 5,
      date: "July 2026",
      text: "The jasmine is present but never perfumy. It's the tea I didn't know I needed before noon. So bright and clean.",
      verified: true,
    },
    {
      id: "md-2",
      author: "Tom H.",
      rating: 5,
      date: "June 2026",
      text: "Tastes like a garden after rain. My whole office switched from coffee to this. Lasts three beautiful steeps.",
      verified: true,
    },
  ],
  "summer-breeze": [
    {
      id: "sb-1",
      author: "Aisha M.",
      rating: 5,
      date: "July 2026",
      text: "Made a pitcher for a brunch and it disappeared. The citrus peel is subtle and natural — no fake lemon flavor.",
      verified: true,
    },
    {
      id: "sb-2",
      author: "James P.",
      rating: 4,
      date: "May 2026",
      text: "Delicate and refreshing, exactly as promised. I prefer it iced. Would love a bigger size option.",
    },
  ],
}

export const getReviews = (id: string | undefined): Review[] =>
  id ? REVIEWS[id] ?? [] : []

export const getRating = (id: string | undefined): { average: number; count: number } => {
  const reviews = getReviews(id)
  if (reviews.length === 0) return { average: 0, count: 0 }
  const average = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
  return { average: Math.round(average * 10) / 10, count: reviews.length }
}

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
      "I've been a tea drinker for twenty years and Elegant Sip is the first brand that made me understand what single-origin actually means. The Ember Charm is a masterclass.",
    name: "Charlotte V.",
    location: "London, UK",
    rating: 5,
  },
  {
    quote:
      "Ordered the Trio as a gift, ended up keeping it for myself. The brewing cards made every steep feel intentional. This is what luxury tea should be.",
    name: "David O.",
    location: "Austin, TX",
    rating: 5,
  },
  {
    quote:
      "The Taste Matcher quiz recommended Morning Dew and it was spot on — I've already reordered twice. Beautifully packed, arrives fresh, tastes like the hills.",
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
      "Orders over $50 ship free anywhere in the US. Standard delivery takes 2–4 business days; express options are available at checkout. Every order ships within 24 hours of being packed — we pack close to harvest so the leaf arrives as fresh as possible.",
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
      "If your order hasn't shipped yet (usually within the first few hours), email hello@elegantsip.com and we'll update or cancel it for you. Once it's with the carrier, we'll help you redirect it instead.",
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
  "Strong & bold": "ember-charm",
  "Light & floral": "morning-dew",
  "Sweet & aromatic": "summer-breeze",
  "Fresh & grassy": "morning-dew",
  Spicy: "ember-charm",
}
