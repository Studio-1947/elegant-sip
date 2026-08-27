import { useState } from 'react'
import { ApiClientError, api } from '../../lib/api'
import { Link, navigate, parseRoute, useDocumentMeta, useRoute } from '../../lib/router'
import { AuthCard } from './AuthCard'

/* ────────────────────────────────────────────────────────────────────────────
 * Password reset — the destination for the link in the reset email.
 *
 * Completing this destroys every existing session for the account (server
 * side), which is the point: if someone else had the old password, resetting
 * it must log them out too. The copy says so, because a customer who is
 * signed in elsewhere should not be surprised.
 * ──────────────────────────────────────────────────────────────────────────── */

const MIN_LENGTH = 10

export default function ResetPasswordPage() {
  const route = useRoute()
  const token = parseRoute(route).query.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useDocumentMeta('Set a new password | Elegant Sip', 'Choose a new password for your account.', {
    noindex: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (password.length < MIN_LENGTH) {
      setError(`Please use at least ${MIN_LENGTH} characters. Length matters more than symbols.`)
      return
    }
    if (password !== confirm) {
      setError('Those two passwords do not match.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await api.auth.resetPassword({ token, password })
      setDone(true)
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'We could not reset your password just now. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthCard
        eyebrow="Reset password"
        title="Link incomplete"
        body="This address is missing its reset token. Open the link from your email exactly as it was sent — some mail clients cut long links in half."
        tone="warn"
      >
        <Link to="/" className="es-btn-secondary">
          Back to the shop
        </Link>
      </AuthCard>
    )
  }

  if (done) {
    return (
      <AuthCard
        eyebrow="Reset password"
        title="Password changed"
        body="Your new password is set. Any other devices that were signed in have been signed out."
      >
        <button onClick={() => navigate('/account')} className="es-btn-primary">
          Sign in
        </button>
      </AuthCard>
    )
  }

  const inputClass =
    'w-full bg-white border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#4a7333] transition-colors placeholder:text-[#1b261b]/45'

  return (
    <AuthCard
      eyebrow="Reset password"
      title="Set a new password"
      body="Choose something long. A short phrase you will remember beats a short string of symbols you will not."
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 text-left" noValidate>
        <div>
          <label
            htmlFor="new-password"
            className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5"
          >
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-[11px] text-[#4a584a] mt-1.5">
            At least {MIN_LENGTH} characters.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5"
          >
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="es-btn-primary w-full">
          {submitting ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </AuthCard>
  )
}
