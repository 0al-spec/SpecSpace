"""Workspace listing cache primitives."""

from __future__ import annotations

import os
import threading
from collections.abc import Callable
from pathlib import Path
from typing import Any

BuildWorkspaceListing = Callable[[Path], dict[str, Any]]


def scan_dir_key(dialog_dir: Path) -> frozenset[tuple[str, float, int]]:
    """Return a fingerprint of all *.json files in dialog_dir using stat only."""
    try:
        with os.scandir(dialog_dir) as entries:
            result: list[tuple[str, float, int]] = []
            for entry in entries:
                if entry.is_file() and entry.name.endswith(".json"):
                    st = entry.stat()
                    result.append((entry.name, st.st_mtime, st.st_size))
            return frozenset(result)
    except OSError:
        return frozenset()


class WorkspaceCache:
    """Thread-safe cache for workspace-listing results.

    A cache miss occurs when any file is added, removed, or has its mtime/size
    changed. On a miss the full workspace is rebuilt and the cache updated
    atomically under a lock.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._key: frozenset[tuple[str, float, int]] | None = None
        self._result: dict[str, Any] | None = None

    def get(self, dialog_dir: Path, build_workspace_listing: BuildWorkspaceListing) -> dict[str, Any]:
        new_key = scan_dir_key(dialog_dir)
        with self._lock:
            if self._key == new_key and self._result is not None:
                return self._result
            result = build_workspace_listing(dialog_dir)
            self._key = new_key
            self._result = result
            return result

    def invalidate(self) -> None:
        """Force cache miss on the next request."""
        with self._lock:
            self._key = None
            self._result = None


WORKSPACE_CACHES: dict[Path, WorkspaceCache] = {}
REGISTRY_LOCK = threading.Lock()


def get_workspace_cache(
    dialog_dir: Path,
    *,
    cache_factory: Callable[[], WorkspaceCache] = WorkspaceCache,
) -> WorkspaceCache:
    """Return the per-directory cache instance for dialog_dir."""
    with REGISTRY_LOCK:
        if dialog_dir not in WORKSPACE_CACHES:
            WORKSPACE_CACHES[dialog_dir] = cache_factory()
        return WORKSPACE_CACHES[dialog_dir]
