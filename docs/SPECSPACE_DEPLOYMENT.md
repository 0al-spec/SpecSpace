# SpecSpace Deployment Boundary

SpecSpace is deployed as a standalone viewer/API surface over a readonly
SpecGraph workspace. SpecGraph remains the producer and owner of canonical
specs and run artifacts; SpecSpace is a consumer that exposes stable
`/api/v1/*` contracts and serves the GraphSpace UI.

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
  - readonly file-backed SpecGraph provider
  |
  +-- /specgraph/specs/nodes  readonly mount
  +-- /specgraph/runs         readonly mount
  +-- /specgraph              optional readonly mount
```

## Ports

- UI: host `5173` -> container `80`
- API: host `8001` -> container `8001`

The UI container is the user-facing entrypoint. It serves static GraphSpace
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
requires `--dialog-dir`.

## API Startup Contract

The API container starts:

```bash
python viewer/server.py \
  --host 0.0.0.0 \
  --port 8001 \
  --dialog-dir /data/dialogs \
  --spec-dir /specgraph/specs/nodes \
  --runs-dir /specgraph/runs \
  --specgraph-dir /specgraph
```

`--specgraph-dir` is optional for deployments that only need graph and runs
surfaces. When it is omitted, `/api/v1/specpm/lifecycle` reports a degraded or
unconfigured source instead of making the graph viewer unavailable.

## Health Expectations

`GET /api/v1/health` is the deployment boundary check. It must report:

- `api_version: "v1"`
- `provider: "file"`
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

## Smoke Scope

Deployment smoke should verify:

- `GET /api/v1/health` returns JSON `200`.
- `GET /api/v1/spec-graph` returns JSON `200` and a graph summary.
- `GET /api/v1/runs/recent` returns JSON `200`.
- The UI entrypoint returns HTML `200`.
- `/api` is reachable through the UI container proxy.
- SpecGraph mounts are readonly in the compose definition.

Smoke should not mutate SpecGraph. Any future test that needs write behavior
belongs in SpecGraph producer validation, not SpecSpace deployment validation.
