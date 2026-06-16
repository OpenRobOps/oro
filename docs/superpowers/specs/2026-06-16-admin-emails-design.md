# Design: `adminEmails` — auto-attach `admin` role on account creation

**Date:** 2026-06-16

## Goal

Allow operators to declare a list of administrator emails in the Terraform
setup. That list is propagated into the web app's `settings.json`. When a user's
account is created during login, if their email is in the list, the `admin` role
is attached automatically (instead of the default empty role set that requires
manual admin approval).

## Decisions

- **When applied:** on account creation only (`Accounts.onCreateUser`). Existing
  accounts, or emails added to the list after a user already exists, are not
  retroactively promoted.
- **Visibility:** server-only. `adminEmails` lives at the top level of
  `settings.json` (not under `public`), so it is readable via
  `Meteor.settings.adminEmails` on the server only.
- **Matching:** case-insensitive. Both the configured list and the user's email
  are lowercased before comparison (emails are effectively case-insensitive).

## Changes

### 1. Terraform variable — `terraform/variables.tf`

```hcl
variable "admin_emails" {
  description = "List of administrator email addresses. Users matching one of these are granted the 'admin' role on account creation."
  type        = list(string)
  default     = []
}
```

### 2. Propagate into `app/settings.json` — `terraform/main.tf`

In the `local_file.web_app_settings` resource, add a top-level key to the first
object of the `jsonencode(merge(...))` call (alongside `robotApiKeys`,
`allowedOrigins`, etc., **not** under `public`):

```hcl
adminEmails = var.admin_emails
```

Result: `Meteor.settings.adminEmails` is a `string[]`, server-readable only.
With the default empty list, it serializes to `"adminEmails": []`.

### 3. Auto-attach `admin` role — `app/imports/server/accountsHooks.js`

Import `ROLE_ADMIN` from `app/imports/shared/roles.js` and update the
`Accounts.onCreateUser` hook. The hook already derives `email` via
`normalizeOAuthProfile`.

```js
import { ROLE_ADMIN } from '../shared/roles';

// inside onCreateUser, replacing `user.userRoles = [];`
const adminEmails = (Meteor.settings.adminEmails || []).map(e => e.toLowerCase());
const isAdmin = !!email && adminEmails.includes(email.toLowerCase());
// Admins listed in settings start with the admin role; everyone else starts
// with no roles and must be approved by an admin.
user.userRoles = isAdmin ? [ROLE_ADMIN] : [];
```

Non-matching users keep the existing `[]` behavior, so nothing else in the
approval flow changes.

## Testing

Unit-test the `onCreateUser` behavior:

- Email present in `adminEmails` → `userRoles === ['admin']`.
- Email present but different case → still `['admin']` (case-insensitive).
- Email not in the list → `userRoles === []`.
- `Meteor.settings.adminEmails` missing/empty → `userRoles === []`.
- User with no resolvable email → `userRoles === []`.

## Out of scope

- Retroactive promotion of existing users.
- Removing the admin role when an email is removed from the list.
- UI display of the admin-emails list.
