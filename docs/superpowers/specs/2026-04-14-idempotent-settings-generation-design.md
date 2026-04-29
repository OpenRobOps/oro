# Idempotent Settings Generation

## Problem

`generate-settings.sh` creates 2 settings files (`app/settings.json` and
`ingest/settings.json`) via Terraform. Each run generates fresh random secrets
(passwords, API keys), so re-running the script overwrites existing values.
This makes it impossible to run Terraform again to pick up template changes
without losing the current secrets.

## Solution

Replace the bash-generated secrets with Terraform `random` provider resources.
Terraform stores their values in state, so re-running `apply` preserves them.

## Terraform Changes

### New provider

Add `hashicorp/random` to `required_providers` in `main.tf`.

### New resources (in `main.tf`)

| Resource | Type | Config | Replaces |
|---|---|---|---|
| `random_password.mqtt_master` | `random_password` | length=32, special=false | `var.mqtt_master_password` |
| `random_id.mqtt_credential_encryption_key` | `random_id` | byte_length=32 | `var.mqtt_credential_encryption_key` |
| `random_password.peer_key` | `random_password` | length=32, special=false | `var.peer_key` |
| `random_password.robot_api_key` | `random_password` | length=32, special=false | `var.robot_api_key` |

### Reference updates in `main.tf`

- `var.mqtt_master_password` → `random_password.mqtt_master.result`
- `var.mqtt_credential_encryption_key` → `random_id.mqtt_credential_encryption_key.hex`
- `var.peer_key` → `random_password.peer_key.result`
- `var.robot_api_key` → `random_password.robot_api_key.result`

### Variable removals from `variables.tf`

Remove: `mqtt_master_password`, `mqtt_credential_encryption_key`, `peer_key`,
`robot_api_key`. These are no longer external inputs.

## Script Changes (`generate-settings.sh`)

### Removals

- `generate_password` and `generate_hex_key` functions
- All `TF_VAR_*` exports for secrets
- "Generated random secrets" echo block

### New CLI interface

| Invocation | Behavior |
|---|---|
| `./scripts/generate-settings.sh` (default) | `terraform apply` — preserves existing secrets in state |
| `./scripts/generate-settings.sh --clean` | `terraform apply -replace=...` for all 4 random resources — regenerates all secrets |
| `./scripts/generate-settings.sh --plan` | `terraform plan` — preview changes without writing files |

### `--clean` implementation

Pass these flags to `terraform apply`:
```
-replace=random_password.mqtt_master
-replace=random_id.mqtt_credential_encryption_key
-replace=random_password.peer_key
-replace=random_password.robot_api_key
```

## Migration

Existing users with a `terraform.tfstate` from the old script will see:

- New `random_*` resources created (generating fresh secret values)
- `local_file` resources updated to use the new references

This is equivalent to a one-time `--clean`. After the first post-migration run,
subsequent runs preserve secrets via state. This is unavoidable since the old
secrets were generated outside of Terraform and never stored in state.
