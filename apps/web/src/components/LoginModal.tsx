import { useState } from 'react'
import { useAuth } from './AuthContext'
import { ApiClientError, api } from '../lib/api'
import { EMAIL_PATTERN } from './checkout/checkoutData'
import { track } from '../lib/analytics'
import { useDialog } from '../lib/useDialog'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { login, loginWithWhatsApp, register } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [whatsapp, setWhatsapp] = useState(false)
  const [phone, setPhone] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [code, setCode] = useState('')

  // Focus trap, focus restoration, Escape and scroll lock.
  const dialogRef = useDialog(isOpen, onClose)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    if (mode === 'signup' && password.length < 10) {
      setError('Please use at least 10 characters. Length matters more than symbols.')
      return
    }
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Please tell us your name.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await register(name.trim(), email.trim(), password)
        /* Registration deliberately does not sign you in — the address is
           unconfirmed, and the endpoint answers identically whether or not
           the account already existed. "Check your inbox" is the only thing
           we can honestly say. */
        setRegistered(true)
      } else {
        await login(email.trim(), password)
        onClose()
      }
      // Never send the email to analytics: the privacy policy says we don't,
      // and the consent banner promises "no personal details, ever".
      track(mode === 'signup' ? 'signup' : 'login', { method: 'email' })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const sendWhatsAppCode = async () => {
    setError(null); setSubmitting(true)
    try {
      const result = await api.auth.requestWhatsApp(phone)
      if (!result.challengeId) throw new Error('This number is not linked yet. Sign in with email first, then link WhatsApp from your account.')
      setChallengeId(result.challengeId)
    } catch (err) { setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : 'Could not send a code.') } finally { setSubmitting(false) }
  }
  const verifyWhatsAppCode = async () => {
    if (!challengeId) return
    setError(null); setSubmitting(true)
    try { await loginWithWhatsApp(challengeId, code); track('login', { method: 'whatsapp' }); onClose() } catch (err) { setError(err instanceof ApiClientError ? err.message : 'That code could not be verified.') } finally { setSubmitting(false) }
  }

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#060b08]/85 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative bg-[#f9faf7] text-[#1b261b] rounded-3xl border border-[#1b261b]/10 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-10 z-10"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-[#1b261b]/50 hover:text-[#1b261b] transition-colors cursor-pointer text-xl font-bold z-20"
          aria-label="Close"
        >
          ✕
        </button>

        <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-4">
          {mode === 'signin' ? 'Welcome Back' : 'Join the Circle'}
        </span>
        <h2 id="login-modal-title" className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
          {mode === 'signin' ? 'Sign in to Elegant Sip' : 'Create your account'}
        </h2>
        <p className="text-xs text-[#4a584a] leading-relaxed mb-8">
          {mode === 'signin'
            ? 'Access your order history, wishlist, and saved addresses.'
            : 'Save your wishlist, track orders, and get early access to limited harvests.'}
        </p>

        {/* Tabs */}
        <div className="flex border border-[#1b261b]/15 rounded-xl p-1 mb-8">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-mono tracking-widest uppercase transition-all cursor-pointer ${mode === m
                  ? 'bg-[#1b261b] text-white'
                  : 'text-[#4a584a] hover:text-[#1b261b]'
                }`}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {whatsapp ? (
          <div className="space-y-4">
            <p className="text-xs text-[#4a584a] leading-relaxed">Use the WhatsApp number linked to your Elegant Sip account.</p>
            {!challengeId ? <><label className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a]">WhatsApp number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" inputMode="numeric" className="w-full bg-white border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm" /><button onClick={() => void sendWhatsAppCode()} disabled={submitting} className="w-full bg-[#1b261b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg">{submitting ? 'Sending…' : 'Send WhatsApp code'}</button></> : <><label className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a]">6-digit code</label><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="w-full bg-white border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm tracking-[0.4em]" /><button onClick={() => void verifyWhatsAppCode()} disabled={submitting || code.length !== 6} className="w-full bg-[#1b261b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg">Verify and sign in</button></>}
            {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
            <button onClick={() => { setWhatsapp(false); setError(null) }} className="text-[11px] font-mono tracking-wider uppercase text-[#4a7333]">Use email and password</button>
          </div>
        ) : registered ? (
          <div className="bg-[#4a7333]/8 border border-[#4a7333]/25 rounded-xl p-5 text-sm text-[#45523f] leading-relaxed">
            <p className="font-bold text-[#1b261b] mb-2">Check your inbox</p>
            <p>
              If that address is not already registered, we have sent a confirmation link to{' '}
              <span className="font-mono">{email.trim()}</span>. Confirm it and you can sign in.
            </p>
          </div>
        ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">
                Full Name
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Avery Chen"
                className="w-full bg-white border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25"
              />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-white border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25"
            />
          </div>

          {error && <p className="text-xs text-red-700" role="alert">{error}</p>}

          {mode === 'signin' && (
            <button
              type="button"
              onClick={async () => {
                if (!EMAIL_PATTERN.test(email.trim())) {
                  setError('Enter your email address above, then tap this again.')
                  return
                }
                setError(null)
                try {
                  await api.auth.forgotPassword(email.trim())
                } catch {
                  /* The endpoint answers identically whether or not the account
                     exists, so there is nothing useful to report on failure —
                     and reporting one would leak which addresses are registered. */
                }
                setResetSent(true)
              }}
              className="text-[11px] font-mono tracking-wider uppercase text-[#4a7333] hover:text-[#1b261b] transition-colors cursor-pointer"
            >
              Forgot your password?
            </button>
          )}

          {resetSent && (
            <p className="text-xs text-[#45523f] bg-[#4a7333]/8 border border-[#4a7333]/25 rounded-lg px-4 py-3 leading-relaxed">
              If that address has an account, a reset link is on its way. It works once and expires
              in an hour.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full disabled:opacity-60 disabled:cursor-wait bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors active:scale-[0.98] cursor-pointer"
          >
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        )}

        {!registered && mode === 'signin' && !whatsapp && <button onClick={() => { setWhatsapp(true); setError(null) }} className="w-full mt-4 border border-[#4a7333]/40 text-[#4a7333] text-xs font-bold tracking-widest uppercase py-3 rounded-lg">Continue with WhatsApp</button>}

        <p className="text-[11px] text-[#4a584a] mt-6 leading-relaxed">
          We store your name, email and order history. Nothing is shared with anyone, and we never
          send your address to analytics. See our{' '}
          <a href="/privacy" className="text-[#4a7333] font-semibold underline underline-offset-2">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
