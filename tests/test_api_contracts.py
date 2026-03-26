import json
import tempfile
import threading
import unittest
from http import HTTPStatus
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from http.server import ThreadingHTTPServer

from viewer import server


REPO_ROOT = Path(__file__).resolve().parent.parent
CANONICAL_FIXTURES = REPO_ROOT / "real_examples" / "canonical_json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_workspace(dialog_dir: Path, payloads: dict[str, dict]) -> None:
    for file_name, payload in payloads.items():
        (dialog_dir / file_name).write_text(json.dumps(payload), encoding="utf-8")


def start_test_server(dialog_dir: Path) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.ViewerHandler)
    httpd.repo_root = REPO_ROOT
    httpd.dialog_dir = dialog_dir
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, thread, f"http://127.0.0.1:{httpd.server_port}"


def stop_test_server(httpd: ThreadingHTTPServer, thread: threading.Thread) -> None:
    httpd.shutdown()
    thread.join()
    httpd.server_close()


def request_json(base_url: str, path: str, *, method: str = "GET", data: Optional[object] = None) -> tuple[int, object]:
    headers = {}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    request = Request(f"{base_url}{path}", data=body, headers=headers, method=method)
    try:
        with urlopen(request) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def request_text(base_url: str, path: str, *, method: str = "GET", data: Optional[bytes] = None) -> tuple[int, str]:
    request = Request(f"{base_url}{path}", data=data, method=method)
    try:
        with urlopen(request) as response:
            return response.status, response.read().decode("utf-8")
    except HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


class GraphApiContractTests(unittest.TestCase):
    def test_collect_graph_api_returns_summary_and_blocking_counts(self) -> None:
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

            payload = server.collect_graph_api(dialog_dir)

        self.assertEqual(payload["summary"]["node_count"], 0)
        self.assertEqual(payload["summary"]["blocked_file_count"], 2)
        self.assertEqual(payload["summary"]["blocking_issue_count"], 2)
        self.assertEqual(payload["summary"]["non_blocking_issue_count"], 0)
        self.assertTrue(payload["summary"]["has_blocking_issues"])

    def test_collect_conversation_api_returns_related_edges_and_compile_target(self) -> None:
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

            status, payload = server.collect_conversation_api(
                dialog_dir,
                "conv-trust-social-branding-branch",
            )

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["conversation"]["conversation_id"], "conv-trust-social-branding-branch")
        self.assertEqual(len(payload["parent_edges"]), 1)
        self.assertEqual(len(payload["child_edges"]), 1)
        self.assertEqual(payload["compile_target"]["scope"], "conversation")
        self.assertEqual(
            payload["compile_target"]["lineage_paths"],
            [["conv-trust-social-root", "conv-trust-social-branding-branch"]],
        )
        self.assertTrue(payload["compile_target"]["is_lineage_complete"])
        self.assertEqual(payload["integrity"]["blocking"], [])
        self.assertEqual(payload["integrity"]["non_blocking"], [])

    def test_collect_conversation_api_keeps_broken_lineage_visible(self) -> None:
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")
        branch_payload["lineage"]["parents"][0]["conversation_id"] = "conv-missing"

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"branch.json": branch_payload})

            status, payload = server.collect_conversation_api(
                dialog_dir,
                "conv-trust-social-branding-branch",
            )

        self.assertEqual(status, HTTPStatus.OK)
        self.assertFalse(payload["compile_target"]["is_lineage_complete"])
        self.assertEqual(len(payload["compile_target"]["unresolved_parent_edge_ids"]), 1)
        self.assertEqual(payload["compile_target"]["lineage_paths"], [["conv-trust-social-branding-branch"]])
        self.assertIn("missing_parent_conversation", {item["code"] for item in payload["integrity"]["non_blocking"]})

    def test_collect_checkpoint_api_returns_anchor_metadata(self) -> None:
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

            status, payload = server.collect_checkpoint_api(
                dialog_dir,
                "conv-trust-social-root",
                "msg-root-2",
            )

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["conversation"]["conversation_id"], "conv-trust-social-root")
        self.assertEqual(payload["checkpoint"]["message_id"], "msg-root-2")
        self.assertEqual(len(payload["child_edges"]), 2)
        self.assertEqual(payload["compile_target"]["scope"], "checkpoint")
        self.assertEqual(payload["compile_target"]["target_message_id"], "msg-root-2")
        self.assertEqual(payload["compile_target"]["lineage_paths"], [["conv-trust-social-root"]])
        self.assertTrue(payload["compile_target"]["is_lineage_complete"])

    def test_compile_target_includes_export_dir_conversation_scope(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload, "branch.json": branch_payload})

            status, payload = server.collect_conversation_api(
                dialog_dir,
                "conv-trust-social-branding-branch",
            )

        self.assertEqual(status, HTTPStatus.OK)
        expected_export_dir = str(dialog_dir / "export" / "conv-trust-social-branding-branch")
        self.assertEqual(payload["compile_target"]["export_dir"], expected_export_dir)

    def test_compile_target_includes_export_dir_checkpoint_scope(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            status, payload = server.collect_checkpoint_api(
                dialog_dir,
                "conv-trust-social-root",
                "msg-root-2",
            )

        self.assertEqual(status, HTTPStatus.OK)
        expected_export_dir = str(dialog_dir / "export" / "conv-trust-social-root--msg-root-2")
        self.assertEqual(payload["compile_target"]["export_dir"], expected_export_dir)

    def test_collect_checkpoint_api_returns_sibling_edges_for_lineage_navigation(self) -> None:
        """Verify that a parent checkpoint exposes all child edges as siblings for lineage navigation."""
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

            # First, get the branch conversation to find its parent edge.
            conv_status, conv_payload = server.collect_conversation_api(
                dialog_dir,
                "conv-trust-social-branding-branch",
            )
            self.assertEqual(conv_status, HTTPStatus.OK)
            parent_edge = conv_payload["parent_edges"][0]
            self.assertEqual(parent_edge["parent_conversation_id"], "conv-trust-social-root")
            self.assertEqual(parent_edge["parent_message_id"], "msg-root-2")

            # Navigate to the parent checkpoint — this is the ancestor jump.
            cp_status, cp_payload = server.collect_checkpoint_api(
                dialog_dir,
                parent_edge["parent_conversation_id"],
                parent_edge["parent_message_id"],
            )

        self.assertEqual(cp_status, HTTPStatus.OK)
        # The child edges of this checkpoint are the siblings of the branch.
        sibling_ids = {edge["child_conversation_id"] for edge in cp_payload["child_edges"]}
        self.assertIn("conv-trust-social-branding-branch", sibling_ids)
        self.assertIn("conv-contextbuilder-merge", sibling_ids)
        self.assertEqual(len(cp_payload["child_edges"]), 2)

    def test_collect_conversation_api_returns_structured_error_for_blocked_identity(self) -> None:
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

            status, payload = server.collect_conversation_api(dialog_dir, "conv-trust-social-root")

        self.assertEqual(status, HTTPStatus.CONFLICT)
        self.assertEqual(payload["error"], "Conversation is blocked by validation errors")
        self.assertEqual(payload["conversation_id"], "conv-trust-social-root")
        self.assertIn("duplicate_conversation_id", {item["code"] for item in payload["diagnostics"]})


class GraphApiHttpTests(unittest.TestCase):
    def test_graph_and_checkpoint_endpoints_serve_contract_payloads(self) -> None:
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

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                with urlopen(f"{base_url}/api/graph") as response:
                    graph_payload = json.loads(response.read().decode("utf-8"))
                with urlopen(
                    f"{base_url}/api/checkpoint?conversation_id=conv-trust-social-root&message_id=msg-root-2"
                ) as response:
                    checkpoint_payload = json.loads(response.read().decode("utf-8"))
            finally:
                stop_test_server(httpd, thread)

        self.assertEqual(graph_payload["summary"]["node_count"], 3)
        self.assertEqual(graph_payload["summary"]["root_count"], 1)
        self.assertEqual(checkpoint_payload["checkpoint"]["message_id"], "msg-root-2")
        self.assertEqual(checkpoint_payload["compile_target"]["target_message_id"], "msg-root-2")

    def test_conversation_endpoint_returns_404_for_unknown_identity(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                with self.assertRaises(HTTPError) as context:
                    urlopen(f"{base_url}/api/conversation?conversation_id=conv-missing")
                payload = json.loads(context.exception.read().decode("utf-8"))
            finally:
                stop_test_server(httpd, thread)

        self.assertEqual(context.exception.code, HTTPStatus.NOT_FOUND)
        self.assertEqual(payload["error"], "Conversation not found")
        self.assertEqual(payload["conversation_id"], "conv-missing")


class BranchCreationApiTests(unittest.TestCase):
    def test_branch_creation_from_checkpoint_produces_valid_graph_edge(self) -> None:
        """POST /api/file with a branch payload creates a child node linked to the parent checkpoint."""
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        branch_data = {
            "conversation_id": "conv-new-branch",
            "title": "New Branch from Checkpoint",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "branch",
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                # Create the branch via API
                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "new-branch.json", "data": branch_data},
                )
                self.assertEqual(status, HTTPStatus.OK)
                self.assertTrue(payload["ok"])
                self.assertEqual(payload["validation"]["kind"], "canonical-branch")

                # Verify the branch file exists on disk
                self.assertTrue((dialog_dir / "new-branch.json").exists())

                # Fetch graph and verify the new node and edge
                status, graph_payload = request_json(base_url, "/api/graph")
                self.assertEqual(status, HTTPStatus.OK)
                self.assertEqual(graph_payload["summary"]["node_count"], 2)

                graph = graph_payload["graph"]
                node_ids = {n["conversation_id"] for n in graph["nodes"]}
                self.assertIn("conv-new-branch", node_ids)
                self.assertIn("conv-trust-social-root", node_ids)

                # Verify the edge from root checkpoint to new branch
                branch_edges = [
                    e for e in graph["edges"]
                    if e["child_conversation_id"] == "conv-new-branch"
                ]
                self.assertEqual(len(branch_edges), 1)
                edge = branch_edges[0]
                self.assertEqual(edge["parent_conversation_id"], "conv-trust-social-root")
                self.assertEqual(edge["parent_message_id"], "msg-root-2")
                self.assertEqual(edge["link_type"], "branch")
                self.assertEqual(edge["status"], "resolved")

                # Verify checkpoint API shows the new child edge
                status, cp_payload = request_json(
                    base_url,
                    "/api/checkpoint?conversation_id=conv-trust-social-root&message_id=msg-root-2",
                )
                self.assertEqual(status, HTTPStatus.OK)
                child_ids = {e["child_conversation_id"] for e in cp_payload["child_edges"]}
                self.assertIn("conv-new-branch", child_ids)
            finally:
                stop_test_server(httpd, thread)

    def test_branch_creation_rejects_duplicate_file_name(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        branch_data = {
            "conversation_id": "conv-new-branch",
            "title": "New Branch",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "branch",
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                # Try to create a branch with the same filename as the root
                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "root.json", "data": branch_data},
                )
                self.assertEqual(status, HTTPStatus.CONFLICT)
                self.assertEqual(payload["error"], "File already exists")
            finally:
                stop_test_server(httpd, thread)


class MergeCreationApiTests(unittest.TestCase):
    def test_merge_creation_from_two_checkpoints_produces_canonical_merge_node(self) -> None:
        """POST /api/file with a two-parent merge payload creates a canonical-merge node with two inbound edges."""
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")

        merge_data = {
            "conversation_id": "conv-new-merge",
            "title": "Merge from Two Checkpoints",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "merge",
                    },
                    {
                        "conversation_id": "conv-trust-social-branding-branch",
                        "message_id": "msg-branch-2",
                        "link_type": "merge",
                    },
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(
                dialog_dir,
                {"root.json": root_payload, "branch.json": branch_payload},
            )

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                # Create the merge via API
                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "new-merge.json", "data": merge_data},
                )
                self.assertEqual(status, HTTPStatus.OK)
                self.assertTrue(payload["ok"])
                self.assertEqual(payload["validation"]["kind"], "canonical-merge")

                # Verify the merge file exists on disk
                self.assertTrue((dialog_dir / "new-merge.json").exists())

                # Fetch graph and verify the new node and edges
                status, graph_payload = request_json(base_url, "/api/graph")
                self.assertEqual(status, HTTPStatus.OK)
                self.assertEqual(graph_payload["summary"]["node_count"], 3)

                graph = graph_payload["graph"]
                node_ids = {n["conversation_id"] for n in graph["nodes"]}
                self.assertIn("conv-new-merge", node_ids)

                # Verify two inbound edges to the merge node
                merge_edges = [
                    e for e in graph["edges"]
                    if e["child_conversation_id"] == "conv-new-merge"
                ]
                self.assertEqual(len(merge_edges), 2)
                for edge in merge_edges:
                    self.assertEqual(edge["link_type"], "merge")
                    self.assertEqual(edge["status"], "resolved")

                parent_ids = {e["parent_conversation_id"] for e in merge_edges}
                self.assertIn("conv-trust-social-root", parent_ids)
                self.assertIn("conv-trust-social-branding-branch", parent_ids)
            finally:
                stop_test_server(httpd, thread)

    def test_merge_creation_rejects_single_parent(self) -> None:
        """A merge payload with only one parent must be rejected — merges require ≥ 2 parents."""
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        merge_data = {
            "conversation_id": "conv-bad-merge",
            "title": "Bad Merge — Only One Parent",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "merge",
                    }
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "bad-merge.json", "data": merge_data},
                )
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(payload["error"], "Validation failed")
            finally:
                stop_test_server(httpd, thread)

    def test_merge_creation_rejects_duplicate_parents(self) -> None:
        """A merge payload referencing the same parent twice must be rejected."""
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        merge_data = {
            "conversation_id": "conv-dup-merge",
            "title": "Duplicate Parent Merge",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "merge",
                    },
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "merge",
                    },
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "dup-merge.json", "data": merge_data},
                )
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(payload["error"], "Validation failed")
            finally:
                stop_test_server(httpd, thread)

    def test_merge_creation_rejects_missing_parent_conversation(self) -> None:
        """A merge payload referencing a non-existent parent conversation must be rejected."""
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        merge_data = {
            "conversation_id": "conv-orphan-merge",
            "title": "Orphan Merge",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "merge",
                    },
                    {
                        "conversation_id": "conv-does-not-exist",
                        "message_id": "msg-x-1",
                        "link_type": "merge",
                    },
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "orphan-merge.json", "data": merge_data},
                )
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(payload["error"], "Validation failed")
            finally:
                stop_test_server(httpd, thread)

    def test_merge_creation_rejects_duplicate_file_name(self) -> None:
        """POSTing a merge with a name matching an existing file must return 409."""
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")

        merge_data = {
            "conversation_id": "conv-new-merge",
            "title": "Merge",
            "messages": [],
            "lineage": {
                "parents": [
                    {
                        "conversation_id": "conv-trust-social-root",
                        "message_id": "msg-root-2",
                        "link_type": "merge",
                    },
                    {
                        "conversation_id": "conv-trust-social-branding-branch",
                        "message_id": "msg-branch-2",
                        "link_type": "merge",
                    },
                ]
            },
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(
                dialog_dir,
                {"root.json": root_payload, "branch.json": branch_payload},
            )

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "root.json", "data": merge_data},
                )
                self.assertEqual(status, HTTPStatus.CONFLICT)
                self.assertEqual(payload["error"], "File already exists")
            finally:
                stop_test_server(httpd, thread)


class FileApiHttpTests(unittest.TestCase):
    def test_file_api_supports_read_write_delete_and_error_paths(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        imported_payload = load_json((REPO_ROOT / "real_examples" / "import_json" / "Trust_Social_-_Лендинг_для_соцсети.json"))

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            (dialog_dir / "broken.json").write_text("{bad json", encoding="utf-8")

            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                status, payload = request_json(base_url, "/api/file?name=root.json")
                self.assertEqual(status, HTTPStatus.OK)
                self.assertEqual(payload["name"], "root.json")
                self.assertTrue(payload["validation"]["ok"])

                status, payload = request_json(base_url, "/api/file?name=../bad.json")
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(payload["error"], "Invalid file name")

                status, payload = request_json(base_url, "/api/file?name=missing.json")
                self.assertEqual(status, HTTPStatus.NOT_FOUND)
                self.assertEqual(payload["error"], "File not found")

                status, payload = request_json(base_url, "/api/file?name=broken.json")
                self.assertEqual(status, HTTPStatus.UNPROCESSABLE_ENTITY)
                self.assertEqual(payload["error"], "File contains invalid JSON")

                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "normalized.json", "data": imported_payload},
                )
                self.assertEqual(status, HTTPStatus.OK)
                self.assertTrue(payload["ok"])
                self.assertEqual(payload["validation"]["kind"], "canonical-root")

                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "normalized.json", "data": imported_payload},
                )
                self.assertEqual(status, HTTPStatus.CONFLICT)
                self.assertEqual(payload["error"], "File already exists")

                status, payload = request_json(
                    base_url,
                    "/api/file",
                    method="POST",
                    data={"name": "invalid.json", "data": {"title": "Bad", "messages": [{"role": "user", "content": "x"}]}},
                )
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(payload["error"], "Validation failed")

                status, payload = request_json(base_url, "/api/file?name=normalized.json", method="DELETE")
                self.assertEqual(status, HTTPStatus.OK)
                self.assertTrue(payload["ok"])

                status, payload = request_json(base_url, "/api/file?name=normalized.json", method="DELETE")
                self.assertEqual(status, HTTPStatus.NOT_FOUND)
                self.assertEqual(payload["error"], "File not found")

                status, payload = request_json(base_url, "/api/file?name=../bad.json", method="DELETE")
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertEqual(payload["error"], "Invalid file name")
            finally:
                stop_test_server(httpd, thread)

    def test_http_handler_rejects_invalid_json_body_and_unknown_routes(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                status, payload = request_text(base_url, "/api/file", method="POST", data=b"{not json")
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertIn("Invalid JSON body", payload)

                status, payload = request_text(base_url, "/api/file", method="POST", data=b"[]")
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
                self.assertIn("top-level value must be an object", payload)

                status, payload = request_text(base_url, "/api/unknown", method="POST", data=b"{}")
                self.assertEqual(status, HTTPStatus.NOT_FOUND)
                self.assertIn("Not Found", payload)

                status, payload = request_text(base_url, "/api/unknown", method="DELETE")
                self.assertEqual(status, HTTPStatus.NOT_FOUND)
                self.assertIn("Not Found", payload)

                status, payload = request_text(base_url, "/")
                self.assertEqual(status, HTTPStatus.OK)
                self.assertIn("<!DOCTYPE html>", payload)

                status, payload = request_text(base_url, "/viewer/missing.html")
                self.assertEqual(status, HTTPStatus.NOT_FOUND)
            finally:
                stop_test_server(httpd, thread)


class ExportApiTests(unittest.TestCase):
    """Tests for POST /api/export — export_graph_nodes()."""

    def test_conversation_scope_exports_all_lineage_messages(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload, "branch.json": branch_payload})

            status, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-branding-branch")

        self.assertEqual(status, HTTPStatus.OK)
        # Both root (2 msgs) and branch (2 msgs) should be exported.
        self.assertEqual(payload["node_count"], 4)
        conv_ids = [c["conversation_id"] for c in payload["conversations"]]
        self.assertIn("conv-trust-social-root", conv_ids)
        self.assertIn("conv-trust-social-branding-branch", conv_ids)

    def test_conversation_scope_writes_files_to_disk(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload, "branch.json": branch_payload})

            status, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-branding-branch")

            self.assertEqual(status, HTTPStatus.OK)
            export_dir = Path(payload["export_dir"])
            self.assertTrue(export_dir.exists())

            root_dir = export_dir / "nodes" / "conv-trust-social-root"
            branch_dir = export_dir / "nodes" / "conv-trust-social-branding-branch"
            self.assertTrue(root_dir.exists())
            self.assertTrue(branch_dir.exists())

            root_files = sorted(root_dir.iterdir())
            self.assertEqual(len(root_files), 2)
            self.assertTrue(root_files[0].name.startswith("0000_"))
            self.assertTrue(root_files[1].name.startswith("0001_"))

    def test_node_file_contains_provenance_comment_and_content(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            status, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")

            self.assertEqual(status, HTTPStatus.OK)
            export_dir = Path(payload["export_dir"])
            root_dir = export_dir / "nodes" / "conv-trust-social-root"
            first_file = sorted(root_dir.iterdir())[0]
            text = first_file.read_text(encoding="utf-8")

        self.assertTrue(text.startswith("<!--"))
        self.assertIn("conversation_id: conv-trust-social-root", text)
        self.assertIn("message_id:", text)
        self.assertIn("role:", text)
        # Content follows the comment
        self.assertIn("\n\n", text)
        # File ends with newline
        self.assertTrue(text.endswith("\n"))

    def test_checkpoint_scope_truncates_target_conversation(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            # Root has 2 messages: msg-root-1 (index 0) and msg-root-2 (index 1).
            # Exporting at checkpoint msg-root-1 should export only 1 message.
            status, payload = server.export_graph_nodes(
                dialog_dir, "conv-trust-social-root", "msg-root-1"
            )

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["node_count"], 1)
        conv_entry = payload["conversations"][0]
        self.assertEqual(len(conv_entry["files"]), 1)
        self.assertTrue(conv_entry["files"][0].startswith("0000_"))

    def test_checkpoint_scope_includes_messages_up_to_and_including_target(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            # Export at index 1 (msg-root-2) — should include both messages.
            status, payload = server.export_graph_nodes(
                dialog_dir, "conv-trust-social-root", "msg-root-2"
            )

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(payload["node_count"], 2)

    def test_export_is_deterministic_on_re_export(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            status1, payload1 = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
            export_dir = Path(payload1["export_dir"])
            files_first = {
                p.relative_to(export_dir): p.read_bytes()
                for p in sorted(export_dir.rglob("*.md"))
            }

            # Re-export
            status2, payload2 = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
            files_second = {
                p.relative_to(export_dir): p.read_bytes()
                for p in sorted(export_dir.rglob("*.md"))
            }

        self.assertEqual(status1, HTTPStatus.OK)
        self.assertEqual(status2, HTTPStatus.OK)
        self.assertEqual(files_first, files_second)

    def test_re_export_removes_stale_files(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})

            _, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
            export_dir = Path(payload["export_dir"])

            # Plant a stale file
            stale = export_dir / "nodes" / "conv-trust-social-root" / "9999_stale.md"
            stale.write_text("stale", encoding="utf-8")
            self.assertTrue(stale.exists())

            # Re-export should remove it
            server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
            self.assertFalse(stale.exists())

    def test_missing_conversation_id_returns_400(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            status, payload = server.export_graph_nodes(Path(tmp_dir), "")
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        self.assertIn("conversation_id", payload["error"])

    def test_unknown_conversation_id_returns_404(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            status, payload = server.export_graph_nodes(dialog_dir, "conv-does-not-exist")
        self.assertEqual(status, HTTPStatus.NOT_FOUND)

    def test_unknown_message_id_returns_404(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            status, payload = server.export_graph_nodes(
                dialog_dir, "conv-trust-social-root", "msg-does-not-exist"
            )
        self.assertEqual(status, HTTPStatus.NOT_FOUND)

    def test_response_includes_compile_target(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            status, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertIn("compile_target", payload)
        self.assertEqual(payload["compile_target"]["scope"], "conversation")

    def test_http_export_endpoint_returns_ok(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload, "branch.json": branch_payload})
            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                status, payload = request_json(
                    base_url,
                    "/api/export",
                    method="POST",
                    data={"conversation_id": "conv-trust-social-branding-branch"},
                )
                self.assertEqual(status, HTTPStatus.OK)
                self.assertEqual(payload["node_count"], 4)
                self.assertIn("export_dir", payload)
                self.assertIn("provenance_json", payload)
                self.assertIn("provenance_md", payload)
            finally:
                stop_test_server(httpd, thread)

    def test_http_export_endpoint_missing_conversation_id_returns_400(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")

        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            httpd, thread, base_url = start_test_server(dialog_dir)

            try:
                status, payload = request_json(
                    base_url,
                    "/api/export",
                    method="POST",
                    data={},
                )
                self.assertEqual(status, HTTPStatus.BAD_REQUEST)
            finally:
                stop_test_server(httpd, thread)

    # --- CTXB-P4-T2: root.hc generation ---

    def test_hc_file_written_to_export_dir(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            status, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
            self.assertEqual(status, HTTPStatus.OK)
            self.assertIn("hc_file", payload)
            self.assertTrue(Path(payload["hc_file"]).exists())
            self.assertEqual(Path(payload["hc_file"]).name, "root.hc")

    def test_hc_file_references_all_node_files(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload, "branch.json": branch_payload})
            status, payload = server.export_graph_nodes(
                dialog_dir, "conv-trust-social-branding-branch"
            )
            hc_text = Path(payload["hc_file"]).read_text(encoding="utf-8")
        self.assertEqual(status, HTTPStatus.OK)
        for conv in payload["conversations"]:
            for filename in conv["files"]:
                expected_ref = f'"nodes/{conv["conversation_id"]}/{filename}"'
                self.assertIn(expected_ref, hc_text)

    def test_hc_file_references_provenance_markdown(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            status, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
            hc_text = Path(payload["hc_file"]).read_text(encoding="utf-8")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertIn('"ContextBuilder compile provenance"', hc_text)
        self.assertIn('"provenance.md"', hc_text)

    def test_hc_file_sections_ordered_root_before_branch(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        branch_payload = load_json(CANONICAL_FIXTURES / "branch_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload, "branch.json": branch_payload})
            status, payload = server.export_graph_nodes(
                dialog_dir, "conv-trust-social-branding-branch"
            )
            hc_text = Path(payload["hc_file"]).read_text(encoding="utf-8")
        self.assertEqual(status, HTTPStatus.OK)
        root_idx = hc_text.index("nodes/conv-trust-social-root/")
        branch_idx = hc_text.index("nodes/conv-trust-social-branding-branch/")
        self.assertLess(root_idx, branch_idx)

    def test_hc_file_uses_conversation_title_as_section_header(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            status, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
            hc_text = Path(payload["hc_file"]).read_text(encoding="utf-8")
        self.assertEqual(status, HTTPStatus.OK)
        title = root_payload.get("title", "conv-trust-social-root")
        self.assertIn(f'"{title}"', hc_text)

    def test_hc_file_uses_4_space_indent_for_node_lines(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            status, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
            hc_text = Path(payload["hc_file"]).read_text(encoding="utf-8")
        self.assertEqual(status, HTTPStatus.OK)
        node_lines = [line for line in hc_text.splitlines() if "nodes/" in line]
        self.assertTrue(len(node_lines) > 0)
        for line in node_lines:
            self.assertTrue(line.startswith("    "), f"Expected 4-space indent: {line!r}")
            self.assertFalse(line.startswith("     "), f"Too many spaces: {line!r}")

    def test_hc_file_ends_with_newline(self) -> None:
        root_payload = load_json(CANONICAL_FIXTURES / "root_conversation.json")
        with tempfile.TemporaryDirectory() as tmp_dir:
            dialog_dir = Path(tmp_dir)
            write_workspace(dialog_dir, {"root.json": root_payload})
            _, payload = server.export_graph_nodes(dialog_dir, "conv-trust-social-root")
            hc_text = Path(payload["hc_file"]).read_text(encoding="utf-8")
        self.assertTrue(hc_text.endswith("\n"))


if __name__ == "__main__":
    unittest.main()
