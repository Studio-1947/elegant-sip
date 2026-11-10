import { useEffect, useState } from 'react'
import { CONSENT_OPEN_EVENT, hasAnalyticsConsent, setAnalyticsConsent, trackingConfigured } from '../lib/analytics'
import { Link } from '../lib/router'

/**
 * Asks before any analytics or advertising tag loads. Shown when something is
 * configured to track and the visitor hasn't decided yet, and again whenever
 * they open "Cookie preferences".
 */
export default function ConsentBanner() {
  const [open, setOpen] = useState(() => trackingConfigured() && hasAnalyticsConsent() === null)

  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener(CONSENT_OPEN_EVENT, reopen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen)
  }, [])

  if (!trackingConfigured() || !open) return null

  const choose = (granted: boolean) => {
    setOpen(false)
    setAnalyticsConsent(granted)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-50 bg-white border border-[#1b261b]/15 rounded-2xl p-5 shadow-[0_12px_40px_rgba(27,38,27,0.15)]"
    >
      <p className="text-xs text-[#4a584a] leading-relaxed mb-4">
        May we use cookies from Google and Meta to measure visits and see which of our ads work? We never share
        your name, email or address with them. See our{' '}
        <Link to="/privacy" className="text-[#4a7333] font-semibold hover:underline">Privacy Policy</Link>.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => choose(true)}
          className="flex-grow bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-[11px] font-bold tracking-widest uppercase py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
        >
          Accept
        </button>
        <button
          onClick={() => choose(false)}
          className="flex-grow border border-[#1b261b]/20 hover:border-[#1b261b] text-[#1b261b] text-[11px] font-bold tracking-widest uppercase py-2.5 px-4 rounded-lg transition-all cursor-pointer"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
