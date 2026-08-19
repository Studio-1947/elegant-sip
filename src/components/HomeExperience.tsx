import { useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import HeroScrollSection from './HeroScrollSection'
import MobileHome from './MobileHome'
import { useUi } from './UiContext'
import { useIsCompact } from '../lib/useMediaQuery'
import { reportVideoProgress, markVideoFailed } from '../lib/videoLoading'
import { scrollToY } from '../lib/scroll'

gsap.registerPlugin(useGSAP, ScrollTrigger)

interface HomeExperienceProps {
  /** Called with scrub progress 0..1 so the app shell can style the header. */
  onProgress: (progress: number) => void
  /** False while the loading overlay is up — gates the parallax tween. */
  ready: boolean
}

export default function HomeExperience({ onProgress, ready }: HomeExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  // Only the threshold crossing lives in React state; raw progress would
  // re-render this whole subtree on every scroll frame.
  const [isContent, setIsContent] = useState(false)
  const { openQuiz } = useUi()
  const isCompact = useIsCompact()

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
          // Smooth the scrub over ~1s so wheel ticks glide through the frames
          // like playback. The video is encoded all-intra (every frame a
          // keyframe), so each intermediate seek decodes instantly.
          scrub: 1,
          onUpdate: (self) => {
            onProgress(self.progress)
            const content = self.progress > 0.95
            setIsContent((c) => (c === content ? c : content))
            // Progress bar is driven directly — no React render per frame.
            if (progressBarRef.current) {
              progressBarRef.current.style.width = `${Math.round(self.progress * 100)}%`
            }
          },
        },
      })

      // Scrub video currentTime from 0 → duration based on scroll progress.
      // Seeks go through a proxy and are clamped to the buffered range — an
      // unbuffered seek aborts the in-flight range request, and on slow
      // networks that becomes a storm of canceled requests and a frozen frame.
      const proxy = { t: 0 }
      const applySeek = () => {
        if (video.buffered.length === 0) return
        const bufferedEnd = video.buffered.end(video.buffered.length - 1) - 0.05
        const t = Math.min(proxy.t, Math.max(0, bufferedEnd))
        // The source is ~24fps (one frame ≈ 0.042s) — seeking finer than a
        // frame is pure wasted decode.
        if (Math.abs(video.currentTime - t) > 0.035) video.currentTime = t
      }
      let scrubAdded = false
      const addScrubAnimation = () => {
        if (scrubAdded || !video.duration || video.duration <= 0) return
        scrubAdded = true
        tl.fromTo(proxy, { t: 0 }, { t: video.duration, ease: 'none', onUpdate: applySeek }, 0)
        reportBuffer()
      }

      // Feed the loading overlay with real download progress.
      const reportBuffer = () => {
        if (!video.duration || video.buffered.length === 0) return
        reportVideoProgress(video.buffered.end(video.buffered.length - 1) / video.duration)
      }
      const onVideoError = () => markVideoFailed()

      // Wait for metadata so video.duration is available
      video.addEventListener('loadedmetadata', addScrubAnimation)

      // Fallback: metadata may already be loaded
      if (video.readyState >= 1) {
        addScrubAnimation()
      }

      // iOS Safari ignores preload="auto" until playback begins — prime the
      // buffer with a muted play/pause (allowed without a user gesture) so
      // the download starts immediately.
      video.play()?.then(() => video.pause()).catch(() => {})

      // As more data buffers in, let the frame catch up to the scrub target.
      video.addEventListener('progress', applySeek)
      video.addEventListener('progress', reportBuffer)
      video.addEventListener('loadeddata', reportBuffer)
      video.addEventListener('error', onVideoError)

      return () => {
        video.removeEventListener('loadedmetadata', addScrubAnimation)
        video.removeEventListener('progress', applySeek)
        video.removeEventListener('progress', reportBuffer)
        video.removeEventListener('loadeddata', reportBuffer)
        video.removeEventListener('error', onVideoError)
      }
    },
    { scope: containerRef },
  )

  // Video parallax: fade and scale the background as content takes over
  useGSAP(
    () => {
      if (!ready || !videoRef.current) return

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
            scrub: 0.6,
          },
        },
      )
    },
    { scope: containerRef, dependencies: [ready] },
  )

  const handleSkipIntro = () => {
    const track = document.getElementById('video-scroll-track')
    if (!track) return
    const targetY = track.getBoundingClientRect().bottom + window.scrollY - window.innerHeight
    scrollToY(targetY)
  }

  // Phones and portrait tablets get the compact homepage (portrait video hero,
  // linear flow) — the landscape scrub + pinned runway is a desktop experience.
  if (isCompact) {
    return <MobileHome />
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Fixed Fullscreen Video Stage */}
      <div className="fixed inset-0 z-0 h-full w-full overflow-hidden bg-black">
        <video
          ref={videoRef}
          src="/video.mp4"
          poster="/poster.webp"
          className="h-full w-full object-cover block"
          muted
          playsInline
          preload="auto"
        />
      </div>

      {/* 500vh Scroll Runway for Video Scrubbing */}
      <div id="video-scroll-track" className="relative z-10 h-[500vh] pointer-events-none" />

      {/* Skip Intro */}
      {!isContent && (
        <button
          onClick={handleSkipIntro}
          className="fixed bottom-8 left-8 z-40 px-4 py-2 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/50 backdrop-blur-sm text-[10px] font-mono tracking-widest uppercase transition-all cursor-pointer"
        >
          Skip Intro →
        </button>
      )}

      {/* Scrub progress indicator (width driven directly by the scroll handler) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 h-[3px] bg-white/10 pointer-events-none">
        <div ref={progressBarRef} className="h-full bg-[#8bb56e]" style={{ width: '0%' }} />
      </div>

      {/* Content (revealed after the video runway) */}
      <div className="relative z-20">
        <HeroScrollSection />
      </div>

      {/* Floating Tea Quiz Card (visible once scrolled into content) */}
      {isContent && (
        <div className="fixed bottom-8 right-8 z-40 animate-fade-in">
          <div className="bg-white/90 backdrop-blur-md border border-[#1b261b]/10 text-[#1b261b] rounded-2xl p-4 shadow-[0_8px_30px_rgba(27,38,27,0.08)] max-w-[240px] flex flex-col gap-3 transition-all duration-300 hover:border-[#1b261b]/20 hover:-translate-y-1">
            <div className="flex items-start gap-3">
              <div className="bg-[#8bb56e]/10 p-2 rounded-lg text-[#8bb56e] flex-shrink-0 animate-pulse">
                <svg className="w-5 h-5 text-[#8bb56e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-mono font-bold tracking-wide uppercase text-[#8bb56e]">Taste Matcher</h4>
                <p className="text-[10px] text-[#4a584a] mt-0.5 leading-normal">Find the ideal tea flavor profile for your palate.</p>
              </div>
            </div>
            <button
              onClick={openQuiz}
              className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-[10px] font-mono tracking-wider font-bold py-2 rounded-lg transition-colors cursor-pointer text-center uppercase"
            >
              Start Discovery
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
