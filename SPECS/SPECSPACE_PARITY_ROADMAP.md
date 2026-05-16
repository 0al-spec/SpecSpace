# SpecSpace Parity Roadmap

Status: active planning
Updated: 2026-05-17

## Purpose

SpecSpace is the replacement workspace for the old ContextBuilder viewer, not
only a static SpecGraph browser. The target product loop is:

```text
SpecGraph canvas
  -> inspect specs, gaps, proposals, metrics
  -> collect graph context
  -> discuss with the SpecSpace agent
  -> emit proposal or analysis artifact
  -> review and materialize graph changes
```

The old ContextBuilder still has important product surfaces that must be
recomposed into SpecSpace instead of copied one-to-one.

## Source Boundaries

### SpecGraph Static Artifacts

SpecGraph owns graph-specific generated artifacts:

- specs and graph edges;
- activity feed;
- implementation work index;
- proposal trace and proposal lane artifacts;
- metrics artifacts;
- graph dashboard and overlays.

SpecSpace consumes these through `/api/v1/*` and, in production, through the
HTTP/static artifact provider backed by `https://specgraph.tech`.

### SpecPM Public Registry

SpecPM already publishes a read-only registry at:

```text
https://0al-spec.github.io/SpecPM
```

The remote registry API is rooted at `/v0`:

- `GET /v0/status`
- `GET /v0/packages`
- `GET /v0/packages/{package_id}`
- `GET /v0/packages/{package_id}/versions/{version}`
- `GET /v0/capabilities/{capability_id}/packages`
- `GET /v0/intents`
- `GET /v0/intents/{intent_id}`
- `GET /v0/intents/{intent_id}/packages`

SpecSpace should treat this as a readonly metadata source. It should not run
SpecPM package content, mutate packages, publish packages, or infer package
authority beyond the registry payloads.

## Parity Tracks

### 1. SpecPM Registry Integration

Current gap: `/api/v1/specpm/lifecycle` is local-checkout oriented and returns
`503` in Timeweb/static mode.

Target:

- add `SPECSPACE_SPECPM_REGISTRY_URL` and `--specpm-registry-url`;
- report registry state in `/api/v1/health`;
- add a backend adapter for the SpecPM `/v0` registry;
- replace static-mode lifecycle noise with registry-backed readonly metadata;
- keep local checkout lifecycle available for developer mode.

Initial registry data does not need to be a full lifecycle replacement. The
first useful slice is registry status, package index, and package/version
metadata linked from SpecGraph specs where package refs are known.

### 2. Agent Workbench Conversations

Conversation mode remains a core future surface. In SpecSpace it should become
an Agent Workbench:

- conversations are first-class persisted artifacts;
- selected spec nodes, edges, gaps, proposals, and metrics can be added to the
  agent context;
- every proposal can originate from a conversation turn;
- agent output can become draft proposal, analysis, or implementation handoff;
- conversation history is inspectable and linkable back to graph context.

This is not the legacy file-browser conversation UI. The old ContextBuilder
conversation graph is source material for persistence, lineage, and transcript
inspection patterns.

### 3. Proposal Viewer

Current gap: GraphSpace shows proposal trace rows, but not the full proposal
workspace from the old viewer.

Target:

- proposal list with status, authority lane, runtime state, and affected specs;
- proposal detail view for markdown/content and extracted metadata;
- links from proposal to referenced specs and gaps;
- "start from conversation" and "add to agent context" actions;
- static artifact support through existing SpecGraph proposal artifacts.

Relevant existing backend/read-model sources include:

- `proposal_lane_overlay.json`
- `proposal_runtime_index.json`
- `proposal_promotion_index.json`
- `proposal_spec_trace_index.json`
- `docs/proposals/*.md` when a local checkout is available

### 4. Metrics Screen

Current gap: legacy metrics endpoints exist, but SpecSpace lacks a dedicated
metrics screen.

Target:

- metrics dashboard page/panel for source promotion, delivery workflow,
  feedback, metric pack adapters, and metric pack runs;
- graph/canvas cross-links from metric signals to spec nodes and proposals;
- static artifact compatibility for production deploys.

Relevant existing artifacts:

- `metrics_source_promotion_index.json`
- `metrics_delivery_workflow.json`
- `metrics_feedback_index.json`
- `metric_pack_adapter_index.json`
- `metric_pack_runs.json`
- `graph_dashboard.json`

### 5. Canvas Interaction Parity

Current gap: canvas selection and navigation exist, but graph editing and
analysis workflows are not yet first-class.

Target:

- edge selection and edge inspector;
- node moving and layout persistence;
- visible gap marks and gap filters;
- selecting spec nodes, edges, gaps, and proposals as agent context;
- minimap and canvas controls that stay coherent with side panels;
- proposal/metric overlays on graph nodes and edges.

## Suggested Next Slices

1. `CTXB-P13-T1` — Select SpecSpace parity track after deployment hardening.
2. `CTXB-P13-T2` — Disable or replace local-only SpecPM lifecycle UI in static mode.
3. `CTXB-P13-T3` — Add SpecPM registry URL config and health reporting.
4. `CTXB-P13-T4` — Add SpecPM registry status/package read adapter.
5. `CTXB-P13-T5` — Start Proposal Viewer parity with static proposal indexes.
6. `CTXB-P13-T6` — Start Metrics screen parity with existing metrics artifacts.
7. `CTXB-P13-T7` — Define Agent Workbench conversation artifact model.
8. `CTXB-P13-T8` — Add graph-context-to-agent-context selection flow.

