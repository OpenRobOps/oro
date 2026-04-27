# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the oro-app Meteor 3.4 web service.
#
# Stage 1 (builder) installs Meteor and produces a self-contained Node bundle.
# Stage 2 (runtime) carries only the bundle plus a Node 22 runtime, ca-certs,
# tini, and curl (used by HEALTHCHECK).
#
# Build context: web/app/
# Build:    docker build -f web/app/Dockerfile -t oro-app:<tag> web/app
# Wrapper:  scripts/build-app-image.sh

# -----------------------------------------------------------------------------
# Stage 1: builder
# -----------------------------------------------------------------------------
FROM node:22-bookworm AS builder

# Pin the Meteor release to match web/app/.meteor/release.
ARG METEOR_RELEASE=3.4
# Architecture for `meteor build`. Override to os.linux.aarch64 for arm64.
ARG METEOR_ARCH=os.linux.x86_64

# Tooling required by Meteor's installer and by native npm modules
# (bufferutil, utf-8-validate). bookworm (full image) already provides curl,
# git, python3, g++, make, tar, bzip2 — kept explicit for clarity.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl git python3 g++ make tar bzip2 \
 && rm -rf /var/lib/apt/lists/*

# Install Meteor as the unprivileged `node` user that the base image provides.
# Meteor must be installed by the same user that will later run `meteor build`,
# otherwise the dev bundle path is wrong.
USER node
ENV PATH=/home/node/.meteor:$PATH
RUN curl -fsSL "https://install.meteor.com/?release=${METEOR_RELEASE}" | sh

WORKDIR /home/node/src

# Copy dependency manifests first so npm install can be cached when only source
# files change. .meteor/ is needed because Meteor matches the npm install
# against the Atmosphere package set.
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node .meteor/ ./.meteor/

RUN meteor npm ci

# Copy the rest of the source tree (filtered by .dockerignore).
COPY --chown=node:node . .

# Produce the Node bundle. --server-only skips Cordova / mobile packaging.
RUN meteor build --directory /home/node/build \
      --server-only \
      --architecture "${METEOR_ARCH}"

# Install the bundle's runtime npm deps. This is the slow step and is cached
# until package versions inside the bundle change.
RUN cd /home/node/build/bundle/programs/server \
 && npm install --omit=dev

# -----------------------------------------------------------------------------
# Stage 2: runtime
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# tini  → PID 1, forwards signals to Node so docker stop is fast.
# curl  → used by HEALTHCHECK below; kept as a runtime dep on purpose.
# ca-certificates → TLS to MongoDB Atlas / OAuth providers / SMTP.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates tini curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder --chown=node:node /home/node/build/bundle ./
COPY --chown=root:root --chmod=0755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER node

ENV NODE_ENV=production \
    PORT=3000 \
    ROOT_URL=http://localhost:3000

EXPOSE 3000

# Meteor serves the HTML shell at / once the server has booted and migrations
# have run. start-period covers first-run migrations + MQTT connect.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "main.js"]
