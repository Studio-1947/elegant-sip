import { useEffect, useRef, useState } from 'react'
import { useDialog } from '../lib/useDialog'
import { QUIZ_OPTIONS, getProduct, type Product } from '../data/products'
import { track } from '../lib/analytics'
import QuizResult from './QuizResult'

interface TeaDiscoveryQuizModalProps {
  isOpen: boolean
  onClose: () => void
}

type Phase = 'question' | 'brewing' | 'result'

export default function TeaDiscoveryQuizModal({ isOpen, onClose }: TeaDiscoveryQuizModalProps) {
  const [phase, setPhase] = useState<Phase>('question')
  const [selected, setSelected] = useState<string | null>(null)
  const [match, setMatch] = useState<Product | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])

  // Fresh quiz every time it opens; clear pending phase timers on close/unmount.
  useEffect(() => {
    if (isOpen) {
      setPhase('question')
      setSelected(null)
      setMatch(null)
    }
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    }
  }, [isOpen])

  // Focus trap, focus restoration, Escape and scroll lock.
  const dialogRef = useDialog(isOpen, onClose)

  if (!isOpen) return null

  const handleOptionSelect = (option: string) => {
    if (selected) return
    const product = getProduct(QUIZ_OPTIONS[option])
    if (!product) return
    setSelected(option)
    track('quiz_completed', { option, match: product.id })

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMatch(product)
      setPhase('result')
      return
    }
    // Let the chosen option flash green, steep for a moment, then reveal.
    timers.current.push(
      window.setTimeout(() => {
        setMatch(product)
        setPhase('brewing')
      }, 380),
      window.setTimeout(() => setPhase('result'), 1800),
    )
  }

  const handleReset = () => {
    setSelected(null)
    setMatch(null)
    setPhase('question')
  }

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Persistent live region — a region inserted together with its text is
          never announced, so the previous in-place aria-live did nothing. */}
      <span aria-live="polite" className="sr-only">
        {phase === 'brewing' ? 'Steeping your match…' : phase === 'result' && match ? `Your match: ${match.name}` : ''}
      </span>

      {/* Backdrop */}
      <div className="qz-fade absolute inset-0 bg-[#060b08]/85 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      {/* Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tea discovery quiz"
        className="qz-pop relative bg-[#f9faf7] text-[#1b261b] rounded-3xl border border-[#1b261b]/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden no-scrollbar shadow-2xl p-6 md:p-10 flex flex-col z-10"
      >
        {/* Close Button */}
        <button
          ref={closeRef}
          onClick={onClose}
          className="absolute top-6 right-6 p-1 text-[#1b261b]/50 hover:text-[#1b261b] transition-colors cursor-pointer z-20"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {phase === 'question' && (
          <div className="flex flex-col flex-grow justify-center py-6 text-center">
            <span className="qz-rise text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Tea Discovery Quiz</span>
            <h2 className="qz-rise text-3xl font-bold tracking-tight mb-8 font-sans text-[#1b261b]" style={{ animationDelay: '0.06s' }}>
              How do you like your tea?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto w-full">
              {Object.keys(QUIZ_OPTIONS).map((option, i) => (
                <button
                  key={option}
                  onClick={() => handleOptionSelect(option)}
                  style={{ animationDelay: `${0.12 + i * 0.06}s` }}
                  className={`qz-rise w-full text-left px-6 py-4 rounded-xl border shadow-[0_4px_12px_rgba(27,38,27,0.02)] transition-all duration-300 font-sans tracking-wide cursor-pointer flex justify-between items-center group ${
                    selected === option
                      ? 'border-[#8bb56e] bg-[#8bb56e] text-white scale-[1.03]'
                      : selected
                      ? 'border-[#1b261b]/10 bg-white text-[#1b261b] opacity-30 pointer-events-none'
                      : 'border-[#1b261b]/10 bg-white text-[#1b261b] hover:border-[#8bb56e] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(27,38,27,0.08)]'
                  }`}
                >
                  <span className="font-semibold text-sm">{option}</span>
                  <span
                    className={`text-xs transition-all duration-300 ${
                      selected === option ? 'text-white' : 'text-[#1b261b]/40 group-hover:text-[#4a7333] group-hover:translate-x-1'
                    }`}
                  >
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'brewing' && (
          <div className="qz-fade flex flex-col flex-grow items-center justify-center py-16 text-center">
            {/* Steaming cup */}
            <div className="relative mb-6">
              {/* Steam wisps */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-2" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block w-[3px] h-5 rounded-full bg-gradient-to-t from-transparent via-[#8bb56e]/60 to-transparent"
                    style={{ animation: `qz-steam 1.5s ease-in-out ${i * 0.35}s infinite` }}
                  />
                ))}
              </div>
              <svg className="w-16 h-16 text-[#1b261b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h13v5.5A5.5 5.5 0 0111.5 20h-2A5.5 5.5 0 014 14.5V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 10.5h1a2.75 2.75 0 010 5.5h-1.3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 20h6" />
              </svg>
            </div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#1b261b]">Steeping your match</p>
            <div className="flex gap-1.5 mt-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#8bb56e] animate-pulse"
                  style={{ animationDelay: `${i * 0.25}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {phase === 'result' && match && <QuizResult match={match} onClose={onClose} onReset={handleReset} />}
      </div>
    </div>
  )
}
