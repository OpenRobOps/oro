# Idempotent Settings Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `generate-settings.sh` safe to re-run by moving secret generation into Terraform `random` provider resources, so secrets persist in state across runs.

**Architecture:** Replace the 4 bash-generated secrets with Terraform `random_password` and `random_id` resources. Update `main.tf` to reference the new resources instead of variables. Simplify the shell script to just invoke Terraform with the right flags.

**Tech Stack:** Terraform (hashicorp/random provider), Bash

---

### Task 1: Add random provider and secret resources to Terraform

**Files:**
- Modify: `terraform/main.tf:15-17` (add required_providers and random resources)
- Modify: `terraform/variables.tf` (remove 4 secret variables)

- [ ] **Step 1: Add the `random` provider requirement and random resources to `main.tf`**

Replace the existing `terraform` block at the top of `terraform/main.tf`:

```hcl
terraform {
  required_version = ">= 1.0"
}
```

With:

```hcl
terraform {
  required_version = ">= 1.0"
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

resource "random_password" "mqtt_master" {
  length  = 32
  special = false
}

resource "random_id" "mqtt_credential_encryption_key" {
  byte_length = 32
}

resource "random_password" "peer_key" {
  length  = 32
  special = false
}

resource "random_password" "robot_api_key" {
  length  = 32
  special = false
}
```

- [ ] **Step 2: Update `local_file.web_app_settings` references in `main.tf`**

In the `resource "local_file" "web_app_settings"` block, replace these 4 variable references:

| Old reference | New reference |
|---|---|
| `var.robot_api_key` (2 occurrences on the same line) | `random_password.robot_api_key.result` |
| `var.mqtt_credential_encryption_key` | `random_id.mqtt_credential_encryption_key.hex` |
| `var.mqtt_master_password` (2 occurrences) | `random_password.mqtt_master.result` |
| `var.peer_key` | `random_password.peer_key.result` |

The `robot_api_key` line should become:

```hcl
      robotApiKeys = random_password.robot_api_key.result != "" ? [random_password.robot_api_key.result] : [],
```

Note: since `random_password` always produces a non-empty result, this condition will always be true, but we keep the structure consistent with the existing pattern.

- [ ] **Step 3: Update `local_file.ingest_settings` references in `main.tf`**

In the `resource "local_file" "ingest_settings"` block, replace:

| Old reference | New reference |
|---|---|
| `var.mqtt_master_password` (1 occurrence) | `random_password.mqtt_master.result` |
| `var.peer_key` (1 occurrence) | `random_password.peer_key.result` |

- [ ] **Step 4: Remove the 4 secret variables from `variables.tf`**

Remove these 4 variable blocks entirely from `terraform/variables.tf`:

```hcl
variable "robot_api_key" {
  description = "API key for robots to connect (can use multiple; use empty to disallow registration)"
  type        = string
  default     = ""
  sensitive   = true
}
```

```hcl
variable "mqtt_master_password" {
  description = "MQTT master credentials password"
  type        = string
  sensitive   = true
}
```

```hcl
variable "mqtt_credential_encryption_key" {
  description = "Hex-encoded 256-bit key for encrypting MQTT credentials"
  type        = string
  sensitive   = true
}
```

```hcl
variable "peer_key" {
  description = "Peer API key"
  type        = string
  sensitive   = true
}
```

Keep all other variables (`hostname`, `mqtt_port`, `mqtt_websocket_port`, `mqtt_master_username`, `smtp_url`, `oauth_*`, `mongo_*`, `peer_client_url`, `profiler_enabled`).

- [ ] **Step 5: Re-initialize Terraform to fetch the random provider**

Run:
```bash
rm -rf terraform/.terraform terraform/.terraform.lock.hcl
terraform -chdir=terraform init -input=false
```

Expected: successful init that downloads both `hashicorp/local` and `hashicorp/random` providers.

- [ ] **Step 6: Validate the Terraform configuration**

Run:
```bash
terraform -chdir=terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 7: Commit**

```bash
git add terraform/main.tf terraform/variables.tf terraform/.terraform.lock.hcl
git commit -m "feat: replace bash-generated secrets with terraform random resources

Secrets are now managed by terraform random_password and random_id
resources, persisted in state across runs."
```

---

### Task 2: Update `generate-settings.sh`

**Files:**
- Modify: `scripts/generate-settings.sh`

- [ ] **Step 1: Rewrite `generate-settings.sh`**

Replace the entire content of `scripts/generate-settings.sh` with:

```bash
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
# Generate settings.json files using Terraform.
# Secrets are managed by Terraform random resources and persist in state.
#
# Usage:
#   ./scripts/generate-settings.sh [--plan|--clean]
#
# Without flags, runs "terraform apply" preserving existing secrets.
# With --plan, runs "terraform plan" to preview changes.
# With --clean, regenerates all secrets from scratch.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${0}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

# Initialize Terraform if needed
if [ ! -d "${TERRAFORM_DIR}/.terraform" ]; then
  echo "Initializing Terraform..."
  terraform -chdir="${TERRAFORM_DIR}" init -input=false
  echo ""
fi

LOCAL_VARS_ARG=""
if [ -f "${TERRAFORM_DIR}/local.tfvars" ]; then
  echo "Using local vars from local.tfvars"
  LOCAL_VARS_ARG="-var-file=local.tfvars"
fi

case "${1:-}" in
  --plan)
    echo "Planning Terraform changes..."
    terraform -chdir="${TERRAFORM_DIR}" plan -input=false $LOCAL_VARS_ARG
    ;;
  --clean)
    echo "Regenerating all secrets and applying..."
    terraform -chdir="${TERRAFORM_DIR}" apply -auto-approve -input=false $LOCAL_VARS_ARG \
      -replace=random_password.mqtt_master \
      -replace=random_id.mqtt_credential_encryption_key \
      -replace=random_password.peer_key \
      -replace=random_password.robot_api_key
    echo ""
    echo "Settings files regenerated with new secrets."
    ;;
  "")
    echo "Applying Terraform configuration (preserving existing secrets)..."
    terraform -chdir="${TERRAFORM_DIR}" apply -auto-approve -input=false $LOCAL_VARS_ARG
    echo ""
    echo "Settings files generated successfully."
    ;;
  *)
    echo "Usage: $0 [--plan|--clean]" >&2
    exit 1
    ;;
esac
```

- [ ] **Step 2: Verify the script is executable**

Run:
```bash
ls -la scripts/generate-settings.sh
```

Expected: `-rwxr-xr-x` permissions (already executable from before).

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-settings.sh
git commit -m "feat: update generate-settings.sh for idempotent runs

Default is now 'apply' (safe, preserves secrets in state).
--plan previews changes, --clean regenerates all secrets."
```

---

### Task 3: End-to-end verification

- [ ] **Step 1: Run the script with default (apply)**

Run:
```bash
./scripts/generate-settings.sh
```

Expected: Terraform creates the random resources and writes both settings files. This is the one-time migration — new secrets are generated.

- [ ] **Step 2: Record a secret value from the output**

Run:
```bash
cat ingest/settings.json | python3 -m json.tool | grep password
```

Note the password value.

- [ ] **Step 3: Run the script again (idempotency test)**

Run:
```bash
./scripts/generate-settings.sh
```

Expected: `Apply complete! Resources: 0 added, 0 changed, 0 destroyed.` (or similar indicating no changes). The password should be the same as Step 2.

- [ ] **Step 4: Verify secrets are preserved**

Run:
```bash
cat ingest/settings.json | python3 -m json.tool | grep password
```

Expected: same password as Step 2.

- [ ] **Step 5: Test --clean flag**

Run:
```bash
./scripts/generate-settings.sh --clean
```

Expected: Terraform replaces the random resources and rewrites settings files with new secret values.

- [ ] **Step 6: Verify secrets changed**

Run:
```bash
cat ingest/settings.json | python3 -m json.tool | grep password
```

Expected: different password than Step 2.

- [ ] **Step 7: Test --plan flag**

Run:
```bash
./scripts/generate-settings.sh --plan
```

Expected: shows plan output with no changes (since we just applied).
