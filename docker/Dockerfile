# syntax=docker/dockerfile:1
# -----------------------------------------------------------------------------
# ApparelFlow ERP — production image (Next.js standalone server + Prisma).
# Build from the repository root (the build context); the context filter lives
# next to this file in Dockerfile.dockerignore.
#
#   docker build -f docker/Dockerfile -t apparelflow-erp .
#   docker run -p 3000:3000 -e DATABASE_URL=... -e AUTH_SECRET=... apparelflow-erp
#
# Database migrations are not run by the app container. Apply them from the
# deploy pipeline, or with the optional `migrator` target:
#   docker build -f docker/Dockerfile --target migrator -t apparelflow-erp-migrator .
#   docker run --rm -e DATABASE_URL=... -e DIRECT_URL=... apparelflow-erp-migrator
# -----------------------------------------------------------------------------

FROM node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS base
ENV NEXT_TELEMETRY_DISABLED=1
# OpenSSL is required by the Prisma query engine (and its platform detection).
# Package versions are intentionally not pinned: the base image is pinned by digest,
# and pinning Debian versions breaks builds whenever the archive rotates security fixes.
# hadolint ignore=DL3008
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Dependencies (including dev tools needed to build) ----------------------
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# `npm ci` runs the postinstall hook, which generates the Prisma client for this platform.
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# --- Build --------------------------------------------------------------------
FROM deps AS builder
COPY . .
ENV NODE_ENV=production \
    NEXT_OUTPUT=standalone
RUN npm run build

# --- Optional: one-shot migration image ----------------------------------------
FROM deps AS migrator
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# --- Runtime --------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Unprivileged `node` user of the official image, by numeric id (lets runtimes verify non-root).
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server.js"]
