/* ────────────────────────────────────────────────────────────────────────────
 * Elegant Sip — site content: FAQs, journal and the Taste Matcher quiz
 * mapping. Product catalogue lives in products.ts,
 * which re-exports everything here so consumers can import from one place.
 * ──────────────────────────────────────────────────────────────────────────── */

/* ── FAQs ─────────────────────────────────────────────────────────────────── */

export interface Faq {
  question: string
  answer: string
  category: string
  /** About the satisfaction guarantee, which staff can switch off or re-time. */
  guarantee?: true
}

const guaranteeAnswer = (days: number) =>
  `The Elegant Sip Promise: if any tea doesn't live up to your expectations, tell us within ${days} days and we'll replace it or refund you — no return shipping, no questions, no forms. We'd rather you find your perfect cup than force a box. This is written into our Terms, not just our marketing.`

export const FAQS: Faq[] = [
  {
    category: "Orders & Shipping",
    question: "How fast is shipping, and is it really free?",
    answer:
      "Orders of ₹1,000 or more ship free within India. Standard delivery takes 2–4 business days for ₹30; express (1–2 business days) is ₹450. We pack to order rather than from a warehouse shelf, so allow a day or two for packing before the courier collects.",
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
    // The default wording; faqsFor() follows the shop setting.
    answer: guaranteeAnswer(30),
    guarantee: true,
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
      "Cooler water than you think: around 90 °C, not a rolling boil, and steep 3–4 minutes. Skip the milk — the muscatel aromatics are the whole point, and milk buries them. Every product page carries the exact brewing card for that tea.",
  },
  {
    category: "Brewing",
    question: "How many steeps can I get from one serving of leaves?",
    answer:
      "It depends on the tea. Black teas give 2–3 steepings, green teas about 3, and white teas 3–4. Add roughly 30 seconds to each steep after the first.",
  },
  {
    category: "Brewing",
    question: "Where are your teas grown, really?",
    answer:
      "Our teas are single-origin Darjeeling, bought direct from gardens in the Rungbong and Kurseong valleys — no auction houses and no blending across estates. The Gardens page has the details.",
  },
  {
    category: "Brewing",
    question: "What's the difference between first, second and autumn flush?",
    answer:
      "The flush is the season the leaf was picked. First flush (spring) is light, floral and bright, and best drunk plain. Second flush (early summer) is fuller and fruitier — the classic muscatel Darjeeling — and can take a splash of milk. Autumn flush is mellow, smooth and coppery, and takes milk well.",
  },
]

/** The FAQ as the shop offers it now: the guarantee answer is dropped while it is off. */
export function faqsFor(guarantee: { enabled: boolean; days: number }): Faq[] {
  return FAQS.flatMap((faq) => {
    if (!faq.guarantee) return [faq]
    return guarantee.enabled ? [{ ...faq, answer: guaranteeAnswer(guarantee.days) }] : []
  })
}

/* ── Taste Matcher quiz mapping ───────────────────────────────────────────── */

/* Each answer maps to a different tea, worded the way that tea actually drinks. */
export const QUIZ_OPTIONS: Record<string, string> = {
  "Light & delicate": "silver-needle",
  "Bright & floral": "first-flush",
  "Fresh & grassy": "green-tea",
  "Rich & honeyed": "golden-needle",
}
