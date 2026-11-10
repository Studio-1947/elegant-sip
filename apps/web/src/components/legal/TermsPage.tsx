import { useDocumentMeta } from '../../lib/router'
import { ContactList, LegalLayout, listClass, Section } from './shared'

export default function TermsPage() {
  useDocumentMeta(
    'Terms & Conditions | Elegant Sip',
    'The terms that govern use of the Elegant Sip site and any order placed through it.',
  )
  return (
    <LegalLayout label="Legal" title="Terms & Conditions" updated="November 10, 2026">
      <p className="text-sm text-[#4a584a] leading-relaxed -mt-4">
        <strong className="text-[#1b261b]">Elegant Sip</strong> ("we," "us," "our"). Please read
        these terms before using elegantsip.in (the "Site"). By browsing or using the Site, you
        agree to them.
      </p>

      <Section title="1. Who we are">
        <p>Elegant Sip sells single-origin Darjeeling tea. We're reachable at:</p>
        <ContactList />
      </Section>

      <Section title="2. Orders and payment">
        <p>These terms apply to every order placed on the Site:</p>
        <ul className={listClass}>
          <li>
            <strong className="text-[#1b261b]">Order acceptance:</strong> your order is an offer to
            buy. A contract is formed when your payment is confirmed and we email your order
            confirmation. If we can't fulfil an order (for example, a tea sells out), we cancel it
            and refund you in full.
          </li>
          <li>
            <strong className="text-[#1b261b]">Pricing & currency:</strong> all prices are in INR
            and include GST (currently 5%), shown as a line in the order summary. Shipping
            is calculated per our published rates (e.g., free above a threshold, flat rates below
            it) and shown before you pay.
          </li>
          <li>
            <strong className="text-[#1b261b]">Payment:</strong> payments are processed by Razorpay.
            We never see or store your card, UPI or bank details. An order that isn't paid within 30
            minutes is released and its stock returned.
          </li>
          <li>
            <strong className="text-[#1b261b]">Order accuracy:</strong> you're responsible for
            providing accurate shipping and contact details. We're not liable for delivery issues
            caused by incorrect information you provided.
          </li>
          <li>
            <strong className="text-[#1b261b]">Cancellations & changes:</strong> you can change or
            cancel an order free of charge any time before it is handed to the courier. Request it
            from the order page in My Account, or contact us.
          </li>
          <li>
            <strong className="text-[#1b261b]">Coupons:</strong> promotional codes (e.g.,
            limited-time or first-order discounts) are subject to eligibility rules stated at the
            time and may be withdrawn or changed at our discretion; codes have no cash value and
            cannot be combined unless stated.
          </li>
        </ul>
      </Section>

      <Section title="3. Shipping & delivery">
        <ul className={listClass}>
          <li>
            We currently ship <strong className="text-[#1b261b]">within India</strong>. Standard
            delivery is ₹30 (free on orders of ₹1,000 or more) and express is ₹450; both are
            estimates, not guarantees.
          </li>
          <li>
            International shipping is <strong className="text-[#1b261b]">not yet offered at
            checkout</strong>. We are still confirming which destinations we can serve reliably. If
            you are outside India, contact us and we will quote shipping directly.
          </li>
          <li>
            Where we do ship internationally by arrangement, any{' '}
            <strong className="text-[#1b261b]">customs duties, import taxes or brokerage fees are
            set by the destination country and are payable by you</strong> on arrival. They are not
            calculated or collected at our checkout.
          </li>
          <li>Risk of loss passes to you on delivery to the shipping address you provided.</li>
          <li>
            Delays caused by courier partners, weather, or circumstances outside our control are
            not our liability, though we'll help you track and resolve issues.
          </li>
        </ul>
      </Section>

      <Section title="4. Returns, refunds & cancellations">
        <p>
          <strong className="text-[#1b261b]">The Elegant Sip Promise.</strong> If a tea does not
          live up to your expectations, tell us within{' '}
          <strong className="text-[#1b261b]">30 days of delivery</strong> and we will replace it or
          refund it. You do not need to return the tea, provide a reason, or complete a form. This
          is a binding commitment, not marketing copy — it is stated here precisely because it is
          promised elsewhere on this site.
        </p>
        <ul className={listClass}>
          <li>
            To claim, email us from the address on the order and tell us which tea and why. We may
            ask for a photo where a pack arrived damaged, but never as a condition of the promise.
          </li>
          <li>
            Refunds are issued to the original payment method. We aim to process them within 7
            business days of approving the claim.
          </li>
          <li>
            Orders can be changed or cancelled free of charge any time before they are handed to
            the carrier.
          </li>
          <li>
            This promise is offered per customer in good faith. We reserve the right to decline
            repeated claims that indicate abuse rather than genuine dissatisfaction, and nothing
            here limits your statutory rights under Indian consumer law.
          </li>
        </ul>
      </Section>

      <Section title="5. Product information">
        <ul className={listClass}>
          <li>
            We describe products (origin, flush, grade, weight) as accurately as we can. Small
            variations in appearance, aroma, and flavor between batches are natural for
            single-origin tea and are not defects.
          </li>
          <li>
            Products marked "coming soon" are not currently available for purchase, at any price,
            through any channel on the Site.
          </li>
          <li>Images are for illustration; actual packaging may vary.</li>
        </ul>
      </Section>

      <Section title="6. Accounts">
        <p>
          You need an account to place an order. Keep your password and sign-in codes to yourself;
          you're responsible for activity under your account. Tell us straight away if you think
          someone else has used it.
        </p>
      </Section>

      <Section title="7. Reviews & user content">
        <ul className={listClass}>
          <li>
            Reviews you post are shown publicly on product pages with your name. Don't submit
            anything false, defamatory, abusive, or that infringes someone else's rights. We may
            check reviews before they appear and remove any that break these rules or the law.
          </li>
          <li>
            The "Verified" badge (where shown) reflects whether our own order records show a
            matching purchase; do not attempt to misrepresent this.
          </li>
        </ul>
      </Section>

      <Section title="8. Intellectual property">
        <p>
          All Site content — text, images, logos, design, and the Elegant Sip name and branding
          belongs to us or our licensors. You may not copy, reproduce, or use it commercially
          without our written permission.
        </p>
      </Section>

      <Section title="9. Acceptable use">
        <p>You agree not to:</p>
        <ul className={listClass}>
          <li>Use the Site for any unlawful purpose.</li>
          <li>Attempt to interfere with, hack, or disrupt the Site or its systems.</li>
          <li>Scrape or harvest data from the Site at scale without permission.</li>
          <li>Submit false information through forms, reviews, or orders.</li>
        </ul>
      </Section>

      <Section title="10. Disclaimers & limitation of liability">
        <ul className={listClass}>
          <li>
            The Site is provided "as is." While we try to keep it accurate and available, we don't
            guarantee uninterrupted or error-free operation.
          </li>
          <li>
            To the extent permitted by law, we are not liable for indirect, incidental, or
            consequential damages arising from your use of the Site.
          </li>
          <li>
            Nothing in these terms limits liability that cannot be limited under applicable Indian
            law (e.g., in cases of fraud or gross negligence).
          </li>
        </ul>
      </Section>

      <Section title="11. Governing law">
        <p>
          These terms are governed by the laws of India. Disputes will be subject to the
          jurisdiction of the courts having authority over our place of business, unless otherwise
          required by applicable consumer-protection law.
        </p>
      </Section>

      <Section title="12. Changes to these terms">
        <p>
          We may update these terms as the Site evolves and will change the "Last updated" date
          above when we do. An order is governed by the terms in force when it was placed.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>Questions about these terms:</p>
        <ContactList />
      </Section>


    </LegalLayout>
  )
}
