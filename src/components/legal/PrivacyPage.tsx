import { Link, useDocumentMeta } from '../../lib/router'
import { CONTACT_EMAIL, ContactList, DataTable, LegalLayout, listClass, OnceLaunched, Section, StatusCallout, TemplateNote } from './shared'

const LOCAL_DATA_ROWS: [string, string][] = [
  ['Cart contents', 'Remember items between visits'],
  ['Wishlist', "Save products you're interested in"],
  ['Demo account details (name, email)', 'Simulate a logged-in experience'],
  ['Demo order history', 'Let you view past "orders" placed in the simulation'],
  ['Order notes', 'Optional notes you add to a demo order'],
  ['Product reviews you submit', 'Displayed on product pages on this device/browser'],
  ['Newsletter email (if no email service is configured)', 'Local fallback record of signup'],
  ['Cookie/analytics consent choice', 'Remember your preference'],
]

const CHECKOUT_DATA_ROWS: [string, string][] = [
  ['Name, email, phone', 'Order confirmation and delivery coordination'],
  ['Shipping address', 'Fulfillment and courier handoff'],
  ['Order contents and amount', 'Order processing, invoicing, GST compliance'],
  ['Payment details', 'Processed directly by our payment gateway (e.g., Razorpay/Stripe) — we do not store full card numbers on our own servers'],
  ['Account credentials (if you create a real account)', 'Login and order history'],
]

export default function PrivacyPage() {
  useDocumentMeta('Privacy Policy — Elegant Sip', 'What data elegantsip.com collects, how it is stored, and how to reach us.')
  return (
    <LegalLayout label="Legal" title="Privacy Policy" updated="August 19, 2026">
      <p className="text-sm text-[#4a584a] leading-relaxed -mt-4">
        <strong className="text-[#1b261b]">Elegant Sip</strong> ("we," "us," "our").
        Elegant Sip (elegantsip.com) is a Darjeeling tea storefront. This policy explains what
        data the site collects, how it's stored, and how to reach us. It's written to match
        exactly what the site does — nothing more.
      </p>

      <StatusCallout>
        As of this version, the site runs without a backend — checkout, accounts, and orders are
        simulated locally in your browser and no real payment is processed on-site.{' '}
        <strong className="text-[#1b261b]">Real checkout, accounts, and payment processing are planned</strong>{' '}
        for a future release. Parts marked <OnceLaunched /> describe what will change once that
        ships; until then, they don't apply. We'll update this policy's "Last updated" date and
        remove the markers when the backend goes live.
      </StatusCallout>

      <Section title="1. The short version">
        <ul className={listClass}>
          <li>
            <strong className="text-[#1b261b]">Today</strong>, this is a{' '}
            <strong className="text-[#1b261b]">demo storefront</strong>. Checkout, accounts,
            orders, and reviews run entirely in your browser's local storage — nothing is
            transmitted to us or to a payment processor when you "check out." No real payment is
            processed through the site.
          </li>
          <li>
            To place an <strong className="text-[#1b261b]">actual order today</strong>, you contact
            us directly via WhatsApp, Instagram, or email — see Section 6.
          </li>
          <li>
            <OnceLaunched /> Once real checkout launches, placing an order will involve sending
            your order, shipping address, and payment details to us and to a payment processor, as
            described in Section 3.
          </li>
          <li>We don't sell your data, and we won't in the future either.</li>
        </ul>
      </Section>

      <Section title="2. Information stored locally on your device">
        <p>
          When you use the site, the following is saved in your browser's local storage (not on
          our servers):
        </p>
        <DataTable rows={LOCAL_DATA_ROWS} />
        <p>
          This data stays in your browser. We cannot see it, access it, or retrieve it. Clearing
          your browser storage or cache deletes it permanently — we have no copy and cannot
          restore it.
        </p>
      </Section>

      <Section title="3. Information sent to us">
        <p>We only receive information you actively send us:</p>
        <ul className={listClass}>
          <li>
            <strong className="text-[#1b261b]">Contact form:</strong> if a contact-form service is
            configured, submissions are sent to that provider and forwarded to us; otherwise the
            form opens a pre-filled email to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#8bb56e] font-semibold hover:underline">{CONTACT_EMAIL}</a>{' '}
            in your own mail client, and you choose whether to send it.
          </li>
          <li>
            <strong className="text-[#1b261b]">Newsletter signup:</strong> if an email service
            provider is configured, your email is sent to that provider to add you to our mailing
            list. If not, your email is only stored locally as described above and is not
            transmitted anywhere.
          </li>
          <li>
            <strong className="text-[#1b261b]">Direct contact:</strong> if you message us via
            WhatsApp (+91 75839 95294), Instagram (@elegantsip_darjeeling), or email, we receive
            whatever you send us through those platforms, governed by their respective privacy
            policies (Meta/WhatsApp, Instagram, your email provider).
          </li>
        </ul>
        <p>
          <strong className="text-[#1b261b]">Today</strong>, we do not collect payment details,
          shipping addresses, or phone numbers through the site itself, because no real
          transaction is processed on the site.
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <OnceLaunched /> Once real checkout launches, placing an order will send the following
          to our server and/or payment processor:
        </p>
        <DataTable rows={CHECKOUT_DATA_ROWS} />
        <p>
          We will update this section with the name of our payment processor, our data retention
          periods, and our server-side security practices before real checkout goes live, and will
          highlight the change to returning users.
        </p>
      </Section>

      <Section title="4. Cookies & analytics">
        <ul className={listClass}>
          <li>The site does not run analytics by default.</li>
          <li>
            If we enable an analytics provider (Plausible or Google Analytics), tracking events
            only begin <strong className="text-[#1b261b]">after you accept</strong> via the consent
            banner. You can decline, and the site will function normally.
          </li>
          <li>We never send your email address or other personal identifiers to analytics tools.</li>
          <li>Declining or clearing consent stops tracking going forward.</li>
        </ul>
      </Section>

      <Section title="5. Third parties">
        <ul className={listClass}>
          <li>
            <strong className="text-[#1b261b]">Today</strong>, no payment processor is involved,
            since no real payment occurs on-site.
          </li>
          <li>
            <strong className="text-[#1b261b]">Contact form provider</strong> (e.g., Formspree) —
            only if one is configured, and only for messages you submit.
          </li>
          <li>
            <strong className="text-[#1b261b]">Newsletter provider</strong> — only if one is
            configured, and only for the email you submit.
          </li>
          <li>
            <strong className="text-[#1b261b]">Analytics provider</strong> (Plausible or GA4) —
            only if enabled, and only after consent.
          </li>
          <li>
            <OnceLaunched /> Once real checkout launches, a payment processor (e.g.,
            Razorpay/Stripe) and a shipping/courier partner will also receive the order and
            delivery details necessary to fulfill your purchase. We'll name them here once selected.
          </li>
          <li>
            We do not share, sell, or rent data to advertisers or data brokers — now or after the
            backend launches.
          </li>
        </ul>
      </Section>

      <Section title="6. How to actually buy tea / reach us">
        <p>
          Since the site does not process real payments, to place a genuine order or ask about a
          product, contact us directly:
        </p>
        <ContactList />
        <p>
          Any personal information you share through these channels (name, address, phone number,
          payment details) is handled by us directly and by the respective platform
          (WhatsApp/Meta, your email provider), not by this website.
        </p>
      </Section>

      <Section title="7. Your choices & rights">
        <ul className={listClass}>
          <li>
            <strong className="text-[#1b261b]">Delete local data:</strong> clear your browser's
            site data for elegantsip.com.
          </li>
          <li>
            <strong className="text-[#1b261b]">Opt out of analytics:</strong> decline or withdraw
            consent via the consent banner.
          </li>
          <li>
            <strong className="text-[#1b261b]">Opt out of the newsletter:</strong> contact us to be
            removed, or simply stop providing your email; if stored locally only, clearing browser
            data removes it.
          </li>
          <li>
            Since most data never reaches us, most deletion and access requests are things you can
            already do yourself in your browser.
          </li>
        </ul>
      </Section>

      <Section title="8. Children's privacy">
        <p>
          The site is not directed at children under 18, and we do not knowingly collect personal
          information from children.
        </p>
      </Section>

      <Section title="9. Data security">
        <p>
          Because checkout and accounts are simulated locally, there is no server-side database of
          customer orders or payment information to breach. Data you send us directly (email,
          WhatsApp, contact form) is protected only to the extent those platforms secure it.
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          We may update this policy as the site evolves — for example, if we add a real backend,
          payment processing, or additional third-party services. The "Last updated" date at the
          top will reflect the latest revision. Material changes (e.g., adding real payment
          processing) will be reflected here before they take effect.
        </p>
      </Section>

      <Section title="11. Contact us">
        <p>Questions about this policy or your data:</p>
        <ContactList />
        <p>
          You can also use the{' '}
          <Link to="/contact" className="text-[#8bb56e] font-semibold hover:underline">contact page</Link>.
        </p>
      </Section>

      <TemplateNote>
        This policy describes the site's actual technical behavior as of the last update. It is
        provided as a template and should be reviewed by legal counsel before being relied upon
        for real commercial operations, especially once real payment processing or backend
        infrastructure is added.
      </TemplateNote>
    </LegalLayout>
  )
}
