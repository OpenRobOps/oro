variable "hostname" {
  description = "Hostname for MQTT broker and services"
  type        = string
  default     = "localhost"
}

variable "mqtt_port" {
  description = "MQTT broker port"
  type        = number
  default     = 1883
}

variable "mqtt_websocket_port" {
  description = "MQTT WebSocket port"
  type        = number
  default     = 9001
}

variable "mqtt_master_username" {
  description = "MQTT master credentials username"
  type        = string
  default     = "ingest-master"
}

variable "mqtt_master_password" {
  description = "MQTT master credentials password"
  type        = string
  sensitive   = true
}

variable "mqtt_credential_encryption_key" {
  description = "Hex-encoded 256-bit key for encrypting MQTT credentials"
  type        = string
  sensitive   = true
}

variable "peer_key" {
  description = "Peer API key"
  type        = string
  sensitive   = true
}

variable "smtp_url" {
  description = "SMTP connection URL"
  type        = string
  default     = ""
}

variable "oauth_google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
}

variable "oauth_google_secret" {
  description = "Google OAuth secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "oauth_github_client_id" {
  description = "GitHub OAuth client ID"
  type        = string
  default     = ""
}

variable "oauth_github_secret" {
  description = "GitHub OAuth secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "mongo_url" {
  description = "MongoDB connection URL"
  type        = string
  default     = "mongodb://localhost:3001"
}

variable "mongo_db" {
  description = "MongoDB database name"
  type        = string
  default     = "meteor"
}

variable "mongo_max_pool_size" {
  description = "MongoDB max pool size"
  type        = number
  default     = 10
}

variable "mongo_connect_timeout_ms" {
  description = "MongoDB connect timeout in milliseconds"
  type        = number
  default     = 5000
}

variable "peer_client_url" {
  description = "Peer client URL"
  type        = string
  default     = "http://localhost:3000/"
}

variable "profiler_enabled" {
  description = "Enable ingest profiler"
  type        = bool
  default     = true
}
