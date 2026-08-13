import { useState } from 'react'
import { useCart } from './CartContext'

export interface FlavorProfile {
  strength: number
  astringency: number
  sweetness: number
  floral: number
  caffeine: number
}

export interface TeaOrigin {
  origin: string
  estate: string
  elevation: string
  harvest: string
  cultivar: string
}

export interface Product {
  id: string
  name: string
  price: number
  description: string
  imageSrc: string
  flavorProfile?: FlavorProfile
  origin?: TeaOrigin
}

export default function ProductCard({ id, name, price, description, imageSrc, flavorProfile, origin }: Product) {
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const { addToCart } = useCart()

  const handleDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1)
  }

  const handleIncrease = () => {
    setQuantity(quantity + 1)
  }

  const handleAddToCart = () => {
    setIsAdding(true)
    addToCart({ id, name, price, imageSrc }, quantity)
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
            className={`text-xs leading-none ${i < value ? 'text-[#8bb56e]' : 'text-white/20'}`}
          >
            ●
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="group bg-white rounded-2xl border border-[#1b261b]/10 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)] hover:-translate-y-1">
      {/* Product Image Wrapper with Hover Overlay */}
      <div className="relative aspect-[4/5] bg-[#fdfdfd] overflow-hidden">
        <img 
          src={imageSrc} 
          alt={name} 
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        
        {/* Hover Details Panel (Option C) */}
        {(flavorProfile || origin) && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm text-white p-6 flex flex-col justify-between opacity-0 translate-y-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-500 ease-out z-10">
            {/* Origin Details */}
            {origin && (
              <div className="space-y-2">
                <span className="text-[#8bb56e] text-[10px] font-mono tracking-wider uppercase block border-b border-white/10 pb-1">Tea Origin</span>
                <div className="grid grid-cols-2 gap-y-1 text-xs">
                  <span className="text-white/60">Origin:</span>
                  <span className="text-right font-medium">{origin.origin}</span>
                  
                  <span className="text-white/60">Estate:</span>
                  <span className="text-right font-medium">{origin.estate}</span>
                  
                  <span className="text-white/60">Elevation:</span>
                  <span className="text-right font-medium">{origin.elevation}</span>
                  
                  <span className="text-white/60">Harvest:</span>
                  <span className="text-right font-medium">{origin.harvest}</span>
                  
                  <span className="text-white/60">Cultivar:</span>
                  <span className="text-right font-medium">{origin.cultivar}</span>
                </div>
              </div>
            )}

            {/* Flavor Profile Details */}
            {flavorProfile && (
              <div className="space-y-2">
                <span className="text-[#8bb56e] text-[10px] font-mono tracking-wider uppercase block border-b border-white/10 pb-1">Flavor Profile</span>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Strength:</span>
                    {renderDots(flavorProfile.strength)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Astringency:</span>
                    {renderDots(flavorProfile.astringency)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Sweetness:</span>
                    {renderDots(flavorProfile.sweetness)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Floral:</span>
                    {renderDots(flavorProfile.floral)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60">Caffeine:</span>
                    {renderDots(flavorProfile.caffeine)}
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-[10px] font-mono text-center text-[#8bb56e] animate-pulse">
              Hover to close • Add to cart below
            </div>
          </div>
        )}
      </div>

      {/* Info Block */}
      <div className="p-6 md:p-8 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-[#1b261b] text-lg lg:text-xl font-bold font-sans tracking-wide">{name}</h3>
          <span className="text-[#1b261b] text-base lg:text-lg font-bold">${price}.00</span>
        </div>
        <p className="text-[#4a584a] text-xs leading-relaxed mb-6 flex-grow">{description}</p>

        {/* Quantity & CTA Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch mt-auto">
          {/* Quantity Selector */}
          <div className="flex items-center justify-between border border-[#1b261b]/20 rounded-lg px-4 py-2 sm:w-28 bg-[#f9faf7]">
            <button 
              onClick={handleDecrease}
              className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="text-[#1b261b] font-mono text-sm font-semibold select-none">{quantity}</span>
            <button 
              onClick={handleIncrease}
              className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button 
            onClick={handleAddToCart}
            disabled={isAdding || isAdded}
            className={`flex-grow text-xs font-bold tracking-widest uppercase py-3 px-6 rounded-lg transition-all duration-300 active:scale-[0.98] ${
              isAdded 
                ? 'bg-[#8bb56e] text-white' 
                : isAdding
                ? 'bg-[#1b261b]/50 text-white/50 cursor-wait'
                : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white'
            }`}
          >
            {isAdding ? 'Adding...' : isAdded ? 'Added ✓' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
