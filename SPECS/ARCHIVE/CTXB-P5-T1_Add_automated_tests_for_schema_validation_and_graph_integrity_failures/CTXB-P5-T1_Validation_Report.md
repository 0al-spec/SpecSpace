# CTXB-P5-T1 Validation Report

**Task:** Add automated tests for schema validation and graph integrity failures
**Date:** 2026-03-26
**Verdict:** PASS

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `make test` | PASS — 131 tests, 0 failures (up from 92) |
| Lint | `make lint` | PASS — 0 errors |

---

## Deliverables

### tests/test_integrity.py
New test module with 39 tests covering error codes not previously exercised:

**validate_file_name (5 tests)**
- Valid `.json` filename passes
- Empty string → `invalid_filename`
- Non-`.json` extension → `invalid_filename`
- Forward slash in name → `invalid_filename`
- Backslash in name → `invalid_filename`

**collect_normalization_errors — imported root (8 tests)**
- Non-mapping payload → `invalid_payload`
- Missing `source_file` → `missing_top_level_fields`
- Messages not a list → `invalid_messages`
- Message not a dict → `invalid_message_payload`
- Empty message_id → `invalid_message_id`
- Non-string message_id → `invalid_message_id`
- Empty role → `invalid_message_role`
- Non-string content → `invalid_message_content`

**collect_canonical_validation_errors — canonical conversation (22 tests)**
- Non-mapping payload → `invalid_payload`
- Missing `conversation_id` field → `missing_canonical_fields`
- Empty `conversation_id` → `invalid_conversation_id`
- Non-string `title` → `invalid_title`
- Messages not a list → `invalid_messages`
- Message not a dict → `invalid_message_payload`
- Empty message_id → `invalid_message_id`
- Empty role → `invalid_message_role`
- Non-string content → `invalid_message_content`
- Lineage not a dict → `invalid_lineage`
- `lineage.parents` not a list → `invalid_lineage_parents`
- Parent not a dict → `invalid_parent_reference`
- Parent missing required fields → `invalid_parent_reference`
- Parent with empty `conversation_id` → `invalid_parent_reference`
- Parent with empty `message_id` → `invalid_parent_reference`
- Parent with unknown `link_type` → `invalid_parent_link_type`
- Duplicate parent reference → `duplicate_parent_reference`
- Single parent with `merge` link_type → `invalid_branch_lineage`
- Multi-parent with `branch` link_type → `invalid_merge_lineage`
- Valid root produces no errors
- Valid branch produces no errors
- Valid merge produces no errors

**validate_conversation dispatch (4 tests)**
- Valid imported root normalises to canonical-root
- Invalid imported payload returns errors
- Valid canonical branch passes
- Canonical with invalid message returns errors

---

## Acceptance Criteria

- [x] Duplicate IDs (message IDs, conversation IDs) covered (existing + new tests)
- [x] Missing parent references covered (existing tests confirmed still passing)
- [x] Malformed lineage cases fully covered (non-list parents, non-dict entries, missing fields, invalid link types, invalid_branch_lineage, invalid_merge_lineage)
- [x] Invalid imports covered (missing fields, non-list messages, non-dict messages, invalid field values)
- [x] All 131 tests pass `make test`
- [x] `make lint` passes
- [x] Suite fails predictably on validation regressions (tests assert specific error codes)
