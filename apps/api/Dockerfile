# syntax=docker/dockerfile:1.7
###############################################################################
# Elegant Sip API
#
# Multi-stage so the shipped image contains no compiler, no dev dependencies
# and no source. Build context is the REPO ROOT, not apps/api, because the
# workspace lockfile and packages/shared both live above it:
#
#   docker build -f apps/api/Dockerfile -t elegantsip-api .
###############################################################################

# ── deps: install once, cached on lockfile changes alone ─────────────────────
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# The web workspace is irrelevant to the API but npm insists the tree resolves.
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace @elegantsip/api --include-workspace-root

# ── build: compile TS, bundling packages/shared into dist ────────────────────
FROM deps AS build
WORKDIR /repo
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @elegantsip/api

# ── dev: the same image, reloading on save ───────────────────────────────────
# Built from `deps`, so the Node version and every installed package match the
# image that ships — the point of developing in a container at all. Only the
# command differs: tsx watching source instead of node running compiled output.
# Compose bind-mounts src over this, so edits on the host restart the server
# without a rebuild.
FROM deps AS dev
ENV NODE_ENV=development
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ── prod-deps: runtime dependencies only ─────────────────────────────────────
FROM node:22-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace @elegantsip/api --include-workspace-root

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
# dumb-init reaps zombies and forwards SIGTERM, so graceful shutdown actually
# reaches the process and in-flight requests are drained.
RUN apk add --no-cache dumb-init

# The workspace layout is preserved rather than flattened to /app. npm hoists
# most packages to the root but nests any that conflict (zod v4 for the API vs
# v3 in the web toolchain), so Node must be able to walk
# apps/api/node_modules → node_modules exactly as it does in development.
WORKDIR /repo/apps/api
COPY --from=prod-deps /repo/node_modules /repo/node_modules
COPY --from=prod-deps /repo/apps/api/node_modules* /repo/apps/api/node_modules/
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY apps/api/package.json ./package.json

# Never run as root.
USER node

EXPOSE 4000

# Liveness only — no dependency checks, so a database blip doesn't cause a
# restart loop. /ready is what a load balancer should poll.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
