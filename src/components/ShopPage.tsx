import ProductsSection from './ProductsSection'
import TrustBadgesSection from './TrustBadgesSection'
import NewsletterSection from './NewsletterSection'
import SkeletonImage from './SkeletonImage'
import { useDocumentMeta, useHashRoute, parseRoute } from '../lib/router'

export default function ShopPage() {
  useDocumentMeta(
    'Shop the Collection — Elegant Sip',
    'Single-origin whole-leaf teas sourced directly from estate gardens. Oolong, green, and white teas, plus curated collections.',
  )

  // Deep links like #/shop?q=whole-leaf still filter the grid (the search UI
  // itself was removed; the declared SearchAction keeps working via the URL).
  const route = useHashRoute()
  const q = parseRoute(route).query.get('q') ?? ''

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans">
      {/* Banner — terraced garden backdrop */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <SkeletonImage
            src="/shopimg.webp"
            alt=""
            aria-hidden="true"
            width={1920}
            height={1080}
            wrapperClassName="w-full h-full"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Legibility scrim */}
        <div className="absolute inset-0 bg-[#0c130c]/55" />

        {/* Scroll hint (same treatment as the homepage's expanding hero) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
          <span className="text-white/40 text-[10px] font-mono tracking-[0.3em] uppercase">Scroll</span>
          <div className="w-[1px] h-8 bg-gradient-to-b from-white/40 to-transparent animate-pulse" />
        </div>

        <div className="relative min-h-[60vh] md:min-h-[102vh] flex flex-col items-center justify-center py-24 px-6 md:px-12 text-center max-w-3xl mx-auto">
          <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-5">
            The Collection
          </span>
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tight leading-[1.05] mb-6 text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.35)]">
            Teas from <span className="text-[#8bb56e]">Named Gardens</span>
          </h1>
          <p className="text-white/80 text-sm md:text-base leading-relaxed">
            Every pack names its garden, its harvest, and its cultivar. No blending, no auction houses,
            no anonymity — just single-origin leaves at their seasonal peak.
          </p>
        </div>
      </div>

      <ProductsSection showFilters searchQuery={q} />

      <TrustBadgesSection />
      <NewsletterSection />
    </div>
  )
}
