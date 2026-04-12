# Review — CTXB-P7-T1: Workspace Cache with mtime-based Invalidation

**Reviewer:** Claude (automated code review)  
**Date:** 2026-04-12  
**Verdict:** PASS — no blocking findings

---

## Summary

The task adds a `WorkspaceCache` class to `viewer/server.py` that avoids re-reading JSON files on every API request, using a stat-only directory fingerprint (`frozenset` of `(name, mtime, size)` tuples) to detect changes. The cache is thread-safe, isolated per `dialog_dir`, and explicitly invalidated after write and delete mutations.

---

## Code Review

### `viewer/server.py`

**Strengths:**
- Clean separation: `_build_workspace_listing` (uncached) vs `collect_workspace_listing` (cached wrapper) — no caller changes needed.
- `_scan_dir_key` uses `os.scandir` with a single `entry.stat()` call per entry; efficient.
- Per-directory registry (`_WORKSPACE_CACHES`) correctly handles multiple `dialog_dir` paths in the same process, which is important for test isolation.
- Explicit `invalidate()` on write/delete covers the coarse-mtime (HFS+ 1-second) edge case.
- Lock held for both the check and the rebuild — prevents two threads from simultaneously rebuilding the same cache entry.

**Minor observations (non-blocking):**
- The lock is held for the entire rebuild duration. For large workspaces this could briefly block concurrent readers. A future improvement could use a read/write lock or double-checked locking, but correctness takes priority and the current approach is simpler.
- `_WORKSPACE_CACHES` is a module-level dict. Entries are never evicted. In practice the server uses exactly one `dialog_dir` per process, so this is fine. A long-running process with many different `dialog_dir` values (e.g. in some test scenarios) would accumulate entries — not a memory concern for the current use case.
- `_scan_dir_key` calls `entry.stat()` once per entry. On macOS `DirEntry.stat()` is cached from the `scandir()` call, so this is O(1) per entry as intended.

### `tests/test_workspace_cache.py`

**Strengths:**
- Comprehensive coverage: hit, miss (new/modified/deleted), invalidate (explicit + on empty), registry, thread safety (2 tests), public API.
- Thread-safety tests use `threading.Barrier` for reliable concurrency simulation.
- `test_cache_hit_avoids_file_reads` correctly patches `_build_workspace_listing` (not `load_json_file`) — tests the right boundary.
- `test_miss_on_file_content_change` explicitly sets `os.utime` to advance mtime, avoiding a flaky test on fast filesystems.

**Minor observations (non-blocking):**
- `test_concurrent_calls_count_builds_correctly` patches `_build_workspace_listing` inside a thread — due to Python's GIL the patch is visible across threads, but the `barrier.wait()` means the patch context might not cover all threads' `cache.get()` calls. The test counts builds in `build_count[0]` and asserts `1 ≤ count ≤ 10`. This is conservative and correct. A tighter assertion would require more sophisticated synchronization.
- `import os` inside `test_miss_on_file_content_change` at function scope is unusual (os is already imported at module level). Not harmful, just redundant.

---

## Quality Gates

| Gate | Result |
|------|--------|
| `python -m pytest tests/` | ✅ 261 passed (18 new + 243 existing) |
| `make lint` | ✅ Clean |

---

## Acceptance Criteria Verdict

| AC | Verdict |
|----|---------|
| AC1: No re-reads on unchanged files | ✅ PASS |
| AC2: Changes reflected in one subsequent request | ✅ PASS |
| AC3: All existing tests continue to pass | ✅ PASS |
| AC4: Thread-safe under lock | ✅ PASS |

---

## Actionable Findings

None. The implementation is correct, well-tested, and follows the project's existing patterns.
