# Elegant Sip API

Fastify · TypeScript · PostgreSQL · Drizzle · Zod → OpenAPI.

## Run it

```bash
docker compose up -d          # postgres, redis, mailpit (from the repo root)
npm run db:migrate
npm run db:seed
npm run dev --workspace @elegantsip/api
```

| | |
|---|---|
| API | http://localhost:4000 |
| Swagger UI | http://localhost:4000/docs |
| Mail catcher | http://localhost:8025 |

`npm run smoke --workspace @elegantsip/api` drives the whole customer and
shopkeeper journey in-process and prints what it checked.

## The rules this codebase holds to

**Money is integer paise.** Never floats, never rupees. Razorpay settles in
paise. But the storefront prices in whole rupees, so GST is rounded to a whole
rupee by `calculatePricing()` in `@elegantsip/shared` — the *same function* the
storefront uses for display. That is the point of the shared package: the figure
a customer is shown and the figure they are charged cannot drift apart. There is
a test asserting every total across ₹0–20,000 lands on a whole rupee.

**The client never sends a price.** `POST /v1/pricing/quote` and `POST /v1/orders`
take product slug, variant size and quantity. Everything monetary is looked up.
A request carrying `unitPrice` is not rejected — it is simply ignored, and there
is a test proving it.

**Only a signed webhook marks an order paid.** The browser's return from the
gateway proves nothing; the customer can close the tab. `POST /v1/webhooks/razorpay`
verifies the HMAC against the **raw** body, records the event (the unique
constraint on `(provider, event_id)` is the idempotency guard), checks the
captured amount equals the order total, and only then transitions the order.

**Stock cannot oversell.** `POST /v1/orders` locks the variant rows with
`SELECT … FOR UPDATE` inside the transaction that also writes the order. Two
customers racing for the last pack serialise on that lock. A `CHECK (stock >= 0)`
constraint is the backstop, and every movement is recorded in `stock_ledger`.

**`verified` on a review is derived, never asserted.** The server checks whether
a paid order from that customer contains the product.

**Nothing claims to have happened that did not.** `sendEmail` returns
`delivered: false` rather than throwing when SMTP is unconfigured, so a caller
can never report "sent" when nothing was. An invoice without `SELLER_GSTIN` is
labelled provisional, because a document cannot claim to be a tax invoice
without a GSTIN.

## Layout

```
src/
  app.ts              Fastify assembly — plugins, session hook, route registration
  env.ts              Zod-validated config; the process exits on bad config
  db/
    schema.ts         Catalogue tables
    schema-commerce.ts Identity, orders, payments, invoices, ledger
    seed.ts           The real catalogue, idempotent
  lib/
    problem.ts        One RFC 9457 error shape for every endpoint
    sessions.ts       Opaque token in an httpOnly cookie, record in Redis
    gateway.ts        PaymentGateway interface + Razorpay + Fake
    invoice.ts        GST numbering and the CGST/SGST vs IGST split
    email.ts          SMTP via nodemailer, one template
  routes/             health · auth · products · gardens · journal ·
                      pricing · orders · webhooks · account · admin
```

## Payments without credentials

`PAYMENT_PROVIDER=fake` (the default) uses `FakeGateway`, which signs webhooks
with the same HMAC-SHA256 scheme as Razorpay. It is **not a stub** — signature
verification, idempotency and capture are the real code paths, which is why the
checkout tests are meaningful without any account.

Setting `PAYMENT_PROVIDER=razorpay` without all three Razorpay variables throws
at startup rather than silently falling back. A deploy that quietly used a fake
gateway would take orders it could never collect.

## OpenAPI

The spec is generated from the Zod schemas that validate requests, so it cannot
describe a shape the code does not return.

```bash
npm run openapi:emit --workspace @elegantsip/api
```

CI regenerates it and **fails if `openapi.json` differs from the committed
copy** — an API change without a docs change is a red build.

## Migrations

```bash
npm run db:generate    # after editing a schema file — writes reviewable SQL
npm run db:migrate     # applies it
```

Migrations are run explicitly, never on container start: two instances booting
together would race through the migration table.

## Environment

See `.env.example`. Everything is validated at boot. Notable:

| Variable | Effect if unset |
|---|---|
| `DATABASE_URL` | Process refuses to start |
| `REDIS_URL` | Defaults to localhost; sessions fail without a reachable Redis |
| `SMTP_URL` | Email is logged, not sent, and reported as undelivered |
| `SELLER_GSTIN` | Invoices are provisional rather than tax invoices |
| `PAYMENT_PROVIDER` | Defaults to `fake` |

## Not built yet

- No PDF rendering for invoices — `getInvoiceView()` returns structured data;
  the document itself still needs a renderer.
- No background queue. Invoice generation and email run inline after the
  webhook transaction commits, wrapped so a failure cannot fail the capture.
  Under real volume these belong on BullMQ.
- No Sentry wiring.
- The storefront does not consume this API yet.
