---
sidebar_position: 2
---

# Quick Start

Get OpenRobOps running locally in under 10 minutes.

:::warning[Work in Progress]
A more automated startup script is coming soon. Manual steps here are valid and should work in less than 10 minutes!
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
# Preview what will be generated
./scripts/generate-settings.sh

# Generate and write settings files
./scripts/generate-settings.sh --apply
```

This creates `app/settings.json` and `ingest/settings.json` with MQTT credentials, encryption keys, and service URLs.

### Optional: Configure OAuth

To enable Google or GitHub login, create `terraform/local.tfvars`:

```hcl
# Google OAuth
# oauth_google_client_id = "your-client-id"
# oauth_google_secret    = "your-secret"

# GitHub OAuth
# oauth_github_client_id = "your-client-id"
# oauth_github_secret    = "your-secret"

# Email passwordless login
# smtp_url = "smtp://USER:PASS@SOME_SMTP_SERVER:PORT"
```

Then re-run `./scripts/generate-settings.sh --apply`.

## 3. Install Dependencies

```bash
cd app && npm install
cd ../ingest && npm install
cd ..
```

## 4. Start All Services

Start each component in its own terminal:

```bash
# Terminal 1: MQTT broker
cd mqtt && docker compose up

# Terminal 2: Web app (also starts MongoDB)
cd app && ./run.sh

# Terminal 3: Ingest service
cd ingest && ./run.sh
```

:::info[Coming soon]
A `./scripts/start-local-env.sh` helper that boots all three services in a single tmux session is planned. Until then, use the three-terminal flow above.
:::

## 5. Open the Dashboard

Navigate to **http://localhost:3000/** in your browser.

## 6. Create Your First Admin User

:::note
This step is going to be unnecessary really soon
:::

1. Sign in using any configured authentication method (OAuth or email).
2. You'll see a "Please contact your team admin" message — this is expected for the first user.
3. Open the MongoDB shell at `localhost:3001`, use the `meteor` database, find the `users` collection, and add `"admin"` to the `userRoles` array on your user document.

```bash
# Connect to MongoDB
mongosh mongodb://localhost:3001/meteor

# Find your user and grant admin role
db.users.updateOne(
  { "emails.address": "your@email.com" },
  { $set: { userRoles: ["admin"] } }
)
```

You now have a running OpenRobOps instance ready to accept robot connections.

## 7. (Optional) Connect a Simulated Robot with Flatland

Want to see data flowing without setting up real hardware? The
[Flatland simulator](https://github.com/OpenRobOps/sim-flatland) is a lightweight
2D simulator that publishes the same MQTT/protobuf telemetry as a real ORO agent —
pose, laser, costmap, system stats — so the dashboard lights up exactly as it would
with a physical robot.

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
