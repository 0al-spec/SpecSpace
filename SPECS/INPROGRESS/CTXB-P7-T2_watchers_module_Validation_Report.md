# Validation Report - CTXB-P7-T2: Watchers Module Extraction

**Date:** 2026-05-13  
**Verdict:** PASS  
**Slice:** Extract SpecGraph SSE polling watchers

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/watchers.py` - `SpecWatcher` and `RunsWatcher` polling implementations for SSE endpoints | Done |
| `viewer/server.py` - compatibility imports for watcher classes while route handlers remain local | Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | `viewer.server.SpecWatcher` and `viewer.server.RunsWatcher` remain import-compatible for existing tests and callers | Verified by import check |
| AC2 | Spec file watcher lifecycle still starts on subscribe, notifies changes, and stops when clients unsubscribe | Verified by focused watcher tests |
| AC3 | Runs watcher still detects run artifact changes using the same filename/artifact filters | Verified by `tests/test_runs_watcher.py` |
| AC4 | `/api/spec-watch` and `/api/runs-watch` route behavior remains in `viewer.server` and continues to use the shared watcher instances | Verified by endpoint-focused tests |
| AC5 | Backend lint and full test suite pass after extraction | `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Syntax check | `python -m py_compile viewer/server.py viewer/watchers.py` | Passed |
| Import compatibility | `python -c "import viewer.server; print(viewer.server.SpecWatcher, viewer.server.RunsWatcher)"` | Passed |
| Focused watcher tests | `python -m pytest tests/test_specgraph.py::SpecWatcherUnitTests tests/test_specgraph.py::SpecWatchEndpointTests tests/test_runs_watcher.py` | 12 passed |
| Broader SpecGraph tests | `python -m pytest tests/test_specgraph.py tests/test_runs_watcher.py tests/test_exploration_preview.py` | 66 passed |
| Python lint | `make lint` | Passed |
| Full backend tests | `python -m pytest tests/` | 488 passed |

---

## Implementation Summary

- Added `viewer/watchers.py` as the focused home for polling watcher state and background threads.
- Factored shared subscribe/unsubscribe, polling thread, sequence, and wait lifecycle into `PollingWatcher`.
- Moved `SpecWatcher` and `RunsWatcher` out of `viewer/server.py` without changing public class names through the server compatibility imports.
- Kept HTTP/SSE route handling in `ViewerHandler`, so this slice only changes module ownership for the polling machinery.
- Reduced `viewer/server.py` from 1865 lines to 1683 lines in this slice after rebasing onto the hardened SpecGraph surfaces base.

## Residual Work

- Continue `P7-T2` with the remaining server split candidates: build/invocation route helpers and SSE response formatting where it can be separated without hiding HTTP behavior.
