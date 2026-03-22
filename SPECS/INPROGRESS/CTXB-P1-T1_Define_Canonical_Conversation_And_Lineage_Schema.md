# CTXB-P1-T1 — Define Canonical Conversation and Lineage Schema

## Objective Summary

Define the canonical JSON contract that ContextBuilder will use for root, branch, and merge conversations, while staying compatible with the real imported examples under `real_examples/import_json/`. This task establishes the schema baseline for graph indexing, lineage validation, compile-target selection, and Hyperprompt export.

The implementation must do three things in one pass:

1. document the canonical conversation and message schema,
2. preserve the current imported shape as an explicitly supported root-conversation format,
3. add machine-usable helpers and fixtures so future tasks can build validation and graph logic on stable field definitions rather than ad hoc string literals.

## Scope and Deliverables

### Deliverables

1. Updated product-facing documentation in `README.md` describing:
   - imported root conversation format,
   - canonical root / branch / merge format,
   - identifier semantics for `conversation_id`, `message_id`, `turn_id`, and `lineage.parents`.
2. Canonical example fixtures for:
   - root conversation,
   - branch conversation,
   - merge conversation.
3. A lightweight schema helper module in `viewer/` exposing stable field names and compatibility helpers for current imports.
4. Automated tests covering the schema helper behavior and the example fixture expectations.

### Out of Scope

1. Full graph indexing.
2. Save-time validation of all malformed cases.
3. Canvas rendering or compile execution.
4. Mutation of existing imported examples into canonical branch or merge files.

## Real-Data Constraints

The task must reflect the current imported examples, which show:

1. Top-level imported files currently contain `title`, `source_file`, `message_count`, and `messages`.
2. Imported messages currently contain `role`, `turn_id`, `message_id`, `source`, and `content`.
3. `message_id` and `turn_id` are both stable but are not universally identical.
4. Imported files currently do not include top-level `conversation_id` or `lineage.parents`, so imported files must be treated as compatible roots that require normalization for the canonical graph.

## Success Criteria

1. The repository documents one canonical schema for root, branch, and merge conversations.
2. The docs explicitly define how imported real examples map into that canonical model.
3. The codebase contains reusable helpers for conversation and message field semantics.
4. Automated tests prove the helpers correctly recognize imported roots and preserve `message_id` vs `turn_id` semantics.

## Acceptance Tests

### Documentation Acceptance

1. `README.md` includes a canonical JSON example for root, branch, and merge conversations.
2. `README.md` states that imported examples are supported as roots and require normalization for missing `conversation_id` and lineage metadata.
3. `README.md` explicitly states that `turn_id` and `message_id` must not be assumed equivalent.

### Fixture Acceptance

1. New canonical fixture files exist under a stable examples directory.
2. Each fixture is valid JSON and readable by repository tests.
3. The branch fixture contains a single parent reference.
4. The merge fixture contains multiple parent references.

### Helper Acceptance

1. A schema helper module exposes stable field-name constants or equivalent helper functions.
2. The helper module can classify current imported examples as compatible root conversations.
3. The helper module preserves optional imported provenance fields such as `source_file`, `turn_id`, and `source`.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.

## Test-First Plan

1. Add tests that load the real imported examples and assert the compatibility assumptions documented above.
2. Add tests that load the canonical root / branch / merge fixtures and assert expected lineage structure.
3. Add tests for schema helpers before wiring them into any runtime code.

## Implementation Plan

### Phase 1: Inspect and Codify Existing Imported Shape

Inputs:
- `real_examples/import_json/*.json`
- `README.md`

Outputs:
- explicit imported-root compatibility rules
- test assertions for current field presence and identifier behavior

Steps:
1. Add tests that assert imported examples contain the expected top-level keys and message-level keys.
2. Add tests that assert imported examples have unique `message_id` values and do not rely on `turn_id == message_id`.
3. Summarize those findings in the documentation.

Verification:
- Test suite proves the documentation claims are based on actual repository fixtures.

### Phase 2: Define the Canonical Schema Surface

Inputs:
- findings from Phase 1
- `SPECS/PRD.md`

Outputs:
- canonical schema section in `README.md`
- canonical root / branch / merge example fixtures

Steps:
1. Document canonical conversation-level fields and message-level fields.
2. Define parent reference structure for branch and merge conversations.
3. Add canonical example files that future validation and graph tasks can use as fixtures.

Verification:
- Example files parse as JSON and match the documented structure.

### Phase 3: Add Machine-Usable Schema Helpers

Inputs:
- canonical schema decisions
- imported compatibility rules

Outputs:
- `viewer/schema.py`
- unit tests covering helper behavior

Steps:
1. Add stable constants or helper functions for required and optional fields.
2. Add helper logic for classifying imported files as compatible roots.
3. Add helper logic for extracting lineage-relevant identifiers without collapsing `turn_id` into `message_id`.

Verification:
- Tests cover helper functions against both imported examples and canonical fixtures.

## Decision Points

1. Imported files without `conversation_id` will be treated as compatible roots, not rejected inputs.
2. `conversation_id` becomes mandatory for canonical files created by ContextBuilder even if imported roots lack it initially.
3. `message_id` is the canonical graph anchor for messages; `turn_id` remains preserved imported provenance when present.
4. Canonical fixtures should be additive and must not rewrite the real imported examples.

## Notes

When this task completes, later tasks should build on the schema helper module instead of duplicating field-name literals across `viewer/server.py`, tests, or export logic. Subsequent docs should reference this task when implementing validation, graph indexing, and Hyperprompt export.
