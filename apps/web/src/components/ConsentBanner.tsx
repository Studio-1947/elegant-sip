import { useEffect, useState } from 'react'
import { CONSENT_OPEN_EVENT, hasAnalyticsConsent, setAnalyticsConsent, trackingConfigured } from '../lib/analytics'
import { Link } from '../lib/router'

/** Seconds on a page before the banner asks, when the visitor has not scrolled or moved on yet. */
const ASK_AFTER_MS = 8000

/**
 * Asks before any Google or Meta tag loads. Shown when something is configured
 * to track and the visitor hasn't decided yet, and again whenever they open
 * "Cookie preferences".
 *
 * It waits until the visitor has had a look around (a scroll, a second page,
 * or a few seconds) rather than covering the page on arrival. Nothing loads
 * while it waits: Google and Meta still need Accept. Accept and Decline stay
 * the same size, side by side, with no nudging either way.
 */
export default function ConsentBanner() {
  const undecided = trackingConfigured() && hasAnalyticsConsent() === null
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener(CONSENT_OPEN_EVENT, reopen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen)
  }, [])

  // First visit: ask once the visitor has engaged a little.
  useEffect(() => {
    if (!undecided) return
    let done = false
    const ask = () => {
      if (done) return
      done = true
      setOpen(true)
    }
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.25) ask()
    }
    const timer = window.setTimeout(ask, ASK_AFTER_MS)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('elegantsip:route', ask)
    window.addEventListener('popstate', ask)
    return () => {
      done = true
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('elegantsip:route', ask)
      window.removeEventListener('popstate', ask)
    }
  }, [undecided])

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
      <p className="text-sm font-bold text-[#1b261b] mb-1.5">Help a small tea garden?</p>
      <p className="text-xs text-[#4a584a] leading-relaxed mb-4">
        With your OK, cookies from Google and Meta show us which of our ads bring tea lovers here, so we spend less
        on ads and more on tea. We never share your name, email or address with them, and you can change your mind
        any time under Cookie preferences at the bottom of every page. See our{' '}
        <Link to="/privacy" className="text-[#4a7333] font-semibold hover:underline">Privacy Policy</Link>.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => choose(true)}
          className="flex-1 bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-[11px] font-bold tracking-widest uppercase py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
        >
          Accept
        </button>
        <button
          onClick={() => choose(false)}
          className="flex-1 border border-[#1b261b]/20 hover:border-[#1b261b] text-[#1b261b] text-[11px] font-bold tracking-widest uppercase py-2.5 px-4 rounded-lg transition-all cursor-pointer"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
