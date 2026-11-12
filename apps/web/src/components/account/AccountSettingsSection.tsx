import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { formatIndianMobile } from '@elegantsip/shared'
import { useAuth, type User } from '../AuthContext'
import { ApiClientError, api, credentialsApi, mfaApi, type MfaStatus } from '../../lib/api'
import { cachedAuthMethods, loadAuthMethods } from '../../lib/authMethods'
import { AUTH_MAX, MIN_PASSWORD, emailError, nameError, newPasswordError } from '../../lib/authRules'
import { CONTACT_EMAIL, WHATSAPP_URL } from '../../lib/site'

/* Name, email, password, two-step sign-in and sessions. Every message after a
   save repeats what the API reported: an email is called "sent" only when the
   API says the mail server accepted it (`delivered`), never otherwise. */

type Status = { tone: 'ok' | 'error'; text: string } | null

const NOT_SENT = 'The email could not be sent right now.'
type Errors = Record<string, string | undefined>

const inputBase = 'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[#4a7333]'
const cardClass = 'rounded-2xl border border-[#1b261b]/10 bg-white p-5 sm:p-6'
const headingClass = 'text-sm font-bold uppercase tracking-wide mb-1'
const introClass = 'text-xs leading-relaxed text-[#4a584a] mb-4'
const primaryButton = 'rounded-lg bg-[#1b261b] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#4a7333] disabled:opacity-60 disabled:cursor-wait'
const linkButton = 'text-xs font-bold uppercase tracking-wider text-[#4a7333] hover:text-[#1b261b] disabled:opacity-60 disabled:cursor-wait'

function Field({ id, label, error, hint, ...input }: { id: string; label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium">{label}</label>
      <input
        id={id}
        {...input}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`${inputBase} mt-1.5 ${error ? 'border-red-600' : 'border-[#1b261b]/15'}`}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-700">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[11px] text-[#4a584a]">{hint}</p>
      ) : null}
    </div>
  )
}

/** Always in the DOM, so screen readers announce what changes inside it. */
/**
 * The account's current email, hidden, for the browser's password manager.
 * Without it, Chrome treats "new email + current password" as a sign-in form
 * and fills a saved login into the new-email box.
 */
function HiddenUsername({ email }: { email: string }) {
  return <input type="email" name="username" autoComplete="username" value={email} readOnly hidden tabIndex={-1} aria-hidden="true" />
}

function StatusMessage({ status }: { status: Status }) {
  return (
    <div aria-live="polite" className="empty:hidden mt-3">
      {status && (
        <p className={`text-xs leading-relaxed ${status.tone === 'error' ? 'text-red-700' : 'text-[#4a7333]'}`}>{status.text}</p>
      )}
    </div>
  )
}

/** The API's own words, plus its per-field messages for the fields given. */
function useFailure() {
  const { refresh } = useAuth()
  return (err: unknown, fields: string[], fallback: string): { status: Status; errors: Errors } => {
    if (!(err instanceof ApiClientError)) return { status: { tone: 'error', text: fallback }, errors: {} }
    // The session ended elsewhere: let the page show the signed-out state.
    if (err.type === 'unauthenticated') void refresh()
    const errors: Errors = {}
    for (const field of fields) {
      const message = err.fieldErrors?.[field]?.[0]
      if (message) errors[field] = message.endsWith('.') ? message : `${message}.`
    }
    return { status: { tone: 'error', text: err.message }, errors }
  }
}

function focusFirst(prefix: string, fields: string[], errors: Errors) {
  const first = fields.find((field) => errors[field])
  if (first) document.getElementById(`${prefix}-${first}`)?.focus()
}

function NameCard({ user }: { user: User }) {
  const { applyUser } = useAuth()
  const fail = useFailure()
  const [name, setName] = useState(user.nameIsPlaceholder ? '' : user.name)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>(null)
  const [saving, setSaving] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const problem = nameError(name)
    setErrors({ name: problem })
    if (problem) {
      setStatus(null)
      focusFirst('settings', ['name'], { name: problem })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const result = await api.auth.updateName(name.trim())
      applyUser(result.user)
      setName(result.user.name)
      setStatus({ tone: 'ok', text: 'Your name has been saved.' })
    } catch (err) {
      const failure = fail(err, ['name'], 'We could not save your name. Please try again.')
      setErrors(failure.errors)
      setStatus(failure.status)
    } finally {
      setSaving(false)
    }
  }

  const local = user.phone?.startsWith('+91') ? user.phone.slice(3) : null

  return (
    <form onSubmit={(e) => void save(e)} noValidate className={cardClass} aria-labelledby="settings-name-heading">
      <h3 id="settings-name-heading" className={headingClass}>Your details</h3>
      <p className={introClass}>The name we use on your account and in emails to you.</p>
      <div className="space-y-4">
        <Field
          id="settings-name"
          label="Full name"
          value={name}
          maxLength={AUTH_MAX.name}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <div>
          <p className="block text-xs font-medium">WhatsApp number</p>
          <p className="mt-1.5 text-sm font-mono">{user.phone ? (local ? `+91 ${formatIndianMobile(local)}` : user.phone) : 'Not linked'}</p>
          <p className="mt-1.5 text-[11px] text-[#4a584a]">
            Your number is checked with a WhatsApp code, so it is not typed in here. Use WhatsApp sign-in above to link {user.phone ? 'a different' : 'a'} number.
          </p>
        </div>
      </div>
      <button type="submit" disabled={saving} className={`${primaryButton} mt-5`}>{saving ? 'Saving…' : 'Save name'}</button>
      <StatusMessage status={status} />
    </form>
  )
}

function EmailCard({ user }: { user: User }) {
  const { applyUser } = useAuth()
  const fail = useFailure()
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>(null)
  const [saving, setSaving] = useState(false)
  const [resendStatus, setResendStatus] = useState<Status>(null)
  const [resending, setResending] = useState(false)

  const resend = async () => {
    if (resending) return
    setResending(true)
    setResendStatus(null)
    try {
      const { delivered } = await api.auth.resendVerification()
      setResendStatus(
        delivered
          ? { tone: 'ok', text: `We sent a new confirmation link to ${user.email}. It works for 24 hours. If nothing arrives within a few minutes, check your spam folder.` }
          : { tone: 'error', text: `${NOT_SENT} Please try again in a few minutes, or contact us at ${CONTACT_EMAIL}.` },
      )
    } catch (err) {
      setResendStatus(fail(err, [], 'We could not request a new link. Please try again.').status)
    } finally {
      setResending(false)
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const fields = ['newEmail', 'currentPassword']
    const next: Errors = {
      newEmail: emailError(newEmail),
      currentPassword: password ? undefined : 'Enter your current password.',
    }
    setErrors(next)
    if (fields.some((field) => next[field])) {
      setStatus(null)
      focusFirst('settings-email', fields, next)
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const result = await api.auth.changeEmail({ newEmail: newEmail.trim(), currentPassword: password })
      applyUser(result.user)
      setNewEmail('')
      setPassword('')
      setResendStatus(null)
      setStatus(
        result.delivered
          ? { tone: 'ok', text: `Your account email is now ${result.user.email}. We sent a confirmation link there; the address stays unconfirmed until you open it.` }
          : { tone: 'ok', text: `Your account email is now ${result.user.email}, but the confirmation link could not be sent right now. Use “Resend confirmation email” above in a few minutes, or contact us at ${CONTACT_EMAIL}.` },
      )
    } catch (err) {
      const failure = fail(err, fields, 'We could not change your email. Please try again.')
      setErrors(failure.errors)
      setStatus(failure.status)
      focusFirst('settings-email', fields, failure.errors)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cardClass}>
      <h3 id="settings-email-heading" className={headingClass}>Email address</h3>
      <p className="text-sm font-mono break-all">{user.email}</p>
      <p className={`mt-1 text-[11px] font-semibold ${user.emailVerified ? 'text-[#4a7333]' : 'text-amber-800'}`}>
        {user.emailVerified ? 'Confirmed' : 'Not confirmed yet'}
      </p>
      {!user.emailVerified && (
        <div className="mt-2">
          <p className="text-xs leading-relaxed text-[#4a584a]">Confirm it with the link from our confirmation email. No email? Ask for a new link.</p>
          <button type="button" onClick={() => void resend()} disabled={resending} className={`${linkButton} mt-2`}>
            {resending ? 'Requesting…' : 'Resend confirmation email'}
          </button>
          <StatusMessage status={resendStatus} />
        </div>
      )}

      <form onSubmit={(e) => void save(e)} noValidate aria-labelledby="settings-email-change" className="mt-5 border-t border-[#1b261b]/10 pt-5">
        <HiddenUsername email={user.email} />
        <h4 id="settings-email-change" className="text-xs font-bold uppercase tracking-wide mb-1">Change email</h4>
        <p className={introClass}>
          We email a confirmation link to the new address, which stays unconfirmed until you open it, and let your current
          address know about the change.
        </p>
        <div className="space-y-4">
          <Field
            id="settings-email-newEmail"
            label="New email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={newEmail}
            maxLength={AUTH_MAX.email}
            onChange={(e) => setNewEmail(e.target.value)}
            error={errors.newEmail}
          />
          <Field
            id="settings-email-currentPassword"
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={password}
            maxLength={AUTH_MAX.password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.currentPassword}
          />
        </div>
        <button type="submit" disabled={saving} className={`${primaryButton} mt-5`}>{saving ? 'Saving…' : 'Change email'}</button>
        <StatusMessage status={status} />
      </form>
    </div>
  )
}

function PasswordCard({ email }: { email: string }) {
  const fail = useFailure()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>(null)
  const [saving, setSaving] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const fields = ['currentPassword', 'newPassword']
    const found: Errors = {
      currentPassword: current ? undefined : 'Enter your current password.',
      newPassword: newPasswordError(next) ?? (next === current ? 'Choose a password different from your current one.' : undefined),
    }
    setErrors(found)
    if (fields.some((field) => found[field])) {
      setStatus(null)
      focusFirst('settings-password', fields, found)
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const { delivered } = await api.auth.changePassword({ currentPassword: current, newPassword: next })
      setCurrent('')
      setNext('')
      setStatus({
        tone: 'ok',
        text: `Password changed. Every other device has been signed out; this one stays signed in. ${
          delivered ? 'We emailed you a note of the change.' : 'We could not email you a note of the change right now, but the change itself is saved.'
        }`,
      })
    } catch (err) {
      const failure = fail(err, fields, 'We could not change your password. Please try again.')
      setErrors(failure.errors)
      setStatus(failure.status)
      focusFirst('settings-password', fields, failure.errors)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className={cardClass} aria-labelledby="settings-password-heading">
      <HiddenUsername email={email} />
      <h3 id="settings-password-heading" className={headingClass}>Password</h3>
      <p className={introClass}>Changing it signs you out on every other device.</p>
      <div className="space-y-4">
        <Field
          id="settings-password-currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          maxLength={AUTH_MAX.password}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.currentPassword}
        />
        <Field
          id="settings-password-newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          maxLength={AUTH_MAX.password}
          onChange={(e) => setNext(e.target.value)}
          error={errors.newPassword}
          hint={`At least ${MIN_PASSWORD} characters. Length matters more than symbols.`}
        />
      </div>
      <button type="submit" disabled={saving} className={`${primaryButton} mt-5`}>{saving ? 'Saving…' : 'Change password'}</button>
      <StatusMessage status={status} />
    </form>
  )
}

/** WhatsApp-only accounts add their first email and password, proven with a fresh WhatsApp code (gap O10). */
function AddCredentialsCard({ user, onAdded }: { user: User; onAdded: (notice: Status) => void }) {
  const { applyUser } = useAuth()
  const fail = useFailure()
  const [whatsapp, setWhatsapp] = useState<boolean | null>(() => cachedAuthMethods()?.whatsapp ?? null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (whatsapp !== null) return
    let live = true
    void loadAuthMethods().then((methods) => live && setWhatsapp(methods.whatsapp))
    return () => {
      live = false
    }
  }, [whatsapp])

  const local = user.phone?.startsWith('+91') ? user.phone.slice(3) : null
  const number = local ? `+91 ${formatIndianMobile(local)}` : (user.phone ?? 'your WhatsApp number')

  if (whatsapp === null) {
    return (
      <div className={cardClass}>
        <h3 className={headingClass}>Email and password</h3>
        <p className="text-xs text-[#4a584a]">Checking…</p>
      </div>
    )
  }

  // Without WhatsApp codes there is no way to prove the account is theirs here.
  if (!whatsapp) {
    return (
      <div className={cardClass}>
        <h3 className={headingClass}>Email and password</h3>
        <p className="text-xs leading-relaxed text-[#4a584a]">
          You signed up with WhatsApp, so this account has no email address or password yet. Adding them here needs a WhatsApp
          code, which is not available right now. If you need email sign-in, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#4a7333] underline underline-offset-2">{CONTACT_EMAIL}</a> or on{' '}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#4a7333] underline underline-offset-2">WhatsApp</a>.
        </p>
      </div>
    )
  }

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    const fields = ['email', 'password']
    const found: Errors = { email: emailError(email), password: newPasswordError(password) }
    setErrors(found)
    if (fields.some((field) => found[field])) {
      setStatus(null)
      focusFirst('settings-credentials', fields, found)
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const result = await credentialsApi.requestCode()
      setChallengeId(result.challengeId)
      setCode('')
      setStatus({ tone: 'ok', text: `We sent a 6-digit code to ${number} on WhatsApp. It expires in 10 minutes.` })
      window.setTimeout(() => document.getElementById('settings-credentials-code')?.focus(), 0)
    } catch (err) {
      setStatus(fail(err, [], 'We could not send a WhatsApp code. Please try again.').status)
    } finally {
      setBusy(false)
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !challengeId) return
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: 'Enter the 6-digit code from WhatsApp.' })
      focusFirst('settings-credentials', ['code'], { code: 'x' })
      return
    }
    setErrors({})
    setBusy(true)
    setStatus(null)
    try {
      const result = await credentialsApi.add({ challengeId, code, email: email.trim(), password })
      onAdded(
        result.delivered
          ? { tone: 'ok', text: `Email and password added. We sent a confirmation link to ${result.user.email}; you can sign in with them now either way.` }
          : { tone: 'ok', text: `Email and password added, and you can sign in with them now. The confirmation link could not be sent right now; use “Resend confirmation email” in a few minutes, or contact us at ${CONTACT_EMAIL}.` },
      )
      applyUser(result.user)
    } catch (err) {
      const fields = ['email', 'password', 'code']
      const failure = fail(err, fields, 'We could not add your email and password. Please try again.')
      setErrors(failure.errors)
      setStatus(failure.status)
      // A used or expired code cannot be retried; the visitor asks for a new one.
      if (err instanceof ApiClientError && (err.status === 409 || err.type === 'otp_rate_limited')) setChallengeId(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void (challengeId ? save(e) : sendCode(e))} noValidate className={cardClass} aria-labelledby="settings-credentials-heading">
      <h3 id="settings-credentials-heading" className={headingClass}>Email and password</h3>
      <p className={introClass}>
        You signed up with WhatsApp, so this account has no email address or password yet. Add them to sign in by email and get
        order emails. We check it is you with a WhatsApp code to {number}.
      </p>
      <div className="space-y-4">
        <Field
          id="settings-credentials-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          maxLength={AUTH_MAX.email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          disabled={Boolean(challengeId)}
        />
        <Field
          id="settings-credentials-password"
          label="Choose a password"
          type="password"
          autoComplete="new-password"
          value={password}
          maxLength={AUTH_MAX.password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters. Length matters more than symbols.`}
          disabled={Boolean(challengeId)}
        />
        {challengeId && (
          <Field
            id="settings-credentials-code"
            label="6-digit WhatsApp code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={errors.code}
          />
        )}
      </div>
      <button type="submit" disabled={busy} className={`${primaryButton} mt-5`}>
        {challengeId ? (busy ? 'Saving…' : 'Add email and password') : busy ? 'Sending…' : 'Send WhatsApp code'}
      </button>
      {challengeId && (
        <button type="button" onClick={() => { setChallengeId(null); setStatus(null) }} disabled={busy} className={`${linkButton} mt-3 block`}>
          Change details or send a new code
        </button>
      )}
      <StatusMessage status={status} />
    </form>
  )
}

/** Staff only: authenticator-app codes on top of the password (gap O12). */
function TwoStepCard({ email }: { email: string }) {
  const fail = useFailure()
  const [mfa, setMfa] = useState<MfaStatus | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    mfaApi
      .status()
      .then((result) => live && setMfa(result))
      .catch(() => live && setLoadFailed(true))
    return () => {
      live = false
    }
  }, [])

  const run = async (fields: string[], work: () => Promise<void>, fallback: string) => {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      await work()
    } catch (err) {
      const failure = fail(err, fields, fallback)
      setErrors(failure.errors)
      setStatus(failure.status)
    } finally {
      setBusy(false)
    }
  }

  const start = (e: FormEvent) => {
    e.preventDefault()
    if (!password) {
      setErrors({ currentPassword: 'Enter your current password.' })
      focusFirst('settings-mfa', ['currentPassword'], { currentPassword: 'x' })
      return
    }
    setErrors({})
    void run(['currentPassword'], async () => {
      setSetup(await mfaApi.setup(password))
      setPassword('')
      setCode('')
      window.setTimeout(() => document.getElementById('settings-mfa-code')?.focus(), 0)
    }, 'We could not start setting up two-step sign-in. Please try again.')
  }

  const confirm = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: 'Enter the 6-digit code from your authenticator app.' })
      focusFirst('settings-mfa', ['code'], { code: 'x' })
      return
    }
    setErrors({})
    void run(['code'], async () => {
      const result = await mfaApi.confirm(code)
      setRecoveryCodes(result.recoveryCodes)
      setSetup(null)
      setCode('')
      setMfa((current) => current && { ...current, enabled: true, recoveryCodesLeft: result.recoveryCodes.length })
      setStatus({ tone: 'ok', text: 'Two-step sign-in is on. Every other device has been signed out.' })
    }, 'We could not turn on two-step sign-in. Please try again.')
  }

  const disable = (e: FormEvent) => {
    e.preventDefault()
    const found: Errors = {
      currentPassword: password ? undefined : 'Enter your current password.',
      code: code.trim() ? undefined : 'Enter a code from your authenticator app, or a recovery code.',
    }
    setErrors(found)
    if (found.currentPassword || found.code) {
      focusFirst('settings-mfa', ['currentPassword', 'code'], found)
      return
    }
    void run(['currentPassword', 'code'], async () => {
      await mfaApi.disable({ currentPassword: password, code: code.trim() })
      setPassword('')
      setCode('')
      setMfa((current) => current && { ...current, enabled: false, recoveryCodesLeft: 0 })
      setStatus({ tone: 'ok', text: 'Two-step sign-in is off. Signing in needs only your password now.' })
    }, 'We could not turn off two-step sign-in. Please try again.')
  }

  const copyCodes = async () => {
    if (!recoveryCodes) return
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'))
      setStatus({ tone: 'ok', text: 'Recovery codes copied. Paste them somewhere safe, like a password manager.' })
    } catch {
      setStatus({ tone: 'error', text: 'Your browser would not copy them. Select the codes and copy them by hand.' })
    }
  }

  const passwordField = (
    <Field
      id="settings-mfa-currentPassword"
      label="Current password"
      type="password"
      autoComplete="current-password"
      value={password}
      maxLength={AUTH_MAX.password}
      onChange={(e) => setPassword(e.target.value)}
      error={errors.currentPassword}
    />
  )

  let body: ReactNode
  if (loadFailed) {
    body = <p className="text-xs leading-relaxed text-red-700">We could not check two-step sign-in right now. Reload the page to try again.</p>
  } else if (!mfa) {
    body = <p className="text-xs text-[#4a584a]">Checking…</p>
  } else if (recoveryCodes) {
    body = (
      <div>
        <p className="text-xs leading-relaxed text-[#1b261b]">
          Save these recovery codes now — this is the only time they are shown. Each one signs you in once if you lose your phone.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[#1b261b]/10 bg-[#f9faf7] p-4 font-mono text-sm" aria-label="Recovery codes">
          {recoveryCodes.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void copyCodes()} className={primaryButton}>Copy codes</button>
          <button type="button" onClick={() => { setRecoveryCodes(null); setStatus(null) }} className="rounded-lg border border-[#1b261b]/20 px-5 py-3 text-xs font-bold uppercase tracking-widest text-[#1b261b]">
            I have saved them
          </button>
        </div>
      </div>
    )
  } else if (mfa.enabled) {
    body = (
      <form onSubmit={disable} noValidate>
        <HiddenUsername email={email} />
        <p className="text-sm font-semibold text-[#4a7333]">On</p>
        <p className={introClass}>
          {mfa.recoveryCodesLeft} recovery code{mfa.recoveryCodesLeft === 1 ? '' : 's'} left. To turn it off, confirm your password and a current code.
        </p>
        <div className="space-y-4">
          {passwordField}
          <Field
            id="settings-mfa-code"
            label="Authenticator or recovery code"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
          />
        </div>
        <button type="submit" disabled={busy} className="mt-5 rounded-lg border border-red-700/40 px-5 py-3 text-xs font-bold uppercase tracking-widest text-red-700 hover:bg-red-50 disabled:opacity-60 disabled:cursor-wait">
          {busy ? 'Turning off…' : 'Turn off two-step sign-in'}
        </button>
      </form>
    )
  } else if (!mfa.available) {
    body = (
      <p className="text-xs leading-relaxed text-[#4a584a]">
        Two-step sign-in cannot be turned on yet: the server has no encryption key for authenticator secrets. Ask whoever runs the
        server to set MFA_ENCRYPTION_KEY.
      </p>
    )
  } else if (setup) {
    body = (
      <form onSubmit={confirm} noValidate>
        <ol className="list-decimal space-y-3 pl-4 text-xs leading-relaxed text-[#4a584a]">
          <li>
            In an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), add an account with this key:
            <code className="mt-2 block break-all rounded-lg bg-[#f9faf7] px-3 py-2 font-mono text-sm tracking-wider text-[#1b261b]">
              {setup.secret.match(/.{1,4}/g)?.join(' ')}
            </code>
            <a href={setup.otpauthUri} className="mt-2 inline-block font-semibold text-[#4a7333] underline underline-offset-2">
              On this phone? Open it in your authenticator app
            </a>
          </li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        <div className="mt-4">
          <Field
            id="settings-mfa-code"
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={errors.code}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Checking…' : 'Turn on'}</button>
          <button type="button" onClick={() => { setSetup(null); setErrors({}); setStatus(null) }} disabled={busy} className={linkButton}>Cancel</button>
        </div>
      </form>
    )
  } else {
    body = (
      <form onSubmit={start} noValidate>
        <HiddenUsername email={email} />
        <p className="text-sm font-semibold text-amber-800">Off</p>
        <p className={introClass}>
          With it on, signing in needs your password and a code from an authenticator app on your phone, so a leaked password
          alone cannot open the staff dashboard.
        </p>
        {passwordField}
        <button type="submit" disabled={busy} className={`${primaryButton} mt-5`}>{busy ? 'Starting…' : 'Set up two-step sign-in'}</button>
      </form>
    )
  }

  return (
    <div id="two-step" className={`${cardClass} scroll-mt-28`}>
      <h3 className={headingClass}>Two-step sign-in</h3>
      {body}
      <StatusMessage status={status} />
    </div>
  )
}

function SignOutEverywhereCard({ onSignedOut }: { onSignedOut?: () => void }) {
  const { logoutEverywhere } = useAuth()
  const fail = useFailure()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)

  // Focus follows the question: onto it when asked, back to the trigger when dropped.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
    else if (wasConfirming.current) triggerRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      await logoutEverywhere()
      onSignedOut?.()
    } catch (err) {
      setStatus(fail(err, [], 'We could not sign you out everywhere. Please try again.').status)
      setBusy(false)
    }
  }

  return (
    <div className={cardClass}>
      <h3 id="settings-sessions-heading" className={headingClass}>Signed-in devices</h3>
      <p className={introClass}>Lost a phone, or signed in on a shared computer? End every session at once.</p>
      {confirming ? (
        <div role="group" aria-labelledby="settings-sessions-confirm" className="rounded-xl border border-red-700/25 bg-red-50 p-4">
          <p id="settings-sessions-confirm" className="text-xs leading-relaxed text-[#1b261b]">
            This signs you out on every device, including this one. You will need to sign in again.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => void signOut()} disabled={busy} className="rounded-lg bg-red-700 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-red-800 disabled:opacity-60 disabled:cursor-wait">
              {busy ? 'Signing out…' : 'Sign out everywhere'}
            </button>
            <button ref={cancelRef} type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded-lg border border-[#1b261b]/20 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-[#1b261b] hover:bg-white disabled:opacity-60">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button ref={triggerRef} type="button" onClick={() => { setStatus(null); setConfirming(true) }} className="rounded-lg border border-[#1b261b]/20 px-5 py-3 text-xs font-bold uppercase tracking-widest text-[#1b261b] transition-colors hover:border-red-700 hover:text-red-700">
          Sign out of all devices
        </button>
      )}
      <StatusMessage status={status} />
    </div>
  )
}

export default function AccountSettingsSection({ onSignedOutEverywhere }: { onSignedOutEverywhere?: () => void }) {
  const { user } = useAuth()
  // Kept here because the card that sets it unmounts once the account has an email.
  const [credentialsNotice, setCredentialsNotice] = useState<Status>(null)
  if (!user) return null
  // Stand-in email: the password and email routes need a password this account never chose.
  const whatsappOnly = user.emailIsPlaceholder

  return (
    <section id="settings" aria-labelledby="account-settings-heading" className="scroll-mt-28 mt-12">
      <h2 id="account-settings-heading" className="text-lg font-bold uppercase tracking-wide mb-2">Account settings</h2>
      <p className="text-xs text-[#4a584a] mb-6 max-w-2xl leading-relaxed">Your name, sign-in details and signed-in devices.</p>
      {credentialsNotice && (
        <div className="mb-4 rounded-xl border border-[#4a7333]/25 bg-[#4a7333]/8 px-4 py-3" role="status">
          <p className="text-xs leading-relaxed text-[#315b26]">{credentialsNotice.text}</p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <NameCard user={user} />
        {whatsappOnly ? <AddCredentialsCard user={user} onAdded={setCredentialsNotice} /> : <EmailCard user={user} />}
        {!whatsappOnly && <PasswordCard email={user.email} />}
        {user.role === 'admin' && !whatsappOnly && <TwoStepCard email={user.email} />}
        <SignOutEverywhereCard onSignedOut={onSignedOutEverywhere} />
      </div>
    </section>
  )
}
