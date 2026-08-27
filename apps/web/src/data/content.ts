/* ────────────────────────────────────────────────────────────────────────────
 * Elegant Sip — site content: reviews, gardens, testimonials, FAQs, journal,
 * and the Taste Matcher quiz mapping. Product catalogue lives in products.ts,
 * which re-exports everything here so consumers can import from one place.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { Review } from './products'

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

/*
 * NOTE FOR THE BRAND OWNER: the two profiles below describe the Rungbong Valley
 * gardens above Mirik in Darjeeling and are written to be factually accurate
 * about the region, elevation band and flush calendar. Confirm the specific
 * estate attributions against your actual purchase records before launch, and
 * keep `productIds` in sync with `Product.origin.estate` in products.ts — the
 * two are cross-linked in both directions by `getGardenByEstate`.
 */

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
    id: "gopaldhara",
    name: "Gopaldhara",
    region: "Rungbong Valley, Mirik · Darjeeling",
    elevation: "3,500–7,000 ft",
    imageSrc: "/gopal-1024.webp",
    story: [
      "Gopaldhara sits in the Rungbong Valley above Mirik, and its upper sections are among the highest planted land in Darjeeling — rising past 7,000 feet. Altitude is the whole story here: at that height the bush grows slowly, the internodes shorten, and the leaf concentrates the aromatics that give Darjeeling first flush its muscatel signature.",
      "The first flush is a narrow window. After winter dormancy the bushes push a small quantity of tender two-leaves-and-a-bud, and the pluck runs for a few weeks in late February through April. That leaf is withered long and fired light, which is why a first flush brews pale gold rather than red, and why it should never meet milk.",
      "Our whole leaf and broken leaf grades come from this valley. The same day's pluck is sorted into grades rather than blended across gardens, so a broken leaf here is not a lesser tea — it is the same leaf, cut for a faster, stronger cup.",
    ],
    productIds: ["first-flush-whole-leaf", "first-flush-broken-leaf"],
  },
  {
    id: "rohini",
    name: "Rohini",
    region: "Kurseong Valley · Darjeeling",
    elevation: "1,500–4,500 ft",
    imageSrc: "/harvest.webp",
    story: [
      "Rohini lies lower down the hill, on the slopes below Kurseong where the Darjeeling foothills warm earlier in the season. Lower elevation means the bushes wake sooner, so Rohini is often among the first gardens in the district to send out a first flush at all.",
      "A warmer, faster-growing leaf makes a bolder cup — more body, more malt, less of the ethereal floral top note you get at 7,000 feet. That suits the broken mixed and fannings grades, which are built for strength: a fast brew, a full colour, and enough backbone to take milk or become masala chai.",
      "Nothing here is blended with leaf from outside the district. The grade changes; the garden and the harvest do not.",
    ],
    productIds: ["first-flush-broken-mixed", "first-flush-fannings"],
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

/*
 * NOTE FOR THE BRAND OWNER: replace these with real, attributable customer
 * quotes before launch — or delete the section. They are currently written as
 * plausible placeholders, and presenting invented quotes as real reviews would
 * break the honesty rule this site otherwise holds to. Ratings vary because
 * four identical five-star raves read as fabricated even when they aren't.
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I've been drinking tea for twenty years and this is the first time I've understood what single-origin actually means. The whole leaf first flush is a masterclass — pale in the cup and enormous on the nose.",
    name: "Charlotte V.",
    location: "Bengaluru",
    rating: 5,
  },
  {
    quote:
      "Ordered a few packs as a gift and ended up keeping them. The brewing notes on each pack made every steep feel deliberate rather than guessed at.",
    name: "David O.",
    location: "Pune",
    rating: 5,
  },
  {
    quote:
      "The Taste Matcher pointed me at the broken leaf and it was the right call — brisk enough for a morning cup without losing the muscatel. Took two goes to get my steep time right.",
    name: "Sofia R.",
    location: "Mumbai",
    rating: 4,
  },
  {
    quote:
      "The fannings make the best masala chai I've had at home. Not a delicate tea and doesn't pretend to be — it's the working grade and it's honest about it.",
    name: "Kenji T.",
    location: "Delhi",
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
      "Orders of ₹4,000 or more ship free within India. Standard delivery takes 2–4 business days for ₹150; express (1–2 business days) is ₹450. We pack to order rather than from a warehouse shelf, so allow a day or two for packing before the courier collects.",
  },
  {
    category: "Orders & Shipping",
    question: "Do you ship internationally?",
    answer:
      "We ship within India today. We're still finalising which countries we can serve properly, so rather than promise a rate we can't yet stand behind, message us on WhatsApp with your address and we'll quote the actual shipping and tell you what duties to expect. Any customs duties or import taxes are set by your country and are payable by you on arrival — they are not collected at our checkout.",
  },
  {
    category: "Orders & Shipping",
    question: "Can I change or cancel my order after placing it?",
    answer:
      "If your order hasn't shipped yet, email elegantsipdarjeeling@gmail.com and we'll update or cancel it for you. Once it's with the carrier, we'll help you redirect it instead.",
  },
  {
    category: "Returns & Guarantee",
    question: "What if I don't love a tea?",
    answer:
      "The Elegant Sip Promise: if any tea doesn't live up to your expectations, tell us within 30 days and we'll replace it or refund you — no return shipping, no questions, no forms. We'd rather you find your perfect cup than force a box. This is written into our Terms, not just our marketing.",
  },
  {
    category: "Returns & Guarantee",
    question: "How fresh is the tea when it arrives?",
    answer:
      "We pack in small batches close to harvest, in light-proof packaging, and the pack date is printed on every pack. First flush is a seasonal tea — when a lot is gone it's gone until the next spring, and we'd rather sell out than sell you last year's leaf.",
  },
  {
    category: "Brewing",
    question: "What's the best way to brew Darjeeling first flush?",
    answer:
      "Cooler water than you think: around 90 °C for whole leaf, a full boil only for the broken grades and fannings. Steep 3–4 minutes for whole leaf, 2–3 for broken. Skip the milk on first flush — the muscatel aromatics are the whole point, and milk buries them. Every product page carries the exact card for that grade.",
  },
  {
    category: "Brewing",
    question: "How many steeps can I get from one serving of leaves?",
    answer:
      "It depends on the grade. Whole leaf first flush gives 2–3 steepings, broken leaf about 2, and fannings 1–2 — the finer the cut, the faster it gives everything up. Whole leaf rewards patience; fannings reward a strong, quick cup.",
  },
  {
    category: "Brewing",
    question: "Where are your teas grown, really?",
    answer:
      "Every tea is single-origin Darjeeling, from gardens in the Rungbong and Kurseong valleys — Gopaldhara for the whole leaf and broken leaf, Rohini for the broken mixed and fannings. We buy direct from the garden: no auction houses, no blending across estates, no anonymity. The garden is named on every pack.",
  },
  {
    category: "Brewing",
    question: "What's the difference between whole leaf, broken leaf and fannings?",
    answer:
      "It's the size of the cut, not the quality of the garden — all four grades come from the same first flush pluck. Whole leaf brews pale, floral and complex and is best drunk plain. Broken leaf brews faster and stronger. Broken mixed and fannings brew fastest and darkest, take milk happily, and make excellent masala chai.",
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
      "Every spring, tea gardens hold their breath. The first flush — the first harvest of new leaves after winter dormancy — is brief, unpredictable, and irreplaceable. In the high gardens of Darjeeling, pickers rise before dawn because the leaves change character by the hour. What is picked at sunrise carries morning dew in its cells; what is picked at noon has already begun to harden against the sun.",
      "Why does the first flush command such reverence? Because those first leaves spent the winter storing everything the plant needs for a new season: amino acids, sugars, and the delicate aromatic compounds that define a tea's character. Later harvests are more robust and more productive, but they can never reproduce the ethereal brightness of the first few weeks.",
      "At Elegant Sip, we buy first-flush lots directly from the estates, then freeze the harvest date and garden name onto every pack. When you brew a first-flush Darjeeling, you are tasting a specific morning in a specific valley — an event that will never occur again in exactly the same way.",
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
      "Ninety percent of disappointing tea is not the leaf's fault — it is a temperature problem. Boiling water is the default of most kitchens, and it is simply wrong for delicate teas. Darjeeling first flush contains delicate aromatics that scorch at a rolling boil, turning a bright leaf bitter. The broken grades and fannings, cut finer and brewed faster, need the heat to release their depth.",
      "The second variable people ignore is time. A first flush steeped for six minutes instead of three is not 'stronger' in a good way — it is astringent in a bad one. Whole-leaf tea rewards precision: measure your leaves, time your steep, and let the leaf, not the clock, be the judge.",
      "And then there is the re-steep — the single greatest value in whole-leaf tea. A whole-leaf first flush can deliver two or three steepings, each revealing a different face of the leaf. The first steep is the introduction; the second is often the masterpiece. Resteeping is not thrift; it is the intended experience.",
      "Every Elegant Sip pack ships with a brewing card tuned to that specific tea — temperature, time, leaf amount, and steep counts. Follow it once, then adjust to your palate. Within a week, you will taste the difference between a habit and a ritual.",
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
      "We chose a different path. Our buyers spend the harvest season on the ground in the Rungbong and Kurseong valleys, tasting from the withering racks and walking the terraces with the growers. We buy whole lots directly from identified estates, and we pay a premium for the privilege of knowing exactly whose hands made our tea.",
      "This is not charity; it is quality control. When you buy direct, the grower can afford to pick at the perfect moment instead of the most profitable one. They can afford to hand-roll instead of machine-roll, to slow-oxidize instead of rush. The result is leaf that tastes like a place — because it is.",
      "It also means our supply is finite. When a first-flush lot is gone, it's gone until next spring. That scarcity is not marketing; it is the honest consequence of refusing to blend our way out of a good harvest. We'd rather run out of a tea than run out of standards.",
    ],
  },
]

export const getArticle = (id: string | undefined): JournalArticle | undefined =>
  JOURNAL.find((a) => a.id === id)

/* ── Taste Matcher quiz mapping ───────────────────────────────────────────── */

/* Each answer maps to a distinct grade, and the wording matches how that grade
   actually drinks — "fresh & grassy" pointing at chai-ready fannings was both
   a duplicate and a mismatch. */
export const QUIZ_OPTIONS: Record<string, string> = {
  "Light & floral": "first-flush-whole-leaf",
  "Brisk & muscatel": "first-flush-broken-leaf",
  "Strong & malty": "first-flush-broken-mixed",
  "Chai & spice": "first-flush-fannings",
}
