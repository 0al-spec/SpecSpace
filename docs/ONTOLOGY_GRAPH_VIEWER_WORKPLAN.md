# Ontology Graph Viewer Workplan

## Objective

Refactor SpecSpace toward a standalone `/ontology` product surface that can
render Ontology package graphs from local artifacts while preserving the current
SpecGraph viewer.

## Phase 0: Planning and Contract Framing

Status: this PR.

- Capture product requirements in `ONTOLOGY_GRAPH_VIEWER_PRD.md`.
- Capture architecture decision in `ADR_ONTOLOGY_GRAPH_VIEWER_EXTRACTION.md`.
- Document current coupling points and risks.
- Keep implementation out of scope.

Validation:

- Documentation links resolve.
- No runtime behavior changes.

## Phase 1: Standalone Route Shell

Status: implemented by the route shell slice.

Goal: `/ontology` is a real route, not a product workspace slug.

Steps:

- Add route-level discriminant in `graphspace/src/app`.
- Reserve `/ontology` before generic product workspace routing.
- Add `pages/ontology-viewer` with an empty but functional shell.
- Add route tests proving `/ontology` does not call `ViewerPage` workspace flow.
- Keep existing ViewerPage ontology panels and hooks in place.
- Document route in `SPECSPACE_BOUNDARY.md`.

Validation:

- `workspace-route` tests include `/ontology`.
- The page renders without fetching `/api/v1/spec-graph`.
- Existing workspace ontology panel tests still pass.
- `npm run test`, `npm run build`, `npm run lint:fsd`.

## Phase 2: Ontology Projection Contract

Status: implemented by the projection contract slice.

Goal: create a typed UI contract independent from SpecGraph node contracts.

Steps:

- Add `ontology_graph_projection/v1` TypeScript types.
- Add parser/projection tests for `generated/ontology.normalized.json`.
- Map:
  - `classes[]` to nodes;
  - `relations[]` to edges;
  - missing relation endpoints to diagnostics;
  - package/source metadata to inspector state.
- Add fixtures copied or minimized from Ontology generated outputs.

Validation:

- Projection fixture produces deterministic nodes and edges.
- Invalid fixture produces deterministic diagnostics.
- No imports from `entities/spec-node` or `entities/spec-edge`.

## Phase 3: Local File Import

Status: implemented for direct local normalized IR file import.

Goal: drag/drop a local Ontology artifact and build a projection in-browser.

Steps:

- Add local drop zone and file selection.
- Support direct `ontology.normalized.json` file drops.
- Support directory drops where browser APIs expose relative paths.
- Decide whether `.zip` support lands here or in Phase 4.
- Keep raw file contents in browser state only.
- Add size and file-count guardrails.

Validation:

- Valid IR renders summary.
- Invalid JSON shows diagnostics.
- Dropped files are not posted to backend endpoints.

## Phase 4: Ontology Graph Workbench

Status: implemented for normalized IR graph rendering, search, selection, and
inspector.

Goal: render the projection as a navigable graph.

Steps:

- Build ontology-specific React Flow nodes and edges.
- Implement deterministic layout for classes and relation edges.
- Add search, fit view, selected node/edge inspector, and diagnostics rail.
- Reuse generic controls only when they do not import SpecGraph semantics.
- Keep existing `SpecGraphCanvas` tests green.
- Keep existing ontology utility panel tests green.

Validation:

- Fixture graph renders non-empty nodes and edges.
- Node/edge selection updates inspector.
- Desktop and mobile smoke checks pass.
- Canvas text does not overlap at expected viewport sizes.

## Phase 5: Archive and Package Metadata

Status: implemented for local folder/ZIP package imports, metadata summary, and
compiler output shape diagnostics.

Goal: make real Ontology package archives ergonomic.

Steps:

- Add `.zip` support if not already implemented.
- Detect `domain-ontology-package.yaml` and display metadata when safely parsed.
- Detect compiler output folder shape:
  - `generated/ontology.normalized.json`;
  - optional generated SDK files;
  - compatibility/governance artifacts when present.
- Produce clear diagnostics for unsupported archive layouts.

Validation:

- Current Ontology package folder/ZIP loads.
- Unsupported archives show actionable messages.
- Bundle impact is reviewed if a ZIP/YAML parser is added.
- Canonical workspace ontology observation remains available independently of
  local archive import.

## Phase 6: Cross-Repo Stabilization

Status: producer manifest PR opened in Ontology; SpecSpace consumes
`ontology_viewer_archive_manifest` when present and keeps direct IR fallback.

Goal: avoid SpecSpace guessing package shape forever.

Steps for Ontology:

- Define a stable package archive manifest or export command for viewer input.
- Document which artifacts are public-safe and which are local/governance-only.
- Optionally publish a small sample archive as CI artifact.

Steps for SpecSpace:

- Consume the manifest when present.
- Keep fallback support for direct normalized IR drops.
- Add docs linking Ontology artifact format to `/ontology`.

Validation:

- One Ontology CI artifact can be downloaded and dropped into `/ontology`.
- Projection is stable across package versions.

## Out of Scope Until Later

- Registry-backed trusted package browsing.
- Publishing or promoting ontology packages.
- SpecGraph canonical mutation or semantic import apply.
- Removing existing SpecSpace ontology workspace panels.
- Server-side upload/storage.
- Running `ontologyc` in browser or on SpecSpace server.

## Recommended PR Sequence

1. Route shell and `/ontology` reservation.
2. Projection contract and fixtures.
3. Direct normalized IR drag/drop.
4. Ontology graph canvas and inspector.
5. Archive metadata and `.zip` support.
6. Ontology archive manifest contract.
