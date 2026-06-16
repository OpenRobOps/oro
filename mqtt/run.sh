#!/bin/bash
# Set the terminal tab title, if possible (ignore failures).
if [ -t 1 ]; then
  printf '\033]0;OpenRobOps:mqtt\007' 2>/dev/null || true
  # Clear the title when exiting.
  trap 'printf "\033]0;\007" 2>/dev/null || true' EXIT
fi
# --remove-orphans cleans up containers from previous (renamed/removed) compose
# services so they don't linger and emit "orphan containers" warnings.
docker compose up --remove-orphans
