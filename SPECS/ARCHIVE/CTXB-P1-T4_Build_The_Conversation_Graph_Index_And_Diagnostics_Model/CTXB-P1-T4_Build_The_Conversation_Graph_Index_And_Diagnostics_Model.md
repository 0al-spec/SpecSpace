# CTXB-P1-T4 — Build The Conversation Graph Index And Diagnostics Model

## Objective Summary

Build the first deterministic graph snapshot for ContextBuilder on top of the normalization and validation work from `CTXB-P1-T2` and `CTXB-P1-T3`. The new index must turn a workspace of conversation files into a stable in-memory model that resolves conversation nodes, checkpoint metadata, parent and child lineage edges, merge relationships, and explicit diagnostics for broken references or blocked files.

This task must preserve two important behaviors at the same time:

1. valid roots, branches, merges, and normalized imports become graph nodes with resolved relationships,
2. graph problems stay visible instead of causing silent data loss, even when some files cannot be used as fully connected nodes.

The result should give `CTXB-P1-T5` one authoritative graph model to expose through the API without re-deriving lineage rules in a second place.

## Scope And Deliverables

### Deliverables

1. A shared graph snapshot builder in the runtime layer that:
   - normalizes and validates workspace files once,
   - creates deterministic conversation-node entries keyed by `conversation_id`,
   - derives checkpoint metadata from ordered messages,
   - resolves parent and child edges for branch and merge lineage,
   - records unresolved or broken edges as explicit diagnostics rather than dropping them.
2. A graph payload model returned by the server layer that includes:
   - workspace file validation summaries,
   - graph nodes that are safe to index,
   - edge collections or equivalent relationship views,
   - diagnostics for broken parents, missing parent messages, duplicate conversation IDs, unreadable files, and other graph-blocking conditions.
3. Regression tests covering:
   - a valid root + branch + merge workspace,
   - imported-root normalization inside graph indexing,
   - broken parent conversation diagnostics,
   - missing parent message diagnostics,
   - duplicate `conversation_id` handling that blocks ambiguous graph nodes.
4. README updates documenting the graph snapshot contract and how diagnostics map to graph visibility.

### Out Of Scope

1. Canvas rendering or graph UI state.
2. New mutation workflows for branch or merge creation.
3. Compile-target selection or Hyperprompt export behavior.
4. Re-index triggers or refresh persistence in the browser.

## Success Criteria

1. A mixed workspace of valid root, branch, merge, and imported-root files produces a deterministic graph snapshot.
2. Every indexed conversation node exposes ordered checkpoint metadata derived from its messages.
3. Parent and child relationships are available from the same snapshot without re-scanning raw files.
4. Missing parent conversations or missing parent messages remain visible as diagnostics and unresolved edges.
5. Duplicate or otherwise ambiguous conversations are reported explicitly and do not silently produce incorrect graph links.

## Acceptance Tests

### Graph Snapshot Acceptance

1. The canonical root, branch, and merge fixtures index into three conversation nodes with stable IDs.
2. The root node exposes outbound child links to the branch and merge descendants that reference its checkpoints.
3. The branch node exposes both its resolved parent checkpoint and its outbound merge relationship.
4. Imported-root fixtures normalize into graph nodes with empty parent lists and stable derived `conversation_id` values.

### Diagnostics Acceptance

1. A branch whose parent `conversation_id` does not exist still appears as a node but exposes a `missing_parent_conversation` diagnostic and an unresolved parent edge.
2. A branch whose parent `message_id` is missing still appears as a node but exposes a `missing_parent_message` diagnostic.
3. Two files with the same `conversation_id` do not produce a resolved graph node for that ambiguous ID and instead surface explicit duplicate-ID diagnostics.
4. Invalid JSON or structurally invalid payloads remain visible in workspace diagnostics without being indexed as graph nodes.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.

## Test-First Plan

1. Add failing server-level tests for the graph snapshot shape before implementing graph builders.
2. Add focused schema/runtime tests for duplicate IDs, broken parents, and checkpoint/edge derivation rules.
3. Implement the minimum graph-building helpers required to satisfy the failing tests, then tighten sorting and diagnostic details once the base snapshot is green.

## Implementation Plan

### Phase 1: Define The Graph Snapshot Contract

Inputs:
- `SPECS/PRD.md`
- `viewer/schema.py`
- `viewer/server.py`
- canonical and imported fixtures under `real_examples/`

Outputs:
- explicit graph payload shape
- rules for which files become indexed nodes versus diagnostics-only entries

Steps:
1. Define node fields needed by the next API task: conversation identity, title, file origin, checkpoint list, parent references, child references, and diagnostics.
2. Define edge semantics for resolved lineage versus unresolved lineage so broken references remain visible.
3. Define blocking conditions for indexing, especially duplicate `conversation_id` values and structurally invalid payloads.

Verification:
- Tests describe the same node, edge, and diagnostic contract the runtime returns.

### Phase 2: Build Deterministic Node And Edge Indexes

Inputs:
- normalized workspace reports from prior validation work
- graph snapshot contract from Phase 1

Outputs:
- graph builder helpers
- stable sorting rules for nodes, checkpoints, and diagnostics

Steps:
1. Normalize and validate the workspace once, then build a lookup for graph-safe conversations.
2. Derive checkpoint metadata from message order and `message_id`.
3. Resolve parent edges and reverse child edges for branch and merge lineage.
4. Attach unresolved edge descriptors and diagnostics when parent conversations or parent messages cannot be resolved.

Verification:
- Valid fixtures produce stable node and edge counts, and broken-link fixtures retain diagnostics without disappearing.

### Phase 3: Integrate The Graph Snapshot Into The Server

Inputs:
- graph builder helpers
- existing workspace listing behavior

Outputs:
- server helper that returns file metadata plus graph snapshot data
- serialization suitable for later API exposure

Steps:
1. Extend the workspace collection path so one call returns file listings, validation summaries, graph nodes, and graph diagnostics.
2. Preserve current per-file validation behavior while adding graph-oriented fields for later UI/API consumers.
3. Keep the output deterministic by sorting files, nodes, edges, and diagnostics consistently.

Verification:
- Server tests can assert on one top-level workspace snapshot without reconstructing lineage logic in test code.

### Phase 4: Document The Graph Model

Inputs:
- implemented graph snapshot

Outputs:
- README graph-model section
- validation report expectations for graph indexing

Steps:
1. Document what qualifies as an indexed node versus a diagnostics-only file.
2. Document checkpoint and edge semantics, including how broken references surface.
3. Confirm the docs, tests, and runtime payload all describe the same graph model.

Verification:
- `make test` and `make lint` both pass, and README examples align with the implemented payload shape.

## Decision Points

1. Missing-parent diagnostics should not automatically hide an otherwise valid child conversation, because PRD edge cases require the user to see the broken lineage.
2. Duplicate `conversation_id` values must block resolved graph indexing for that identity, because any edge attached to an ambiguous target would be misleading.
3. The graph snapshot should be deterministic in ordering so later UI rendering and compile selection remain stable across reloads.
4. Checkpoint metadata should be derived from existing message order rather than introducing a second checkpoint identifier system.

## Notes

This task should end with one authoritative graph snapshot builder that later API and UI work can consume directly. `CTXB-P1-T5` should only need to shape or expose that model, not reinterpret lineage rules, duplicate-ID handling, or broken-edge behavior.
