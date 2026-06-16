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

locals {
  # Create a list of available oauth providers (part of Meteor's UI settings)
  oauth_providers = concat(
    (var.smtp_url != "") ? ["email"] : [],
    (var.oauth_google_client_id != "") ? ["google"] : [],
    (var.oauth_github_client_id != "") ? ["github"] : []
  )
}

resource "local_file" "web_app_settings" {
  filename        = "${path.module}/../app/settings.json"
  file_permission = "0644"
  content = jsonencode(merge(
    {
      public = {
        oauthProviders = local.oauth_providers
      }
      robotApiKeys   = [random_password.robot_api_key.result]
      allowedOrigins = []
      allowedHeaders = []
      adminEmails    = var.admin_emails
      mqtt = {
        credentialEncryptionKey = random_id.mqtt_credential_encryption_key.hex
        masterCredentials = {
          username = var.mqtt_master_username
          password = random_password.mqtt_master.result
        }
        brokers = {
          local = {
            protocol           = "mqtt://"
            hostname           = var.hostname
            port               = var.mqtt_port
            websocket_port     = var.mqtt_websocket_port
            websocket_protocol = "ws://"
            username           = var.mqtt_master_username
            password           = random_password.mqtt_master.result
          }
        }
        defaultBrokerId = "local"
      }
      peerKey = random_password.peer_key.result
    },

    (var.smtp_url != "") ? {
      smtp = {
        url = var.smtp_url
      }
    } : {},

    {
      oauth = merge(
        # Github oauth: conditionally enabled, if variables have values
        (var.oauth_google_client_id != "" && var.oauth_google_secret != "") ? {
          google = {
            clientId   = var.oauth_google_client_id
            secret     = var.oauth_google_secret
            loginStyle = "popup"
          }
        } : {},

        # Github oauth: conditionally enabled, if variables have values
        (var.oauth_github_client_id != "" && var.oauth_github_secret != "") ? {
          github = {
            clientId   = var.oauth_github_client_id
            secret     = var.oauth_github_secret
            loginStyle = "popup"
          }
        } : {}
      )
    }
  ))
}

locals {
  # Base ingest settings shared regardless of whether upstream is enabled.
  ingest_base_settings = {
    mqtt = {
      brokers = {
        local = {
          protocol           = "mqtt://"
          hostname           = var.hostname
          port               = var.mqtt_port
          websocket_port     = var.mqtt_websocket_port
          websocket_protocol = "ws://"
          username           = var.mqtt_master_username
          password           = random_password.mqtt_master.result
        }
      }
      defaultBrokerId = "local"
    }
    profiler = {
      enabled = var.profiler_enabled
    }
    mongo = {
      url = var.mongo_url
      db  = var.mongo_db
      options = {
        maxPoolSize      = var.mongo_max_pool_size
        connectTimeoutMS = var.mongo_connect_timeout_ms
      }
    }
    peerClient = {
      url               = var.peer_client_url
      peerKey           = random_password.peer_key.result
      connectionPooling = true
    }
  }

  # When upstream is disabled, only `enabled = false` is written so no other
  # upstream settings leak into the rendered file. The two structures are
  # encoded independently (string-level conditional) to avoid Terraform's
  # conditional type unification, which would otherwise inject null attributes.
  ingest_settings = var.upstream_enabled ? jsonencode(merge(local.ingest_base_settings, {
    upstream = {
      enabled = true
      api = {
        baseUrl = var.upstream_api_base_url
        apiKey  = var.upstream_api_key
      }
      brokerOptions = {
        rejectUnauthorized = var.upstream_reject_unauthorized
      }
      robotMapping = var.upstream_robot_mapping
      forwarding = {
        denyTopicSuffixes       = var.upstream_deny_topic_suffixes
        publishRetainedMessages = true
      }
      credentialEncryptionKey = random_id.mqtt_credential_encryption_key.hex
      logging                 = false
    }
  })) : jsonencode(merge(local.ingest_base_settings, {
    modules = { upstream = { enabled = false } }
  }))
}

resource "local_file" "ingest_settings" {
  filename        = "${path.module}/../ingest/settings.json"
  file_permission = "0644"
  content         = local.ingest_settings
}
