#!/usr/bin/env bash
# Copyright 2026 InOrbit, Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# End-to-end smoke test for the oro-app container image.
#
# Builds (or reuses) the image, starts a private MongoDB + Mosquitto + app
# stack on an isolated Docker network, waits for the app's HEALTHCHECK to
# report `healthy`, then makes one HTTP request to the published port. Tears
# everything down on exit.
#
# Usage:
#   scripts/smoke-test-app-image.sh
#   IMAGE_TAG=oro-app:smoketest scripts/smoke-test-app-image.sh
#   TIMEOUT_SECONDS=240 scripts/smoke-test-app-image.sh
#   KEEP_ON_FAILURE=1 scripts/smoke-test-app-image.sh
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

NETWORK="oro-smoketest-net"
APP="oro-smoketest-app"
MONGO="oro-smoketest-mongo"
MQTT="oro-smoketest-mqtt"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-180}"

WORK_DIR="$(mktemp -d -t oro-smoketest.XXXXXX)"

dump_logs() {
  for c in "$MONGO" "$MQTT" "$APP"; do
    if docker inspect "$c" >/dev/null 2>&1; then
      echo "----- docker logs ($c) [last 200 lines] -----" >&2
      docker logs --tail 200 "$c" 2>&1 | sed "s/^/[$c] /" >&2 || true
    fi
  done
}

cleanup() {
  local exit_code=$?
  if [ "$exit_code" -ne 0 ] && [ "${KEEP_ON_FAILURE:-}" = "1" ]; then
    echo ""
    echo "KEEP_ON_FAILURE=1 set; leaving containers and network in place:" >&2
    echo "  containers: $MONGO $MQTT $APP" >&2
    echo "  network:    $NETWORK" >&2
    echo "  workdir:    $WORK_DIR" >&2
    return
  fi
  for c in "$APP" "$MQTT" "$MONGO"; do
    docker rm -f "$c" >/dev/null 2>&1 || true
  done
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}

on_error() {
  echo ""
  echo "✗ smoke test failed" >&2
  dump_logs
}

trap cleanup EXIT
trap on_error ERR

# 1. Resolve image tag — build if not provided.
if [ -n "${IMAGE_TAG:-}" ]; then
  TAG="$IMAGE_TAG"
  echo "Using prebuilt image: $TAG"
else
  echo "Building image via scripts/build-app-image.sh ..."
  TAG="$(scripts/build-app-image.sh | tail -1)"
  echo "Built: $TAG"
fi

# 2. Inline mosquitto config — anonymous, listener on 1883 only.
cat >"$WORK_DIR/mosquitto.conf" <<'EOF'
listener 1883
allow_anonymous true
persistence false
log_dest stdout
EOF

# 3. Inline test settings — minimum to satisfy server/main.js boot path.
ENC_KEY="$(openssl rand -hex 16)"
PEER_KEY="$(openssl rand -hex 32)"
cat >"$WORK_DIR/settings.json" <<EOF
{
  "mqtt": {
    "brokers": {
      "local": {
        "hostname": "$MQTT",
        "port": 1883,
        "protocol": "mqtt://",
        "username": "smoke",
        "password": "smoke",
        "websocket_port": 9001,
        "websocket_protocol": "ws://"
      }
    },
    "credentialEncryptionKey": "$ENC_KEY",
    "defaultBrokerId": "local",
    "masterCredentials": { "username": "smoke", "password": "smoke" }
  },
  "peerKey": "$PEER_KEY",
  "public": { "oauthProviders": [] },
  "robotApiKeys": ["smoke-test-api-key"]
}
EOF

# 4. Network + dependency containers.
echo "Creating network $NETWORK ..."
docker network create "$NETWORK" >/dev/null

echo "Starting $MONGO (mongo:7) ..."
docker run -d --rm \
  --name "$MONGO" \
  --network "$NETWORK" \
  mongo:7 >/dev/null

echo "Starting $MQTT (eclipse-mosquitto:2) ..."
docker run -d --rm \
  --name "$MQTT" \
  --network "$NETWORK" \
  -v "$WORK_DIR/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro" \
  eclipse-mosquitto:2 >/dev/null

# 5. Wait for mongo to accept connections (~30s ceiling).
echo -n "Waiting for $MONGO to accept connections "
mongo_ready=0
for _ in $(seq 1 30); do
  if docker exec "$MONGO" mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q '^1$'; then
    mongo_ready=1
    break
  fi
  echo -n "."
  sleep 1
done
echo ""
if [ "$mongo_ready" -ne 1 ]; then
  echo "$MONGO never became ready" >&2
  exit 1
fi

# 6. Run the app under test.
echo "Starting $APP from $TAG ..."
docker run -d --rm \
  --name "$APP" \
  --network "$NETWORK" \
  -p 0:3000 \
  -e MONGO_URL="mongodb://$MONGO:27017/meteor" \
  -e ROOT_URL="http://localhost:3000" \
  -e METEOR_SETTINGS="$(cat "$WORK_DIR/settings.json")" \
  "$TAG" >/dev/null

# 7. Discover the host port Docker assigned.
HOST_PORT="$(docker port "$APP" 3000 | awk -F: 'NR==1 {print $NF}')"
if [ -z "$HOST_PORT" ]; then
  echo "Could not determine host port for $APP" >&2
  exit 1
fi
echo "$APP published on host port $HOST_PORT"

# 8. Poll healthcheck until healthy / unhealthy / timeout / container exits.
echo -n "Waiting for $APP to report healthy "
deadline=$((SECONDS + TIMEOUT_SECONDS))
status="starting"
while [ $SECONDS -lt $deadline ]; do
  if ! docker inspect "$APP" >/dev/null 2>&1; then
    echo ""
    echo "$APP container disappeared" >&2
    exit 1
  fi
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$APP" 2>/dev/null || echo "unknown")"
  case "$status" in
    healthy) break ;;
    unhealthy)
      echo ""
      echo "$APP reported unhealthy" >&2
      exit 1
      ;;
    none)
      echo ""
      echo "$APP has no HEALTHCHECK defined" >&2
      exit 1
      ;;
  esac
  if ! docker inspect --format '{{.State.Running}}' "$APP" 2>/dev/null | grep -q '^true$'; then
    echo ""
    echo "$APP exited before becoming healthy" >&2
    exit 1
  fi
  echo -n "."
  sleep 2
done
echo ""
if [ "$status" != "healthy" ]; then
  echo "$APP did not become healthy within ${TIMEOUT_SECONDS}s (last status: $status)" >&2
  exit 1
fi

# 9. External assertion — published port serves a 2xx for /.
echo "Hitting http://localhost:$HOST_PORT/ ..."
curl -fsS "http://localhost:$HOST_PORT/" -o /dev/null

echo "✓ smoke test passed (image: $TAG)"
