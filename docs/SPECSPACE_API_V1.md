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

### `GET /api/v1/spec-markdown`

Exports a readonly SpecGraph selection as Markdown. This endpoint is
SpecSpace's versioned replacement for the useful SpecGraph Markdown part of the
legacy `/api/spec-compile` route; it does not invoke Hyperprompt and does not
use legacy conversation export state.

Query parameters:

- `root`: required spec node id.
- `scope`: optional export scope, one of `node` or `subtree`, default `subtree`.
- `depth`: optional heading depth clamp, integer `1..6`, default `6`.
- `objective`: optional boolean, default `true`.
- `acceptance`: optional boolean, default `true`.
- `deps`: optional boolean, default `true`.
- `prompt`: optional boolean, default `false`.

Response:

```json
{
  "api_version": "v1",
  "root_id": "SG-SPEC-0001",
  "scope": "subtree",
  "markdown": "# SG-SPEC-0001 ...",
  "manifest": {
    "root_id": "SG-SPEC-0001",
    "scope": "subtree",
    "node_count": 12,
    "max_depth_reached": 4,
    "nodes_included": ["SG-SPEC-0001"],
    "cycles_skipped": [],
    "missing_skipped": [],
    "load_errors": []
  },
  "source": {
    "provider": "file",
    "read_only": true
  },
  "download_filename": "SG-SPEC-0001.md"
}
```

Invalid query options return `400`, unknown root ids return `404`, and unreadable
provider sources return `503`.

### `POST /api/v1/spec-markdown/compile`

Compiles a SpecSpace-generated Spec Markdown export with a local Hyperprompt
binary. This endpoint is available only where `/api/v1/capabilities` reports
`hyperprompt_compile: true`. Local file provider deployments can enable it with
a compiler binary plus scratch workspace. HTTP/static artifact deployments must
also opt in through the contract in
[`HTTP_HYPERPROMPT_COMPILE_CONTRACT.md`](HTTP_HYPERPROMPT_COMPILE_CONTRACT.md).
It never mutates mounted or remote SpecGraph inputs and writes only inside the
configured Hyperprompt scratch workspace. SpecSpace marks its own compile
bundle directories and keeps only the latest local bundles by default so the
scratch workspace does not grow indefinitely.

Request body fields mirror `GET /api/v1/spec-markdown`:

- `root`: required spec node id.
- `scope`: optional export scope, one of `node` or `subtree`, default `subtree`.
- `depth`: optional heading depth clamp, integer `1..6`, default `6`.
- `objective`: optional boolean, default `true`.
- `acceptance`: optional boolean, default `true`.
- `deps`: optional boolean, default `true`.
- `prompt`: optional boolean, default `false`.

Response:

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_hyperprompt_compile",
  "root_id": "SG-SPEC-0001",
  "scope": "subtree",
  "source": {
    "provider": "file",
    "read_only": true
  },
  "export": {
    "download_filename": "SG-SPEC-0001.md",
    "manifest": {
      "root_id": "SG-SPEC-0001",
      "node_count": 12,
      "nodes_included": ["SG-SPEC-0001"]
    }
  },
  "compile": {
    "exit_code": 0,
    "compiled_markdown": "# Compiled output ...",
    "compiler_manifest": {},
    "export_dir": "/data/specspace-hyperprompt/SG-SPEC-0001-abc123",
    "root_hc": "/data/specspace-hyperprompt/SG-SPEC-0001-abc123/root.hc",
    "markdown_file": "/data/specspace-hyperprompt/SG-SPEC-0001-abc123/export.md",
    "export_manifest": "/data/specspace-hyperprompt/SG-SPEC-0001-abc123/export_manifest.json",
    "compiled_md": "/data/specspace-hyperprompt/SG-SPEC-0001-abc123/compiled.md",
    "manifest_json": "/data/specspace-hyperprompt/SG-SPEC-0001-abc123/manifest.json",
    "timeout_seconds": 60,
    "max_input_bytes": 1048576,
    "max_output_bytes": 2097152
  }
}
```

If `hyperprompt_compile` is unavailable, the endpoint returns `503` with the
same actionable diagnostic shape used by `/api/v1/capabilities`. HTTP/static
artifact deployments return `http_compile_disabled` until explicitly enabled
and `provider_unsupported` only when the active provider cannot support the
contract. Compiler failures return `422` with `compile.exit_code`, `stderr`,
and `stdout`; timeout failures return `500`; generated input/output over
configured limits returns `413`.

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

### `GET /api/v1/artifacts`

Returns a readonly catalog of public-safe artifacts available to SpecSpace.
For the file provider this is derived from a local public artifact manifest
when available. Without a local manifest, SpecSpace falls back to a
conservative allowlist of known public root-level `runs/*.json` surfaces plus
normalized ontology IR files referenced by `runs/ontology_package_index.json`.
For the HTTP provider this is derived from `artifact_manifest.json`, including
published `runs/*.json` and package-index referenced `materialized_ir` files.

The endpoint does not imply artifact authority. It is an inspection surface:
SpecSpace can show, search, and preview artifacts, but it does not write
`runs/`, `specs/nodes/`, or Ontology packages.

Response shape:

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_artifact_catalog",
  "schema_version": 1,
  "read_only": true,
  "source": {
    "provider": "http"
  },
  "summary": {
    "artifact_count": 42,
    "runs_count": 36,
    "ontology_artifact_count": 5,
    "ontology_ir_count": 1,
    "root_counts": {
      "runs": 36,
      "tests": 1
    },
    "group_counts": {
      "ontology": 5,
      "ontology_ir": 1,
      "runs": 31
    }
  },
  "artifacts": [
    {
      "path": "runs/ontology_package_index.json",
      "root": "runs",
      "label": "ontology package index",
      "group": "ontology",
      "size_bytes": 1240,
      "sha256": "abc123",
      "url": "https://specgraph.tech/runs/ontology_package_index.json"
    }
  ]
}
```

### `GET /api/v1/artifacts/content`

Returns a bounded preview of one artifact from the catalog.

Query parameters:

- `path`: required safe relative artifact path.

The provider rejects absolute paths, parent-directory traversal, unknown
manifest/catalog paths, non-public local runs artifacts, and artifacts larger
than 1 MiB. JSON artifacts are parsed and returned as structured `data`; other
artifacts are returned as `text`.

Response shape:

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_artifact_content",
  "schema_version": 1,
  "read_only": true,
  "path": "tests/fixtures/ontology_import/specgraph-core/ontology.normalized.json",
  "source": {
    "provider": "http"
  },
  "size_bytes": 2048,
  "content_kind": "json",
  "data": {},
  "json_summary": {
    "artifact_kind": "ontology_normalized_ir",
    "schema_version": 1,
    "top_level_keys": ["artifact_kind", "schema_version", "terms"]
  }
}
```

### `GET /api/v1/ontology-owner-decision-review`

Returns the SpecGraph-produced `ontology_decision_import_preview` envelope for
SpecSpace inspection. The endpoint is readonly: SpecSpace treats accepted and
rejected Ontology owner decisions as review material, linked evidence, affected
review items, and before/after semantic status. It does not import decisions,
close gates, update lockfiles, or mutate Ontology/SpecGraph canonical files.

### `GET /api/v1/ontology-compliance-review`

Returns the SpecGraph-produced `spec_ontology_validation_report` envelope for
SpecSpace inspection. The endpoint reads
`runs/spec_ontology_validation_report.json` and exposes legacy spec ontology
checks, report-only findings, ontology IR references, and the validation mode
posture.

This surface is intentionally readonly and review-only:

- legacy `specs/nodes/*.yaml` findings are report-only;
- generated artifacts remain `review_required`;
- `hard_gate_enabled` must be `false`;
- canonical SpecGraph mutations must be disabled;
- tracked artifact writes must be disabled.

The endpoint is meant for the utility panel and artifact review workflows. It
does not approve ontology gaps, mutate package terms, import owner decisions, or
block existing legacy specs.

### `GET /api/v1/ontology-owner-decision-acknowledgements`

Returns SpecSpace-owned local acknowledgement state for reviewed owner decision
previews. Missing state is returned as an empty artifact and does not create a
file. The artifact is intentionally non-authoritative:

```json
{
  "artifact_kind": "specspace_ontology_owner_decision_acknowledgement_state",
  "schema_version": 1,
  "state_owner": "SpecSpace",
  "canonical_mutations_allowed": false,
  "tracked_artifacts_written": false,
  "acknowledgements": []
}
```

### `POST /api/v1/ontology-owner-decision-acknowledgements`

Records or replaces one local operator acknowledgement:

```json
{
  "preview_id": "ontology-decision-import-preview-accept-casfunction",
  "acknowledged_by": "operator"
}
```

The server first verifies that `preview_id` exists in the current
`ontology_decision_import_preview` artifact. On success it writes only
SpecSpace-owned state under the configured `--specspace-state-dir` and returns
the complete acknowledgement artifact. It never writes `runs/`, `specs/nodes/`,
Ontology packages, or SpecGraph import artifacts.

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
      "markdown": {
        "available": true,
        "content_excerpt": "Short list summary.",
        "content_preview": "Longer detail summary.",
        "content_body": "# Full proposal Markdown\n\n..."
      },
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

### `GET /api/v1/practical-ontology`

Returns a readonly practical ontology surface for the SpecSpace utility panel.
When SpecGraph publishes Ontology compiler artifacts, the endpoint projects the
current Ontology normalized IR into UI-ready `terms` and `relations` and carries
package metadata, gap rows, diff summaries, governance evidence, and raw
artifact refs from the companion artifacts:

- `runs/ontology_package_index.json`
- `runs/ontology_binding_preview.json`
- `runs/ontology_import_gap_index.json`
- `runs/ontology_compatibility_diff_preview.json`
- `runs/ontology_governance_evidence_index.json`
- the `materialized_ir` path declared by the package index

If those artifacts or the normalized IR are unavailable, the endpoint falls back
to a small curated SpecGraph Core Ontology seed. The fallback is intentionally
close to the original SG-SPEC-0001 / Hypercode-style idea: a graph of
declarative entities and typed relations around `SpecGraph`, `Spec`, `Node`,
`Edge`, `Requirement`, and `AcceptanceCriterion`.

The endpoint no longer derives terms from every available `specs/nodes/*.yaml`
or `docs/proposals/*.md` entry because that extraction produced noisy vocabulary
items such as articles, example-only terms, proposal titles, and topology facts.

It is still not a canonical Ontology package, does not mark terms accepted, and
does not mutate SpecGraph specs. Compiler-backed projection and curated fallback
are both readonly review/display surfaces.

The response keeps the existing envelope shape:

- `source.ontology_mode` is `compiler_artifact_projection` or
  `curated_core_seed`;
- `terms` contains compiler IR classes or curated seed entities;
- `relations` contains compiler IR relations or curated semantic ontology
  relations;
- `package` contains package id, namespace, version, package ref, source, digest,
  authority class, and `materialized_ir` when compiler artifacts are available;
- `gaps` contains normalized ontology import gap rows;
- `compatibility_diff` contains the companion diff preview;
- `governance_evidence` contains owner/package governance evidence rows;
- `raw_artifacts` points back to source artifacts for the Live artifacts
  inspector;
- `topology_edges` is empty because SpecGraph topology extraction is no longer
  mixed into ontology;
- `proposal_references` is empty because proposal markdown extraction is no
  longer mixed into ontology.

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_practical_ontology",
  "schema_version": 1,
  "read_only": true,
  "canonical_mutations_allowed": false,
  "summary": {
    "term_count": 2,
    "relation_count": 1,
    "semantic_relation_count": 1,
    "topology_edge_count": 0,
    "proposal_reference_count": 0,
    "domain_count": 1,
    "source_count": 1,
    "gap_count": 0,
    "diff_added_class_count": 0,
    "diff_breaking_change_count": 0
  },
  "terms": [
    {
      "term_id": "ontology.specgraph",
      "label": "SpecGraph",
      "kind": "ontology",
      "canonical_ref": "SG-SPEC-0001",
      "source_refs": ["specs/nodes/SG-SPEC-0001.yaml#specification.seed"]
    }
  ],
  "relations": [
    {
      "relation_id": "specgraph--contains--node",
      "source_term": "SpecGraph",
      "relation": "contains",
      "target_term": "Node",
      "source_refs": ["specs/nodes/SG-SPEC-0001.yaml#specification.seed"]
    }
  ],
  "package": {
    "package_id": "org.0al.specgraph.core",
    "namespace": "sgcore",
    "version": "0.1.0",
    "package_ref": "org.0al.specgraph.core@0.1.0",
    "authority_class": "draft_imported",
    "source_ref": "codex/ont-038-specgraph-core-package",
    "source_uri": "git+https://github.com/0al-spec/Ontology.git",
    "digest": "sha256:...",
    "materialized_ir": "tests/fixtures/ontology_import/specgraph-core/ontology.normalized.json",
    "accepted_by_proposal": "SG-RFC-0130-smoke"
  },
  "gaps": [
    {
      "gap_id": "ontology-gap-sgcore-claimcalibration",
      "severity": "medium",
      "target_package": "org.0al.specgraph.core@0.1.0",
      "recommended_route": "ontology_package_draft",
      "missing_ref": "sgcore:ClaimCalibration",
      "missing_concept": "ClaimCalibration",
      "namespace_hint": "sgcore",
      "subject": "proposal SG-RFC-0130",
      "needed_by": ["0060", "SG-RFC-0130"],
      "source_refs": ["tests/fixtures/ontology_import/specgraph-core/import-fixture.yaml"]
    }
  ],
  "compatibility_diff": {
    "compatible": true,
    "from_ref": "org.0al.specgraph.core@0.1.0",
    "to_ref": "org.0al.specgraph.core@0.2.0",
    "added_classes": ["sgcore:ClaimCalibration"],
    "breaking_changes": [],
    "required_specgraph_actions": ["updateLockfile"]
  },
  "governance_evidence": [
    {
      "package_ref": "org.0al.specgraph.core@0.1.0",
      "lifecycle_state": "draft",
      "decision_ref": "https://github.com/0al-spec/Ontology/pull/57"
    }
  ],
  "raw_artifacts": [
    {
      "artifact": "ontology_package_index",
      "path": "runs/ontology_package_index.json"
    }
  ],
  "topology_edges": [],
  "proposal_references": [],
  "relation_taxonomy": {
    "relations": "curated semantic ontology relations for the SpecGraph core seed",
    "topology_edges": "legacy SpecGraph topology extraction is removed from the primary ontology surface",
    "proposal_references": "legacy proposal reference extraction is removed from the primary ontology surface",
    "semantic_relations_are_authority": false,
    "topology_edges_are_ontology_relations": false,
    "proposal_references_are_ontology_relations": false
  },
  "authority_boundary": {
    "practical_ontology_is_authority": false,
    "derived_from_specgraph_sources": false,
    "curated_from_specgraph_seed": true,
    "compiler_artifact_backed": false,
    "may_write_ontology_package": false,
    "may_mutate_canonical_specs": false,
    "may_mark_candidate_accepted": false
  }
}
```

### `GET /api/v1/workspaces`

Returns the readonly public workspace catalog used by route-level workspace
selection. The initial catalog contains the SpecGraph bootstrap showcase and
the Team Decision Log `product_idea_to_spec` pilot.

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_workspace_catalog",
  "schema_version": 1,
  "read_only": true,
  "workspaces": [
    {
      "id": "specgraph-bootstrap",
      "display_name": "SpecGraph",
      "route": "/",
      "workflow_lane": "specgraph_bootstrap_showcase",
      "target_repository_role": "specgraph_bootstrap",
      "surface_mode": "bootstrap_showcase"
    },
    {
      "id": "team-decision-log",
      "display_name": "Team Decision Log",
      "route": "/team-decision-log",
      "aliases": ["/team_decision_log"],
      "workflow_lane": "product_idea_to_spec",
      "target_repository_role": "product_spec_workspace",
      "surface_mode": "product_idea_to_spec"
    }
  ]
}
```

### `GET /api/v1/idea-to-spec-workspace`

Returns a consolidated readonly Idea-to-Spec Workspace surface for the
SpecSpace utility panel. The endpoint aggregates the first autonomous
idea-to-spec artifacts produced by SpecGraph:

- `runs/active_idea_to_spec_candidate.json`;
- `runs/idea_event_storming_intake.json`;
- `runs/candidate_spec_graph_seed.json` when produced by newer SpecGraph
  idea-to-spec flows;
- `runs/candidate_overview.json`;
- `runs/candidate_spec_graph.json`;
- `runs/pre_sib_coherence_report.json`;
- `runs/candidate_repair_loop_report.json`;
- `runs/platform_product_repair_rerun_execution_report.json`;
- `runs/platform_product_repair_rerun_publication_report.json`;
- `runs/idea_maturity_metrics_report.json`;
- `runs/idea_maturity_metrics_validation_report.json`;
- `runs/candidate_spec_materialization_report.json`;
- `runs/idea_to_spec_promotion_gate.json`;
- `runs/candidate_approval_decision.json`;
- `runs/graph_repository_promotion_request.json`;
- `runs/git_service_promotion_execution_report.json`;
- `runs/product_candidate_promotion_review_status_report.json`;
- `runs/product_candidate_promotion_read_model_publication_report.json`;
- `runs/graph_repository_review_status_report.json`;
- `runs/graph_repository_publish_read_model_report.json`;
- `runs/git_service_promotion_finalization_report.json`.

The endpoint accepts `?workspace=team-decision-log` so a public product route
can select a product artifact provider. If no product-specific provider is
configured, the route reads the default artifact base.

The ontology-bound seed is shown as a workflow item even when absent. Missing
seed artifacts do not by themselves block legacy or in-flight workspaces that
already have candidate graph artifacts; a present seed with review findings can
still block the workflow before promotion.

The payload is designed for fast operator inspection: event-storming counts,
active ontology/domain/context frame, ontology-bound seed readiness, seed
bindings/gaps, candidate overview narrative, candidate graph nodes,
pre-SIB/coherence findings, repair-loop actions, SpecSpace draft repair
handoff state, project-local ontology review state plus its SpecGraph import
preview, Product Repair Rerun execution/publication status, metric deltas,
approval status, Git Service handoff state, repository review status,
read-model publication status, and artifact availability.

The response embeds `workspace_state_hygiene`, the same read-only preflight
surface returned by `/api/v1/idea-to-spec-workspace-state-hygiene`. This lets
the Product Workspace warn when SpecSpace-owned state such as repair drafts,
rerun requests, or approval intents belongs to a different workspace,
candidate, or repair session before Platform consumes it.

The response also embeds `guided_flow`, a read-only operator workflow projection
over the same artifacts. It exposes the current lifecycle stage, the next safe
operator action, stage statuses, blockers, evidence refs, target UI sections,
and optional Platform/SpecGraph command templates. This projection is a
navigation and explainability layer only: it does not grant SpecSpace authority
to run SpecGraph, run Platform, run Git Service, mutate canonical specs, accept
Ontology terms, or clear SpecSpace-owned state. The root `guided_flow`, every
stage, and every next action include an `authority_boundary` object with
`inspect_only: true`, `acknowledge_only: true`, and all execution/mutation
capabilities set to `false`; consumers should treat any expanded authority as
invalid.

The response also embeds `product_workspace_overview.action_ranking`, an
additive lifecycle-wide ranking over those existing read-only surfaces. It
selects one `primary_action` and at most three `secondary_actions` using this
order: stale/invalid SpecSpace-owned state, failed managed operations, blocking
clarification or repair, structural-depth recommendations, approval, promotion,
publication, then optional presentation follow-up. Structural-depth actions are
labelled `recommended` and never become blockers or gates. Each action includes
an owner, reason, target section, bounded public-safe evidence refs, and the same
closed authority boundary as `guided_flow`; command templates are intentionally
not copied into the ranking. For backward compatibility,
`product_workspace_overview.next_safe_action` and `primary_target_section`
mirror the selected primary action. Consumers of older payloads may derive a
single legacy action from those two fields.

The response embeds `real_idea_intake`, a compact read-only projection for the
real idea intake workspace. It summarizes the current intake status, clarification
progress, answer-template validation, SpecSpace answer import/continuation
handoff, optional Platform real-idea entry execution telemetry, safe source
refs, and the next operator action. This surface is
diagnostic only: SpecSpace may collect operator-owned answers elsewhere, but this
projection does not let the UI apply answers, run SpecGraph, run Platform, execute
prompt agents, mutate candidate source artifacts, mutate canonical specs, write
Ontology packages, accept Ontology terms, or create Git branches/commits.

The response may also embed `workspace_initialization.execution_request` when
Platform publishes
`runs/product_workspace_initialization_execution_request.json`. This is a
managed-execution handoff only. It exposes request status, requested operation,
readiness, and idempotency evidence, but it does not mean SpecSpace may execute
Platform or initialize the workspace from the browser. The request must remain
public-safe and request-only; any expanded execution/mutation authority makes
the initialization surface untrusted.

When `runs/candidate_overview.json` is present, the response embeds
`candidate_overview`, a read-only narrative surface over the selected candidate
graph. It summarizes product intent, understood scope, event-storming frame
counts, workflow topology, repair/maturity status, project-local ontology
review status, and the next operator action. SpecSpace treats this artifact as
display-only evidence and rejects it when the source artifact `authority_boundary`,
`action_boundary`, privacy flags, or top-level read-only fields claim authority
to run SpecGraph, run Platform, mutate candidate artifacts, mutate canonical
specs, write Ontology packages, accept Ontology terms, create Git
branches/commits, write tracked artifacts, or allow canonical mutations. The
response `candidate_overview.action_boundary` is a SpecSpace-generated read-only
projection for the UI.

Candidate Overview may include SpecGraph `0212` `display_alias` values for
candidate nodes and topology endpoints. They are deterministic presentation
labels only: canonical node ids remain the only refs used by evidence,
navigation, materialization, managed operations, and promotion. Older producer
artifacts without aliases continue to render from title or id.

The Product Workspace may render `candidate_overview.topology` as a read-only
workflow map. This visualization groups event-storming items into actors,
commands, events, policies, and constraints, then displays relation rows such as
`actor_triggers_command` and `command_emits_event`. These topology edges remain
review-only product understanding evidence; they are not implementation
dependencies and do not grant mutation or execution authority.

For promotion review and publication, product wrapper reports are preferred
when present. SpecSpace falls back to the legacy `graph_repository_*` reports
for older in-flight workspaces, but the product surface exposes the selected
candidate, branch, pull request metadata, child report refs, lifecycle
operations, and the next operator handoff.

When Idea Maturity artifacts are present, `idea_maturity.report.contract`
surfaces the Metrics-owned schema refs, validation-report schema ref, validator
id/version, and compatibility-policy refs emitted by SpecGraph. SpecSpace
displays this as contract evidence only; Metrics remains the schema/validator
authority and SpecSpace does not execute the Metrics validator.

This surface is not a write boundary. The response is always `read_only`,
requires `canonical_mutations_allowed: false`, and does not allow SpecSpace to
execute prompt agents, mutate candidate source artifacts, mutate canonical
specs, write Ontology packages, create Git branches/commits, or mark a
candidate graph accepted.

When the optional Product Repair Rerun reports are present, the response adds
`repair_review.platform_execution`. That lane summarizes Platform execution and
publication reports as read-only evidence only. Its action boundary keeps
`may_execute_platform_adapter`, `may_run_specgraph_make_target`,
`may_publish_bundle`, Git writes, ontology writes, and canonical spec mutation
false.

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_idea_to_spec_workspace",
  "schema_version": 1,
  "read_only": true,
  "canonical_mutations_allowed": false,
  "selected_workspace_id": "team-decision-log",
  "workspace": {
    "available": true,
    "id": "team-decision-log",
    "display_name": "Team Decision Log",
    "public_route": "/team-decision-log",
    "workflow_lane": "product_idea_to_spec",
    "target_repository_role": "product_spec_workspace",
    "source_mode": "active_candidate",
    "ready": true,
    "review_state": "active_candidate_ready"
  },
  "summary": {
    "status": "ready",
    "available_artifact_count": 4,
    "missing_artifact_count": 0,
    "candidate_node_count": 12,
    "pre_sib_finding_count": 2,
    "repair_action_count": 5,
    "repair_context_required_count": 1
  },
  "guided_flow": {
    "current_stage": "repair_review",
    "current_stage_label": "Repair review",
    "overall_status": "blocked",
    "next_actions": [
      {
        "id": "next.repair_review",
        "label": "Replace the rerun request for the current workspace and repair session.",
        "status": "blocked",
        "target_section": "idea-to-spec-workspace-state-hygiene",
        "evidence_refs": ["workspace_state_hygiene"],
        "authority_boundary": {
          "inspect_only": true,
          "acknowledge_only": true,
          "may_execute_specgraph": false,
          "may_execute_platform": false,
          "may_execute_git_service": false,
          "may_mutate_candidate_artifacts": false,
          "may_mutate_canonical_specs": false,
          "may_write_ontology_package": false,
          "may_accept_ontology_terms": false,
          "may_create_branch_or_commit": false,
          "may_open_pull_request": false,
          "may_merge_review": false
        }
      }
    ],
    "stages": [
      {
        "id": "repair_review",
        "label": "Repair review",
        "status": "blocked",
        "primary_next_action": "Replace stale SpecSpace-owned state before rerun.",
        "target_section": "idea-to-spec-workspace-state-hygiene",
        "blockers": ["workspace_id_mismatch"],
        "authority_boundary": {
          "inspect_only": true,
          "acknowledge_only": true,
          "may_execute_specgraph": false,
          "may_execute_platform": false,
          "may_execute_git_service": false,
          "may_mutate_candidate_artifacts": false,
          "may_mutate_canonical_specs": false,
          "may_write_ontology_package": false,
          "may_accept_ontology_terms": false,
          "may_create_branch_or_commit": false,
          "may_open_pull_request": false,
          "may_merge_review": false
        }
      }
    ],
    "authority_boundary": {
      "inspect_only": true,
      "acknowledge_only": true,
      "may_execute_specgraph": false,
      "may_execute_platform": false,
      "may_execute_git_service": false,
      "may_mutate_candidate_artifacts": false,
      "may_mutate_canonical_specs": false,
      "may_write_ontology_package": false,
      "may_accept_ontology_terms": false,
      "may_create_branch_or_commit": false,
      "may_open_pull_request": false,
      "may_merge_review": false
    }
  },
  "authority_boundary": {
    "idea_to_spec_workspace_is_authority": false,
    "may_execute_prompt_agent": false,
    "may_mutate_candidate_source_artifacts": false,
    "may_mutate_canonical_specs": false,
    "may_write_ontology_package": false,
    "may_create_branch_or_commit": false,
    "may_mark_candidate_accepted": false
  }
}
```

### `GET/POST /api/v1/idea-to-spec-repair-drafts`

Stores SpecSpace-owned draft answers for the selected product workspace. The
state is a handoff artifact for SpecGraph import preview only: it does not
apply answers, accept Ontology terms, write Ontology packages, run SpecGraph,
run Platform, create Git branches/commits, or mutate canonical specs.

For `ontology_gap` clarification requests, the Product Workspace UI emits
action-specific payloads:

```json
{
  "workspace_id": "team-decision-log",
  "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
  "action": "bind_existing_term",
  "answer_value": {
    "term": "Decision Record",
    "ontology_ref": "ontology://specgraph-core/classes/Spec"
  }
}
```

Supported ontology-gap actions are:

- `bind_existing_term`: requires `answer_value.term` and `ontology_ref`;
- `alias`: requires `answer_value.term` and `alias_of`;
- `propose_project_local_term`: requires `answer_value.terms` or `term`;
- `reject`: requires `answer_value.reason`, with optional `term`;
- `defer`: requires `answer_value.reason`.

SpecGraph later validates these drafts through
`runs/specspace_repair_draft_import_preview.json`; invalid or incomplete drafts
remain visible as draft state but are not accepted for rerun.

### `GET/POST /api/v1/project-local-ontology-review-decisions`

Stores SpecSpace-owned operator decisions for the
`runs/project_local_ontology_review_lane.json` surface. This is a project-local
review lane for product vocabulary: users can keep a term local, bind it to an
existing ontology ref, alias it, reject it, request workspace ontology promotion,
or defer it for owner review.

Example:

```json
{
  "workspace_id": "team-decision-log",
  "term_key": "decisionrecord",
  "action": "keep_project_local",
  "decision_value": {
    "term": "Decision Record",
    "reason": "Product-specific wording for this bounded context."
  }
}
```

The state remains operator intent only:

- SpecSpace does not write Ontology packages or lockfiles;
- SpecSpace does not accept Ontology terms;
- SpecSpace does not apply decisions to SpecGraph artifacts;
- SpecSpace does not run SpecGraph, Platform, or Git Service.

SpecGraph should later consume this state through a validation/import preview
before any rerun or promotion step treats the decisions as evidence.
When `runs/specspace_project_local_ontology_decision_import_preview.json` is
published, `/api/v1/idea-to-spec-workspace` embeds it as
`project_local_ontology_decision_import_preview`. The Product Workspace shows
accepted, non-resolving, invalid, and missing decisions as read-only SpecGraph
evidence. The preview can guide the operator to fix decisions or rebuild the
preview, but it does not grant SpecSpace authority to apply decisions, mutate
candidate artifacts, write Ontology packages, accept Ontology terms, or create
Git branches/commits.

### `GET/POST /api/v1/idea-to-spec-intake-clarification-answers`

Stores SpecSpace-owned operator answers for the **real idea intake**
clarification loop. This state is earlier than product repair drafts: it helps
complete the bounded context / ontology frame before SpecGraph materializes a
public-safe `user_idea_intake_source.json`.

The state is compatible with the SpecGraph clarification answer-set contract:

```json
{
  "workspace_id": "team-decision-log",
  "request_id": "clarification.intake.question-active-frame-domain-refs",
  "answer_kind": "answer_question",
  "value": {
    "refs": ["domain.team_decision_log"]
  }
}
```

SpecSpace owns this mutable state, but it is not authority:

- it does not run SpecGraph;
- it does not execute prompt agents;
- it does not apply answers to source artifacts;
- it does not mutate user intent, candidate artifacts, or canonical specs;
- it does not write Ontology packages or accept Ontology terms;
- it does not create Git branches, commits, PRs, or read-model publications.

SpecGraph must later validate/export this state through its intake
clarification rerun flow before any clarified intake source is published.

### `POST /api/v1/product-workspace-initialization/execute`

Optionally executes a previously prepared product workspace initialization
request through the SpecSpace backend. This is a controlled backend handoff for
local/operator deployments: the browser sends the request to SpecSpace, and
SpecSpace calls the allowlisted Platform command only when the server was
started with Platform execution enabled.

Server opt-in:

```bash
python viewer/server.py \
  --dialog-dir /data/dialogs \
  --runs-dir /repo/SpecGraph/runs \
  --platform-dir /repo/Platform \
  --enable-platform-execution
```

The same endpoint can enqueue through the Platform hosted service without
starting a local subprocess:

```bash
SPECSPACE_HOSTED_MANAGED_EXECUTION_ENABLED=1 \
SPECSPACE_HOSTED_MANAGED_EXECUTOR_URL=https://platform-executor.example \
SPECSPACE_HOSTED_MANAGED_EXECUTOR_TOKEN=<secret> \
python viewer/server.py \
  --dialog-dir /data/dialogs \
  --runs-dir /repo/SpecGraph/runs
```

Hosted responses use HTTP `202` with
`artifact_kind=specspace_hosted_managed_operation_request` and a queue request
id. The browser does not receive the hosted bearer token. Queue completion is
transport telemetry and does not replace normal Platform report validation in
`GET /api/v1/idea-to-spec-workspace`.

Request:

```json
{
  "workspace_id": "team-decision-log",
  "execution_request_ref": "runs/product_workspace_initialization_execution_request.json"
}
```

The `execution_request_ref` must point at a local `runs/*`
`product_workspace_initialization_execution_request.json` artifact. SpecSpace
rejects parent-directory traversal, missing request artifacts, and mismatched
workspace ids. When successful, Platform writes
`platform_product_workspace_initialization_execution_report.json` next to the
request artifact, and Product Workspace lifecycle refreshes from that report.

Authority boundary:

- the browser does not execute Platform directly;
- SpecSpace backend may execute only the allowlisted Platform workspace
  initialization wrapper when explicitly enabled;
- SpecSpace does not create Git commits, open PRs, publish read models, write
  Ontology packages, accept Ontology terms, or mutate canonical specs.

### `POST /api/v1/real-idea-intake/execute`

Optionally executes a previously requested real idea intake handoff through the
SpecSpace backend. This is the intake counterpart to managed workspace
initialization: the browser records request-only state, and an explicitly
enabled SpecSpace backend calls only the allowlisted Platform
`product-real-idea-intake execute-requested` wrapper.

Server opt-in:

```bash
python viewer/server.py \
  --dialog-dir /data/dialogs \
  --runs-dir /repo/SpecGraph/runs \
  --specspace-state-dir /data/specspace-state \
  --platform-dir /repo/Platform \
  --specgraph-dir /repo/SpecGraph \
  --enable-platform-execution
```

Request:

```json
{
  "workspace_id": "team-decision-log",
  "request_id": "real-idea-intake-execute.team-decision-log.20260706.abcd12"
}
```

`request_id` is optional when exactly one active
`real_idea_intake_execution_requests.json` entry exists for the selected
workspace. SpecSpace validates the matching SpecSpace-owned execution request,
the local raw idea entry state, the referenced workspace initialization report,
the configured Platform checkout, and the configured SpecGraph checkout before
execution. On success Platform writes:

```text
runs/platform_real_idea_entry_intake_execution_report.json
```

The Product Workspace then refreshes from that report and the generated
SpecGraph intake artifacts. Deployments should point `--runs-dir` at the
SpecGraph run directory used by Platform so the resulting artifacts are visible
to the same workspace provider.

Authority boundary:

- the browser does not execute Platform directly;
- SpecSpace backend may execute only the allowlisted Platform real idea intake
  wrapper when explicitly enabled;
- raw idea text remains SpecSpace/local-operator state and is not published by
  this endpoint;
- SpecSpace does not create Git commits, open PRs, publish read models, write
  Ontology packages, accept Ontology terms, or mutate canonical specs.

### `POST /api/v1/real-idea-answer-continuation/execute`

Optionally executes a previously requested real idea answer continuation handoff
through the SpecSpace backend. The user still saves answers as SpecSpace-owned
state and creates a request-only continuation intent first; this endpoint only
lets an explicitly enabled backend call the allowlisted Platform
`product-real-idea-continuation execute-requested` wrapper.

Server opt-in uses the same execution flags as managed intake:

```bash
python viewer/server.py \
  --dialog-dir /data/dialogs \
  --runs-dir /repo/SpecGraph/runs \
  --specspace-state-dir /data/specspace-state \
  --platform-dir /repo/Platform \
  --specgraph-dir /repo/SpecGraph \
  --enable-platform-execution
```

Request:

```json
{
  "workspace_id": "team-decision-log",
  "request_id": "real-idea-answer-continuation-execute.team-decision-log.20260706.abcd12"
}
```

`request_id` is optional when exactly one active
`real_idea_answer_continuation_execution_requests.json` entry exists for the
selected workspace. SpecSpace validates the matching SpecSpace-owned
continuation request, local answer state, workspace initialization report,
intake execution report, Platform checkout, and SpecGraph checkout before
execution. On success Platform writes:

```text
runs/platform_real_idea_answer_continuation_execution_report.json
```

The Product Workspace then refreshes from that execution report and the
generated continuation artifacts. Deployments should point `--runs-dir` at the
SpecGraph run directory used by Platform so generated continuation artifacts are
visible to the same workspace provider.

Authority boundary:

- the browser does not execute Platform directly;
- SpecSpace backend may execute only the allowlisted Platform answer
  continuation wrapper when explicitly enabled;
- SpecSpace does not apply answers directly; SpecGraph/Platform validate and
  materialize review-only continuation artifacts;
- SpecSpace does not create Git commits, open PRs, publish read models, write
  Ontology packages, accept Ontology terms, or mutate canonical specs.

### `GET/POST /api/v1/real-idea-entry-requests`

Stores SpecSpace-owned raw idea entry requests for a product workspace. This is
the first user-facing state in the real idea flow: the user can type a raw
product idea in SpecSpace, while SpecGraph remains the only component that can
turn it into intake artifacts.

Example:

```json
{
  "workspace_id": "team-decision-log",
  "idea_text": "A shared decision log for product teams.",
  "idea_summary_hint": "Team decision log",
  "workspace_display_name": "Team Decision Log",
  "public_route_hint": "/team-decision-log",
  "domain_hints": ["team collaboration"],
  "constraints": ["review-only candidate first"]
}
```

SpecSpace keeps the submitted request as mutable local state and supersedes any
previous submitted request for the same workspace. The state is not public-safe:
raw idea text is available to SpecSpace and the local operator, but must not be
published as a static SpecGraph artifact.

Authority boundary:

- SpecSpace does not run SpecGraph;
- SpecSpace does not execute prompt agents;
- SpecSpace does not mutate user intent, candidate artifacts, or canonical
  specs;
- SpecSpace does not write Ontology packages or accept Ontology terms;
- SpecSpace does not create Git branches, commits, PRs, or read-model
  publications.

SpecGraph should later consume this state through
`make real-idea-intake-from-entry-request`, which writes a sanitized import
preview and local-only real idea intake artifacts under the selected run
directory.

### `GET /api/v1/idea-to-spec-workspace-state-hygiene`

Returns a readonly preflight report for SpecSpace-owned Idea-to-Spec state in
the selected product workspace. The endpoint compares stored repair drafts,
repair rerun requests, candidate approval intents, and SpecGraph handoff
artifacts against the currently selected workspace, candidate, and repair
session.

The endpoint accepts the same optional `?workspace=team-decision-log` selector
as `/api/v1/idea-to-spec-workspace`. It reports state as `usable`, `missing`,
`stale`, or `invalid`; stale and invalid entries are blockers for downstream
repair rerun, candidate approval, or promotion review flows.

The response also includes `recommended_actions`: typed operator-facing steps
for rebuilding or recreating stale/missing SpecSpace-owned state for the current
workspace and repair session. These actions are not execution authority. They
can include UI intents and command hints, but every action carries an
`authority_boundary` with SpecGraph, Platform, Git Service, state-clear,
candidate-mutation, canonical-spec, Ontology-write, and PR capabilities set to
`false`.

This is a diagnostics surface only. It does not clear local state, apply repair
answers, accept ontology terms, run SpecGraph, run Platform, create Git
branches/commits, or mutate canonical specifications.

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_idea_to_spec_workspace_state_hygiene",
  "schema_version": 1,
  "workspace_id": "team-decision-log",
  "summary": {
    "status": "blocked",
    "stale_state_count": 1,
    "invalid_state_count": 0,
    "blocking_state_count": 1,
    "recommended_action_count": 1,
    "enabled_recommended_action_count": 0,
    "next_action": "Replace stale SpecSpace-owned state before rerun or approval."
  },
  "recommended_actions": [
    {
      "id": "workspace_state.recreate_repair_rerun_request",
      "label": "Recreate repair rerun request",
      "target_state": "repair_rerun_request",
      "target_section": "idea-to-spec-repair-review",
      "requires_current_repair_session": true,
      "enabled": false,
      "blockers": ["Rebuild repair draft import preview first."],
      "ui_intent": "create_repair_rerun_request",
      "command_hint": null,
      "authority_boundary": {
        "inspect_only": true,
        "operator_intent_only": true,
        "may_execute_platform": false,
        "may_clear_state": false
      }
    }
  ],
  "states": [
    {
      "kind": "repair_rerun_request",
      "status": "stale",
      "reason": "workspace_id_mismatch",
      "blocks": ["repair_rerun_smoke"]
    }
  ],
  "authority_boundary": {
    "workspace_state_hygiene_is_authority": false,
    "may_execute_specgraph": false,
    "may_execute_platform": false,
    "may_execute_git_service": false
  },
  "action_boundary": {
    "inspect_only": true,
    "acknowledge_only": true,
    "may_clear_state": false,
    "may_apply_state": false,
    "may_delete_state": false
  }
}
```

### `GET /api/v1/ontology-workbench`

Returns a consolidated readonly Ontology Workbench surface for the SpecSpace
utility panel. The endpoint aggregates the compiler-backed practical ontology
projection with the surrounding review artifacts published by SpecGraph:

- package metadata and normalized IR classes/relations;
- model applicability profiles from `runs/ontology_package_index.json`;
- compatibility diff classification buckets from
  `runs/ontology_compatibility_diff_preview.json`;
- grouped ontology gaps from `runs/ontology_gap_review_workflow.json`;
- report-only legacy spec findings from
  `runs/spec_ontology_validation_report.json`;
- SpecAuthor write-gate findings from
  `runs/specauthor_ontology_write_gate_report.json`;
- owner-decision import v2 review rows from
  `runs/ontology_owner_decision_import_v2.json`;
- legacy backfill batches from
  `runs/legacy_spec_ontology_backfill_plan.json`;
- artifact availability/status for the relevant `runs/*.json` files.

This is a review dashboard, not an authority boundary. The response is always
`read_only`, requires `canonical_mutations_allowed: false`, and rejects any
contract expansion that would allow SpecSpace to write Ontology packages,
update lockfiles, mutate SpecGraph specs, import owner decisions, or close
semantic gates.

Raw JSON remains available through the artifact inspector; the Workbench shows
the current ontology package, gaps, diffs, decision reviews, and backfill plan
in one UI-friendly payload.

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_ontology_workbench",
  "schema_version": 1,
  "read_only": true,
  "canonical_mutations_allowed": false,
  "summary": {
    "status": "ready",
    "term_count": 14,
    "relation_count": 16,
    "gap_group_count": 275,
    "compliance_finding_count": 287,
    "write_gate_finding_count": 3,
    "owner_decision_review_count": 0,
    "legacy_small_pr_batch_count": 2,
    "next_gap": "review_legacy_spec_backfill_batches"
  },
  "applicability": {
    "summary": {
      "profile_count": 1,
      "assumption_count": 2,
      "invalidation_trigger_count": 2,
      "used_layers": ["execution", "mechanics", "meta"]
    },
    "profiles": [
      {
        "package_id": "org.0al.specgraph.core",
        "package_ref": "org.0al.specgraph.core@0.1.0",
        "status": "declared",
        "applies_to": {
          "domains": ["specgraph_core"],
          "agent_types": ["SpecAuthorAgent", "SpecGraphSupervisor"]
        },
        "excludes": {
          "domains": ["unrelated_product_domain"]
        },
        "assumptions": [
          {
            "id": "human_review_required",
            "layer": "execution",
            "text": "Generated or imported ontology changes require human review before canonical specs are updated."
          }
        ],
        "invalidation_triggers": [
          {
            "id": "specgraph_core_vocabulary_changed",
            "layer": "mechanics",
            "text": "Re-review applicability when core SpecGraph classes, relations, or validation semantics change."
          }
        ]
      }
    ]
  },
  "diff_classification": {
    "summary": {
      "structural_change_count": 1,
      "annotation_change_count": 0,
      "applicability_change_count": 0,
      "total_change_count": 1
    },
    "structural_changes": [
      {
        "kind": "classAdded",
        "ref": "sgcore:ClaimCalibration"
      }
    ],
    "annotation_changes": [],
    "applicability_changes": []
  }
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

### `GET /api/v1/agent-surfaces`

Returns a readonly SpecSpace projection for SpecGraph agent/executor/passport
visibility. The endpoint combines stable derived SpecGraph artifacts when
present:

- `supervisor_executor_adapter_index.json`
- `known_agent_passport_index.json`
- `agent_surface_index.json`
- `agent_verification_gap_index.json`
- `agent_runtime_enforcement_evidence_index.json`
- `runs/agent_runtime_enforcement_evidence/*.json` detail artifacts referenced
  by safe evidence refs
- `external_consumer_handoff_packets.json`

Missing optional artifacts are represented in `sources`; the endpoint does not
parse raw supervisor logs, passport private material, local prompt files, or
executor output. It is a consumer surface for the SpecSpace handoff loop, not an
Agent Passport validation endpoint.

Executor backend availability is reported with producer runtime environment
semantics when SpecGraph publishes them. For example, `backend_status:
"not_applicable_in_producer_environment"` means the static publish producer is
not the intended local operator runtime and should not be presented as a broken
local executor configuration.

Runtime evidence detail refs are loaded only when they are repo-relative paths
under `runs/agent_runtime_enforcement_evidence/`. Absolute paths, URLs,
`file://`, Windows paths, home-relative paths, and traversal are rejected; the
aggregate evidence row remains visible with `detail_status: "invalid"` or
`"missing"` when details cannot be read.

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_agent_surface_index",
  "schema_version": 1,
  "read_only": true,
  "entry_count": 1,
  "summary": {
    "surface_count": 1,
    "executor_backend_count": 1,
    "missing_passport_count": 0,
    "verification_gap_count": 1,
    "agent_passport_cli_status": "available",
    "handoff_status": "ready_for_handoff",
    "next_gap": "review_handoff_packet"
  },
  "handoff": {
    "available": true,
    "handoff_id": "external_consumer_handoff::specspace",
    "handoff_status": "ready_for_handoff",
    "review_state": "ready_for_review"
  },
  "entries": [
    {
      "surface_id": "specgraph.executor.codex",
      "surface_type": "executor_backend",
      "passport_ref": "agent-passport://executors/codex-cli/0.1.0",
      "verification_state": "not_attempted",
      "runtime_enforcement_state": "not_enforced",
      "backend_status": "not_applicable_in_producer_environment",
      "runtime_environment": {
        "producer_environment": "static_publish_environment",
        "intended_environment": "local_operator_environment",
        "executable_probe_scope": "current_process_environment",
        "backend_status_semantics": "executable_probe_not_required_for_producer_environment",
        "static_publish_executable_required": false,
        "local_operator_executable_required": true,
        "producer_environment_executable_required": false,
        "producer_environment_execution_suppressed": true,
        "missing_executable_is_static_publish_gap": true,
        "operator_next_action": "run_in_intended_runtime_environment"
      },
      "gap_count": 1,
      "runtime_enforcement_evidence": [
        {
          "evidence_kind": "runtime_smoke",
          "status": "passed",
          "evidence_ref": "runs/agent_runtime_enforcement_evidence/codex-smoke.json",
          "detail_status": "available",
          "checks": [
            {
              "check_id": "executor_adapter_invocation_boundary",
              "status": "passed",
              "message": "Structured invocation boundary passed."
            }
          ]
        }
      ]
    }
  ],
  "executor_adapters": [
    {
      "backend_id": "codex",
      "backend_status": "not_applicable_in_producer_environment",
      "smoke_status": "not_run",
      "runtime_environment": {
        "producer_environment": "static_publish_environment",
        "intended_environment": "local_operator_environment",
        "executable_probe_scope": "current_process_environment",
        "backend_status_semantics": "executable_probe_not_required_for_producer_environment",
        "static_publish_executable_required": false,
        "local_operator_executable_required": true,
        "producer_environment_executable_required": false,
        "producer_environment_execution_suppressed": true,
        "missing_executable_is_static_publish_gap": true,
        "operator_next_action": "run_in_intended_runtime_environment"
      }
    }
  ],
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

Returns capability booleans, provider metadata, and deployment diagnostics.
`spec_markdown_export` means readonly SpecGraph Markdown export is available.
`hyperprompt_compile` means a Hyperprompt compiler and scratch workspace are
explicitly configured for SpecSpace and allowed for the active provider.
`agent_passport_cli` means the Agent Passport validation CLI binary is present
and executable in the API container. It is a bundled utility diagnostic, not a
public validation endpoint.
Static/HTTP artifact deployments should normally report
`spec_markdown_export: true` and `hyperprompt_compile: false`; they become
eligible only through the opt-in contract in
[`HTTP_HYPERPROMPT_COMPILE_CONTRACT.md`](HTTP_HYPERPROMPT_COMPILE_CONTRACT.md).

```json
{
  "api_version": "v1",
  "capabilities": {
    "spec_graph": true,
    "spec_markdown_export": true,
    "hyperprompt_compile": false,
    "agent_passport_cli": true
  },
  "diagnostics": {
    "spec_markdown_export": {
      "available": true,
      "status": "available",
      "detail": "Readonly SpecGraph Markdown export is available."
    },
    "hyperprompt_compile": {
      "available": false,
      "status": "scratch_not_configured",
      "detail": "Hyperprompt compile requires an explicit scratch workspace.",
      "configured_binary": "/repo/deps/hyperprompt",
      "resolved_binary": "/repo/deps/hyperprompt",
      "resolution_source": "configured",
      "checked_paths": ["/repo/deps/hyperprompt"],
      "scratch_workspace": null,
      "http_compile_enabled": false,
      "limits": {
        "timeout_seconds": 60,
        "max_input_bytes": 1048576,
        "max_output_bytes": 2097152,
        "bundle_retention_count": 20
      }
    },
    "agent_passport_cli": {
      "available": true,
      "status": "available",
      "detail": "Agent Passport validation CLI is bundled with this SpecSpace deployment.",
      "configured_binary": "/app/deps/agent-passport",
      "resolved_binary": "/app/deps/agent-passport",
      "checked_paths": ["/app/deps/agent-passport"]
    }
  },
  "provider": {
    "kind": "file",
    "read_only": true,
    "health": "ok"
  }
}
```

Known `hyperprompt_compile.status` values include `available`,
`http_compile_disabled`, `provider_unsupported`, `compiler_missing`,
`compiler_not_executable`, `scratch_not_configured`, `scratch_missing`,
`scratch_not_directory`, `scratch_not_writable`, `scratch_unreadable`, and
`invalid_limit`.
Known `agent_passport_cli.status` values include `available`,
`binary_missing`, `binary_not_file`, `binary_not_executable`,
`binary_unreadable`, and the UI fallback `not_reported` for older backends.

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
