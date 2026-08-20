import { useScrollReveal } from '../lib/useScrollReveal'

export default function PhilosophyQuoteSection() {
  const ref = useScrollReveal<HTMLElement>({ target: ':scope > *' })

  return (
    <section ref={ref} className="px-6 md:px-16 lg:px-24 py-28 max-w-4xl mx-auto text-center border-t border-b border-[#1b261b]/10">
      <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#8bb56e]/40 mx-auto mb-8" fill="currentColor">
        <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
      </svg>
      <blockquote className="text-[#2b3a2b] text-xl md:text-2xl lg:text-3xl font-light italic leading-relaxed mb-8">
        Tea is the elixir of life  a bridge between the hurried world
        and the stillness within.
      </blockquote>
      <cite className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase not-italic">
        The Elegant Sip Manifesto
      </cite>
    </section>
  )
}
