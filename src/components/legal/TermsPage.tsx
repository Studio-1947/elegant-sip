import { useDocumentMeta } from '../../lib/router'
import { CONTACT_EMAIL, ContactList, INSTAGRAM, LegalLayout, listClass, OnceLaunched, Section, StatusCallout, WHATSAPP } from './shared'

export default function TermsPage() {
  useDocumentMeta('Terms & Conditions  Elegant Sip', 'The terms that govern your use of elegantsip.com.')
  return (
    <LegalLayout label="Legal" title="Terms & Conditions" updated="August 19, 2026">
      <p className="text-sm text-[#4a584a] leading-relaxed -mt-4">
        <strong className="text-[#1b261b]">Elegant Sip</strong> ("we," "us," "our"). Please read
        these terms before using elegantsip.com (the "Site"). By browsing or using the Site, you
        agree to them.
      </p>

      <StatusCallout>
        The Site currently operates <strong className="text-[#1b261b]">without a real backend</strong>
        checkout, accounts, and orders are simulated in your browser and no real payment is taken
        on-site. <strong className="text-[#1b261b]">Real checkout and payment processing are planned</strong> for
        a future release. Sections marked <OnceLaunched /> will take effect once that launches;
        until then, they describe intended future behavior, not the current Site.
      </StatusCallout>

      <Section title="1. Who we are">
        <p>Elegant Sip sells single-origin Darjeeling tea. We're reachable at:</p>
        <ContactList />
      </Section>

      <Section title="2. The demo checkout (today)">
        <ul className={listClass}>
          <li>
            Adding items to cart, applying coupons, "placing an order," creating an "account," and
            submitting reviews are all <strong className="text-[#1b261b]">simulated</strong> on this
            Site  handled entirely in your browser's local storage.
          </li>
          <li>
            <strong className="text-[#1b261b]">No real payment is processed</strong> when you
            complete the demo checkout. No money changes hands, and no order is fulfilled as a
            result of using the on-site checkout flow.
          </li>
          <li>
            The Site clearly labels this ("Demo checkout  no real payment is processed"). If you
            see anything on the Site that appears to contradict this, it's a bug  please tell us.
          </li>
          <li>
            Demo order numbers, order history, and account data exist only in your browser and can
            disappear if you clear your browser storage. We cannot recover this data, and it has no
            legal or commercial effect.
          </li>
        </ul>
      </Section>

      <Section title="3. How to place a real order (today)">
        <p>Until real checkout launches, to actually purchase tea:</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Contact us via WhatsApp ({WHATSAPP}), Instagram ({INSTAGRAM}), or email ({CONTACT_EMAIL}).
          </li>
          <li>
            We'll confirm product availability, pricing, and payment method with you directly,
            outside the Site.
          </li>
          <li>
            Any order, payment, and delivery arrangement made this way is a separate agreement
            between you and us, governed by these terms to the extent applicable, and by whatever
            we confirm with you directly (e.g., over WhatsApp).
          </li>
        </ol>
        <p>
          Prices shown on the Site are in Indian Rupees (INR) and are indicative; please confirm
          current pricing and stock with us before paying anything, anywhere off-site.
        </p>
      </Section>

      <Section title="4. Real checkout & orders" badge="Once launched">
        <p>Once real checkout is live on the Site, the following will apply to orders placed through it:</p>
        <ul className={listClass}>
          <li>
            <strong className="text-[#1b261b]">Order acceptance:</strong> your order is an offer to
            buy; a contract is formed only when we confirm and accept it (e.g., via order confirmation).
          </li>
          <li>
            <strong className="text-[#1b261b]">Pricing & currency:</strong> all prices are in INR
            and include or exclude GST as displayed at checkout (currently modeled at 5%). Shipping
            is calculated per our published rates (e.g., free above a threshold, flat rates below
            it) and shown before you pay.
          </li>
          <li>
            <strong className="text-[#1b261b]">Payment:</strong> payments will be processed through
            a third-party payment gateway. We do not store your full card details on our own servers.
          </li>
          <li>
            <strong className="text-[#1b261b]">Order accuracy:</strong> you're responsible for
            providing accurate shipping and contact details. We're not liable for delivery issues
            caused by incorrect information you provided.
          </li>
          <li>
            <strong className="text-[#1b261b]">Cancellations & modifications:</strong> once an
            order is confirmed, cancellation or modification will be possible only within a window
            we specify at checkout or on request, subject to fulfillment status.
          </li>
          <li>
            <strong className="text-[#1b261b]">Coupons:</strong> promotional codes (e.g.,
            limited-time or first-order discounts) are subject to eligibility rules stated at the
            time and may be withdrawn or changed at our discretion; codes have no cash value and
            cannot be combined unless stated.
          </li>
        </ul>
        <p>
          We will replace this section with finalized, binding terms  including payment processor
          details, order-confirmation process, and cutoff times  before real checkout goes live.
        </p>
      </Section>

      <Section title="5. Shipping & delivery" badge="Once launched">
        <ul className={listClass}>
          <li>
            We ship within India. Delivery estimates will be shown at checkout and are estimates,
            not guarantees.
          </li>
          <li>Risk of loss passes to you on delivery to the shipping address you provided.</li>
          <li>
            Delays caused by courier partners, weather, or circumstances outside our control are
            not our liability, though we'll help you track and resolve issues.
          </li>
        </ul>
      </Section>

      <Section title="6. Returns, refunds & cancellations" badge="Once launched">
        <ul className={listClass}>
          <li>
            Because tea is a consumable, perishable food product, returns will generally be limited
            to cases of <strong className="text-[#1b261b]">damaged, defective, or incorrect items</strong> received.
          </li>
          <li>
            To request a refund or replacement, contact us within a stated window (to be specified
            at launch) of delivery, with photos where relevant.
          </li>
          <li>
            Refunds, once approved, will be issued to the original payment method within a stated
            processing time.
          </li>
          <li>
            Full return, refund, and cancellation policy details will be published here and linked
            at checkout before real payments are accepted.
          </li>
        </ul>
      </Section>

      <Section title="7. Product information">
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

      <Section title="8. Accounts">
        <p>
          <strong className="text-[#1b261b]">Today</strong>, "accounts" on the Site are a local,
          simulated experience for demonstration purposes only and don't represent a real
          registered account with us.
        </p>
        <p>
          Once real accounts launch, you'll be responsible for keeping your login credentials
          confidential and for activity under your account. Notify us immediately of any
          unauthorized use.
        </p>
      </Section>

      <Section title="9. Reviews & user content">
        <ul className={listClass}>
          <li>
            Product reviews are stored locally in your browser and shown on your device; they are
            not currently moderated or shared with other users through a backend.
          </li>
          <li>
            Once reviews are backed by a real server, they'll be visible to other visitors. Don't
            submit anything false, defamatory, abusive, or that infringes someone else's rights. We
            may remove reviews that violate this or applicable law.
          </li>
          <li>
            The "Verified" badge (where shown) reflects whether our own order records show a
            matching purchase; do not attempt to misrepresent this.
          </li>
        </ul>
      </Section>

      <Section title="10. Intellectual property">
        <p>
          All Site content  text, images, logos, design, and the Elegant Sip name and branding
          belongs to us or our licensors. You may not copy, reproduce, or use it commercially
          without our written permission.
        </p>
      </Section>

      <Section title="11. Acceptable use">
        <p>You agree not to:</p>
        <ul className={listClass}>
          <li>Use the Site for any unlawful purpose.</li>
          <li>Attempt to interfere with, hack, or disrupt the Site or its (future) backend.</li>
          <li>Scrape or harvest data from the Site at scale without permission.</li>
          <li>Submit false information through forms, reviews, or (once live) real orders.</li>
        </ul>
      </Section>

      <Section title="12. Disclaimers & limitation of liability">
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

      <Section title="13. Governing law">
        <p>
          These terms are governed by the laws of India. Disputes will be subject to the
          jurisdiction of the courts having authority over our place of business, unless otherwise
          required by applicable consumer-protection law.
        </p>
      </Section>

      <Section title="14. Changes to these terms">
        <p>
          We may update these terms as the Site evolves  most notably when real checkout,
          payments, and accounts launch. We'll update the "Last updated" date above, and remove the
          "Once launched" markers once the corresponding features are live. Continued use of the
          Site after changes means you accept the updated terms.
        </p>
      </Section>

      <Section title="15. Contact">
        <p>Questions about these terms:</p>
        <ContactList />
      </Section>


    </LegalLayout>
  )
}
