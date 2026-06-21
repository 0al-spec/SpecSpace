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

### `GET /api/v1/idea-to-spec-workspace`

Returns a consolidated readonly Idea-to-Spec Workspace surface for the
SpecSpace utility panel. The endpoint aggregates the first autonomous
idea-to-spec artifacts produced by SpecGraph:

- `runs/idea_event_storming_intake.json`;
- `runs/candidate_spec_graph.json`;
- `runs/pre_sib_coherence_report.json`;
- `runs/candidate_repair_loop_report.json`.

The payload is designed for fast operator inspection: event-storming counts,
active ontology/domain/context frame, candidate graph nodes, pre-SIB/coherence
findings, repair-loop actions, metric deltas, and artifact availability.

This surface is not a write boundary. The response is always `read_only`,
requires `canonical_mutations_allowed: false`, and does not allow SpecSpace to
execute prompt agents, mutate candidate source artifacts, mutate canonical
specs, write Ontology packages, create Git branches/commits, or mark a
candidate graph accepted.

```json
{
  "api_version": "v1",
  "artifact_kind": "specspace_idea_to_spec_workspace",
  "schema_version": 1,
  "read_only": true,
  "canonical_mutations_allowed": false,
  "summary": {
    "status": "ready",
    "available_artifact_count": 4,
    "missing_artifact_count": 0,
    "candidate_node_count": 12,
    "pre_sib_finding_count": 2,
    "repair_action_count": 5,
    "repair_context_required_count": 1
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
