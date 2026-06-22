# SpecSpace Deployment Boundary

SpecSpace is deployed as a standalone viewer/API surface over a readonly
SpecGraph workspace. SpecGraph remains the producer and owner of canonical
specs and run artifacts; SpecSpace is a consumer that exposes stable
`/api/v1/*` contracts and serves the SpecSpace UI.

The product boundary is documented in
[`SPECSPACE_BOUNDARY.md`](SPECSPACE_BOUNDARY.md). In short: SpecSpace owns
readonly SpecGraph/SpecPM inspection, not ContextBuilder conversation authoring.

## Runtime Shape

```text
Browser
  |
  | http://127.0.0.1:5173
  v
SpecSpace UI container
  - serves graphspace/dist
  - proxies /api/* to specspace-api:8001
  |
  | http://specspace-api:8001/api/v1/*
  v
SpecSpace API container
  - viewer/server.py
  - binds 0.0.0.0:8001 inside Compose
  - readonly SpecGraph provider
  |
  +-- /specgraph/specs/nodes  readonly mount
  +-- /specgraph/runs         readonly mount
  +-- /specgraph              optional readonly mount
```

Cloud deployments that cannot mount files can use the HTTP/static provider
instead:

```text
SpecSpace API container
  - viewer/server.py --artifact-base-url https://specgraph.tech --specpm-registry-url https://specpm.dev
  |
  +-- https://specgraph.tech/artifact_manifest.json
  +-- https://specgraph.tech/specs/nodes/*.yaml
  +-- https://specgraph.tech/runs/*.json
  +-- https://specpm.dev/v0/status/
  +-- https://specpm.dev/v0/packages/
```

## Public Workspace Routes

A public SpecSpace deployment can expose multiple workspaces through route-level
selection while staying one application:

```text
specgraph.space/
  -> SpecGraph bootstrap/showcase workspace

specgraph.space/team-decision-log
  -> Team Decision Log product_idea_to_spec pilot workspace
```

Each route should resolve to a workspace record and an artifact manifest. The
root route keeps the current SpecGraph showcase. The Team Decision Log route
uses product workspace artifacts and should expose idea-to-spec surfaces:
event-storming intake, ontology/domain/context frame, candidate graph,
pre-SIB/coherence status, repair history, and promotion gate state.

The route must not make SpecSpace a writer. Product routes remain readonly
until a Graph Repository Service promotion request explicitly prepares a
branch/review under `product_spec_workspace` authority. The
`/team_decision_log` spelling may redirect to `/team-decision-log`.

## Ports

- UI: host `5173` -> container `80`
- API: host `8001` -> container `8001`

The UI container is the user-facing entrypoint. It serves static SpecSpace UI
assets and proxies `/api` to the API container so browser fetch URLs stay
same-origin.

## Mounts

| Host source | Container path | Required | Mode | Purpose |
| --- | --- | --- | --- | --- |
| SpecGraph `specs/nodes` | `/specgraph/specs/nodes` | yes | readonly | Canonical SpecGraph nodes |
| SpecGraph `runs` | `/specgraph/runs` | yes | readonly | Viewer surfaces and run activity |
| SpecGraph repository root | `/specgraph` | optional | readonly | SpecPM lifecycle and operator diagnosis |
| Dialog JSON directory | `/data/dialogs` | optional | readonly | Legacy ContextBuilder endpoints |

For SpecSpace deployment smoke, the `specs/nodes` and `runs` mounts are the
important boundary. Dialog JSON is kept only because `viewer/server.py` still
requires `--dialog-dir`; it is not part of the SpecSpace product contract.

## Out Of Scope

SpecSpace deployment does not include conversation authoring, checkpoint
editing, branch/merge/delete flows, or legacy Hyperprompt compile authoring.
Those are legacy ContextBuilder workflows exposed through `viewer/app` and
legacy routes such as `/api/file`, `/api/conversation`, `/api/checkpoint`, and
`/api/compile`.

Readonly SpecGraph Markdown export is compatible with this deployment boundary
when exposed through `/api/v1/*`. Hyperprompt compilation is not part of the
default deployment contract and should be enabled only by an explicit capability
with a configured compiler binary and scratch workspace.

The SpecSpace UI should consume `/api/v1/*` for runtime data. Non-versioned
legacy routes may remain in the backend for compatibility, but they are not
SpecSpace deployment contracts.

## API Startup Contract

The default API container starts with the required graph and runs surfaces:

```bash
python viewer/server.py \
  --host 0.0.0.0 \
  --port 8001 \
  --dialog-dir /data/dialogs \
  --spec-dir /specgraph/specs/nodes \
  --runs-dir /specgraph/runs
```

`--specgraph-dir` is optional for deployments that only need graph and runs
surfaces. When it is omitted, `/api/v1/specpm/lifecycle` reports a degraded or
unconfigured source instead of making the graph viewer unavailable. Operators
that need SpecPM lifecycle surfaces can add a readonly SpecGraph root mount and
start the API with `--specgraph-dir /specgraph`.

For static HTTP artifacts, omit `--spec-dir` and `--runs-dir` and use:

```bash
python viewer/server.py \
  --host 0.0.0.0 \
  --port 8001 \
  --dialog-dir /data/dialogs \
  --artifact-base-url https://specgraph.tech \
  --specpm-registry-url https://specpm.dev
```

The same value can be supplied through `SPECSPACE_ARTIFACT_BASE_URL`.
The SpecPM registry URL can be supplied through `SPECSPACE_SPECPM_REGISTRY_URL`.

Optional Hyperprompt compile is disabled unless a deployment configures a
compiler binary and an explicit scratch workspace. Local file-provider
deployments need only those two settings. HTTP/static artifact deployments must
also opt in with `SPECSPACE_HYPERPROMPT_HTTP_COMPILE_ENABLED=true` or
`--enable-http-hyperprompt-compile`.

The scratch workspace is reported through `/api/v1/capabilities`; SpecSpace
does not create it or write to mounted or remote SpecGraph inputs while checking
capabilities. When enabled, `POST /api/v1/spec-markdown/compile` writes a
generated Markdown export bundle inside this scratch workspace and invokes
Hyperprompt there. SpecSpace marks its own bundle directories and prunes old
SpecSpace-owned bundles by retention count; it does not delete unrelated files
in the scratch directory.

```bash
python viewer/server.py \
  --host 0.0.0.0 \
  --port 8001 \
  --dialog-dir /data/dialogs \
  --spec-dir /specgraph/specs/nodes \
  --runs-dir /specgraph/runs \
  --hyperprompt-binary /opt/hyperprompt/bin/hyperprompt \
  --hyperprompt-work-dir /data/specspace-hyperprompt
```

`--hyperprompt-work-dir` can also be supplied through
`SPECSPACE_HYPERPROMPT_WORK_DIR`.

For HTTP/static artifact deployments, add the explicit opt-in and optional
limits:

```bash
export SPECSPACE_HYPERPROMPT_HTTP_COMPILE_ENABLED=true
export SPECSPACE_HYPERPROMPT_WORK_DIR=/data/specspace-hyperprompt
export SPECSPACE_HYPERPROMPT_COMPILE_TIMEOUT_SECONDS=60
export SPECSPACE_HYPERPROMPT_MAX_INPUT_BYTES=1048576
export SPECSPACE_HYPERPROMPT_MAX_OUTPUT_BYTES=2097152
export SPECSPACE_HYPERPROMPT_BUNDLE_RETENTION_COUNT=20
```

If the HTTP feature flag is omitted, HTTP deployments continue to expose
readonly Markdown export only and report `http_compile_disabled`.

## Local Developer Restart

For local SpecSpace UI development, use the detached restart wrapper instead of
manually keeping old `screen` sessions alive:

```bash
make specspace-restart
```

This restarts:

- SpecSpace API on `127.0.0.1:8001`
- SpecSpace dev UI on `127.0.0.1:5173`

The restart is intentionally idempotent. It stops the known
`specspace_backend` and `specspace_graphspace` screen sessions, clears any
stale listeners on the configured API/UI ports, starts fresh processes from the
current checkout, and probes `/api/v1/health` plus the UI root before returning.
This prevents stale backend processes from serving an old route table after a
merge or pull.

Useful commands:

```bash
make specspace-status
make specspace-stop
make specspace-start
```

Logs are written under `.specspace-dev/`:

```text
.specspace-dev/backend.log
.specspace-dev/graphspace.log
```

The Makefile passes the same default local paths used by the existing
developer launch targets. Override them when needed:

```bash
make specspace-restart \
  DIALOG_DIR=/absolute/path/to/canonical_json \
  SPEC_DIR=/absolute/path/to/SpecGraph/specs/nodes \
  SPECGRAPH_DIR=/absolute/path/to/SpecGraph
```

## Health Expectations

`GET /api/v1/health` is the deployment boundary check. It must report:

- `api_version: "v1"`
- `provider: "file"` or `provider: "http"`
- `read_only: true`
- `sources.spec_nodes.status`
- `sources.runs.status`
- `sources.specgraph_root.status`

Expected source states:

- `ok`: source exists and contains matching files.
- `empty`: source exists and is readable, but has no matching files.
- `missing`: configured path does not exist.
- `not_directory`: configured path is not a directory.
- `unreadable`: configured path cannot be read.
- `not_configured`: optional path was not configured.

The aggregate health is:

- `ok` when required spec nodes are readable and optional sources are readable
  or unconfigured.
- `degraded` when required spec nodes are readable but configured optional
  sources are missing, unreadable, or otherwise invalid.
- `unavailable` when required spec nodes are missing or unreadable.

For the HTTP provider, `sources.artifact_manifest.status` must be `ok`, and
`sources.spec_nodes.item_count` should match the published SpecGraph node count.

## Smoke Scope

Deployment smoke should verify:

- `GET /api/v1/health` returns JSON `200`.
- `GET /api/v1/spec-graph` returns JSON `200` and a graph summary.
- `GET /api/v1/runs/recent` returns JSON `200`.
- The UI entrypoint returns HTML `200`.
- `/api` is reachable through the UI container proxy.
- `GET /api/v1/specpm/registry` returns JSON `200` when the readonly SpecPM
  registry URL is configured.
- SpecGraph mounts are readonly in the compose definition.

Smoke should not mutate SpecGraph. Any future test that needs write behavior
belongs in SpecGraph producer validation, not SpecSpace deployment validation.

## Compose Entrypoint

The local deployment file is `compose.specspace.yml`.

For a production-like local topology that reads SpecGraph artifacts and SpecPM
registry metadata over HTTP, use
[`LOCAL_DEPLOYMENT_LAB.md`](LOCAL_DEPLOYMENT_LAB.md).

For Timeweb Cloud Apps, use the root `docker-compose.yml` entrypoint and the
Timeweb-specific notes in [`TIMEWEB_DEPLOYMENT.md`](TIMEWEB_DEPLOYMENT.md).

## Docker Deployment Guide

### Prerequisites

- Docker Desktop or a Docker Engine with Compose support.
- A checked-out SpecGraph workspace.
- Read access to SpecGraph `specs/nodes` and `runs`.

The default Compose deployment is intentionally readonly. SpecSpace reads
SpecGraph artifacts but does not own or mutate them.

### Configure Mounts

Set the required SpecGraph mount paths:

```bash
export SPECGRAPH_ROOT=/absolute/path/to/SpecGraph
export SPECSPACE_SPEC_NODES_DIR="$SPECGRAPH_ROOT/specs/nodes"
export SPECSPACE_RUNS_DIR="$SPECGRAPH_ROOT/runs"
```

Optional settings:

```bash
export SPECSPACE_API_PORT=8001
export SPECSPACE_UI_PORT=5173
export SPECSPACE_DIALOG_DIR=./runs/dialogs
```

`SPECSPACE_DIALOG_DIR` defaults to `./runs/dialogs` and is only kept for
legacy ContextBuilder routes. The SpecSpace API v1 graph surfaces do not require
dialog JSON.

### Start SpecSpace

For foreground logs:

```bash
docker compose -f compose.specspace.yml up --build
```

For manual browser testing, detached mode is usually more convenient:

```bash
docker compose -p specspace_manual -f compose.specspace.yml up -d --build
```

To run beside a local dev server that already uses `5173` and `8001`, pick
alternate host ports:

```bash
SPECSPACE_UI_PORT=5183 \
SPECSPACE_API_PORT=8011 \
docker compose -p specspace_manual -f compose.specspace.yml up -d --build
```

Then open:

```text
http://127.0.0.1:5173
```

The API is also exposed on:

```text
http://127.0.0.1:8001
```

When using custom ports, open `http://127.0.0.1:${SPECSPACE_UI_PORT}` and
`http://127.0.0.1:${SPECSPACE_API_PORT}` instead.

### Verify The Deployment

Check API health:

```bash
curl http://127.0.0.1:${SPECSPACE_API_PORT:-8001}/api/v1/health
```

Check the UI proxy to the runs surface:

```bash
curl "http://127.0.0.1:${SPECSPACE_UI_PORT:-5173}/api/v1/runs/recent?limit=1"
```

Run the deployment smoke against an already-running stack:

```bash
SPECSPACE_SMOKE_MODE=probe scripts/smoke-specspace-deploy.sh
```

Or let the smoke script build, start, test, and tear down its own stack:

```bash
SPECSPACE_SMOKE_MODE=compose scripts/smoke-specspace-deploy.sh
```

### Stop SpecSpace

For the default foreground command, press `Ctrl-C`.

For the detached manual stack:

```bash
docker compose -p specspace_manual -f compose.specspace.yml down --remove-orphans
```

For a default detached stack without `-p specspace_manual`:

```bash
docker compose -f compose.specspace.yml down --remove-orphans
```

### Optional SpecPM Lifecycle Surface

The default Compose file mounts only the required `specs/nodes` and `runs`
directories. In that mode `/api/v1/specpm/lifecycle` can return `503` with
`specgraph_root.status: "not_configured"`. This is expected: graph, runs,
recent changes, and canvas surfaces remain available.

Deployments that need SpecPM lifecycle diagnostics can add a readonly SpecGraph
root mount and start the API with `--specgraph-dir /specgraph`. Keep that mount
readonly; lifecycle diagnostics should not turn SpecSpace into a SpecGraph
producer.

For static production deployments, prefer the published SpecPM registry when
SpecPM package metadata is needed:

```text
https://0al-spec.github.io/SpecPM
```

The registry is a readonly `/v0` metadata API. It can support Timeweb and other
static deployments without mounting a local SpecGraph checkout. SpecSpace must
treat registry data as metadata only: it must not execute package content or
infer package authority beyond the registry payload.

### Adjacent SpecPM Runtime

SpecSpace does not require a running SpecPM service in this Compose stack. The
current deployment boundary is file-backed: SpecPM and SpecGraph can produce
artifacts, and SpecSpace reads the mounted `specs/nodes` and `runs` trees.

When an operator does run SpecPM beside SpecSpace, record the SpecPM image
digest together with the SpecSpace commit and SpecGraph workspace revision:

```text
SpecPM image: specpm@sha256:<digest>
SpecSpace commit: <git-sha>
SpecGraph workspace: <git-sha-or-path>
```

This pin is diagnostic metadata, not a runtime dependency. If a future
deployment switches SpecSpace from file-backed reads to an HTTP-backed SpecPM or
SpecGraph provider, that provider contract should be documented separately from
this readonly Compose boundary.

## Smoke Script

Use `scripts/smoke-specspace-deploy.sh` to validate the deployment boundary.
The script always checks the compose config for readonly SpecGraph mounts and
probes health, graph, runs, UI HTML, and UI-proxied API surfaces.

Probe an already-running deployment:

```bash
export SPECGRAPH_ROOT=/absolute/path/to/SpecGraph
export SPECSPACE_SPEC_NODES_DIR="$SPECGRAPH_ROOT/specs/nodes"
export SPECSPACE_RUNS_DIR="$SPECGRAPH_ROOT/runs"
SPECSPACE_SMOKE_MODE=probe scripts/smoke-specspace-deploy.sh
```

Build, start, smoke, and tear down through Compose:

```bash
export SPECGRAPH_ROOT=/absolute/path/to/SpecGraph
export SPECSPACE_SPEC_NODES_DIR="$SPECGRAPH_ROOT/specs/nodes"
export SPECSPACE_RUNS_DIR="$SPECGRAPH_ROOT/runs"
SPECSPACE_SMOKE_MODE=compose scripts/smoke-specspace-deploy.sh
```

Optional overrides:

- `SPECSPACE_API_PORT`, default `8001`
- `SPECSPACE_UI_PORT`, default `5173`
- `SPECSPACE_API_BASE_URL`, default `http://127.0.0.1:${SPECSPACE_API_PORT}`
- `SPECSPACE_UI_BASE_URL`, default `http://127.0.0.1:${SPECSPACE_UI_PORT}`
- `PYTHON`, default `python3`

## Operator Notes

- If `/api/v1/health` reports `unavailable`, first inspect
  `sources.spec_nodes`; this is the required source for the graph.
- If health reports `degraded`, inspect optional configured sources such as
  `sources.specgraph_root`. The graph can still load while optional SpecPM
  lifecycle surfaces are unavailable.
- If the UI loads but panels fall back to samples, check the UI proxy with
  `curl http://127.0.0.1:5173/api/v1/health`.
- Keep SpecGraph and SpecSpace revisions explicit in deployment notes. The
  current smoke validates runtime compatibility; it does not prove producer and
  consumer commits were intentionally paired.
