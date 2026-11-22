import { useEffect, useRef, useState } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
 * Google's own "Continue with Google" button (Google Identity Services).
 *
 * Google's script is loaded only when this button is on screen, so no Google
 * code runs for visitors who never open the sign-in box. The button opens
 * Google's sign-in popup and hands back an ID token, which the API checks.
 * ──────────────────────────────────────────────────────────────────────────── */

const GSI_SRC = 'https://accounts.google.com/gsi/client'

interface GoogleIdApi {
  initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: 'popup'; auto_select?: boolean; use_fedcm_for_button?: boolean }) => void
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void
}
type GoogleWindow = Window & { google?: { accounts?: { id?: GoogleIdApi } } }

let loading: Promise<GoogleIdApi> | null = null

function loadGoogle(): Promise<GoogleIdApi> {
  const ready = () => (window as GoogleWindow).google?.accounts?.id
  const existing = ready()
  if (existing) return Promise.resolve(existing)
  loading ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = () => {
      const api = ready()
      if (api) resolve(api)
      else reject(new Error('Google sign-in did not load'))
    }
    script.onerror = () => {
      loading = null
      reject(new Error('Google sign-in did not load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export default function GoogleSignInButton({
  clientId,
  text = 'continue_with',
  onCredential,
  onUnavailable,
}: {
  clientId: string
  /** Google's wording: "Continue with Google" or "Sign up with Google". */
  text?: 'continue_with' | 'signup_with'
  onCredential: (credential: string) => void
  /** Google's script could not load (offline, blocked): the caller can say so. */
  onUnavailable?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // The latest handler, without re-rendering Google's button on every keystroke.
  const handler = useRef(onCredential)
  useEffect(() => {
    handler.current = onCredential
  }, [onCredential])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    loadGoogle()
      .then((google) => {
        const el = ref.current
        if (!live || !el) return
        google.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          auto_select: false,
          use_fedcm_for_button: true,
          callback: (response) => {
            if (response.credential) handler.current(response.credential)
          },
        })
        el.innerHTML = ''
        google.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, Math.round(el.clientWidth || 320))),
        })
      })
      .catch(() => {
        if (!live) return
        setFailed(true)
        onUnavailable?.()
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, text])

  if (failed) return null
  // Google's button is a fixed 40px tall; the box holds its place while it loads.
  return <div ref={ref} className="w-full min-h-[44px] flex justify-center" />
}
