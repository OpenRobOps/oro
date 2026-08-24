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
├── docs/            # Design specs & implementation plans (not user docs)
├── k8s/             # Kubernetes manifests
├── README.md        # Project overview
├── README-dev.md    # Development environment setup
├── RELEASING.md     # Release process (tags → images)
├── CONTRIBUTING.md  # Contribution guidelines
├── oro.code-workspace  # VS Code multi-root workspace
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
│   │   ├── Styles.js                # Theme system: THEMES registry, hot-apply
│   │   ├── themes/                  # Per-theme design token files
│   │   └── oro/
│   │       ├── fleetWidgets/        # Fleet-level dashboard widgets
│   │       │   ├── FleetStatusWidget/
│   │       │   ├── FleetControlWidget/
│   │       │   ├── IncidentTimeline/
│   │       │   ├── IncidentList/
│   │       │   ├── AuditLogs/
│   │       │   └── TextWidget/
│   │       ├── robotWidgets/        # Robot-specific widgets
│   │       │   ├── VitalsWidget/
│   │       │   ├── CustomDataWidget/
│   │       │   ├── DiagnosticsWidget/
│   │       │   ├── TimelineWidget/
│   │       │   ├── ListDataWidget/
│   │       │   ├── ActionsWidget/ + ActionsMenu/
│   │       │   ├── CameraView/
│   │       │   ├── Lock/
│   │       │   ├── RobotControlBar/
│   │       │   └── RobotInfoButtons/
│   │       ├── navigationWidgets/   # Teleop / navigation composite widgets
│   │       ├── Dashboard/           # Dashboard renderer, widget factories
│   │       ├── Settings/            # Settings screens (users, appearance, ...)
│   │       ├── Notifications/       # Incident notification banners
│   │       └── contexts/, hooks/, Auth/, Routes/, util/, graphics/
│   ├── server/
│   │   ├── rest_api.js              # Main API router
│   │   ├── rest_api_common.js       # Shared API utilities
│   │   ├── rest/
│   │   │   ├── robots.js            # Robots REST endpoints
│   │   │   ├── attributes.js        # Attributes REST endpoints
│   │   │   ├── localization.js      # Localization REST endpoints
│   │   │   ├── actions.js           # Actions REST endpoints
│   │   │   ├── locks_rest_api.js    # Locks REST endpoints
│   │   │   ├── navigation.js        # Navigation REST endpoints
│   │   │   └── configAPI.js         # ConfigAPI REST endpoints
│   │   ├── configAPI/
│   │   │   ├── configAPI.js         # ConfigAPI core logic
│   │   │   ├── dataSourceDefinitions.js
│   │   │   ├── statusDefinitions.js
│   │   │   ├── actionDefinitions.js
│   │   │   ├── dashboards.js
│   │   │   ├── incidentDefinitions.js
│   │   │   ├── notificationChannels.js
│   │   │   ├── moduleState.js
│   │   │   ├── validators.js
│   │   │   └── utils.js
│   │   ├── alertsManager.js         # Alerts → incidents pipeline
│   │   ├── incidentsManagementSubsystem.js
│   │   ├── notifications.js         # In-app notifications
│   │   ├── agentManager.js          # Agent module states
│   │   ├── oauthConfig.js           # OAuth provider setup
│   │   ├── model/                   # Models (robot, incident, ...)
│   │   ├── roles.js                 # RBAC implementation
│   │   └── attributes.js            # Attributes manager
│   ├── lib/
│   │   └── collections.js           # MongoDB collection schemas
│   └── shared/
│       ├── configAPI.js             # Shared ConfigAPI constants
│       └── roles.js                 # Shared role definitions
├── private/
│   └── oro.proto                    # Protobuf definitions (source of truth, git-tracked)
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
│   │   ├── mqtt.js                  # MQTT client wrapper (OroMqtt)
│   │   ├── peer.js                  # Peer API client
│   │   ├── attributes.js            # Attributes manager
│   │   ├── status.js                # Status rule evaluation → alerts
│   │   ├── model/                   # Models
│   │   ├── queues/                  # In-memory work queues
│   │   └── modules/
│   │       ├── index.js             # Module exports
│   │       ├── basics.js            # BasicsModule
│   │       ├── system.js            # SystemModule
│   │       ├── localization.js      # RobotLocalizationModule
│   │       ├── customData.js        # CustomDataModule
│   │       ├── events.js            # RobotEventsModule
│   │       ├── diagnostics.js       # DiagnosticsModule
│   │       ├── customCommands.js    # CustomCommandsModule
│   │       └── upstream.js          # UpstreamModule
│   ├── services/                    # Derived attributes service
│   ├── shared/                      # Generated by import.sh — do not edit
│   │   └── oro.proto                # Copied from app/private/
│   └── lib/
│       └── util.js                  # Utility functions
├── test/                            # Mocha tests
├── import.sh                        # Syncs shared files from app/
├── settings.json                    # Service configuration (generated)
├── package.json
└── run.sh                           # Dev start script (runs import.sh)
```

## `mqtt/` — MQTT Broker

Mosquitto broker configuration and Docker Compose setup.

```
mqtt/
├── docker-compose.yml               # Mosquitto container definition
├── run.sh                           # Dev start script
└── mosquitto/
    └── mosquitto.conf               # Broker config (ports, auth, ACL)
```

## `terraform/` — Configuration Generation

Terraform configuration for generating service settings files.

```
terraform/
├── main.tf                          # Settings file generation
├── variables.tf                     # Configurable variables
├── outputs.tf                       # Outputs
└── local.tfvars                     # Local overrides (user-created)
```

Generated secrets live in `terraform.tfstate` — treat the state file as
sensitive and never commit it.

## `scripts/` — Utility Scripts

```
scripts/
├── generate-settings.sh             # Generate settings.json files
├── start-local-env.sh               # Launch all services in a tmux session
├── stop-local-env.sh                # Stop the tmux session
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
