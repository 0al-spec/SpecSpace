import json
import tempfile
import unittest
from pathlib import Path

from viewer import server


REPO_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_FIXTURES = REPO_ROOT / "real_examples" / "canonical_json"
IMPORTED_FIXTURES = REPO_ROOT / "real_examples" / "import_json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_workspace(dialog_dir: Path, payloads: dict[str, dict]) -> None:
    for file_name, payload in payloads.items():
        (dialog_dir / file_name).write_text(json.dumps(payload), encoding="utf-8")


class WorkspaceGraphTests(unittest.TestCase):
    def test_workspace_listing_returns_graph_snapshot_for_root_branch_and_merge(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")
        merge_payload = load_json(CANONICAL_FIXTURES / "merge_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(
                dialog_dir,
                {
                    "root.json": root_payload,
                    "branch.json": branch_payload,
                    "merge.json": merge_payload,
                },
            )

            listing = server.collect_workspace_listing(dialog_dir)

        graph = listing["graph"]
        self.assertEqual(graph["roots"], ["conv-trust-social-root"])
        self.assertEqual(len(graph["nodes"]), 3)
        self.assertEqual(len(graph["edges"]), 3)
        self.assertEqual(graph["blocked_files"], [])
        self.assertEqual(graph["diagnostics"], [])

        nodes = {node["conversation_id"]: node for node in graph["nodes"]}
        root_node = nodes["conv-trust-social-root"]
        branch_node = nodes["conv-trust-social-branding-branch"]
        merge_node = nodes["conv-contextbuilder-merge"]

        self.assertEqual(root_node["parent_edge_ids"], [])
        self.assertEqual(len(root_node["child_edge_ids"]), 2)
        self.assertEqual(len(branch_node["parent_edge_ids"]), 1)
        self.assertEqual(len(branch_node["child_edge_ids"]), 1)
        self.assertEqual(len(merge_node["parent_edge_ids"]), 2)
        self.assertEqual(merge_node["child_edge_ids"], [])

        root_checkpoint = next(
            checkpoint for checkpoint in root_node["checkpoints"] if checkpoint["message_id"] == "msg-root-2"
        )
        branch_checkpoint = next(
            checkpoint for checkpoint in branch_node["checkpoints"] if checkpoint["message_id"] == "msg-branch-2"
        )

        self.assertEqual(len(root_checkpoint["child_edge_ids"]), 2)
        self.assertEqual(len(branch_checkpoint["child_edge_ids"]), 1)
        self.assertEqual(root_node["diagnostics"], [])
        self.assertEqual(branch_node["diagnostics"], [])
        self.assertEqual(merge_node["diagnostics"], [])

    def test_workspace_listing_normalizes_imported_roots_into_graph_nodes(self) -> None:
        imported_path = sorted(IMPORTED_FIXTURES.glob("*.json"))[0]
        imported_payload = load_json(imported_path)

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"imported.json": imported_payload})

            listing = server.collect_workspace_listing(dialog_dir)

        graph = listing["graph"]
        self.assertEqual(len(graph["nodes"]), 1)
        node = graph["nodes"][0]
        self.assertEqual(node["kind"], "canonical-root")
        self.assertTrue(node["conversation_id"].startswith("conv-"))
        self.assertEqual(node["parent_edge_ids"], [])
        self.assertEqual(node["child_edge_ids"], [])
        self.assertEqual(graph["edges"], [])
        self.assertEqual(graph["blocked_files"], [])

    def test_workspace_listing_keeps_broken_parent_edge_visible(self) -> None:
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")
        branch_payload["lineage"]["parents"][0]["conversation_id"] = "conv-missing"

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"branch.json": branch_payload})

            listing = server.collect_workspace_listing(dialog_dir)

        graph = listing["graph"]
        self.assertEqual(len(graph["nodes"]), 1)
        node = graph["nodes"][0]
        self.assertIn("missing_parent_conversation", {item["code"] for item in node["diagnostics"]})
        self.assertEqual(len(graph["edges"]), 1)
        edge = graph["edges"][0]
        self.assertEqual(edge["status"], "broken")
        self.assertIsNone(edge["parent_file_name"])
        self.assertIn("missing_parent_conversation", {item["code"] for item in edge["diagnostics"]})

    def test_workspace_listing_keeps_missing_parent_message_visible(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")
        branch_payload["lineage"]["parents"][0]["message_id"] = "msg-missing"

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(
                dialog_dir,
                {
                    "root.json": root_payload,
                    "branch.json": branch_payload,
                },
            )

            listing = server.collect_workspace_listing(dialog_dir)

        graph = listing["graph"]
        self.assertEqual(len(graph["nodes"]), 2)
        branch_node = next(node for node in graph["nodes"] if node["file_name"] == "branch.json")
        self.assertIn("missing_parent_message", {item["code"] for item in branch_node["diagnostics"]})
        self.assertEqual(len(graph["edges"]), 1)
        edge = graph["edges"][0]
        self.assertEqual(edge["status"], "broken")
        self.assertEqual(edge["parent_file_name"], "root.json")
        self.assertIn("missing_parent_message", {item["code"] for item in edge["diagnostics"]})

    def test_workspace_listing_blocks_duplicate_conversation_ids_from_graph_nodes(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")
        branch_payload["conversation_id"] = root_payload["conversation_id"]

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(
                dialog_dir,
                {
                    "root.json": root_payload,
                    "branch.json": branch_payload,
                },
            )

            listing = server.collect_workspace_listing(dialog_dir)

        graph = listing["graph"]
        self.assertEqual(graph["nodes"], [])
        self.assertEqual(graph["edges"], [])
        self.assertEqual(len(graph["blocked_files"]), 2)
        self.assertTrue(
            all(
                "duplicate_conversation_id" in {item["code"] for item in blocked["diagnostics"]}
                for blocked in graph["blocked_files"]
            )
        )

    def test_workspace_listing_keeps_invalid_json_as_diagnostics_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            (dialog_dir / "broken.json").write_text("{not valid json", encoding="utf-8")

            listing = server.collect_workspace_listing(dialog_dir)

        graph = listing["graph"]
        self.assertEqual(graph["nodes"], [])
        self.assertEqual(graph["edges"], [])
        self.assertEqual(len(graph["blocked_files"]), 1)
        self.assertIn("invalid_json", {item["code"] for item in graph["blocked_files"][0]["diagnostics"]})


if __name__ == "__main__":
    unittest.main()
