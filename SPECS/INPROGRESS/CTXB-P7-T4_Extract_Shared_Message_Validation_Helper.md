# PRD — CTXB-P7-T4: Extract Shared Message Validation Helper in schema.py

**Status:** INPROGRESS  
**Phase:** 7 — Technical Debt and Quality  
**Priority:** P1  
**Branch:** feature/CTXB-P7-T4-shared-validation-helper  
**Date:** 2026-04-12

---

## Problem

`collect_normalization_errors()` and `collect_canonical_validation_errors()` in `viewer/schema.py`
each contain an identical ~45-line per-message validation loop:

```
for index, message in enumerate(messages):
    • check message is a mapping
    • check MESSAGE_REQUIRED_FIELDS present
    • check message_id is non-empty string
    • check role is non-empty string
    • check content is a string
    → collect valid message_id
→ check for duplicate message_ids
```

This duplication means any fix or enhancement to per-message validation must be applied in two
places, with risk of divergence.

## Solution

Extract the repeated block into a private helper:

```python
def _validate_messages(messages: list[Any], errors: list[NormalizationError]) -> list[str]:
    """Validate each message in *messages*, appending errors to *errors*.

    Returns the list of valid message_ids (for duplicate detection by the caller).
    """
```

Both callers keep responsibility for:
- Checking whether `messages` is a `list` (the guard differs slightly between them).
- Checking for `duplicate_message_ids` after calling the helper (using the returned ids).

---

## Deliverables

| # | Artifact | Description |
|---|----------|-------------|
| 1 | `viewer/schema.py` | Add `_validate_messages`; refactor both callers to use it |

---

## Acceptance Criteria

- AC1: `_validate_messages` exists and is called by both `collect_normalization_errors` and `collect_canonical_validation_errors`.
- AC2: No per-message validation loop remains in either caller function.
- AC3: All existing schema and validation tests pass without modification.
- AC4: `make lint` passes (no `py_compile` errors).

---

## Design Notes

- The helper mutates the `errors` list in-place (same pattern used elsewhere in the file) and returns `list[str]` of valid message_ids.
- `duplicate_message_ids` error message is unified to `"Conversation contains duplicate \`message_id\` values."` — tests only assert on `error.code`, not message text.
- No new tests required (existing coverage is comprehensive); the refactoring is purely internal.
