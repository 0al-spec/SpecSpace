# CTXB-P1-T3 — Validate Lineage Integrity And Reject Ambiguous Graph State

## Objective Summary

Add a shared integrity-validation layer that can inspect normalized conversations, detect ambiguous lineage state, and stop invalid payloads from being persisted through the local API. This task builds directly on `CTXB-P1-T2` so future graph indexing work can consume one authoritative validation path instead of re-implementing duplicate-ID and broken-parent checks in multiple places.

The implementation must do two things well:

1. validate a single payload before write, including filename safety and malformed lineage rejection,
2. validate a workspace of conversations so duplicate identities and broken parent references surface as explicit diagnostics instead of being silently ignored.

## Scope And Deliverables

### Deliverables

1. Validation helpers in `viewer/schema.py` that:
   - normalize imported roots before integrity checks,
   - validate canonical conversation structure more strictly than simple required-field checks,
   - report duplicate `message_id` values, malformed lineage payloads, and contradictory parent references,
   - validate a workspace for duplicate `conversation_id` values and missing parent references.
2. Server-side validation integration in `viewer/server.py` that:
   - returns integrity diagnostics when listing or loading files,
   - rejects invalid write requests with structured error payloads,
   - keeps valid imported files readable while preventing ambiguous saves.
3. Regression tests covering:
   - valid canonical and imported payloads,
   - duplicate conversation IDs across files,
   - broken parent references,
   - invalid canonical payloads and invalid filenames on save.
4. README updates documenting the new integrity rules and API behavior.

### Out Of Scope

1. Full graph indexing or canvas rendering.
2. Automatic repair of broken lineage data.
3. Complete branch or merge authoring workflows.
4. Re-index UI affordances beyond exposing diagnostics in existing API responses.

## Success Criteria

1. Imported roots and canonical fixtures remain valid after normalization plus integrity validation.
2. Duplicate `conversation_id` values across workspace files surface as explicit integrity errors.
3. Parent references to unknown conversations or unknown messages surface as explicit integrity errors.
4. Save requests with invalid filenames or malformed lineage payloads are rejected before writing to disk.
5. The validation output is structured enough for later graph and UI tasks to consume directly.

## Acceptance Tests

### Workspace Integrity Acceptance

1. A workspace containing two files with the same `conversation_id` returns duplicate-ID diagnostics.
2. A branch or merge conversation referencing a missing parent conversation returns a missing-parent diagnostic.
3. A branch or merge conversation referencing a missing parent `message_id` within an existing parent conversation returns a missing-parent-message diagnostic.

### Payload Validation Acceptance

1. Canonical fixtures for root, branch, and merge pass validation without errors.
2. A canonical payload with duplicate `message_id` values is rejected.
3. A canonical payload with malformed `lineage.parents` content is rejected.
4. Imported roots continue to validate after normalization.

### Save Path Acceptance

1. `POST /api/file` rejects invalid filenames with a structured `invalid_filename` error.
2. `POST /api/file` rejects malformed or ambiguous payloads without writing any file.
3. `POST /api/file` accepts valid imported roots and canonical conversations by persisting a canonicalized payload.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.

## Test-First Plan

1. Add failing validation tests for duplicate conversation IDs, broken parent references, malformed lineage payloads, and invalid filenames before changing the runtime.
2. Add server-level tests for write rejection and diagnostics exposure.
3. Implement the validation primitives only after the expected error codes and payload shapes are fixed by tests.

## Implementation Plan

### Phase 1: Define Integrity Error Surface

Inputs:
- `SPECS/PRD.md`
- `viewer/schema.py`
- canonical fixtures under `real_examples/canonical_json/`

Outputs:
- explicit validation result structure and error codes
- documented difference between payload validation and workspace validation

Steps:
1. Define machine-usable error codes for invalid filenames, malformed lineage, duplicate IDs, and missing parents.
2. Define when imported inputs are normalized first versus rejected immediately.
3. Define the payload shape returned by server endpoints when diagnostics exist.

Verification:
- Tests and README describe the same error contract.

### Phase 2: Implement Shared Validation Primitives

Inputs:
- normalization helpers from `CTXB-P1-T2`
- integrity error contract from Phase 1

Outputs:
- validation helpers in `viewer/schema.py`

Steps:
1. Add single-payload validation that works on canonical conversations and normalized imported roots.
2. Add workspace validation that resolves parent references against normalized conversations.
3. Add helpers that summarize whether a payload is safe to persist and whether a file is graph-blocking.

Verification:
- Schema-level tests pass for valid fixtures and targeted invalid cases.

### Phase 3: Wire Validation Into The Server API

Inputs:
- shared validation helpers
- `viewer/server.py`

Outputs:
- list, load, and write endpoints with integrity-aware behavior

Steps:
1. Return validation diagnostics from `/api/files` for each discovered JSON file.
2. Return validation diagnostics from `/api/file` alongside the requested payload.
3. Validate writes before persistence and save the canonicalized payload only when safe.

Verification:
- Server tests confirm invalid writes are rejected and valid writes succeed with canonicalized output.

### Phase 4: Document The Contract

Inputs:
- implemented validation behavior

Outputs:
- README updates
- validation report expectations

Steps:
1. Document integrity rules for duplicates, parent references, and write validation.
2. Document that write APIs now persist canonical payloads for valid imported roots.
3. Confirm docs, tests, and runtime behavior match.

Verification:
- `make test` and `make lint` both pass.

## Decision Points

1. Imported roots should stay readable and should normalize into canonical roots before integrity validation, rather than being treated as malformed canonical conversations.
2. Save operations should persist canonicalized payloads so newly written files cannot remain in an ambiguous pre-lineage shape.
3. Broken parent references should be explicit diagnostics, not silent omissions, even before the graph index exists.
4. Duplicate parent references to the same `(conversation_id, message_id, link_type)` target should be treated as invalid because they create redundant lineage edges.

## Notes

This task should leave behind a validation layer that `CTXB-P1-T4` can call directly when building the in-memory graph. The server should become the first consumer of that layer so invalid inputs fail early and diagnostics are already available to later UI work.
