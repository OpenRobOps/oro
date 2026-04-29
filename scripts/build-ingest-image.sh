#!/usr/bin/env bash
# Copyright 2026 InOrbit, Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Build the oro-ingest container image.
#
# Usage:
#   scripts/build-ingest-image.sh           # tags as oro-ingest:<short-sha>[-dirty]
#   IMAGE_TAG=oro-ingest:v1.2.3 scripts/build-ingest-image.sh
#   IMAGE_TAG=ghcr.io/openrobops/oro-ingest:main scripts/build-ingest-image.sh
#
# Prints the resulting image tag on the final stdout line so callers can
# capture it: TAG="$(scripts/build-ingest-image.sh | tail -1)".
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

SHA="$(git rev-parse --short HEAD)"
DIRTY=""
if ! git diff --quiet || ! git diff --cached --quiet; then
  DIRTY="-dirty"
fi
TAG="${IMAGE_TAG:-oro-ingest:${SHA}${DIRTY}}"

# Populate ingest/src/shared/ from web/app/ before the build context is sent
# to Docker. These files are gitignored inside ingest/ and live in web/app/
# as the source of truth — see ingest/import.sh.
( cd ingest && ./import.sh )

docker build \
  -f ingest/Dockerfile \
  -t "$TAG" \
  ingest

echo "$TAG"
