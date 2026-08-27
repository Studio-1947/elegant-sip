import { useState } from 'react'
import { useDocumentMeta } from '../lib/router'
import { track } from '../lib/analytics'
import { api, ApiClientError } from '../lib/api'

const CONTACT_EMAIL = 'elegantsipdarjeeling@gmail.com'

export default function ContactPage() {
  useDocumentMeta(
    'Contact Us | Elegant Sip',
    'Questions about an order, a grade, or wholesale? Reach the Elegant Sip team by email or WhatsApp.',
  )

  const [sent, setSent] = useState<'endpoint' | 'undelivered' | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', subject: 'Order question', message: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const { delivered } = await api.contact.send(form)
      /* The API tells us whether the message actually went out. If it did not,
         we say so and offer the direct address rather than claiming it was
         sent. */
      setSent(delivered ? 'endpoint' : 'undelivered')
      track('contact_submitted', { subject: form.subject, method: delivered ? 'api' : 'not_delivered' })
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : `Something went wrong sending your message. Please email us directly at ${CONTACT_EMAIL}.`,
      )
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6">
        <div className="max-w-lg mx-auto text-center bg-white border border-[#1b261b]/10 rounded-3xl p-10 md:p-14 shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#8bb56e]/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#4a7333]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-4">
            {sent === 'endpoint' ? 'Message sent' : 'Not sent yet'}
          </h1>
          <p className="text-sm text-[#4a584a] leading-relaxed mb-8">
            {sent === 'endpoint' ? (
              <>Thank you, {form.name.split(' ')[0] || 'friend'}. We reply to every message within one business day.</>
            ) : (
              <>
                We took your message but could not deliver it just now — our mail service is not
                reachable. Nothing is lost on your side: please email us directly at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-[#4a7333] underline underline-offset-2">
                  {CONTACT_EMAIL}
                </a>{' '}
                and we will reply within one business day.
              </>
            )}
          </p>
          <button
            onClick={() => setSent(null)}
            className="w-full border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#f9faf7] text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-all cursor-pointer"
          >
            Send Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        <div>
          <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Contact</span>
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-6">Write to Us</h1>
          <p className="text-sm text-[#4a584a] leading-relaxed mb-10">
            Questions about an order, a sourcing curiosity, a wholesale inquiry, or a tea recommendation
            for a special occasion — we read everything.
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <svg className="w-4 h-4 text-[#4a7333] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-[#4a584a] mb-1">Email</p>
                <a href="mailto:elegantsipdarjeeling@gmail.com" className="text-sm font-bold hover:text-[#4a7333] transition-colors">elegantsipdarjeeling@gmail.com</a>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <svg className="w-4 h-4 text-[#4a7333] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-[#4a584a] mb-1">Response time</p>
                <p className="text-sm">Within one business day</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <svg className="w-4 h-4 text-[#4a7333] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-[#4a584a] mb-1">Wholesale & gifting</p>
                <p className="text-sm">Corporate gifting and wholesale inquiries welcome — mention it in your message.</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-10 shadow-[0_12px_40px_rgba(27,38,27,0.04)] space-y-4">
          <div>
            <label htmlFor="ct-name" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Name</label>
            <input
              id="ct-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#8bb56e] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="ct-email" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Email</label>
            <input
              id="ct-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#8bb56e] transition-colors"
            />
          </div>
          <div>
            <label htmlFor="ct-subject" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Subject</label>
            <select
              id="ct-subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#8bb56e] transition-colors cursor-pointer"
            >
              <option>Order question</option>
              <option>Returns & refunds</option>
              <option>Brewing advice</option>
              <option>Sourcing question</option>
              <option>Wholesale</option>
              <option>Something else</option>
            </select>
          </div>
          <div>
            <label htmlFor="ct-message" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Message</label>
            <textarea
              id="ct-message"
              required
              rows={5}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="w-full bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#8bb56e] transition-colors resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] disabled:opacity-60 disabled:cursor-wait text-white text-xs font-bold tracking-widest uppercase py-4 rounded-lg transition-colors active:scale-[0.98] cursor-pointer"
          >
            {sending ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  )
}
