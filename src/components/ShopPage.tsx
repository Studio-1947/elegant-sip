import { useEffect, useState } from 'react'
import ProductsSection from './ProductsSection'
import TrustBadgesSection from './TrustBadgesSection'
import NewsletterSection from './NewsletterSection'
import { useDocumentMeta, useHashRoute, parseRoute } from '../lib/router'

export default function ShopPage() {
  useDocumentMeta(
    'Shop the Collection — Elegant Sip',
    'Single-origin whole-leaf teas sourced directly from estate gardens. Oolong, green, and white teas, plus curated collections.',
  )

  const route = useHashRoute()
  const q = parseRoute(route).query.get('q') ?? ''
  const [search, setSearch] = useState(q)

  // Sync when the URL's q param changes (e.g. arriving via a search link)
  useEffect(() => {
    setSearch(q)
  }, [q])

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans">
      {/* Banner */}
      <div className="pt-40 pb-16 px-6 md:px-12 text-center max-w-3xl mx-auto">
        <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-5">
          The Collection
        </span>
        <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tight leading-[1.05] mb-6">
          Teas from <span className="text-[#8bb56e]">Named Gardens</span>
        </h1>
        <p className="text-[#4a584a] text-sm md:text-base leading-relaxed mb-10">
          Every tin names its garden, its harvest, and its cultivar. No blending, no auction houses,
          no anonymity — just single-origin leaves at their seasonal peak.
        </p>

        {/* Search */}
        <div className="relative max-w-md mx-auto">
          <label htmlFor="shop-search" className="sr-only">Search teas</label>
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a584a]/50 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            id="shop-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teas — jasmine, roasted, white…"
            className="w-full bg-white border border-[#1b261b]/15 rounded-full pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/30"
          />
        </div>
      </div>

      <ProductsSection showFilters searchQuery={search} />

      <TrustBadgesSection />
      <NewsletterSection />
    </div>
  )
}
