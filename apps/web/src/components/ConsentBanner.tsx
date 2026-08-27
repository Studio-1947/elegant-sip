import { useState } from 'react'
import { analyticsProvider, hasAnalyticsConsent, setAnalyticsConsent } from '../lib/analytics'
import { Link } from '../lib/router'

/**
 * Shown only when an analytics provider is configured and the visitor hasn't
 * decided yet. With no provider (the default), nothing is tracked and no
 * banner appears.
 */
export default function ConsentBanner() {
  const [decided, setDecided] = useState(() => hasAnalyticsConsent() !== null)

  if (!analyticsProvider() || decided) return null

  const choose = (granted: boolean) => {
    setAnalyticsConsent(granted)
    setDecided(true)
  }

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-50 bg-white border border-[#1b261b]/15 rounded-2xl p-5 shadow-[0_12px_40px_rgba(27,38,27,0.15)]"
    >
      <p className="text-xs text-[#4a584a] leading-relaxed mb-4">
        We'd like to measure anonymous usage to improve the store — no personal details, ever.
        See our <Link to="/privacy" className="text-[#4a7333] font-semibold hover:underline">Privacy Policy</Link>.
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
