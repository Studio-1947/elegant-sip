import ProductsSection from './ProductsSection'
import TrustBadgesSection from './TrustBadgesSection'
import NewsletterSection from './NewsletterSection'
import SkeletonImage from './SkeletonImage'
import { useDocumentMeta, useJsonLd, useRoute, parseRoute } from '../lib/router'
import { PRODUCTS, isInStock } from '../data/products'
import { absoluteUrl } from '../lib/site'
import { ROUTE_META } from '../lib/seoRoutes'

export default function ShopPage() {
  useDocumentMeta(ROUTE_META['/shop'].title, ROUTE_META['/shop'].description, {
    canonical: '/shop',
    image: '/shopimg.webp',
  })

  // CollectionPage + ItemList so the catalogue itself is eligible for rich
  // results, not just the individual product pages.
  useJsonLd(
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Darjeeling Tea Collection',
      description: ROUTE_META['/shop'].description,
      url: absoluteUrl('/shop'),
      isPartOf: { '@id': 'https://elegantsip.in/#website' },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: PRODUCTS.length,
        itemListElement: PRODUCTS.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Product',
            name: product.name,
            url: absoluteUrl(`/product/${product.slug}`),
            image: absoluteUrl(product.imageSrc),
            category: product.category,
            ...(product.status !== 'coming-soon'
              ? {
                offers: {
                  '@type': 'Offer',
                  priceCurrency: 'INR',
                  price: product.fromPrice ?? 0,
                  availability: isInStock(product)
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
                },
              }
              : {}),
          },
        })),
      },
    },
    'shop-jsonld',
  )

  // Deep links like /shop?q=whole-leaf still filter the grid.
  const route = useRoute()
  const q = parseRoute(route).query.get('q') ?? ''

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans">
      {/* Banner — terraced garden backdrop */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <SkeletonImage
            src="/shopimg.webp"
            alt="Terraced Darjeeling tea garden in morning mist"
            width={1920}
            height={1080}
            fetchPriority="high"
            wrapperClassName="w-full h-full"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Legibility scrim */}
        <div className="absolute inset-0 bg-[#0c130c]/55" />

        {/* Scroll hint (same treatment as the homepage's expanding hero) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
          <span className="text-white/70 text-[11px] font-mono tracking-[0.3em] uppercase">Scroll</span>
          <div className="w-[1px] h-8 bg-gradient-to-b from-white/40 to-transparent animate-pulse" />
        </div>

        <div className="relative min-h-[100vh] md:min-h-[102vh] flex flex-col items-center justify-center py-24 px-6 md:px-12 text-center max-w-3xl mx-auto">
          <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-5">
            The Collection
          </span>
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tight leading-[1.05] mb-6 text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.35)]">
            Buy <span className="text-[#a8cf8a]">Darjeeling Tea</span> from Named Gardens
          </h1>
          <p className="text-white/85 text-sm md:text-base leading-relaxed">
            Every pack names its garden, its harvest, and its grade. No blending, no auction houses,
            no anonymity — just single-origin Darjeeling leaves at their seasonal peak.
          </p>
        </div>
      </div>

      <ProductsSection showFilters searchQuery={q} />

      <TrustBadgesSection />
      <NewsletterSection />
    </div>
  )
}
