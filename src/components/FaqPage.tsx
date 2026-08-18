import { FAQS } from '../data/products'
import { useDocumentMeta, useJsonLd } from '../lib/router'

export default function FaqPage() {
  useDocumentMeta(
    'FAQ — Elegant Sip',
    'Answers about shipping, returns, the Elegant Sip Promise, and how to brew single-origin tea.',
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
        <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Support</span>
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-6">Frequently Asked Questions</h1>
        <p className="text-sm text-[#4a584a] leading-relaxed mb-16">
          Everything about ordering, freshness, returns, and brewing. Can't find what you need?
          Write to <a href="mailto:elegantsipdarjeeling@gmail.com" className="text-[#8bb56e] hover:text-[#1b261b] transition-colors">elegantsipdarjeeling@gmail.com</a>.
        </p>

        <div className="space-y-16">
          {categories.map((category) => (
            <div key={category}>
              <h2 className="text-xs font-mono tracking-[0.3em] uppercase text-[#8bb56e] mb-6 border-b border-[#1b261b]/10 pb-3">
                {category}
              </h2>
              <div className="space-y-3">
                {FAQS.filter((f) => f.category === category).map((faq, i) => (
                  <details
                    key={faq.question}
                    className="group bg-white border border-[#1b261b]/10 rounded-2xl overflow-hidden transition-shadow hover:shadow-[0_8px_24px_rgba(27,38,27,0.04)]"
                    open={i === 0}
                  >
                    <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none text-sm font-bold">
                      {faq.question}
                      <span className="text-[#8bb56e] transition-transform duration-300 group-open:rotate-45 text-lg leading-none flex-shrink-0">+</span>
                    </summary>
                    <p className="px-6 pb-6 text-xs text-[#4a584a] leading-relaxed">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
