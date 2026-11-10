import { useEffect, useState } from 'react'
import { ApiClientError, adminOpsApi, type AdminOutboxMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/dates'

const KIND_LABELS: Record<string, string> = {
  one_time_link: 'Sign-in / reset link',
  staff_alert: 'Staff alert',
  contact: 'Contact form',
  general: 'Customer email',
}

/**
 * Emails the mail server refused. Pending ones are retried automatically;
 * failed ones only when staff press "Retry now". Bodies are never shown.
 */
export default function EmailOutbox() {
  const [messages, setMessages] = useState<AdminOutboxMessage[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    adminOpsApi
      .emailOutbox()
      .then((page) => {
        if (!cancelled) setMessages(page.messages)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof ApiClientError ? cause.message : 'The email outbox could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const retry = async (message: AdminOutboxMessage) => {
    setBusy(message.id)
    setError('')
    setNotice('')
    try {
      const { message: updated } = await adminOpsApi.retryEmail(message.id)
      if (updated.status === 'sent') {
        setMessages((list) => list?.filter((item) => item.id !== updated.id) ?? list)
        setNotice(`Sent “${updated.subject}” to ${updated.to}.`)
      } else {
        setMessages((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? list)
        setError(`Still not sent: ${updated.lastError ?? 'the mail server refused it.'}`)
      }
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The retry could not be started.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mt-10" aria-labelledby="email-outbox-heading">
      <div className="mb-4">
        <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#4a7333]">Mail delivery</span>
        <h2 id="email-outbox-heading" className="mt-1 text-xl font-bold uppercase tracking-tight">Email outbox</h2>
        <p className="mt-1 text-xs text-[#4a584a]">Emails the mail server refused. Waiting ones are retried automatically for a few hours; failed ones need you.</p>
      </div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <p role="status" className="mb-4 text-sm text-[#315b26]">{notice}</p>}
      <div className="overflow-hidden rounded-2xl border border-[#1b261b]/10 bg-white">
        {messages === null ? <p className="p-6 text-sm text-[#4a584a]">{error ? 'Outbox unavailable.' : 'Loading the outbox…'}</p> : messages.length === 0 ? <p className="p-6 text-sm text-[#4a584a]">Nothing is waiting to be sent.</p> : (
          <ul className="divide-y divide-[#1b261b]/10">
            {messages.map((message) => (
              <li key={message.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold wrap-break-word">{message.subject}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${message.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{message.status === 'failed' ? 'Failed' : 'Retrying'}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#4a584a] break-all">{KIND_LABELS[message.kind] ?? message.kind} · to {message.to}</p>
                  <p className="mt-1 text-[10px] font-mono text-[#4a584a]">
                    First tried {formatDateTime(message.createdAt)} · {message.attempts} attempt{message.attempts === 1 ? '' : 's'}
                    {message.status === 'pending' ? ` · next try ${formatDateTime(message.nextAttemptAt)}` : ''}
                  </p>
                  {message.lastError && <p className="mt-1 max-w-2xl text-xs text-rose-800 wrap-break-word">{message.lastError}</p>}
                </div>
                <button onClick={() => void retry(message)} disabled={busy !== null} className="shrink-0 rounded-full border border-[#1b261b]/20 px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider hover:border-[#8bb56e] disabled:opacity-50">
                  {busy === message.id ? 'Sending…' : 'Retry now'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
