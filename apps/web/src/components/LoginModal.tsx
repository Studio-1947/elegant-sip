import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatIndianMobile, indianMobileError, normaliseIndianMobile } from '@elegantsip/shared'
import { useAuth } from './AuthContext'
import { ApiClientError, api } from '../lib/api'
import { EMAIL_PATTERN } from './checkout/checkoutData'
import { track } from '../lib/analytics'
import { useDialog } from '../lib/useDialog'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

type Field = 'name' | 'email' | 'password'
type FieldErrors = Partial<Record<Field, string>>

/** Seconds before another WhatsApp code can be requested. */
const RESEND_SECONDS = 30
/** Same limits the API enforces. */
const MAX = { name: 80, email: 254, password: 200 }
const MIN_PASSWORD = 10

const inputClass = (invalid: boolean) =>
  `w-full bg-white border rounded-lg px-4 py-3 text-sm transition-colors placeholder:text-[#1b261b]/25 focus:outline-none focus:ring-2 ${
    invalid ? 'border-red-600 focus:ring-red-600/20' : 'border-[#1b261b]/15 focus:border-[#8bb56e] focus:ring-[#8bb56e]/25'
  }`
const labelClass = 'block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5'

function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-xs text-red-700">
      {message}
    </p>
  )
}

function emailError(value: string): string | undefined {
  const email = value.trim()
  if (!email) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address, like name@example.com.'
  return undefined
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const { login, loginWithWhatsApp, register } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [whatsapp, setWhatsapp] = useState(true)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const phoneRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  // Focus trap, focus restoration, Escape and scroll lock.
  const dialogRef = useDialog(isOpen, onClose)

  // Counts down the "Resend code" wait.
  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1_000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  if (!isOpen) return null

  /* ── Email and password ─────────────────────────────────────────────────── */

  const validateField = (field: Field, values = { name, email, password }): string | undefined => {
    if (field === 'name') return mode === 'signup' && values.name.trim().length < 2 ? 'Enter your full name.' : undefined
    if (field === 'email') return emailError(values.email)
    if (!values.password) return mode === 'signup' ? 'Choose a password.' : 'Enter your password.'
    if (mode === 'signup' && values.password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
    return undefined
  }

  /** Once a field has shown an error, re-check it as the visitor fixes it. */
  const updateField = (field: Field, value: string) => {
    const values = { name, email, password, [field]: value }
    if (field === 'name') setName(value)
    if (field === 'email') setEmail(value)
    if (field === 'password') setPassword(value)
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: validateField(field, values) }))
  }

  /** Check a field when the visitor leaves it, but never nag about one they have not filled in yet. */
  const blurField = (field: Field, value: string) => {
    if (value.trim()) setFieldErrors((current) => ({ ...current, [field]: validateField(field) }))
  }

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next)
    setError(null)
    setFieldErrors({})
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const fields: Field[] = mode === 'signup' ? ['name', 'email', 'password'] : ['email', 'password']
    const next: FieldErrors = {}
    for (const field of fields) next[field] = validateField(field)
    setFieldErrors(next)
    const firstInvalid = fields.find((field) => next[field])
    if (firstInvalid) {
      document.getElementById(`auth-${firstInvalid}`)?.focus()
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
      // Never send the email to analytics: the privacy policy says we don't.
      track(mode === 'signup' ? 'signup' : 'login', { method: 'email' })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const sendPasswordReset = async () => {
    const problem = emailError(email)
    if (problem) {
      setFieldErrors((current) => ({ ...current, email: `${problem} We will send the reset link there.` }))
      document.getElementById('auth-email')?.focus()
      return
    }
    setFieldErrors((current) => ({ ...current, email: undefined }))
    try {
      await api.auth.forgotPassword(email.trim())
    } catch {
      /* The endpoint answers identically whether or not the account
         exists, so there is nothing useful to report on failure —
         and reporting one would leak which addresses are registered. */
    }
    setResetSent(true)
  }

  /* ── WhatsApp ───────────────────────────────────────────────────────────── */

  const onPhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '')
    // A pasted "+91 98765 43210" or "098765 43210" becomes the 10-digit number.
    const next = digits.length > 10 ? (normaliseIndianMobile(digits) ?? digits.slice(0, 10)) : digits
    setPhone(next)
    if (phoneError) setPhoneError(indianMobileError(next))
  }

  const sendWhatsAppCode = async (e?: FormEvent) => {
    e?.preventDefault()
    if (submitting) return
    const problem = indianMobileError(phone)
    const local = normaliseIndianMobile(phone)
    if (problem || !local) {
      setPhoneError(problem ?? 'Enter a 10-digit mobile number.')
      phoneRef.current?.focus()
      return
    }
    setPhoneError(null)
    setError(null)
    setSubmitting(true)
    try {
      const result = await api.auth.requestWhatsApp(`+91${local}`)
      if (!result.challengeId) throw new Error('This number is not linked yet. Sign in with email first, then link WhatsApp from your account.')
      setChallengeId(result.challengeId)
      setSentTo(`+91 ${formatIndianMobile(local)}`)
      setCode('')
      setCodeError(null)
      setResendIn(RESEND_SECONDS)
      window.setTimeout(() => codeRef.current?.focus(), 0)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : 'Could not send a code.')
    } finally {
      setSubmitting(false)
    }
  }

  const verifyWhatsAppCode = async (e: FormEvent) => {
    e.preventDefault()
    if (!challengeId || submitting) return
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Enter the 6-digit code from WhatsApp.')
      codeRef.current?.focus()
      return
    }
    setCodeError(null)
    setError(null)
    setSubmitting(true)
    try {
      await loginWithWhatsApp(challengeId, code)
      track('login', { method: 'whatsapp' })
      onClose()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'That code could not be verified.')
    } finally {
      setSubmitting(false)
    }
  }

  const changeNumber = () => {
    setChallengeId(null)
    setCode('')
    setCodeError(null)
    setError(null)
    setResendIn(0)
    window.setTimeout(() => phoneRef.current?.focus(), 0)
  }

  const primaryButton =
    'w-full disabled:opacity-60 disabled:cursor-wait bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors active:scale-[0.98] cursor-pointer'
  const linkButton = 'text-[11px] font-mono tracking-wider uppercase text-[#4a7333] hover:text-[#1b261b] transition-colors cursor-pointer disabled:cursor-default disabled:text-[#4a584a]/60'

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
          {whatsapp ? 'WhatsApp sign-in' : mode === 'signin' ? 'Welcome Back' : 'Join the Circle'}
        </span>
        <h2 id="login-modal-title" className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
          {whatsapp ? 'Continue with WhatsApp' : mode === 'signin' ? 'Sign in to Elegant Sip' : 'Create your account'}
        </h2>
        <p className="text-xs text-[#4a584a] leading-relaxed mb-8">
          {whatsapp
            ? 'A new number creates your account; an existing number signs you in securely.'
            : mode === 'signin'
            ? 'Access your order history, wishlist, and saved addresses.'
            : 'Save your wishlist, track orders, and get early access to limited harvests.'}
        </p>

        {/* Tabs */}
        {!whatsapp && <div className="flex border border-[#1b261b]/15 rounded-xl p-1 mb-8">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-mono tracking-widest uppercase transition-all cursor-pointer ${mode === m
                  ? 'bg-[#1b261b] text-white'
                  : 'text-[#4a584a] hover:text-[#1b261b]'
                }`}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>}

        {whatsapp ? (
          <div className="space-y-4">
            {!challengeId ? (
              <form onSubmit={(e) => void sendWhatsAppCode(e)} noValidate className="space-y-4">
                <p className="text-xs text-[#4a584a] leading-relaxed">New here? Verify your WhatsApp number to create an account. Already registered? The same code signs you in.</p>
                <div>
                  <label htmlFor="auth-phone" className={labelClass}>WhatsApp number</label>
                  <div className="flex">
                    <span className="inline-flex items-center rounded-l-lg border border-r-0 border-[#1b261b]/15 bg-[#1b261b]/[0.04] px-3 text-sm font-mono text-[#4a584a]" aria-hidden="true">
                      +91
                    </span>
                    <input
                      ref={phoneRef}
                      id="auth-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={phone}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      onBlur={() => phone && setPhoneError(indianMobileError(phone))}
                      placeholder="98765 43210"
                      maxLength={16}
                      aria-invalid={Boolean(phoneError)}
                      aria-describedby={phoneError ? 'auth-phone-error' : 'auth-phone-hint'}
                      className={`${inputClass(Boolean(phoneError))} rounded-l-none`}
                    />
                  </div>
                  {phoneError ? (
                    <FieldError id="auth-phone-error" message={phoneError} />
                  ) : (
                    <p id="auth-phone-hint" className="mt-1.5 text-[11px] text-[#4a584a]">10-digit Indian mobile number with WhatsApp.</p>
                  )}
                </div>
                <button type="submit" disabled={submitting} className={primaryButton}>{submitting ? 'Sending…' : 'Send WhatsApp code'}</button>
              </form>
            ) : (
              <form onSubmit={(e) => void verifyWhatsAppCode(e)} noValidate className="space-y-4">
                <p className="text-xs text-[#4a584a] leading-relaxed" role="status">
                  We sent a 6-digit code to <span className="font-mono font-bold text-[#1b261b]">{sentTo}</span> on WhatsApp. It expires in 10 minutes.
                </p>
                <div>
                  <label htmlFor="auth-code" className={labelClass}>6-digit code</label>
                  <input
                    ref={codeRef}
                    id="auth-code"
                    value={code}
                    onChange={(e) => {
                      const next = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setCode(next)
                      if (codeError && next.length === 6) setCodeError(null)
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    aria-invalid={Boolean(codeError)}
                    aria-describedby={codeError ? 'auth-code-error' : undefined}
                    className={`${inputClass(Boolean(codeError))} tracking-[0.4em]`}
                  />
                  <FieldError id="auth-code-error" message={codeError} />
                </div>
                <button type="submit" disabled={submitting} className={primaryButton}>{submitting ? 'Verifying…' : 'Verify and sign in'}</button>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button type="button" onClick={changeNumber} className={linkButton}>Change number</button>
                  <button type="button" onClick={() => void sendWhatsAppCode()} disabled={resendIn > 0 || submitting} className={linkButton}>
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            )}
            {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
            <button onClick={() => { setWhatsapp(false); setError(null) }} className={linkButton}>Use email and password instead</button>
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
              <label htmlFor="auth-name" className={labelClass}>Full Name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                maxLength={MAX.name}
                onChange={(e) => updateField('name', e.target.value)}
                onBlur={(e) => blurField('name', e.target.value)}
                placeholder="Avery Chen"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined}
                className={inputClass(Boolean(fieldErrors.name))}
              />
              <FieldError id="auth-name-error" message={fieldErrors.name} />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className={labelClass}>Email</label>
            <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete={mode === 'signup' ? 'email' : 'username'}
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              maxLength={MAX.email}
              onChange={(e) => updateField('email', e.target.value)}
              onBlur={(e) => blurField('email', e.target.value)}
              placeholder="you@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
              className={inputClass(Boolean(fieldErrors.email))}
            />
            <FieldError id="auth-email-error" message={fieldErrors.email} />
          </div>
          <div>
            <label htmlFor="auth-password" className={labelClass}>Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              maxLength={MAX.password}
              onChange={(e) => updateField('password', e.target.value)}
              onBlur={(e) => blurField('password', e.target.value)}
              placeholder="••••••••"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'auth-password-error' : mode === 'signup' ? 'auth-password-hint' : undefined}
              className={inputClass(Boolean(fieldErrors.password))}
            />
            {fieldErrors.password ? (
              <FieldError id="auth-password-error" message={fieldErrors.password} />
            ) : (
              mode === 'signup' && (
                <p id="auth-password-hint" className="mt-1.5 text-[11px] text-[#4a584a]">
                  At least {MIN_PASSWORD} characters. Length matters more than symbols.
                </p>
              )
            )}
          </div>

          {error && <p className="text-xs text-red-700" role="alert">{error}</p>}

          {mode === 'signin' && (
            <button type="button" onClick={() => void sendPasswordReset()} className={linkButton}>
              Forgot your password?
            </button>
          )}

          {resetSent && (
            <p className="text-xs text-[#45523f] bg-[#4a7333]/8 border border-[#4a7333]/25 rounded-lg px-4 py-3 leading-relaxed" role="status">
              If that address has an account, a reset link is on its way. It works once and expires
              in an hour.
            </p>
          )}

          <button type="submit" disabled={submitting} className={primaryButton}>
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        )}

        {!registered && mode === 'signin' && !whatsapp && <button onClick={() => { setWhatsapp(true); setError(null) }} className="w-full mt-4 border border-[#4a7333]/40 text-[#4a7333] text-xs font-bold tracking-widest uppercase py-3 rounded-lg cursor-pointer">Continue with WhatsApp</button>}

        <p className="text-[11px] text-[#4a584a] mt-6 leading-relaxed">
          We store your name, email and order history. Nothing is shared with anyone, and we never
          send your address to analytics. See our{' '}
          <a href="/privacy" className="text-[#4a7333] font-semibold underline underline-offset-2">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
