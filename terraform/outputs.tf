output "web_app_settings_path" {
  description = "Path to the generated web app settings.json"
  value       = local_file.web_app_settings.filename
}

output "ingest_settings_path" {
  description = "Path to the generated ingest settings.json"
  value       = local_file.ingest_settings.filename
}
