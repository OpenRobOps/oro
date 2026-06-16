#!/usr/bin/env bash
# Copyright 2026 InOrbit, Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
#
# Launch the three local OpenRobOps services — mqtt, app and ingest — each via
# its own run.sh, in a separate tab (window) of a tmux session named "oro".
#
# Usage:
#   ./scripts/start-local-env.sh
#
# Stop everything with ./scripts/stop-local-env.sh

set -euo pipefail

SESSION="oro"
ROOT="$(cd "$(dirname "${0}")/.." && pwd)"

if ! command -v tmux >/dev/null 2>&1; then
  echo "Error: tmux is not installed. Install it first" >&2
  echo "  (e.g. 'sudo apt install tmux' on Debian/Ubuntu, or 'brew install tmux' on macOS)." >&2
  exit 1
fi

# Don't clobber an existing session.
if tmux has-session -t "${SESSION}" 2>/dev/null; then
  echo "A '${SESSION}' tmux session is already running."
  echo "  Attach with: tmux attach -t ${SESSION}"
  echo "  Stop with:   ./scripts/stop-local-env.sh"
  exit 0
fi

# One window (tab) per service, each starting in its own directory and running
# its run.sh. The window name is shown in the tmux status bar.
tmux new-session -d -s "${SESSION}" -n mqtt -c "${ROOT}/mqtt"
tmux send-keys -t "${SESSION}:mqtt" './run.sh' C-m

tmux new-window -t "${SESSION}" -n app -c "${ROOT}/app"
tmux send-keys -t "${SESSION}:app" './run.sh' C-m

tmux new-window -t "${SESSION}" -n ingest -c "${ROOT}/ingest"
tmux send-keys -t "${SESSION}:ingest" './run.sh' C-m

# Start on the first tab.
tmux select-window -t "${SESSION}:mqtt"

echo "Started '${SESSION}' with tabs: mqtt, app, ingest."

# Attach when run interactively from outside tmux; otherwise explain how.
if [ -n "${TMUX:-}" ]; then
  echo "Already inside tmux — switch with: tmux switch-client -t ${SESSION}"
elif [ -t 1 ]; then
  tmux attach-session -t "${SESSION}"
else
  echo "Attach with: tmux attach -t ${SESSION}"
fi
