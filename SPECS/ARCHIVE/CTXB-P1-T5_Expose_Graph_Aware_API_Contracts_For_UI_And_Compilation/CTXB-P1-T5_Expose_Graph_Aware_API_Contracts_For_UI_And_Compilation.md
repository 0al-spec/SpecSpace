# CTXB-P1-T5 — Expose Graph Aware API Contracts For UI And Compilation

## Objective Summary

Expose the graph model built in `CTXB-P1-T4` through explicit API contracts that later UI and compilation tasks can consume without re-deriving lineage rules from raw files. The server must keep one authoritative workspace scan, then expose stable access paths for graph-wide data, conversation detail, checkpoint detail, and compile-target-ready selection metadata.

This task exists to bridge the current validation/indexing work and the upcoming canvas, detail panel, and compile pipeline tasks. The API contract must make three things explicit:

1. which files or graph elements are valid versus blocked,
2. how a client fetches node and checkpoint metadata directly,
3. how a future compile flow resolves a selected conversation or checkpoint into deterministic lineage metadata.

## Scope And Deliverables

### Deliverables

1. Server helpers that derive graph API payloads from one workspace listing without duplicating lineage logic.
2. API contracts for:
   - graph-wide data and blocking issue summaries,
   - conversation detail by `conversation_id`,
   - checkpoint detail by `conversation_id` and `message_id`,
   - compile-relevant selection metadata for both conversation and checkpoint scopes.
3. Regression tests that cover successful graph, conversation, and checkpoint reads plus invalid or blocked lookups.
4. README updates documenting the new endpoints and the compile-target metadata contract.

### Out Of Scope

1. Canvas rendering or graph navigation UI.
2. Persisting compile-target selection in the browser.
3. Hyperprompt export generation or compiler invocation.
4. Branch or merge creation workflows.

## Success Criteria

1. A client can fetch graph-wide nodes, edges, roots, blocked files, and blocking-issue summaries from a dedicated API response.
2. A client can fetch a single conversation by `conversation_id` and receive its checkpoints, lineage edges, diagnostics, and compile selection metadata.
3. A client can fetch a single checkpoint by `conversation_id` and `message_id` and receive direct child edges plus compile selection metadata anchored to that checkpoint.
4. Blocked or unknown graph references return structured errors instead of silently falling back.
5. Compile-target metadata is deterministic and preserves root-to-target lineage for future export tasks.

## Acceptance Tests

### API Contract Acceptance

1. `GET /api/graph` returns the workspace graph plus graph summary fields that distinguish blocking issues from non-blocking diagnostics.
2. `GET /api/conversation?conversation_id=...` returns the requested node, related parent and child edges, and compile-target metadata for that conversation.
3. `GET /api/checkpoint?conversation_id=...&message_id=...` returns the requested checkpoint, outbound child edges, and compile-target metadata anchored to that checkpoint.
4. A blocked or missing `conversation_id` returns a structured `404` or `409` style error with diagnostics.

### Diagnostics And Selection Acceptance

1. A branch with a missing parent conversation still returns conversation detail and compile-target metadata, but surfaces broken-edge diagnostics clearly.
2. A merge conversation exposes multiple parent edges and lineage ancestry in deterministic order.
3. Checkpoint detail exposes the exact `message_id` anchor later export tasks will use to represent a selected continuation point.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.

## Test-First Plan

1. Add failing server tests for graph, conversation, and checkpoint contract helpers before adding new endpoints.
2. Add failing HTTP-level tests for `GET /api/graph`, `GET /api/conversation`, and `GET /api/checkpoint`.
3. Implement the smallest server helpers needed to make the new tests pass, then update README documentation to match the shipped contract.

## Implementation Plan

### Phase 1: Define Graph API Payload Shapes

Inputs:
- `SPECS/PRD.md`
- `viewer/server.py`
- `tests/test_graph.py`

Outputs:
- explicit graph summary shape
- explicit conversation and checkpoint detail shapes
- compile-target metadata rules for conversation and checkpoint scopes

Steps:
1. Define graph summary fields that separate total diagnostics from blocking issues.
2. Define conversation detail payloads that reuse the indexed node plus its related edges.
3. Define checkpoint detail payloads that expose one checkpoint anchor and its child lineage.
4. Define compile-target metadata using deterministic root-to-target ancestry and target anchor fields.

Verification:
- Tests describe the exact response fields and failure cases before implementation.

### Phase 2: Implement Graph Detail And Compile-Target Helpers

Inputs:
- existing workspace listing and graph snapshot
- payload shapes from Phase 1

Outputs:
- server lookup helpers
- structured error payloads for blocked or unknown lookups

Steps:
1. Build lookup maps from the existing graph snapshot so details can be resolved without rescanning files.
2. Resolve conversation-level related edges and checkpoint-level child edges from those maps.
3. Derive compile-target metadata for conversation and checkpoint selections, including lineage ancestry and merge-parent provenance.
4. Return structured blocked-reference responses when the requested graph item is unavailable because of validation issues.

Verification:
- Tests cover valid roots, branches, merges, missing conversations, missing checkpoints, and blocked duplicates.

### Phase 3: Wire New HTTP Endpoints And Document Them

Inputs:
- helper functions from Phase 2
- current `ViewerHandler`

Outputs:
- `/api/graph`, `/api/conversation`, and `/api/checkpoint`
- README endpoint documentation

Steps:
1. Add GET handlers for the new read-only graph endpoints.
2. Keep `/api/files` and `/api/file` behavior stable for existing clients.
3. Document endpoint inputs, outputs, and error semantics in the README.

Verification:
- `make test` and `make lint` both pass, and README examples match the implemented responses.

## Decision Points

1. The graph-specific API should be read-only and additive so current file APIs remain backward compatible.
2. Conversation and checkpoint detail should be keyed by canonical graph identifiers, not filenames, because later graph and compile flows operate on lineage anchors rather than raw file names.
3. Compile-target metadata should be generated on read instead of stored on disk, because selection persistence belongs to later tasks and the lineage graph is already the source of truth.
4. Blocked graph identities should return explicit structured errors so UI code can distinguish invalid references from empty states.

## Notes

The implementation should stay thin: reuse the existing normalized workspace listing and graph snapshot as the only lineage source, then shape API-friendly views on top. Later tasks should be able to render the graph, inspect checkpoints, and choose compile targets using these contracts without restating graph rules in the client.

---
**Archived:** 2026-03-22
**Verdict:** PASS
