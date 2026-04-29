#!/bin/sh
# Copyright 2026 InOrbit, Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Container entrypoint for the oro-app image.
#
# Meteor copies settings.smtp.url into process.env.MAIL_URL only after the
# server-side JS has booted; some email paths read MAIL_URL earlier than that.
# If METEOR_SETTINGS is provided and contains smtp.url, export MAIL_URL up
# front so it is set before Node starts.
set -e

if [ -n "${METEOR_SETTINGS:-}" ] && [ -z "${MAIL_URL:-}" ]; then
  url=$(METEOR_SETTINGS="$METEOR_SETTINGS" node -e \
    'try { const s = JSON.parse(process.env.METEOR_SETTINGS); if (s && s.smtp && s.smtp.url) process.stdout.write(s.smtp.url); } catch (_) {}')
  if [ -n "$url" ]; then
    export MAIL_URL="$url"
  fi
fi

exec "$@"
