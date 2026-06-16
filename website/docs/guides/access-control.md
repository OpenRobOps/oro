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

Any of these config pairs (Google or GitHub) can be omitted and the authentication method will be disabled.

Then regenerate settings:

```bash
./scripts/generate-settings.sh --apply
```

:::note[GitHub App email permission]
If your GitHub credentials belong to a GitHub **App** (rather than a classic OAuth
App), the app must be granted the **Account → Email addresses (read-only)** permission.
Without it the `/user/emails` call returns 403 and the user's email comes back empty,
which also prevents `admin_emails` auto-grant from matching.
:::

### Passwordless Email

For environments without OAuth, OpenRobOps supports passwordless email login using one-time passcodes via the `accounts-passwordless` Meteor package. Configure by providing an SMTP URL:

```hcl
smtp_url = "smtp://USER:PASS@SMTP_SERVER:PORT"
```

## Roles

OpenRobOps uses roles to determine which operations an authenticated user may perform.
Each role **includes all permissions of the roles below it**:

| Role | Adds on top of the role below |
|------|-------------------------------|
| **viewer** | Read-only: view robots and dashboards, query robot data via the API |
| **operator** | Execute actions on robots; send navigation commands; lock/operate robots |
| **engineer** | Configure the fleet (add/remove robots), break other users' locks, and configure navigation, data sources (attributes), incidents, and action definitions |
| **manager** | Configure dashboards and missions |
| **admin** | Manage users, roles, integrations, and API-key settings — full access |

A user with **no** role is treated as pending (see [User Moderation](#user-moderation)) and is denied access until an admin grants a role.

### Assigning Roles

Roles are managed from the web app under **Settings → Users** (admin only). For each
user you can pick a role from the dropdown; changes take effect immediately and are
recorded in the audit log. There is no need to edit the database directly.

See [User Moderation](#user-moderation) below for the full approval flow.

### First Admin (`admin_emails`)

So the first person to sign in isn't locked out, list their email in the `admin_emails`
Terraform variable:

```hcl
admin_emails = ["you@example.com"]
```

Any user whose sign-in email matches an entry (case-insensitive) is granted the `admin`
role automatically when their account is created. The **Settings → Users** screen also
warns about configured admin emails that haven't registered yet. Regenerate settings
(`./scripts/generate-settings.sh --apply`) after changing the list.

## User Moderation

New sign-ups (via any auth method) start with **no role** and see a "Please contact your
team admin" message until approved. Admins manage them under **Settings → Users**:

- **Pending** users (no role) can be **approved** — pick a role to grant — or **rejected** (removed).
- **Approved** users are listed with their role, sign-in source (Google / GitHub / Email), join date and last-seen; their role can be changed or the user deleted.

## API Keys

Programmatic API access uses per-user **API keys**, managed from the web app under
**Settings → API keys**. Any user with a role can manage their own keys.

- **Create** a key with a name and an optional expiration (30 / 60 / 90 days, or never).
  The key (prefixed `oro_`) is shown **once** — copy it or download it as JSON. It is
  stored only as a one-way hash and **cannot be retrieved again**.
- The list shows each key's **name**, **expiration** and **last used** time. Revoke a key
  at any time; revocation takes effect immediately.
- Up to 20 active keys per user.

Use a key by sending it in the `x-auth-api-key` header — see the
[REST API Overview](../api/overview.md). Expired or revoked keys are rejected with a 403.

:::note
Upgrading from an earlier version automatically migrates the previous single
per-user key to this hashed, multi-key format, so existing integrations keep working.
:::

### Internal Service Authentication

For service-to-service communication (e.g., the ingest service calling the web app), a separate `x-auth-peer-key` header is used. The peer key is configured in `settings.json` and is not intended for external use.

## Next Steps

- [REST API Overview](../api/overview.md) — API authentication details
- [Deployment](./deployment.md) — production security considerations
