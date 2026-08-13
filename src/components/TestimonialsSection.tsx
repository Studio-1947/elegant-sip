import { TESTIMONIALS } from '../data/products'
import { useScrollReveal } from '../lib/useScrollReveal'

export default function TestimonialsSection() {
  const headerRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *' })
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *', stagger: 0.15 })

  return (
    <section className="px-6 md:px-12 lg:px-16 py-28 max-w-[1400px] mx-auto bg-[#f9faf7]">
      <div ref={headerRef} className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Kind Words</span>
        <h2 className="text-[#1b261b] text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-tight mb-6">
          Loved by Tea Drinkers
        </h2>
        <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
          Real words from the people who actually drink what we pack.
        </p>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="bg-white border border-[#1b261b]/10 rounded-2xl p-8 flex flex-col justify-between min-h-[220px] transition-shadow hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)]"
          >
            <div>
              <div className="flex gap-1 text-[#8bb56e] text-sm mb-4" aria-label={`Rated ${t.rating} out of 5`}>
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill={i < t.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-sm text-[#4a584a] leading-relaxed">"{t.quote}"</blockquote>
            </div>
            <figcaption className="flex items-center gap-3 mt-6">
              <div className="w-10 h-10 rounded-full bg-[#8bb56e]/15 flex items-center justify-center text-[#8bb56e] font-bold text-sm">
                {t.name.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold">{t.name}</p>
                <p className="text-[10px] font-mono text-[#4a584a]/60 uppercase tracking-wider">{t.location}</p>
              </div>
              <span className="ml-auto text-[9px] font-mono uppercase tracking-wider bg-[#8bb56e]/10 text-[#8bb56e] px-2 py-1 rounded-full">
                Verified
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
