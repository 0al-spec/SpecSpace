# PRD — CTXB-P7-T1: Workspace Cache with mtime-based Invalidation

**Status:** INPROGRESS  
**Phase:** 7 — Technical Debt and Quality  
**Priority:** P1  
**Branch:** feature/CTXB-P7-T1-workspace-cache  
**Date:** 2026-04-12

---

## Problem

Every API call that touches the dialog workspace (`/api/files`, `/api/graph`, `/api/conversation`,
`/api/checkpoint`, `/api/file`, `/api/export`) currently calls `collect_workspace_listing(dialog_dir)`,
which re-reads **all** JSON files, re-validates, and rebuilds the entire graph snapshot from scratch on
every request, regardless of whether any files have changed.

This is O(n) file I/O per request where n is the number of JSON files in the workspace. Under
`ThreadingHTTPServer` multiple concurrent requests each trigger independent full re-reads.

## Solution

Add a **server-level workspace cache** (`WorkspaceCache`) that:

1. Stores the last `collect_workspace_listing` result along with the directory fingerprint
   (a `frozenset` of `(filename, mtime, size)` tuples for every `.json` file).
2. On each request, does a **stat-only scan** of the directory (no file reads), builds the
   fingerprint, and compares against the cached fingerprint.
3. If the fingerprint matches: returns the cached result immediately (zero file reads).
4. If the fingerprint differs (new file, modified file, deleted file): re-runs the full
   `_build_workspace_listing` and atomically updates the cache.

The cache is **protected by a threading lock** to be safe under `ThreadingHTTPServer`. Only one
thread rebuilds at a time; others wait. This is acceptable because the cache miss case is already as
expensive as the current un-cached path.

---

## Deliverables

| # | Artifact | Description |
|---|----------|-------------|
| 1 | `viewer/server.py` | Add `WorkspaceCache` class + `_WORKSPACE_CACHES` registry; refactor `collect_workspace_listing` to use it |
| 2 | `tests/test_workspace_cache.py` | New test module: cache hit (no re-read), cache miss on modification, cache miss on new file, cache miss on deletion, thread-safety smoke test |

---

## Acceptance Criteria

- AC1: A request after an unchanged-file load does **not** re-read any JSON files (verified by patching `load_json_file`).
- AC2: Any file change (new, modified, deleted) is reflected within one subsequent request.
- AC3: All existing API contract tests continue to pass (`python -m pytest tests/`).
- AC4: The cache is protected by a lock; concurrent calls are serialized on a miss.

---

## Design Notes

### Key data structures

```python
_scan_dir_key(dialog_dir: Path) -> frozenset[tuple[str, float, int]]
    # {(name, mtime, size), ...} for all *.json files — stat-only, no reads

class WorkspaceCache:
    _lock: threading.Lock
    _key: frozenset | None
    _result: dict[str, Any] | None

    def get(self, dialog_dir: Path) -> dict[str, Any]:
        # 1. Scan stats → new_key
        # 2. Acquire lock
        # 3. If _key == new_key and _result: return _result
        # 4. Else: call _build_workspace_listing, update _key + _result, return result
```

### Module-level registry

```python
_WORKSPACE_CACHES: dict[Path, WorkspaceCache] = {}
_REGISTRY_LOCK = threading.Lock()
```

Allows multiple `dialog_dir` values in the same process (e.g. tests running in parallel tmpdir).

### Refactoring

- Rename current `collect_workspace_listing` body to `_build_workspace_listing` (private, uncached).
- New `collect_workspace_listing` becomes a thin cache-aware wrapper.
- No API changes to callers.

---

## Dependencies

- `viewer/server.py` only — no changes to `schema.py`, `specgraph.py`, or frontend.

## Test Plan

1. `test_cache_hit_avoids_reads` — call twice, assert `load_json_file` called exactly N times total (not 2N).
2. `test_cache_miss_on_file_content_change` — modify file content between calls, assert new result reflected.
3. `test_cache_miss_on_new_file` — add file, assert count increases.
4. `test_cache_miss_on_deleted_file` — remove file, assert count decreases.
5. `test_concurrent_requests_serialize` — launch N threads calling the cache simultaneously; assert no data races (all get consistent results).
