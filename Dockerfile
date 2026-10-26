# syntax=docker/dockerfile:1
#
# Entanglement — production image for Cloud Run.
#
# Multi-stage: install deps → build the standalone Next server → ship a slim
# runtime that boots with `node server.js`. Uses node:24-slim (glibc/Debian)
# rather than alpine on purpose — the SWC/Turbopack native binaries are stable
# on glibc; alpine/musl has bitten this stack before.
#
# NO SECRETS IN HERE. The build needs no Keen config (every page that reads the
# connector is force-dynamic) and .dockerignore keeps every .env* file out of the
# context — Next would otherwise copy `.env` into .next/standalone. On Cloud Run
# the KEEN_* / ELEVENLABS_* values arrive as env vars when an instance starts
# (Secret Manager for the secrets, see cli/deploy.sh).
#
# Cloud Run contract: the container listens on $PORT (Cloud Run injects it,
# default 8080) on 0.0.0.0. Next's standalone server honours PORT + HOSTNAME.

# ---- deps: install node_modules from the lockfile ----------------------------
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce .next/standalone --------------------------------------
FROM node:24-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: the minimal image that actually runs ---------------------------
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run overrides PORT if it wants; 8080 is its default. HOSTNAME must be
# 0.0.0.0 so the server is reachable outside the container.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# The standalone output already contains a pruned node_modules + server.js.
# static/ and public/ are NOT bundled into standalone — copy them explicitly.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
