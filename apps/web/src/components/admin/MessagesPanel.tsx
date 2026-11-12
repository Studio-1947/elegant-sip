import { useEffect, useState, type CSSProperties } from 'react'
import { adminApi, downloadCsv, today, type ContactMessage } from '../../lib/adminApi'
import { formatDateTime, formatShortDate } from '../../lib/dates'
import { cardClass, errorText, inputClass, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import { Empty, Spinner, Tabs } from './ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * Messages — the contact-form inbox and newsletter sign-ups. Each contact
 * message was also emailed to the shop inbox; replies go from email.
 * ──────────────────────────────────────────────────────────────────────────── */

type View = 'contact' | 'newsletter'
const PAGE = 50

const replyLink = (m: ContactMessage) => `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject} [${m.reference}]`)}`

function ContactInbox() {
  const { toast } = useFeedback()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<{ key: string; messages: ContactMessage[]; total: number } | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const key = `${q}|${offset}`
  const current = page?.key === key ? page : null

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim())
      setOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    adminApi
      .contactMessages({ q: q || undefined, limit: PAGE, offset })
      .then((result) => {
        if (!cancelled) setPage({ key, ...result })
      })
      .catch((cause) => {
        if (!cancelled) toast({ tone: 'error', text: errorText(cause, 'Messages could not be loaded.') })
      })
    return () => {
      cancelled = true
    }
  }, [key, q, offset, toast])

  return (
    <div>
      <label className="mb-4 block sm:max-w-sm">
        <span className="sr-only">Search messages</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, name, email or subject" className={inputClass} />
      </label>
      {!current ? (
        <div className="grid place-items-center py-12 text-[#4a7333]">
          <Spinner className="h-6 w-6" />
        </div>
      ) : current.messages.length === 0 ? (
        <div className={cardClass}>
          <Empty title={q ? 'No messages match' : 'No messages yet'}>Messages sent from the Contact page appear here.</Empty>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {current.messages.map((m, i) => {
              const expanded = open === m.id
              return (
                <li key={m.id} style={{ '--i': Math.min(i, 10) } as CSSProperties} className={`adm-rise p-4 ${cardClass}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <button onClick={() => setOpen(expanded ? null : m.id)} aria-expanded={expanded} className="min-w-0 text-left">
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="text-sm text-[#1b261b]">{m.subject}</b>
                        <span className="font-mono text-[10px] text-[#4a584a]">{m.reference}</span>
                        {m.hasAccount && <span className="rounded-full bg-[#8bb56e]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#315b26]">Has account</span>}
                      </span>
                      <span className="mt-1 block text-xs text-[#4a584a]">
                        {m.name} · {m.email} · {formatDateTime(m.createdAt)}
                      </span>
                      {!expanded && <span className="mt-1 block truncate text-xs text-[#4a584a]/80">{m.message}</span>}
                    </button>
                    <a href={replyLink(m)} className={`${quietButton} shrink-0`}>
                      Reply ↗
                    </a>
                  </div>
                  {expanded && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#f4f6f1] p-3 text-sm leading-relaxed text-[#1b261b] wrap-break-word">{m.message}</p>}
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#4a584a]">
            <span>
              {offset + 1}–{offset + current.messages.length} of {current.total}
            </span>
            <span className="flex gap-2">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className={quietButton}>
                ← Prev
              </button>
              <button disabled={offset + PAGE >= current.total} onClick={() => setOffset(offset + PAGE)} className={quietButton}>
                Next →
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}

type Subscribers = Awaited<ReturnType<typeof adminApi.newsletter>>

function Newsletter() {
  const { toast } = useFeedback()
  const [data, setData] = useState<Subscribers | null>(null)

  useEffect(() => {
    let cancelled = false
    adminApi
      .newsletter()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((cause) => {
        if (!cancelled) toast({ tone: 'error', text: errorText(cause, 'Newsletter sign-ups could not be loaded.') })
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  if (!data) {
    return (
      <div className="grid place-items-center py-12 text-[#4a7333]">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  const active = data.subscribers.filter((s) => !s.unsubscribedAt)
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#4a584a]">
          <b className="text-[#1b261b]">{data.active}</b> subscribed · {data.total - data.active} unsubscribed · {data.total} total
        </p>
        <button
          disabled={active.length === 0}
          onClick={() => downloadCsv(`elegant-sip-newsletter-${today()}.csv`, ['Email', 'Subscribed'], active.map((s) => [s.email, s.subscribedAt.slice(0, 10)]))}
          className={quietButton}
        >
          Export subscribers (CSV)
        </button>
      </div>
      {data.subscribers.length === 0 ? (
        <div className={cardClass}>
          <Empty title="No sign-ups yet" />
        </div>
      ) : (
        <ul className={`divide-y divide-[#1b261b]/[0.07] ${cardClass}`}>
          {data.subscribers.map((s) => (
            <li key={s.email} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className={`break-all ${s.unsubscribedAt ? 'text-[#4a584a] line-through' : 'text-[#1b261b]'}`}>{s.email}</span>
              <span className="text-xs text-[#4a584a]">
                {s.unsubscribedAt ? `Unsubscribed ${formatShortDate(s.unsubscribedAt)}` : `Since ${formatShortDate(s.subscribedAt)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function MessagesPanel() {
  const [view, setView] = useState<View>('contact')
  return (
    <section>
      <div className="mb-5">
        <Tabs<View>
          value={view}
          onChange={setView}
          items={[
            { value: 'contact', label: 'Contact messages' },
            { value: 'newsletter', label: 'Newsletter' },
          ]}
        />
      </div>
      {view === 'contact' ? <ContactInbox /> : <Newsletter />}
    </section>
  )
}
