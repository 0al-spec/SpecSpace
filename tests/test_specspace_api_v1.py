import json
import tempfile
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import urlopen

import yaml

from viewer import server, specspace_provider


REPO_ROOT = Path(__file__).resolve().parent.parent

MINIMAL_SPEC = {
    "id": "SG-SPEC-0001",
    "title": "SpecSpace API Boundary",
    "kind": "spec",
    "status": "linked",
    "maturity": 1.0,
    "acceptance": ["API v1 exists"],
    "acceptance_evidence": [{"criterion": "API v1 exists", "evidence": "test"}],
    "inputs": ["specs/nodes/SG-SPEC-0001.yaml"],
    "specification": {"decisions": []},
    "depends_on": [],
    "refines": [],
    "relates_to": [],
}


def _write_yaml(path: Path, data: dict) -> None:
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data), encoding="utf-8")


def _start(
    dialog_dir: Path,
    *,
    spec_dir: Path | None = None,
    runs_dir: Path | None = None,
    specgraph_dir: Path | None = None,
    artifact_base_url: str | None = None,
) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.ViewerHandler)
    httpd.repo_root = REPO_ROOT
    httpd.dialog_dir = dialog_dir
    httpd.hyperprompt_binary = ""
    httpd.compile_available = False
    httpd.spec_dir = spec_dir
    httpd.spec_watcher = server.SpecWatcher(spec_dir) if spec_dir else None
    httpd.specgraph_dir = specgraph_dir
    httpd.runs_dir = runs_dir
    httpd.runs_watcher = server.RunsWatcher(runs_dir) if runs_dir else None
    httpd.artifact_base_url = artifact_base_url
    httpd.agent_available = False
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, thread, f"http://127.0.0.1:{httpd.server_port}"


def _stop(httpd: ThreadingHTTPServer, thread: threading.Thread) -> None:
    httpd.shutdown()
    thread.join()
    httpd.server_close()


def _get(url: str) -> tuple[int, dict]:
    try:
        resp = urlopen(url)
        return resp.status, json.loads(resp.read())
    except HTTPError as exc:
        return exc.code, json.loads(exc.read())


class QuietStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return


def _start_static(root: Path) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    handler = partial(QuietStaticHandler, directory=str(root))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, thread, f"http://127.0.0.1:{httpd.server_port}"


def _write_manifest(root: Path, paths: list[str]) -> None:
    files = []
    for path in paths:
        file_path = root / path
        files.append(
            {
                "path": path,
                "root": path.split("/", 1)[0],
                "sha256": "0" * 64,
                "size_bytes": file_path.stat().st_size,
            }
        )
    _write_json(
        root / "artifact_manifest.json",
        {
            "artifact_kind": "specgraph_static_artifact_manifest",
            "schema_version": 1,
            "generated_at": "2026-05-16T14:15:12Z",
            "files": files,
        },
    )


class SpecSpaceProviderHealthTests(unittest.TestCase):
    def test_directory_health_distinguishes_missing_empty_and_ok(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            missing = root / "missing"
            empty = root / "empty"
            populated = root / "populated"
            empty.mkdir()
            populated.mkdir()
            (populated / "SG-SPEC-0001.yaml").write_text("id: SG-SPEC-0001\n", encoding="utf-8")

            self.assertEqual(
                specspace_provider.inspect_directory_source(
                    name="spec_nodes",
                    path=missing,
                    pattern="*.yaml",
                ).status,
                "missing",
            )
            self.assertEqual(
                specspace_provider.inspect_directory_source(
                    name="spec_nodes",
                    path=empty,
                    pattern="*.yaml",
                ).status,
                "empty",
            )
            ok = specspace_provider.inspect_directory_source(
                name="spec_nodes",
                path=populated,
                pattern="*.yaml",
            )
            self.assertEqual(ok.status, "ok")
            self.assertEqual(ok.item_count, 1)

    def test_directory_health_distinguishes_unreadable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            with mock.patch.object(Path, "glob", side_effect=OSError("permission denied")):
                source = specspace_provider.inspect_directory_source(
                    name="spec_nodes",
                    path=path,
                    pattern="*.yaml",
                )

        self.assertEqual(source.status, "unreadable")
        self.assertIn("permission denied", source.detail or "")

    def test_provider_health_degrades_when_configured_specgraph_root_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            runs_dir = root / "runs"
            spec_dir.mkdir(parents=True)
            runs_dir.mkdir()
            (spec_dir / "SG-SPEC-0001.yaml").write_text("id: SG-SPEC-0001\n", encoding="utf-8")
            (runs_dir / "artifact.json").write_text("{}", encoding="utf-8")
            provider = specspace_provider.FileSpecGraphProvider(
                spec_nodes_dir=spec_dir,
                runs_dir=runs_dir,
                specgraph_dir=root / "missing-specgraph",
            )

            health = provider.health()

        self.assertEqual(health["status"], "degraded")
        self.assertEqual(health["sources"]["specgraph_root"]["status"], "missing")

    def test_safe_manifest_path_rejects_absolute_and_parent_paths(self) -> None:
        self.assertIsNone(specspace_provider.safe_manifest_path("/specs/nodes/SG-SPEC-0001.yaml"))
        self.assertIsNone(specspace_provider.safe_manifest_path("specs/../secret.yaml"))
        self.assertIsNone(specspace_provider.safe_manifest_path("https://example.test/spec.yaml"))
        self.assertEqual(
            specspace_provider.safe_manifest_path("specs/nodes/SG-SPEC-0001.yaml"),
            "specs/nodes/SG-SPEC-0001.yaml",
        )


class SpecSpaceApiV1Tests(unittest.TestCase):
    def test_health_reports_versioned_readonly_provider(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            runs_dir = root / "runs"
            spec_dir.mkdir(parents=True)
            runs_dir.mkdir()
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_json(runs_dir / "artifact.json", {"ok": True})
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir, runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/health")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertTrue(body["read_only"])
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["sources"]["spec_nodes"]["status"], "ok")
        self.assertEqual(body["sources"]["runs"]["status"], "ok")

    def test_spec_graph_v1_returns_existing_graph_contract_with_version_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/v1/spec-graph")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertEqual(body["graph"]["summary"]["node_count"], 1)
        self.assertEqual(body["graph"]["nodes"][0]["node_id"], "SG-SPEC-0001")

    def test_spec_node_v1_uses_path_parameter(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/v1/spec-nodes/{quote('SG-SPEC-0001')}")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertEqual(body["node_id"], "SG-SPEC-0001")
        self.assertEqual(body["data"]["title"], MINIMAL_SPEC["title"])

    def test_recent_runs_v1_reads_explicit_runs_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "mounted-runs"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "20260513T100001Z-SG-SPEC-0001-abcdef1.json",
                {"title": "Recent run"},
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/runs/recent?limit=1")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertEqual(body["events"][0]["title"], "Recent run")

    def test_spec_activity_v1_keeps_runs_envelope_contract(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "spec_activity_feed.json",
                {
                    "artifact_kind": "spec_activity_feed",
                    "entries": [{"occurred_at": "2026-05-13T10:00:00Z"}],
                    "entry_count": 1,
                },
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/spec-activity")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertIn("path", body)
        self.assertIn("mtime_iso", body)
        self.assertEqual(body["data"]["artifact_kind"], "spec_activity_feed")

    def test_specpm_lifecycle_v1_reads_specgraph_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            specgraph_dir = root / "specgraph"
            (specgraph_dir / "runs").mkdir(parents=True)
            httpd, thread, base = _start(root / "dialogs", specgraph_dir=specgraph_dir)
            try:
                status, body = _get(f"{base}/api/v1/specpm/lifecycle")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertEqual(body["package_count"], 0)

    def test_legacy_spec_graph_endpoint_remains_available(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/spec-graph")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertNotIn("api_version", body)
        self.assertEqual(body["graph"]["summary"]["node_count"], 1)

    def test_http_provider_reads_manifest_spec_graph_and_runs_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            spec_dir = artifact_root / "specs" / "nodes"
            runs_dir = artifact_root / "runs"
            spec_dir.mkdir(parents=True)
            runs_dir.mkdir()
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_json(
                runs_dir / "spec_activity_feed.json",
                {
                    "artifact_kind": "spec_activity_feed",
                    "entries": [
                        {"occurred_at": "2026-05-16T14:00:00Z", "title": "new"},
                        {"occurred_at": "2026-05-16T13:00:00Z", "title": "old"},
                    ],
                    "entry_count": 2,
                },
            )
            _write_json(
                runs_dir / "proposal_spec_trace_index.json",
                {"artifact_kind": "proposal_spec_trace_index", "entries": [], "entry_count": 0},
            )
            _write_manifest(
                artifact_root,
                [
                    "specs/nodes/SG-SPEC-0001.yaml",
                    "runs/spec_activity_feed.json",
                    "runs/proposal_spec_trace_index.json",
                ],
            )
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base_url)
            try:
                health_status, health = _get(f"{base}/api/v1/health")
                graph_status, graph = _get(f"{base}/api/v1/spec-graph")
                node_status, node = _get(f"{base}/api/v1/spec-nodes/{quote('SG-SPEC-0001')}")
                activity_status, activity = _get(f"{base}/api/v1/spec-activity?limit=1")
                trace_status, trace = _get(f"{base}/api/v1/proposal-spec-trace-index")
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(health_status, 200)
        self.assertEqual(health["provider"], "http")
        self.assertEqual(health["sources"]["spec_nodes"]["item_count"], 1)
        self.assertEqual(graph_status, 200)
        self.assertEqual(graph["graph"]["summary"]["node_count"], 1)
        self.assertEqual(graph["graph"]["nodes"][0]["node_id"], "SG-SPEC-0001")
        self.assertEqual(node_status, 200)
        self.assertEqual(node["data"]["title"], MINIMAL_SPEC["title"])
        self.assertEqual(activity_status, 200)
        self.assertEqual(activity["data"]["entry_count"], 1)
        self.assertTrue(activity["path"].endswith("/runs/spec_activity_feed.json"))
        self.assertEqual(trace_status, 200)
        self.assertEqual(trace["data"]["artifact_kind"], "proposal_spec_trace_index")

    def test_http_provider_reports_missing_runs_artifact_as_not_found(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            spec_dir = artifact_root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_manifest(artifact_root, ["specs/nodes/SG-SPEC-0001.yaml"])
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base_url)
            try:
                status, body = _get(f"{base}/api/v1/implementation-work-index")
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 404)
        self.assertIn("implementation_work_index.json not found", body["error"])


if __name__ == "__main__":
    unittest.main()
