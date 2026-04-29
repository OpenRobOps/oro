# ORO Development environment

## Requirements

 * `node` v22 and `nvm`
 * Meteor 3.4
  ```
  npx meteor
  ```
* Terraform: https://developer.hashicorp.com/terraform
* `docker` with the `compose` plugin (`docker compose` command)
* `tmux`

## Prepare config files

Local configuration files require some credentials and keys for services to interact.
Some of these are randomized; and settings files are not Git-controlled.

To configure OAuth mechanisms, create a file `terraform/local.tfvars` with some of these contents (uncommenting and entering your secrets):

```
# If using Google auth, create a Google app and enter these values
# oauth_google_client_id = ""
# oauth_google_secret    = ""

# If using Google auth, create a Github app and enter these values
# oauth_github_client_id = ""
# oauth_github_secret    = ""

# If authenticating via email and passcodes, enter a 
# smtp_url = "smtp://USER:PASS@SOME_SMTP_SERVER:PORT"
```

In `/scripts`, use `generate-settings.sh` to generate settings files (for ingest and appserver). Secrets are managed by Terraform `random` resources and persist in state across runs, so it is safe to re-run.

 * `generate-settings.sh` — apply the Terraform configuration, preserving existing secrets (default).
 * `generate-settings.sh --plan` — preview changes without writing files.
 * `generate-settings.sh --clean` — regenerate all secrets from scratch.

You can check created files `app/settings.json` and `ingest/settings.json`; as well as further customize them.

## Run services (manually)

First make sure `npm` packages are installed. This can be done only once (unless you packages are added). Under `/ingest` and `/app`, run `npm i`.

Then to run all services, just run `start-local-env.sh`.

Alternatively, run components manually. Each of these on its own terminal window:

 * in `/mqtt`: `docker compose up`
 * in `/app`: `./run.sh`. Note: this runs both meteor and a mongodb instance (for now)
 * in `/ingest`: `./run.sh`

Finally point your browser to http://localhost:3000/

## Environment overview

The following components are run by the previous scripts:

| Name | Description | Port |
|------|-------------|------|
| Mosquitto (MQTT) | MQTT broker; auth via Meteor MongoDB | 1883 (MQTT), 9001 (WebSockets) |
| Web / App | Meteor app + MongoDB (`./run.sh` in `/app`); main UI | 3000 |
| MongoDB | Database used by Meteor (run via `/app` run.sh) | 3001 |
| Ingest | Ingest service (`./run.sh` in `/ingest`); connects to MQTT and MongoDB | — |

## Instance initial setup

1. User/Role

Initial version allows registering any user, but none receives any role. After you have signed in to the app (with any method: oauth, email), and get presented a "Please contact your team admin" dialog, use mongodb to tweak your user.

Open mongodb (at localhost:3001), use `meteor` database, find `users` collection. On your user object, add a string element to `userRoles` key: `"admin"`.

