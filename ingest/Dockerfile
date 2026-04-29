# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the oro-ingest worker service.
#
# Stage 1 (deps) installs production npm dependencies on a full Debian image
# that ships the toolchain a few transitive native modules sometimes fall
# back to.
# Stage 2 (runtime) carries only a Node 22 runtime, ca-certs, tini, the
# resolved node_modules, and the source tree.
#
# The service is run with @babel/node, so the source is shipped as-is —
# import/flow syntax is transpiled on demand at startup. This mirrors the
# dev workflow (see package.json `dev-start`).
#
# Build context: ingest/
# The shared files under src/shared/ are copied from app/ by
# ingest/import.sh BEFORE the build context is sent to Docker (see
# scripts/build-ingest-image.sh).
#
# Build:    docker build -f ingest/Dockerfile -t oro-ingest:<tag> ingest
# Wrapper:  scripts/build-ingest-image.sh

# -----------------------------------------------------------------------------
# Stage 1: deps
# -----------------------------------------------------------------------------
FROM node:22-bookworm AS deps

# Switch to the unprivileged `node` user BEFORE WORKDIR so /home/node/src is
# created node-owned. Otherwise WORKDIR runs as root, --chown only fixes the
# copied files, and `npm ci` later can't mkdir node_modules. The bookworm
# (full) base already provides python3/g++/make for any node-gyp fallback
# path.
USER node
WORKDIR /home/node/src

COPY --chown=node:node package.json package-lock.json ./

RUN npm ci --omit=dev

# -----------------------------------------------------------------------------
# Stage 2: runtime
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# tini  → PID 1, forwards signals to Node so docker stop / pod termination
#         is fast and graceful (main.js installs SIGTERM handlers).
# ca-certificates → TLS to MongoDB Atlas, the peer (oro-app) service, and
#                   external MQTT brokers.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps --chown=1000:1000 /home/node/src/node_modules ./node_modules
COPY --chown=1000:1000 package.json package-lock.json .babelrc ./
COPY --chown=1000:1000 src ./src

# Numeric UID so Kubernetes' runAsNonRoot can verify it without launching the
# container. 1000:1000 is the `node` user/group from the base image.
USER 1000:1000

ENV NODE_ENV=production \
    NODE_PRESERVE_SYMLINKS=1

# settings.json is read at startup from `<__dirname>/../settings.json` — i.e.
# /app/settings.json. The k8s deployment mounts the oro-ingest-config Secret
# there. There is no inbound listener, hence no EXPOSE and no HEALTHCHECK:
# crash-loop on init failure is the readiness signal.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node_modules/.bin/babel-node", "src/main.js"]
