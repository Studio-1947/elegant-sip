# Elegant Sip — Full Site Audit

**Date:** 24 August 2026
**Scope:** Complete codebase review of the Elegant Sip storefront (Vite 7 · React 19 · TypeScript · Tailwind v4 · GSAP/Lenis · hash router · no backend).
**Method:** Six parallel review passes (SEO, performance, accessibility/UX, commerce & security, code quality/tooling, content consistency), every finding cross-checked against the source. File references are `path:line`.
**Status:** Re-verified line-by-line against commit `99c962f` (see [§6 Verification log](#6-verification-log)). Nine claims were corrected, one was withdrawn, and eight new findings were added. Bundle figures come from an actual `npm run build`, not estimates.

**Severity scale**

| Level | Meaning |
|---|---|
| **CRITICAL** | Breaks a core promise, leaks data, blocks users, or makes the site legally/commercially unsafe. Fix before launch. |
| **AVERAGE** | Materially hurts conversion, trust, ranking, or maintainability. Fix in the next sprint. |
| **LOW** | Polish, hygiene, or edge cases. Batch when convenient. |

---

## 1. Executive summary

Elegant Sip is an unusually well-engineered frontend. The scroll-video pipeline, cart re-validation, integer-only money math, strict TypeScript, route code-splitting, consent-gated analytics, and honest demo copy are all better than most production storefronts. **The engineering is not the problem. The content and the media are.**

Three themes dominate the critical list:

1. **The words describe a different company.** Gardens, FAQ answers, the shop meta description, the About timeline and the journal describe a Fujian/Guangxi oolong-green-white brand. The catalogue sells only Darjeeling first flush. Terms say "India only / damaged-goods returns"; the FAQ, Shipping page and product pages say "worldwide / 30-day no-questions guarantee".
2. **Search engines see one page.** Hash routing with no prerendering collapses every URL to `elegantsip.com/`; the sitemap's 16 `#/` entries are duplicates of the homepage; there is no canonical tag; the desktop homepage has no `<h1>`.
3. **13.6 MB of media gates first paint.** A 7.5 MB desktop video and a 1 MB hero image (served to phones at 288 px tall) sit on the LCP path with no `srcset`, no preload, and a loader that waits for the buffer.

Plus a handful of sharp, one-line fixes: the signed-in email is sent to analytics (contradicting the privacy policy), the skip-to-content link 404s, a signed-out visitor is prefilled with the previous customer's address, and the `gsap.ticker` callback leaks.

A fourth theme surfaced during re-verification: **several product-data features are declared but never populated.** No product in `PRODUCTS` sets `origin` or `flavorProfile`, so the entire garden↔product cross-link system is dead in both directions (A32), the product page's info grid renders one card in a three-column layout (A33), and the card's gallery dots and the detail page's "Only N left" scarcity line are unreachable code paths. The types promise a richer catalogue than the data delivers.

**Counts:** 24 critical · 35 average · 25 low = **84 findings**.

> The original draft of this document reported "14 critical · 31 average · 34 low". That line never matched its own tables and has been corrected: the critical tables always held 23 entries (C1–C23), the average table 31 (A1–A31), and the low table 19 (L1–L19). Re-verification added C24, A32–A35 and L20–L25, and withdrew one clause of L13.

---

## 2. Pros — what is genuinely strong

### Engineering
- **Scroll-video discipline.** All-intra encoding, buffered-clamped proxy seeks ([HomeExperience.tsx:63-70](../src/components/HomeExperience.tsx#L63-L70), [MobileHome.tsx:86-93](../src/components/MobileHome.tsx#L86-L93)), frame-quantised seek threshold, `scrub: 1` smoothing, and no raw scroll progress in React state. This is the best part of the codebase and is documented in `CLAUDE.md`.
- **Cart is never trusted from localStorage.** `revalidateCart` ([CartContext.tsx:57-80](../src/components/CartContext.tsx#L57-L80)) re-resolves products, snaps prices to the catalogue, de-dupes lines, drops dead variants, clamps quantity to stock.
- **Money math is centralised and integer-only.** `pricing.ts` is the single source for GST, thresholds and shipping; cart and checkout share `getOrderPricing()`. `formatINR` uses en-IN grouping everywhere.
- **Strict TypeScript, honoured.** `strict`, `noUnusedLocals`, `noUnusedParameters` on; zero `any`, zero `@ts-ignore`, zero `console.log`, zero TODOs across 8,867 lines of `src/` (all four counts verified at 0 by grep).
- **Route-level code splitting.** 19 lazy chunks (0.36–19.02 KB); main bundle 445.71 KB / 144.91 KB gzip, CSS 68.04 KB / 11.52 KB gzip. Skeleton fallbacks with `aria-busy`. *(Measured by `npm run build` at `99c962f`; the build passes `tsc --noEmit` clean.)*
- **No XSS surface.** No `dangerouslySetInnerHTML`/`innerHTML`; JSON-LD written via `textContent`; user reviews rendered as JSX children.
- **No card data persisted.** `PlacedOrder` has no card fields; only last-4 is displayed.
- **Every DOM listener is paired with a removal** (verified across `src/`), and `useScrollReveal` unobserves/kills tweens on cleanup.
- **File granularity.** Only one file over 300 lines (`ProductCard.tsx`, 317). Median file ~100 lines.

### Product & trust
- **Honest demo copy** in checkout, order confirmation, account, reviews and newsletter — nothing claims a payment was captured or an email was sent.
- **Coming-soon products are guarded in depth** (card, detail page, cart context, JSON-LD offer omitted).
- **Consent-gated analytics** — `track()` no-ops without a provider and without consent.
- **`prefers-reduced-motion` respected in 8+ places**, including skipping Lenis, the loader and the scrub hero.
- **Solid a11y foundations:** `lang`, landmarks, skip link, `inert` on hidden nav, Escape/scroll-lock on modals, `aria-expanded`/`aria-controls` on the FAQ, a keyboard-complete custom select, `htmlFor`/`id` on every form field.
- **Good empty/error/404 states** with real CTAs, not dead ends.

### SEO groundwork
- Correct `lang`, viewport, full OG + Twitter block, `preconnect` for fonts, valid `Organization`/`WebSite` JSON-LD, RSS discovery link, per-route `useDocumentMeta`, `Product` JSON-LD with per-variant `Offer` and correct availability enums, `FAQPage` and `Article` schema.

---

## 3. Cons — findings by severity

### 3.1 CRITICAL

| # | Area | Finding | Where |
|---|---|---|---|
| C1 | Content | **Phantom origins & products.** Three gardens (Wuyi Rock Garden, Cloud Mist Gardens, White Tea Valley — Fujian/Guangxi) sell "Ember Charm", "Morning Dew", "Summer Breeze", none of which exist. All `productIds` are `[]`, so `/gardens` never links to the shop. FAQ answers, About timeline, a journal article and canister alt text repeat the fiction. | [content.ts:37-74](../src/data/content.ts#L37-L74), [content.ts:168](../src/data/content.ts#L168), [content.ts:174](../src/data/content.ts#L174), [AboutPage.tsx:45](../src/components/AboutPage.tsx#L45), [CanisterShowcaseSection.tsx:44](../src/components/CanisterShowcaseSection.tsx#L44) |
| C2 | Content | **Shop meta description sells "Oolong, green, and white teas."** This is the indexed description of the primary commercial page; the catalogue is 100 % Darjeeling black tea. | [ShopPage.tsx:10](../src/components/ShopPage.tsx#L10), [GardensPage.tsx:9](../src/components/GardensPage.tsx#L9) |
| C3 | Legal | **Shipping region contradiction.** Terms: "We ship within India." FAQ + Shipping page: "We ship worldwide." Checkout offers US/CA/UK/AU. | [TermsPage.tsx:116](../src/components/legal/TermsPage.tsx#L116), [content.ts:138](../src/data/content.ts#L138), [ShippingReturnsPage.tsx:15](../src/components/legal/ShippingReturnsPage.tsx#L15), [checkoutData.ts:5](../src/components/checkout/checkoutData.ts#L5) |
| C4 | Legal | **Return policy contradiction.** Marketed four times as "30 days, no questions, no forms" (FAQ, Shipping page, trust badges, product page). Terms: returns "limited to damaged, defective, or incorrect items", window "to be specified at launch". Highest-liability inconsistency on the site. | [content.ts:150](../src/data/content.ts#L150), [ShippingReturnsPage.tsx:26-31](../src/components/legal/ShippingReturnsPage.tsx#L26-L31), [TrustBadgesSection.tsx:22](../src/components/TrustBadgesSection.tsx#L22), [ProductDetailPage.tsx:258](../src/components/ProductDetailPage.tsx#L258) vs [TermsPage.tsx:130-143](../src/components/legal/TermsPage.tsx#L130-L143) |
| C5 | Legal | **Live-store vs demo posture.** Privacy says "this is a demo storefront… no real payment is processed… to order, contact us on WhatsApp"; the footer shows VISA/MC/AMEX/PayPal/Apple Pay badges and the FAQ promises 24-hour dispatch. | [PrivacyPage.tsx:46-54](../src/components/legal/PrivacyPage.tsx#L46-L54), [Footer.tsx:96](../src/components/Footer.tsx#L96), [content.ts:132](../src/data/content.ts#L132) |
| C6 | Privacy | **Signed-in email is sent to analytics**, forwarded verbatim to Plausible props / `dataLayer`. Privacy policy states "We never send your email address… to analytics tools" and the consent banner says "no personal details, ever." One-line fix. | [LoginModal.tsx:48](../src/components/LoginModal.tsx#L48), [analytics.ts:53-62](../src/lib/analytics.ts#L53-L62), [PrivacyPage.tsx:126](../src/components/legal/PrivacyPage.tsx#L126) |
| C7 | Privacy | **Signed-out visitor is prefilled with the previous customer's name, email and street address.** Guard is `if (!user && !last) return`, so any prior order on the device triggers prefill with no explanatory banner. Shared/kiosk/family machines disclose a full postal address. | [CheckoutPage.tsx:26-45](../src/components/CheckoutPage.tsx#L26-L45), [ShippingStep.tsx:37-42](../src/components/checkout/ShippingStep.tsx#L37-L42) |
| C8 | Privacy | **Order history is device-scoped but presented as account-scoped.** Any sign-in (auth is assertion-only) shows every order on the browser under "Hello, {name} · Order History", including full addresses on `/order/:id`. | [AccountPage.tsx:12](../src/components/AccountPage.tsx#L12), [orders.ts:35](../src/lib/orders.ts#L35), [OrderPage.tsx:89-92](../src/components/OrderPage.tsx#L89-L92) |
| C9 | SEO | **Hash routing + no prerender ⇒ one indexable URL.** Every route serves the same empty `<div id="root">`; `dist/` contains a single `index.html`. Root cause of C10–C11. | [router.tsx:6-28](../src/lib/router.tsx#L6-L28), `vite.config.ts` |
| C10 | SEO | **Sitemap is 17 fragment URLs** out of 18 entries (`/#/shop`, `/#/product/…`). Fragments are not sent to the server; all normalise to `/`. The sitemap conveys zero URLs beyond the root. No `<lastmod>`. | [sitemap.xml:9-76](../public/sitemap.xml#L9-L76) |
| C11 | SEO | **No `<link rel="canonical">` anywhere** in `index.html` or `router.tsx`. | `index.html`, [router.tsx:58-77](../src/lib/router.tsx#L58-L77) |
| C12 | SEO | **Desktop homepage has no `<h1>`.** The hero title renders as `<h2>`; the only `<h1>` is in `MobileHome` (<1024 px). | [ScrollExpand.tsx:181](../src/components/ScrollExpand.tsx#L181), [HeroIntroSection.tsx:12](../src/components/HeroIntroSection.tsx#L12) |
| C13 | Robustness | **No React error boundary.** Any render-time throw (malformed localStorage, GSAP failure, missing product) unmounts the entire tree to a blank page with no recovery. | [main.tsx:9-19](../src/main.tsx#L9-L19) |
| C14 | A11y | **Skip-to-content link navigates to the 404 page.** `href="#main-content"` sets the hash, the router parses `main-content` as a route → `NotFoundPage`. | [TeaVectorHomepage.tsx:201-206](../src/components/TeaVectorHomepage.tsx#L201-L206) |
| C24 | Honesty | **"Duties are calculated at checkout" is false.** Promised twice — "duties are calculated at checkout so there are no surprises on arrival" and "any duties are shown at checkout" — but `getOrderPricing()` computes only GST + a flat shipping fee, and `checkoutData.ts` has no duty model at all. An international customer is told the landed cost is settled when it is not. This is the site's own honesty rule broken on the shipping promise, and it compounds C3. | [content.ts:138](../src/data/content.ts#L138), [ShippingReturnsPage.tsx:15-16](../src/components/legal/ShippingReturnsPage.tsx#L15-L16) vs [pricing.ts:35-50](../src/lib/pricing.ts#L35-L50), [checkoutData.ts](../src/components/checkout/checkoutData.ts) |

Also critical-grade, performance:

| # | Area | Finding | Where |
|---|---|---|---|
| C15 | Perf | **7.5 MB desktop video gates first meaningful paint.** `preload="auto"` + forced prime starts a full download; the opaque loader waits for the buffer (up to 25 s). ~12 s blank screen on 5 Mbps. | [HomeExperience.tsx:161-169](../src/components/HomeExperience.tsx#L161-L169), [TeaVectorHomepage.tsx:56-94](../src/components/TeaVectorHomepage.tsx#L56-L94) |
| C16 | Perf | **`gsap.ticker` callback never removed** — cleanup destroys Lenis but not the ticker subscription; under StrictMode a callback fires 60×/s against a destroyed instance forever. `lagSmoothing(0)` is also a global mutation never restored. | [TeaVectorHomepage.tsx:111-119](../src/components/TeaVectorHomepage.tsx#L111-L119) |
| C17 | Perf | **`hero.webp` is 1 MB, single resolution, no `srcset`** — served identically to phones where it paints into a 288 px band. Zero `srcset`/`<picture>` in the codebase. | [ScrollExpand.tsx:159-167](../src/components/ScrollExpand.tsx#L159-L167), [MobileHome.tsx:229](../src/components/MobileHome.tsx#L229) |
| C18 | A11y | **Focus ring cancelled on every text input and the custom select.** 16× `focus:outline-none` out-specifies the global `:focus-visible`; the remaining cue is a 1 px border at 2.25:1. | [index.css:181](../src/index.css#L181) vs `CheckoutPage.tsx:129`, `LoginModal.tsx:113`, `ContactPage.tsx:135`, `SelectDropdown.tsx:92`, etc. |
| C19 | A11y | **Cart drawer is always in the DOM, `aria-hidden` while focusable** — ~10 phantom tab stops on every page; explicit ARIA violation. | [CartDrawer.tsx:44](../src/components/CartDrawer.tsx#L44) |
| C20 | A11y | **No focus trap or focus restoration in any dialog** (login, quiz, cart drawer, mobile menu). Tab escapes behind the scrim; on close focus drops to `<body>`. | [LoginModal.tsx:20-28](../src/components/LoginModal.tsx#L20-L28), [TeaDiscoveryQuizModal.tsx:34-42](../src/components/TeaDiscoveryQuizModal.tsx#L34-L42), [CartDrawer.tsx:52-59](../src/components/CartDrawer.tsx#L52-L59), [SiteHeader.tsx:233-296](../src/components/SiteHeader.tsx#L233-L296) |
| C21 | A11y | **Checkout validation errors are invisible to assistive tech** — no `aria-invalid`, `aria-describedby`, `role="alert"` or focus-to-error. "Continue" silently does nothing. On the revenue path. | [CheckoutPage.tsx:57-87](../src/components/CheckoutPage.tsx#L57-L87), [ShippingStep.tsx:55-83](../src/components/checkout/ShippingStep.tsx#L55-L83) |
| C22 | A11y | **Brand green `#8bb56e` on light backgrounds is 2.25:1** and is used for real text (eyebrows, links, "Sign In", Privacy link in the consent banner). Needs 4.5:1. | `FaqPage.tsx:27`, `ShippingStep.tsx:46`, `ConsentBanner.tsx:28`, `QuizResult.tsx:38`, many more |
| C23 | A11y | **8–10 px text at 40–70 % opacity (2.6–3.7:1)** — body/brew meter labels, loader caption, newsletter fine print. | [ProductCard.tsx:197-229](../src/components/ProductCard.tsx#L197-L229), [LoadingOverlay.tsx:34](../src/components/LoadingOverlay.tsx#L34), [NewsletterSection.tsx:96-109](../src/components/NewsletterSection.tsx#L96-L109) |

### 3.2 AVERAGE

| # | Area | Finding | Where |
|---|---|---|---|
| A1 | Content | "Signature Blends" eyebrow and "Three signature single-origin blends" contradict "No blending" everywhere else; count is wrong (6 cards). | [ProductsSection.tsx:58](../src/components/ProductsSection.tsx#L58), [AboutPage.tsx:7](../src/components/AboutPage.tsx#L7) vs [ShopPage.tsx:50](../src/components/ShopPage.tsx#L50) |
| A2 | Content | README documents a "100 % 2D-vector homepage" with "no external graphic assets" and amber `#d48806` — a different product. Explains why `Generator.tsx` survives. | `README.md` |
| A3 | Content | Em-dash separators were stripped from ~25 strings (double spaces): `<title>`, OG/Twitter titles, every `useDocumentMeta` title ("FAQ  Elegant Sip"), RSS, alt text, UI copy. Brand also inconsistent: "Elegantsip" vs "Elegant Sip". | [index.html:8,15,20,67](../index.html#L8), all page components |
| A4 | Commerce | **Products with zero reviews render five filled stars** (`average: 5, count: 0`) with `aria-label="5 stars"`. The one place the UI asserts something untrue. Detail page handles it correctly. | [ProductCard.tsx:28-34](../src/components/ProductCard.tsx#L28-L34) |
| A5 | Commerce | **"Top Rated" sort is a permanent no-op** — it calls `getRating()` which only reads the empty static `REVIEWS`; cards compute a different merged rating. | [ProductsSection.tsx:50](../src/components/ProductsSection.tsx#L50), [content.ts:18](../src/data/content.ts#L18) |
| A6 | Commerce | Wishlist and coupon hydrate with no shape validation — a tampered key throws on every page and the crash survives reload. | [CartContext.tsx:86-91](../src/components/CartContext.tsx#L86-L91) |
| A7 | Commerce | `updateQuantity` can strand a quantity-0 line (clamp happens after the ≤0 check). | [CartContext.tsx:124-133](../src/components/CartContext.tsx#L124-L133) |
| A8 | Commerce | Order numbers use the low 6 digits of `Date.now()` → collisions every ~16.7 min; `getOrder` returns the first match, showing the wrong order. | [CheckoutPage.tsx:92](../src/components/CheckoutPage.tsx#L92) |
| A9 | Commerce | Coming-soon products render as "₹0 · Sold Out" on the wishlist. | [WishlistPage.tsx:58-70](../src/components/WishlistPage.tsx#L58-L70) |
| A10 | Commerce | GST is not applied to the shipping fee though labelled "GST (5%)". | [pricing.ts:45](../src/lib/pricing.ts#L45) |
| A11 | Commerce | Checkout email validation is `includes('@')`; the newsletter already has a proper `EMAIL_PATTERN`. | [CheckoutPage.tsx:59](../src/components/CheckoutPage.tsx#L59) |
| A12 | Commerce | Local review store is unvalidated and unbounded (no array guard, no length caps, `setItem` not wrapped). | [localReviews.ts:13-40](../src/lib/localReviews.ts#L13-L40), [ProductReviews.tsx:28](../src/components/ProductReviews.tsx#L28) |
| A13 | Commerce | Auth accepts any credentials (password checked for length, then discarded). Disclosed in UI, but it enables C8. | [LoginModal.tsx:38-47](../src/components/LoginModal.tsx#L38-L47), [AuthContext.tsx:34](../src/components/AuthContext.tsx#L34) |
| A14 | SEO | `Product` JSON-LD lacks `brand`, `sku`, `url`, `aggregateRating`/`review` (the page already computes the rating), `itemCondition`, `shippingDetails`, `hasMerchantReturnPolicy`; `image` is a relative path. | [ProductDetailPage.tsx:41-72](../src/components/ProductDetailPage.tsx#L41-L72) |
| A15 | SEO | `useDocumentMeta` never restores defaults → stale title/description on `#/` and on routes without meta; doesn't mirror `og:url`/`og:image`/twitter tags. Home route has no `useDocumentMeta` at all. | [router.tsx:58-77](../src/lib/router.tsx#L58-L77) |
| A16 | SEO | `useJsonLd` re-creates the `<script>` on every render (inline object literal deps) — every size click or accordion toggle tears it down. | [router.tsx:81-96](../src/lib/router.tsx#L81-L96) |
| A17 | SEO | Soft 404s: unknown routes return 200 with no `noindex`; cart/checkout/account/order/wishlist also lack `noindex`. | [TeaVectorHomepage.tsx:194](../src/components/TeaVectorHomepage.tsx#L194) |
| A18 | SEO | Site nav absent from the DOM while the loader is up (up to 25 s); `/gardens` and `/brewing` reachable only from the footer. | [TeaVectorHomepage.tsx:210](../src/components/TeaVectorHomepage.tsx#L210), [SiteHeader.tsx:8-13](../src/components/SiteHeader.tsx#L8-L13) |
| A19 | SEO | No `BreadcrumbList`, no `ItemList` on shop, no `HowTo` on brewing, no `Organization.logo`/address/telephone; deprecated `SearchAction`. `og:image` is the 1 MB hero with no width/height/alt. | `index.html:18-63` |
| A20 | Perf | Render-blocking Google Fonts with two full variable axes (`100..1000`); no async load or self-hosting. | [index.html:33-35](../index.html#L33-L35) |
| A21 | Perf | `index.html` preloads no media; `/poster.webp` is discovered only after 145 KB of JS boots React. | `index.html` |
| A22 | Perf | `vite.config.ts` declares only the `react` + `tailwindcss` plugins — no `build.rollupOptions.manualChunks`, so React/GSAP/Lenis sit in the 445 KB entry chunk and any app change busts their cache. | `vite.config.ts` |
| A23 | Perf | Both home variants (`HeroScrollSection`, `MobileHome`) statically imported into the entry chunk. | [HomeExperience.tsx:5-6](../src/components/HomeExperience.tsx#L5-L6) |
| A24 | Perf | 3.1 MB mobile video with `preload="auto"` on cellular; no `saveData`/`effectiveType` gate. | [MobileHome.tsx:160-168](../src/components/MobileHome.tsx#L160-L168) |
| A25 | Perf | **19 of 20 `<img>` tags carry no `width`/`height`** (CLS) — only `MobileHome.tsx:229` does. `loading="lazy"` on 11 of 27 image elements (20 `<img>` + 7 `<SkeletonImage>`). `gopal.jpg` is a 389 KB JPEG in an all-WebP set *and* is the About page's `fetchPriority="high"` LCP image. Duplicate mobile/desktop DOM mounts the same image twice (35 `hidden`/`lg:hidden` pairs). The desktop LCP image (`ScrollExpand.tsx:159-167`) is `loading="eager"` with no dimensions. | `ProductCard.tsx:73`, `JournalPage.tsx:59,73,132`, `CanisterShowcaseSection.tsx:42,54`, [AboutPage.tsx:20](../src/components/AboutPage.tsx#L20), [ScrollExpand.tsx:159-167](../src/components/ScrollExpand.tsx#L159-L167) |
| A26 | A11y | Star ratings labelled on a role-less `<div>`; `role="radio"` tier pickers without roving tabindex/arrow keys. | [ProductCard.tsx:166-169](../src/components/ProductCard.tsx#L166-L169), [ProductCard.tsx:230-255](../src/components/ProductCard.tsx#L230-L255) |
| A27 | A11y | Checkout fields are not in a `<form>`; no `autoComplete` attributes (Enter does nothing; no browser autofill). | [CheckoutPage.tsx:163-271](../src/components/CheckoutPage.tsx#L163-L271) |
| A28 | A11y | Success states (newsletter, contact, order confirmed), add-to-cart, cart count and route changes are all silent — no live region, no focus move. | `NewsletterSection.tsx:60`, `ContactPage.tsx:50`, `ProductCard.tsx:294`, [router.tsx:11-23](../src/lib/router.tsx#L11-L23) |
| A29 | A11y | Collapsed FAQ answers remain in the accessibility tree (`0fr` + `opacity: 0` only). | [FaqPage.tsx:65-73](../src/components/FaqPage.tsx#L65-L73) |
| A30 | A11y | Touch targets under 44 px: cart drawer ±/Remove, card ± steppers, wishlist heart (36 px). Gallery dots are 4×10 px but currently unreachable — they need `product.images`, which no product sets. Consent banner is a `role="dialog"` with no `aria-modal`, no focus management and no Escape handler. | [CartDrawer.tsx:116-137](../src/components/CartDrawer.tsx#L116-L137), [ProductCard.tsx:121-135,264-278](../src/components/ProductCard.tsx#L121-L135), [ConsentBanner.tsx:21-23](../src/components/ConsentBanner.tsx#L21-L23) |
| A31 | Tooling | No ESLint, no tests (zero coverage on `getOrderPricing()`), no `.env.example`; `dist/index.html` is tracked in git despite `dist/` being in `.gitignore` — **confirmed live: running `npm run build` dirties the working tree**, because the hashed asset filenames inside it change on every build; 472 lines of dead code (`Generator.tsx`, `teaPlantVectorData.ts`, `save_frames.js`). | `package.json`, `.gitignore`, `src/components/Generator.tsx` |
| A32 | Data | **The garden↔product system is unwired in both directions.** No product in `PRODUCTS` sets `origin`, so `getGardenByEstate()` can never resolve, `ProductInfoCards`' entire Origin card and its "Visit the garden →" link are unreachable, and `Product` JSON-LD never emits `additionalProperty`. Combined with all three `GARDENS[].productIds` being `[]` (C1), "the garden is the brand" has no wiring at either end. `flavorProfile` is likewise declared and never populated, so the Flavor Profile card is dead too. | [products.ts:69-70](../src/data/products.ts#L69-L70), [content.ts:76-77](../src/data/content.ts#L76-L77), [ProductInfoCards.tsx:10-70](../src/components/ProductInfoCards.tsx#L10-L70), [ProductDetailPage.tsx:61-69,100](../src/components/ProductDetailPage.tsx#L61-L69) |
| A33 | UX | **The product info grid renders one card in a three-column layout.** `ProductInfoCards` is `md:grid-cols-3`, but with no `origin` and no `flavorProfile` on any product only the Brewing Guide renders — a third-width card with two empty columns on all four purchasable product pages. Direct visible consequence of A32. | [ProductInfoCards.tsx:9](../src/components/ProductInfoCards.tsx#L9) |
| A34 | Content | **`CLAUDE.md`'s catalogue table no longer matches `products.ts`** — the context file every AI-assisted change is based on has the wrong prices. Documented: Whole Leaf `Basic ₹1,000 · Classic ₹600 · Premium ₹600`, Broken Leaf ₹700, Broken Mixed ₹300, Fannings ₹200, and "quality tiers" on Whole Leaf only. Actual: Whole Leaf `600/600/1000`, and Broken Leaf (`500/600/700`), Broken Mixed (`150/300`) and Fannings (`100/200`) all carry tiers too. | `CLAUDE.md` vs [products.ts:76-206](../src/data/products.ts#L76-L206) |
| A35 | Robustness | **`revalidateCart` throws on a non-array cart.** `safeParse` only catches JSON *syntax* errors, so `elegant_sip_cart` set to `{"a":1}` parses fine and then `for (const item of stored)` throws "not iterable" — inside the `useState` initialiser, so the whole tree fails to mount, and the crash survives reload. Same class as A6 but on the cart, which A6's wording excludes. With no error boundary (C13) the result is a permanent white screen. | [CartContext.tsx:57-60,83-85](../src/components/CartContext.tsx#L57-L60) |

### 3.3 LOW

| # | Area | Finding | Where |
|---|---|---|---|
| L1 | Content | Stale comment lists Green/White/Needle/Herbal categories that don't exist. | [ProductsSection.tsx:8-10](../src/components/ProductsSection.tsx#L8-L10) |
| L2 | Content | Quiz: "Fresh & grassy" maps to Fannings ("Chai-ready"); two answers map to the same product. | [content.ts:255-261](../src/data/content.ts#L255-L261) |
| L3 | Content | All four testimonials are 5-star with identical tone. PayPal/Apple Pay badges on an INR/GST-only checkout. | [content.ts:88-117](../src/data/content.ts#L88-L117), [Footer.tsx:96](../src/components/Footer.tsx#L96) |
| L4 | Content | "Limited · N packs" reads from static `stock: 20` never decremented — presented as live inventory, and it sums tiers, so Whole Leaf advertises "Limited · 60 packs". The detail page's "Only N left" line is gated on `stock <= 5` while every variant is hardcoded to 20, so **that branch never renders today** — it becomes a live inventory claim the moment stock is edited. | [ProductCard.tsx:95-99](../src/components/ProductCard.tsx#L95-L99), [ProductDetailPage.tsx:213-217](../src/components/ProductDetailPage.tsx#L213-L217) |
| L5 | Content | Privacy table omits that order history includes shipping address + postal code. | [PrivacyPage.tsx:4-13](../src/components/legal/PrivacyPage.tsx#L4-L13) |
| L6 | Commerce | Coupon lookup is an unguarded object key; `variants[0]` migration fallback drops items with other in-stock tiers; cart shrinks silently on re-validation. | [CartContext.tsx:64,153](../src/components/CartContext.tsx#L64) |
| L7 | Commerce | Card regex rejects 13/14/19-digit PANs, no Luhn, expiry accepts month 00–99; no `autoComplete="off"` so browsers offer to save a demo card. | [CheckoutPage.tsx:72-75](../src/components/CheckoutPage.tsx#L72-L75) |
| L8 | Commerce | `contact_submitted` fires when the mail client opens, not when sent; "Almost there" shown even if no mail client exists. | [ContactPage.tsx:41-47](../src/components/ContactPage.tsx#L41-L47) |
| L9 | Commerce | No cross-tab `storage` sync; `saveOrder` read-modify-write can drop an order. `AuthContext` writes `"null"` for every logged-out visitor. | [orders.ts:50](../src/lib/orders.ts#L50), [AuthContext.tsx:30-32](../src/components/AuthContext.tsx#L30-L32) |
| L10 | Commerce | `price-asc` sorts the two ₹0 coming-soon teas first. "Secure Checkout" pill on the cart page is unqualified. | [ProductsSection.tsx:48](../src/components/ProductsSection.tsx#L48), [CartPage.tsx:48](../src/components/CartPage.tsx#L48) |
| L11 | Commerce | `videoLoading.ts` progress is never reset (`markVideoFailed` pins it at 1); `formatINR(NaN)` renders "₹NaN"; `variant!` assertion on empty-variant products. | [videoLoading.ts:7](../src/lib/videoLoading.ts#L7), [currency.ts:7-11](../src/lib/currency.ts#L7-L11), [ProductDetailPage.tsx:99](../src/components/ProductDetailPage.tsx#L99) |
| L12 | SEO | Alt text: `alt=""` on all four editorial pillar images and garden thumbnails; "Ember Charm Tea Canister" duplicated; four products share `/origin.webp`; `LoadingOverlay` renders an `<h1>` that is the desktop home's only `<h1>` — and it unmounts when the loader clears (see C12). | [ThreePillarsSection.tsx:41,59](../src/components/ThreePillarsSection.tsx#L41), [GardensPage.tsx:75](../src/components/GardensPage.tsx#L75), [LoadingOverlay.tsx:18](../src/components/LoadingOverlay.tsx#L18) |
| L13 | SEO | RSS `<link>`s use hash fragments and the feed has no `<lastBuildDate>`, so readers cannot judge staleness; `ProductsSection` has no heading element on the shop page (`showHeading` false). | [rss.xml](../public/rss.xml), [ProductsSection.tsx:55](../src/components/ProductsSection.tsx#L55) |
| L14 | Perf | Loader polls at 150 ms re-rendering the app shell; `CartContext` value rebuilt every render; three localStorage writes on mount; uncleared `setTimeout`s in card/quiz/detail; redundant `gsap.set` in `useScrollReveal`. | [TeaVectorHomepage.tsx:76-89](../src/components/TeaVectorHomepage.tsx#L76-L89), [CartContext.tsx:93-103,167-185](../src/components/CartContext.tsx#L93-L103) |
| L15 | Perf | `SkeletonImage` holds `opacity-0` until React observes load, delaying even `fetchPriority="high"` LCP images. | [SkeletonImage.tsx:26-36](../src/components/SkeletonImage.tsx#L26-L36) |
| L16 | A11y | Quiz auto-advances on an 1,800 ms timer with no pause (WCAG 2.2.1); `aria-live` container inserted with its content (never announces); result silent. | [TeaDiscoveryQuizModal.tsx:60-65,134](../src/components/TeaDiscoveryQuizModal.tsx#L60-L65) |
| L17 | A11y | Checkout stepper lacks `aria-current="step"`; empty cart shows a pinging "notification" dot; `.no-scrollbar` removes the only overflow cue on scrollable regions; horizontal product scroller has no label/`tabIndex`. | [CheckoutPage.tsx:143-158](../src/components/CheckoutPage.tsx#L143-L158), [SiteHeader.tsx:172](../src/components/SiteHeader.tsx#L172), [index.css:169-178](../src/index.css#L169-L178) |
| L18 | A11y | Dialogs use `aria-label` while a real heading exists (`aria-labelledby` would carry the count); `SelectDropdown` options are focusable buttons competing with `aria-activedescendant`. | [CartDrawer.tsx:52-62](../src/components/CartDrawer.tsx#L52-L62), [SelectDropdown.tsx:118-136](../src/components/SelectDropdown.tsx#L118-L136) |
| L19 | Code | Star SVG path duplicated in three components; `ProductCard.tsx` is 317 lines and does six jobs; `vite.config.ts` not type-checked; Canada regex admits the letters Canada Post never uses (D/F/I/O/Q/U), India's `^\d{6}$` accepts `000000`. | `ProductCard.tsx`, `ProductReviews.tsx`, `TestimonialsSection.tsx`, [checkoutData.ts:7-14](../src/components/checkout/checkoutData.ts#L7-L14) |
| L20 | UX | `product.longDescription` is rendered unguarded, so the five products without one get an empty `<p className="… mb-8">` — a 2 rem hole between the description and the size picker. | [ProductDetailPage.tsx:176](../src/components/ProductDetailPage.tsx#L176) |
| L21 | Commerce | "You May Also Love" slices from all of `PRODUCTS` with no `status` filter, so related-product rails recommend the two coming-soon teas. | [ProductDetailPage.tsx:95-98](../src/components/ProductDetailPage.tsx#L95-L98) |
| L22 | UX | `SkeletonImage` has no `onError` path: a missing file leaves the shimmer animating forever over an `opacity-0` `<img>`, with no broken-image affordance and no way for the user to tell it will never load. | [SkeletonImage.tsx:26-42](../src/components/SkeletonImage.tsx#L26-L42) |
| L23 | Perf | `ProductCard` calls `getLocalReviews()` in its render body, so every render `JSON.parse`s the entire review store from localStorage — six synchronous parses per shop-page render pass, plus three more per detail page from the related rail. | [ProductCard.tsx:27](../src/components/ProductCard.tsx#L27), [localReviews.ts:13-19](../src/lib/localReviews.ts#L13-L19) |
| L24 | SEO | The shop page's 303 KB hero image carries `alt=""` — declared decorative at the top of the primary commercial page, forfeiting the strongest available "Darjeeling" alt-text slot (see SEO plan item 14). | [ShopPage.tsx:24-25](../src/components/ShopPage.tsx#L24-L25) |
| L25 | SEO | `robots.txt` is `Allow: /` with no `Disallow` for `/cart`, `/checkout`, `/account`, `/order` or `/wishlist` — the counterpart to A17's missing `noindex`. Harmless only because C9 means none of them are separately crawlable yet; it becomes live the moment history routing lands. | [robots.txt](../public/robots.txt) |

---

## 4. SEO improvement plan

Ordered by impact. Tier 1 is prerequisite for everything else — without it, Google indexes exactly one page.

### Tier 1 — structural (do these or nothing else matters)
1. **Move to history routing + prerendering.** Rewrite `router.tsx` to use `location.pathname` / `pushState` / `popstate`; make `Link` render real paths. Add `vite-plugin-prerender` (or `vite-ssg`) to emit static HTML for `/`, `/shop`, every `/product/:id`, `/journal/:id`, `/about`, `/gardens`, `/brewing`, `/faq`, `/contact`, legal pages, each with its own title, description, canonical and inlined JSON-LD. Serve with an SPA fallback rewrite. *Interim:* prerender at least `/`, `/shop` and the four product pages as static files.
2. **Generate `sitemap.xml` at build time** from `PRODUCTS` and `JOURNAL` with real path URLs and `<lastmod>`, so it can never drift from the catalogue again.
3. **Add a `useCanonical(url)` hook** in `router.tsx` (same pattern as `useDocumentMeta`) and call it on every page.
4. **Give the desktop home an `<h1>`.** Add an `as` prop to `ScrollExpand`'s title and pass `as="h1"` — or render a visually-hidden `<h1>Single-Origin Darjeeling Tea — Elegant Sip</h1>`.

### Tier 2 — metadata quality (high ROI, low effort)
5. **Fix the stripped separators** and standardise on `Page | Elegant Sip` (two words) in `index.html`, `rss.xml` and all 20 `useDocumentMeta` calls.
6. **Enrich `Product` JSON-LD:** add `brand: {name: 'Elegant Sip'}`, a `sku` field on the `Product` interface, absolute `image` URL, `aggregateRating` + `review` (the rating is already computed on the page), per-offer `url`, `itemCondition: NewCondition`, `shippingDetails`, `hasMerchantReturnPolicy`; wrap variants in `AggregateOffer`.
7. **Extend `useDocumentMeta`** to accept `image`/`url`/`noindex`, mirror into `og:url`, `og:image`, `twitter:*`, and fall back to `index.html` defaults when called with `undefined`. Add it to the home route.
8. **`noindex, follow`** on cart, checkout, account, order, wishlist and the 404 page.
9. **Stabilise `useJsonLd`** — depend on `JSON.stringify(data)` or `useMemo` at call sites.

### Tier 3 — structured data & content
10. **`BreadcrumbList`** on product and article pages (parameterise the script id or emit a `@graph`).
11. **`ItemList`/`CollectionPage`** on `/shop`; **`Blog`** on `/journal`; **`HowTo`** on `/brewing` — `BrewingGuide {temperature, time, steeps, leafAmount}` maps almost 1:1 onto `HowToStep`.
12. **`Organization`:** add `logo`, `address`, `telephone`, the WhatsApp `wa.me` link in `sameAs`; consider `OnlineStore`/`LocalBusiness`. Drop the deprecated `SearchAction`.
13. **Fix the content contradictions (C1–C5)** — a shop meta description selling oolong to a Darjeeling-only catalogue is a relevance signal working against you. Rewrite `GARDENS` around the real Darjeeling estate(s) (the About alt already names Gopal Dhara) and populate `productIds` so `/gardens` links into the shop.
14. **Keyword targeting:** "Darjeeling" appears in only one alt text. Put "Darjeeling first flush", "Darjeeling whole leaf tea", "buy Darjeeling tea online India" into titles, H1s, product alt text ("First Flush Whole Leaf Darjeeling black tea, loose leaves") and the journal. Add `/gardens` and `/brewing` to the primary nav.
15. **Dedicated 1200×630 `og-image.webp`** (<200 KB) with `og:image:width/height/alt`; distinct photography for the four products currently sharing `/origin.webp`.

### Tier 4 — Core Web Vitals (ranking factor)
16. **Re-encode `video.mp4` to ≤2 MB** for the scrub track (it doesn't need master quality) and ship an AV1/WebM `<source>`; lower the loader gate from "fully buffered" to ~15 % buffered — the buffered-clamp logic already handles a trailing playhead.
17. **`srcset`/`sizes`** for `hero.webp` and the showcase images (640/1024/1920); convert `gopal.jpg` to WebP.
18. **Preload the LCP poster** in `index.html` (`<link rel="preload" as="image" href="/poster.webp" media="(min-width:1024px)">` and the mobile poster for `<1024px`).
19. **Self-host subsetted fonts** with narrowed weight axes and `font-display: swap`; or at minimum load Google Fonts non-blocking.
20. **`manualChunks`** in `vite.config.ts` (react / gsap+lenis) for cache stability; lazy-load `MobileHome` and `HeroScrollSection` so each visitor downloads one home variant.
21. **`width`/`height` + `loading="lazy"`** on the 19 bare `<img>` tags; render the site header always (loader overlays it) so nav links exist at t=0.

---

## 5. Recommended fix order

**Week 1 — one-liners and legal**
- C6 (drop `email` prop), C7 (`if (!user) return`), C14 (skip link → `focus()`), C16 (`gsap.ticker.remove`), C19 (`inert={!isOpen}`), C18 (remove `focus:outline-none` or add `focus-visible` styles), A4 (no fake 5 stars), A9 (wishlist coming-soon), A8 (order number suffix), A35 (`Array.isArray` guard in `revalidateCart`).
- Decide the single source of truth for shipping region and returns; reconcile Terms, FAQ, Shipping page, trust badges, product page (C3, C4). Decide launch posture and remove either the demo language or the payment badges (C5). **Delete the duties claim outright (C24)** — it cannot be made true without a backend, so the only honest fix is to stop promising it.
- Rewrite `GARDENS`, FAQ 168/174, shop/gardens meta, About timeline, canister alts (C1, C2, A1). Correct the `CLAUDE.md` price table in the same pass (A34) — every later AI-assisted change reads it.

**Week 2 — SEO structure**
- History routing + prerender + generated sitemap + canonical hook + desktop `<h1>` (C9–C12). Separator cleanup (A3). `Product` JSON-LD enrichment (A14). `noindex` on transactional routes (A17).

**Week 3 — performance & a11y**
- Video re-encode + loader gate + `srcset` + preload + fonts + `manualChunks` (C15, C17, A20–A23). Error boundary (C13). Dialog focus hook shared by login/quiz/drawer/menu/consent (C20). Checkout `<form>` + `aria-invalid` + `autoComplete` + focus-to-error (C21, A27). Accent text token ≥4.5:1 and 11 px minimum text (C22, C23).

**Week 4 — hygiene**
- Delete `Generator.tsx` / `teaPlantVectorData.ts` / `save_frames.js`; `git rm --cached dist`; add ESLint, Vitest (first tests on `getOrderPricing` and `revalidateCart`), `.env.example`; rewrite README; unify rating logic and fix "Top Rated" (A5, A31); wishlist/coupon/review shape guards (A6, A12); remaining LOW items.

**Also needs a decision, not just a fix**
- **A32/A33 — populate `origin` and `flavorProfile`, or delete them.** Right now the product page renders a lone Brewing Guide card in a three-column grid, and two whole card designs plus the garden cross-link exist only in code. Filling in real Darjeeling estate data completes the "garden is the brand" story and folds into the C1 rewrite; deleting the fields is a smaller, honest alternative. Either is fine — leaving it half-wired is not.

---

## 6. Verification log

Every finding above was re-read against `99c962f` (three commits past the `a9dca52` the first draft cited; the intervening diff touches 12 files, +193/−32, mostly `BlurText`/`FaqPage`/`StatsGridSection`). Bundle numbers come from a real `npm run build`. Findings survived except where noted.

**Corrected**

| # | Was | Actually |
|---|---|---|
| — | "14 critical · 31 average · 34 low" | Tables held 23 · 31 · 19; now 24 · 35 · 25 |
| C10 | "16 fragment URLs" | 17 fragments of 18 `<url>` entries |
| A22 | "Empty `vite.config.ts`" | Not empty — has `react` + `tailwindcss`; the gap is `manualChunks` |
| A25 | "~20 `<img>` without `width`/`height`"; "`loading="lazy"` on 12 of ~34" | 19 of 20 lack dimensions; lazy on 11 of 27 image elements |
| A30, L12 | Gallery dots listed as a live touch-target defect | Unreachable — needs `product.images`, which no product sets |
| L4 | "Only N left" listed as live | Gated on `stock <= 5`; all stock is 20, so it never renders today |
| Pros | "18 lazy chunks (1.4–18.6 KB); 445 KB / 145 KB gzip" | 19 chunks (0.36–19.02 KB); 445.71 KB / 144.91 KB gzip |
| Pros | "~7,900 lines" | 8,867 lines in `src/` |
| L19 | "Canada/India postal regexes are loose" | True, now stated precisely (D/F/I/O/Q/U; `000000`) |

**Withdrawn**

- **L13, "duplicate `<h1>` branches on Contact/Account"** — not a defect. `ContactPage.tsx:59`/`:89` and `AccountPage.tsx:21`/`:42` are mutually exclusive render branches (success vs. form, signed-out vs. signed-in); only one `<h1>` is ever in the DOM. The RSS and `ProductsSection` clauses of L13 stand.
- A candidate finding on `addLocalReview` not clamping `rating` was dropped: the only writer is a controlled form fixed at 1–5, so the tampering path is already A12 and does not warrant a separate entry.

**Spot-checks that came back exact** — 16× `focus:outline-none` (C18); 0 `srcset`/`<picture>` (C17); 0 `autoComplete`, 0 `aria-invalid` (C21, A27); 35 `hidden`/`lg:hidden` pairs (A25); `#8bb56e` on `#f9faf7` computes to **2.24:1** (C22, audit said 2.25:1); `gopal.jpg` is 389 KB (A25); 0 `dangerouslySetInnerHTML`, 0 `any`, 0 `@ts-ignore`, 0 `console.log`, 0 TODO (Pros); `inert` present on hidden nav (Pros); buffered-clamped proxy seek present at `HomeExperience.tsx:63-70` exactly as cited (Pros); `dist/index.html` confirmed dirtied by a build (A31).

**Not re-verified in this pass** — the claims that need a browser or a device rather than a file read: actual LCP/CLS timings, the "~12 s blank screen on 5 Mbps" estimate in C15, the 25 s loader cap in practice, screen-reader behaviour, and real-device scroll-video smoothness. Treat those as reasoned estimates from the code, not measurements.

---

*First drafted from a full read at `a9dca52`; re-verified line-by-line and completed at `99c962f`, 24 Aug 2026.*

---

## 7. Resolution — remediation pass

All 84 findings were worked through in a single pass on 24 Aug 2026. Verified by
`npm run build` (clean), `npm test` (16 passing), `npx eslint .` (0 errors), and
a Playwright run driving the live app across all 14 routes (0 console errors).

### Structural changes

| Change | Replaces |
|---|---|
| **History router** — `src/lib/router.tsx` rewritten to `pushState`/`popstate`; `Link` renders a real `<a href="/shop">` and intercepts only plain left-clicks. `migrateLegacyHashUrl()` redirects old `/#/shop` links on boot. | C9 |
| **Build-time prerendering** — `seoPlugin` in `vite.config.ts` writes one static HTML shell per route with its own title, description, canonical and OG tags. 20 shells emitted. | C9, C11 |
| **Generated `sitemap.xml` + `robots.txt`** from the live catalogue, with `<lastmod>` and `Disallow` for transactional routes. | C10, L25 |
| **`src/lib/seoRoutes.ts`** — one metadata manifest read by both the pages and the build, so a title can never drift from its sitemap entry again. | A15, A3, C2 |
| **SPA fallback configs** — `public/.htaccess` (Apache/XAMPP) and `public/_redirects` (Netlify). | required by C9 |
| **`src/lib/site.ts`** — canonical origin, brand strings and title builder in one place. | A3 |

### Policy decisions taken (owner-confirmed)

- **Returns:** the 30-day Elegant Sip Promise is now written into Terms §6 as a
  binding commitment, matching what the marketing already said. (C4)
- **Posture:** honest demo. Payment-network badges removed from the footer;
  "ships in 24 h" softened to "packed to order". (C5)
- **Shipping region:** left deliberately uncommitted. Terms, FAQ, the Shipping
  page and the checkout country list now all say the same thing — India today,
  international by arrangement via WhatsApp — instead of contradicting each
  other. The duties promise was deleted outright: no backend can compute it. (C3, C24)

### Notable non-obvious fixes

- **Contrast:** `#8bb56e` measured 2.24:1 on paper. Introduced `#4a7333`
  (5.29:1) for accent text on light and `#a8cf8a` for accent text on dark; 118
  occurrences swapped by background context, not blindly. (C22)
- **Product data populated** rather than deleted — every product now carries
  `origin` and `flavorProfile`, so the garden cross-link resolves in both
  directions and the info grid renders three cards instead of one. (A32, A33)
- **`useMediaQuery` rewritten** to `useSyncExternalStore`, removing an extra
  render on every consumer — it gates which home variant loads. (surfaced by the new ESLint config)
- **`useDialog` hook** now provides focus trap, focus restoration, Escape and
  scroll lock to every modal. (C20)

### Measured results

| Metric | Before | After |
|---|---|---|
| Indexable URLs | 1 | **20** |
| App entry chunk | 445.71 KB | **79.01 KB** (react 184.54 / animation 141.28 split out) |
| `public/` payload | 13.8 MB | **9.6 MB** |
| Desktop scrub video | 7.3 MB | **3.1 MB** (still all-intra — verified every frame is `I`) |
| Hero image to phones | 1,008 KB | **73 KB** (`srcset` 640/1024/1920) |
| Loader gate | fully buffered, 25 s cap | **15% buffered, 10 s cap** |
| Tests | 0 | **16** |
| ESLint | none | configured, **0 errors** |

### Deliberately not done

- **11 ESLint warnings** remain (`react-hooks/set-state-in-effect` ×8, `refs`,
  `purity`). These are correct "reset derived state when a prop changes"
  effects; the rules are set to `warn` with a comment explaining why, rather
  than being disabled or force-refactored.
- **Testimonials are still placeholders.** Ratings were varied and a note added
  in `data/content.ts`, but inventing customer quotes would break the honesty
  rule — these need real attributable quotes or deletion before launch.
- **Garden attributions need confirming.** The Gopaldhara/Rohini profiles are
  accurate about the region, elevation band and flush calendar, but the specific
  estate relationships must be checked against real purchase records.
- **Stock remains static.** `stock: 20` is never decremented, so scarcity copy
  was made vague ("Limited lot") rather than quoting a number the site cannot back.

*Remediation completed 24 Aug 2026.*
