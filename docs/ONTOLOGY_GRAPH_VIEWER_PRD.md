# Ontology Graph Viewer PRD

## Summary

SpecSpace should grow a standalone ontology graph viewer at `/ontology`.
The viewer lets an operator drag and drop Ontology package artifacts, inspect the
resulting ontology graph, and diagnose package shape without loading the full
SpecGraph workspace viewer.

This is a product extraction/refactoring effort. The first implementation must
not make SpecSpace an Ontology authority, must not mutate SpecGraph, and must not
upload local archives to the server.

## Current Codebase Findings

The existing SpecSpace code already contains useful ontology surfaces, but they
are embedded in the SpecGraph viewer:

- `graphspace/src/app/App.tsx` always renders `ViewerPage`.
- `graphspace/src/pages/viewer/model/workspace-route.ts` treats any safe
  top-level slug as a product workspace route, so `/ontology` must be reserved
  before generic workspace matching.
- `graphspace/src/pages/viewer/ui/ViewerPage.tsx` loads ontology hooks as
  utility panels alongside SpecGraph, SpecPM, agent, proposal, metrics, and
  product workspace surfaces.
- `PracticalOntologyPanel` renders a small bespoke SVG demo graph and
  `OntologyWorkbenchPanel` renders normalized IR and governance state as rows.
- `SpecGraphCanvas` is React Flow based, but its model is intentionally
  SpecGraph-specific: `SpecNode`, `SpecEdge`, `depends_on`, `refines`,
  lifecycle badges, gap filters, subtree collapse, and SpecPM overlays.
- `Ontology` emits `generated/ontology.normalized.json` with `classes[]` and
  `relations[]`; it also keeps `domain-ontology-package.yaml` as package source.

The refactoring should preserve the mature SpecGraph canvas while extracting
only reusable graph workbench primitives where there is an actual shared
technical boundary.

The existing ontology panels are still canonical SpecSpace observation surfaces
for the active SpecGraph workspace. The standalone `/ontology` route must be an
additional local artifact viewer, not a replacement for workspace-level
ontology observation.

## Users

- Ontology maintainer validating `DomainOntologyPackage` outputs.
- SpecGraph operator checking imported ontology vocabulary before using it in
  semantic bindings.
- Product/spec reviewer exploring domain vocabulary without reading YAML.
- 0AL developer comparing generated packages from Ontology CI artifacts.

## Goals

- Provide `/ontology` as a standalone SpecSpace route.
- Accept local Ontology package artifacts through drag and drop.
- Render a graph projection from normalized ontology IR.
- Show package metadata, classes, relations, diagnostics, and source files.
- Keep all archive parsing local in the browser for the MVP.
- Reuse current design language and React Flow infrastructure where appropriate.
- Keep SpecGraph and Ontology authority boundaries explicit.
- Preserve existing canonical SpecSpace ontology observation inside the
  SpecGraph workspace viewer.

## Non-Goals

- No canonical SpecGraph mutations.
- No ontology package publication, trusted promotion, or governance approval.
- No server-side archive upload in the first slice.
- No browser execution of `ontologyc`.
- No dependency solving across remote ontology registries.
- No removal, downgrade, or replacement of existing SpecGraph workspace
  ontology observation panels.

## Product Requirements

### Route and Shell

- `/ontology` must be reserved as a dedicated page route.
- `/ontology` must not resolve to a product workspace id.
- The page must not fetch `/api/v1/spec-graph` or other heavyweight SpecGraph
  workspace surfaces by default.
- The route must keep static deployment compatibility with the current
  single-page app fallback.

### Canonical SpecSpace Observation

- Existing ontology API surfaces such as `/api/v1/practical-ontology` and
  `/api/v1/ontology-workbench` remain part of the canonical SpecSpace workspace
  observation model.
- Existing ViewerPage ontology panels remain available for SpecGraph workspace
  users.
- `/ontology` must not force the canonical workspace viewer to depend on local
  drag/drop state.
- Future shared projection work must preserve the current read-only API
  contracts until an explicit migration PRD/ADR replaces them.

### Import

- MVP import source: local files selected through drag and drop.
- Supported initial inputs:
  - `generated/ontology.normalized.json`;
  - `domain-ontology-package.yaml` when present as metadata only;
  - a directory drop containing those files;
  - a `.zip` archive if a small vetted client-side ZIP reader is added.
- Unsupported archive types must produce a diagnostic, not a blank screen.
- The browser must not upload dropped files to SpecSpace backend endpoints.

### Projection Contract

Introduce a UI-facing projection model, tentatively:

```text
ontology_graph_projection/v1
  package
  nodes[]
  edges[]
  diagnostics[]
  source_files[]
  authority_boundary
```

Projection rules:

- Classes become graph nodes.
- Relations become graph edges using `domain` and `range`.
- Class `extends` may become an inheritance edge when the referenced class is
  present in the loaded package or imported foundation set.
- Policies, protocols, state machines, and compatibility metadata remain
  inspectable metadata until they need first-class graph semantics.

### Visualization

- The graph view must support pan, zoom, fit view, selection, and search.
- The inspector must show raw package references, class/relation detail, and
  source file provenance.
- Layout must be deterministic for test fixtures.
- Node and edge labels must remain readable on desktop and mobile.
- Existing SpecGraph graph behavior must not regress.

### Diagnostics

The page should clearly classify:

- no file loaded;
- unsupported file or archive;
- missing normalized IR;
- malformed JSON/YAML shape;
- relation domain/range target missing from loaded classes;
- duplicate class or relation ids;
- dropped artifact appears to be a SpecGraph artifact, not an Ontology package.

### Authority Boundary

The page is read-only:

- `ontology_viewer_is_authority: false`;
- `may_write_ontology_package: false`;
- `may_mutate_canonical_specs: false`;
- `may_publish_registry_entry: false`.

Any future write or publish flow must be introduced behind a separate PRD/ADR.

## Success Criteria

- A current Ontology package fixture renders at `/ontology` with non-zero nodes
  and edges.
- `/ontology` does not route through `ViewerPage` or generic product workspace
  handling.
- Existing canonical ontology panels in the SpecGraph workspace remain
  reachable and tested.
- Dropping an invalid artifact shows deterministic diagnostics.
- Frontend tests cover projection, route selection, and import error handling.
- `npm run build`, `npm run test`, and `npm run lint:fsd` pass for `graphspace`.
- Existing SpecGraph canvas tests continue to pass.

## Risks

- Reusing `SpecGraphCanvas` directly would leak SpecGraph semantics into an
  ontology product surface.
- Adding archive parsing can increase browser bundle size; prefer directory/file
  input first or a narrow ZIP dependency with tests.
- YAML parsing in the browser requires a dependency decision. The MVP can treat
  YAML package source as optional metadata until a parser is justified.
- Large ontology packages may require layout throttling or virtualized lists.

## Difficulty

Reasoning effort: high.

The UI can start small, but the boundary work is non-trivial because current
canvas, routing, and utility panels were built around the SpecGraph workspace.
