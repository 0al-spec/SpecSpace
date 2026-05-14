"""Polling watchers used by SpecGraph SSE endpoints."""

from __future__ import annotations

import os
import re
import threading
import time
from pathlib import Path


class PollingWatcher:
    """Shared one-polling-thread/many-clients watcher lifecycle."""

    POLL_INTERVAL: float = 1.0
    KEEPALIVE_TIMEOUT: float = 14.0
    THREAD_NAME: str = "watcher-poll"

    def __init__(self) -> None:
        self._condition = threading.Condition()
        self._seq: int = 0
        self._client_count: int = 0
        self._thread: threading.Thread | None = None

    def _get_mtimes(self) -> dict[str, float]:
        raise NotImplementedError

    def _poll_loop(self) -> None:
        last_mtimes = self._get_mtimes()
        while True:
            time.sleep(self.POLL_INTERVAL)
            with self._condition:
                if self._client_count == 0:
                    self._thread = None
                    return
            current = self._get_mtimes()
            if current != last_mtimes:
                last_mtimes = current
                with self._condition:
                    self._seq += 1
                    self._condition.notify_all()

    def subscribe(self) -> int:
        """Register a new SSE client and start the poll thread if needed."""
        with self._condition:
            self._client_count += 1
            if self._thread is None or not self._thread.is_alive():
                self._thread = threading.Thread(
                    target=self._poll_loop,
                    daemon=True,
                    name=self.THREAD_NAME,
                )
                self._thread.start()
            return self._seq

    def unsubscribe(self) -> None:
        """Deregister an SSE client."""
        with self._condition:
            self._client_count = max(0, self._client_count - 1)

    def wait_for_change(self, last_seq: int) -> tuple[bool, int]:
        """Block until the sequence changes or the keepalive timeout expires."""
        with self._condition:
            fired = self._condition.wait_for(
                lambda: self._seq != last_seq,
                timeout=self.KEEPALIVE_TIMEOUT,
            )
            return fired, self._seq


class SpecWatcher(PollingWatcher):
    """Single polling thread that broadcasts spec-file changes to SSE clients."""

    POLL_INTERVAL: float = 1.0
    KEEPALIVE_TIMEOUT: float = 14.0
    THREAD_NAME: str = "spec-watcher-poll"

    def __init__(self, spec_dir: Path) -> None:
        super().__init__()
        self._spec_dir = spec_dir

    def _get_mtimes(self) -> dict[str, float]:
        result: dict[str, float] = {}
        try:
            with os.scandir(self._spec_dir) as entries:
                for entry in entries:
                    if entry.is_file() and entry.name.endswith((".yaml", ".yml")):
                        result[entry.name] = entry.stat().st_mtime
        except OSError:
            pass
        return result


class WorkspaceWatcher(PollingWatcher):
    """Polling watcher for conversation JSON files in the dialog workspace."""

    POLL_INTERVAL: float = 1.0
    KEEPALIVE_TIMEOUT: float = 14.0
    THREAD_NAME: str = "workspace-watcher-poll"

    def __init__(self, dialog_dir: Path) -> None:
        super().__init__()
        self._dialog_dir = dialog_dir

    def _get_mtimes(self) -> dict[str, float]:
        result: dict[str, float] = {}
        try:
            with os.scandir(self._dialog_dir) as entries:
                for entry in entries:
                    if entry.is_file() and entry.name.endswith(".json"):
                        stat = entry.stat()
                        result[f"{entry.name}\0{stat.st_size}"] = stat.st_mtime
        except OSError:
            pass
        return result


class RunsWatcher(PollingWatcher):
    """Polling watcher for SpecGraph runs/ artifacts."""

    POLL_INTERVAL: float = 2.0
    KEEPALIVE_TIMEOUT: float = 14.0
    THREAD_NAME: str = "runs-watcher-poll"
    _RUN_FILENAME_RE = re.compile(r"^\d{8}T\d{6}Z-SG-[A-Z]+-\d+-[0-9a-f]+\.json$")
    _WATCHED_ARTIFACT_NAMES = frozenset(
        {
            "spec_activity_feed.json",
            "implementation_work_index.json",
            "proposal_spec_trace_index.json",
            "exploration_preview.json",
        }
    )

    def __init__(self, runs_dir: Path) -> None:
        super().__init__()
        self._runs_dir = runs_dir

    def _get_mtimes(self) -> dict[str, float]:
        result: dict[str, float] = {}
        try:
            with os.scandir(self._runs_dir) as entries:
                for entry in entries:
                    if not entry.is_file():
                        continue
                    if (
                        self._RUN_FILENAME_RE.match(entry.name)
                        or entry.name in self._WATCHED_ARTIFACT_NAMES
                    ):
                        result[entry.name] = entry.stat().st_mtime
        except OSError:
            pass
        return result
