# Releasing & Docker Images

This repo builds two first-party container images and publishes them to the
GitHub Container Registry (GHCR):

- `ghcr.io/openrobops/oro-app` — the Meteor web/API server
- `ghcr.io/openrobops/oro-ingest` — the telemetry ingest worker

Both are versioned **together** off a single git tag, so `oro-app:1.4.0` and
`oro-ingest:1.4.0` always refer to the same release.

## When images are built

| Event | Builds | Pushes | Tags produced |
|---|---|---|---|
| **Pull request** (touching the relevant paths) | ✓ | — | none (build is verified, nothing published) |
| **Push to `main`** | ✓ | ✓ | `:main` (moves), `:sha-<short>` (immutable) |
| **Push tag `vX.Y.Z`** | ✓ | ✓ | `:X.Y.Z`, `:X.Y`, `:latest`, `:sha-<short>` |

Workflows: [`build-app-image.yml`](.github/workflows/build-app-image.yml),
[`build-ingest-image.yml`](.github/workflows/build-ingest-image.yml). The app
build runs an end-to-end smoke test before pushing; ingest has no HTTP
port/healthcheck, so its gate is a successful build plus the unit tests in
[`test-ingest.yaml`](.github/workflows/test-ingest.yaml).

## Tag scheme — what each tag means

| Tag | Mutable? | Use it for |
|---|---|---|
| `:main` | **mutable** — moves on every push to `main` | dev/staging that should track latest `main` |
| `:sha-<short>` | **immutable** — one per commit | **production & rollback** — pin this for a reproducible deploy |
| `:X.Y.Z` (e.g. `:1.4.0`) | immutable | a specific release |
| `:X.Y` (e.g. `:1.4`) | mutable — moves to latest patch in the line | tracking a minor line |
| `:latest` | mutable — highest non-pre-release | convenience only; don't pin in prod |

**Rule of thumb:** deploy an immutable tag (`:X.Y.Z` or `:sha-<short>`) to
production; `:main`/`:latest` are conveniences, not deploy targets.

## Cutting a release

A release is just a `vX.Y.Z` git tag on a green `main`. There are two equivalent
ways to create it — pick either.

### Path A — Actions UI (recommended)

1. Go to the repo's **Actions** tab → **Release** workflow.
2. Click **Run workflow**.
3. Leave the branch at `main` (or pick the ref you're releasing).
4. Enter the **version** (`1.4.0`, or `1.4.0-rc1` for a pre-release; a leading
   `v` is optional). Tick **prerelease** if it's a pre-release.
5. Click **Run workflow**.

The [`release.yml`](.github/workflows/release.yml) workflow validates the
version, creates and pushes the `vX.Y.Z` tag, and publishes a GitHub Release
with auto-generated notes. The tag push then triggers both image builds.

> **One-time setup:** the workflow pushes the tag with a `RELEASE_TOKEN` secret.
> This is required because a tag pushed by the default `GITHUB_TOKEN` does **not**
> trigger other workflows (GitHub's recursion guard), so the image builds would
> never run. Create a repo/org secret named `RELEASE_TOKEN` — a Personal Access
> Token (or GitHub App token) with `contents:write` and `workflow` scope. If it
> isn't set, the release is still tagged, but you'll have to kick the builds
> yourself (e.g. re-run via `workflow_dispatch`, or use Path B).

### Path B — git tag from the CLI

From a clean checkout of the commit you want to release:

```sh
git checkout main && git pull
git tag -a v1.4.0 -m "Release v1.4.0"
git push origin v1.4.0
```

A human push uses your own credentials, so it triggers the image builds
normally. Create the GitHub Release afterward if you want notes:

```sh
gh release create v1.4.0 --generate-notes
```

Both paths produce the same result: `oro-app:1.4.0` + `oro-ingest:1.4.0`
(plus `:1.4`, `:latest`, `:sha-<short>`) in GHCR.

## Verifying a release

1. Watch the **Build oro-app image** and **Build oro-ingest image** runs in the
   Actions tab — both should go green.
2. Check the **Packages** section of the org/repo (or
   `https://ghcr.io/openrobops/oro-app`) and confirm the new `1.4.0`, `1.4`,
   `latest`, and `sha-<short>` tags are present on both images.
3. Optionally pull and inspect:
   ```sh
   docker pull ghcr.io/openrobops/oro-app:1.4.0
   docker pull ghcr.io/openrobops/oro-ingest:1.4.0
   ```

## Deploying & rolling back

K8s manifests under [`k8s/`](k8s/) default to `:main` for convenience. For
production, deploy an immutable tag instead of committing `:main`:

```sh
# Deploy a specific release
kubectl -n oro set image deploy/oro-app   app=ghcr.io/openrobops/oro-app:1.4.0
kubectl -n oro set image deploy/oro-ingest ingest=ghcr.io/openrobops/oro-ingest:1.4.0
```

**Rollback** is the same command pointed at a prior immutable tag — either an
earlier release or its `:sha-<short>`:

```sh
kubectl -n oro set image deploy/oro-app app=ghcr.io/openrobops/oro-app:1.3.2
# or by commit:
kubectl -n oro set image deploy/oro-app app=ghcr.io/openrobops/oro-app:sha-1a2b3c4
```

Because those tags are immutable, the rolled-back image is exactly what shipped
before. Wiring an automatic deploy/GitOps step is out of scope here.
