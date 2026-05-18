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

output "web_app_settings_path" {
  description = "Path to the generated web app settings.json"
  value       = local_file.web_app_settings.filename
}

output "ingest_settings_path" {
  description = "Path to the generated ingest settings.json"
  value       = local_file.ingest_settings.filename
}
