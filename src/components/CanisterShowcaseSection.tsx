import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

export default function CanisterShowcaseSection() {
  const showcaseRef = useRef<HTMLDivElement>(null)
  const textOverlayRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!textOverlayRef.current || !showcaseRef.current) return

    gsap.fromTo(
      textOverlayRef.current,
      {
        opacity: 0,
        y: 40,
      },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: showcaseRef.current,
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
      }
    )
  }, { scope: showcaseRef })

  return (
    <div className="w-full overflow-hidden relative" ref={showcaseRef}>
      <img
        src="/tea1_1.png"
        alt="Ember Charm Tea Canister"
        loading="lazy"
        className="w-full h-auto block object-cover"
      />
      
      {/* Text Overlay on the Left Side */}
      <div 
        ref={textOverlayRef}
        className="absolute left-[6%] md:left-[10%] top-[10%] sm:top-[15%] md:top-[20%] max-w-[45%] sm:max-w-[40%] text-left z-10 select-none opacity-0"
      >
        <span className="text-[#8bb56e] text-[10px] sm:text-xs md:text-sm font-mono tracking-[0.3em] uppercase block mb-1 sm:mb-2 md:mb-4">
          Single Origin
        </span>
        <h2 className="text-[#1b261b] text-xl sm:text-2xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight leading-[1.1] mb-2 sm:mb-4 md:mb-6">
          Darjeeling's<br />
          <span className="text-[#8bb56e]">Finest</span>
        </h2>
        <p className="text-[#4a584a] text-[10px] sm:text-xs md:text-sm leading-relaxed font-light hidden sm:block max-w-sm">
          Harvested from high-altitude estates in the mist-shrouded Darjeeling hills. Hand-plucked, gently processed, and curated to preserve the delicate, signature muscatel flavor profile in every cup.
        </p>
      </div>

      {/* Stronger blur gradient overlay at the bottom for smooth transition to light background */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#f9faf7] via-[#f9faf7] via-[#f9faf7]/60 to-transparent pointer-events-none backdrop-blur-[1px]" />
    </div>
  )
}
