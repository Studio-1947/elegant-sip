import ProductsSection from './ProductsSection'
import TrustBadgesSection from './TrustBadgesSection'
import NewsletterSection from './NewsletterSection'
import { useDocumentMeta, useJsonLd, useRoute, parseRoute } from '../lib/router'
import { PRODUCTS, isInStock } from '../data/products'
import { absoluteUrl } from '../lib/site'
import { RUPEE } from '../lib/currency'
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
        <ProductsSection headingLevel="h1" showFilters searchQuery={q} />
      </main>

      <TrustBadgesSection />
      <NewsletterSection />
    </div>
  )
}
