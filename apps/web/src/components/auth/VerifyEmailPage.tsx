import { useEffect, useRef, useState } from 'react'
import { ApiClientError, api } from '../../lib/api'
import { Link, parseRoute, useDocumentMeta, useRoute } from '../../lib/router'
import { useAuth } from '../AuthContext'
import { AuthCard } from './AuthCard'

/* ────────────────────────────────────────────────────────────────────────────
 * Email confirmation — the destination for the link in the welcome email.
 *
 * The token is single-use and consumed on the first request, so this must not
 * fire twice. React StrictMode deliberately runs effects twice in development,
 * which would burn the token and show the customer "already used" on a
 * perfectly good link — hence the ref guard.
 * ──────────────────────────────────────────────────────────────────────────── */

type State = 'working' | 'done' | 'failed' | 'missing'

export default function VerifyEmailPage() {
  const route = useRoute()
  const token = parseRoute(route).query.get('token') ?? ''
  const { refresh } = useAuth()

  const [state, setState] = useState<State>(token ? 'working' : 'missing')
  const [message, setMessage] = useState<string | null>(null)
  const attempted = useRef(false)

  useDocumentMeta('Confirm your email | Elegant Sip', 'Confirm your Elegant Sip account.', {
    noindex: true,
  })

  useEffect(() => {
    if (!token || attempted.current) return
    attempted.current = true

    void api.auth
      .verifyEmail(token)
      .then(async () => {
        setState('done')
        // If they are already signed in, reflect the new verified status.
        await refresh()
      })
      .catch((err) => {
        setState('failed')
        setMessage(
          err instanceof ApiClientError
            ? err.message
            : 'We could not confirm that link. Please try again.',
        )
      })
  }, [token, refresh])

  if (state === 'missing') {
    return (
      <AuthCard
        eyebrow="Confirm your email"
        title="Link incomplete"
        body="This address is missing its confirmation token. Open the link from your email exactly as it was sent — some mail clients cut long links in half."
      >
        <Link to="/" className="es-btn-secondary">
          Back to the shop
        </Link>
      </AuthCard>
    )
  }

  if (state === 'working') {
    return (
      <AuthCard eyebrow="Confirm your email" title="Confirming…" body="One moment." busy />
    )
  }

  if (state === 'failed') {
    return (
      <AuthCard
        eyebrow="Confirm your email"
        title="That link didn't work"
        body={message ?? 'The link has expired or has already been used.'}
        tone="warn"
      >
        <p className="text-[11px] text-[#4a584a] leading-relaxed mb-4">
          Confirmation links last 24 hours and work once. Sign in and we will send a fresh one.
        </p>
        <Link to="/account" className="es-btn-primary">
          Go to sign in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      eyebrow="Confirm your email"
      title="Email confirmed"
      body="Thank you — your address is confirmed and your account is ready."
    >
      <Link to="/shop" className="es-btn-primary">
        Start shopping
      </Link>
      <Link to="/account" className="es-btn-secondary">
        My account
      </Link>
    </AuthCard>
  )
}
