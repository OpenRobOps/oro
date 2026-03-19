---
sidebar_position: 2
---

# Quick Start

Get OpenRobOps running locally in under 10 minutes.

:::warning[Work in Progress]
A more automated startup script is coming soon. This guide still valid and works in less than 10 minutes!
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

This creates `web/app/settings.json` and `ingest/settings.json` with MQTT credentials, encryption keys, and service URLs.

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
cd web/app && npm install
cd ../../ingest && npm install
cd ..
```

## 4. Start All Services

The quickest way to start everything:

```bash
./scripts/start-local-env.sh
```

Or start each component manually in separate terminals:

```bash
# Terminal 1: MQTT broker
cd mqtt && docker compose up

# Terminal 2: Web app (also starts MongoDB)
cd web/app && ./run.sh

# Terminal 3: Ingest service
cd ingest && ./run.sh
```

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

## Next Steps

- [Core Concepts](./core-concepts.md) — understand robots, telemetry, and dashboards
- [Connecting Your First Robot](./connecting-first-robot.md) — register a robot and see data flow
- [Deployment](../guides/deployment.md) — production deployment with Docker Compose
