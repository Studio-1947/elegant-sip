import { formatINR } from '../lib/currency'
import { percentOff } from '../lib/pricing'

interface PriceTagProps {
  price: number
  compareAtPrice?: number | null
  size?: 'card' | 'page'
}

/**
 * Selling price, with the regular price struck out and a "% off" tag beside it
 * when the variant is on offer. With no `compareAtPrice` it is just the price.
 */
export default function PriceTag({ price, compareAtPrice, size = 'card' }: PriceTagProps) {
  const off = percentOff(price, compareAtPrice)
  const page = size === 'page'

  const current = (
    <span className={`text-[#1b261b] font-bold whitespace-nowrap ${page ? 'text-3xl' : 'text-base lg:text-lg'}`}>
      {formatINR(price)}
    </span>
  )
  if (off === null || !compareAtPrice) return current

  return (
    <span className={`inline-flex items-center ${page ? 'flex-wrap gap-3' : 'gap-2'}`}>
      <s className={`text-[#4a584a]/70 whitespace-nowrap ${page ? 'text-lg' : 'text-xs lg:text-sm'}`}>
        <span className="sr-only">Regular price </span>
        {formatINR(compareAtPrice)}
      </s>
      <span
        className={`bg-[#4a7333] text-white font-mono font-bold uppercase tracking-wider rounded-full whitespace-nowrap ${
          page ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'
        }`}
      >
        {off}% off
      </span>
      <span className="sr-only">Offer price </span>
      {current}
    </span>
  )
}
