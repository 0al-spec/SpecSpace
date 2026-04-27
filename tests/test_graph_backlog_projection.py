"""Regression guard for GET /api/graph-backlog-projection — happy path, error cases, shape contract."""

import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

from viewer import server

REPO_ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

MINIMAL_BACKLOG: dict = {
    "artifact_kind": "graph_backlog_projection",
    "schema_version": 1,
    "generated_at": "2026-04-28T10:00:00+00:00",
    "entries": [],
    "summary": {
        "entry_count": 0,
        "priority_counts": {},
        "domain_counts": {},
        "next_gap_counts": {},
    },
}

POPULATED_BACKLOG: dict = {
    "artifact_kind": "graph_backlog_projection",
    "schema_version": 1,
    "generated_at": "2026-04-28T10:00:00+00:00",
    "entries": [
        {
            "subject_id": "SG-SPEC-0042",
            "domain": "observability",
            "priority": "high",
            "next_gap": "missing_trace",
            "source_artifact": "runs/graph_health_overlay.json",
        },
        {
            "subject_id": "SG-SPEC-0051",
            "domain": "metrics",
            "priority": "medium",
            "next_gap": "below_threshold",
            "source_artifact": "runs/metric_signal_index.json",
        },
        {
            "subject_id": "SG-SPEC-0019",
            "domain": "observability",
            "priority": "low",
            "next_gap": "evidence_gap",
            "source_artifact": "runs/graph_health_overlay.json",
        },
    ],
    "summary": {
        "entry_count": 3,
        "priority_counts": {"high": 1, "medium": 1, "low": 1},
        "domain_counts": {"observability": 2, "metrics": 1},
        "next_gap_counts": {"missing_trace": 1, "below_threshold": 1, "evidence_gap": 1},
    },
}


# ---------------------------------------------------------------------------
# Server helpers
# ---------------------------------------------------------------------------


def _make_spec_dir(base: Path, backlog: dict | None = None) -> Path:
    spec_dir = base / "specs" / "nodes"
    spec_dir.mkdir(parents=True)
    runs = base / "runs"
    runs.mkdir(parents=True)
    if backlog is not None:
        (runs / "graph_backlog_projection.json").write_text(
            json.dumps(backlog), encoding="utf-8"
        )
    return spec_dir


def _start(dialog_dir: Path, spec_dir: Path | None) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.ViewerHandler)
    httpd.repo_root = REPO_ROOT
    httpd.dialog_dir = dialog_dir
    httpd.hyperprompt_binary = ""
    httpd.compile_available = False
    httpd.spec_dir = spec_dir
    httpd.spec_watcher = server.SpecWatcher(spec_dir) if spec_dir else None
    httpd.specgraph_dir = None
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
    except HTTPError as e:
        return e.code, json.loads(e.read())


# ---------------------------------------------------------------------------
# Tests: endpoint availability
# ---------------------------------------------------------------------------


class BacklogProjectionEndpointTests(unittest.TestCase):
    def test_404_when_artifact_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))  # no artifact written
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-backlog-projection")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)
        self.assertIn("error", body)

    def test_404_when_spec_dir_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = _start(Path(tmp), spec_dir=None)
            try:
                status, body = _get(f"{base}/api/graph-backlog-projection")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)

    def test_200_happy_path_minimal(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), backlog=MINIMAL_BACKLOG)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-backlog-projection")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(body["artifact_kind"], "graph_backlog_projection")

    def test_200_happy_path_populated(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), backlog=POPULATED_BACKLOG)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-backlog-projection")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(len(body["entries"]), 3)

    def test_422_when_artifact_is_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            (Path(tmp) / "runs" / "graph_backlog_projection.json").write_text(
                "{ not valid json", encoding="utf-8"
            )
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-backlog-projection")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 422)
        self.assertIn("error", body)

    def test_path_traversal_rejected(self) -> None:
        """The endpoint only serves the fixed filename — path traversal must not reach other files."""
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            # Write a sensitive file outside runs/
            (Path(tmp) / "secret.json").write_text('{"secret": true}', encoding="utf-8")
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                # The endpoint ignores any query params and serves a fixed path
                status, body = _get(f"{base}/api/graph-backlog-projection?path=../../secret.json")
            finally:
                _stop(httpd, thread)
        # Must 404 (no artifact at the fixed path), not serve secret.json
        self.assertEqual(status, 404)


# ---------------------------------------------------------------------------
# Tests: shape contract
# ---------------------------------------------------------------------------


class BacklogProjectionShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        spec_dir = _make_spec_dir(tmp, backlog=POPULATED_BACKLOG)
        self._httpd, self._thread, self._base = _start(tmp, spec_dir)
        _, self._body = _get(f"{self._base}/api/graph-backlog-projection")

    def tearDown(self) -> None:
        _stop(self._httpd, self._thread)
        self._tmp.cleanup()

    def test_artifact_kind(self) -> None:
        self.assertEqual(self._body["artifact_kind"], "graph_backlog_projection")

    def test_schema_version_present(self) -> None:
        self.assertIn("schema_version", self._body)

    def test_generated_at_present(self) -> None:
        self.assertIn("generated_at", self._body)

    def test_entries_is_list(self) -> None:
        self.assertIsInstance(self._body["entries"], list)

    def test_summary_present(self) -> None:
        self.assertIn("summary", self._body)

    def test_summary_entry_count(self) -> None:
        self.assertEqual(self._body["summary"]["entry_count"], 3)

    def test_summary_priority_counts_is_dict(self) -> None:
        self.assertIsInstance(self._body["summary"]["priority_counts"], dict)

    def test_summary_domain_counts_is_dict(self) -> None:
        self.assertIsInstance(self._body["summary"]["domain_counts"], dict)

    def test_summary_next_gap_counts_is_dict(self) -> None:
        self.assertIsInstance(self._body["summary"]["next_gap_counts"], dict)

    def test_entry_count_consistent_with_entries(self) -> None:
        self.assertEqual(self._body["summary"]["entry_count"], len(self._body["entries"]))

    def test_each_entry_has_subject_id(self) -> None:
        for entry in self._body["entries"]:
            self.assertIn("subject_id", entry)

    def test_each_entry_has_domain(self) -> None:
        for entry in self._body["entries"]:
            self.assertIn("domain", entry)

    def test_each_entry_has_priority(self) -> None:
        for entry in self._body["entries"]:
            self.assertIn("priority", entry)

    def test_each_entry_has_next_gap(self) -> None:
        for entry in self._body["entries"]:
            self.assertIn("next_gap", entry)

    def test_each_entry_has_source_artifact(self) -> None:
        for entry in self._body["entries"]:
            self.assertIn("source_artifact", entry)

    def test_domain_counts_sum_equals_entry_count(self) -> None:
        total = sum(self._body["summary"]["domain_counts"].values())
        self.assertEqual(total, self._body["summary"]["entry_count"])

    def test_priority_counts_sum_equals_entry_count(self) -> None:
        total = sum(self._body["summary"]["priority_counts"].values())
        self.assertEqual(total, self._body["summary"]["entry_count"])


# ---------------------------------------------------------------------------
# Tests: tolerance to unknown domains/priorities
# ---------------------------------------------------------------------------


class BacklogProjectionToleranceTests(unittest.TestCase):
    def _make_dashboard_with_extra(self) -> dict:
        return {
            **POPULATED_BACKLOG,
            "entries": [
                *POPULATED_BACKLOG["entries"],
                {
                    "subject_id": "SG-SPEC-0099",
                    "domain": "future_unknown_domain",
                    "priority": "future_unknown_priority",
                    "next_gap": "future_unknown_gap",
                    "source_artifact": "runs/future_artifact.json",
                },
            ],
            "summary": {
                "entry_count": 4,
                "priority_counts": {**POPULATED_BACKLOG["summary"]["priority_counts"], "future_unknown_priority": 1},
                "domain_counts": {**POPULATED_BACKLOG["summary"]["domain_counts"], "future_unknown_domain": 1},
                "next_gap_counts": {**POPULATED_BACKLOG["summary"]["next_gap_counts"], "future_unknown_gap": 1},
            },
        }

    def test_unknown_domain_passes_through(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), backlog=self._make_dashboard_with_extra())
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-backlog-projection")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertIn("future_unknown_domain", body["summary"]["domain_counts"])

    def test_unknown_priority_passes_through(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), backlog=self._make_dashboard_with_extra())
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-backlog-projection")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertIn("future_unknown_priority", body["summary"]["priority_counts"])

    def test_empty_entries_serves_successfully(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), backlog=MINIMAL_BACKLOG)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-backlog-projection")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(body["entries"], [])
        self.assertEqual(body["summary"]["entry_count"], 0)


if __name__ == "__main__":
    unittest.main()
