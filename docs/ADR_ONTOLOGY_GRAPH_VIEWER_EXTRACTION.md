# ADR: Ontology Graph Viewer Extraction

## Status

Proposed

## Context

SpecSpace already shows ontology-related data through the SpecGraph workspace
viewer. Those surfaces are useful but not a standalone ontology product:

- practical ontology and ontology workbench are utility panels inside
  `ViewerPage`;
- the React Flow canvas is a SpecGraph canvas, not a generic graph workbench;
- `/ontology` currently collides with generic top-level product workspace
  routing unless it is explicitly reserved;
- Ontology packages are produced outside SpecSpace by `ontologyc`.

The desired product surface is a dedicated page at `specgraph.space/ontology`
where a user can drag and drop Ontology artifacts and inspect their graph
locally.

## Decision

Implement `/ontology` as a standalone SpecSpace page with a dedicated ontology
projection model and a read-only local import flow.

This is an additive product surface. The existing canonical SpecSpace ontology
observation panels inside the SpecGraph workspace viewer remain supported.

The implementation should extract reusable graph workbench primitives only where
they are truly generic. It should not turn the existing `SpecGraphCanvas` into a
fake ontology canvas by wrapping ontology data in `SpecNode`/`SpecEdge` shapes.

The durable UI contract should be an ontology-specific projection:

```text
Ontology package / normalized IR
  -> ontology_graph_projection/v1
  -> ontology graph workbench page
```

SpecGraph workspace artifacts can later be another input source for the same
projection, but the first route must work from local Ontology package files.

## Accepted Architecture

```text
graphspace/src/app
  -> route selection reserves /ontology

graphspace/src/pages/ontology-viewer
  -> page composition
  -> drag/drop state
  -> ontology projection adapter
  -> route-local tests and fixtures

graphspace/src/widgets/ontology-graph-workbench
  -> ontology-specific graph canvas + inspector if reused within ontology flows

graphspace/src/shared/*
  -> only generic graph, file-drop, or parsing helpers with no SpecSpace
     business semantics
```

FSD extraction should be conservative. A route-only implementation may start
inside `pages/ontology-viewer`; shared/widget extraction should happen when
there is real reuse between the standalone ontology viewer and the existing
SpecGraph viewer.

## Alternatives Considered

### Reuse `SpecGraphCanvas` by Converting Ontology to Fake SpecGraph Nodes

Rejected.

This is quick but wrong. `SpecGraphCanvas` contains SpecGraph semantics such as
`refines`, gap filters, lifecycle badges, SpecPM overlays, subtree collapse, and
Spec node preview detail. Ontology classes and relations should not pretend to
be SpecGraph specs.

### Keep Ontology Graph as a Utility Panel

Rejected.

The user workflow is product-level inspection of local Ontology artifacts. It
should not load the full SpecGraph workspace or hide inside the Utility Panel.

### Build the Viewer in the Ontology Repository

Rejected for now.

Ontology owns package contracts, compiler output, governance, and registry
semantics. SpecSpace already owns the deployed React graph viewer surface and
can host a route that consumes Ontology artifacts without becoming their
authority.

### Add Backend Upload and Server-Side Parsing First

Deferred.

Server upload creates deployment, privacy, storage, and cleanup questions. The
MVP can parse local files in the browser and keep artifacts private to the
operator's machine.

## Consequences

- The first implementation needs route plumbing before UI work.
- A small ontology projection contract is required before canvas work.
- SpecSpace will intentionally have two ontology entry points at first:
  canonical workspace observation panels and the local `/ontology` artifact
  viewer.
- Some React Flow code may be duplicated temporarily to avoid premature shared
  abstractions.
- Later cross-repo work should ask Ontology to publish a stable archive layout
  or manifest, not force SpecSpace to infer every package shape forever.

## Follow-Up Decisions

- Whether `.zip` support is part of MVP or a second slice.
- Whether browser YAML parsing is needed for package metadata in MVP.
- Whether ontology graph primitives should graduate to a generic
  `graph-workbench` widget after both SpecGraph and Ontology use cases are
  proven.
- Whether a future registry-backed `/ontology` mode should read trusted package
  indexes from Ontology or SpecPM.
