from __future__ import annotations

from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace

from viewer import real_idea_entry_requests, specspace_state_backend
from viewer.asp_draft_store import DraftStore


def _server(state_dir: Path, store: object | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        repo_root=state_dir,
        specspace_state_dir=state_dir,
        specspace_state_backend=store or DraftStore(state_dir),
    )


def _payload(workspace_id: str, request_id: str, idea_text: str) -> dict[str, object]:
    return {
        "workspace_id": workspace_id,
        "request_id": request_id,
        "idea_text": idea_text,
        "status": "draft",
    }


class AspDraftStoreTests(unittest.TestCase):
    def test_native_save_and_read_use_sqlite(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state_dir = Path(directory)
            store = DraftStore(state_dir)
            server = _server(state_dir, store)

            status, response = real_idea_entry_requests.save_request(
                server, _payload("workspace-a", "draft-a", "idea a"), workspace_id="workspace-a"
            )

            self.assertEqual(status.value, 200)
            self.assertEqual(response["requests"][0]["request_id"], "draft-a")
            self.assertEqual(store.all("native"), [store.get("native", "real_idea_entry_requests.json")])
            self.assertFalse((state_dir / "real_idea_entry_requests.json").exists())

    def test_transaction_rolls_back_native_save_and_execution_record(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state_dir = Path(directory)
            store = DraftStore(state_dir)
            server = _server(state_dir, store)

            with self.assertRaisesRegex(RuntimeError, "abort"):
                with store.transaction():
                    status, _ = real_idea_entry_requests.save_request(
                        server, _payload("workspace-a", "draft-a", "idea a"), workspace_id="workspace-a"
                    )
                    self.assertEqual(status.value, 200)
                    store.put("execution", "attempt-a", {"status": "pending"})
                    raise RuntimeError("abort")

            self.assertIsNone(store.get("native", "real_idea_entry_requests.json"))
            self.assertIsNone(store.get("execution", "attempt-a"))

    def test_process_crash_rolls_back_transaction(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state_dir = Path(directory)
            script = """
from pathlib import Path
import os
from viewer.asp_draft_store import DraftStore
store = DraftStore(Path(__import__('sys').argv[1]))
with store.transaction():
    store.put('execution', 'crash', {'status': 'pending'})
    os._exit(17)
"""
            result = subprocess.run(
                [sys.executable, "-B", "-c", script, str(state_dir)],
                cwd=Path(__file__).parents[1],
                check=False,
            )
            self.assertEqual(result.returncode, 17)
            self.assertIsNone(DraftStore(state_dir).get("execution", "crash"))

    def test_concurrent_process_saves_preserve_both_workspaces(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state_dir = Path(directory)
            script = """
from pathlib import Path
from types import SimpleNamespace
from viewer import real_idea_entry_requests
from viewer.asp_draft_store import DraftStore
root = Path(__import__('sys').argv[1])
workspace = __import__('sys').argv[2]
store = DraftStore(root)
server = SimpleNamespace(repo_root=root, specspace_state_dir=root, specspace_state_backend=store)
status, _ = real_idea_entry_requests.save_request(
    server,
    {'workspace_id': workspace, 'request_id': 'draft-' + workspace, 'idea_text': workspace, 'status': 'draft'},
    workspace_id=workspace,
)
raise SystemExit(0 if status.value == 200 else 1)
"""
            processes = [
                subprocess.Popen([sys.executable, "-B", "-c", script, str(state_dir), workspace],
                                 cwd=Path(__file__).parents[1])
                for workspace in ("workspace-a", "workspace-b")
            ]
            self.assertEqual([process.wait() for process in processes], [0, 0])
            requests = DraftStore(state_dir).all("native")[0]["requests"]
            self.assertEqual({item["workspace_id"] for item in requests}, {"workspace-a", "workspace-b"})

    def test_native_same_id_edit_remains_legitimate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state_dir = Path(directory)
            store = DraftStore(state_dir)
            server = _server(state_dir, store)
            first = real_idea_entry_requests.save_request(
                server, _payload("workspace-a", "draft-a", "first"), workspace_id="workspace-a"
            )
            second = real_idea_entry_requests.save_request(
                server, _payload("workspace-a", "draft-a", "edited"), workspace_id="workspace-a"
            )
            self.assertEqual(first[0].value, 200)
            self.assertEqual(second[0].value, 200)
            self.assertEqual([item["idea_text"] for item in second[1]["requests"]], ["edited"])

    def test_rejects_existing_json_migration_and_database_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state_dir = Path(directory)
            (state_dir / "real_idea_entry_requests.json").write_text("{}", encoding="utf-8")
            with self.assertRaises(ValueError):
                DraftStore(state_dir)

        with tempfile.TemporaryDirectory() as directory:
            state_dir = Path(directory)
            target = state_dir / "target.sqlite3"
            target.touch()
            (state_dir / "asp-drafts.sqlite3").symlink_to(target)
            with self.assertRaises(ValueError):
                DraftStore(state_dir)

    def test_materialize_refuses_raw_idea(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            store = DraftStore(Path(directory))
            with self.assertRaises(specspace_state_backend.StateBackendError):
                store.materialize("real_idea_entry_requests.json", workspace_id="workspace-a")

    def test_regular_file_backend_is_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state_dir = Path(directory)
            backend = specspace_state_backend.FileStateBackend(state_dir)
            state = {"requests": [{"workspace_id": "workspace-a", "request_id": "x"}]}
            backend.write("real_idea_entry_requests.json", workspace_id="workspace-a", state=state)
            self.assertEqual(backend.read("real_idea_entry_requests.json", workspace_id="workspace-a"), state)
            self.assertEqual(backend.materialize("real_idea_entry_requests.json", workspace_id="workspace-a"),
                             state_dir / "real_idea_entry_requests.json")


if __name__ == "__main__":
    unittest.main()
