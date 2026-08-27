import { useDocumentMeta } from '../../lib/router'
import { CONTACT_EMAIL, LegalLayout, Section } from './shared'

export default function ShippingReturnsPage() {
  useDocumentMeta(
    'Shipping & Returns | Elegant Sip',
    'Shipping timelines and costs, and the 30-day Elegant Sip Promise on every pack.',
  )
  return (
    <LegalLayout label="Support" title={<>Shipping & <span className="text-[#4a7333]">Returns</span></>} updated="August 19, 2026">
      <Section title="Shipping within India">
        <p>
          Standard delivery (2–4 business days) is ₹150, and free on orders of ₹4,000 or more.
          Express delivery (1–2 business days) is ₹450. We pack to order rather than from a
          warehouse shelf, so allow a day or two for packing before the courier collects.
        </p>
      </Section>
      <Section title="Shipping outside India">
        <p>
          We are still confirming which countries we can serve reliably, so international shipping
          is not yet available at checkout. Message us on{' '}
          <a href="https://wa.me/917583995294" className="text-[#5f8f42] font-semibold hover:underline">WhatsApp</a>
          {' '}with your address and we will quote the real cost before you commit to anything.
        </p>
        <p>
          Customs duties and import taxes are set by your country, not by us. They are payable by
          you on arrival and are <strong>not</strong> calculated or collected at our checkout — we
          would rather tell you that up front than surprise you at your door.
        </p>
      </Section>
      <Section title="Changing or cancelling an order">
        <p>
          If your order hasn't shipped yet (usually within the first few hours), email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#4a7333] font-semibold hover:underline">{CONTACT_EMAIL}</a>
          {' '}and we'll update or cancel it. Once it's with the carrier, we'll help you redirect it instead.
        </p>
      </Section>
      <Section title="The 30-day taste guarantee">
        <p>
          The Elegant Sip Promise: if any tea doesn't live up to your expectations, tell us within
          30 days and we'll replace it or refund you — no return shipping, no questions, no forms.
          We'd rather you find your perfect cup than force a box.
        </p>
        <p>
          This is written into our <a href="/terms" className="text-[#5f8f42] font-semibold hover:underline">Terms &amp; Conditions</a>{' '}
          as a binding commitment, so you are not relying on a marketing line.
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
