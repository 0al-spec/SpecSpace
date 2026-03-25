# CTXB-P5-T1 — Add automated tests for schema validation and graph integrity failures

**Status:** In Progress
**Priority:** P0
**Phase:** Phase 5 — Hardening, Tests, and Documentation

---

## Context

The schema validation layer (`viewer/schema.py`) contains detailed error-code logic for every invalid payload shape, yet many error codes are only exercised indirectly or not at all by the current test suite. CTXB-P5-T1 locks down the full set of failure paths with explicit regression tests so that any future change to validation behaviour immediately fails the suite.

---

## Deliverables

1. **`tests/test_integrity.py`** — New test module dedicated to schema validation and graph integrity failure paths.
   - Tests for `collect_normalization_errors` (imported-root validation): `invalid_payload`, `missing_top_level_fields`, `invalid_messages`, `invalid_message_payload`, `invalid_message_id`, `invalid_message_role`, `invalid_message_content`
   - Tests for `collect_canonical_validation_errors` (canonical validation): `invalid_payload`, `missing_canonical_fields`, `invalid_conversation_id`, `invalid_title`, `invalid_messages`, `invalid_message_payload`, `invalid_message_id`, `invalid_message_role`, `invalid_message_content`, `invalid_lineage`, `invalid_parent_reference`, `invalid_parent_link_type`, `duplicate_parent_reference`, `invalid_branch_lineage`, `invalid_merge_lineage`
   - `validate_file_name` tests: path separator rejection, non-`.json` extension, empty name
   - `validate_conversation` dispatch: imported path reaches canonical validation after normalization

2. **`SPECS/INPROGRESS/CTXB-P5-T1_Validation_Report.md`** — Validation report capturing quality gate outcomes.

---

## Acceptance Criteria

- [ ] Duplicate IDs (message IDs, conversation IDs) are covered by at least one explicit test each.
- [ ] Missing parent references (`missing_parent_conversation`, `missing_parent_message`) are covered (existing tests already cover these; PRD confirms they remain covered).
- [ ] Malformed lineage (non-list parents, non-dict parent entries, missing parent fields, invalid link types, single-parent with `merge`, multi-parent with `branch`) each have a dedicated test.
- [ ] Invalid imports (missing required fields, wrong message count, non-list messages, non-dict messages) are covered.
- [ ] All new tests pass `make test` with zero failures.
- [ ] `make lint` passes (all test files compile cleanly).
- [ ] The suite fails predictably when a validation error code is removed from the production code.

---

## Dependencies

- CTXB-P1-T5 (complete) — schema and validation API is stable.

---

## Error Codes Inventory

### Already covered by existing tests
| Error code | Test file |
|---|---|
| `duplicate_message_ids` | test_validation.py |
| `invalid_lineage_parents` | test_validation.py |
| `duplicate_conversation_id` | test_validation.py, test_graph.py |
| `missing_parent_conversation` | test_validation.py, test_graph.py |
| `missing_parent_message` | test_validation.py, test_graph.py |
| `invalid_filename` | test_validation.py |
| `missing_message_fields` | test_validation.py, test_normalization.py |
| `message_count_mismatch` | test_normalization.py |
| `invalid_json` | test_graph.py |

### Newly covered by this task (test_integrity.py)
| Error code | Source function |
|---|---|
| `invalid_payload` | both collect_* functions |
| `missing_top_level_fields` | collect_normalization_errors |
| `invalid_messages` | both collect_* functions |
| `invalid_message_payload` | both collect_* functions |
| `invalid_message_id` | both collect_* functions |
| `invalid_message_role` | both collect_* functions |
| `invalid_message_content` | both collect_* functions |
| `missing_canonical_fields` | collect_canonical_validation_errors |
| `invalid_conversation_id` | collect_canonical_validation_errors |
| `invalid_title` | collect_canonical_validation_errors |
| `invalid_lineage` | collect_canonical_validation_errors |
| `invalid_parent_reference` | collect_canonical_validation_errors |
| `invalid_parent_link_type` | collect_canonical_validation_errors |
| `duplicate_parent_reference` | collect_canonical_validation_errors |
| `invalid_branch_lineage` | collect_canonical_validation_errors |
| `invalid_merge_lineage` | collect_canonical_validation_errors |
| `invalid_filename` (extra cases) | validate_file_name |
