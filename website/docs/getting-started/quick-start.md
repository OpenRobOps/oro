---
sidebar_position: 2
---

# Quick Start

Get OpenRobOps running locally in under 10 minutes.

:::warning[Work in Progress]
These manual steps work in under 10 minutes. The `start-local-env.sh` helper (step 4) launches all services in one command; broader setup automation is still evolving.
:::


## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | v22 | Via [nvm](https://github.com/nvm-sh/nvm) |
| **Meteor** | 3.4 | `npx meteor` |
| **Docker** | With Compose plugin | `docker compose` command |
| **Terraform** | Latest | [hashicorp.com](https://developer.hashicorp.com/terraform) |
| **tmux** | Any | Via your package manager |

## 1. Clone the Repository

```bash
git clone https://github.com/OpenRobOps/oro.git
cd oro
```

## 2. Generate Configuration Files

OpenRobOps uses Terraform to generate settings files with randomized credentials for inter-service communication.

```bash
# Preview what will be generated (optional)
./scripts/generate-settings.sh --plan

# Generate and write settings files
./scripts/generate-settings.sh
```

This creates `app/settings.json` and `ingest/settings.json` with MQTT credentials, encryption keys, and service URLs.

Secrets are Terraform `random_*` resources persisted in state, so the script is
safe to re-run: it preserves the existing MQTT master password, encryption keys,
peer key, and robot API key. To force-rotate all secrets run
`./scripts/generate-settings.sh --clean` — note this invalidates credentials
already handed out to connected robots.

### Optional: Configure OAuth

To enable Google or GitHub login, create `terraform/local.tfvars`:

```hcl
# Google OAuth
# oauth_google_client_id = "your-client-id"
# oauth_google_secret    = "your-secret"

# GitHub OAuth
# oauth_github_client_id = "your-client-id"
# oauth_github_secret    = "your-secret"
# Note: a GitHub App must be granted the "Email addresses" (read-only) account
# permission, or the user's email cannot be retrieved on sign-in.

# Email passwordless login
# smtp_url = "smtp://USER:PASS@SOME_SMTP_SERVER:PORT"

# Administrators — users whose sign-in email matches one of these are
# granted the "admin" role automatically when their account is created.
# admin_emails = ["you@example.com"]
```

Then re-run `./scripts/generate-settings.sh`.

Set `admin_emails` to your own address so your first sign-in is an administrator
with no extra steps.

## 3. Install Dependencies

```bash
cd app && npm install
cd ../ingest && npm install
cd ..
```

Note: on every start, `ingest/run.sh` syncs shared files (`oro.proto` and
shared JavaScript) from `app/` into `ingest/src/shared/` via `ingest/import.sh`,
so the `app/` directory must be present alongside `ingest/`.

## 4. Start All Services

The quickest way is the helper script, which launches all three services (each
via its `run.sh`) in separate tabs of a tmux session named `oro`:

```bash
./scripts/start-local-env.sh
```

This requires **tmux** to be installed. Stop everything with
`./scripts/stop-local-env.sh`.

Prefer to run them manually? Start each component in its own terminal:

```bash
# Terminal 1: MQTT broker
cd mqtt && ./run.sh

# Terminal 2: Web app (also starts MongoDB)
cd app && ./run.sh

# Terminal 3: Ingest service
cd ingest && ./run.sh
```

## 5. Open the Dashboard

Navigate to **http://localhost:3000/** in your browser and sign in using any
configured authentication method (OAuth or email).

If you're greeted with an access request screen, it means your email didn't
match any of the addresses listed in `admin_emails` — add it there (step 2) and
sign in again, or have an existing admin approve your account.

You now have a running OpenRobOps instance ready to accept robot connections.

## 6. (Optional) Connect a Simulated Robot with Flatland

Want to see data flowing without setting up real hardware? The
[Flatland simulator](https://github.com/OpenRobOps/sim-flatland) is a lightweight
2D simulator with a full Nav2 robot. It connects to ORO either through the InOrbit
ROS2 agent — publishing the same MQTT/protobuf telemetry as a real ORO agent (pose,
laser, costmap, system stats) — or as an [ISO 21423 robot](../iso21423/flatland-simulator.md),
so the dashboard lights up exactly as it would with a physical robot.

```bash
git clone https://github.com/OpenRobOps/sim-flatland.git
cd sim-flatland
# Follow the README to point the simulator at your local MQTT broker
```

In addition to starting the simulation, a suitable configuration for OpenRobOps should be 
created. Configuration files (see Config API) are included in that repository; make sure
to follow instructions from its README to import them.

Once the simulator is running, you should see a robot appear in the fleet view
at `http://localhost:3000/` with live localization, vitals, and laser data.

## Next Steps

- [Core Concepts](./core-concepts.md) — understand robots, telemetry, and dashboards
- [Connecting Your First Robot](./connecting-first-robot.md) — register a robot and see data flow
- [Flatland Simulator](https://github.com/OpenRobOps/sim-flatland) — drive the dashboard with a simulated robot
- [Deployment](../guides/deployment.md) — production deployment with Docker Compose
