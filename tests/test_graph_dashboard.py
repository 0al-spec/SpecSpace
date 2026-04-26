"""Regression guard for GET /api/graph-dashboard — shape, retrospective surface, and named-filter contract."""

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

MINIMAL_DASHBOARD: dict = {
    "artifact_kind": "graph_dashboard",
    "schema_version": 1,
    "generated_at": "2026-04-26T12:00:00+00:00",
    "source_artifacts": {
        "refactor_queue": {"artifact_path": "runs/refactor_queue.json", "entry_count": 0},
        "proposal_queue": {"artifact_path": "runs/proposal_queue.json", "entry_count": 0},
    },
    "headline_cards": [
        {
            "card_id": "total_specs",
            "title": "Total Specs",
            "value": 10,
            "value_kind": "count",
            "section": "graph",
            "status": "info",
            "basis": "All canonical spec nodes.",
        },
        {
            "card_id": "retrospective_refactor_candidates",
            "title": "Retrospective Refactor Candidates",
            "value": 0,
            "value_kind": "count",
            "section": "health",
            "status": "healthy",
            "basis": "Specs via retrospective signals, refactor_queue, or proposal_queue.",
        },
    ],
    "sections": {
        "graph": {
            "total_spec_count": 10,
            "active_spec_count": 8,
            "historical_spec_count": 2,
            "gate_state_counts": {},
        },
        "health": {
            "signal_counts": {},
            "recommended_action_counts": {},
            "named_filter_counts": {},
            "trend_named_filter_counts": {},
            "structural_pressure_spec_ids": [],
            "hotspot_region_count": 0,
        },
        "proposals": {
            "refactor_queue_entry_count": 0,
            "refactor_queue_active_count": 0,
            "proposal_queue_entry_count": 0,
            "proposal_queue_active_count": 0,
            "retrospective_refactor_queue_count": 0,
            "retrospective_refactor_proposal_count": 0,
            "retrospective_refactor_queue_ids": [],
            "retrospective_refactor_proposal_ids": [],
            "proposal_runtime_entry_count": 5,
            "proposal_runtime_backlog_count": 2,
            "proposal_promotion_traceability_counts": {"bounded": 1, "missing_trace": 4},
            "proposal_lane_active_count": 0,
        },
    },
    "viewer_projection": {
        "named_filters": {
            "retrospective_refactor_candidates": 0,
            "gated_specs": 0,
            "structural_pressure_specs": 0,
        },
    },
}

# Non-empty retrospective set — simulates a graph with active refactor/proposal items.
RETROSPECTIVE_DASHBOARD: dict = {
    **MINIMAL_DASHBOARD,
    "headline_cards": [
        {
            "card_id": "total_specs",
            "title": "Total Specs",
            "value": 20,
            "value_kind": "count",
            "section": "graph",
            "status": "info",
            "basis": "All canonical spec nodes.",
        },
        {
            "card_id": "retrospective_refactor_candidates",
            "title": "Retrospective Refactor Candidates",
            "value": 3,
            "value_kind": "count",
            "section": "health",
            "status": "attention",
            "basis": "Specs via retrospective signals, refactor_queue, or proposal_queue.",
        },
        {
            "card_id": "structural_pressure_specs",
            "title": "Structural Pressure Specs",
            "value": 2,
            "value_kind": "count",
            "section": "health",
            "status": "attention",
            "basis": "Specs with active health signals.",
        },
    ],
    "source_artifacts": {
        "refactor_queue": {"artifact_path": "runs/refactor_queue.json", "entry_count": 2},
        "proposal_queue": {"artifact_path": "runs/proposal_queue.json", "entry_count": 1},
    },
    "sections": {
        **MINIMAL_DASHBOARD["sections"],
        "proposals": {
            "refactor_queue_entry_count": 2,
            "refactor_queue_active_count": 2,
            "proposal_queue_entry_count": 1,
            "proposal_queue_active_count": 1,
            "retrospective_refactor_queue_count": 2,
            "retrospective_refactor_proposal_count": 1,
            "retrospective_refactor_queue_ids": ["SG-SPEC-0042", "SG-SPEC-0051"],
            "retrospective_refactor_proposal_ids": ["SG-SPEC-0019"],
            "proposal_runtime_entry_count": 10,
            "proposal_runtime_backlog_count": 4,
            "proposal_promotion_traceability_counts": {"bounded": 3, "missing_trace": 7},
            "proposal_lane_active_count": 1,
        },
    },
    "viewer_projection": {
        "named_filters": {
            "retrospective_refactor_candidates": 3,
            "gated_specs": 0,
            "structural_pressure_specs": 2,
        },
    },
}

# ---------------------------------------------------------------------------
# Server helpers (same pattern as test_specgraph.py)
# ---------------------------------------------------------------------------


def _make_spec_dir(base: Path, dashboard: dict | None = None) -> Path:
    """Create a minimal spec dir layout with runs/graph_dashboard.json."""
    spec_dir = base / "specs" / "nodes"
    spec_dir.mkdir(parents=True)
    runs = base / "runs"
    runs.mkdir(parents=True)
    if dashboard is not None:
        (runs / "graph_dashboard.json").write_text(
            json.dumps(dashboard), encoding="utf-8"
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


class GraphDashboardEndpointTests(unittest.TestCase):
    def test_404_when_artifact_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))  # no dashboard written
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-dashboard")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)
        self.assertIn("error", body)

    def test_404_when_spec_dir_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = _start(Path(tmp), spec_dir=None)
            try:
                status, body = _get(f"{base}/api/graph-dashboard")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)

    def test_200_happy_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), dashboard=MINIMAL_DASHBOARD)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-dashboard")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(body["artifact_kind"], "graph_dashboard")


# ---------------------------------------------------------------------------
# Tests: shape contract — required top-level fields
# ---------------------------------------------------------------------------


class GraphDashboardShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        spec_dir = _make_spec_dir(tmp, dashboard=MINIMAL_DASHBOARD)
        self._httpd, self._thread, self._base = _start(tmp, spec_dir)
        _, self._body = _get(f"{self._base}/api/graph-dashboard")

    def tearDown(self) -> None:
        _stop(self._httpd, self._thread)
        self._tmp.cleanup()

    def test_artifact_kind(self) -> None:
        self.assertEqual(self._body["artifact_kind"], "graph_dashboard")

    def test_schema_version_present(self) -> None:
        self.assertIn("schema_version", self._body)

    def test_generated_at_present(self) -> None:
        self.assertIn("generated_at", self._body)

    def test_headline_cards_is_list(self) -> None:
        self.assertIsInstance(self._body["headline_cards"], list)

    def test_sections_present(self) -> None:
        self.assertIn("sections", self._body)

    def test_viewer_projection_present(self) -> None:
        self.assertIn("viewer_projection", self._body)


# ---------------------------------------------------------------------------
# Tests: retrospective surface — zero state (minimal fixture)
# ---------------------------------------------------------------------------


class GraphDashboardRetrospectiveZeroTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        spec_dir = _make_spec_dir(tmp, dashboard=MINIMAL_DASHBOARD)
        self._httpd, self._thread, self._base = _start(tmp, spec_dir)
        _, self._body = _get(f"{self._base}/api/graph-dashboard")
        self._proposals = self._body["sections"]["proposals"]
        self._named_filters = self._body["viewer_projection"]["named_filters"]
        self._headline_ids = {c["card_id"]: c for c in self._body["headline_cards"]}

    def tearDown(self) -> None:
        _stop(self._httpd, self._thread)
        self._tmp.cleanup()

    # headline card
    def test_retrospective_refactor_candidates_headline_present(self) -> None:
        self.assertIn("retrospective_refactor_candidates", self._headline_ids)

    def test_retrospective_refactor_candidates_headline_value_kind(self) -> None:
        card = self._headline_ids["retrospective_refactor_candidates"]
        self.assertEqual(card["value_kind"], "count")

    def test_retrospective_refactor_candidates_headline_zero(self) -> None:
        self.assertEqual(self._headline_ids["retrospective_refactor_candidates"]["value"], 0)

    # named filter
    def test_named_filter_retrospective_refactor_candidates_present(self) -> None:
        self.assertIn("retrospective_refactor_candidates", self._named_filters)

    def test_named_filter_retrospective_refactor_candidates_zero(self) -> None:
        self.assertEqual(self._named_filters["retrospective_refactor_candidates"], 0)

    # sections.proposals — queue counts
    def test_refactor_queue_entry_count_present(self) -> None:
        self.assertIn("refactor_queue_entry_count", self._proposals)

    def test_refactor_queue_active_count_present(self) -> None:
        self.assertIn("refactor_queue_active_count", self._proposals)

    def test_proposal_queue_entry_count_present(self) -> None:
        self.assertIn("proposal_queue_entry_count", self._proposals)

    def test_proposal_queue_active_count_present(self) -> None:
        self.assertIn("proposal_queue_active_count", self._proposals)

    # sections.proposals — retrospective aggregate counts
    def test_retrospective_refactor_queue_count_present(self) -> None:
        self.assertIn("retrospective_refactor_queue_count", self._proposals)

    def test_retrospective_refactor_proposal_count_present(self) -> None:
        self.assertIn("retrospective_refactor_proposal_count", self._proposals)

    # sections.proposals — id lists
    def test_retrospective_refactor_queue_ids_is_list(self) -> None:
        self.assertIsInstance(self._proposals["retrospective_refactor_queue_ids"], list)

    def test_retrospective_refactor_proposal_ids_is_list(self) -> None:
        self.assertIsInstance(self._proposals["retrospective_refactor_proposal_ids"], list)

    # source_artifacts counts
    def test_source_artifacts_refactor_queue_entry_count(self) -> None:
        sa = self._body.get("source_artifacts", {})
        rq = sa.get("refactor_queue", {})
        self.assertIn("entry_count", rq)

    def test_source_artifacts_proposal_queue_entry_count(self) -> None:
        sa = self._body.get("source_artifacts", {})
        pq = sa.get("proposal_queue", {})
        self.assertIn("entry_count", pq)


# ---------------------------------------------------------------------------
# Tests: retrospective surface — non-empty state (active fixture)
# ---------------------------------------------------------------------------


class GraphDashboardRetrospectiveActiveTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        spec_dir = _make_spec_dir(tmp, dashboard=RETROSPECTIVE_DASHBOARD)
        self._httpd, self._thread, self._base = _start(tmp, spec_dir)
        _, self._body = _get(f"{self._base}/api/graph-dashboard")
        self._proposals = self._body["sections"]["proposals"]
        self._named_filters = self._body["viewer_projection"]["named_filters"]
        self._headline_ids = {c["card_id"]: c for c in self._body["headline_cards"]}
        self._source = self._body.get("source_artifacts", {})

    def tearDown(self) -> None:
        _stop(self._httpd, self._thread)
        self._tmp.cleanup()

    def test_retrospective_headline_value_nonzero(self) -> None:
        self.assertGreater(self._headline_ids["retrospective_refactor_candidates"]["value"], 0)

    def test_retrospective_headline_status_attention(self) -> None:
        self.assertEqual(self._headline_ids["retrospective_refactor_candidates"]["status"], "attention")

    def test_named_filter_nonzero(self) -> None:
        self.assertGreater(self._named_filters["retrospective_refactor_candidates"], 0)

    def test_refactor_queue_active_nonzero(self) -> None:
        self.assertGreater(self._proposals["refactor_queue_active_count"], 0)

    def test_proposal_queue_active_nonzero(self) -> None:
        self.assertGreater(self._proposals["proposal_queue_active_count"], 0)

    def test_retrospective_queue_ids_populated(self) -> None:
        ids = self._proposals["retrospective_refactor_queue_ids"]
        self.assertIsInstance(ids, list)
        self.assertGreater(len(ids), 0)
        # All IDs must be strings
        for item in ids:
            self.assertIsInstance(item, str)

    def test_retrospective_proposal_ids_populated(self) -> None:
        ids = self._proposals["retrospective_refactor_proposal_ids"]
        self.assertIsInstance(ids, list)
        self.assertGreater(len(ids), 0)

    def test_source_artifacts_refactor_queue_entry_count_nonzero(self) -> None:
        self.assertGreater(self._source["refactor_queue"]["entry_count"], 0)

    def test_source_artifacts_proposal_queue_entry_count_nonzero(self) -> None:
        self.assertGreater(self._source["proposal_queue"]["entry_count"], 0)

    def test_retrospective_counts_consistent_with_ids(self) -> None:
        """Queue count must match the length of the id list."""
        queue_count = self._proposals["retrospective_refactor_queue_count"]
        queue_ids = self._proposals["retrospective_refactor_queue_ids"]
        self.assertEqual(queue_count, len(queue_ids))

    def test_retrospective_proposal_counts_consistent_with_ids(self) -> None:
        proposal_count = self._proposals["retrospective_refactor_proposal_count"]
        proposal_ids = self._proposals["retrospective_refactor_proposal_ids"]
        self.assertEqual(proposal_count, len(proposal_ids))


if __name__ == "__main__":
    unittest.main()
