# Review — CTXB-P7-T4: Extract Shared Message Validation Helper

**Reviewer:** Claude (automated code review)  
**Date:** 2026-04-12  
**Verdict:** PASS — no actionable findings

---

## Summary

A private `_validate_messages(messages, errors) -> list[str]` helper was extracted from the
identical ~45-line per-message validation loops in `collect_normalization_errors` and
`collect_canonical_validation_errors`. Both callers now delegate the loop to the helper and
retain only their own responsibilities. The duplicate error message string was unified.

---

## Code Review

### `viewer/schema.py`

**Strengths:**
- The helper signature is idiomatic for this codebase: mutates `errors` in-place (same pattern as other helpers) and returns collected ids for the caller's duplicate check.
- Docstring clearly explains the return value and the per-message early-exit behaviour.
- Both callers are now noticeably shorter and easier to read — the distinction between "list-level" and "message-level" validation is clear.
- No logic was changed, only structure — reducing the risk of introducing regressions.
- `duplicate_message_ids` message text unified to a generic form; tests only assert on `error.code` so no test changes were needed.

**Minor observations (non-blocking):**
- `_validate_messages` is `def` (not a method or lambda), which is fine for Python. A type annotation `messages: list[Any]` is used — consistent with the rest of the file.
- The helper could in theory be imported and tested directly, but existing tests already exercise it through the two public functions with full coverage.

---

## Quality Gates

| Gate | Result |
|------|--------|
| `python -m pytest tests/` | ✅ 261 passed |
| `make lint` | ✅ Clean |

---

## Acceptance Criteria

| AC | Verdict |
|----|---------|
| AC1: `_validate_messages` exists and used by both callers | ✅ PASS |
| AC2: No per-message loop remains in callers | ✅ PASS |
| AC3: All existing tests pass | ✅ PASS |
| AC4: `make lint` passes | ✅ PASS |

---

## Actionable Findings

None.
