import { useEffect, useState } from 'react'
import { CONSENT_OPEN_EVENT, hasAnalyticsConsent, setAnalyticsConsent, trackingConfigured } from '../lib/analytics'
import { Link } from '../lib/router'

/**
 * Cookie preferences. Never shown on its own: Google and Meta load on arrival
 * (see initAnalytics), and nobody is asked or made to wait. This panel opens
 * only from a "Cookie preferences" link, so a visitor can switch tracking off
 * (remembered) or back on.
 */
export default function ConsentBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener(CONSENT_OPEN_EVENT, reopen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen)
  }, [])

  if (!trackingConfigured() || !open) return null

  const off = hasAnalyticsConsent() === false
  const choose = (granted: boolean) => {
    setOpen(false)
    setAnalyticsConsent(granted)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-50 bg-white border border-[#1b261b]/15 rounded-2xl p-5 shadow-[0_12px_40px_rgba(27,38,27,0.15)]"
    >
      <p className="text-sm font-bold text-[#1b261b] mb-1.5">Cookie preferences</p>
      <p className="text-xs text-[#4a584a] leading-relaxed mb-4">
        Cookies from Google and Meta show us which of our ads bring tea lovers here. We never share your name, email
        or address with them. They are {off ? 'switched off' : 'on'} for you. See our{' '}
        <Link to="/privacy" className="text-[#4a7333] font-semibold hover:underline">Privacy Policy</Link>.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => choose(true)}
          className="flex-1 bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-[11px] font-bold tracking-widest uppercase py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
        >
          Allow
        </button>
        <button
          onClick={() => choose(false)}
          className="flex-1 border border-[#1b261b]/20 hover:border-[#1b261b] text-[#1b261b] text-[11px] font-bold tracking-widest uppercase py-2.5 px-4 rounded-lg transition-all cursor-pointer"
        >
          Switch off
        </button>
      </div>
    </div>
  )
}
