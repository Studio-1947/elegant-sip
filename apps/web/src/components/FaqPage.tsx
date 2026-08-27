import { useState } from 'react'
import { FAQS } from '../data/products'
import { useDocumentMeta, useJsonLd } from '../lib/router'
import { ROUTE_META } from '../lib/seoRoutes'

export default function FaqPage() {
  // Accordion: exactly one question open at a time (clicking it again closes it).
  const [openQuestion, setOpenQuestion] = useState<string | null>(FAQS[0]?.question ?? null)
  useDocumentMeta(
    ROUTE_META['/faq'].title,
    ROUTE_META['/faq'].description,
    { canonical: '/faq' },
  )
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  })

  const categories = Array.from(new Set(FAQS.map((f) => f.category)))

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Support</span>
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-6">Frequently Asked Questions</h1>
        <p className="text-sm text-[#4a584a] leading-relaxed mb-16">
          Everything about ordering, freshness, returns, and brewing. Can't find what you need?
          Write to <a href="mailto:elegantsipdarjeeling@gmail.com" className="text-[#4a7333] hover:text-[#1b261b] transition-colors">elegantsipdarjeeling@gmail.com</a>.
        </p>

        <div className="space-y-16">
          {categories.map((category) => (
            <div key={category}>
              <h2 className="text-xs font-mono tracking-[0.3em] uppercase text-[#4a7333] mb-6 border-b border-[#1b261b]/10 pb-3">
                {category}
              </h2>
              <div className="space-y-3">
                {FAQS.filter((f) => f.category === category).map((faq, i) => {
                  const isOpen = openQuestion === faq.question
                  const panelId = `faq-${category}-${i}`.replace(/\s+/g, '-').toLowerCase()
                  return (
                    <div
                      key={faq.question}
                      className="bg-white border border-[#1b261b]/10 rounded-2xl overflow-hidden transition-shadow hover:shadow-[0_8px_24px_rgba(27,38,27,0.04)]"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenQuestion((current) => (current === faq.question ? null : faq.question))}
                        className="w-full flex items-center justify-between gap-4 px-6 py-5 cursor-pointer text-left text-sm font-bold"
                      >
                        {faq.question}
                        <span
                          className={`text-[#4a7333] text-lg leading-none flex-shrink-0 transition-transform duration-300 ease-out ${isOpen ? 'rotate-45' : ''}`}
                          aria-hidden="true"
                        >
                          +
                        </span>
                      </button>
                      {/* Height animates via grid-template-rows (0fr → 1fr) — no JS measuring needed. */}
                      <div
                        id={panelId}
                        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none"
                        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', opacity: isOpen ? 1 : 0 }}
                      >
                        <div className="min-h-0 overflow-hidden" inert={!isOpen}>
                          <p className="px-6 pb-6 text-xs text-[#4a584a] leading-relaxed">{faq.answer}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
