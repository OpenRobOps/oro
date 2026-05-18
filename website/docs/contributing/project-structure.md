---
sidebar_position: 2
---

# Project Structure

Overview of the OpenRobOps repository layout and key directories.

## Top-Level Structure

```
oro/
├── app/             # Meteor application (client + server)
├── ingest/          # Telemetry ingest service
├── mqtt/            # Mosquitto broker config & Docker Compose
├── terraform/       # Settings generation (Terraform)
├── scripts/         # Utility scripts
├── website/         # Docusaurus documentation site
├── docs/            # Top-level repo docs (separate from website/)
├── k8s/             # Kubernetes manifests
├── README.md        # Project overview
├── README-dev.md    # Development environment setup
├── CONTRIBUTING.md  # Contribution guidelines
├── COPYRIGHT        # Copyright notices
└── LICENSE          # Apache License 2.0
```

## `app/` — Meteor Application

The main application, serving both the React frontend and the REST API backend.

```
app/
├── client/
│   └── main.jsx              # Client entry point
├── server/
│   └── main.js               # Server entry point
├── imports/
│   ├── client/
│   │   └── oro/
│   │       ├── fleetWidgets/        # Fleet-level dashboard widgets
│   │       │   ├── IncidentTimeline/
│   │       │   ├── IncidentList/
│   │       │   ├── AuditLogs/
│   │       │   └── TextWidget/
│   │       ├── robotWidgets/        # Robot-specific widgets
│   │       │   ├── VitalsWidget/
│   │       │   ├── CustomDataWidget/
│   │       │   ├── DiagnosticsWidget/
│   │       │   ├── TimelineWidget/
│   │       │   ├── LocalizationWidget/
│   │       │   ├── ListDataWidget/
│   │       │   ├── ActionsWidget/
│   │       │   ├── CameraView/
│   │       │   ├── Lock/
│   │       │   ├── RobotControlBar/
│   │       │   └── RobotInfoButtons/
│   │       └── navigationWidgets/   # Teleop / navigation composite widgets
│   ├── server/
│   │   ├── rest_api.js              # Main API router
│   │   ├── rest_api_common.js       # Shared API utilities
│   │   ├── rest/
│   │   │   ├── robots.js            # Robots REST endpoints
│   │   │   ├── attributes.js        # Attributes REST endpoints
│   │   │   ├── localization.js      # Localization REST endpoints
│   │   │   └── configAPI.js         # ConfigAPI REST endpoints
│   │   ├── configAPI/
│   │   │   ├── configAPI.js         # ConfigAPI core logic
│   │   │   ├── dataSourceDefinitions.js
│   │   │   ├── statusDefinitions.js
│   │   │   ├── validators.js
│   │   │   └── utils.js
│   │   ├── oauthConfig.js           # OAuth provider setup
│   │   ├── model.js                 # Robot model
│   │   ├── roles.js                 # RBAC implementation
│   │   └── attributes.js            # Attributes manager
│   ├── lib/
│   │   └── collections.js           # MongoDB collection schemas
│   └── shared/
│       ├── configAPI.js             # Shared ConfigAPI constants
│       └── roles.js                 # Shared role definitions
├── private/
│   └── oro.proto                    # Protobuf definitions (client copy)
├── tests/
│   └── main.js                      # Test entry point
├── .meteor/
│   ├── release                      # Meteor version (3.4)
│   └── packages                     # Meteor packages
├── package.json
└── run.sh                           # Dev start script
```

## `ingest/` — Telemetry Ingest Service

Standalone Node.js service that processes MQTT telemetry.

```
ingest/
├── src/
│   ├── main.js                      # Entry point
│   ├── mongo.js                     # MongoDB connection manager
│   ├── server/
│   │   ├── mqtt.js                  # MQTT client wrapper
│   │   ├── peer.js                  # Peer API client
│   │   └── modules/
│   │       ├── index.js             # Module exports
│   │       ├── basics.js            # BasicsModule
│   │       ├── system.js            # SystemModule
│   │       ├── localization.js      # RobotLocalizationModule
│   │       ├── customData.js        # CustomDataModule
│   │       ├── diagnostics.js       # DiagnosticsModule
│   │       └── customCommands.js    # CustomCommandsModule
│   ├── shared/
│   │   └── oro.proto                # Protobuf definitions (source of truth)
│   └── lib/
│       └── util.js                  # Utility functions
├── settings.json                    # Service configuration (generated)
├── package.json
└── run.sh                           # Dev start script
```

## `mqtt/` — MQTT Broker

Mosquitto broker configuration and Docker Compose setup.

```
mqtt/
├── docker-compose.yml               # Mosquitto container definition
└── mosquitto/
    └── mosquitto.conf               # Broker config (ports, auth, ACL)
```

## `terraform/` — Configuration Generation

Terraform configuration for generating service settings files.

```
terraform/
├── main.tf                          # Settings file generation
├── variables.tf                     # Configurable variables
└── local.tfvars                     # Local overrides (user-created)
```

## `scripts/` — Utility Scripts

```
scripts/
├── generate-settings.sh             # Generate settings.json files
├── build-app-image.sh               # Build the app Docker image
├── build-ingest-image.sh            # Build the ingest Docker image
└── smoke-test-app-image.sh          # Smoke-test a built app image
```

## `website/` — Documentation

This Docusaurus site.

```
website/
├── docs/                            # Documentation pages (Markdown)
├── blog/                            # Blog posts
├── src/                             # Custom React components
├── static/                          # Static assets
├── docusaurus.config.ts             # Site configuration
└── sidebars.ts                      # Sidebar structure
```

## Next Steps

- [Quick Start](../getting-started/quick-start.md) — get the dev environment running
- [System Architecture](../architecture/system-architecture.md) — how components interact
- [Contributing Guide](./contributing-guide.md) — how to submit changes
