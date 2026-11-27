import { useEffect, useState } from 'react'
import { CONSENT_OPEN_EVENT, setAnalyticsConsent, trackingAllowed, trackingConfigured } from '../lib/analytics'
import { Link } from '../lib/router'
import { Switch } from './admin/ui/controls'

/**
 * Cookie preferences, opened from the footer or the Privacy Policy. There is no
 * banner: Google and Meta are on by default, and this panel is where a visitor
 * switches them off (or back on). The switch takes effect straight away.
 */
export default function CookiePreferences() {
  const [open, setOpen] = useState(false)
  const [on, setOn] = useState(true)

  useEffect(() => {
    const show = () => {
      setOn(trackingAllowed())
      setOpen(true)
    }
    window.addEventListener(CONSENT_OPEN_EVENT, show)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, show)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!trackingConfigured() || !open) return null

  const change = (next: boolean) => {
    setOn(next)
    // Switching off reloads the page if Google or Meta had already loaded.
    setAnalyticsConsent(next)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-50 bg-white border border-[#1b261b]/15 rounded-2xl p-5 shadow-[0_12px_40px_rgba(27,38,27,0.15)]"
    >
      <p className="text-sm font-bold text-[#1b261b] mb-1.5">Cookie preferences</p>
      <p className="text-xs text-[#4a584a] leading-relaxed mb-4">
        Cookies from Google and Meta show us which of our ads bring tea lovers here, so we spend less on ads and more
        on tea. We never share your name, email or address with them. See our{' '}
        <Link to="/privacy" className="text-[#4a7333] font-semibold hover:underline">Privacy Policy</Link>.
      </p>
      <div className="flex items-center justify-between gap-4 border-t border-[#1b261b]/10 pt-4 mb-4">
        <div>
          <p className="text-xs font-bold text-[#1b261b]">Ad and analytics cookies</p>
          <p className="text-[11px] text-[#4a584a]">{on ? 'On' : 'Off'}</p>
        </div>
        <Switch checked={on} onChange={change} label="Ad and analytics cookies" />
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-[11px] font-bold tracking-widest uppercase py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
      >
        Done
      </button>
    </div>
  )
}
