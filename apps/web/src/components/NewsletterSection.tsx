import { useState } from 'react'
import { track } from '../lib/analytics'
import { api, ApiClientError } from '../lib/api'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'error' | 'sending' | 'done'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_PATTERN.test(email)) {
      setErrorMsg('Please enter a valid email address.')
      setStatus('error')
      return
    }
    setStatus('sending')
    try {
      await api.newsletter.subscribe(email)
    } catch (err) {
      setErrorMsg(
        err instanceof ApiClientError ? err.message : 'Something went wrong — please try again in a moment.',
      )
      setStatus('error')
      return
    }
    setStatus('done')
    track('newsletter_signup')
  }

  return (
    <section className="px-6 md:px-12 lg:px-16 pb-32 max-w-[1400px] mx-auto">
      <div className="max-w-3xl mx-auto bg-[#1b261b] rounded-3xl px-8 py-16 md:p-16 text-center relative overflow-hidden">
        {/* subtle decoration */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#8bb56e]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[#8bb56e]/10 blur-3xl pointer-events-none" />

        {status === 'done' ? (
          <div className="relative z-10">
            <div className="w-12 h-12 mx-auto mb-6 rounded-full bg-[#8bb56e]/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#8bb56e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-white text-2xl md:text-3xl font-bold uppercase tracking-tight mb-3">Welcome to the Circle</h3>
            <p className="text-white/70 text-sm leading-relaxed mb-6">
              You're in. Enjoy 10% off your first order with the code below — just enter it at checkout.
            </p>
            <p className="inline-block bg-[#8bb56e]/15 border border-[#8bb56e]/40 rounded-lg px-6 py-3 text-[#8bb56e] font-mono font-bold tracking-[0.2em] text-lg select-all">
              WELCOME10
            </p>
          </div>
        ) : (
          <div className="relative z-10">
            <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">The Tea Circle</span>
            <h2 className="text-white text-3xl md:text-4xl font-bold uppercase tracking-tight mb-4">
              First Taste of <span className="text-[#8bb56e]">10% Off</span>
            </h2>
            <p className="text-white/70 text-sm leading-relaxed mb-8 max-w-md mx-auto">
              Join the Tea Circle for early access to limited harvests, brewing notes from the
              gardens, and 10% off your first order.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" noValidate>
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <input
                id="newsletter-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (status === 'error') setStatus('idle')
                }}
                placeholder="you@example.com"
                className="flex-grow bg-white/10 border border-white/15 rounded-full sm:rounded-lg px-5 sm:px-4 py-3.5 text-sm text-white placeholder:text-white/35 focus:border-[#8bb56e] transition-colors"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="bg-[#8bb56e] hover:bg-[#9cc580] disabled:opacity-60 disabled:cursor-wait text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 px-6 rounded-full sm:rounded-lg transition-colors active:scale-[0.98] cursor-pointer"
              >
                {status === 'sending' ? 'Joining…' : 'Join Free'}
              </button>
            </form>
            {status === 'error' && (
              <p className="text-xs text-[#e0b35c] mt-3" role="alert">{errorMsg}</p>
            )}
            <p className="text-white/70 text-[11px] font-mono mt-4">No spam, ever. Unsubscribe anytime.</p>
          </div>
        )}
      </div>
    </section>
  )
}
