import { useDocumentMeta } from '../../lib/router'
import { CONTACT_EMAIL, LegalLayout, Section } from './shared'

export default function ShippingReturnsPage() {
  useDocumentMeta('Shipping & Returns  Elegant Sip', 'Shipping timelines, costs, and the Elegant Sip 30-day taste guarantee.')
  return (
    <LegalLayout label="Support" title={<>Shipping & <span className="text-[#8bb56e]">Returns</span></>} updated="August 19, 2026">
      <Section title="Shipping">
        <p>
          Every order ships within 24 hours of being packed  we pack close to harvest so the leaf
          arrives as fresh as possible. Standard delivery (2–4 business days) is ₹150, and free on
          orders of ₹4,000 or more. Express delivery (1–2 business days) is ₹450.
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
          30 days and we'll replace it or refund you  no return shipping, no questions, no forms.
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
