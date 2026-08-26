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

variable "smtp_url" {
  description = "SMTP connection URL"
  type        = string
  default     = ""
}

variable "admin_emails" {
  description = "List of administrator email addresses. Users matching one of these are granted the 'admin' role on account creation."
  type        = list(string)
  default     = []
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

variable "upstream_enabled" {
  description = "Enable the ingest UpstreamModule (forwards local robot telemetry to an upstream ORO/InOrbit MQTT broker)"
  type        = bool
  default     = false
}

variable "upstream_api_base_url" {
  description = "Base URL of the upstream server exposing /mqtt_config (e.g. https://control.inorbit.ai)"
  type        = string
  default     = ""
}

variable "upstream_api_key" {
  description = "Upstream-issued robot API key used to call /mqtt_config and provision per-robot credentials"
  type        = string
  sensitive   = true
  default     = ""
}

variable "upstream_robot_mapping" {
  description = "List of {localRobotId, upstreamRobotId} pairs to forward upstream"
  type = list(object({
    localRobotId    = string
    upstreamRobotId = string
  }))
  default = []
}

variable "upstream_display_name" {
  description = "Actor name shown in local audit logs for commands arriving over the upstream link (e.g. \"Space Intelligence\")"
  type        = string
  default     = "Upstream"
}

variable "upstream_reject_unauthorized" {
  description = "Verify upstream broker TLS certificate. Set to false only for testing with self-signed certs."
  type        = bool
  default     = true
}

variable "upstream_deny_topic_suffixes" {
  description = "Subtopics to drop instead of forwarding upstream (typically server->robot topics like in_cmd)"
  type        = list(string)
  default     = ["in_cmd", "modules/set_state"]
}

variable "iso21423_robots_enabled" {
  description = "Enable ISO 21423 ISO Robots mode in ingest: ISO-native robots join the fleet. Disabled by default."
  type        = bool
  default     = false
}

variable "iso21423_upstream_enabled" {
  description = "Enable the ISO 21423 Upstream bridge in ingest: present ORO's fleet to an upper ISO fleet manager. Disabled by default."
  type        = bool
  default     = false
}
