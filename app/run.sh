#!/bin/bash
set -e
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "${NVM_DIR}/nvm.sh"
  nvm use 22
fi
# Set the terminal tab title, if possible (ignore failures).
if [ -t 1 ]; then
  # Save the current title on the terminal's title stack, set ours, and restore
  # the original on exit. Terminals that don't support this just ignore it.
  printf '\033[22;2t' 2>/dev/null || true
  printf '\033]0;OpenRobOps:app\007' 2>/dev/null || true
  trap 'printf "\033[23;2t" 2>/dev/null || true' EXIT
fi
npm start
