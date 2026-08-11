import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const START_FRAME = 1
const END_FRAME = 102
const TOTAL_FRAMES = END_FRAME - START_FRAME + 1 // 102

const getLoadingMessage = (percent: number) => {
  if (percent < 20) return "Gathering the harvest..."
  if (percent < 40) return "Selecting the finest leaves..."
  if (percent < 65) return "Preparing the sensory flight..."
  if (percent < 85) return "Refining the steeping temperature..."
  return "Enjoying the first sip..."
}

export default function TeaVectorHomepage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const currentFrameRef = useRef<number>(START_FRAME)
  const imagesRef = useRef<{ [key: number]: HTMLImageElement }>({})
  const requestRef = useRef<number | null>(null)
  const [loadedCount, setLoadedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fadeLoader, setFadeLoader] = useState(false)
  const [isNavbar, setIsNavbar] = useState(false)

  // Render a specific frame (index 1 to 273) dynamically onto the Canvas stage
  const renderFrame = (frameIndex: number) => {
    currentFrameRef.current = frameIndex
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const displayWidth = window.innerWidth
    const displayHeight = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr
      canvas.height = displayHeight * dpr
    }

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, displayWidth, displayHeight)

    // Calculate aspect-ratio cover positioning for 2560x1440 stage inside window
    const stageW = 2560
    const stageH = 1440
    const stageRatio = stageW / stageH
    const displayRatio = displayWidth / displayHeight

    let scale = displayWidth / stageW
    let offsetX = 0
    let offsetY = 0

    if (displayRatio > stageRatio) {
      scale = displayWidth / stageW
      offsetY = (displayHeight - stageH * scale) / 2
    } else {
      scale = displayHeight / stageH
      offsetX = (displayWidth - stageW * scale) / 2
    }

    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)

    // Draw the image if loaded
    const img = imagesRef.current[frameIndex]
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, stageW, stageH)
    } else {
      // Fallback: search for the nearest loaded frame to prevent flickering
      let nearestImg = null
      let minDiff = Infinity
      for (let i = START_FRAME; i <= END_FRAME; i++) {
        const loadedImg = imagesRef.current[i]
        if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
          const diff = Math.abs(i - frameIndex)
          if (diff < minDiff) {
            minDiff = diff
            nearestImg = loadedImg
          }
        }
      }
      if (nearestImg) {
        ctx.drawImage(nearestImg, 0, 0, stageW, stageH)
      } else {
        // Fallback color while loading first image
        ctx.fillStyle = '#060b08'
        ctx.fillRect(0, 0, stageW, stageH)
      }
    }

    ctx.restore()
  }

  // Preload all WebP frames on mount
 useEffect(() => {
  const loadedImages: { [key: number]: HTMLImageElement } = {}
  let count = 0

  for (let i = START_FRAME; i <= END_FRAME; i++) {
    const img = new Image()
    img.src = `/webp/frame (${i}).jpg`
    loadedImages[i] = img

    const markLoaded = () => {
      count++
      setLoadedCount(count)
      if (i === currentFrameRef.current) {
        renderFrame(currentFrameRef.current)
      }
    }

    img.onload = () => {
      img
        .decode()
        .then(markLoaded)
        .catch(markLoaded) // decode() can reject on some browsers/edge cases — still proceed
    }

    img.onerror = () => {
      console.error(`Failed to load frame: /webp/frame (${i}).jpg`)
    }
  }

  imagesRef.current = loadedImages
}, [])

  // Handle loader fade out when all images are loaded
  useEffect(() => {
    if (loadedCount === TOTAL_FRAMES) {
      setFadeLoader(true)
      const timer = setTimeout(() => {
        setLoading(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [loadedCount])

  // Setup resize listeners and render initial frame
  useEffect(() => {
    const handleResize = () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
      requestRef.current = requestAnimationFrame(() => {
        renderFrame(currentFrameRef.current)
      })
    }

    // Small delay to ensure browser layout has resolved on load
    const timer = setTimeout(() => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
      requestRef.current = requestAnimationFrame(() => {
        renderFrame(START_FRAME)
      })
    }, 100)

    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

 useGSAP(
  () => {
    renderFrame(START_FRAME)

    const scrollTriggerInstance = ScrollTrigger.create({
      trigger: '#video-scroll-track',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.1,
      onUpdate: (self) => {
        const frameIndex = Math.min(
          END_FRAME,
          Math.max(START_FRAME, Math.round(START_FRAME + self.progress * (TOTAL_FRAMES - 1)))
        )

        if (frameIndex !== currentFrameRef.current) {
          renderFrame(frameIndex)
        }

        const isAtEnd = self.progress > 0.95
        setIsNavbar(isAtEnd)
      },
    })

    return () => {
      scrollTriggerInstance.kill()
    }
  },
  { scope: containerRef },
)

  const loadingPercentage = Math.round((loadedCount / TOTAL_FRAMES) * 100)

  // Center when scrolling, top-left when animation ends
  const brandStyle = isNavbar 
    ? {
        left: '32px',
        transform: 'translate(0, 0)',
      }
    : {
        left: '50%',
        transform: 'translate(-50%, 2vh)',
      }

  return (
    <div ref={containerRef} className="relative bg-black min-h-screen">
      {/* Premium Full-Screen Loading Overlay */}
      {loading && (
        <div 
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#060b08] transition-opacity duration-1000 ease-in-out ${
            fadeLoader ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="text-center space-y-6">
            <h1 className="text-white text-5xl md:text-6xl font-extrabold tracking-tight uppercase font-sans animate-pulse">
              Elegant Sip
            </h1>
            <p className="text-[#8bb56e] text-sm font-mono tracking-widest uppercase">
              The Journey of Tea
            </p>
            <div className="w-64 h-[1px] bg-white/10 mx-auto relative overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-[#8bb56e] transition-all duration-300 ease-out"
                style={{ width: `${loadingPercentage}%` }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-white/60 text-xs font-light italic">
                {getLoadingMessage(loadingPercentage)}
              </p>
              <p className="text-white/30 text-[10px] font-mono tracking-wider">
                Loading Experience... {loadingPercentage}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Header & Navigation Bar */}
      {!loading && (
        <header 
          className={`fixed top-0 left-0 right-0 z-40 px-8 py-6 transition-all duration-700 ease-in-out ${
            isNavbar 
              ? 'bg-black/60 backdrop-blur-md border-b border-white/5 h-20' 
              : 'bg-transparent h-32 pointer-events-none'
          }`}
        >
          {/* Brand Container (Centered when scrolling, Top-Left when finished) */}
          <div 
            style={brandStyle} 
            className={`absolute top-6 flex items-center transition-all duration-700 ease-in-out pointer-events-auto ${
              isNavbar ? 'flex-row gap-3' : 'flex-col gap-3 text-center'
            }`}
          >
            {/* Custom SVG Logo (Minimalist tea leaf line art) */}
            <svg 
              viewBox="0 0 100 100" 
              className={`transition-all duration-700 ease-in-out fill-none stroke-current text-[#8bb56e] ${
                isNavbar ? 'w-8 h-8' : 'w-16 h-16'
              }`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M50 20 C65 35 75 55 50 80 C25 55 35 35 50 20 Z" />
              <path d="M50 20 C50 40 50 60 50 80" strokeWidth="1.5" />
              <path d="M50 40 Q60 45 68 38" strokeWidth="1" />
              <path d="M50 50 Q40 55 32 48" strokeWidth="1" />
              <path d="M50 60 Q62 65 65 58" strokeWidth="1" />
              <path d="M50 70 Q38 75 35 68" strokeWidth="1" />
            </svg>

            <span 
              className={`font-sans uppercase transition-all duration-700 ease-in-out text-white font-bold ${
                isNavbar ? 'text-xl tracking-tight' : 'text-5xl md:text-6xl tracking-tight'
              }`}
            >
              Elegant Sip
            </span>
          </div>

          {/* Right Action Container (Cart & User CTAs - active when navbar is active) */}
          <div 
            className={`absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-6 transition-all duration-700 ease-in-out ${
              isNavbar ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-90'
            }`}
          >
            {/* Cart Button */}
            <button className="text-white hover:text-[#8bb56e] transition-colors relative p-2 focus:outline-none cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="absolute top-0 right-0 w-2 h-2 bg-[#8bb56e] rounded-full animate-ping" />
            </button>

            {/* Login CTA */}
            <button className="px-5 py-2 border border-white/20 hover:border-[#8bb56e] rounded-full text-xs font-mono tracking-wider uppercase text-white hover:bg-[#8bb56e] hover:text-black transition-all duration-300 cursor-pointer">
              Login
            </button>
          </div>
        </header>
      )}

      {/* Fixed Fullscreen Canvas Stage */}
      <div className="fixed inset-0 z-0 h-full w-full overflow-hidden bg-black">
        <canvas
          ref={canvasRef}
          className="h-full w-full object-cover block"
        />
      </div>

      {/* 500vh Scroll Runway for Frame Scrubbing */}
      <div id="video-scroll-track" className="relative z-10 h-[500vh] pointer-events-none" />
    </div>
  )
}
