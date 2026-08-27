# syntax=docker/dockerfile:1.7
###############################################################################
# Elegant Sip storefront
#
# Builds the site and ships it inside Caddy, which also fronts the API. Build
# context is the REPO ROOT, since the lockfile and packages/shared live above:
#
#   docker build -f apps/web/Dockerfile -t elegantsip-web .
###############################################################################

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# Irrelevant to the storefront, but npm insists the workspace tree resolves.
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @elegantsip/web --include-workspace-root

# ── build ────────────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /repo
COPY packages/shared packages/shared
COPY apps/web apps/web

# A relative path, on purpose. Vite bakes this into the bundle, so an absolute
# URL would tie the built site to one hostname — and this deployment serves the
# API from the same origin under /api. Relative means the identical build works
# on the server's bare IP today and on a domain tomorrow, over HTTP or HTTPS,
# with nothing to rebuild.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace @elegantsip/web

# ── runtime: Caddy serving the built site and proxying the API ───────────────
FROM caddy:2-alpine AS runtime
COPY --from=build /repo/apps/web/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
