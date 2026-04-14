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
