# CTXB-P1-T2 — Normalize Imported Conversations Into Graph Roots Or Linked Nodes

## Objective Summary

Implement deterministic normalization for externally supplied conversation JSON so ContextBuilder can promote valid imports into explicit graph-ready conversations without inventing ambiguous provenance. This task turns the schema rules from `CTXB-P1-T1` into executable normalization behavior that future graph indexing and validation work can call directly.

The implementation must accept two categories of valid input:

1. imported root conversations that match the currently observed `real_examples/import_json/` shape,
2. already-canonical conversations that should pass through unchanged.

Everything else must fail with structured, actionable errors.

## Scope and Deliverables

### Deliverables

1. Normalization helpers in `viewer/schema.py` that:
   - detect imported roots,
   - derive deterministic canonical root payloads,
   - preserve imported provenance fields,
   - return actionable errors for invalid inputs.
2. Tests covering:
   - normalization of real imported examples,
   - deterministic `conversation_id` generation,
   - pass-through handling for canonical payloads,
   - invalid payload rejection.
3. README updates documenting normalization rules and identity derivation.
4. Invalid import fixtures for regression coverage.

### Out of Scope

1. Full graph indexing.
2. Save-time validation for every future write path.
3. Server endpoint integration for normalization.
4. Branch or merge mutation flows.

## Success Criteria

1. Real imported JSON examples normalize into explicit canonical roots.
2. Normalization generates deterministic `conversation_id` values for the same imported input.
3. Canonical conversations pass through normalization without losing lineage.
4. Invalid imports are rejected with machine-usable errors and human-readable messages.

## Acceptance Tests

### Imported Root Acceptance

1. Every JSON file under `real_examples/import_json/` normalizes successfully.
2. Each normalized imported payload becomes `canonical-root`.
3. Each normalized imported payload has `lineage.parents == []`.

### Determinism Acceptance

1. Running normalization twice on the same imported payload yields the same `conversation_id`.
2. Conversation identity derivation does not depend on process-local randomness or mutable runtime state.

### Canonical Pass-Through Acceptance

1. Canonical root, branch, and merge fixtures normalize successfully.
2. Existing `conversation_id` and `lineage.parents` values remain unchanged for canonical payloads.

### Invalid Input Acceptance

1. An invalid imported payload missing stable message identity is rejected.
2. A payload with mismatched `message_count` is rejected.
3. Errors expose enough detail for later validation and API tasks.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.

## Test-First Plan

1. Add regression tests for normalization of the real imported examples before changing helper logic.
2. Add invalid fixture tests for missing `message_id` and mismatched `message_count`.
3. Add deterministic ID tests before implementing the final derivation function.

## Implementation Plan

### Phase 1: Define Normalization Semantics

Inputs:
- `SPECS/PRD.md`
- `viewer/schema.py`
- `real_examples/import_json/*.json`

Outputs:
- explicit normalization rules for imported roots and canonical pass-through payloads
- documented `conversation_id` derivation strategy

Steps:
1. Define when a payload is considered an imported root vs canonical payload vs invalid payload.
2. Define the deterministic input basis for generated `conversation_id`.
3. Define the minimum error surface for invalid payloads.

Verification:
- README and tests agree on the same normalization behavior.

### Phase 2: Implement Normalization Helpers

Inputs:
- schema rules from `CTXB-P1-T1`
- normalization rules from Phase 1

Outputs:
- helper functions and result structure in `viewer/schema.py`

Steps:
1. Add a normalization result structure or equivalent helper output.
2. Add canonical pass-through behavior.
3. Add imported-root normalization that materializes explicit `conversation_id` and empty lineage.
4. Add invalid-input rejection with error codes/messages.

Verification:
- Helper functions normalize valid imported examples and reject invalid fixtures.

### Phase 3: Lock Behavior With Fixtures and Docs

Inputs:
- implemented helper logic

Outputs:
- tests
- invalid fixtures
- README normalization section

Steps:
1. Add invalid import fixtures.
2. Extend tests to cover determinism, pass-through, and rejection.
3. Update docs so later tasks can reuse the normalization contract without reinterpreting it.

Verification:
- `make test` and `make lint` both pass.

## Decision Points

1. Imported roots become canonical roots by adding `conversation_id` and empty `lineage.parents`; they are not rejected simply because lineage is missing.
2. Deterministic `conversation_id` generation should use stable imported provenance such as `source_file`, `title`, and message anchors, not random UUIDs.
3. Canonical payloads should pass through normalization unchanged whenever already valid.
4. Invalid payloads should return structured errors rather than falling back to partial normalization.

## Notes

This task should leave behind a normalization primitive that later work can call from validation, graph indexing, and API layers. Future tasks must consume this shared normalization path instead of rebuilding import logic inside `viewer/server.py`.

---
**Archived:** 2026-03-22
**Verdict:** PASS
