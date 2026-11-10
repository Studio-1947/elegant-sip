import { useEffect, useState } from 'react'
import { ApiClientError, adminOpsApi, type AdminAuditActor, type AdminAuditEvent } from '../../lib/api'
import { formatDateTime } from '../../lib/dates'

const PAGE = 50

/**
 * Read-only view of staff changes. The log is append-only in the database,
 * so there is deliberately nothing here to edit or delete.
 */
export default function AuditLog() {
  const [actor, setActor] = useState('')
  // Tagged with its filter, so a page fetched for another person is never shown as this one.
  const [list, setList] = useState<{ actor: string; events: AdminAuditEvent[]; hasMore: boolean } | null>(null)
  const [actors, setActors] = useState<AdminAuditActor[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const events = list?.actor === actor ? list.events : null

  useEffect(() => {
    let cancelled = false
    adminOpsApi
      .audit({ limit: PAGE, actor: actor || undefined })
      .then((page) => {
        if (cancelled) return
        setList({ actor, events: page.events, hasMore: page.hasMore })
        setActors(page.actors)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof ApiClientError ? cause.message : 'The audit log could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [actor])

  const loadMore = async () => {
    if (!list) return
    const { actor: current, events: shown } = list
    setLoadingMore(true)
    setError('')
    try {
      const page = await adminOpsApi.audit({ limit: PAGE, offset: shown.length, actor: current || undefined })
      setList((existing) => {
        if (existing?.actor !== current) return existing
        // New entries shift the pages while you read; never show one twice.
        const seen = new Set(existing.events.map((item) => item.id))
        return { actor: current, events: [...existing.events, ...page.events.filter((item) => !seen.has(item.id))], hasMore: page.hasMore }
      })
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'More entries could not be loaded.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section className="mt-10" aria-labelledby="audit-log-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#4a7333]">Accountability</span>
          <h2 id="audit-log-heading" className="mt-1 text-xl font-bold uppercase tracking-tight">Audit log</h2>
          <p className="mt-1 text-xs text-[#4a584a]">Every successful staff change, newest first. Entries cannot be edited or deleted.</p>
        </div>
        <label className="text-xs font-mono uppercase tracking-wider text-[#4a584a]">Staff
          <select value={actor} onChange={(event) => { setActor(event.target.value); setError('') }} className="ml-3 max-w-[16rem] rounded-lg border border-[#1b261b]/15 bg-white px-3 py-2 text-xs text-[#1b261b]">
            <option value="">Everyone</option>
            {actors.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.email})</option>)}
          </select>
        </label>
      </div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-[#1b261b]/10 bg-white">
        {events === null ? <p className="p-6 text-sm text-[#4a584a]">{error ? 'Audit log unavailable.' : 'Loading the audit log…'}</p> : events.length === 0 ? <p className="p-6 text-sm text-[#4a584a]">No staff changes recorded yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#1b261b]/10 bg-[#f9faf7] text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">
                <tr><th scope="col" className="px-4 py-3 font-normal">When</th><th scope="col" className="px-4 py-3 font-normal">Who</th><th scope="col" className="px-4 py-3 font-normal">Change</th><th scope="col" className="px-4 py-3 font-normal">Result</th></tr>
              </thead>
              <tbody className="divide-y divide-[#1b261b]/10">
                {events.map((event) => (
                  <tr key={event.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[#4a584a]">{formatDateTime(event.occurredAt)}</td>
                    <td className="px-4 py-3"><span className="font-bold">{event.actor.name}</span><span className="block break-all text-[#4a584a]">{event.actor.email}</span></td>
                    <td className="px-4 py-3 font-mono break-all">{event.action}{event.resource !== event.action.split(' ').slice(1).join(' ') && <span className="block text-[#4a584a]">{event.resource}</span>}</td>
                    <td className="px-4 py-3 font-mono text-[#4a584a]">{event.statusCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {events && list?.hasMore && <div className="border-t border-[#1b261b]/10 p-4 text-center"><button onClick={() => void loadMore()} disabled={loadingMore} className="rounded-full border border-[#1b261b]/20 px-5 py-2 text-[10px] font-mono uppercase tracking-wider hover:border-[#8bb56e] disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button></div>}
      </div>
    </section>
  )
}
