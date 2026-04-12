# Validation Report — CTXB-P7-T1: Workspace Cache with mtime-based Invalidation

**Date:** 2026-04-12  
**Verdict:** PASS

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/server.py` — `WorkspaceCache`, `_WORKSPACE_CACHES`, `_scan_dir_key`, `_build_workspace_listing`, updated `collect_workspace_listing` | ✅ Done |
| `tests/test_workspace_cache.py` — 18 new tests | ✅ Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | Second call with unchanged files does not call `_build_workspace_listing` | ✅ Verified by `test_cache_hit_avoids_file_reads` and `test_cache_returns_same_object_on_hit` |
| AC2 | Any file change (new, modified, deleted) triggers a rebuild within one subsequent request | ✅ Verified by `test_miss_on_new_file`, `test_miss_on_file_content_change`, `test_miss_on_deleted_file` |
| AC3 | All existing API contract tests continue to pass | ✅ 261 tests pass (18 new + 243 existing) |
| AC4 | Cache protected by threading lock; concurrent callers serialized on a miss | ✅ Verified by `test_concurrent_calls_all_get_consistent_result`, `test_concurrent_calls_count_builds_correctly` |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `python -m pytest tests/` | ✅ 261 passed, 0 failed |
| Lint | `make lint` | ✅ No output (clean) |

---

## Implementation Summary

### Changes to `viewer/server.py`

1. Added `import threading` to imports.
2. Added `_scan_dir_key(dialog_dir)` — stat-only directory fingerprint using `os.scandir`.
3. Added `WorkspaceCache` class with `_lock`, `_key`, `_result`; `get()` checks fingerprint before rebuilding; `invalidate()` forces next miss.
4. Added `_WORKSPACE_CACHES` registry + `_get_workspace_cache()` factory (one cache per `dialog_dir`).
5. Renamed existing `collect_workspace_listing` body to `_build_workspace_listing` (private, uncached).
6. New `collect_workspace_listing` is a thin cache-aware wrapper delegating to `WorkspaceCache.get()`.
7. Added `_get_workspace_cache(...).invalidate()` after successful `path.write_text()` in `handle_write_file`.
8. Added `_get_workspace_cache(...).invalidate()` after successful `path.unlink()` in `handle_delete_file`.

### Key design decisions

- **Lock-inside-get pattern**: stats are scanned outside the lock; lock is held for key comparison and rebuild. This avoids holding the lock during the stat scan while still serializing rebuilds.
- **Explicit invalidation on write/delete**: ensures correctness on coarse-mtime filesystems (HFS+ 1-second granularity) where a same-second write might not change mtime.
- **Per-directory cache registry**: allows tests to use isolated `tmpdir` paths without interference.
