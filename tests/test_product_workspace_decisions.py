import hashlib
import json
import tempfile
import threading
import unittest
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from urllib.error import HTTPError
from pathlib import Path
from urllib.request import urlopen

from viewer import server as viewer_server, specspace_provider, specgraph

GOLDEN = Path(__file__).resolve().parents[1] / "graphspace/src/widgets/canonical-decisions/fixtures/golden.json"
SOURCE_FIXTURES = Path(__file__).resolve().parent / "fixtures/product_workspace_decisions/specs"


class ProductWorkspaceDecisionContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.payload = json.loads(GOLDEN.read_text(encoding="utf-8"))

    def test_golden_contract_preserves_ids_and_keys_and_sorts_by_source_ref(self) -> None:
        status, result = specspace_provider._validate_product_workspace_decisions(self.payload, "team-decision-log")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual([item["id"] for item in result["decisions"]], [
            "01JQ4M8N7QAZP6Y4N2M8T5V9KS",
            "01JQ4M8N7QAZP6Y4N2M8T5V9KR",
        ])
        self.assertEqual(result["decisions"][0]["key"], "decision.zed")

    def test_empty_collection_is_available_but_old_bundle_is_unavailable(self) -> None:
        empty = {**self.payload, "summary": {"decision_count": 0}, "decisions": []}
        status, response = specspace_provider._validate_product_workspace_decisions(empty, "team-decision-log")
        self.assertEqual(status, HTTPStatus.OK)
        self.assertTrue(response["available"])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            provider = specspace_provider.ProductWorkspaceFileProvider(
                delegate=specspace_provider.FileSpecGraphProvider(root / "specs/nodes", root / "runs", root),
                workspace_id="team-decision-log",
            )
            status, response = provider.read_product_workspace_decisions()
            self.assertEqual(status, HTTPStatus.OK)
            self.assertFalse(response["available"])

    def test_rejects_duplicate_identity_unsafe_source_and_workspace_mismatch(self) -> None:
        duplicate_id = json.loads(json.dumps(self.payload))
        duplicate_id["decisions"][1]["id"] = duplicate_id["decisions"][0]["id"]
        self.assertEqual(specspace_provider._validate_product_workspace_decisions(duplicate_id, "team-decision-log")[0], HTTPStatus.SERVICE_UNAVAILABLE)
        duplicate = json.loads(json.dumps(self.payload))
        duplicate["decisions"][1]["key"] = duplicate["decisions"][0]["key"]
        self.assertEqual(specspace_provider._validate_product_workspace_decisions(duplicate, "team-decision-log")[0], HTTPStatus.SERVICE_UNAVAILABLE)
        unsafe = json.loads(json.dumps(self.payload))
        unsafe["decisions"][0]["source_ref"] = "specs/../../secret.yaml"
        self.assertEqual(specspace_provider._validate_product_workspace_decisions(unsafe, "team-decision-log")[0], HTTPStatus.SERVICE_UNAVAILABLE)
        self.assertEqual(specspace_provider._validate_product_workspace_decisions(self.payload, "another-workspace")[0], HTTPStatus.SERVICE_UNAVAILABLE)
        bad_revision = json.loads(json.dumps(self.payload))
        bad_revision["decisions"][0]["revision"] = 0
        self.assertEqual(specspace_provider._validate_product_workspace_decisions(bad_revision, "team-decision-log")[0], HTTPStatus.SERVICE_UNAVAILABLE)
        bad_lifecycle = json.loads(json.dumps(self.payload))
        bad_lifecycle["decisions"][0]["status"] = "approved"
        self.assertEqual(specspace_provider._validate_product_workspace_decisions(bad_lifecycle, "team-decision-log")[0], HTTPStatus.SERVICE_UNAVAILABLE)
        bad_provenance = json.loads(json.dumps(self.payload))
        bad_provenance["decisions"][0]["provenance"]["sources"] = [{"doc": "../../private.md"}]
        self.assertEqual(specspace_provider._validate_product_workspace_decisions(bad_provenance, "team-decision-log")[0], HTTPStatus.SERVICE_UNAVAILABLE)
        empty_authority = json.loads(json.dumps(self.payload))
        empty_authority["decisions"][0]["provenance"]["authority"] = "  "
        self.assertEqual(specspace_provider._validate_product_workspace_decisions(empty_authority, "team-decision-log")[0], HTTPStatus.SERVICE_UNAVAILABLE)
        empty_successor = json.loads(json.dumps(self.payload))
        empty_successor["decisions"][0]["lifecycle"]["supersededBy"] = " "
        self.assertEqual(specspace_provider._validate_product_workspace_decisions(empty_successor, "team-decision-log")[0], HTTPStatus.SERVICE_UNAVAILABLE)

    def test_file_provider_reads_only_manifest_declared_index_and_source(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "dist/specgraph-public"
            (artifact_root / "runs").mkdir(parents=True)
            (artifact_root / "specs/nodes").mkdir(parents=True)
            index_bytes = GOLDEN.read_bytes()
            (artifact_root / specspace_provider.PRODUCT_WORKSPACE_DECISION_ARTIFACT).write_bytes(index_bytes)
            for source in SOURCE_FIXTURES.rglob("*.yaml"):
                target = artifact_root / "specs" / source.relative_to(SOURCE_FIXTURES)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read_bytes())
            (artifact_root / "artifact_manifest.json").write_text(json.dumps({
                "artifact_kind": "specgraph_static_artifact_manifest",
                "files": [
                    {"path": specspace_provider.PRODUCT_WORKSPACE_DECISION_ARTIFACT, "sha256": hashlib.sha256(index_bytes).hexdigest()},
                    *[{"path": item["source_ref"], "sha256": item["source_sha256"]} for item in self.payload["decisions"]],
                ],
            }), encoding="utf-8")
            manifest_path = artifact_root / "artifact_manifest.json"
            provider = specspace_provider.ProductWorkspaceFileProvider(
                delegate=specspace_provider.FileSpecGraphProvider(root / "specs/nodes", root / "runs", root),
                workspace_id="team-decision-log",
            )
            status, response = provider.read_product_workspace_decisions()
            self.assertEqual(status, HTTPStatus.OK)
            self.assertTrue(response["available"])
            status, source = provider.read_artifact_content("specs/nodes/decision-alpha.yaml")
            self.assertEqual(status, HTTPStatus.OK)
            self.assertEqual(source["content_kind"], "text")
            (artifact_root / "specs/nodes/decision-alpha.yaml").write_text(
                "modified source bytes\n", encoding="utf-8"
            )
            status, response = provider.read_product_workspace_decisions()
            self.assertEqual(status, HTTPStatus.SERVICE_UNAVAILABLE)
            self.assertEqual(response["reason"], "invalid_product_workspace_decisions_artifact")
            status, response = provider.read_artifact_content("specs/nodes/decision-alpha.yaml")
            self.assertEqual(status, HTTPStatus.SERVICE_UNAVAILABLE)
            self.assertEqual(response["reason"], "invalid_product_workspace_decisions_artifact")
            bad_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            source_entry = next(item for item in bad_manifest["files"] if item["path"] == "specs/nodes/decision-alpha.yaml")
            source_entry["sha256"] = "0" * 64
            manifest_path.write_text(json.dumps(bad_manifest), encoding="utf-8")
            status, response = provider.read_product_workspace_decisions()
            self.assertEqual(status, HTTPStatus.SERVICE_UNAVAILABLE)
            self.assertEqual(response["reason"], "invalid_product_workspace_decisions_artifact")

    def test_http_provider_reads_manifest_selected_workspace_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "runs").mkdir()
            index_bytes = GOLDEN.read_bytes()
            (root / specspace_provider.PRODUCT_WORKSPACE_DECISION_ARTIFACT).write_bytes(index_bytes)
            for source in SOURCE_FIXTURES.rglob("*.yaml"):
                target = root / "specs" / source.relative_to(SOURCE_FIXTURES)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read_bytes())
            (root / "artifact_manifest.json").write_text(json.dumps({
                "artifact_kind": "specgraph_static_artifact_manifest",
                "files": [
                    {"path": specspace_provider.PRODUCT_WORKSPACE_DECISION_ARTIFACT, "sha256": hashlib.sha256(index_bytes).hexdigest()},
                    *[{"path": item["source_ref"], "sha256": item["source_sha256"]} for item in self.payload["decisions"]],
                ],
            }), encoding="utf-8")
            handler = partial(SimpleHTTPRequestHandler, directory=tmp)
            http_server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=http_server.serve_forever, daemon=True)
            thread.start()
            try:
                delegate = specspace_provider.HttpSpecGraphProvider(
                    f"http://127.0.0.1:{http_server.server_port}",
                    specspace_provider.HttpArtifactCache(),
                )
                provider = specspace_provider.ProductWorkspaceHttpProvider(delegate, "team-decision-log")
                status, response = provider.read_product_workspace_decisions()
                self.assertEqual(status, HTTPStatus.OK)
                self.assertTrue(response["available"])
                self.assertEqual(response["workspace_id"], "team-decision-log")
                (root / "specs/nodes/decision-alpha.yaml").write_text(
                    "modified source bytes\n", encoding="utf-8"
                )
                status, response = provider.read_product_workspace_decisions()
                self.assertEqual(status, HTTPStatus.SERVICE_UNAVAILABLE)
                self.assertEqual(response["reason"], "invalid_product_workspace_decisions_artifact")
                status, response = provider.read_artifact_content("specs/nodes/decision-alpha.yaml")
                self.assertEqual(status, HTTPStatus.SERVICE_UNAVAILABLE)
                self.assertEqual(response["reason"], "invalid_product_workspace_decisions_artifact")
            finally:
                http_server.shutdown()
                thread.join(timeout=5)
                http_server.server_close()

    def test_file_provider_selects_workspace_scoped_manifest_before_shared_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shared = root / "dist/specgraph-public"
            scoped = shared / "workspaces/support-triage-log"

            def write_bundle(bundle_root: Path, payload: dict[str, object]) -> None:
                bundle_root.mkdir(parents=True, exist_ok=True)
                index_bytes = json.dumps(payload, sort_keys=True, indent=2).encode() + b"\n"
                (bundle_root / specspace_provider.PRODUCT_WORKSPACE_DECISION_ARTIFACT).parent.mkdir(
                    parents=True, exist_ok=True
                )
                (bundle_root / specspace_provider.PRODUCT_WORKSPACE_DECISION_ARTIFACT).write_bytes(index_bytes)
                for source in SOURCE_FIXTURES.rglob("*.yaml"):
                    target = bundle_root / "specs" / source.relative_to(SOURCE_FIXTURES)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(source.read_bytes())
                files = [
                    {
                        "path": specspace_provider.PRODUCT_WORKSPACE_DECISION_ARTIFACT,
                        "sha256": hashlib.sha256(index_bytes).hexdigest(),
                    },
                    *[
                        {"path": item["source_ref"], "sha256": item["source_sha256"]}
                        for item in payload["decisions"]
                    ],
                ]
                (bundle_root / "artifact_manifest.json").write_text(
                    json.dumps({"artifact_kind": "specgraph_static_artifact_manifest", "files": files}),
                    encoding="utf-8",
                )

            write_bundle(shared, self.payload)
            delegate = specspace_provider.FileSpecGraphProvider(
                root / "specs/nodes",
                root / "runs",
                root,
            )
            other_workspace = specspace_provider.ProductWorkspaceFileProvider(
                delegate=delegate,
                workspace_id="support-triage-log",
            )
            status, response = other_workspace.read_product_workspace_decisions()
            self.assertEqual(status, HTTPStatus.OK)
            self.assertFalse(response["available"])

            scoped_payload = json.loads(json.dumps(self.payload))
            scoped_payload["workspace_id"] = "support-triage-log"
            write_bundle(scoped, scoped_payload)
            status, response = other_workspace.read_product_workspace_decisions()
            self.assertEqual(status, HTTPStatus.OK)
            self.assertTrue(response["available"])
            self.assertEqual(response["workspace_id"], "support-triage-log")

    def test_legacy_graph_skips_canonical_envelopes_without_changing_legacy_nodes(self) -> None:
        graph = specgraph.build_spec_graph([
            {"kind": "Node", "metadata": {"id": "canonical-1"}},
            {"id": "SG-SPEC-1", "kind": "spec", "title": "Legacy", "status": "specified"},
        ])
        self.assertEqual(graph["blocked_files"], [])
        self.assertEqual([node["node_id"] for node in graph["nodes"]], ["SG-SPEC-1"])

    def test_http_api_reads_selected_workspace_decision_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "public"
            root.mkdir()
            (root / "runs").mkdir()
            index_bytes = GOLDEN.read_bytes()
            (root / specspace_provider.PRODUCT_WORKSPACE_DECISION_ARTIFACT).write_bytes(index_bytes)
            for source in SOURCE_FIXTURES.rglob("*.yaml"):
                target = root / "specs" / source.relative_to(SOURCE_FIXTURES)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read_bytes())
            (root / "artifact_manifest.json").write_text(json.dumps({
                "artifact_kind": "specgraph_static_artifact_manifest",
                "files": [
                    {"path": specspace_provider.PRODUCT_WORKSPACE_DECISION_ARTIFACT, "sha256": hashlib.sha256(index_bytes).hexdigest()},
                    *[
                        {"path": item["source_ref"], "sha256": item["source_sha256"]}
                        for item in self.payload["decisions"]
                    ],
                ],
            }), encoding="utf-8")
            dialog_dir = Path(tmp) / "dialogs"
            dialog_dir.mkdir()
            http_server = ThreadingHTTPServer(("127.0.0.1", 0), viewer_server.ViewerHandler)
            http_server.repo_root = Path(__file__).resolve().parents[1]
            http_server.dialog_dir = dialog_dir
            http_server.workspace_watcher = viewer_server.WorkspaceWatcher(dialog_dir)
            http_server.spec_dir = root / "specs" / "nodes"
            http_server.specgraph_dir = root
            http_server.runs_dir = root / "runs"
            thread = threading.Thread(target=http_server.serve_forever, daemon=True)
            thread.start()
            try:
                base = f"http://127.0.0.1:{http_server.server_port}"
                with self.assertRaises(HTTPError) as missing_workspace:
                    urlopen(f"{base}/api/v1/product-workspace-decisions", timeout=5)
                self.assertEqual(missing_workspace.exception.code, HTTPStatus.BAD_REQUEST)
                with urlopen(
                    f"{base}/api/v1/product-workspace-decisions?workspace_id=team-decision-log",
                    timeout=5,
                ) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                self.assertTrue(payload["available"])
                self.assertEqual(payload["summary"]["decision_count"], 2)
                self.assertNotEqual(payload["decisions"][0]["id"], payload["decisions"][0]["key"])
            finally:
                http_server.shutdown()
                thread.join(timeout=5)
                http_server.server_close()
