/* ────────────────────────────────────────────────────────────────────────────
 * Elegant Sip — site content: reviews, gardens, testimonials, FAQs, journal,
 * and the Taste Matcher quiz mapping. Product catalogue lives in products.ts,
 * which re-exports everything here so consumers can import from one place.
 * ──────────────────────────────────────────────────────────────────────────── */


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
