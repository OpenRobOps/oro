#!/bin/bash
# HACK: Import files from other components into the Ingest service

set -e
mkdir -p src/shared

# NOTE: always use `cp -u`, to copy files only if they changed.
# Copying all files all the time causes other nodemon'ed services
# to restart as file timestamps changed, even if the file contents
# are the same.
# NOTE Don't add more files here. We should stop this practice
# and use proper package management instead.
cp -u ../app/private/oro.proto \
  ../app/imports/shared/constants.js \
  ../app/imports/shared/attributes.js \
  ../app/imports/shared/geometry.js \
  ../app/imports/shared/arrayUtil.js \
  ../app/imports/shared/simpleCache.js \
  ../app/imports/shared/throttledLogger.js \
  src/shared
