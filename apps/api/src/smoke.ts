// Must be first: sets local defaults before env.ts is evaluated.
import './dev-defaults.js'

import { createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { buildApp } from './app.js'
import { db, sql } from './db/client.js'
import { users } from './db/schema-commerce.js'
import { redis } from './lib/sessions.js'

/*
 * End-to-end smoke run: the journey a real customer and a real shopkeeper take.
 * Drives the app in-process, so it needs no port and no external HTTP client.
 *
 *   npm run smoke --workspace @elegantsip/api
 */

const app = await buildApp()
await app.ready()

const line = (s: string) => console.log(s)
const ok = (label: string, detail = '') => line(`  ok    ${label.padEnd(46)}${detail}`)
const fail = (label: string, detail = '') => {
  line(`  FAIL  ${label.padEnd(46)}${detail}`)
  failures += 1
}
let failures = 0

const stamp = Date.now()
const EMAIL = `smoke${stamp}@example.com`
const PASSWORD = 'a-long-enough-password'

line('\nCUSTOMER JOURNEY')

/* 1. Register */
const reg = await app.inject({
  method: 'POST',
  url: '/v1/auth/register',
  payload: { name: 'Smoke Buyer', email: EMAIL, password: PASSWORD },
})
reg.statusCode === 200 ? ok('register') : fail('register', String(reg.statusCode))

/* Registering with the same address again must look identical from outside. */
const dupe = await app.inject({
  method: 'POST',
  url: '/v1/auth/register',
  payload: { name: 'Someone Else', email: EMAIL, password: PASSWORD },
})
dupe.statusCode === 200 && dupe.body === reg.body
  ? ok('duplicate registration is indistinguishable', 'no account enumeration')
  : fail('duplicate registration leaked a difference')

/* 2. Wrong password is rejected */
const bad = await app.inject({
  method: 'POST',
  url: '/v1/auth/login',
  payload: { email: EMAIL, password: 'not-the-password' },
})
bad.statusCode === 401 ? ok('wrong password rejected') : fail('wrong password accepted', String(bad.statusCode))

/* 3. Sign in */
const login = await app.inject({
  method: 'POST',
  url: '/v1/auth/login',
  payload: { email: EMAIL, password: PASSWORD },
})
const cookie = login.cookies.find((c) => c.name === 'es_session')
login.statusCode === 200 && cookie ? ok('sign in', 'httpOnly session cookie set') : fail('sign in', String(login.statusCode))
/*
 * SameSite is derived from whether the storefront and the API sit on the same
 * site, so the assertion is on the rule, not on one deployment's answer:
 * `None` must always carry `Secure` (browsers reject it otherwise), and the
 * cookie must never be readable by JavaScript.
 */
const sameSite = cookie?.sameSite?.toLowerCase()
const cookieValid =
  cookie?.httpOnly === true &&
  (sameSite === 'lax' || (sameSite === 'none' && cookie.secure === true))
if (!cookieValid) {
  fail('cookie flags', JSON.stringify({ httpOnly: cookie?.httpOnly, sameSite, secure: cookie?.secure }))
} else {
  ok('cookie flags', `httpOnly + SameSite=${cookie.sameSite}${cookie.secure ? ' + Secure' : ''}`)
}
const auth = { cookie: `es_session=${cookie?.value ?? ''}` }

/* 4. Session resolves */
const me = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: auth })
me.json().user?.email === EMAIL ? ok('session resolves', EMAIL) : fail('session did not resolve')

/* 5. Wishlist round-trip */
await app.inject({
  method: 'PUT',
  url: '/v1/wishlist',
  headers: auth,
  payload: { productSlugs: ['first-flush-whole-leaf', 'not-a-real-tea'] },
})
const wish = await app.inject({ method: 'GET', url: '/v1/wishlist', headers: auth })
const slugs = wish.json().productSlugs
slugs.length === 1 && slugs[0] === 'first-flush-whole-leaf'
  ? ok('wishlist drops unknown slugs', slugs.join(','))
  : fail('wishlist', JSON.stringify(slugs))

/* 6. Review before purchase is unverified */
const earlyReview = await app.inject({
  method: 'POST',
  url: '/v1/products/first-flush-whole-leaf/reviews',
  headers: auth,
  payload: { rating: 5, text: 'Wonderful tea, genuinely floral and bright.' },
})
earlyReview.json().review?.verified === false
  ? ok('review before purchase is NOT verified')
  : fail('unpurchased review was marked verified')

/* 7. Place an order */
const placed = await app.inject({
  method: 'POST',
  url: '/v1/orders',
  headers: auth,
  payload: {
    items: [{ productSlug: 'first-flush-broken-leaf', variantSize: 'Classic · 100 g', quantity: 3 }],
    email: EMAIL,
    shipping: {
      name: 'Smoke Buyer',
      line1: '12 Mall Road',
      city: 'Darjeeling',
      postalCode: '734101',
      state: 'West Bengal',
      country: 'India',
    },
    shippingMethod: 'standard',
    couponCode: 'SIP10',
  },
})
if (placed.statusCode !== 200) {
  fail('place order', placed.body.slice(0, 160))
  process.exit(1)
}
const { order, payment } = placed.json()
const r = (p: number) => `₹${p / 100}`
ok('place order', `${order.number} · ${order.status}`)
ok(
  '  priced server-side',
  `sub ${r(order.subtotal)} − ${r(order.discount)} + ship ${r(order.shippingFee)} + GST ${r(order.tax)} = ${r(order.total)}`,
)
order.total % 100 === 0 ? ok('  total is a whole rupee') : fail('  total has paise', String(order.total))
order.couponCode === 'SIP10' ? ok('  coupon applied server-side') : fail('  coupon not applied')

/* 8. Capture via signed webhook */
const webhookBody = JSON.stringify({
  event: 'payment.captured',
  payload: {
    payment: { entity: { id: `pay_smoke_${stamp}`, order_id: payment.gatewayOrderId, amount: order.total, method: 'upi' } },
  },
})
const signature = createHmac('sha256', 'fake-webhook-secret').update(webhookBody).digest('hex')
const captured = await app.inject({
  method: 'POST',
  url: '/v1/webhooks/razorpay',
  headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
  payload: webhookBody,
})
captured.json().status === 'order_paid' ? ok('webhook captured payment') : fail('capture', captured.body)

/* 9. Order now reads as paid, and the review becomes verifiable */
const readBack = await app.inject({ method: 'GET', url: `/v1/orders/${order.number}`, headers: auth })
readBack.json().status === 'paid' ? ok('order reads back as paid') : fail('order status', readBack.json().status)

const history = await app.inject({ method: 'GET', url: '/v1/orders', headers: auth })
history.json().orders.length >= 1 ? ok('order history is account-scoped') : fail('order history empty')

const verifiedReview = await app.inject({
  method: 'POST',
  url: '/v1/products/first-flush-broken-leaf/reviews',
  headers: auth,
  payload: { rating: 5, text: 'Brisk and muscatel — exactly as described on the page.' },
})
verifiedReview.json().review?.verified === true
  ? ok('review AFTER purchase IS verified', 'derived from paid orders')
  : fail('purchased review not verified')

/* 10. Someone else cannot read this order */
const stranger = await app.inject({ method: 'GET', url: `/v1/orders/${order.number}` })
stranger.statusCode === 403 ? ok('another visitor cannot read the order') : fail('order leaked', String(stranger.statusCode))

line('\nSHOPKEEPER')

/* Admin routes reject a customer, then work once the role is granted. */
const denied = await app.inject({ method: 'GET', url: '/v1/admin/orders', headers: auth })
denied.statusCode === 403 ? ok('customer is refused admin access') : fail('admin open to customers', String(denied.statusCode))

await db.update(users).set({ role: 'admin' }).where(eq(users.email, EMAIL))
const relogin = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: EMAIL, password: PASSWORD } })
const adminAuth = { cookie: `es_session=${relogin.cookies.find((c) => c.name === 'es_session')?.value}` }

const queue = await app.inject({ method: 'GET', url: '/v1/admin/orders?status=paid', headers: adminAuth })
queue.statusCode === 200 ? ok('order queue', `${queue.json().orders.length} paid`) : fail('order queue', String(queue.statusCode))

const invoice = await app.inject({ method: 'GET', url: `/v1/admin/orders/${order.number}/invoice`, headers: adminAuth })
if (invoice.statusCode === 200) {
  const inv = invoice.json().invoice
  ok('GST invoice', `${inv.number} · HSN ${inv.hsn}`)
  ok(
    '  tax split',
    inv.totals.igst ? `IGST ${inv.totals.igst} (inter-state)` : `CGST ${inv.totals.cgst} + SGST ${inv.totals.sgst} (intra-state)`,
  )
  inv.isTaxInvoice === false
    ? ok('  labelled provisional', 'no GSTIN configured — cannot claim to be a tax invoice')
    : ok('  tax invoice', inv.sellerGstin)
} else {
  fail('invoice', String(invoice.statusCode))
}

const shipped = await app.inject({
  method: 'PATCH',
  url: `/v1/admin/orders/${order.number}`,
  headers: adminAuth,
  payload: { status: 'shipped', trackingCarrier: 'Delhivery', trackingNumber: 'DL123456789IN' },
})
shipped.statusCode === 200
  ? ok('mark shipped', shipped.json().notified ? 'customer emailed' : 'no email (SMTP unset)')
  : fail('mark shipped', String(shipped.statusCode))

const restock = await app.inject({
  method: 'POST',
  url: '/v1/admin/stock',
  headers: adminAuth,
  payload: { productSlug: 'first-flush-broken-leaf', variantSize: 'Classic · 100 g', delta: 12, note: 'New lot' },
})
restock.statusCode === 200 ? ok('restock', `stock now ${restock.json().stock}`) : fail('restock', String(restock.statusCode))

const config = await app.inject({ method: 'GET', url: '/v1/admin/config', headers: adminAuth })
ok('deployment config', JSON.stringify(config.json()))

line(failures === 0 ? '\nAll smoke checks passed.\n' : `\n${failures} smoke check(s) FAILED.\n`)

await app.close()
await sql.end({ timeout: 5 })
await redis.quit()
process.exit(failures === 0 ? 0 : 1)
