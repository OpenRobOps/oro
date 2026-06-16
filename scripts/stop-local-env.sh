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
# Stop the local OpenRobOps services by killing the "oro" tmux session started
# by start-local-env.sh.
#
# Usage:
#   ./scripts/stop-local-env.sh

set -euo pipefail

SESSION="oro"

if ! command -v tmux >/dev/null 2>&1; then
  echo "Error: tmux is not installed; there is no session to stop." >&2
  exit 1
fi

if ! tmux has-session -t "${SESSION}" 2>/dev/null; then
  echo "No '${SESSION}' tmux session is running."
  exit 0
fi

tmux kill-session -t "${SESSION}"
echo "Stopped '${SESSION}' tmux session."
echo "Note: if MQTT Docker containers are still running, stop them with:"
echo "  (cd mqtt && docker compose down)"
