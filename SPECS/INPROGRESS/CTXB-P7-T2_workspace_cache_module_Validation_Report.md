# Validation Report — CTXB-P7-T2: Workspace Cache Module Extraction

**Date:** 2026-05-13  
**Verdict:** PASS  
**Slice:** Extract workspace cache primitives

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/workspace_cache.py` — stat-key scanner, cache implementation, and cache registry | ✅ Done |
| `viewer/server.py` — compatibility wrappers for workspace-cache imports and monkeypatch-sensitive builder calls | ✅ Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | `viewer.server._scan_dir_key` keeps its public test signature | ✅ Wrapper preserves the existing call shape |
| AC2 | `viewer.server.WorkspaceCache().get(dialog_dir)` keeps its public test signature | ✅ Wrapper preserves the existing call shape |
| AC3 | Patching `viewer.server._build_workspace_listing` still affects cache misses | ✅ Verified by `tests/test_workspace_cache.py` |
| AC4 | Cache registry names remain import-compatible from `viewer.server` | ✅ `_WORKSPACE_CACHES`, `_REGISTRY_LOCK`, and `_get_workspace_cache` preserved |
| AC5 | Backend lint and full test suite pass after extraction | ✅ `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Focused tests | `python -m pytest tests/test_workspace_cache.py tests/test_reindex.py tests/test_graph.py` | ✅ 31 passed |
| Python lint | `make lint` | ✅ Passed |
| Full backend tests | `python -m pytest tests/` | ✅ 480 passed |

---

## Implementation Summary

- Added `viewer/workspace_cache.py` for the workspace cache scanner, cache object, and standalone registry.
- Kept `viewer.server.WorkspaceCache` as a subclass wrapper whose `get(dialog_dir)` method passes the current `viewer.server._build_workspace_listing` into the extracted implementation.
- Kept a separate `viewer.server` compatibility registry so direct `viewer.workspace_cache` usage cannot store base cache instances in the server registry.
- Preserved monkeypatch behavior for cache tests that patch `viewer.server._build_workspace_listing`.
- Reduced `viewer/server.py` from 2204 lines to 2176 lines in this slice.

## Residual Work

- Continue reducing `viewer/server.py` by extracting the remaining SpecGraph route/read-model helpers and SSE watcher implementation where sensible.
- Final `P7-T2` completion still requires a thin routing-focused server module; current staged slices have reduced the file while keeping review risk bounded.
