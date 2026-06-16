#!/bin/bash
# Set the terminal tab title, if possible (ignore failures).
if [ -t 1 ]; then
  printf '\033]0;OpenRobOps:app\007' 2>/dev/null || true
  # Clear the title when exiting.
  trap 'printf "\033]0;\007" 2>/dev/null || true' EXIT
fi
npm start
