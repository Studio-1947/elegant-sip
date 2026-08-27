import { GARDENS, getProduct } from '../data/products'
import { formatINR } from '../lib/currency'
import { Link, useDocumentMeta } from '../lib/router'
import { ROUTE_META } from '../lib/seoRoutes'
import { useScrollReveal } from '../lib/useScrollReveal'

export default function GardensPage() {
  useDocumentMeta(
    ROUTE_META['/gardens'].title,
    ROUTE_META['/gardens'].description,
    { canonical: '/gardens' },
  )
  const listRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *', stagger: 0.15 })

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto">
        {/* Banner */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-5">The Gardens</span>
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tight leading-[1.05] mb-6">
            The Garden is <span className="text-[#4a7333]">the Brand</span>
          </h1>
          <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
            We don't buy from auction houses, and we don't blend away a garden's character. Every
            pack names its estate — these are the {GARDENS.length === 1 ? 'garden' : `${GARDENS.length} gardens`} we buy from, and why.
          </p>
        </div>

        {/* Garden profiles */}
        <div ref={listRef} className="space-y-10">
          {GARDENS.map((garden, i) => {
            const teas = garden.productSlugs
              .map((slug: string) => getProduct(slug))
              .filter((p): p is NonNullable<typeof p> => Boolean(p))
            return (
              <article
                key={garden.id}
                className={`bg-white border border-[#1b261b]/10 rounded-3xl overflow-hidden md:flex ${i % 2 === 1 ? 'md:flex-row-reverse' : ''
                  }`}
              >
                <div className="md:w-2/5 flex-shrink-0">
                  <img
                    src={garden.imageSrc}
                    alt={`${garden.name}, ${garden.region}`}
                    loading="lazy"
                    width={1200}
                    height={900}
                    className="w-full h-56 md:h-full object-cover"
                  />
                </div>
                <div className="p-7 md:p-10">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-[11px] font-mono tracking-widest uppercase bg-[#8bb56e]/10 text-[#4a7333] px-3 py-1.5 rounded-full">
                      {garden.region}
                    </span>
                    <span className="text-[11px] font-mono tracking-widest uppercase bg-[#1b261b]/5 text-[#4a584a] px-3 py-1.5 rounded-full">
                      {garden.elevation}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-4">{garden.name}</h2>
                  {garden.story.map((para) => (
                    <p key={para.slice(0, 32)} className="text-xs md:text-sm text-[#4a584a] leading-relaxed mb-3">
                      {para}
                    </p>
                  ))}
                  {teas.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-[#1b261b]/10">
                      <span className="text-[11px] font-mono tracking-widest uppercase text-[#4a584a] block mb-3">
                        From this garden
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {teas.map((tea) => (
                          <Link
                            key={tea.id}
                            to={`/product/${tea.slug}`}
                            className="flex items-center gap-3 border border-[#1b261b]/15 hover:border-[#8bb56e] rounded-xl pl-1.5 pr-4 py-1.5 transition-colors group"
                          >
                            <img src={tea.imageSrc} alt={tea.name} loading="lazy" width={72} height={80} className="w-9 h-10 object-cover rounded-lg" />
                            <span>
                              <span className="block text-xs font-bold group-hover:text-[#4a7333] transition-colors">{tea.name}</span>
                              <span className="block text-[11px] text-[#4a584a]">from {formatINR(tea.fromPrice ?? 0)}</span>
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <Link
            to="/shop"
            className="inline-block bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-4 px-10 rounded-lg transition-colors"
          >
            Shop the Collection
          </Link>
        </div>
      </div>
    </div>
  )
}
