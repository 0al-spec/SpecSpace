# Review — CTXB-P7-T8: Add rmtree Safety Marker to Export Directory

**Reviewer:** Claude (automated code review)  
**Date:** 2026-04-12  
**Verdict:** PASS — no actionable findings

---

## Summary

A sentinel file `EXPORT_SENTINEL = ".ctxb_export"` is now written into every
export directory created by `export_graph_nodes`. Before any `shutil.rmtree`
call, the presence of this sentinel is verified. Absence returns HTTP 500 and
leaves the directory untouched. Three new tests cover the sentinel lifecycle.

---

## Code Review

### `viewer/server.py`

**Strengths:**
- Sentinel constant defined at module level — easy to find and change.
- Guard is placed immediately before `shutil.rmtree`, the only dangerous call.
- Error message includes both the directory path and the sentinel filename —
  actionable for operators.
- Sentinel written immediately after `nodes_dir.mkdir(parents=True)`, before
  any file writing — ensures the directory is always "owned" after creation.
- Returning 500 (not 400) is correct: this is a server-side invariant failure,
  not a client error.

**Minor observations (non-blocking):**
- The sentinel file content is a human-readable string explaining its purpose.
  This is a good practice — an operator who accidentally finds the file knows
  what it is.
- Future improvement: the sentinel could include a timestamp or export metadata
  (conversation_id, created_at) for auditability, but this is beyond T8 scope.

### `tests/test_export.py`

**Strengths:**
- `test_sentinel_written_on_first_export`: verifies sentinel exists after first export.
- `test_re_export_with_sentinel_succeeds`: verifies sentinel is present after re-export.
- `test_missing_sentinel_blocks_rmtree`: uses an **isolated** `tempfile.TemporaryDirectory`
  instead of the shared class-level dir — correctly avoids cross-test contamination
  (the test removes the sentinel, so it must not affect sibling tests).
- All 3 tests read `server.EXPORT_SENTINEL` by name — no magic strings.

---

## Quality Gates

| Gate | Result |
|------|--------|
| `python -m pytest tests/` | ✅ 278 passed (3 new + 275 existing) |
| `make lint` | ✅ Clean |

---

## Acceptance Criteria

| AC | Verdict |
|----|---------|
| AC1: Directory without sentinel never deleted | ✅ PASS |
| AC2: Fresh export writes sentinel | ✅ PASS |
| AC3: Re-export with sentinel succeeds | ✅ PASS |
| AC4: All existing tests pass | ✅ PASS |
| AC5: `make lint` passes | ✅ PASS |

---

## Actionable Findings

None.
