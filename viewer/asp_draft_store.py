"""Opt-in local ASP draft storage. Not a replacement for the external backend."""
from __future__ import annotations

from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3
import threading

from viewer import specspace_state_backend as state_backend

ENTRY_FILE = "real_idea_entry_requests.json"


class DraftStore(state_backend.FileStateBackend):
    """One SQLite commit covers the native draft and ASP admission/result state.

    Only the raw-idea collection moves to SQLite. All other collections retain
    their existing backend. Nested calls in one thread share the transaction;
    independent threads/processes serialize via BEGIN IMMEDIATE.
    """

    def __init__(self, state_dir: Path):
        super().__init__(state_dir)
        state_dir.mkdir(parents=True, exist_ok=True)
        if (state_dir / ENTRY_FILE).exists() or (state_dir / ENTRY_FILE).is_symlink():
            raise ValueError("ASP draft mode requires a fresh state directory; no implicit migration")
        self.path = state_dir / "asp-drafts.sqlite3"
        if self.path.is_symlink():
            raise ValueError("ASP draft database must not be a symlink")
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.close(fd)
        os.chmod(self.path, 0o600)
        self._local = threading.local()
        with self.transaction() as db:
            db.execute("CREATE TABLE IF NOT EXISTS records (kind TEXT, key TEXT, value TEXT NOT NULL, PRIMARY KEY(kind,key))")

    @contextmanager
    def transaction(self):
        current = getattr(self._local, "connection", None)
        if current is not None:
            yield current
            return
        db = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        db.execute("PRAGMA synchronous=FULL")
        self._local.connection = db
        try:
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            self._local.connection = None
            db.close()

    def get(self, kind: str, key: str):
        with self.transaction() as db:
            row = db.execute("SELECT value FROM records WHERE kind=? AND key=?", (kind, key)).fetchone()
            return json.loads(row[0]) if row else None

    def put(self, kind: str, key: str, value: dict):
        with self.transaction() as db:
            db.execute("INSERT INTO records VALUES (?,?,?) ON CONFLICT(kind,key) DO UPDATE SET value=excluded.value",
                       (kind, key, json.dumps(value, ensure_ascii=False, separators=(",", ":"))))

    def all(self, kind: str):
        with self.transaction() as db:
            return [json.loads(row[0]) for row in db.execute("SELECT value FROM records WHERE kind=? ORDER BY key", (kind,))]

    def read(self, filename, *, workspace_id):
        if filename != ENTRY_FILE:
            return super().read(filename, workspace_id=workspace_id)
        document = self.get("native", ENTRY_FILE)
        if document is None or workspace_id is None:
            return document
        return state_backend._workspace_document(document, filename=filename, workspace_id=workspace_id)

    def write(self, filename, *, workspace_id, state):
        if filename != ENTRY_FILE:
            return super().write(filename, workspace_id=workspace_id, state=state)
        with self.transaction():
            selected = state_backend._workspace_document(state, filename=filename, workspace_id=workspace_id)
            old = self.read(filename, workspace_id=None) or {"requests": []}
            selected["requests"] = [item for item in old["requests"] if item["workspace_id"] != workspace_id] + selected["requests"]
            self.put("native", ENTRY_FILE, selected)
            return {"workspace_id": workspace_id, "record_key": filename,
                    "content_sha256": state_backend.content_sha256(selected), "revision": None}

    def materialize(self, filename, *, workspace_id):
        if filename == ENTRY_FILE:
            raise state_backend.StateBackendError("ASP draft mode does not materialize executable intake state")
        return super().materialize(filename, workspace_id=workspace_id)

    def write_record(self, record_key, *, workspace_id, content, lifecycle_state="active"):
        if record_key == ENTRY_FILE:
            raise state_backend.StateBackendError("Raw idea state must use the application mutation boundary")
        return super().write_record(record_key, workspace_id=workspace_id, content=content, lifecycle_state=lifecycle_state)

    def read_record(self, record_key, *, workspace_id):
        if record_key == ENTRY_FILE:
            content = self.read(record_key, workspace_id=workspace_id)
            if content is None:
                return None
            return {"workspace_id": workspace_id, "record_key": record_key, "revision": None,
                    "content_sha256": state_backend.content_sha256(content), "content": content,
                    "lifecycle_state": "active"}
        return super().read_record(record_key, workspace_id=workspace_id)
