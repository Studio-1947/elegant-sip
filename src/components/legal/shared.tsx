import { type ReactNode } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
 * Shared building blocks for the legal/policy pages (Privacy, Terms, Shipping).
 * ──────────────────────────────────────────────────────────────────────────── */

export const CONTACT_EMAIL = 'elegantsipdarjeeling@gmail.com'
export const WHATSAPP = '+91 75839 95294'
export const INSTAGRAM = '@elegantsip_darjeeling'

export const listClass = 'list-disc pl-5 space-y-2'

export function LegalLayout({ label, title, updated, children }: { label: string; title: ReactNode; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 md:px-12">
      <div className="max-w-3xl mx-auto">
        <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-5">{label}</span>
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05] mb-3">{title}</h1>
        <p className="text-[11px] font-mono text-[#4a584a]/60 mb-12">Last updated: {updated}</p>
        <div className="space-y-10">{children}</div>
      </div>
    </div>
  )
}

export function Section({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold uppercase tracking-wide mb-3 flex flex-wrap items-center gap-2.5">
        {title}
        {badge && (
          <span className="text-[9px] font-mono font-bold tracking-widest uppercase bg-[#e0b35c]/15 text-[#b0782e] px-2.5 py-1 rounded-full">
            {badge}
          </span>
        )}
      </h2>
      <div className="text-sm text-[#4a584a] leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

/** Inline "Once launched" pill used inside prose and callouts. */
export function OnceLaunched() {
  return (
    <span className="text-[9px] font-mono font-bold tracking-widest uppercase bg-[#e0b35c]/15 text-[#b0782e] px-2 py-0.5 rounded-full whitespace-nowrap">
      Once launched
    </span>
  )
}

/** The bordered "Current status" callout at the top of a policy. */
export function StatusCallout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#8bb56e]/5 border border-[#8bb56e]/25 rounded-2xl p-5 text-sm text-[#4a584a] leading-relaxed">
      <span className="block text-[10px] font-mono font-bold tracking-widest uppercase text-[#8bb56e] mb-2">Current status</span>
      {children}
    </div>
  )
}

/** Small italic footnote at the end of a policy. */
export function TemplateNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-[#4a584a]/70 italic leading-relaxed border-t border-[#1b261b]/10 pt-6">
      {children}
    </p>
  )
}

export function DataTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-[#1b261b]/10 rounded-lg">
        <thead>
          <tr className="bg-[#1b261b]/[0.03] text-left">
            <th className="px-4 py-2.5 font-bold text-[#1b261b] text-[10px] font-mono uppercase tracking-widest">Data</th>
            <th className="px-4 py-2.5 font-bold text-[#1b261b] text-[10px] font-mono uppercase tracking-widest">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([data, purpose]) => (
            <tr key={data} className="border-t border-[#1b261b]/10 align-top">
              <td className="px-4 py-2.5 text-[#1b261b] font-medium">{data}</td>
              <td className="px-4 py-2.5 text-[#4a584a]">{purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ContactList() {
  return (
    <ul className={listClass}>
      <li>
        <strong className="text-[#1b261b]">Email:</strong>{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#8bb56e] font-semibold hover:underline">{CONTACT_EMAIL}</a>
      </li>
      <li>
        <strong className="text-[#1b261b]">WhatsApp:</strong>{' '}
        <a href="https://wa.me/917583995294" target="_blank" rel="noopener noreferrer" className="text-[#8bb56e] font-semibold hover:underline">{WHATSAPP}</a>
      </li>
      <li>
        <strong className="text-[#1b261b]">Instagram:</strong>{' '}
        <a href="https://www.instagram.com/elegantsip_darjeeling" target="_blank" rel="noopener noreferrer" className="text-[#8bb56e] font-semibold hover:underline">{INSTAGRAM}</a>
      </li>
    </ul>
  )
}
