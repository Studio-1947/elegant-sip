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

| | |
|---|---|
| Server | `deploy@187.127.185.82` (Ubuntu). Never deploy as `root`. |
| App directory | `/var/www/elegant-sip` |
| Compose file | `docker-compose.prod.yml` (project `elegantsip-prod`) |
| Public ports | 80 and 443 (Caddy only). Postgres, Redis and the API publish nothing. |

Every command below runs **on the VPS** unless marked otherwise. To save
typing, set this alias once (step 5 adds it to `~/.bashrc`):

```bash
alias dc='docker compose -f /var/www/elegant-sip/docker-compose.prod.yml --project-directory /var/www/elegant-sip'
```

#### 1. One-time: create the `deploy` user

Only this step uses `root`, with the login from the Hostinger panel:

```bash
ssh root@187.127.185.82

adduser deploy                      # choose a strong password
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys   # reuse your SSH key
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
exit
```

From now on, sign in as `deploy`:

```bash
ssh deploy@187.127.185.82
```

#### 2. One-time: install Docker and the firewall

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
exit                                # sign out and back in so the docker group applies
```

```bash
ssh deploy@187.127.185.82
docker --version && docker compose version

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable             # --force skips the y/n prompt; SSH is already allowed
sudo ufw status
```

Also allow only 22, 80 and 443 in the Hostinger panel firewall. Never open 5432,
6379 or 4000.

#### 3. One-time: give the server read access to GitHub

The repository is private, so the server needs a read-only deploy key:

```bash
ssh-keygen -t ed25519 -C "elegant-sip-vps" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

Add the printed public key in GitHub → `Studio-1947/elegant-sip` → Settings →
Deploy keys → *Add deploy key*, with write access **off**. Then:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
ssh -T git@github.com               # expect: "successfully authenticated"

sudo mkdir -p /var/www/elegant-sip
sudo chown deploy:deploy /var/www/elegant-sip
git clone git@github.com:Studio-1947/elegant-sip.git /var/www/elegant-sip
cd /var/www/elegant-sip
```

#### 4. One-time: write the production `.env`

```bash
cd /var/www/elegant-sip
cp .env.prod.example .env
chmod 600 .env

# Print fresh secrets to paste into .env:
echo "POSTGRES_PASSWORD=$(openssl rand -hex 30)"
echo "SHIPROCKET_WEBHOOK_TOKEN=$(openssl rand -hex 24)"

nano .env
```

What to fill in (each one is explained inside `.env.prod.example`):

| Setting | Value |
|---|---|
| `POSTGRES_PASSWORD` | the generated hex value |
| `SITE_ADDRESS` / `SITE_URL` | `elegantsip.in` / `https://elegantsip.in` once DNS points here. Before that: blank / `http://187.127.185.82` |
| `SMTP_URL`, `MAIL_FROM` | real mail settings, or blank to send nothing |
| `PAYMENT_PROVIDER` | `disabled` until Razorpay is ready, then `razorpay` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | from the Razorpay dashboard; use **live** keys (`rzp_live_…`) for real sales |
| `SHIPPING_PROVIDER` | `manual`, or `shiprocket` when the values below are set |
| `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` | the Shiprocket **API user**, not the dashboard login |
| `SHIPROCKET_PICKUP_LOCATION`, `SHIPROCKET_PICKUP_POSTCODE` | pickup address nickname exactly as in Shiprocket, and its pincode |
| `SHIPROCKET_WEBHOOK_TOKEN` | the generated hex value |
| `SELLER_GSTIN` | your GSTIN, or invoices are marked provisional |

The API refuses to start if a provider is switched on without all of its
settings. That is deliberate: the logs name what is missing.

#### 5. First start

Check that the DNS A record points here before setting `SITE_ADDRESS`, or Caddy
cannot get a certificate:

```bash
dig +short elegantsip.in            # must print 187.127.185.82

cd /var/www/elegant-sip
echo "alias dc='docker compose -f /var/www/elegant-sip/docker-compose.prod.yml --project-directory /var/www/elegant-sip'" >> ~/.bashrc
source ~/.bashrc

dc config -q                        # validates .env; silent means OK
dc up -d --build                    # first build takes a few minutes
dc ps                               # every service "running" / "healthy"
dc logs -f api                      # Ctrl+C to stop following
```

Migrations and the catalogue seed run automatically when the API starts
(`MIGRATE_ON_START`).

#### 6. Check it works

```bash
curl -fsS https://elegantsip.in/api/health          # {"status":"ok",...}
curl -fsS https://elegantsip.in/api/v1/products | head -c 200
curl -fsS https://elegantsip.in/api/storefront-status   # paymentsAvailable true once Razorpay is set
curl -sI https://elegantsip.in | head -n 1           # HTTP/2 200
```

Before DNS is ready, use `http://187.127.185.82/...` instead. Swagger
(`/api/docs`) stays off unless `API_DOCS_ENABLED=true`; turn it on only briefly.

#### 7. Make a staff (admin) account

Register on the site first, then:

```bash
dc exec postgres psql -U elegantsip -d elegantsip \
  -c "update users set role = 'admin' where email = 'you@example.com';"
```

Sign out and back in; the **Admin** link appears in the header.

#### 8. Connect the webhooks

| Service | Where | URL | Secret |
|---|---|---|---|
| Razorpay | Dashboard → Settings → Webhooks | `https://elegantsip.in/api/v1/webhooks/razorpay` | `RAZORPAY_WEBHOOK_SECRET`; events `payment.captured`, `payment.failed` |
| Shiprocket | Settings → API → Webhooks | `https://elegantsip.in/api/v1/webhooks/courier` | `SHIPROCKET_WEBHOOK_TOKEN` as the token |

Shiprocket rejects webhook URLs containing "shiprocket", "kartrocket", "sr" or
"kr", which is why the path is `/courier`.

#### Deploy an update

Pushing to `main` deploys automatically once CI passes (see *Automatic GitHub
Actions deployment* below). To deploy by hand:

```bash
cd /var/www/elegant-sip
git fetch --prune origin main
git checkout --detach origin/main
dc build --pull                     # --pull: fresh base images (security patches)
dc up -d
dc ps
curl -fsS https://elegantsip.in/api/health
docker image prune -f               # reclaim space from old builds
```

After changing `.env` only, no rebuild is needed: `dc up -d`. Containers are
recreated with the new values.

#### Roll back

The automatic deploy rolls itself back when a release never answers `/ready`
(see *Automatic GitHub Actions deployment*). To go back by hand:

```bash
cd /var/www/elegant-sip
git log --oneline -10 origin/main   # pick the last good commit
git checkout --detach <commit>
dc up -d --build
```

Migrations only move forward. They are additive, so older code runs against a
newer schema, but take a backup first if a release contains a migration.

#### Everyday commands

```bash
dc ps                               # status
dc logs -f --tail=200 api           # API logs (also: web, postgres, backup)
dc restart api                      # restart one service
dc down                             # stop everything (data is kept in volumes)
dc up -d                            # start again
dc exec postgres psql -U elegantsip -d elegantsip   # SQL shell (\q to quit)
df -h && docker system df           # disk usage
```

Never run `dc down -v`: `-v` deletes the database volume.

The database commands assume the default `POSTGRES_USER` and `POSTGRES_DB` of
`elegantsip`; substitute yours if you changed them in `.env`.

#### Backups and restore

A dump is taken nightly at 02:30 (`BACKUP_TIMEZONE`, default Asia/Kolkata) into
`/var/www/elegant-sip/backups`, keeping 14. Copy them off the server regularly
and keep the folder owner-only (`chmod 700 backups`).

```bash
ls -lh /var/www/elegant-sip/backups
cat /var/www/elegant-sip/backups/last-error.log 2>/dev/null   # exists only if the last run failed

# Backup right now (do this before risky changes):
dc exec -T postgres pg_dump -U elegantsip -d elegantsip --no-owner --format=custom \
  > backups/manual-$(date +%F-%H%M).dump

# Download to your computer (run on YOUR machine):
scp deploy@187.127.185.82:/var/www/elegant-sip/backups/<file>.dump .
```

Restore replaces the live data, so stop the API first:

```bash
dc stop api
dc exec -T postgres pg_restore -U elegantsip -d elegantsip --clean --if-exists --no-owner \
  < backups/<file>.dump
dc start api
```

#### Product catalogue changes

Shop pages read the committed snapshot `apps/web/src/data/catalogue.json`, not
the live API. After changing products or prices in the database, refresh it on
your own machine, commit, and deploy:

```bash
# On your machine, with VITE_API_URL pointing at the production API:
VITE_API_URL=https://elegantsip.in/api npm run catalogue:sync
git add apps/web/src/data/catalogue.json && git commit -m "chore: sync catalogue"
git push
```

Checkout always re-prices on the server, so a stale snapshot never charges a
wrong price. It can only show a stale price or stock badge.

### Sharing the VPS with other projects

When the server already runs a reverse proxy for other sites, that proxy keeps
80 and 443 and this stack sits behind it. In `.env`:

```
SITE_ADDRESS=
SITE_URL=https://elegantsip.in
WEB_PUBLISH_HTTP=127.0.0.1:8080
WEB_PUBLISH_HTTPS=127.0.0.1:8443
```

Caddy then serves plain HTTP on loopback only, and the existing proxy
terminates TLS and forwards to `http://127.0.0.1:8080`. `SITE_ADDRESS` and
`SITE_URL` disagree here on purpose: `SITE_URL` describes what the browser
sees, so sign-in cookies are still marked `Secure`, while the empty
`SITE_ADDRESS` stops Caddy asking for a certificate it cannot validate.

Nothing else changes. The compose project is named `elegantsip-prod`, so its
containers, network and volumes never collide with another project's, and
Postgres, Redis and the API still publish no ports at all.

#### Which proxy Caddy trusts (`CADDY_TRUSTED_PROXIES`)

The API rate-limits per visitor, and gets the visitor's address from Caddy.
Caddy accepts an `X-Forwarded-For` header only from addresses listed in
`CADDY_TRUSTED_PROXIES`, so set it to match the topology:

| How traffic reaches Caddy | `.env` line |
|---|---|
| Host nginx in front (`WEB_PUBLISH_HTTP=127.0.0.1:8080`) | `CADDY_TRUSTED_PROXIES=172.16.0.0/12` — nginx's requests arrive from the Docker bridge gateway. nginx must send `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` |
| Caddy directly on 80/443 (no other proxy) | `CADDY_TRUSTED_PROXIES=` (present and empty: trust nobody) |
| Not set at all | `private_ranges` — the historical default; correct behind nginx, but when Caddy faces the internet it lets anyone whose traffic Docker relays from its gateway (e.g. IPv6) pick their own address and dodge the rate limits |

Confirm the Docker network sits inside `172.16.0.0/12` with
`docker network inspect elegantsip-prod_default -f '{{(index .IPAM.Config 0).Subnet}}'`.
Only an empty value, CIDRs/IPs separated by spaces, or `private_ranges` are
accepted; anything else (the word `none` included) stops Caddy from starting.
Apply with `dc up -d web`, then repeat the `?probe-me` check from
`docs/GAPS-2026-11-08.md` to see your phone's real address in the API log.

#### Security headers and the CSP

Caddy adds the security headers to every storefront response, including a
`Content-Security-Policy-Report-Only` header: browsers block nothing, they only
report what the policy *would* have blocked to `/api/v1/csp-report`. The
`Caddyfile` lists why each allowed origin is there. Once a week of reports is
clean, rename the header to `Content-Security-Policy` to enforce it. Adding a
new third-party script (a GTM tag, a chat widget, Google Ads) means adding its
origins there first, or it will be blocked once the policy is enforced.

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

Each run, on the server: records the live commit, takes a pre-deploy database
dump into `backups/predeploy/` (newest 5 kept), checks out the tested commit,
builds with `--pull` (fresh base images, while the old containers keep
serving; a failed build leaves the site untouched), starts it, and waits up to
150 s for the API's `/ready`. If it never becomes ready, the workflow logs the
API output and **redeploys the previous commit**, waits for `/ready` again,
and still finishes red with `ROLLED BACK` in the log. The rollback replaces
code, not data: if the failed release's migrations had already run, check the
site and, if needed, restore the newest `backups/predeploy/` dump (see
*Backups and restore*).

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
| First Flush Whole Leaf | 100 g ₹600 · 200 g ₹1,200 · 500 g ₹3,000 | Gopaldhara |
| First Flush Broken Leaf | 100 g ₹500 · 200 g ₹1,000 · 500 g ₹2,500 | Gopaldhara |
| First Flush Broken Mixed | 100 g ₹150 · 200 g ₹300 · 500 g ₹750 | Rohini |
| First Flush Fannings | 100 g ₹100 · 200 g ₹200 · 500 g ₹500 | Rohini |
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
