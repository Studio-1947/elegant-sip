import { useState } from 'react'
import { faqsFor } from '../data/products'
import { useDocumentMeta, useJsonLd } from '../lib/router'
import { ROUTE_META } from '../lib/seoRoutes'
import { useStoreSettings } from '../lib/storeSettings'
import FaqItem from './FaqItem'

export default function FaqPage() {
  const faqs = faqsFor(useStoreSettings().guarantee)
  // Accordion: exactly one question open at a time (clicking it again closes it).
  const [openQuestion, setOpenQuestion] = useState<string | null>(faqs[0]?.question ?? null)
  useDocumentMeta(
    ROUTE_META['/faq'].title,
    ROUTE_META['/faq'].description,
    { canonical: '/faq' },
  )
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  })

  const categories = Array.from(new Set(faqs.map((f) => f.category)))

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
                {faqs.filter((f) => f.category === category).map((faq, i) => {
                  const isOpen = openQuestion === faq.question
                  const panelId = `faq-${category}-${i}`.replace(/\s+/g, '-').toLowerCase()
                  return (
                    <FaqItem
                      key={faq.question}
                      question={faq.question}
                      answer={faq.answer}
                      panelId={panelId}
                      open={isOpen}
                      onToggle={() => setOpenQuestion((current) => (current === faq.question ? null : faq.question))}
                    />
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
