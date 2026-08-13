import ProductCard from './ProductCard'
import { PRODUCTS } from '../data/products'
import { useUi } from './UiContext'
import { useScrollReveal } from '../lib/useScrollReveal'

interface ProductsSectionProps {
  showHeading?: boolean
}

export default function ProductsSection({ showHeading = true }: ProductsSectionProps) {
  const { openQuiz } = useUi()
  const sectionRef = useScrollReveal<HTMLElement>({ target: ':scope > div' })
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *', stagger: 0.15 })

  return (
    <section ref={sectionRef} className="px-6 md:px-12 lg:px-16 py-32 max-w-[1400px] mx-auto bg-[#f9faf7]">
      {showHeading && (
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Signature Blends</span>
          <h2 className="text-[#1b261b] text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-tight mb-6">Our Collections</h2>
          <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
            Hand-selected whole leaf teas sourced directly from estate gardens and packaged to preserve complex terroir and freshness.
          </p>
        </div>
      )}

      {/* Taste Matcher teaser */}
      <div className="max-w-6xl mx-auto mb-10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#1b261b]/10 rounded-2xl px-6 py-5 shadow-[0_4px_20px_rgba(27,38,27,0.03)]">
        <div className="flex items-center gap-3">
          <div className="bg-[#8bb56e]/10 p-2.5 rounded-lg text-[#8bb56e] flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
            </svg>
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold tracking-wide uppercase text-[#1b261b]">Not sure where to begin?</h4>
            <p className="text-[11px] text-[#4a584a] mt-0.5">Take the 10-second Taste Matcher and we'll find your perfect cup.</p>
          </div>
        </div>
        <button
          onClick={openQuiz}
          className="bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-[10px] font-mono tracking-wider font-bold py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-center uppercase flex-shrink-0"
        >
          Start Discovery
        </button>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 max-w-6xl mx-auto">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
