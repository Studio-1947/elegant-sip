import { useEffect, useState } from 'react'
import { mfaApi } from '../../lib/api'
import { Link } from '../../lib/router'

/**
 * Asks staff without two-step sign-in to turn it on. Shown only when it can
 * actually be turned on (the server has its encryption key); a failed status
 * check shows nothing rather than a nag that may be wrong.
 */
export default function MfaNudge() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let live = true
    mfaApi
      .status()
      .then((status) => live && setShow(status.available && !status.enabled))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  if (!show) return null
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4" role="note">
      <p className="text-sm leading-relaxed text-amber-900">
        <b>Turn on two-step sign-in.</b> A staff account can change orders and the catalogue; with an authenticator code on top of the
        password, a leaked password alone cannot get in.
      </p>
      <Link to="/account#two-step" className="rounded-full border border-amber-700/40 px-4 py-2 text-xs font-mono uppercase tracking-wider text-amber-900 hover:bg-white">
        Set it up
      </Link>
    </div>
  )
}
