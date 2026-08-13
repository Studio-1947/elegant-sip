import { useEffect, useRef, useState } from 'react'
import { useCart } from './CartContext'
import { QUIZ_OPTIONS, getProduct, type Product } from '../data/products'
import { Link } from '../lib/router'
import { track } from '../lib/analytics'

interface TeaDiscoveryQuizModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function TeaDiscoveryQuizModal({ isOpen, onClose }: TeaDiscoveryQuizModalProps) {
  const [match, setMatch] = useState<Product | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const { addToCart } = useCart()

  // ESC to close + initial focus (a11y)
  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOptionSelect = (option: string) => {
    const product = getProduct(QUIZ_OPTIONS[option])
    if (!product) return
    setMatch(product)
    track('quiz_completed', { option, match: product.id })
  }

  const handleReset = () => {
    setMatch(null)
    setIsAdded(false)
  }

  const handleAddToCart = () => {
    if (!match) return
    setIsAdding(true)
    addToCart({ id: match.id, name: match.name, price: match.price, imageSrc: match.imageSrc }, 1)
    track('add_to_cart', { product: match.id, source: 'quiz' })
    setTimeout(() => {
      setIsAdding(false)
      setIsAdded(true)
      setTimeout(() => {
        setIsAdded(false)
      }, 2000)
    }, 800)
  }

  const renderDots = (value: number) => {
    return (
      <div className="flex gap-1 items-center">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            className={`text-xs leading-none ${i < value ? 'text-[#8bb56e]' : 'text-[#1b261b]/10'}`}
          >
            ●
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#060b08]/85 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tea discovery quiz"
        className="relative bg-[#f9faf7] text-[#1b261b] rounded-3xl border border-[#1b261b]/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden no-scrollbar shadow-2xl p-6 md:p-10 flex flex-col z-10 transition-transform duration-500 scale-100"
      >
        {/* Close Button */}
        <button
          ref={closeRef}
          onClick={onClose}
          className="absolute top-6 right-6 text-[#1b261b]/50 hover:text-[#1b261b] transition-colors cursor-pointer text-xl font-bold z-20"
          aria-label="Close modal"
        >
          ✕
        </button>

        {!match ? (
          <div className="flex flex-col flex-grow justify-center py-6 text-center">
            <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Tea Discovery Quiz</span>
            <h2 className="text-3xl font-bold tracking-tight mb-8 font-sans text-[#1b261b]">How do you like your tea?</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto w-full">
              {Object.keys(QUIZ_OPTIONS).map((option) => (
                <button
                  key={option}
                  onClick={() => handleOptionSelect(option)}
                  className="w-full text-left px-6 py-4 rounded-xl border border-[#1b261b]/10 bg-white hover:border-[#8bb56e] hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(27,38,27,0.02)] transition-all duration-300 font-sans tracking-wide cursor-pointer flex justify-between items-center group text-[#1b261b]"
                >
                  <span className="font-semibold text-sm">{option}</span>
                  <span className="text-xs text-[#1b261b]/40 group-hover:text-[#8bb56e] transition-colors">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col py-2">
            {/* Header: Title Block */}
            <div className="mb-6">
              <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-1">Your Tea Match</span>
              <h2 className="text-3xl md:text-4xl font-bold font-sans tracking-tight text-[#1b261b]">{match.name}</h2>
            </div>

            {/* Split Grid */}
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Left: Product Image Card & Description */}
              <div className="w-full md:w-1/2 flex flex-col">
                <div className="relative aspect-[4/5] w-full bg-white rounded-2xl overflow-hidden border border-[#1b261b]/10 shadow-[0_4px_12px_rgba(27,38,27,0.02)] mb-4">
                  <img
                    src={match.imageSrc}
                    alt={match.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-[#4a584a] leading-relaxed">{match.description}</p>
                <Link
                  to={`/product/${match.id}`}
                  onClick={onClose}
                  className="text-xs font-mono tracking-widest uppercase text-[#8bb56e] hover:text-[#1b261b] transition-colors mt-4"
                >
                  View full details →
                </Link>
              </div>

              {/* Right: Tea Origin, Flavor Profile & CTA */}
              <div className="w-full md:w-1/2 flex flex-col justify-between self-stretch gap-4">
                {/* Origin Section */}
                {match.origin && (
                  <div className="space-y-2.5 bg-white border border-[#1b261b]/10 p-4 rounded-2xl shadow-[0_4px_12px_rgba(27,38,27,0.02)] flex-grow">
                    <span className="text-[#8bb56e] text-[10px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-1">Tea Origin</span>
                    <div className="grid grid-cols-2 gap-y-1 text-xs">
                      <span className="text-[#4a584a]">Origin:</span>
                      <span className="text-right font-medium text-[#1b261b]">{match.origin.origin}</span>
                      <span className="text-[#4a584a]">Estate:</span>
                      <span className="text-right font-medium text-[#1b261b]">{match.origin.estate}</span>
                      <span className="text-[#4a584a]">Elevation:</span>
                      <span className="text-right font-medium text-[#1b261b]">{match.origin.elevation}</span>
                      <span className="text-[#4a584a]">Harvest:</span>
                      <span className="text-right font-medium text-[#1b261b]">{match.origin.harvest}</span>
                      <span className="text-[#4a584a]">Cultivar:</span>
                      <span className="text-right font-medium text-[#1b261b]">{match.origin.cultivar}</span>
                    </div>
                  </div>
                )}

                {/* Flavor Profile Section */}
                {match.flavorProfile && (
                  <div className="space-y-2.5 bg-white border border-[#1b261b]/10 p-4 rounded-2xl shadow-[0_4px_12px_rgba(27,38,27,0.02)] flex-grow">
                    <span className="text-[#8bb56e] text-[10px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-1">Flavor Profile</span>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[#4a584a]">Strength:</span>
                        {renderDots(match.flavorProfile.strength)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#4a584a]">Astringency:</span>
                        {renderDots(match.flavorProfile.astringency)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#4a584a]">Sweetness:</span>
                        {renderDots(match.flavorProfile.sweetness)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#4a584a]">Floral:</span>
                        {renderDots(match.flavorProfile.floral)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#4a584a]">Caffeine:</span>
                        {renderDots(match.flavorProfile.caffeine)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2.5 pt-1">
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
                    {isAdding ? 'Adding...' : isAdded ? 'Added ✓' : `Add Match to Cart • $${match.price}.00`}
                  </button>

                  <button
                    onClick={handleReset}
                    className="w-full border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#1b261b]/5 text-[#1b261b] text-xs font-bold tracking-widest uppercase py-2.5 px-6 rounded-xl transition-all duration-300 cursor-pointer"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
