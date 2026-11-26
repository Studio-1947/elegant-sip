import { useState } from 'react'
import { faqsFor } from '../data/products'
import { Link } from '../lib/router'
import { useStoreSettings } from '../lib/storeSettings'
import FaqItem from './FaqItem'

/** The questions shoppers ask most before buying a tea, from the shop's own FAQ, in this order. */
const PRODUCT_QUESTIONS = [
  'How fast is shipping, and is it really free?',
  'How fresh is the tea when it arrives?',
  "What's the best way to brew Darjeeling first flush?",
  'How many steeps can I get from one serving of leaves?',
  "What if I don't love a tea?",
]

/**
 * A short FAQ under "You May Also Love" on every product page: five answers
 * from the FAQ page (the guarantee follows the shop setting and drops out
 * while it is off), with a link to the rest.
 */
export default function ProductFaq() {
  const all = faqsFor(useStoreSettings().guarantee)
  const faqs = PRODUCT_QUESTIONS.flatMap((q) => all.filter((f) => f.question === q))
  const [openQuestion, setOpenQuestion] = useState<string | null>(faqs[0]?.question ?? null)
  if (faqs.length === 0) return null

  return (
    <section aria-labelledby="product-faq-heading" className="mt-24 max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-2">Good to Know</span>
        <h2 id="product-faq-heading" className="text-2xl md:text-3xl font-bold uppercase tracking-tight">
          Frequently Asked Questions
        </h2>
      </div>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <FaqItem
            key={faq.question}
            question={faq.question}
            answer={faq.answer}
            panelId={`product-faq-${i}`}
            open={openQuestion === faq.question}
            onToggle={() => setOpenQuestion((current) => (current === faq.question ? null : faq.question))}
          />
        ))}
      </div>
      <p className="mt-8 text-center">
        <Link to="/faq" className="text-xs font-bold tracking-widest uppercase text-[#4a7333] border-b-2 border-[#8bb56e]/50 pb-1 transition-colors hover:text-[#1b261b] hover:border-[#4a7333]">
          See all FAQs
        </Link>
      </p>
    </section>
  )
}
