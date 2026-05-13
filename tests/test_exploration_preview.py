"""Tests for exploration preview endpoints: GET /api/exploration-preview and POST /api/exploration-preview/build."""

import json
import subprocess
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from viewer import server

REPO_ROOT = Path(__file__).resolve().parent.parent

VALID_ARTIFACT = {
    "artifact_kind": "exploration_preview",
    "schema_version": 1,
    "mode": "assumption",
    "generated_at": "2026-04-26T06:20:50+00:00",
    "input": {
        "source_kind": "inline_operator_intent",
        "text": "Explore something",
        "text_sha256": "abc123",
        "input_status": "root_intent_provided",
    },
    "review_state": "preview_only",
    "next_gap": "human_review_before_promotion",
    "canonical_mutations_allowed": False,
    "tracked_artifacts_written": False,
    "node_count": 2,
    "edge_count": 1,
    "nodes": [
        {
            "id": "exploration:abc:intent",
            "kind": "intent",
            "label": "Explore something",
            "text": "Explore something",
            "status": "captured",
            "authority": "operator",
            "confidence": "explicit",
            "layer": "intent",
        }
    ],
    "edges": [
        {
            "source": "exploration:abc:intent",
            "target": "exploration:abc:assumptions",
            "edge_kind": "structures_assumptions",
        }
    ],
    "promotion_candidates": [],
}


def start_server(
    dialog_dir: Path, specgraph_dir: Path | None = None
) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.ViewerHandler)
    httpd.repo_root = REPO_ROOT
    httpd.dialog_dir = dialog_dir
    httpd.hyperprompt_binary = ""
    httpd.compile_available = False
    httpd.spec_dir = None
    httpd.spec_watcher = None
    httpd.specgraph_dir = specgraph_dir
    httpd.agent_available = False
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, thread, f"http://127.0.0.1:{httpd.server_port}"


def stop_server(httpd: ThreadingHTTPServer, thread: threading.Thread) -> None:
    httpd.shutdown()
    thread.join()
    httpd.server_close()


def post_json(url: str, payload: dict) -> tuple[int, dict]:
    body = json.dumps(payload).encode()
    req = Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        resp = urlopen(req)
        return resp.status, json.loads(resp.read())
    except HTTPError as e:
        return e.code, json.loads(e.read())


def post_raw(url: str, body: bytes) -> tuple[int, dict]:
    req = Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        resp = urlopen(req)
        return resp.status, json.loads(resp.read())
    except HTTPError as e:
        return e.code, json.loads(e.read())


def get_json(url: str) -> tuple[int, dict]:
    try:
        resp = urlopen(url)
        return resp.status, json.loads(resp.read())
    except HTTPError as e:
        return e.code, json.loads(e.read())


class ExplorationPreviewGetTests(unittest.TestCase):
    def test_503_when_no_specgraph_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=None)
            try:
                status, body = get_json(f"{base}/api/exploration-preview")
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 503)
        self.assertIn("error", body)

    def test_404_when_artifact_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            sg_dir.mkdir()
            (sg_dir / "runs").mkdir()
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status, body = get_json(f"{base}/api/exploration-preview")
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 404)
        self.assertIn("hint", body)

    def test_422_when_artifact_is_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            runs = sg_dir / "runs"
            runs.mkdir(parents=True)
            (runs / "exploration_preview.json").write_text("not json", encoding="utf-8")
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status, body = get_json(f"{base}/api/exploration-preview")
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 422)

    def test_422_when_boundary_check_fails(self) -> None:
        bad_artifact = dict(VALID_ARTIFACT, canonical_mutations_allowed=True)
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            runs = sg_dir / "runs"
            runs.mkdir(parents=True)
            (runs / "exploration_preview.json").write_text(
                json.dumps(bad_artifact), encoding="utf-8"
            )
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status, body = get_json(f"{base}/api/exploration-preview")
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 422)
        self.assertIn("boundary check", body["error"])

    def test_200_happy_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            runs = sg_dir / "runs"
            runs.mkdir(parents=True)
            (runs / "exploration_preview.json").write_text(
                json.dumps(VALID_ARTIFACT), encoding="utf-8"
            )
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status, body = get_json(f"{base}/api/exploration-preview")
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 200)
        self.assertIn("data", body)
        self.assertIn("mtime", body)
        self.assertIn("mtime_iso", body)
        self.assertEqual(body["data"]["artifact_kind"], "exploration_preview")


class ExplorationPreviewBuildTests(unittest.TestCase):
    def test_503_when_no_specgraph_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=None)
            try:
                status, body = post_json(
                    f"{base}/api/exploration-preview/build", {"intent": "Test intent"}
                )
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 503)

    def test_400_on_blank_intent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            sg_dir.mkdir()
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status_empty, _ = post_json(
                    f"{base}/api/exploration-preview/build", {"intent": ""}
                )
                status_missing, _ = post_json(f"{base}/api/exploration-preview/build", {})
                status_whitespace, _ = post_json(
                    f"{base}/api/exploration-preview/build", {"intent": "   "}
                )
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status_empty, 400)
        self.assertEqual(status_missing, 400)
        self.assertEqual(status_whitespace, 400)

    def test_400_on_non_object_body(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            sg_dir.mkdir()
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status, body = post_raw(f"{base}/api/exploration-preview/build", b"[]")
            finally:
                stop_server(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "Invalid JSON body")

    def test_422_when_supervisor_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            sg_dir.mkdir()
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status, body = post_json(
                    f"{base}/api/exploration-preview/build", {"intent": "Test intent"}
                )
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 422)
        self.assertIn("supervisor.py not found", body["error"])

    def test_422_when_supervisor_exits_nonzero(self) -> None:
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "some error"
        mock_result.stdout = ""
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            tools = sg_dir / "tools"
            tools.mkdir(parents=True)
            (tools / "supervisor.py").write_text("# stub", encoding="utf-8")
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                with patch("subprocess.run", return_value=mock_result):
                    status, body = post_json(
                        f"{base}/api/exploration-preview/build", {"intent": "Test intent"}
                    )
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 422)
        self.assertIn("exit_code", body)
        self.assertEqual(body["exit_code"], 1)

    def test_500_on_timeout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            tools = sg_dir / "tools"
            tools.mkdir(parents=True)
            (tools / "supervisor.py").write_text("# stub", encoding="utf-8")
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="x", timeout=60)):
                    status, body = post_json(
                        f"{base}/api/exploration-preview/build", {"intent": "Test intent"}
                    )
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 500)
        self.assertIn("timed out", body["error"])

    def test_no_shell_injection(self) -> None:
        """supervisor is invoked with a list, not a shell string — verifies no shell=True."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stderr = ""
        mock_result.stdout = ""
        captured: list[list[str]] = []

        def fake_run(cmd, **kwargs):
            captured.append(cmd)
            self.assertFalse(kwargs.get("shell", False), "shell=True must never be used")
            return mock_result

        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            tools = sg_dir / "tools"
            tools.mkdir(parents=True)
            (tools / "supervisor.py").write_text("# stub", encoding="utf-8")
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                with patch("subprocess.run", side_effect=fake_run):
                    post_json(
                        f"{base}/api/exploration-preview/build",
                        {"intent": "Explore $(evil)"},
                    )
            finally:
                stop_server(httpd, thread)
        self.assertEqual(len(captured), 1)
        cmd = captured[0]
        self.assertIsInstance(cmd, list)
        self.assertIn("--build-exploration-preview", cmd)
        self.assertIn("--exploration-intent", cmd)
        self.assertEqual(cmd[-1], "Explore $(evil)")

    def test_200_happy_path(self) -> None:
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stderr = ""
        mock_result.stdout = ""
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            tools = sg_dir / "tools"
            runs = sg_dir / "runs"
            tools.mkdir(parents=True)
            runs.mkdir(parents=True)
            (tools / "supervisor.py").write_text("# stub", encoding="utf-8")
            (runs / "exploration_preview.json").write_text(
                json.dumps(VALID_ARTIFACT), encoding="utf-8"
            )
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                with patch("subprocess.run", return_value=mock_result):
                    status, body = post_json(
                        f"{base}/api/exploration-preview/build", {"intent": "Explore something"}
                    )
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(body["exit_code"], 0)
        self.assertTrue(body["artifact_exists"])
        self.assertIn("built_at", body)


class ExplorationCapabilityTests(unittest.TestCase):
    def test_exploration_preview_build_false_when_supervisor_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            sg_dir.mkdir()
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status, body = get_json(f"{base}/api/capabilities")
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 200)
        self.assertFalse(body["exploration_preview_build"])

    def test_exploration_preview_build_false_when_flags_absent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            tools = sg_dir / "tools"
            tools.mkdir(parents=True)
            (tools / "supervisor.py").write_text("# no flags here", encoding="utf-8")
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status, body = get_json(f"{base}/api/capabilities")
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 200)
        self.assertFalse(body["exploration_preview_build"])

    def test_exploration_preview_build_true_when_flags_present(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            tools = sg_dir / "tools"
            tools.mkdir(parents=True)
            (tools / "supervisor.py").write_text(
                'parser.add_argument("--build-exploration-preview")\n'
                'parser.add_argument("--exploration-intent")\n',
                encoding="utf-8",
            )
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                status, body = get_json(f"{base}/api/capabilities")
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 200)
        self.assertTrue(body["exploration_preview_build"])

    def test_exploration_preview_false_when_no_specgraph_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=None)
            try:
                status, body = get_json(f"{base}/api/capabilities")
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 200)
        self.assertFalse(body["exploration_preview"])
        self.assertFalse(body["exploration_preview_build"])


class ExplorationBuildPostValidationTests(unittest.TestCase):
    def _make_supervisor(self, sg_dir: Path) -> None:
        tools = sg_dir / "tools"
        tools.mkdir(parents=True)
        (tools / "supervisor.py").write_text("# stub", encoding="utf-8")

    def test_422_when_built_artifact_fails_boundary_check(self) -> None:
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stderr = ""
        mock_result.stdout = ""
        bad_artifact = dict(VALID_ARTIFACT, canonical_mutations_allowed=True)
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            runs = sg_dir / "runs"
            runs.mkdir(parents=True)
            self._make_supervisor(sg_dir)
            (runs / "exploration_preview.json").write_text(
                json.dumps(bad_artifact), encoding="utf-8"
            )
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                with patch("subprocess.run", return_value=mock_result):
                    status, body = post_json(
                        f"{base}/api/exploration-preview/build", {"intent": "Test"}
                    )
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 422)
        self.assertIn("boundary check", body["error"])

    def test_422_when_built_artifact_wrong_kind(self) -> None:
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stderr = ""
        mock_result.stdout = ""
        wrong_kind = dict(VALID_ARTIFACT, artifact_kind="something_else")
        with tempfile.TemporaryDirectory() as tmp:
            sg_dir = Path(tmp) / "specgraph"
            runs = sg_dir / "runs"
            runs.mkdir(parents=True)
            self._make_supervisor(sg_dir)
            (runs / "exploration_preview.json").write_text(
                json.dumps(wrong_kind), encoding="utf-8"
            )
            httpd, thread, base = start_server(Path(tmp), specgraph_dir=sg_dir)
            try:
                with patch("subprocess.run", return_value=mock_result):
                    status, body = post_json(
                        f"{base}/api/exploration-preview/build", {"intent": "Test"}
                    )
            finally:
                stop_server(httpd, thread)
        self.assertEqual(status, 422)
        self.assertIn("boundary check", body["error"])


if __name__ == "__main__":
    unittest.main()
