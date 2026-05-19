---
sidebar_position: 4
---

# Access Control

OpenRobOps provides role-based access control (RBAC) with multiple authentication methods.

## Authentication Methods

### OAuth Providers

OpenRobOps supports OAuth login via:

- **Google** — using Meteor's `accounts-google` package
- **GitHub** — using Meteor's `accounts-github` package

Configure OAuth by setting credentials in `terraform/local.tfvars`:

```hcl
oauth_google_client_id = "your-google-client-id"
oauth_google_secret    = "your-google-secret"

oauth_github_client_id = "your-github-client-id"
oauth_github_secret    = "your-github-secret"
```

Any of these config pairs (Google or Github) can be omitted and the authentication method will be disabled. 


Then regenerate settings:

```bash
./scripts/generate-settings.sh --apply
```

### Passwordless Email

For environments without OAuth, OpenRobOps supports passwordless email login using one-time passcodes via the `accounts-passwordless` Meteor package. Configure by providing an SMTP URL:

```hcl
smtp_url = "smtp://USER:PASS@SMTP_SERVER:PORT"
```

## Role-based authorization

OpenRobOps uses a Role-based mechanism to determine which operations are allowed to authenticated users.
This is a summary of existing roles. By default, each role is granted all permissions from previous roles in the table.

| Role | Permissions |
|------|-------------|
| **viewer** | Read-only access: view dashboards, query robot data via API |
| **operator** | Execute actions on robots; send navigation commands. |
| **manager** | Access to configuration. Modify robot parameters; add new data sources or dashboards. |
| **admin** | Full access: manage users. |

### Assigning Roles

:::warning
This is a reference for a pre-release version. A UI/API based mechanism is coming soon.
:::

Roles are stored in the `userRoles` array on the user document in MongoDB. Currently, roles are managed directly in the database:

```bash
mongosh mongodb://localhost:3001/meteor

# Grant admin role
db.users.updateOne(
  { "emails.address": "user@example.com" },
  { $set: { userRoles: ["admin"] } }
)
```

:::note
The first user to sign in will not have any role. You must manually assign the `admin` role via MongoDB as described above.
:::

## API Authentication

REST API endpoints are authenticated using the `x-auth-app-key` HTTP header. The app key is stored on the user document at `services.oro.appKey`.

```bash
curl -H "x-auth-app-key: YOUR_API_KEY" \
  http://localhost:3000/api/robots
```

### Internal Service Authentication

For service-to-service communication (e.g., ingest service calling the web app), a separate `x-auth-peer-key` header is used. The peer key is configured in `settings.json` and is not intended for external use.

## User Invites

Currently, any user can sign up through a configured authentication method. However, new users do not receive any role by default and will see a "Please contact your team admin" message until an admin grants them a role.

## Next Steps

- [REST API Overview](../api/overview.md) — API authentication details
- [Deployment](./deployment.md) — production security considerations
