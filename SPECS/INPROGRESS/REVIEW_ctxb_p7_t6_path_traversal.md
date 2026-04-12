# Review — CTXB-P7-T6: Consolidate Path Traversal Protection

**Reviewer:** Claude (automated code review)  
**Date:** 2026-04-12  
**Verdict:** PASS — no actionable findings

---

## Summary

Path containment enforcement was moved from `safe_dialog_path` (HTTP layer only)
into `dialog_path_for_name` (used by all callers). Any attempt to resolve a name
that escapes `dialog_dir` now raises `ValueError` regardless of call site.
`safe_dialog_path` was simplified to a try/except wrapper.

---

## Code Review

### `viewer/server.py`

**Strengths:**
- Security boundary is now enforced at the lowest level — any future internal
  caller gets protection for free.
- `os.sep` suffix in the startswith check correctly handles the sibling-directory
  false-positive (`/tmp/foo` vs `/tmp/foobar`).
- The `or str(resolved) == dir_str` branch correctly allows resolving `"."` and
  `""` to the directory itself (edge cases that don't affect HTTP callers, since
  `validate_file_name` rejects these before `dialog_path_for_name` is called).
- `safe_dialog_path` is now 4 lines instead of 5, with zero duplication of the
  containment logic.
- Error message includes both the original name and the resolved path — useful
  for debugging.

**Minor observations (non-blocking):**
- `dialog_dir.resolve()` is called inside `dialog_path_for_name` even though
  callers already pass a resolved path. This is a negligible redundancy (`.resolve()`
  on an already-resolved path is a no-op) but slightly defensive against
  unresolved paths from future callers.
- Alternatively, the function could document that `dialog_dir` must be
  pre-resolved (already done in the docstring: "must already be an absolute
  resolved path"). Both approaches are acceptable.

### `tests/test_path_traversal.py`

**Strengths:**
- 14 tests cover: valid names, `../` traversal, absolute paths, nested dotdot,
  sibling-dir false-positive, error message content, edge cases (`.`, `""`,
  `/tmp/...`).
- The sibling-directory test (`/tmp/foo` vs `/tmp/foobar`) is a subtle but
  important boundary case — explicitly tested.
- Tests are isolated via `tempfile.TemporaryDirectory`, no shared state.

**Minor observations (non-blocking):**
- `TestSafeDialogPathDelegation` class tests `dialog_path_for_name` directly
  (because `ViewerHandler` can't be instantiated without HTTP machinery). A
  comment in the class explains why. An integration test through the full HTTP
  layer would be stronger, but `test_api_contracts.py` already covers the HTTP
  write/delete paths.

---

## Quality Gates

| Gate | Result |
|------|--------|
| `python -m pytest tests/` | ✅ 275 passed (14 new + 261 existing) |
| `make lint` | ✅ Clean |

---

## Acceptance Criteria

| AC | Verdict |
|----|---------|
| AC1: `dialog_path_for_name(dir, "../../etc/passwd.json")` raises `ValueError` | ✅ PASS |
| AC2: Valid name resolves correctly | ✅ PASS |
| AC3: `safe_dialog_path` returns `None` without duplicating check | ✅ PASS |
| AC4: All existing tests pass | ✅ PASS |
| AC5: `make lint` passes | ✅ PASS |

---

## Actionable Findings

None.
