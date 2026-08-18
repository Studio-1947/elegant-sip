import { useMemo, useState } from 'react'
import ProductCard from './ProductCard'
import { PRODUCTS, getRating } from '../data/products'
import { useUi } from './UiContext'
import { useScrollReveal } from '../lib/useScrollReveal'

const CATEGORIES = ['All', ...[...new Set(PRODUCTS.map((p) => p.category))].sort()]

const SORT_OPTIONS = [
  { value: 'featured', label: 'Sort: Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

interface ProductsSectionProps {
  showHeading?: boolean
  showFilters?: boolean
  searchQuery?: string
}

export default function ProductsSection({ showHeading = true, showFilters = false, searchQuery = '' }: ProductsSectionProps) {
  const { openQuiz } = useUi()
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortValue>('featured')
  const sectionRef = useScrollReveal<HTMLElement>({ target: ':scope > div' })
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *', stagger: 0.15 })

  const visibleProducts = useMemo(() => {
    let filtered = category === 'All' ? [...PRODUCTS] : PRODUCTS.filter((p) => p.category === category)
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter((p) =>
        [p.name, p.description, p.category].some((text) => text.toLowerCase().includes(q)),
      )
    }
    if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price)
    if (sort === 'rating') filtered.sort((a, b) => getRating(b.id).average - getRating(a.id).average)
    return filtered
  }, [category, sort, searchQuery])

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

      {showFilters && (
        <div className="max-w-6xl mx-auto mb-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`text-xs font-bold tracking-wide py-2.5 px-6 rounded-full border transition-colors cursor-pointer ${
                  category === c
                    ? 'bg-[#1b261b] border-[#1b261b] text-white'
                    : 'bg-white border-[#1b261b]/10 text-[#1b261b] hover:border-[#8bb56e] hover:text-[#8bb56e]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortValue)}
            aria-label="Sort products"
            className="text-xs font-bold text-[#1b261b] bg-white border border-[#1b261b]/10 rounded-lg py-2.5 px-4 cursor-pointer focus:outline-none focus:border-[#8bb56e] transition-colors"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {visibleProducts.length === 0 ? (
        <p className="max-w-6xl mx-auto text-center text-sm text-[#4a584a] bg-white border border-[#1b261b]/10 rounded-2xl py-14 px-6">
          No teas match your search. Try a different word — or take the Taste Matcher above.
        </p>
      ) : (
        <div ref={gridRef} className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-8 lg:gap-10 max-w-6xl mx-auto">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  )
}
