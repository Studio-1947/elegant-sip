import { useState } from 'react'
import { useCart } from './CartContext'

interface TeaDiscoveryQuizModalProps {
  isOpen: boolean
  onClose: () => void
}

interface MatchTea {
  id: string
  name: string
  price: number
  tagline: string
  description: string
  imageSrc: string
  origin: {
    origin: string
    estate: string
    elevation: string
    harvest: string
    cultivar: string
  }
  flavorProfile: {
    strength: number
    astringency: number
    sweetness: number
    floral: number
    caffeine: number
  }
}

const MATCHES: Record<string, MatchTea> = {
  "Strong & bold": {
    id: "ember-charm",
    name: "Ember Charm",
    price: 28,
    tagline: "Bold, roasted, wood and dark cacao notes.",
    description: "A deeply oxidized roasted oolong tea layered with warm cinnamon wood, dark cacao, and roasted chestnut notes. Perfect for slow, contemplative afternoons.",
    imageSrc: "/embercharm.webp",
    origin: {
      origin: "Wuyi Mountains, Fujian",
      estate: "Wuyi Rock Garden",
      elevation: "3,200 ft",
      harvest: "Spring Roasted 2026",
      cultivar: "Dahongpao"
    },
    flavorProfile: {
      strength: 5,
      astringency: 3,
      sweetness: 2,
      floral: 1,
      caffeine: 4
    }
  },
  "Light & floral": {
    id: "darjeeling-first-flush",
    name: "Darjeeling First Flush",
    price: 32,
    tagline: "Floral, light-bodied, muscatel notes.",
    description: "An exceptionally rare, light-bodied tea harvested in early spring. Offers delicate floral, fresh moss, and signature sweet muscatel grape notes.",
    imageSrc: "/darjeeling.png",
    origin: {
      origin: "Darjeeling, West Bengal",
      estate: "Margaret's Hope",
      elevation: "4,500 ft",
      harvest: "First Flush 2026",
      cultivar: "AV2"
    },
    flavorProfile: {
      strength: 2,
      astringency: 2,
      sweetness: 4,
      floral: 5,
      caffeine: 3
    }
  },
  "Sweet & aromatic": {
    id: "summer-breeze",
    name: "Summer Breeze",
    price: 26,
    tagline: "Sweet, citrusy, crisp and clean.",
    description: "A delicate sun-dried white peony tea balanced with organic lemongrass and sun-ripened citrus peels. Refreshing, crisp, and clean.",
    imageSrc: "/summerbreeze.webp",
    origin: {
      origin: "Fuding, Fujian",
      estate: "White Tea Valley",
      elevation: "1,800 ft",
      harvest: "Late Spring 2026",
      cultivar: "Fuding Fada"
    },
    flavorProfile: {
      strength: 1,
      astringency: 1,
      sweetness: 4,
      floral: 3,
      caffeine: 1
    }
  },
  "Fresh & grassy": {
    id: "morning-dew",
    name: "Morning Dew",
    price: 24,
    tagline: "Fresh, grassy, clarifying jasmine blossoms.",
    description: "Ethereal first-flush green tea leaves hand-harvested at dawn and naturally scented with night-blooming jasmine flowers. Bright, floral, and clarifying.",
    imageSrc: "/morningdew.webp",
    origin: {
      origin: "Hengxian, Guangxi",
      estate: "Cloud Mist Gardens",
      elevation: "2,800 ft",
      harvest: "Early Spring 2026",
      cultivar: "Yabukita"
    },
    flavorProfile: {
      strength: 2,
      astringency: 3,
      sweetness: 3,
      floral: 5,
      caffeine: 2
    }
  },
  "Spicy": {
    id: "ember-charm",
    name: "Ember Charm",
    price: 28,
    tagline: "Warm spices, cinnamon wood, and chestnut.",
    description: "A deeply oxidized roasted oolong tea layered with warm cinnamon wood, dark cacao, and roasted chestnut notes. Perfect for slow, contemplative afternoons.",
    imageSrc: "/embercharm.webp",
    origin: {
      origin: "Wuyi Mountains, Fujian",
      estate: "Wuyi Rock Garden",
      elevation: "3,200 ft",
      harvest: "Spring Roasted 2026",
      cultivar: "Dahongpao"
    },
    flavorProfile: {
      strength: 5,
      astringency: 3,
      sweetness: 2,
      floral: 1,
      caffeine: 4
    }
  }
}

export default function TeaDiscoveryQuizModal({ isOpen, onClose }: TeaDiscoveryQuizModalProps) {
  const [match, setMatch] = useState<MatchTea | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const { addToCart } = useCart()

  if (!isOpen) return null

  const handleOptionSelect = (option: string) => {
    setMatch(MATCHES[option])
  }

  const handleReset = () => {
    setMatch(null)
    setIsAdded(false)
  }

  const handleAddToCart = () => {
    if (!match) return
    setIsAdding(true)
    addToCart({ id: match.id, name: match.name, price: match.price, imageSrc: match.imageSrc }, 1)
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
      <div className="relative bg-[#f9faf7] text-[#1b261b] rounded-3xl border border-[#1b261b]/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden no-scrollbar shadow-2xl p-6 md:p-10 flex flex-col z-10 transition-transform duration-500 scale-100">
        
        {/* Close Button */}
        <button 
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
              {Object.keys(MATCHES).filter((v, i, a) => a.indexOf(v) === i).map((option) => (
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
                <p className="text-xs text-[#8bb56e] font-mono italic mb-1">{match.tagline}</p>
                <p className="text-xs text-[#4a584a] leading-relaxed">{match.description}</p>
              </div>

              {/* Right: Tea Origin, Flavor Profile & CTA */}
              <div className="w-full md:w-1/2 flex flex-col justify-between self-stretch gap-4">
                {/* Origin Section */}
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

                {/* Flavor Profile Section */}
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
                    {isAdding ? 'Adding...' : isAdded ? 'Added ✓' : 'Add Match to Cart • $' + match.price}
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
