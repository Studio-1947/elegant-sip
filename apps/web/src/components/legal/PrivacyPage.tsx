import { Link, useDocumentMeta } from '../../lib/router'
import { openConsentSettings, trackingConfigured } from '../../lib/analytics'
import { CONTACT_EMAIL, ContactList, DataTable, GRIEVANCE_OFFICER, LegalLayout, listClass, Section } from './shared'

/* Written to match what the site and its server actually do. When a feature
   or provider changes, change this page in the same release. */

const ACCOUNT_AND_ORDER_ROWS: [string, string][] = [
  ['Name, email address, password (stored only as a one-way hash)', 'Create and secure your account; send order and account emails'],
  ['WhatsApp number (only if you sign in with WhatsApp)', 'Send sign-in codes; codes are stored only as a one-way hash and expire after 10 minutes'],
  ['Delivery and billing addresses, phone number, saved addresses', 'Deliver your order, contact you about delivery, print the invoice'],
  ['Order contents, amounts, coupon used, invoice', 'Process the order, issue the GST invoice, keep the records tax law requires'],
  ['Payment reference and status from Razorpay', 'Confirm payment and handle refunds. We never see or store your card, UPI or bank details'],
  ['Courier tracking number and delivery updates', 'Show where your parcel is'],
  ['Cancellation and return requests', 'Review and resolve them'],
  ['Product reviews you post', 'Show them on product pages, with your name'],
  ['Messages from the contact form', 'Answer you'],
  ['Your cart: the teas, pack sizes and quantities in it, when it last changed, whether you opened checkout, and your account if you are signed in', 'See which carts are left unfinished so we can improve the shop. Linked to your order if you place one; otherwise deleted after 90 days'],
  ['Newsletter email address', 'Send the newsletter you asked for'],
]

const BROWSER_ROWS: [string, string][] = [
  ['Sign-in cookie', 'Keep you signed in for up to 30 days, or until you sign out'],
  ['Cart, wishlist, coupon and order notes', 'Remember them between visits on this device'],
  ['Cookie choice', 'Remember whether you switched Google and Meta cookies off'],
  ['Google and Meta cookies (unless you switch them off)', 'Measure visits and ad performance, as described in section 4'],
]

const PROVIDER_ROWS: [string, string][] = [
  ['Razorpay', 'Takes your payment. Receives the amount, your email and the payment details you enter on its checkout'],
  ['Courier partners, booked directly or through Shiprocket', 'Deliver your order. Receive your name, delivery address, phone number and parcel details'],
  ['Our email delivery provider', 'Sends order, delivery and account emails. Receives your email address and the message'],
  ['Interakt and WhatsApp (Meta), only if you sign in with WhatsApp', 'Send your sign-in code. Receive your WhatsApp number and the code'],
  ['Hostinger', 'Hosts our server and database'],
  ['Google (Tag Manager) and Meta (Pixel and Conversions API), unless you switch their cookies off', 'Measure visits and ad performance. Receive the events in section 4, never your name, email, phone or address'],
]

export default function PrivacyPage() {
  useDocumentMeta(
    'Privacy Policy | Elegant Sip',
    'What Elegant Sip collects, why, who receives it, how long it is kept, and your rights.',
  )
  return (
    <LegalLayout label="Legal" title="Privacy Policy" updated="November 27, 2026">
      <p className="text-sm text-[#4a584a] leading-relaxed -mt-4">
        <strong className="text-[#1b261b]">Elegant Sip</strong> ("we," "us," "our") sells
        single-origin Darjeeling tea at elegantsip.in. This policy explains what personal data we
        collect, why, who receives it, how long we keep it, and how to exercise your rights under
        India's Digital Personal Data Protection Act, 2023.
      </p>

      <Section title="1. The short version">
        <ul className={listClass}>
          <li>We collect what we need to run your account, take payment and deliver your tea.</li>
          <li>Payments are handled by Razorpay. We never see or store your card, UPI or bank details.</li>
          <li>We use Google and Meta to measure visits and ads. You can switch this off at any time under Cookie preferences.</li>
          <li>We don't sell or rent your personal data, to anyone.</li>
          <li>You can ask us to see, correct or delete your data at any time (section 7).</li>
        </ul>
      </Section>

      <Section title="2. What we collect and why">
        <p>When you add teas to your cart, create an account, order, or contact us, we store the following on our server:</p>
        <DataTable rows={ACCOUNT_AND_ORDER_ROWS} />
        <p>Your browser also keeps a few things on your device:</p>
        <DataTable rows={BROWSER_ROWS} />
        <p>
          Like any website, our server briefly logs technical details of each request (IP address,
          browser type, the page asked for) to keep the site secure and working.
        </p>
      </Section>

      <Section title="3. Why we're allowed to use it">
        <ul className={listClass}>
          <li>
            <strong className="text-[#1b261b]">To provide what you asked for:</strong> your account,
            orders, deliveries, refunds and replies to your messages. You give us this data for that
            purpose.
          </li>
          <li>
            <strong className="text-[#1b261b]">To meet legal duties:</strong> GST invoices and order
            records that Indian tax law requires us to keep.
          </li>
          <li>
            <strong className="text-[#1b261b]">Analytics and ad measurement</strong> (section 4) run
            by default, and you can switch them off at any time under Cookie preferences.
          </li>
          <li>
            <strong className="text-[#1b261b]">With your consent:</strong> the newsletter. You can
            unsubscribe at any time.
          </li>
        </ul>
      </Section>

      <Section title="4. Cookies, analytics and ad measurement">
        <ul className={listClass}>
          <li>
            We use <strong className="text-[#1b261b]">Google Tag Manager</strong> and the{' '}
            <strong className="text-[#1b261b]">Meta Pixel</strong> to measure visits and to see which
            of our ads lead to purchases. Both load when you visit. You can switch them off at any
            time under <strong className="text-[#1b261b]">Cookie preferences</strong> (in the footer
            or below); from then on nothing is sent to Google or Meta, and the site works the same.
          </li>
          <li>
            We also use <strong className="text-[#1b261b]">Umami</strong>, a privacy-friendly website
            analytics service, to count visits: which pages are viewed, where visitors come from, and
            shop steps such as viewing a tea, adding it to the cart and checking out (product, price
            and quantity). Umami sets no cookies, does not recognise you across other websites and
            shares nothing with advertisers, so it runs for every visitor whatever your cookie setting.
            It never receives your name, email, phone number, address or order number. Like any
            website request, it sees your IP address and browser type, which it uses only to count
            unique visits and does not store.
          </li>
          <li>
            When you arrive from an ad or another website, we note where you came from: the
            campaign tags in the link (such as utm_source), whether it was a Meta or Google ad (not
            the ad's click ID), or the referring site. This is kept in your browser for 30 days and
            saved with your order if you buy, so we can see which ads and links lead to sales. It
            stays with us and is never sent to Google, Meta or anyone else.
          </li>
          <li>
            Unless you switch them off, Google and Meta set their own cookies and receive: the pages you view,
            the products you view or add to your cart (product, quantity and price), checkout steps,
            and, when you buy, the order value and number of items. Like any website request, they
            also see your IP address and browser type.
          </li>
          <li>
            Meta receives these same events a second time from our server (Meta's{' '}
            <strong className="text-[#1b261b]">Conversions API</strong>), together with your IP
            address, browser type and the ID in Meta's own cookie, so that ad results are still
            counted when a browser blocks Meta's script. Meta matches the two copies and counts
            each event once. This stops when you switch tracking off.
          </li>
          <li>
            Unless you had switched tracking off when you check out, we keep that IP address, browser type and Meta
            cookie ID with your order only until your payment is confirmed, so the purchase is
            counted even if you close the page before it loads. They are deleted once it has been
            reported.
          </li>
          <li>
            We never send your name, email address, phone number or delivery address to Google or
            Meta, and links from our emails (password reset, email confirmation) are cleaned before
            any page view is recorded.
          </li>
          <li>
            You can switch Google and Meta off, or back on, at any time with the{' '}
            <strong className="text-[#1b261b]">Cookie preferences</strong> link in the footer or the
            button below. Switching off stops tracking from that moment and deletes their cookies.
          </li>
        </ul>
        {trackingConfigured() && (
          <button
            type="button"
            onClick={openConsentSettings}
            className="mt-4 rounded-lg border border-[#1b261b]/20 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#1b261b] transition-colors hover:border-[#4a7333] hover:text-[#4a7333] cursor-pointer"
          >
            Cookie preferences
          </button>
        )}
      </Section>

      <Section title="5. Who receives your data">
        <p>
          We share personal data only with the service providers below, only what each needs, and
          only to do that job for us:
        </p>
        <DataTable rows={PROVIDER_ROWS} />
        <p>
          We may also disclose data where Indian law requires it, for example to tax authorities or
          in response to a lawful order. We do not sell or rent personal data to advertisers or data
          brokers.
        </p>
      </Section>

      <Section title="6. How long we keep it">
        <ul className={listClass}>
          <li>
            <strong className="text-[#1b261b]">Orders and invoices:</strong> for as long as Indian
            tax law requires us to keep accounting records (currently up to about six years), then
            deleted.
          </li>
          <li>
            <strong className="text-[#1b261b]">Your account and saved addresses:</strong> until you
            ask us to delete them. Order records we must keep by law stay for the period above.
          </li>
          <li>
            <strong className="text-[#1b261b]">Sign-in codes:</strong> expire after 10 minutes and
            are stored only as a one-way hash.
          </li>
          <li>
            <strong className="text-[#1b261b]">Sign-in sessions:</strong> up to 30 days, or until you
            sign out.
          </li>
          <li>
            <strong className="text-[#1b261b]">Newsletter:</strong> until you ask us to remove you.
          </li>
          <li>
            <strong className="text-[#1b261b]">Database backups:</strong> kept for 14 days, then
            overwritten.
          </li>
        </ul>
      </Section>

      <Section title="7. Your rights">
        <p>You can ask us to:</p>
        <ul className={listClass}>
          <li>tell you what personal data we hold about you and who we have shared it with;</li>
          <li>correct or complete data that is wrong or out of date (most of it you can edit in My Account);</li>
          <li>delete your data, except records the law requires us to keep;</li>
          <li>stop using your data for anything you consented to (cookies, newsletter);</li>
          <li>nominate someone to exercise these rights for you if you die or become unable to.</li>
        </ul>
        <p>
          Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#4a7333] font-semibold hover:underline">{CONTACT_EMAIL}</a>{' '}
          from the address on your account. We may ask you to confirm it's you before acting. If
          you're not satisfied with our answer, you can complain to the Data Protection Board of
          India.
        </p>
      </Section>

      <Section title="8. Grievance officer">
        <p>
          {GRIEVANCE_OFFICER ? (
            <>
              Our grievance officer is <strong className="text-[#1b261b]">{GRIEVANCE_OFFICER.name}</strong>
              {GRIEVANCE_OFFICER.designation ? `, ${GRIEVANCE_OFFICER.designation}` : ''}.{' '}
            </>
          ) : null}
          For any complaint about your data or an order, write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#4a7333] font-semibold hover:underline">{CONTACT_EMAIL}</a>{' '}
          with "Grievance" in the subject. We acknowledge every grievance within 48 hours and resolve
          it within one month.
        </p>
      </Section>

      <Section title="9. Security">
        <p>
          Connections to the site are encrypted (HTTPS). Passwords and sign-in codes are stored only
          as one-way hashes. The database is reachable only from our own server, and access to order
          data is limited to staff who need it. No system is perfectly secure; if a breach affects
          your data, we will tell you and the Data Protection Board as the law requires.
        </p>
      </Section>

      <Section title="10. Children">
        <p>
          The site is meant for adults. We do not knowingly collect personal data from anyone under
          18. If you believe a child has given us their data, contact us and we will delete it.
        </p>
      </Section>

      <Section title="11. Changes to this policy">
        <p>
          When we change how we use personal data, we update this page and the "Last updated" date
          above before the change takes effect. For a significant change, we will also tell account
          holders by email.
        </p>
      </Section>

      <Section title="12. Contact us">
        <p>Questions about this policy or your data:</p>
        <ContactList />
        <p>
          You can also use the{' '}
          <Link to="/contact" className="text-[#4a7333] font-semibold hover:underline">contact page</Link>.
        </p>
      </Section>
    </LegalLayout>
  )
}
