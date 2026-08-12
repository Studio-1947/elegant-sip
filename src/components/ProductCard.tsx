import { useState } from 'react'

export interface Product {
  id: string
  name: string
  price: number
  description: string
  imageSrc: string
}

export default function ProductCard({ name, price, description, imageSrc }: Product) {
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)

  const handleDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1)
  }

  const handleIncrease = () => {
    setQuantity(quantity + 1)
  }

  const handleAddToCart = () => {
    setIsAdding(true)
    setTimeout(() => {
      setIsAdding(false)
      setIsAdded(true)
      setTimeout(() => {
        setIsAdded(false)
      }, 2000)
    }, 800)
  }

  return (
    <div className="group bg-white rounded-2xl border border-[#1b261b]/10 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)] hover:-translate-y-1">
      {/* Product Image Wrapper */}
      <div className="relative aspect-[4/5] bg-[#fdfdfd] overflow-hidden">
        <img 
          src={imageSrc} 
          alt={name} 
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
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
