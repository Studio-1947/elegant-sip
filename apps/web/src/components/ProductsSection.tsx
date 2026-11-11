import { useEffect, useMemo, useState } from 'react'
import ProductCard from './ProductCard'
import ProductTile from './ProductTile'
import { Link } from '../lib/router'
import { PRODUCTS } from '../data/products'
import { useLiveCatalogue } from '../lib/liveCatalogue'
import { useUi } from './UiContext'
import SelectDropdown from './SelectDropdown'
import BlurText from './BlurText'
import { useScrollReveal } from '../lib/useScrollReveal'

// Catalogue order, not alphabetical: First Flush → Second Flush → Third Flush.

const SORT_OPTIONS = [
  { value: 'featured', label: 'Sort: Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

interface ProductsSectionProps {
  showHeading?: boolean
  /** h1 when the section is the page's main heading (e.g. /shop). */
  headingLevel?: 'h1' | 'h2'
  showFilters?: boolean
  searchQuery?: string
  /**
   * Phone layout. 'shelf' (homepage) is one swipeable row of compact tiles with
   * a link to the full shop; 'grid' (/shop) shows every tea two to a row.
   * Tablet and desktop always use the full card grid.
   */
  mobileLayout?: 'shelf' | 'grid'
}

export default function ProductsSection({ showHeading = true, headingLevel = 'h2', showFilters = false, searchQuery = '', mobileLayout = 'shelf' }: ProductsSectionProps) {
  const { openQuiz } = useUi()
  // Keep heading levels sequential below the section heading (no h1 → h3 skip).
  const SubHeading = headingLevel === 'h1' ? 'h2' : 'h3'
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortValue>('featured')
  const [search, setSearch] = useState(searchQuery)
  const shelf = mobileLayout === 'shelf'
  const sectionRef = useScrollReveal<HTMLElement>({ target: ':scope > div' })
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *', stagger: 0.15 })

  // Sync when the outside query changes (e.g. arriving via a #/shop?q= link)
  useEffect(() => {
    setSearch(searchQuery)
  }, [searchQuery])

  // Bumps when the live catalogue lands, so filters and sorts re-run on it.
  const catalogueVersion = useLiveCatalogue()
  // Read on every render: the live catalogue can change a tea's category.
  const categories = ['All', ...new Set(PRODUCTS.map((p) => p.category))]
  const visibleProducts = useMemo(() => {
    let filtered = category === 'All' ? [...PRODUCTS] : PRODUCTS.filter((p) => p.category === category)
    const q = search.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter((p) =>
        [p.name, p.description, p.category].some((text) => text.toLowerCase().includes(q)),
      )
    }
    // Coming-soon teas carry price 0; keep them last rather than cheapest.
    const priceKey = (p: (typeof PRODUCTS)[number]) => p.fromPrice ?? Infinity
    if (sort === 'price-asc') filtered.sort((a, b) => priceKey(a) - priceKey(b))
    if (sort === 'price-desc') filtered.sort((a, b) => (b.fromPrice ?? 0) - (a.fromPrice ?? 0))
    // Sorts on the merged (seed + customer) rating the cards actually display;
    // getRating() alone only saw the empty static REVIEWS, so this was a no-op.
    if (sort === 'rating') filtered.sort((a, b) => b.rating.average - a.rating.average)
    return filtered
    // eslint-disable-next-line react-hooks/exhaustive-deps -- catalogueVersion signals in-place catalogue updates
  }, [category, sort, search, catalogueVersion])

  return (
    <section ref={sectionRef} className="px-6 md:px-12 lg:px-16 py-16 md:py-32 max-w-[1400px] mx-auto bg-[#f9faf7]">
      {showHeading && (
        <div className={`${shelf ? 'text-left md:text-center' : 'text-center'} max-w-2xl mx-auto mb-6 md:mb-16`}>
          <span className="text-[#4a7333] text-[11px] md:text-xs font-mono tracking-[0.3em] uppercase block mb-3 md:mb-4">Single-Origin Darjeeling</span>
          <BlurText as={headingLevel} text="Our Collections" delay={120} className={`${shelf ? 'justify-start md:justify-center' : 'justify-center'} text-[#1b261b] text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-tight mb-3 md:mb-6`} />
          <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
            Hand-selected whole leaf teas sourced directly from estate gardens
            <span className="hidden md:inline"> and packaged to preserve complex terroir and freshness</span>.
          </p>
        </div>
      )}

      {/* Taste Matcher — one tappable row on phones */}
      <button
        onClick={openQuiz}
        className="md:hidden w-full mb-6 flex items-center gap-3 text-left bg-[#8bb56e]/10 border border-[#8bb56e]/25 rounded-2xl px-4 py-3 cursor-pointer active:scale-[0.99] transition-transform"
      >
        <span className="bg-[#8bb56e]/20 p-2 rounded-full text-[#4a7333] flex-shrink-0" aria-hidden="true">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </span>
        <span className="flex-grow min-w-0">
          <span className="block text-[13px] font-bold text-[#1b261b] leading-tight">Not sure where to begin?</span>
          <span className="block text-[11px] text-[#4a584a] mt-0.5">Find your tea in 10 seconds</span>
        </span>
        <svg className="w-4 h-4 text-[#4a7333] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Taste Matcher teaser (tablet/desktop) */}
      <div className="hidden md:flex max-w-6xl mx-auto mb-10 flex-row items-center justify-between gap-4 bg-[#8bb56e]/10 md:bg-white border border-[#8bb56e]/20 md:border-[#1b261b]/10 rounded-2xl px-4 md:px-6 py-4 md:py-5 shadow-[0_4px_20px_rgba(27,38,27,0.03)]">
        <div className="flex items-center gap-3">
          <div className="bg-[#8bb56e]/20 md:bg-[#8bb56e]/10 p-2.5 rounded-full md:rounded-lg text-[#4a7333] flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
            </svg>
          </div>
          <div>
            <SubHeading className="text-xs font-mono font-bold tracking-wide uppercase text-[#1b261b]">Not sure where to begin?</SubHeading>
            <p className="text-[11px] text-[#4a584a] mt-0.5">
              Take the 10-second Taste Matcher<span className="hidden md:inline"> and we'll find your perfect cup</span>.
            </p>
          </div>
        </div>
        <button
          onClick={openQuiz}
          className="bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-[11px] font-mono tracking-wider font-bold py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-center uppercase flex-shrink-0"
        >
          <span className="md:hidden">Start</span>
          <span className="hidden md:inline">Start Discovery</span>
        </button>
      </div>

      {/* Search */}
      {showFilters && (
        <div className="max-w-6xl mx-auto mb-4">
          <div className="relative w-full sm:max-w-md sm:mx-auto">
            <label htmlFor="tea-search" className="sr-only">Search teas</label>
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a584a] pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              id="tea-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teas — whole leaf, fannings, muscatel…"
              className="w-full bg-white border border-[#1b261b]/10 rounded-full pl-11 pr-4 py-3 text-sm focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/30"
            />
          </div>
        </div>
      )}

      {showFilters && (
        /* relative z-30: the scroll-reveal leaves an inline transform on this bar
           and on the grid below, making both stacking contexts — without a higher
           z-index here, the grid (later in DOM order) paints over the open dropdown. */
        <div className="relative z-30 max-w-6xl mx-auto mb-6 md:mb-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          {/* Category chips — one swipeable row on phones, wrapping row from sm up */}
          <div className="relative flex overflow-x-auto overflow-y-hidden no-scrollbar -mx-6 px-6 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center items-center gap-2.5 sm:gap-3">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`flex-shrink-0 whitespace-nowrap text-xs font-bold tracking-wide min-h-[44px] px-5 sm:px-6 rounded-full border transition-colors cursor-pointer ${category === c
                  ? 'bg-[#1b261b] border-[#1b261b] text-white'
                  : 'bg-white border-[#1b261b]/10 text-[#1b261b] hover:border-[#8bb56e] hover:text-[#4a7333]'
                  }`}
              >
                {c}
              </button>
            ))}
          </div>
          {/* Phones: result count beside a compact sort. The wrapper dissolves from sm up. */}
          <div className="flex items-center justify-between gap-3 sm:contents">
            <span className="sm:hidden text-xs text-[#4a584a]" aria-live="polite">
              {visibleProducts.length} {visibleProducts.length === 1 ? 'tea' : 'teas'}
            </span>
            <SelectDropdown
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => setSort(v as SortValue)}
              ariaLabel="Sort products"
              className="w-auto flex-shrink-0"
            />
          </div>
        </div>
      )}

      {visibleProducts.length === 0 ? (
        <p className="max-w-6xl mx-auto text-center text-sm text-[#4a584a] bg-white border border-[#1b261b]/10 rounded-2xl py-14 px-6">
          No teas match your search. Try a different word — or take the Taste Matcher above.
        </p>
      ) : (
        <>
          {/* Phones: compact tiles — a swipeable shelf or a two-up grid */}
          {shelf ? (
            <div className="md:hidden">
              <div className="relative flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar gap-3 -mx-6 px-6 scroll-px-6">
                {visibleProducts.map((product) => (
                  <div key={product.id} className="w-[42vw] max-w-[220px] flex-shrink-0 snap-start flex">
                    <ProductTile product={product} />
                  </div>
                ))}
              </div>
              <Link
                to="/shop"
                className="mt-6 flex items-center justify-center gap-2 w-full h-12 rounded-xl border border-[#1b261b]/20 text-[#1b261b] text-xs font-bold tracking-widest uppercase active:scale-[0.99] transition-transform"
              >
                View all {visibleProducts.length} teas
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="md:hidden grid grid-cols-2 gap-x-3 gap-y-8">
              {visibleProducts.map((product) => (
                <div key={product.id} className="flex">
                  <ProductTile product={product} />
                </div>
              ))}
            </div>
          )}

          {/* Tablet and desktop: the full card grid */}
          <div
            ref={gridRef}
            className="relative hidden md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 lg:gap-10 max-w-6xl mx-auto"
          >
            {visibleProducts.map((product) => (
              <div key={product.id} className="flex">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
