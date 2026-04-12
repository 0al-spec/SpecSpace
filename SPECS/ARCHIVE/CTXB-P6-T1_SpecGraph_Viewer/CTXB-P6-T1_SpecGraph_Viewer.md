# CTXB-P6-T1 — Render SpecGraph Specification Nodes in the ContextBuilder Viewer

**Status:** PLAN
**Priority:** P1
**Dependencies:** none (all existing viewer infrastructure is stable)

---

## Motivation

SpecGraph (`/Users/egor/Development/GitHub/0AL/SpecGraph`) is a closely related project that maintains a graph of product specifications as YAML node files under `specs/nodes/`. These specification nodes have their own graph structure (edges via `depends_on`, `refines`, `relates_to`) and rich metadata (lifecycle status, maturity, acceptance criteria, decisions).

ContextBuilder already has a mature graph rendering pipeline: React Flow canvas, Dagre layout, node/edge rendering, inspector panel, and a Python API server. Rather than building a separate viewer for SpecGraph, we can reuse the existing ContextBuilder infrastructure to render spec graphs alongside — or instead of — conversation lineage graphs.

This is an **exploration / option**, not a pivot. The conversation viewer remains the primary use case. SpecGraph rendering is an additive capability.

---

## Scope

### In Scope

1. **YAML spec ingestion** — Read `*.yaml` files from a configurable spec directory, parse them, and build an in-memory graph of spec nodes and edges.
2. **Spec graph API** — Expose spec graph data through ContextBuilder API endpoints (new or extended).
3. **Spec node rendering** — New React Flow node type(s) for spec nodes, visually distinct from conversation nodes, displaying: id, title, kind, status, maturity.
4. **Spec edge rendering** — Render `depends_on`, `refines`, and `relates_to` as typed, visually distinct edges on the canvas.
5. **Spec inspector** — Display spec details in the inspector panel when a spec node is selected: full metadata, acceptance criteria, specification content.
6. **Expanded spec view** — Expand a spec node to show its internal structure (acceptance criteria, decisions, invariants) as sub-nodes, analogous to how conversations expand to show messages.

### Out of Scope

- Editing or mutating spec YAML files from the viewer.
- Running SpecGraph supervisor or refinement workflows from ContextBuilder.
- Mixing conversation nodes and spec nodes in a single unified graph.
- Compile/export pipeline for spec graphs (future work).
- SpecGraph validation or lifecycle enforcement (SpecGraph owns its own governance).

---

## Source Data Contract

### SpecGraph Node YAML Structure

Each file in `specs/nodes/` is a YAML document with this shape:

```yaml
id: SG-SPEC-0001                    # Stable node identity
title: "SpecGraph - The Executable Product Ontology"
kind: spec                           # Node kind (spec, intent, requirement, decision, etc.)
status: linked                       # Lifecycle status (idea/stub/outlined/specified/linked/reviewed/frozen)
maturity: 0.68                       # Continuous signal 0.0-1.0
depends_on: [SG-SPEC-0002]          # Blocking dependencies (edges)
relates_to: []                       # Non-blocking cross-references (edges)
refines: [SG-SPEC-0001]             # Refinement chain edges (optional, present on child specs)
inputs: [...]                        # Source files
outputs: [...]                       # Output files
acceptance: [...]                    # List of acceptance criterion strings
acceptance_evidence: [...]           # Evidence entries [{criterion, evidence}]
specification:                       # Rich nested content
  objective: "..."
  scope: {in: [...], out: [...]}
  terminology: {key: value, ...}
  layers: [...]
  node_kinds: [...]
  edge_kinds: [...]
  invariants: [...]
  decisions: [...]
  # ... (structure varies by spec)
```

### Edge Semantics

| Field | Edge Type | Semantics | Visual |
|-------|-----------|-----------|--------|
| `depends_on` | Blocking dependency | Source cannot advance without target | Solid, directional |
| `refines` | Refinement | Source elaborates target | Dashed, directional |
| `relates_to` | Cross-reference | Non-blocking relationship | Dotted, bidirectional |

---

## Architecture

### Server Side (Python)

1. **New module: `viewer/specgraph.py`**
   - `load_spec_nodes(spec_dir: str) -> list[dict]` — Read and parse all `*.yaml` files from the spec directory.
   - `build_spec_graph(nodes: list[dict]) -> dict` — Build graph index: nodes, edges (from `depends_on`, `refines`, `relates_to`), roots (nodes with no incoming `refines`), diagnostics (missing targets, broken refs).
   - `collect_spec_graph_api(spec_dir: str) -> dict` — Top-level function returning the full spec graph API payload.

2. **Server integration (`viewer/server.py`)**
   - New CLI argument: `--spec-dir` (path to SpecGraph `specs/nodes/` directory).
   - New API endpoint: `GET /api/spec-graph` — Returns spec graph payload.
   - New API endpoint: `GET /api/spec-node?id=...` — Returns single spec node detail.
   - Existing conversation endpoints remain unchanged.

3. **Makefile**
   - Add `SPEC_DIR` variable to `serve` and `dev` targets.

### Client Side (React + TypeScript)

1. **New node types:**
   - `SpecNode` — Collapsed spec node showing: id, title, kind badge, status badge, maturity bar.
   - `ExpandedSpecNode` — Group container showing acceptance criteria, decisions, invariants as sub-items.

2. **New edge styles:**
   - `depends_on` edges: solid line, arrow, red/orange tint.
   - `refines` edges: dashed line, arrow, blue tint.
   - `relates_to` edges: dotted line, no arrow, gray tint.

3. **Graph mode switcher:**
   - Toggle or tab in the sidebar to switch between "Conversations" and "Specifications" graph views.
   - Each mode loads its respective API endpoint and renders with appropriate node/edge types.

4. **Inspector panel extension:**
   - When a spec node is selected, render: metadata table (id, kind, status, maturity), acceptance criteria list, specification.objective, scope (in/out), terminology, decisions.

---

## Deliverables

| # | Deliverable | File(s) |
|---|-------------|---------|
| 1 | YAML spec ingestion module | `viewer/specgraph.py` |
| 2 | Spec graph API endpoints | `viewer/server.py` |
| 3 | Spec node React component | `viewer/app/src/SpecNode.tsx` |
| 4 | Expanded spec node component | `viewer/app/src/ExpandedSpecNode.tsx` |
| 5 | Spec edge styles | `viewer/app/src/theme.css` |
| 6 | Graph mode switcher | `viewer/app/src/Sidebar.tsx`, `viewer/app/src/App.tsx` |
| 7 | Inspector panel for specs | `viewer/app/src/InspectorOverlay.tsx` |
| 8 | Makefile SPEC_DIR support | `Makefile` |
| 9 | Python tests for spec ingestion | `tests/test_specgraph.py` |
| 10 | TypeScript types for spec data | `viewer/app/src/types.ts` |

---

## Acceptance Criteria

1. Running `make serve DIALOG_DIR=... SPEC_DIR=/path/to/specs/nodes` starts the server with both conversation and spec graph support.
2. `GET /api/spec-graph` returns all spec nodes with edges, roots, and diagnostics in a shape consistent with `GET /api/graph`.
3. The React canvas renders spec nodes with distinct visual treatment (kind badge, status badge, maturity indicator).
4. `depends_on`, `refines`, and `relates_to` edges are visually distinguishable on the canvas.
5. Clicking a spec node opens the inspector with full spec metadata and acceptance criteria.
6. A mode switcher in the sidebar allows toggling between Conversations and Specifications views.
7. Expanding a spec node shows its acceptance criteria and decisions as sub-items.
8. Existing conversation viewer functionality is not broken by the addition.
9. Python tests cover YAML parsing, graph construction, edge extraction, and API response shape.
10. The viewer loads the 3 existing SpecGraph nodes (SG-SPEC-0001, 0002, 0003) correctly with their inter-node edges.

---

## Open Questions

1. **Unified vs. separate graphs** — Should spec nodes ever appear on the same canvas as conversation nodes (e.g., linking a conversation to the spec it discusses)? Deferred to future work.
2. **Spec directory discovery** — Should ContextBuilder auto-discover `specs/nodes/` relative to dialog-dir, or always require explicit `--spec-dir`? Start with explicit.
3. **Write-back** — Should the viewer ever write back to spec YAML? Explicitly out of scope for this task.

---

## Risk Assessment

- **Low risk:** Additive feature, no changes to existing conversation pipeline.
- **YAML parsing:** Python stdlib `yaml` module (PyYAML) is required; currently not a dependency. Need to add it.
- **Schema drift:** SpecGraph YAML schema may evolve. The viewer should be tolerant of unknown fields.
