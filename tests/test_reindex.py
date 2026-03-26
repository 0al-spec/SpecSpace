"""Tests for re-indexing external file changes (CTXB-P3-T5).

Verifies that the server re-reads the workspace directory on every API
request, so additions, deletions, and modifications made by external
agents are reflected without a server restart.
"""

import copy
import json
import tempfile
import unittest
from pathlib import Path

from viewer import server

REPO_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_FIXTURES = REPO_ROOT / "real_examples" / "canonical_json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_file(dialog_dir: Path, name: str, payload: dict) -> None:
    (dialog_dir / name).write_text(json.dumps(payload), encoding="utf-8")


class ReindexFilesApiTests(unittest.TestCase):
    """Verify /api/files reflects on-disk changes between calls."""

    def test_newly_added_file_appears_in_files_listing(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)

            # First call: empty workspace
            result_before = server.collect_workspace_listing(dialog_dir)
            self.assertEqual(result_before["files"], [])

            # External agent adds a file
            write_file(dialog_dir, "root.json", root_payload)

            # Second call: must see the new file without restart
            result_after = server.collect_workspace_listing(dialog_dir)
            names = [f["name"] for f in result_after["files"]]
            self.assertIn("root.json", names)

    def test_deleted_file_disappears_from_files_listing(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_file(dialog_dir, "root.json", root_payload)

            result_before = server.collect_workspace_listing(dialog_dir)
            names_before = [f["name"] for f in result_before["files"]]
            self.assertIn("root.json", names_before)

            # External agent deletes the file
            (dialog_dir / "root.json").unlink()

            result_after = server.collect_workspace_listing(dialog_dir)
            names_after = [f["name"] for f in result_after["files"]]
            self.assertNotIn("root.json", names_after)

    def test_modified_file_remains_in_files_listing_with_valid_kind(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_file(dialog_dir, "conv.json", root_payload)

            result_before = server.collect_workspace_listing(dialog_dir)
            entry_before = next(f for f in result_before["files"] if f["name"] == "conv.json")
            self.assertIn(entry_before["kind"], {"root", "canonical-root"})
            size_before = entry_before["size"]

            # External agent modifies the file (change title — root stays root)
            updated = copy.deepcopy(root_payload)
            updated["title"] = "Externally Updated Title"
            write_file(dialog_dir, "conv.json", updated)

            result_after = server.collect_workspace_listing(dialog_dir)
            entry_after = next(f for f in result_after["files"] if f["name"] == "conv.json")
            self.assertIn(entry_after["kind"], {"root", "canonical-root"})
            # File size changed because content changed
            self.assertNotEqual(entry_after["size"], size_before)


class ReindexGraphApiTests(unittest.TestCase):
    """Verify /api/graph reflects on-disk changes between calls."""

    def test_newly_added_file_appears_as_graph_node(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        root_id = root_payload["conversation_id"]

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)

            graph_before = server.collect_graph_api(dialog_dir)
            node_ids_before = {n["conversation_id"] for n in graph_before["graph"]["nodes"]}
            self.assertNotIn(root_id, node_ids_before)

            # External agent adds file
            write_file(dialog_dir, "root.json", root_payload)

            graph_after = server.collect_graph_api(dialog_dir)
            node_ids_after = {n["conversation_id"] for n in graph_after["graph"]["nodes"]}
            self.assertIn(root_id, node_ids_after)

    def test_deleted_file_disappears_from_graph_nodes(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        root_id = root_payload["conversation_id"]

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_file(dialog_dir, "root.json", root_payload)

            graph_before = server.collect_graph_api(dialog_dir)
            node_ids_before = {n["conversation_id"] for n in graph_before["graph"]["nodes"]}
            self.assertIn(root_id, node_ids_before)

            # External agent deletes file
            (dialog_dir / "root.json").unlink()

            graph_after = server.collect_graph_api(dialog_dir)
            node_ids_after = {n["conversation_id"] for n in graph_after["graph"]["nodes"]}
            self.assertNotIn(root_id, node_ids_after)

    def test_modified_file_title_reflected_in_graph_node(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        root_id = root_payload["conversation_id"]

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_file(dialog_dir, "root.json", root_payload)

            graph_before = server.collect_graph_api(dialog_dir)
            node_before = next(n for n in graph_before["graph"]["nodes"] if n["conversation_id"] == root_id)
            original_title = node_before["title"]

            # External agent updates the file's title
            updated = copy.deepcopy(root_payload)
            updated["title"] = "Updated Title By External Agent"
            write_file(dialog_dir, "root.json", updated)

            graph_after = server.collect_graph_api(dialog_dir)
            node_after = next(n for n in graph_after["graph"]["nodes"] if n["conversation_id"] == root_id)
            self.assertEqual(node_after["title"], "Updated Title By External Agent")
            self.assertNotEqual(node_after["title"], original_title)

    def test_multiple_files_added_and_one_deleted_graph_stays_consistent(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")
        root_id = root_payload["conversation_id"]
        branch_id = branch_payload["conversation_id"]

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_file(dialog_dir, "root.json", root_payload)
            write_file(dialog_dir, "branch.json", branch_payload)

            graph_with_both = server.collect_graph_api(dialog_dir)
            ids_with_both = {n["conversation_id"] for n in graph_with_both["graph"]["nodes"]}
            self.assertIn(root_id, ids_with_both)
            self.assertIn(branch_id, ids_with_both)

            # Delete the branch file externally
            (dialog_dir / "branch.json").unlink()

            graph_after_delete = server.collect_graph_api(dialog_dir)
            ids_after_delete = {n["conversation_id"] for n in graph_after_delete["graph"]["nodes"]}
            self.assertIn(root_id, ids_after_delete)
            self.assertNotIn(branch_id, ids_after_delete)


if __name__ == "__main__":
    unittest.main()
