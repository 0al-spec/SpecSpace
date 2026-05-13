import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError
from urllib.request import urlopen

from viewer import specgraph_surfaces
from viewer import server


REPO_ROOT = Path(__file__).resolve().parent.parent


def _start(
    dialog_dir: Path,
    *,
    spec_dir: Path | None = None,
    specgraph_dir: Path | None = None,
) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.ViewerHandler)
    httpd.repo_root = REPO_ROOT
    httpd.dialog_dir = dialog_dir
    httpd.hyperprompt_binary = ""
    httpd.compile_available = False
    httpd.spec_dir = spec_dir
    httpd.spec_watcher = server.SpecWatcher(spec_dir) if spec_dir else None
    httpd.specgraph_dir = specgraph_dir
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


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data), encoding="utf-8")


class RecentRunsReadModelTests(unittest.TestCase):
    def test_decodes_json_string_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "20260513T100001Z-SG-SPEC-0001-abcdef1.json"
            _write_json(
                path,
                {
                    "title": 'Spec "quoted" title',
                    "run_kind": "refine",
                    "completion_status": "clean",
                    "execution_profile": "review",
                    "child_model": "gpt-test",
                    "run_duration_sec": 1.25,
                },
            )

            meta = specgraph_surfaces.harvest_run_meta(path)

        self.assertEqual(meta["title"], 'Spec "quoted" title')
        self.assertEqual(meta["run_kind"], "refine")
        self.assertEqual(meta["completion_status"], "clean")
        self.assertEqual(meta["execution_profile"], "review")
        self.assertEqual(meta["child_model"], "gpt-test")
        self.assertEqual(meta["duration_sec"], 1.25)

    def test_limits_before_harvesting_metadata_and_uses_stable_tie_breaker(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            runs = Path(tmp)
            oldest = runs / "20260513T095959Z-SG-SPEC-0009-aaaaaaa.json"
            first_same_second = runs / "20260513T100001Z-SG-SPEC-0001-bbbbbbb.json"
            second_same_second = runs / "20260513T100001Z-SG-SPEC-0002-ccccccc.json"
            for path in (oldest, first_same_second, second_same_second):
                _write_json(path, {"title": path.stem})

            harvested: list[str] = []

            def fake_harvest(path: Path) -> dict:
                harvested.append(path.name)
                return {"title": path.stem}

            with mock.patch.object(specgraph_surfaces, "harvest_run_meta", side_effect=fake_harvest):
                payload = specgraph_surfaces.collect_recent_runs(runs, limit=2, since_iso=None)

        self.assertEqual(
            [event["run_id"] for event in payload["events"]],
            [second_same_second.stem, first_same_second.stem],
        )
        self.assertEqual(harvested, [second_same_second.name, first_same_second.name])


class SpecGraphDirOnlySurfaceTests(unittest.TestCase):
    def test_recent_runs_available_with_specgraph_dir_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs = root / "runs"
            runs.mkdir()
            _write_json(runs / "20260513T100001Z-SG-SPEC-0001-abcdef1.json", {"title": "Recent"})
            httpd, thread, base = _start(root, specgraph_dir=root)
            try:
                status, body = _get(f"{base}/api/recent-runs?limit=1")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["events"][0]["title"], "Recent")

    def test_graph_dashboard_available_with_specgraph_dir_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs = root / "runs"
            runs.mkdir()
            _write_json(runs / "graph_dashboard.json", {"artifact_kind": "graph_dashboard", "title": "Graph"})
            httpd, thread, base = _start(root, specgraph_dir=root)
            try:
                status, body = _get(f"{base}/api/graph-dashboard")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["title"], "Graph")

    def test_runs_artifact_available_with_specgraph_dir_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs = root / "runs"
            runs.mkdir()
            _write_json(runs / "metric_signal_index.json", {"artifact_kind": "metric_signal_index"})
            httpd, thread, base = _start(root, specgraph_dir=root)
            try:
                status, body = _get(f"{base}/api/metric-signals")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["artifact_kind"], "metric_signal_index")

    def test_spec_activity_available_with_specgraph_dir_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs = root / "runs"
            runs.mkdir()
            _write_json(
                runs / "spec_activity_feed.json",
                {
                    "artifact_kind": "spec_activity_feed",
                    "entries": [{"occurred_at": "2026-05-13T10:00:00Z"}],
                    "entry_count": 1,
                },
            )
            httpd, thread, base = _start(root, specgraph_dir=root)
            try:
                status, body = _get(f"{base}/api/spec-activity")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["artifact_kind"], "spec_activity_feed")

    def test_bad_optional_overlay_returns_422(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs = root / "runs"
            runs.mkdir()
            (runs / "graph_health_overlay.json").write_text("{not json", encoding="utf-8")
            httpd, thread, base = _start(root, specgraph_dir=root)
            try:
                status, body = _get(f"{base}/api/spec-overlay")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertIn("graph_health_overlay.json", body["error"])


if __name__ == "__main__":
    unittest.main()
