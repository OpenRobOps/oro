#!/usr/bin/env bash
#
# Generate settings.json files with randomized passwords.
# Uses Terraform to render templates from terraform/ directory.
#
# Usage:
#   ./scripts/generate-settings.sh [--apply]
#
# Without --apply, runs "terraform plan" to preview changes.
# With --apply, runs "terraform apply" to write the settings files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${0}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

# Generate random values
generate_password() {
  openssl rand -base64 24 | tr -d '/+=' | head -c 32
}

generate_hex_key() {
  openssl rand -hex 32
}

# Randomize secrets
export TF_VAR_mqtt_master_password
TF_VAR_mqtt_master_password="$(generate_password)"

export TF_VAR_mqtt_credential_encryption_key
TF_VAR_mqtt_credential_encryption_key="$(generate_hex_key)"

export TF_VAR_peer_key
TF_VAR_peer_key="$(generate_password)"

export TF_VAR_robot_api_key
TF_VAR_robot_api_key="$(generate_password)"

echo "Generated random secrets for:"
echo "  - mqtt_master_password"
echo "  - mqtt_credential_encryption_key"
echo "  - peer_key"
echo "  - robot_api_key"
echo ""

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

if [ "${1:-}" = "--apply" ]; then
  echo "Applying Terraform configuration..."
  terraform -chdir="${TERRAFORM_DIR}" apply -auto-approve -input=false $LOCAL_VARS_ARG
  echo ""
  echo "Settings files generated successfully."
else
  echo "Planning Terraform changes (use --apply to write files)..."
  terraform -chdir="${TERRAFORM_DIR}" plan -input=false $LOCAL_VARS_ARG
fi
