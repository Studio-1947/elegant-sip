/* ────────────────────────────────────────────────────────────────────────────
 * Elegant Sip  site content: reviews, gardens, testimonials, FAQs, journal,
 * and the Taste Matcher quiz mapping. Product catalogue lives in products.ts,
 * which re-exports everything here so consumers can import from one place.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { Review } from './products'

/* ── Reviews ──────────────────────────────────────────────────────────────── */

// New catalogue starts unreviewed  customer reviews accumulate via the
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

/* ── Gardens (origin profiles  "the garden is the brand") ────────────────── */

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
      "The Wuyi Mountains are a UNESCO landscape of sheer cliffs and mineral-rich rocky soil  the birthplace of oolong itself. Tea bushes here grow in narrow gorges where reflected warmth from the rock walls and constant mist create the slow growth that concentrates flavor.",
      "Our partner plots sit at 3,200 feet, planted with Dahongpao cultivar bushes. After the spring pluck, the leaves are withered over charcoal and slow-roasted in small batches  the craft behind Ember Charm's cinnamon-and-cacao depth and the mineral 'yan yun' finish that oolong lovers chase.",
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
      "Fuding is the historic home of white tea, where the Fuding Fada cultivar grows fat, downy buds prized for Bai Mu Dan. The valley's tea is among the least processed in the world  withered in the sun until it simply is what it is.",
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
      "Ordered a few packs as a gift, ended up keeping them for myself. The brewing cards made every steep feel intentional. This is what luxury tea should be.",
    name: "David O.",
    location: "Austin, TX",
    rating: 5,
  },
  {
    quote:
      "The Taste Matcher quiz recommended the First Flush Broken Leaf and it was spot on  I've already reordered twice. Beautifully packed, arrives fresh, tastes like the hills.",
    name: "Sofia R.",
    location: "Toronto, CA",
    rating: 5,
  },
  {
    quote:
      "You can taste the care in every leaf. The direct-from-garden story isn't marketing here  it's the whole point, and the tea proves it.",
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
      "Orders of ₹4,000 or more ship free anywhere in India. Standard delivery takes 2–4 business days; express options are available at checkout. Every order ships within 24 hours of being packed  we pack close to harvest so the leaf arrives as fresh as possible.",
  },
  {
    category: "Orders & Shipping",
    question: "Do you ship internationally?",
    answer:
      "Yes  we ship worldwide. International delivery typically takes 5–10 business days, and duties are calculated at checkout so there are no surprises on arrival.",
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
      "The Elegant Sip Promise: if any tea doesn't live up to your expectations, tell us within 30 days and we'll replace it or refund you  no return shipping, no questions, no forms. We'd rather you find your perfect cup than force a box.",
  },
  {
    category: "Returns & Guarantee",
    question: "How fresh is the tea when it arrives?",
    answer:
      "We roast and pack in small batches close to harvest, and our packaging is nitrogen-flushed and light-proof. Most orders are within weeks of their pack date  and the pack date is printed on every pack.",
  },
  {
    category: "Brewing",
    question: "What's the best way to brew single-origin tea?",
    answer:
      "Every product ships with a brewing card (temperature, time, leaf amount, and steep counts). The golden rule: greener teas need cooler water, darker teas need hotter. Follow the card and adjust to taste  your palate is the final authority.",
  },
  {
    category: "Brewing",
    question: "How many steeps can I get from one serving of leaves?",
    answer:
      "Whole-leaf tea is designed to be re-steeped. Our oolongs (Ember Charm) can deliver 5–6 steepings, greens (Morning Dew) about 3, and whites (Summer Breeze) 3–4. Each steep reveals a new layer  that's the journey.",
  },
  {
    category: "Brewing",
    question: "Where are your teas grown, really?",
    answer:
      "Every tea is single-origin from an identified garden: Wuyi Mountains (Fujian), Cloud Mist Gardens (Guangxi), and White Tea Valley (Fuding). We buy direct from the estates  no auction houses, no blending, no anonymity. The garden is named on every pack.",
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
      "The first harvest of spring is a race against the sun. Why the earliest pluck of the year commands the highest prices  and the most patience.",
    category: "Craft",
    author: "The Elegant Sip Tasting Team",
    date: "March 12, 2026",
    readTime: "4 min read",
    imageSrc: "/origin.webp",
    imageAlt: "Highland tea terraces at first light",
    body: [
      "Every spring, tea gardens hold their breath. The first flush  the first harvest of new leaves after winter dormancy  is brief, unpredictable, and irreplaceable. In Darjeeling and the high gardens of Guangxi, pickers rise before dawn because the leaves change character by the hour. What is picked at sunrise carries morning dew in its cells; what is picked at noon has already begun to harden against the sun.",
      "Why does the first flush command such reverence? Because those first leaves spent the winter storing everything the plant needs for a new season: amino acids, sugars, and the delicate aromatic compounds that define a tea's character. Later harvests are more robust and more productive, but they can never reproduce the ethereal brightness of the first few weeks.",
      "At Elegant Sip, we buy first-flush lots directly from the estates, then freeze the harvest date and garden name onto every pack. When you brew a first-flush green tea, you are tasting a specific morning in a specific valley  an event that will never occur again in exactly the same way.",
      "That is the true luxury of single-origin tea: not rarity for its own sake, but the honest record of a place and a moment. Every cup is a snapshot of weather, soil, and timing  and no two are identical.",
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
      "Ninety percent of disappointing tea is not the leaf's fault  it is a temperature problem. Boiling water is the default of most kitchens, and it is simply wrong for delicate teas. Green and white teas contain delicate aromatics that scorch above 185°F, turning sweet leaves bitter. Darker, more oxidized teas need the heat to release their depth.",
      "The second variable people ignore is time. A green tea steeped for three minutes instead of two is not 'stronger' in a good way  it is astringent in a bad one. Whole-leaf tea rewards precision: measure your leaves, time your steep, and let the leaf, not the clock, be the judge.",
      "And then there is the re-steep  the single greatest value in whole-leaf tea. A quality oolong can deliver five or six steepings, each revealing a different face of the leaf. The first steep is the introduction; the third is often the masterpiece. Resteeping is not thrift; it is the intended experience.",
      "Every Elegant Sip pack ships with a brewing card tuned to that specific tea  temperature, time, leaf amount, and steep counts. Follow it once, then adjust to your palate. Within a week, you will taste the difference between a habit and a ritual.",
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
      "The tea auction system is efficient, anonymous, and  for anyone who cares where their tea comes from  deeply unsatisfying. Leaf from a hundred gardens is blended into lots, graded by brokers, and sold by number. The farmer who grew the tea is often paid the least in the chain.",
      "We chose a different path. Our buyers spend the harvest seasons on the ground in Wuyi, Guangxi, and Fuding, tasting from the withering racks and walking the terraces with the growers. We buy whole lots directly from identified estates, and we pay a premium for the privilege of knowing exactly whose hands made our tea.",
      "This is not charity; it is quality control. When you buy direct, the grower can afford to pick at the perfect moment instead of the most profitable one. They can afford to hand-roll instead of machine-roll, to slow-oxidize instead of rush. The result is leaf that tastes like a place  because it is.",
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
