terraform {
  required_version = ">= 1.0"
}

resource "local_file" "web_app_settings" {
  filename        = "${path.module}/../web/app/settings.json"
  file_permission = "0644"
  content         = jsonencode(merge(
    {
      allowedOrigins = []
      allowedHeaders = []
      mqtt = {
        credentialEncryptionKey = var.mqtt_credential_encryption_key
        masterCredentials = {
          username = var.mqtt_master_username
          password = var.mqtt_master_password
        }
        brokers = {
          local = {
            protocol             = "mqtt://"
            hostname             = var.hostname
            port                 = var.mqtt_port
            websocket_port       = var.mqtt_websocket_port
            websocket_protocol   = "ws://"
            username             = var.mqtt_master_username
            password             = var.mqtt_master_password
          }
        }
        defaultBrokerId = "local"
      }
      peerKey = var.peer_key
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

resource "local_file" "ingest_settings" {
  filename        = "${path.module}/../ingest/settings.json"
  file_permission = "0644"
  content         = jsonencode({
    mqtt = {
      brokers = {
        local = {
          protocol             = "mqtt://"
          hostname             = var.hostname
          port                 = var.mqtt_port
          websocket_port       = var.mqtt_websocket_port
          websocket_protocol   = "ws://"
          username             = var.mqtt_master_username
          password             = var.mqtt_master_password
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
      peerKey           = var.peer_key
      connectionPooling = true
    }
  })
}
