# Validation Report — CTXB-P7-T4: Extract Shared Message Validation Helper

**Date:** 2026-04-12  
**Verdict:** PASS

---

## Deliverables

| Artifact | Status |
|----------|--------|
| `viewer/schema.py` — added `_validate_messages`; refactored both callers | ✅ Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | `_validate_messages` exists and called by both functions | ✅ |
| AC2 | No per-message loop remains in either caller | ✅ |
| AC3 | All existing tests pass | ✅ 261 passed |
| AC4 | `make lint` passes | ✅ Clean |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `python -m pytest tests/` | ✅ 261 passed, 0 failed |
| Lint | `make lint` | ✅ No output (clean) |

---

## Summary

Extracted `_validate_messages(messages, errors) -> list[str]` from the ~45-line duplicated loop
present in both `collect_normalization_errors` and `collect_canonical_validation_errors`. Both
callers now delegate per-message validation to the helper and handle only their own
concerns (list-type guard, `message_count` check, `duplicate_message_ids`). The
`duplicate_message_ids` error message was unified to `"Conversation contains duplicate
\`message_id\` values."` — tests check only `error.code`, not message text.
