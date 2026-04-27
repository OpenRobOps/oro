#!/usr/bin/env bash
# Copyright 2026 InOrbit, Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Build the oro-app container image.
#
# Usage:
#   scripts/build-app-image.sh           # tags as oro-app:<short-sha>[-dirty]
#   IMAGE_TAG=oro-app:v1.2.3 scripts/build-app-image.sh
#   IMAGE_TAG=ghcr.io/inorbit-ai/oro-app:main scripts/build-app-image.sh
#
# Prints the resulting image tag on the final stdout line so callers can
# capture it: TAG="$(scripts/build-app-image.sh | tail -1)".
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

SHA="$(git rev-parse --short HEAD)"
DIRTY=""
if ! git diff --quiet || ! git diff --cached --quiet; then
  DIRTY="-dirty"
fi
TAG="${IMAGE_TAG:-oro-app:${SHA}${DIRTY}}"

docker build \
  -f web/app/Dockerfile \
  -t "$TAG" \
  web/app

echo "$TAG"
