import { type Product, type Garden } from '../data/products'
import { Link } from '../lib/router'

/** The Origin / Flavor Profile / Brewing Guide card grid on the product page. */
export default function ProductInfoCards({ product, garden }: { product: Product; garden?: Garden }) {
  const cards = [product.origin, product.flavorProfile, product.brewingGuide].filter(Boolean).length
  if (cards === 0) return null

  // Track count follows the cards that actually render, so a product with only
  // a brewing guide doesn't leave two empty columns.
  const columns = cards === 1 ? 'md:grid-cols-1 md:max-w-md' : cards === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'

  return (
    <div className={`grid grid-cols-1 ${columns} gap-6 mb-24`}>
      {product.origin && (
        <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
          <span className="text-[#4a7333] text-[11px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-2 mb-4">Tea Origin</span>
          <dl className="space-y-2 text-xs">
            {(
              [
                ['Origin', product.origin.origin],
                ['Estate', product.origin.estate],
                ['Elevation', product.origin.elevation],
                ['Harvest', product.origin.harvest],
                ['Cultivar', product.origin.cultivar],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-[#4a584a]">{label}</dt>
                <dd className="font-medium text-right">
                  {label === 'Estate' && garden ? (
                    <Link to="/gardens" className="underline decoration-[#8bb56e]/50 underline-offset-2 hover:text-[#4a7333] transition-colors">
                      {value}
                    </Link>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {garden && (
            <Link to="/gardens" className="inline-block mt-4 text-[11px] font-mono tracking-widest uppercase text-[#4a7333] hover:text-[#1b261b] transition-colors">
              Visit the garden →
            </Link>
          )}
        </div>
      )}

      {product.flavorProfile && (
        <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
          <span className="text-[#4a7333] text-[11px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-2 mb-4">Flavor Profile</span>
          <div className="space-y-3 text-xs">
            {(
              [
                ['Strength', product.flavorProfile.strength],
                ['Astringency', product.flavorProfile.astringency],
                ['Sweetness', product.flavorProfile.sweetness],
                ['Floral', product.flavorProfile.floral],
                ['Caffeine', product.flavorProfile.caffeine],
              ] as [string, number][]
            ).map(([label, value]) => (
              <div key={label}>
                <div className="flex justify-between mb-1">
                  <span className="text-[#4a584a]">{label}</span>
                  <span className="font-mono">{value}/5</span>
                </div>
                <div className="h-1 bg-[#1b261b]/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#8bb56e] rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {product.brewingGuide && (
        <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
          <span className="text-[#4a7333] text-[11px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-2 mb-4">Brewing Guide</span>
          <dl className="space-y-2 text-xs">
            {[
              ['Temperature', product.brewingGuide.temperature],
              ['Steep time', product.brewingGuide.time],
              ['Steeps', product.brewingGuide.steeps],
              ['Leaf', product.brewingGuide.leafAmount],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-[#4a584a]">{label}</dt>
                <dd className="font-medium text-right">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-[#4a584a] italic mt-4 leading-relaxed">{product.brewingGuide.notes}</p>
        </div>
      )}
    </div>
  )
}
