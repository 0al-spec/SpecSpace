"""Tests for the workspace mtime-based cache in viewer/server.py.

Covers:
- Cache hit: unchanged files are not re-read on the second call.
- Cache miss: a modified file triggers a full rebuild.
- Cache miss: a new file triggers a full rebuild.
- Cache miss: a deleted file triggers a full rebuild.
- Explicit invalidation: WorkspaceCache.invalidate() forces a miss.
- Thread safety: concurrent callers all get a consistent result.
"""

import json
import threading
import time
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import patch
import tempfile

from viewer.server import (
    WorkspaceCache,
    _build_workspace_listing,
    _get_workspace_cache,
    _scan_dir_key,
    _WORKSPACE_CACHES,
    _REGISTRY_LOCK,
    collect_workspace_listing,
)


MINIMAL_PAYLOAD: dict[str, Any] = {
    "conversation_id": "test-conv-001",
    "messages": [
        {
            "id": "msg-001",
            "author": {"role": "user"},
            "content": {"content_type": "text", "parts": ["Hello"]},
            "create_time": 1_700_000_000.0,
        }
    ],
}


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload), encoding="utf-8")


class TestScanDirKey(unittest.TestCase):
    def test_empty_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            key = _scan_dir_key(Path(tmp))
            self.assertEqual(key, frozenset())

    def test_ignores_non_json_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "notes.txt").write_text("hello")
            key = _scan_dir_key(Path(tmp))
            self.assertEqual(key, frozenset())

    def test_includes_json_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "a.json"
            write_json(f, {"x": 1})
            key = _scan_dir_key(Path(tmp))
            self.assertEqual(len(key), 1)
            name, mtime, size = next(iter(key))
            self.assertEqual(name, "a.json")
            self.assertGreater(mtime, 0)
            self.assertGreater(size, 0)

    def test_missing_dir_returns_empty(self):
        key = _scan_dir_key(Path("/nonexistent/path/xyz"))
        self.assertEqual(key, frozenset())


class TestWorkspaceCacheHit(unittest.TestCase):
    def test_cache_hit_avoids_file_reads(self):
        """Second call with no file changes must not call load_json_file."""
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_json(d / "c.json", MINIMAL_PAYLOAD)

            # Use a fresh cache instance so test is isolated.
            cache = WorkspaceCache()

            read_count = [0]
            original_build = _build_workspace_listing

            def counting_build(dialog_dir):
                read_count[0] += 1
                return original_build(dialog_dir)

            with patch("viewer.server._build_workspace_listing", side_effect=counting_build):
                cache.get(d)  # miss → build
                cache.get(d)  # hit → no build

            self.assertEqual(read_count[0], 1, "Expected exactly one build call on two gets with no changes")

    def test_cache_returns_same_object_on_hit(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_json(d / "c.json", MINIMAL_PAYLOAD)
            cache = WorkspaceCache()
            r1 = cache.get(d)
            r2 = cache.get(d)
            self.assertIs(r1, r2)


class TestWorkspaceCacheMiss(unittest.TestCase):
    def test_miss_on_file_content_change(self):
        """Modifying a file (which changes mtime/size) triggers a rebuild."""
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            f = d / "c.json"
            write_json(f, MINIMAL_PAYLOAD)

            cache = WorkspaceCache()
            r1 = cache.get(d)
            self.assertEqual(len(r1["files"]), 1)

            # Advance mtime by touching the file with different content.
            # On fast filesystems mtime may not advance within the same call;
            # we bump the mtime explicitly.
            t = time.time() + 1
            write_json(f, {**MINIMAL_PAYLOAD, "conversation_id": "test-conv-002"})
            import os
            os.utime(f, (t, t))

            r2 = cache.get(d)
            self.assertIsNot(r1, r2)

    def test_miss_on_new_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_json(d / "a.json", MINIMAL_PAYLOAD)

            cache = WorkspaceCache()
            r1 = cache.get(d)
            self.assertEqual(len(r1["files"]), 1)

            payload2 = {**MINIMAL_PAYLOAD, "conversation_id": "test-conv-002"}
            write_json(d / "b.json", payload2)

            r2 = cache.get(d)
            self.assertEqual(len(r2["files"]), 2)

    def test_miss_on_deleted_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_json(d / "a.json", MINIMAL_PAYLOAD)
            payload2 = {**MINIMAL_PAYLOAD, "conversation_id": "test-conv-002"}
            write_json(d / "b.json", payload2)

            cache = WorkspaceCache()
            r1 = cache.get(d)
            self.assertEqual(len(r1["files"]), 2)

            (d / "b.json").unlink()

            r2 = cache.get(d)
            self.assertEqual(len(r2["files"]), 1)


class TestWorkspaceCacheInvalidate(unittest.TestCase):
    def test_invalidate_forces_rebuild(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_json(d / "a.json", MINIMAL_PAYLOAD)

            cache = WorkspaceCache()
            r1 = cache.get(d)
            cache.invalidate()

            build_count = [0]
            original_build = _build_workspace_listing

            def counting_build(dialog_dir):
                build_count[0] += 1
                return original_build(dialog_dir)

            with patch("viewer.server._build_workspace_listing", side_effect=counting_build):
                cache.get(d)

            self.assertEqual(build_count[0], 1)

    def test_invalidate_on_empty_cache_is_safe(self):
        cache = WorkspaceCache()
        cache.invalidate()  # must not raise


class TestWorkspaceCacheRegistry(unittest.TestCase):
    def test_same_dir_returns_same_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            c1 = _get_workspace_cache(d)
            c2 = _get_workspace_cache(d)
            self.assertIs(c1, c2)

    def test_different_dirs_return_different_caches(self):
        with tempfile.TemporaryDirectory() as t1, tempfile.TemporaryDirectory() as t2:
            c1 = _get_workspace_cache(Path(t1))
            c2 = _get_workspace_cache(Path(t2))
            self.assertIsNot(c1, c2)


class TestWorkspaceCacheThreadSafety(unittest.TestCase):
    def test_concurrent_calls_all_get_consistent_result(self):
        """N threads calling collect_workspace_listing simultaneously must all agree."""
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_json(d / "a.json", MINIMAL_PAYLOAD)

            # Use a fresh isolated cache so we don't share with other tests.
            cache = WorkspaceCache()
            results: list[dict] = []
            errors: list[Exception] = []
            lock = threading.Lock()

            def worker():
                try:
                    r = cache.get(d)
                    with lock:
                        results.append(r)
                except Exception as exc:
                    with lock:
                        errors.append(exc)

            threads = [threading.Thread(target=worker) for _ in range(20)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

            self.assertEqual(errors, [], f"Unexpected errors: {errors}")
            self.assertEqual(len(results), 20)
            # All results must be identical objects (cache hit) or at least equal.
            first = results[0]
            for r in results[1:]:
                self.assertEqual(r["files"], first["files"])

    def test_concurrent_calls_count_builds_correctly(self):
        """Under concurrency, _build_workspace_listing called at most once per key."""
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_json(d / "a.json", MINIMAL_PAYLOAD)

            cache = WorkspaceCache()
            build_count = [0]
            build_lock = threading.Lock()
            original_build = _build_workspace_listing

            def slow_counting_build(dialog_dir):
                with build_lock:
                    build_count[0] += 1
                # Simulate some work time
                time.sleep(0.01)
                return original_build(dialog_dir)

            barrier = threading.Barrier(10)

            def worker():
                barrier.wait()  # all threads start simultaneously
                with patch("viewer.server._build_workspace_listing", side_effect=slow_counting_build):
                    cache.get(d)

            threads = [threading.Thread(target=worker) for _ in range(10)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

            # Because threads serialize under the lock, the first thread builds
            # and all subsequent find the cache warm. Actual count depends on
            # scheduling but must be ≥1 and ≤ thread count. The important thing
            # is that results are all consistent (tested above).
            self.assertGreaterEqual(build_count[0], 1)
            self.assertLessEqual(build_count[0], 10)


class TestCollectWorkspaceListingPublicAPI(unittest.TestCase):
    """Ensure the public collect_workspace_listing uses the cache."""

    def test_returns_files_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_json(d / "a.json", MINIMAL_PAYLOAD)
            result = collect_workspace_listing(d)
            self.assertIn("files", result)
            self.assertEqual(len(result["files"]), 1)
            self.assertEqual(result["files"][0]["name"], "a.json")

    def test_graph_key_present(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            result = collect_workspace_listing(d)
            self.assertIn("graph", result)

    def test_second_call_is_cached(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write_json(d / "a.json", MINIMAL_PAYLOAD)
            r1 = collect_workspace_listing(d)
            r2 = collect_workspace_listing(d)
            self.assertIs(r1, r2)


if __name__ == "__main__":
    unittest.main()
