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


# ---------------------------------------------------------------------------
# Fixtures: metrics section with canonical/alias metric shape
# ---------------------------------------------------------------------------

METRICS_SECTION: dict = {
    "metric_count": 4,
    "metric_status_counts": {"healthy": 1, "below_threshold": 3},
    "metric_scores": {
        "sib": {
            "score": 0.62,
            "minimum_score": 0.75,
            "status": "below_threshold",
            "threshold_gap": 0.13,
        },
        "sib_proxy": {
            "score": 0.62,
            "minimum_score": 0.75,
            "status": "below_threshold",
            "threshold_gap": 0.13,
        },
        "process_observability": {
            "score": 0.50,
            "minimum_score": 0.80,
            "status": "below_threshold",
            "threshold_gap": 0.30,
        },
        "specification_verifiability": {
            "score": 0.90,
            "minimum_score": 0.75,
            "status": "healthy",
            "threshold_gap": 0.0,
        },
    },
    "below_threshold_metric_ids": ["sib", "sib_proxy", "process_observability"],
    "below_threshold_authoritative_metric_ids": ["sib", "process_observability"],
    "threshold_proposal_entry_count": 2,
    "threshold_proposal_kind_counts": {"threshold_driven": 2},
    "threshold_proposal_severity_counts": {"high": 1, "medium": 1},
}

METRICS_DASHBOARD: dict = {
    **MINIMAL_DASHBOARD,
    "sections": {
        **MINIMAL_DASHBOARD["sections"],
        "metrics": METRICS_SECTION,
    },
    "viewer_projection": {
        "named_filters": {
            **MINIMAL_DASHBOARD["viewer_projection"]["named_filters"],
            "below_threshold_metrics": 2,
            "threshold_driven": 2,
        }
    },
}

# External consumers fixture with all known delivery/feedback/promotion statuses.
EXTERNAL_CONSUMERS_SECTION: dict = {
    "entry_count": 5,
    "available_count": 3,
    "bridge_state_counts": {"available": 3, "unavailable": 2},
    "metric_pressure_counts": {"high": 1, "low": 4},
    "named_filter_counts": {"available_consumers": 3},
    "handoff_status_counts": {"delivered": 2, "pending": 1},
    "handoff_review_state_counts": {"approved": 2, "pending_review": 1},
    "specpm_feedback_status_counts": {"open": 1, "resolved": 0},
    "specpm_feedback_review_state_counts": {"pending_review": 1},
    "specpm_feedback_named_filter_counts": {"open_feedback": 1},
    # delivery statuses named in the contract
    "metrics_delivery_status_counts": {
        "ready_for_delivery_review": 1,
        "blocked_by_repo_state": 1,
        "review_activity_observed": 0,
        "adoption_observed_locally": 0,
    },
    "metrics_delivery_review_state_counts": {"pending_review": 1, "approved": 1},
    "metrics_delivery_named_filter_counts": {"ready_for_delivery_review": 1},
    # feedback statuses
    "metrics_feedback_status_counts": {
        "review_activity_observed": 1,
        "adoption_observed_locally": 0,
    },
    "metrics_feedback_review_state_counts": {"pending_review": 1},
    "metrics_feedback_named_filter_counts": {"review_activity_observed": 1},
    # source promotion statuses named in the contract
    "metrics_source_promotion_status_counts": {
        "ready_for_promotion_review": 1,
        "promotion_candidate": 1,
    },
    "metrics_source_promotion_authority_counts": {"alias_only": 1, "canonical_threshold_authority": 0},
    "metrics_source_promotion_named_filter_counts": {
        "ready_for_promotion_review": 1,
        "promotion_candidate": 1,
    },
    "external_consumer_backlog_count": 1,
    "handoff_backlog_count": 0,
    "specpm_feedback_entry_count": 1,
    "specpm_feedback_backlog_count": 0,
    "metrics_delivery_entry_count": 2,
    "metrics_delivery_backlog_count": 1,
    "metrics_feedback_entry_count": 1,
    "metrics_feedback_backlog_count": 0,
    "metrics_source_promotion_entry_count": 2,
    "metrics_source_promotion_backlog_count": 1,
}

EXTERNAL_CONSUMERS_DASHBOARD: dict = {
    **MINIMAL_DASHBOARD,
    "headline_cards": [
        *MINIMAL_DASHBOARD["headline_cards"],
        {
            "card_id": "metrics_delivery_ready",
            "title": "Metrics Delivery Ready",
            "value": 1,
            "value_kind": "count",
            "section": "external_consumers",
            "status": "attention",
            "basis": "Metrics ready for delivery review.",
        },
    ],
    "sections": {
        **MINIMAL_DASHBOARD["sections"],
        "external_consumers": EXTERNAL_CONSUMERS_SECTION,
    },
    "viewer_projection": {
        "named_filters": {
            **MINIMAL_DASHBOARD["viewer_projection"]["named_filters"],
            "metrics_delivery_ready": 1,
            "ready_for_promotion_review": 1,
            "promotion_candidate": 1,
        }
    },
}


# ---------------------------------------------------------------------------
# Tests: Canonical Metrics section — shape and alias/canonical separation
# ---------------------------------------------------------------------------


class GraphDashboardMetricsShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        spec_dir = _make_spec_dir(tmp, dashboard=METRICS_DASHBOARD)
        self._httpd, self._thread, self._base = _start(tmp, spec_dir)
        _, self._body = _get(f"{self._base}/api/graph-dashboard")
        self._metrics = self._body["sections"]["metrics"]

    def tearDown(self) -> None:
        _stop(self._httpd, self._thread)
        self._tmp.cleanup()

    def test_metrics_section_present(self) -> None:
        self.assertIn("metrics", self._body["sections"])

    def test_metric_count_present(self) -> None:
        self.assertIn("metric_count", self._metrics)

    def test_metric_status_counts_is_dict(self) -> None:
        self.assertIsInstance(self._metrics["metric_status_counts"], dict)

    def test_metric_scores_is_dict(self) -> None:
        self.assertIsInstance(self._metrics["metric_scores"], dict)

    def test_below_threshold_metric_ids_is_list(self) -> None:
        self.assertIsInstance(self._metrics["below_threshold_metric_ids"], list)

    def test_below_threshold_authoritative_metric_ids_is_list(self) -> None:
        auth = self._metrics.get("below_threshold_authoritative_metric_ids")
        self.assertIsInstance(auth, list)

    def test_authoritative_count_lte_total_below_threshold(self) -> None:
        total = self._metrics["below_threshold_metric_ids"]
        auth = self._metrics.get("below_threshold_authoritative_metric_ids", total)
        self.assertLessEqual(len(auth), len(total))

    def test_sib_proxy_in_total_not_authoritative(self) -> None:
        total = self._metrics["below_threshold_metric_ids"]
        auth = self._metrics.get("below_threshold_authoritative_metric_ids", total)
        self.assertIn("sib_proxy", total)
        self.assertNotIn("sib_proxy", auth)

    def test_sib_in_both_total_and_authoritative(self) -> None:
        total = self._metrics["below_threshold_metric_ids"]
        auth = self._metrics.get("below_threshold_authoritative_metric_ids", total)
        self.assertIn("sib", total)
        self.assertIn("sib", auth)

    def test_each_metric_score_has_required_keys(self) -> None:
        for metric_id, score in self._metrics["metric_scores"].items():
            with self.subTest(metric=metric_id):
                self.assertIn("score", score)
                self.assertIn("minimum_score", score)
                self.assertIn("status", score)
                self.assertIn("threshold_gap", score)

    def test_threshold_proposal_entry_count_present(self) -> None:
        self.assertIn("threshold_proposal_entry_count", self._metrics)

    def test_threshold_proposal_kind_counts_contains_threshold_driven(self) -> None:
        kinds = self._metrics.get("threshold_proposal_kind_counts", {})
        self.assertIn("threshold_driven", kinds)

    def test_threshold_proposal_severity_counts_is_dict(self) -> None:
        sev = self._metrics.get("threshold_proposal_severity_counts", {})
        self.assertIsInstance(sev, dict)

    def test_named_filter_below_threshold_metrics_present(self) -> None:
        nf = self._body["viewer_projection"]["named_filters"]
        self.assertIn("below_threshold_metrics", nf)


# ---------------------------------------------------------------------------
# Tests: External Consumers section — named status contract + tolerance
# ---------------------------------------------------------------------------


class GraphDashboardExternalConsumersShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        spec_dir = _make_spec_dir(tmp, dashboard=EXTERNAL_CONSUMERS_DASHBOARD)
        self._httpd, self._thread, self._base = _start(tmp, spec_dir)
        _, self._body = _get(f"{self._base}/api/graph-dashboard")
        self._ec = self._body["sections"]["external_consumers"]

    def tearDown(self) -> None:
        _stop(self._httpd, self._thread)
        self._tmp.cleanup()

    def test_external_consumers_section_present(self) -> None:
        self.assertIn("external_consumers", self._body["sections"])

    def test_metrics_delivery_status_counts_is_dict(self) -> None:
        self.assertIsInstance(self._ec["metrics_delivery_status_counts"], dict)

    def test_metrics_feedback_status_counts_is_dict(self) -> None:
        self.assertIsInstance(self._ec["metrics_feedback_status_counts"], dict)

    def test_metrics_source_promotion_status_counts_is_dict(self) -> None:
        self.assertIsInstance(self._ec["metrics_source_promotion_status_counts"], dict)

    def test_delivery_named_status_ready_for_delivery_review_present(self) -> None:
        counts = self._ec["metrics_delivery_status_counts"]
        self.assertIn("ready_for_delivery_review", counts)

    def test_delivery_named_status_blocked_by_repo_state_present(self) -> None:
        counts = self._ec["metrics_delivery_status_counts"]
        self.assertIn("blocked_by_repo_state", counts)

    def test_delivery_named_status_review_activity_observed_present(self) -> None:
        counts = self._ec["metrics_delivery_status_counts"]
        self.assertIn("review_activity_observed", counts)

    def test_delivery_named_status_adoption_observed_locally_present(self) -> None:
        counts = self._ec["metrics_delivery_status_counts"]
        self.assertIn("adoption_observed_locally", counts)

    def test_promotion_named_status_ready_for_promotion_review_present(self) -> None:
        counts = self._ec["metrics_source_promotion_status_counts"]
        self.assertIn("ready_for_promotion_review", counts)

    def test_promotion_named_status_promotion_candidate_present(self) -> None:
        counts = self._ec["metrics_source_promotion_status_counts"]
        self.assertIn("promotion_candidate", counts)

    def test_zero_counts_preserved_for_filter_keys(self) -> None:
        """Zero counts for named statuses must be preserved, not omitted."""
        delivery = self._ec["metrics_delivery_status_counts"]
        self.assertIn("review_activity_observed", delivery)
        self.assertEqual(delivery["review_activity_observed"], 0)
        self.assertIn("adoption_observed_locally", delivery)
        self.assertEqual(delivery["adoption_observed_locally"], 0)

    def test_named_filter_metrics_delivery_ready_present(self) -> None:
        nf = self._body["viewer_projection"]["named_filters"]
        self.assertIn("metrics_delivery_ready", nf)

    def test_named_filter_ready_for_promotion_review_present(self) -> None:
        nf = self._body["viewer_projection"]["named_filters"]
        self.assertIn("ready_for_promotion_review", nf)

    def test_named_filter_promotion_candidate_present(self) -> None:
        nf = self._body["viewer_projection"]["named_filters"]
        self.assertIn("promotion_candidate", nf)

    def test_metrics_delivery_entry_count_present(self) -> None:
        self.assertIn("metrics_delivery_entry_count", self._ec)

    def test_metrics_source_promotion_entry_count_present(self) -> None:
        self.assertIn("metrics_source_promotion_entry_count", self._ec)


class GraphDashboardExternalConsumersToleranceTests(unittest.TestCase):
    """Viewer must not crash when SpecGraph adds new status values or named filters."""

    def _make_dashboard_with_extra_status(self) -> dict:
        ec_extra = {
            **EXTERNAL_CONSUMERS_SECTION,
            "metrics_delivery_status_counts": {
                **EXTERNAL_CONSUMERS_SECTION["metrics_delivery_status_counts"],
                "future_unknown_status": 3,
            },
            "metrics_source_promotion_status_counts": {
                **EXTERNAL_CONSUMERS_SECTION["metrics_source_promotion_status_counts"],
                "another_future_state": 1,
            },
        }
        return {
            **EXTERNAL_CONSUMERS_DASHBOARD,
            "sections": {
                **EXTERNAL_CONSUMERS_DASHBOARD["sections"],
                "external_consumers": ec_extra,
            },
            "viewer_projection": {
                "named_filters": {
                    **EXTERNAL_CONSUMERS_DASHBOARD["viewer_projection"]["named_filters"],
                    "future_unknown_filter": 5,
                }
            },
        }

    def test_unknown_delivery_status_passes_through(self) -> None:
        dashboard = self._make_dashboard_with_extra_status()
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), dashboard=dashboard)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-dashboard")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        ec = body["sections"]["external_consumers"]
        self.assertEqual(ec["metrics_delivery_status_counts"].get("future_unknown_status"), 3)

    def test_unknown_promotion_status_passes_through(self) -> None:
        dashboard = self._make_dashboard_with_extra_status()
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), dashboard=dashboard)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-dashboard")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        ec = body["sections"]["external_consumers"]
        self.assertEqual(
            ec["metrics_source_promotion_status_counts"].get("another_future_state"), 1
        )

    def test_unknown_named_filter_passes_through(self) -> None:
        dashboard = self._make_dashboard_with_extra_status()
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), dashboard=dashboard)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-dashboard")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        nf = body["viewer_projection"]["named_filters"]
        self.assertEqual(nf.get("future_unknown_filter"), 5)

    def test_metrics_section_absent_does_not_crash(self) -> None:
        """Dashboard without sections.metrics must still serve successfully."""
        no_metrics = {
            **EXTERNAL_CONSUMERS_DASHBOARD,
            "sections": {
                k: v
                for k, v in EXTERNAL_CONSUMERS_DASHBOARD["sections"].items()
                if k != "metrics"
            },
        }
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), dashboard=no_metrics)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-dashboard")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertNotIn("metrics", body["sections"])

    def test_external_consumers_section_absent_does_not_crash(self) -> None:
        """Dashboard without sections.external_consumers must still serve successfully."""
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp), dashboard=MINIMAL_DASHBOARD)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/graph-dashboard")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertNotIn("external_consumers", body["sections"])


if __name__ == "__main__":
    unittest.main()
