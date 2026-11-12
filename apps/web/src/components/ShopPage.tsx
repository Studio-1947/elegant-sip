import ProductsSection from './ProductsSection'
import TrustBadgesSection from './TrustBadgesSection'
import NewsletterSection from './NewsletterSection'
import { useDocumentMeta, useJsonLd, useRoute, parseRoute } from '../lib/router'
import { PRODUCTS, isInStock } from '../data/products'
import { absoluteUrl } from '../lib/site'
import { RUPEE } from '../lib/currency'
import { ROUTE_META } from '../lib/seoRoutes'

/** A note to buyers while the packaging changes over. Remove once the new packs are standard. */
function PackagingNotice() {
  return (
    <div role="note" className="max-w-2xl mx-auto mb-8 md:mb-12 flex gap-3 md:gap-4 rounded-2xl border border-[#b0782e]/25 bg-[#fdf6ea] px-4 py-4 md:px-6 md:py-5 text-left">
      <span aria-hidden="true" className="flex-shrink-0 grid h-9 w-9 place-items-center rounded-full bg-[#b0782e]/10 text-[#9a6522]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      </span>
      <div>
        <p className="text-[11px] font-mono font-bold tracking-[0.2em] uppercase text-[#9a6522]">Dear Valued Customer</p>
        <p className="mt-1.5 text-sm leading-relaxed text-[#4a584a]">
          A little note: We&rsquo;re currently refining our packaging. Your order may arrive in transitional packaging but the
          quality and care behind every cup remain unchanged. Thank you for your understanding.
        </p>
      </div>
    </div>
  )
}

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
                  price: (product.fromPrice ?? 0) / RUPEE,
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
      <main className="pt-20">
        <ProductsSection headingLevel="h1" showFilters searchQuery={q} mobileLayout="grid" notice={<PackagingNotice />} />
      </main>

      <TrustBadgesSection />
      <NewsletterSection />
    </div>
  )
}
