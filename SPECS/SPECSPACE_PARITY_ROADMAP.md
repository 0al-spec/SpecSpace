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
`503` in HTTP/static mode.

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

The initial artifact contract is documented in
[`docs/AGENT_WORKBENCH_CONVERSATIONS.md`](../docs/AGENT_WORKBENCH_CONVERSATIONS.md).
The Agent UI framework adapter boundary is documented in
[`docs/AGENT_UI_FRAMEWORK_BOUNDARY.md`](../docs/AGENT_UI_FRAMEWORK_BOUNDARY.md).
The initial framework evaluation is documented in
[`docs/AGENT_UI_FRAMEWORK_EVALUATION.md`](../docs/AGENT_UI_FRAMEWORK_EVALUATION.md).

### 3. Proposal Viewer

Current gap: SpecSpace UI shows proposal trace rows, but not the full proposal
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

1. `CTXB-P13-T5` — Start Proposal Viewer parity with static proposal indexes.
2. `CTXB-P13-T6` — Start Metrics screen parity with existing metrics artifacts.
3. `CTXB-P13-T7` — Define Agent Workbench conversation artifact model.
4. `CTXB-P13-T8` — Add graph-context-to-agent-context selection flow.
5. `CTXB-P13-T9` — FSD boundary for Agent Workbench UI adapters.
6. `CTXB-P13-T10` — Evaluate Agent UI framework options for the first adapter.
7. `CTXB-P13-T11` — Agent conversation runtime mock adapter.
8. `CTXB-P13-T12` — Agent conversation panel shell over the mock runtime.
9. `CTXB-P13-T13` — Assistant UI adapter spike behind the conversation panel boundary. ✅
10. `CTXB-P13-T14` — Proposal Viewer markdown previews. ✅
11. `CTXB-P13-T15` — Proposal detail panel. ✅
12. `CTXB-P13-T16` — Edge context selection for Agent Workbench. ✅
13. `CTXB-P13-T17` — Visible gap context selection for Agent Workbench. ✅
14. `CTXB-P13-T18` — Canvas gap marks and filters. ✅
15. `CTXB-P13-T19` — Edge inspector for selected SpecGraph edges. ✅
16. `CTXB-P13-T20` — Node moving and layout persistence. ✅
17. `CTXB-P13-T21` — Proposal and metric overlays on graph nodes and edges. ✅
18. `CTXB-P13-T22` — Contextual Proposal/Metrics filtering from canvas overlays.
