# Validation Report — CTXB-P1-T6

**Task:** Correct compile-target root metadata for incomplete lineage
**Date:** 2026-03-26
**Verdict:** PASS

---

## Changes Made

### `viewer/server.py`

Fixed `build_compile_target` to filter `root_conversation_ids` to only include
conversations whose `parent_edge_ids` list is empty (true graph roots).

**Before:**
```python
root_conversation_ids = sorted({path[0] for path in lineage_paths if path})
```

**After:**
```python
root_conversation_ids = sorted(
    conv_id
    for conv_id in {path[0] for path in lineage_paths if path}
    if not nodes_by_conversation[conv_id]["parent_edge_ids"]
)
```

### `tests/test_selection.py`

Added `CompileTargetBrokenLineageTests` class with 6 regression tests:
- Branch with missing parent conversation → `root_conversation_ids == []`
- Branch with missing parent conversation → `is_lineage_complete == False`
- Branch with missing parent conversation → `unresolved_parent_edge_ids` non-empty
- Branch with missing parent message → `root_conversation_ids == []`
- Branch with missing parent message → `is_lineage_complete == False`
- Complete lineage still produces correct `root_conversation_ids`

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `python -m unittest discover -s tests -p 'test_*.py'` | ✅ PASS — 206 tests, 0 failures |
| Lint | `python -m py_compile viewer/server.py viewer/schema.py tests/test_*.py` | ✅ PASS |

---

## Acceptance Criteria

- ✅ Incomplete lineage selections do not include synthetic roots in `root_conversation_ids`
- ✅ `is_lineage_complete` and `unresolved_parent_edge_ids` distinguish reachable roots from partial ancestry
- ✅ Regression tests cover broken-parent and missing-parent-message compile-target responses
- ✅ All existing tests continue to pass
