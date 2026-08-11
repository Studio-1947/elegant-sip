import { useEffect, useRef, useState } from 'react'
import HeroScrollSection from './HeroScrollSection'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const getLoadingMessage = (percent: number) => {
  if (percent < 20) return "Gathering the harvest..."
  if (percent < 40) return "Selecting the finest leaves..."
  if (percent < 65) return "Preparing the sensory flight..."
  if (percent < 85) return "Refining the steeping temperature..."
  return "Enjoying the first sip..."
}

export default function TeaVectorHomepage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [loadingPercentage, setLoadingPercentage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fadeLoader, setFadeLoader] = useState(false)
  const [isNavbar, setIsNavbar] = useState(false)
  const [useDarkText, setUseDarkText] = useState(false)
  const lenisRef = useRef<Lenis | null>(null)

  // Initialize Lenis smooth scroll synced to GSAP ticker
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      syncTouch: true,
    })

    lenisRef.current = lenis

    // Sync Lenis scroll position with ScrollTrigger on every frame
    lenis.on('scroll', ScrollTrigger.update)

    // Drive Lenis from GSAP's ticker for perfect frame sync
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  // Track video loading progress and trigger loader fade-out
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateProgress = () => {
      if (video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1)
        const percent = Math.round((bufferedEnd / video.duration) * 100)
        setLoadingPercentage(percent)
      }
    }

    const onCanPlayThrough = () => {
      setLoadingPercentage(100)
      setFadeLoader(true)
      const timer = setTimeout(() => {
        setLoading(false)
      }, 1000)
      return () => clearTimeout(timer)
    }

    video.addEventListener('progress', updateProgress)
    video.addEventListener('canplaythrough', onCanPlayThrough)

    // Fallback: if already fully buffered before listeners attached
    if (video.readyState >= 4) {
      onCanPlayThrough()
    }

    return () => {
      video.removeEventListener('progress', updateProgress)
      video.removeEventListener('canplaythrough', onCanPlayThrough)
    }
  }, [])

  // Scroll-driven video scrubbing via GSAP ScrollTrigger
  useGSAP(
    () => {
      const video = videoRef.current
      if (!video) return

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#video-scroll-track',
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          onUpdate: (self) => {
            const isAtEnd = self.progress > 0.95
            setIsNavbar(isAtEnd)
            setUseDarkText(isAtEnd || self.progress > 0.45)
          },
        },
      })

      // Scrub video currentTime from 0 → duration based on scroll progress
      const addScrubAnimation = () => {
        if (video.duration && video.duration > 0) {
          tl.fromTo(
            video,
            { currentTime: 0 },
            { currentTime: video.duration, ease: 'none' },
            0,
          )
        }
      }

      // Wait for metadata so video.duration is available
      video.onloadedmetadata = addScrubAnimation

      // Fallback: metadata may already be loaded
      if (video.readyState >= 1) {
        addScrubAnimation()
      }
    },
    { scope: containerRef },
  )

  // Video parallax: fade and scale the background as ScrollExpand section takes over
  useGSAP(
    () => {
      if (loading) return

      gsap.fromTo(
        videoRef.current,
        { y: 0, scale: 1, opacity: 1 },
        {
          y: '-15vh',
          scale: 0.92,
          opacity: 0.3,
          ease: 'none',
          scrollTrigger: {
            trigger: '#video-scroll-track',
            start: 'bottom bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      )
    },
    { scope: containerRef, dependencies: [loading] },
  )

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
              ? 'bg-white/70 backdrop-blur-md border-b border-[#1b261b]/10 h-20' 
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
           {/*  <svg 
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
 */}
            <span 
              className={`font-sans uppercase transition-all duration-700 ease-in-out font-bold ${
                isNavbar 
                  ? 'text-xl tracking-tight text-[#1b261b]' 
                  : `text-5xl md:text-6xl tracking-tight ${useDarkText ? 'text-black' : 'text-white'}`
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
            <button 
              className={`transition-colors relative p-2 focus:outline-none cursor-pointer ${
                isNavbar ? 'text-[#1b261b] hover:text-[#8bb56e]' : 'text-white hover:text-[#8bb56e]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="absolute top-0 right-0 w-2 h-2 bg-[#8bb56e] rounded-full animate-ping" />
            </button>

            {/* Login CTA */}
            <button 
              className={`px-5 py-2 border rounded-full text-xs font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                isNavbar 
                  ? 'border-[#1b261b]/20 text-[#1b261b] hover:bg-[#8bb56e] hover:text-white hover:border-[#8bb56e]' 
                  : 'border-white/20 text-white hover:bg-[#8bb56e] hover:text-black hover:border-[#8bb56e]'
              }`}
            >
              Login
            </button>
          </div>
        </header>
      )}

      {/* Fixed Fullscreen Video Stage */}
      <div className="fixed inset-0 z-0 h-full w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          src="/video.mp4"
          className="h-full w-full object-cover block"
          muted
          playsInline
          preload="auto"
        />
      </div>

      {/* 500vh Scroll Runway for Video Scrubbing */}
      <div id="video-scroll-track" className="relative z-10 h-[500vh] pointer-events-none" />

      {/* ═══════════════════════════════════════════════════════════════
          CONTENT PAGE — ScrollExpand cinematic reveal
          ═══════════════════════════════════════════════════════════════ */}
      <div className="relative z-20">
        <HeroScrollSection />
      </div>
    </div>
  )
}
