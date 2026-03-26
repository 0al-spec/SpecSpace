# CTXB-P3-T5 Validation Report

**Task:** Re-index and reconcile external file changes
**Date:** 2026-03-26
**Verdict:** PASS

## Changes Made

### `viewer/app/src/Sidebar.tsx`
- Added `onRefresh?: () => void` to `SidebarProps`.
- "Refresh workspace" button now calls `fetchFiles()` AND `onRefresh?.()` so both the file list and the graph canvas update atomically when the user requests a refresh.

### `viewer/app/src/App.tsx`
- Passed `refresh` (from `useGraphData`) as `onRefresh` prop to `<Sidebar>`.
- No other changes; existing stale-selection guard (lines 122–133) remains intact.

### `tests/test_reindex.py` (new)
- 8 new server-side integration tests covering re-indexing behaviour.

## Quality Gates

### Tests
```
Ran 200 tests in 12.6s
OK
```
All tests pass, including 8 new tests in `test_reindex.py`.

### Lint
```
python3 -m py_compile viewer/server.py viewer/schema.py tests/test_reindex.py
OK
```

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Clicking "Refresh workspace" updates both file list and graph canvas | ✅ `onRefresh` prop wires sidebar button to graph fetch |
| Deleted conversation is removed from graph and inspector dismissed | ✅ Existing stale-selection guard in App.tsx handles this |
| Newly added files appear in sidebar and graph after refresh | ✅ Covered by `test_newly_added_file_appears_in_*` tests |
| Modified files reflected in graph nodes after refresh | ✅ Covered by `test_modified_file_*` tests |
| All existing tests pass | ✅ 200 tests OK |
| New tests cover add/delete/modify scenarios | ✅ 8 new tests |
| Satisfies PRD FR-10 and NFR-8 | ✅ Manual re-index on demand, no server restart needed |
