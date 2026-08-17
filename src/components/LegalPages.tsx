import { type ReactNode } from 'react'
import { Link, useDocumentMeta } from '../lib/router'

/* Shared layout for policy pages */
function LegalLayout({ label, title, updated, children }: { label: string; title: ReactNode; updated: string; children: ReactNode }) {
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold uppercase tracking-wide mb-3">{title}</h2>
      <div className="text-sm text-[#4a584a] leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

const CONTACT_EMAIL = 'hello@elegantsip.com'

export function PrivacyPage() {
  useDocumentMeta('Privacy Policy — Elegant Sip', 'How Elegant Sip collects, uses, and protects your information.')
  return (
    <LegalLayout label="Legal" title="Privacy Policy" updated="August 17, 2026">
      <Section title="What we collect">
        <p>
          We collect only what you give us: your email address if you join the Tea Circle
          newsletter, the contact details you enter when you place an order (name, email, shipping
          address), and the content of messages you send us.
        </p>
        <p>
          Your cart, wishlist, saved orders, and product reviews are stored locally in your own
          browser (localStorage) so the site remembers you between visits. This data stays on your
          device and is not transmitted to us.
        </p>
      </Section>
      <Section title="How we use it">
        <p>
          Order details are used to fulfil and support your order. Your newsletter email is used
          only to send you the Tea Circle updates you signed up for — you can unsubscribe at any
          time, and we never sell or rent your information to anyone.
        </p>
      </Section>
      <Section title="Analytics & cookies">
        <p>
          If analytics is enabled on this site, we measure anonymous, aggregate usage (pages
          visited, actions taken) to improve the store — and only after you accept the analytics
          notice. We do not attach your email address or other personal details to analytics
          events. You can decline analytics with no effect on how the site works.
        </p>
      </Section>
      <Section title="Your rights">
        <p>
          You can ask us to show, correct, or delete any personal information we hold about you by
          emailing{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#8bb56e] font-semibold hover:underline">{CONTACT_EMAIL}</a>.
          To clear locally stored data (cart, wishlist, saved orders, reviews), clear this site's
          data in your browser settings.
        </p>
      </Section>
      <Section title="Contact">
        <p>
          Questions about this policy? Write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#8bb56e] font-semibold hover:underline">{CONTACT_EMAIL}</a>
          {' '}or use the <Link to="/contact" className="text-[#8bb56e] font-semibold hover:underline">contact page</Link>.
        </p>
      </Section>
    </LegalLayout>
  )
}

export function TermsPage() {
  useDocumentMeta('Terms of Service — Elegant Sip', 'The terms that govern your use of the Elegant Sip store.')
  return (
    <LegalLayout label="Legal" title="Terms of Service" updated="August 17, 2026">
      <Section title="The agreement">
        <p>
          By using this site or placing an order you agree to these terms. If you don't agree,
          please don't use the site — though we'd rather make it right, so tell us what's wrong at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#8bb56e] font-semibold hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
      <Section title="Orders & pricing">
        <p>
          All prices are in US dollars. We do our best to keep the catalog, stock levels, and
          pricing accurate; if we make an error on a listed price, we'll contact you before
          fulfilling the order and you may cancel for a full refund. Promotional codes apply only
          at the time of purchase and cannot be applied retroactively.
        </p>
        <p>
          Our teas are seasonal, single-origin lots. When a lot sells out, it may not return until
          the next harvest — this scarcity is real, not a marketing device.
        </p>
      </Section>
      <Section title="The Elegant Sip Promise">
        <p>
          If any tea doesn't live up to your expectations, tell us within 30 days of delivery and
          we'll replace it or refund you — no return shipping, no questions, no forms. Details are
          in our <Link to="/shipping" className="text-[#8bb56e] font-semibold hover:underline">Shipping & Returns policy</Link>.
        </p>
      </Section>
      <Section title="Content & reviews">
        <p>
          By submitting a review you grant us permission to display it on the relevant product
          page. Reviews must reflect your genuine experience; we remove content that is abusive,
          off-topic, or fraudulent.
        </p>
      </Section>
      <Section title="Liability">
        <p>
          To the maximum extent permitted by law, our liability for any claim arising from an
          order is limited to the amount you paid for that order. Nothing in these terms limits
          rights you have under applicable consumer law.
        </p>
      </Section>
    </LegalLayout>
  )
}

export function ShippingReturnsPage() {
  useDocumentMeta('Shipping & Returns — Elegant Sip', 'Shipping timelines, costs, and the Elegant Sip 30-day taste guarantee.')
  return (
    <LegalLayout label="Support" title={<>Shipping & <span className="text-[#8bb56e]">Returns</span></>} updated="August 17, 2026">
      <Section title="Shipping">
        <p>
          Every order ships within 24 hours of being packed — we pack close to harvest so the leaf
          arrives as fresh as possible. Standard delivery (2–4 business days) is $5, and free on
          orders of $50 or more. Express delivery (1–2 business days) is $15.
        </p>
        <p>
          We ship worldwide. International delivery typically takes 5–10 business days; any duties
          are shown at checkout so there are no surprises on arrival.
        </p>
      </Section>
      <Section title="Changing or cancelling an order">
        <p>
          If your order hasn't shipped yet (usually within the first few hours), email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#8bb56e] font-semibold hover:underline">{CONTACT_EMAIL}</a>
          {' '}and we'll update or cancel it. Once it's with the carrier, we'll help you redirect it instead.
        </p>
      </Section>
      <Section title="The 30-day taste guarantee">
        <p>
          The Elegant Sip Promise: if any tea doesn't live up to your expectations, tell us within
          30 days and we'll replace it or refund you — no return shipping, no questions, no forms.
          We'd rather you find your perfect cup than force a box.
        </p>
      </Section>
      <Section title="Damaged or lost parcels">
        <p>
          If your order arrives damaged or goes missing in transit, contact us and we'll reship or
          refund it immediately. Photos help but aren't required.
        </p>
      </Section>
    </LegalLayout>
  )
}
