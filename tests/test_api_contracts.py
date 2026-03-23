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


if __name__ == "__main__":
    unittest.main()
