# SpecSpace API v1

SpecSpace API v1 is the deployment boundary between the SpecSpace viewer and a
readonly SpecGraph workspace. SpecGraph remains the producer and owner of
`specs/nodes/` and `runs/`; SpecSpace reads those trees and exposes stable
versioned HTTP contracts for the UI.

Deployment topology and mount expectations are documented in
[SPECSPACE_DEPLOYMENT.md](SPECSPACE_DEPLOYMENT.md).

## Providers

SpecSpace API v1 can read SpecGraph through either readonly provider.

### File Provider

The local/operator provider is file-backed and readonly:

- `specs/nodes/` is the canonical SpecGraph node source.
- `runs/` is the artifact source for recent runs and viewer surfaces.
- `specgraph_dir` is optional and only needed for SpecPM lifecycle aggregation.
- The provider never writes to any of these paths.

Start it with:

```bash
python viewer/server.py \
  --dialog-dir /data/dialogs \
  --spec-dir /repo/SpecGraph/specs/nodes \
  --runs-dir /repo/SpecGraph/runs
```

### HTTP Artifact Provider

The HTTP/static artifact provider is readonly. It reads a static
SpecGraph artifact site published by the producer repository:

```text
https://specgraph.tech/artifact_manifest.json
https://specgraph.tech/specs/nodes/*.yaml
https://specgraph.tech/runs/*.json
```

Start it with either:

```bash
python viewer/server.py \
  --dialog-dir /data/dialogs \
  --artifact-base-url https://specgraph.tech
```

or:

```bash
SPECSPACE_ARTIFACT_BASE_URL=https://specgraph.tech \
python viewer/server.py --dialog-dir /data/dialogs
```

The manifest must have `artifact_kind:
specgraph_static_artifact_manifest`, a `files[]` array, and relative artifact
paths. Absolute paths, parent-directory traversal, and external URLs inside the
manifest are ignored.

HTTP artifact envelopes use the artifact URL in `path` and the manifest
`generated_at` timestamp as `mtime`/`mtime_iso`. `specpm/lifecycle` is not
available from this provider unless a future producer-side static lifecycle
artifact is added.

`GET /api/v1/health` reports provider state:

```json
{
  "api_version": "v1",
  "provider": "file",
  "read_only": true,
  "status": "ok",
  "sources": {
    "spec_nodes": {
      "name": "spec_nodes",
      "path": "/repo/SpecGraph/specs/nodes",
      "status": "ok",
      "item_count": 61
    },
    "runs": {
      "name": "runs",
      "path": "/repo/SpecGraph/runs",
      "status": "ok",
      "item_count": 100
    },
    "specgraph_root": {
      "name": "specgraph_root",
      "path": "/repo/SpecGraph",
      "status": "ok"
    }
  }
}
```

For the HTTP provider, `provider` is `"http"` and sources point at URLs:

```json
{
  "api_version": "v1",
  "provider": "http",
  "read_only": true,
  "status": "ok",
  "artifact_base_url": "https://specgraph.tech",
  "sources": {
    "artifact_manifest": {
      "name": "artifact_manifest",
      "path": "https://specgraph.tech/artifact_manifest.json",
      "status": "ok",
      "item_count": 101
    },
    "spec_nodes": {
      "name": "spec_nodes",
      "path": "https://specgraph.tech/specs/nodes",
      "status": "ok",
      "item_count": 65
    },
    "runs": {
      "name": "runs",
      "path": "https://specgraph.tech/runs",
      "status": "ok",
      "item_count": 36
    }
  }
}
```

Source status values:

- `not_configured`
- `missing`
- `not_directory`
- `unreadable`
- `empty`
- `ok`

## Endpoints

### `GET /api/v1/spec-graph`

Returns the existing SpecGraph graph contract with additive v1 metadata:

```json
{
  "api_version": "v1",
  "spec_dir": "/repo/SpecGraph/specs/nodes",
  "graph": {},
  "summary": {}
}
```

The `graph` and `summary` fields match the legacy `/api/spec-graph` contract.

### `GET /api/v1/spec-nodes/{id}`

Returns raw node detail:

```json
{
  "api_version": "v1",
  "node_id": "SG-SPEC-0001",
  "data": {}
}
```

Unknown node ids return `404`.

### `GET /api/v1/runs/recent`

Query parameters:

- `limit`: integer, clamped to `1..500`, default `50`
- `since`: optional ISO timestamp filter

Returns:

```json
{
  "api_version": "v1",
  "events": [],
  "total": 0
}
```

### Runs Artifact Envelopes

These endpoints keep the standard runs envelope shape:

- `GET /api/v1/spec-activity`
- `GET /api/v1/implementation-work-index`
- `GET /api/v1/proposal-spec-trace-index`

Envelope shape:

```json
{
  "path": "/repo/SpecGraph/runs/spec_activity_feed.json",
  "mtime": 1778680000.0,
  "mtime_iso": "2026-05-13T10:00:00+00:00",
  "data": {}
}
```

### `GET /api/v1/proposals`

Returns a readonly SpecSpace proposal index for the new Proposal Viewer. The
payload combines static SpecGraph proposal artifacts when present:

- `proposal_spec_trace_index.json`
- `proposal_lane_overlay.json`
- `proposal_runtime_index.json`
- `proposal_promotion_index.json`

Local developer mode may also include metadata from `docs/proposals/*.md`.
HTTP/static deployments do not require a local SpecGraph checkout; missing
optional proposal artifacts are represented in `sources` instead of failing the
whole endpoint.

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_proposal_index",
  "read_only": true,
  "entry_count": 1,
  "entries": [
    {
      "proposal_id": "0042",
      "status": "Draft proposal",
      "runtime_state": "implemented",
      "authority_state": null,
      "affected_spec_ids": ["SG-SPEC-0001"]
    }
  ],
  "filters": {
    "status_counts": { "Draft proposal": 1 },
    "authority_state_counts": { "unknown": 1 },
    "runtime_state_counts": { "implemented": 1 },
    "affected_spec_ids": ["SG-SPEC-0001"]
  },
  "sources": {}
}
```

### `GET /api/v1/metrics`

Returns a readonly SpecSpace metrics index for the Metrics Viewer. The payload
combines existing SpecGraph metrics artifacts when present:

- `graph_dashboard.json`
- `metrics_source_promotion_index.json`
- `metrics_delivery_workflow.json`
- `metrics_feedback_index.json`
- `metric_pack_adapter_index.json`
- `metric_pack_runs.json`
- `metric_signal_index.json`

Missing optional metrics artifacts are represented in `sources` instead of
failing the whole endpoint. Reference text is kept as generic strings so the UI
can resolve clickable spec ids from the live graph rather than from a
project-specific id regex.

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_metrics_index",
  "read_only": true,
  "entry_count": 1,
  "entries": [
    {
      "metric_key": "metric_score::sib",
      "category": "metric_score",
      "item_id": "sib",
      "title": "Specification-Implementation Balance",
      "status": "healthy",
      "score": 0.74,
      "minimum_score": 0.6,
      "source_kind": "graph_dashboard",
      "reference_texts": ["SG-SPEC-0001"]
    }
  ],
  "filters": {
    "category_counts": { "metric_score": 1 },
    "status_counts": { "healthy": 1 },
    "source_kind_counts": { "graph_dashboard": 1 },
    "reference_texts": ["SG-SPEC-0001"]
  },
  "dashboard": {
    "available": true,
    "metric_count": 1
  },
  "sources": {}
}
```

### `GET /api/v1/specpm/lifecycle`

Returns the existing SpecPM lifecycle read-model with additive v1 metadata:

```json
{
  "api_version": "v1",
  "packages": [],
  "package_count": 0,
  "import_source": null,
  "artifacts": {}
}
```

For local developer mode this read model may be derived from a readonly
SpecGraph checkout. For HTTP/static deployments, SpecSpace should prefer a
configured SpecPM public registry source instead of assuming a local checkout.
The initial public registry root is:

```text
https://0al-spec.github.io/SpecPM
```

The registry exposes readonly `/v0` metadata such as `/v0/status`,
`/v0/packages`, package metadata, package version metadata, exact capability
search, and observed intent lookup. SpecSpace must treat this as metadata only:
it must not execute package content or infer package authority beyond the
registry payload.

### `GET /api/v1/capabilities`

Returns legacy capability booleans under `capabilities`, plus provider metadata:

```json
{
  "api_version": "v1",
  "capabilities": {
    "spec_graph": true
  },
  "provider": {
    "kind": "file",
    "read_only": true,
    "health": "ok"
  }
}
```

### `GET /api/v1/runs-watch`

Server-sent events endpoint. It mirrors legacy `/api/runs-watch` and emits
`change` events when watched `runs/` artifacts change.

## Legacy Compatibility

Legacy endpoints remain available during migration:

- `/api/spec-graph`
- `/api/spec-node?id=...`
- `/api/recent-runs`
- `/api/spec-activity`
- `/api/implementation-work-index`
- `/api/proposal-spec-trace-index`
- `/api/specpm/lifecycle`
- `/api/capabilities`
- `/api/runs-watch`
