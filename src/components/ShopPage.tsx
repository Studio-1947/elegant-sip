import ProductsSection from './ProductsSection'
import TrustBadgesSection from './TrustBadgesSection'
import NewsletterSection from './NewsletterSection'
import { useDocumentMeta } from '../lib/router'

export default function ShopPage() {
  useDocumentMeta(
    'Shop the Collection — Elegant Sip',
    'Single-origin whole-leaf teas sourced directly from estate gardens. Oolong, green, and white teas, plus curated collections.',
  )

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
        <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
          Every tin names its garden, its harvest, and its cultivar. No blending, no auction houses,
          no anonymity — just single-origin leaves at their seasonal peak.
        </p>
      </div>

      <ProductsSection />

      <TrustBadgesSection />
      <NewsletterSection />
    </div>
  )
}
