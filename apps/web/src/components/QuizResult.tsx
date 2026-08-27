import { useState } from 'react'
import { useCart } from './CartContext'
import { getDefaultVariant, type Product } from '../data/products'
import { formatINR } from '../lib/currency'
import { Link } from '../lib/router'
import { track } from '../lib/analytics'

/* Compact brew-stat values parsed from the full brewing guide strings. */
const celsius = (temperature: string) =>
  temperature.split('/').map((s) => s.trim()).find((s) => s.includes('°C')) ?? temperature
const shortTime = (time: string) => time.replace('minutes', 'min').replace('minute', 'min')
const shortLeaf = (leafAmount: string) => leafAmount.split(' per ')[0]

/** Staggered-reveal result card for the Taste Matcher. */
export default function QuizResult({ match, onClose, onReset }: { match: Product; onClose: () => void; onReset: () => void }) {
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const { addToCart } = useCart()

  const handleAddToCart = () => {
    const variant = getDefaultVariant(match)
    setIsAdding(true)
    addToCart({ productSlug: match.slug, name: match.name, price: variant.price, imageSrc: match.imageSrc, size: variant.size }, 1)
    track('add_to_cart', { product: match.slug, source: 'quiz' })
    setTimeout(() => {
      setIsAdding(false)
      setIsAdded(true)
      setTimeout(() => setIsAdded(false), 2000)
    }, 800)
  }

  const delay = (s: number) => ({ animationDelay: `${s}s` })

  return (
    <div className="flex flex-col py-2">
      {/* Header */}
      <div className="mb-6">
        <span className="qz-rise block text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase mb-1">Your Tea Match</span>
        <h2 className="qz-rise text-3xl md:text-4xl font-bold font-sans tracking-tight text-[#1b261b]" style={delay(0.08)}>
          {match.name}
        </h2>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left: image + description */}
        <div className="w-full md:w-1/2 flex flex-col">
          <div className="relative mb-4">
            {/* Radiating reveal ring */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl border-2 border-[#8bb56e]"
              style={{ animation: 'qz-ring 1s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both' }}
            />
            <div className="qz-pop relative aspect-[4/5] w-full bg-white rounded-2xl overflow-hidden border border-[#1b261b]/10 shadow-[0_4px_12px_rgba(27,38,27,0.02)]" style={delay(0.12)}>
              <img src={match.imageSrc} alt={match.name} width={800} height={1000} className="w-full h-full object-cover" />
            </div>
          </div>
          <p className="qz-rise text-xs text-[#4a584a] leading-relaxed" style={delay(0.3)}>{match.description}</p>
          <Link
            to={`/product/${match.slug}`}
            onClick={onClose}
            className="qz-rise text-xs font-mono tracking-widest uppercase text-[#4a7333] hover:text-[#1b261b] transition-colors mt-4"
            style={delay(0.38)}
          >
            View full details →
          </Link>
        </div>

        {/* Right: tasting notes, body meter, brew stats, CTAs */}
        <div className="w-full md:w-1/2 flex flex-col self-stretch gap-4">
          {match.tastingNotes && match.tastingNotes.length > 0 && (
            <div className="qz-rise bg-white border border-[#1b261b]/10 p-4 rounded-2xl" style={delay(0.2)}>
              <span className="text-[#4a7333] text-[11px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-1.5 mb-3">Tasting Notes</span>
              <div className="flex flex-wrap gap-1.5">
                {match.tastingNotes.map((note, i) => (
                  <span key={note} className="qz-pop border border-[#1b261b]/15 rounded-full px-3 py-1 text-[11px] text-[#4a584a]" style={delay(0.35 + i * 0.08)}>
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}

          {match.bodyLevel !== null && (
            <div className="qz-rise bg-white border border-[#1b261b]/10 p-4 rounded-2xl" style={delay(0.28)}>
              <span className="text-[#4a7333] text-[11px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-1.5 mb-3">Cup Body</span>
              <div className="flex justify-between text-[11px] font-mono tracking-[0.2em] uppercase text-[#4a584a] mb-1.5">
                <span>Light</span>
                <span>Body</span>
                <span>Full</span>
              </div>
              <div className="h-[3px] bg-[#1b261b]/10 rounded-full overflow-hidden">
                <div
                  className="qz-grow h-full bg-[#b0782e] rounded-full"
                  style={{ width: `${(match.bodyLevel / 5) * 100}%`, animationDelay: '0.5s' }}
                />
              </div>
            </div>
          )}

          {match.brewingGuide && (
            <div className="qz-rise grid grid-cols-3 divide-x divide-[#1b261b]/10 bg-white border border-[#1b261b]/10 rounded-2xl" style={delay(0.36)}>
              {(
                [
                  [celsius(match.brewingGuide.temperature), 'Water'],
                  [shortTime(match.brewingGuide.time), 'Steep'],
                  [shortLeaf(match.brewingGuide.leafAmount), 'Per Cup'],
                ] as [string, string][]
              ).map(([value, label]) => (
                <div key={label} className="text-center py-3 px-1">
                  <p className="text-xs font-bold text-[#1b261b] whitespace-nowrap">{value}</p>
                  <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#4a584a] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="qz-rise flex flex-col gap-2.5 pt-1 mt-auto" style={delay(0.44)}>
            <button
              onClick={handleAddToCart}
              disabled={isAdding || isAdded}
              className={`w-full text-xs font-bold tracking-widest uppercase py-3 px-6 rounded-xl transition-all duration-300 active:scale-[0.98] cursor-pointer ${
                isAdded
                  ? 'bg-[#8bb56e] text-white'
                  : isAdding
                  ? 'bg-[#1b261b]/50 text-white/50 cursor-wait'
                  : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white shadow-md'
              }`}
            >
              {isAdding ? 'Adding...' : isAdded ? 'Added ✓' : `Add Match to Cart • ${formatINR(match.fromPrice ?? 0)}`}
            </button>
            <button
              onClick={onReset}
              className="w-full border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#1b261b]/5 text-[#1b261b] text-xs font-bold tracking-widest uppercase py-2.5 px-6 rounded-xl transition-all duration-300 cursor-pointer"
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
