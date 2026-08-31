# Elegant Sip

E-commerce storefront for a Darjeeling tea brand. Single-origin first flush,
priced in Indian Rupees, bought direct from the garden.

Instagram: [@elegantsip_darjeeling](https://www.instagram.com/elegantsip_darjeeling) ·
[elegantsipdarjeeling@gmail.com](mailto:elegantsipdarjeeling@gmail.com) ·
WhatsApp [+91 75839 95294](https://wa.me/917583995294)

## What this is

A monorepo: the storefront (`apps/web`), the API (`apps/api`), and the contract
they share (`packages/shared`).

Accounts, orders, stock, pricing and reviews are all real and server-side now.
Payment is the one thing still stubbed: the gateway adapter is complete and
tested, but runs against a fake gateway until Razorpay credentials are set, so
an order is placed and held rather than paid. The UI says exactly that.

**Honesty is a design rule here.** The UI must never claim something that did
not happen: no "confirmation email sent" when none was, no fake discounts, no
star ratings on products nobody has reviewed, no duty calculation the code
cannot perform. Coming-soon products render as such rather than pretending to
be purchasable.

The backend enforces this rather than merely respecting it. `sendEmail` returns
`delivered: false` instead of throwing, so a caller can never report "sent"
when nothing was. An invoice without a GSTIN is labelled provisional. An order
awaiting payment says "Order placed", never "Confirmed".

## Layout

| | |
|---|---|
| `apps/web` | The storefront. Vite · React 19 · Tailwind v4 · GSAP |
| `apps/api` | Fastify · PostgreSQL · Drizzle · Zod → OpenAPI. See its own README |
| `packages/shared` | Zod schemas and **the money rules**, imported by both |

The shared package is the important one. `calculatePricing()` runs on the server
to decide what a customer is charged and in the browser to decide what they are
shown, so the two cannot disagree. There is a test asserting every total across
₹0–20,000 lands on a whole rupee.

## Where the catalogue comes from

Products, gardens and journal posts live in the database, but the storefront
reads them from a **build-time snapshot** (`apps/web/src/data/catalogue.json`,
refreshed by `npm run catalogue:sync`).

That is deliberate. Six products change a few times a year, so a snapshot means
the shop paints instantly with no spinner, crawlers get real product data in the
prerendered HTML, and the sitemap can be generated at build time without the API
being reachable. Prices and stock can be slightly stale, which is safe because
nothing monetary is decided from the snapshot — the server re-prices every cart
and returns `adjustments` when a line has moved.

Everything transactional — auth, pricing, orders, reviews, wishlist — is live API.

## Stack

- **Vite 7 + React 19 + TypeScript** (strict; `npm run build` = `tsc --noEmit && vite build`)
- **Tailwind CSS v4** via `@tailwindcss/vite` — utility classes inline, no CSS modules
- **GSAP + ScrollTrigger + @gsap/react** for scroll animation, **Lenis** for smooth scrolling
- **No router library** — a custom history router in `src/lib/router.tsx`
- **Vitest** for unit tests, **ESLint** for linting, plus a crawl-based SEO audit
  (`npm run seo:check`). Full verification = `npm run build && npm test && npm run lint`.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, bundle, then prerender route shells + generate `sitemap.xml` / `robots.txt` |
| `npm run preview` | Serve the production build (Vite's own server — see the caveat below) |
| `npm run lint` | ESLint |
| `npm test` | Vitest across all workspaces |
| `npm run catalogue:sync` | Refresh the catalogue snapshot from the API |
| `npm run smoke` | Drive the full customer + shopkeeper journey against the API |
| `npm run serve:dist` | Serve `dist/` the way the shipped `.htaccess` does: directory index first, then SPA fallback |
| `npm run seo:check` | Crawl the built site and audit it (start `serve:dist` first) |

> **Use `serve:dist`, not `preview`, to check SEO output.** `vite preview`
> applies its own SPA fallback without first looking for a directory index, so
> it serves the root shell for every route — which would hide whether the
> prerendered per-route HTML is correct.

### Running the SEO audit

```bash
npm run build
npm run serve:dist &      # http://localhost:4500
npm run seo:check
```

`scripts/seo-check.mjs` crawls every URL in the generated sitemap and checks it
twice: the **raw** HTML a crawler gets before executing JavaScript, and the
**hydrated** DOM for JSON-LD and heading structure. It validates titles and
descriptions (presence, length, uniqueness), canonicals, the Open Graph block,
one-`h1`-per-page and no skipped heading levels, structured-data required
fields, image alt coverage and intrinsic dimensions, internal linking (orphan
detection), and the sitemap/robots files themselves. It exits non-zero on any
failure, so it can gate a deploy.

One deliberate subtlety: `Product` schema without `offers` is a **failure** for
a purchasable product but **expected** for a coming-soon one, and the checker
reads the catalogue snapshot to tell them apart. Emitting a ₹0 offer to satisfy
Google's rich-result guidance would be a false price.

## Deploying

The two halves deploy separately, because they are different kinds of thing.

**Storefront → Vercel** (`vercel.json` is committed and configures this):

| Setting | Value | Why |
|---|---|---|
| Build command | `npm run build --workspace @elegantsip/web` | The root `build` also builds the API, which Vercel cannot run |
| Output directory | `apps/web/dist` | This is a workspace; `dist` is not at the repo root |
| `VITE_API_URL` | the deployed API origin | **Required.** Vite inlines it at build time |

`vercel.json` also supplies the SPA fallback rewrite. `public/.htaccess` is
Apache-only and `public/_redirects` is Netlify-only — Vercel reads neither, so
without the rewrite every deep link 404s. Vercel checks the filesystem before
applying rewrites, so the prerendered per-route shells still win.

**Forgetting `VITE_API_URL` is the trap.** The build succeeds and the site looks
fine — the catalogue comes from the committed snapshot — but the bundle points
at `http://localhost:4000`, so sign-in, cart pricing and checkout all fail
against the visitor's own machine. The build prints a warning when it is unset.

**API → anywhere that runs a container.** Railway, Render and Fly all work from
`apps/api/Dockerfile` unchanged, with managed Postgres and Redis alongside. It
is a long-lived server holding database and Redis connections, so it does not
belong on Vercel. `.vercelignore` excludes it.

Set `CORS_ORIGINS` on the API to the storefront's deployed origin, or the
browser will block every request.

**Everything on one server** is the cheaper and slightly safer option, and the
one this repo is set up for: `docker-compose.prod.yml` runs Caddy serving the
built storefront and proxying `/api` to the API, with Postgres, Redis and a
nightly backup behind it. Only Caddy publishes ports.

Because both halves are then one origin, sessions use `SameSite=Lax` instead of
the `None` a split deployment forces, CORS is never consulted, and no API
hostname is baked into the bundle — `VITE_API_URL` is the relative `/api`, so
one build serves a bare IP and a domain alike. `SITE_ADDRESS` switches Caddy
between plain HTTP on an IP and automatic HTTPS on a domain; certificates are
obtained and renewed without configuration.

### Hostinger VPS deployment

On a fresh Ubuntu VPS, install Docker Engine and the Compose plugin, then clone
this repository. From its root:

```bash
cp .env.prod.example .env
nano .env
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f
```

Set `POSTGRES_PASSWORD` to a long URL-safe secret (for example,
`openssl rand -hex 30`). While using the server IP, leave `SITE_ADDRESS` blank
and set `SITE_URL=http://<server-ip>`. Once the `elegantsip.in` DNS A record
points to the VPS, set `SITE_ADDRESS=elegantsip.in` and
`SITE_URL=https://elegantsip.in`, then run the final command again. Caddy
obtains and renews the certificate.

Open VPS firewall ports **80** and **443** (and retain SSH access); do not open
Postgres, Redis or API port 4000. Check the deployment with
`curl -fsS http://127.0.0.1/api/health` (or the HTTPS domain), and use
`/api/docs` for Swagger. The backup runs at 02:30 Asia/Kolkata by default;
change `BACKUP_TIMEZONE` in `.env` only if the business operating timezone
changes.

### Automatic GitHub Actions deployment

`.github/workflows/deploy-production.yml` deploys each successful `main` CI
run to the VPS, using the exact commit that CI tested. In the GitHub repository
settings, add these **Actions secrets** (never commit them):

| Secret | Value |
|---|---|
| `VPS_HOST` | `187.127.185.82` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_PRIVATE_KEY` | A dedicated private SSH key allowed for the `deploy` user |
| `VPS_SSH_KNOWN_HOSTS` | The exact `ssh-keyscan -H 187.127.185.82` output, verified from a trusted connection |

Create a dedicated keypair on your own computer, add its public key to
`/home/deploy/.ssh/authorized_keys` on the VPS, and put only the private key in
the GitHub secret. Keep the VPS `.env` untracked; deployments update source and
rebuild containers but never overwrite it. The workflow can also be run
manually from the GitHub Actions page.

### Docker: three compose files, one Dockerfile

`apps/api/Dockerfile` has a `dev` stage and a `runtime` stage sharing one
dependency install, so the container you develop in and the one that ships
differ only in their command. The image `docker:up` builds locally and the one
the server builds have identical filesystem layers.

| Command | What it runs |
| --- | --- |
| `npm run docker:dev` | Daily work. Source bind-mounted, API restarts ~4s after a save, no rebuild. |
| `npm run docker:up` | The real production image, locally. Use before deploying. |
| `npm run docker:prod` | The full server stack, exactly as the VPS runs it. |

The two local files tag their images separately (`elegantsip-api-dev` vs
`elegantsip-api`) because they describe the same service in the same project —
without distinct tags whichever built last wins, and `docker:up` would run the
hot-reload image while appearing to test production.

Postgres, Redis and Mailpit are containers in every mode; only the API's
packaging changes. `npm run smoke` exercises a full customer and shopkeeper
journey against whichever stack is up.

## Routing and SEO

The site uses **real paths** (`/shop`, `/product/first-flush-whole-leaf`), not
hash fragments, so every route is a distinct indexable URL.

This requires an **SPA fallback rewrite** on the host. Configs ship with the
repo: `public/.htaccess` (Apache/XAMPP), `public/_redirects` (Netlify). For
other hosts, rewrite unmatched paths to `/index.html` while still serving files
that exist.

`npm run build` runs a plugin (`seoPlugin` in `vite.config.ts`) that:

1. writes **one static HTML shell per indexable route** carrying that route's
   real title, description, canonical and Open Graph tags, so a crawler gets
   correct metadata without executing JavaScript;
2. generates **`sitemap.xml`** from the live catalogue and journal, with
   `<lastmod>`;
3. generates **`robots.txt`**, disallowing `/cart`, `/checkout`, `/account`,
   `/wishlist` and `/order/`.

`src/lib/seoRoutes.ts` is the single source of truth for per-route metadata and
is read by both the pages (at runtime) and the build — so a page title can never
drift from its sitemap entry. **Add new routes there.**

Legacy `/#/shop` links are migrated to `/shop` on boot (`migrateLegacyHashUrl`).

## Architecture

Entry: `src/main.tsx` → `ErrorBoundary > AuthProvider > CartProvider > UiProvider`
(Auth wraps Cart because the cart syncs the wishlist to the signed-in account.)
→ **`TeaVectorHomepage`** (app shell: loading overlay, fixed header, the route
`switch`, footer, consent banner, route-change announcer).

### Data layer

`src/data/products.ts` reads the build-time snapshot and exposes the same
helpers the components always used. Testimonials, FAQs and the Taste Matcher
mapping remain in `src/data/content.ts` — they have no backend home yet.

**Money is paise everywhere in the storefront**, matching the API. `formatINR`
takes paise. `Product.fromPrice` is the lowest variant price (the card's "from"
figure) and is `null` for a coming-soon product, because a ₹0 price would read
as free.

**Catalogue (6 cards, all 100 g packs, INR):**

| Product | Tiers | Notes |
|---|---|---|
| First Flush Whole Leaf | Basic ₹600 · Classic ₹600 · Premium ₹1,000 | Gopaldhara |
| First Flush Broken Leaf | Basic ₹500 · Classic ₹600 · Premium ₹700 | Gopaldhara |
| First Flush Broken Mixed | Basic ₹150 · Premium ₹300 | Rohini |
| First Flush Fannings | Basic ₹100 · Premium ₹200 | Rohini |
| Second Flush | — | `status: 'coming-soon'` |
| Third Flush | — | `status: 'coming-soon'` |

`status: 'coming-soon'` products render with a badge instead of a price,
disabled buttons, no JSON-LD offer, and are excluded from related-product rails.
To activate one: set real price/stock and delete the `status` field.

`Product.origin.estate` must match a `Garden.name`, and that garden's
`productIds` must list the product — `getGardenByEstate` links them in both
directions and the product page renders a "Visit the garden" cross-link.

### Commerce libs (`src/lib/`)

- `pricing.ts` — whole-rupee INR. GST **5%** (applied to goods *and* shipping),
  free shipping at **₹4,000+**, Standard ₹150 / Express ₹450. Cart and checkout
  both consume `getOrderPricing()`; never duplicate money math in components.
- `currency.ts` — `formatINR()` with Indian digit grouping (`₹1,25,000`), and a
  finite-number guard so a bad value never renders as "₹NaN".
- `orders.ts` — orders in localStorage; powers `/order/:number`, `/account`,
  checkout prefill, and `hasPurchased()` which gates the "Verified" badge.
- `ratings.ts` — **the** rating calculation. Card, detail page and the "Top
  Rated" sort all use `getMergedRating()`.
- `localReviews.ts` — customer reviews, shape-validated and capped on read.
- `analytics.ts` — no-op unless `VITE_ANALYTICS_PROVIDER` is set, and events
  fire **only after consent**. **Never pass PII** (emails, names, addresses) to
  `track()` — the privacy policy promises we don't.
- `network.ts` — `shouldSkipHeavyMedia()`; Data Saver and 2G/3G get the poster
  instead of the scroll video.
- `useDialog.ts` — focus trap, focus restoration, Escape and scroll lock. Every
  modal uses it.
- `router.tsx` — also exports `useDocumentMeta` (title/description/canonical/OG,
  restores defaults on unmount) and `useJsonLd` (value-compared, so an inline
  object literal doesn't tear the script down every render).

### Cart rules (`CartContext.tsx`)

Cart lines are keyed by **product id + variant size**. On hydrate the stored
cart is **re-validated against the catalogue**: shape-checked (localStorage is
user-editable and can hold anything), prices snapped back, dead products and
variants dropped, quantities clamped to stock. Keep this invariant.

## The homepage: two experiences

- **Desktop (≥1024px)** — `HomeExperience`: a fixed full-screen video
  (`public/video.mp4`) scrubbed by scroll across a 500vh runway, then a pinned
  `ScrollExpand` revealing the content sections.
- **Phones & portrait tablets (<1024px)** — `MobileHome`: a sticky portrait
  video scrub hero (`public/mobile_video.mp4`), marquee ticker, then a linear
  flow of the same shared sections.

Both are `React.lazy` so a visitor downloads one variant, not both.

### Scroll-video performance rules (hard-won — do not regress)

1. **Videos must be encoded all-intra** (every frame a keyframe) or scrubbing
   stutters. Recipe:
   `ffmpeg -i in.mp4 -c:v libx264 -crf 34 -preset veryslow -g 1 -pix_fmt yuv420p -movflags +faststart -an -vf scale=1440:-2 out.mp4`
   Verify with
   `ffprobe -select_streams v:0 -show_entries frame=pict_type -of csv=p=0 out.mp4`
   — every frame must be `I`. Regenerate the poster from frame 1 at the same time.
2. **Seeks are clamped to the buffered range** via a proxy object — seeking into
   unbuffered video aborts in-flight range requests (a "cancel storm" on slow
   networks). Both heroes implement this; keep it.
3. **Never put raw scroll progress in React state.** Only quantized threshold
   booleans go through `setState`, with bail-outs; continuous values are written
   straight to the DOM.
4. ScrollTriggers use `scrub: 1` so the video glides like playback.
5. The loader releases at **15% buffered**, not fully buffered — the clamp above
   lets the playhead trail the download.

## Conventions

- **Max 300 lines per file.** Split along natural seams when a file approaches
  it (see `components/legal/`, `components/checkout/`).
- **Brand palette:** `#1b261b` (dark green), `#8bb56e` (accent — *decorative
  fills and text on dark only*), `#4a7333` (**accent text on light backgrounds**
  — 5.29:1, WCAG AA), `#a8cf8a` (accent text on dark), `#f9faf7` (paper),
  `#4a584a` (body text), white cards with `border-[#1b261b]/10` and `rounded-2xl`.
- **Contrast:** `#8bb56e` is only 2.24:1 on paper — **never use it for text on a
  light background.** Minimum text size is 11px, and body text uses the solid
  `#4a584a` rather than a reduced-opacity variant.
- **Never add `focus:outline-none`** — it out-specifies the global
  `:focus-visible` ring and strands keyboard users.
- Type patterns: eyebrows are `font-mono text-xs tracking-[0.3em] uppercase
  text-[#4a7333]`; headings bold, tight-tracked, often uppercase.
- Icons are inline stroke SVGs — **no emoji in UI**.
- Images: `.webp`, with explicit `width`/`height` to prevent layout shift, and
  `srcset` for anything full-bleed. Descriptive alt text carrying real terms
  ("Darjeeling", the grade) — reserve `alt=""` for genuinely decorative images.
- **Skeleton loading:** major imagery renders through `SkeletonImage` (brand
  shimmer, plus a broken-image state). All non-home routes are `React.lazy` with
  `PageSkeleton` as the Suspense fallback — keep new routes lazy.
- Touch targets are at least 44×44px.

## localStorage keys (all prefixed `elegant_sip_`)

`cart`, `wishlist`, `coupon`, `user` (demo auth), `orders`, `order_notes`,
`reviews`, `subscribers` (newsletter fallback), `consent` (analytics).

Every one of these is user-editable and must be shape-validated on read. The
`ErrorBoundary` offers a "reset local data" escape hatch if one ever poisons a boot.

## Env vars

See `.env.example`. All optional; features degrade honestly without them.

Coupons: `SIP10` and `WELCOME10`, both 10%, hardcoded in `CartContext.tsx`.

## Known limitations / roadmap

- **No backend.** Real payments, real auth, server-side price/coupon validation,
  transactional email and inventory sync are all pending a first API. The client
  is structured so that is a wiring job.
- **Stock is static.** `stock: 20` on every variant is never decremented, so
  scarcity copy stays deliberately vague ("Limited lot") rather than quoting a
  number the site cannot back.
- **Testimonials are placeholders.** Replace with real attributable quotes
  before launch, or delete the section — see the note in `data/content.ts`.
- **Garden attributions need confirming.** The Gopaldhara/Rohini profiles are
  accurate about the region but must be checked against real purchase records.
- **Shipping regions are undecided.** Checkout offers India only; the FAQ,
  Shipping page and Terms all say the same thing and point international
  customers to WhatsApp. If that changes, update all four together.
- Legal pages are templates written to match actual site behaviour — review with
  counsel before real commerce.
