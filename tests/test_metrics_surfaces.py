"""Regression guard for metrics drilldown endpoints:
  GET /api/metrics-source-promotion
  GET /api/metrics-delivery
  GET /api/metrics-feedback
  GET /api/metric-pack-adapters
  GET /api/metric-pack-runs
  GET /api/metric-pricing-provenance
  GET /api/model-usage-telemetry
  GET /api/metric-signals
"""

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
# Minimal valid fixtures
# ---------------------------------------------------------------------------

MINIMAL_SOURCE_PROMOTION: dict = {
    "artifact_kind": "metrics_source_promotion_index",
    "schema_version": 1,
    "generated_at": "2026-04-28T10:00:00+00:00",
    "entries": [],
    "summary": {"entry_count": 0, "promotion_status_counts": {}, "review_state_counts": {}},
}

MINIMAL_DELIVERY: dict = {
    "artifact_kind": "metrics_delivery_workflow",
    "schema_version": 1,
    "generated_at": "2026-04-28T10:00:00+00:00",
    "entries": [],
    "summary": {"entry_count": 0, "delivery_status_counts": {}, "review_state_counts": {}},
}

MINIMAL_FEEDBACK: dict = {
    "artifact_kind": "metrics_feedback_index",
    "schema_version": 1,
    "generated_at": "2026-04-28T10:00:00+00:00",
    "entries": [],
    "summary": {"entry_count": 0, "feedback_status_counts": {}, "review_state_counts": {}},
}

MINIMAL_METRIC_PACK_ADAPTERS: dict = {
    "artifact_kind": "metric_pack_adapter_index",
    "schema_version": 1,
    "generated_at": "2026-05-02T10:00:00+00:00",
    "review_state": "ready_for_review",
    "next_gap": "review_metric_pack_adapter_index",
    "summary": {
        "pack_count": 1,
        "input_binding_count": 1,
        "status_counts": {"missing_input_adapters": 1},
        "computability_counts": {"not_computable": 1},
        "missing_input_counts": {"intent_atoms": 1},
    },
    "entry_count": 1,
    "entries": [
        {
            "metric_pack_id": "sib_full",
            "title": "SIB Full Metrics",
            "adapter_status": "missing_input_adapters",
            "review_state": "ready_for_review",
            "next_gap": "define_intent_atom_extraction",
            "input_count": 1,
            "missing_input_count": 1,
            "missing_inputs": ["intent_atoms"],
            "inputs": [
                {
                    "input_id": "intent_atoms",
                    "computability": "not_computable",
                    "source_artifact": "",
                    "source_field": "",
                    "required_by_metric_ids": ["sib_eff_star"],
                    "required_by_pack": False,
                    "next_gap": "define_intent_atom_extraction",
                }
            ],
            "adapter_execution": {
                "status": "deferred",
                "next_gap": "add_metric_pack_execution_runtime",
            },
        }
    ],
    "adapter_backlog": {
        "entry_count": 1,
        "items": [
            {
                "adapter_backlog_id": "metric_pack_adapter::sib_full::intent_atoms",
                "metric_pack_id": "sib_full",
                "input_id": "intent_atoms",
                "computability": "not_computable",
                "source_artifact": "",
                "review_state": "ready_for_review",
                "next_gap": "define_intent_atom_extraction",
            }
        ],
        "grouped_by_next_gap": {"define_intent_atom_extraction": 1},
    },
    "canonical_mutations_allowed": False,
    "tracked_artifacts_written": False,
}

MINIMAL_METRIC_PACK_RUNS: dict = {
    "artifact_kind": "metric_pack_runs",
    "schema_version": 1,
    "generated_at": "2026-05-02T10:00:00+00:00",
    "review_state": "ready_for_review",
    "next_gap": "review_metric_pack_runs",
    "summary": {
        "pack_count": 1,
        "run_status_counts": {"not_computable": 1},
        "computed_value_count": 0,
        "gap_count": 1,
    },
    "entry_count": 1,
    "entries": [
        {
            "run_id": "metric_pack_run::sib_full::latest",
            "metric_pack_id": "sib_full",
            "title": "SIB Full Metrics",
            "run_status": "not_computable",
            "review_state": "ready_for_review",
            "next_gap": "define_intent_atom_extraction",
            "computed_values": [],
            "gaps": [{"input_id": "intent_atoms", "next_gap": "define_intent_atom_extraction"}],
            "finding_projection": {
                "status": "deferred",
                "next_gap": "add_metric_pack_finding_index",
            },
            "threshold_authority_granted": False,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
        }
    ],
    "canonical_mutations_allowed": False,
    "tracked_artifacts_written": False,
}

MINIMAL_METRIC_PRICING: dict = {
    "artifact_kind": "metric_pricing_provenance",
    "schema_version": 1,
    "generated_at": "2026-05-02T10:00:00+00:00",
    "review_state": "ready_for_review",
    "next_gap": "connect_model_usage_telemetry",
    "summary": {
        "pricing_surface_count": 1,
        "status_counts": {"missing_price_source": 1},
        "observed_spend_count": 0,
        "derived_proxy_count": 0,
    },
    "entry_count": 1,
    "pricing_surfaces": [
        {
            "pricing_surface_id": "codex_supervisor_default_model",
            "provider": "openai",
            "model": "gpt-5.5",
            "tool": "codex_supervisor",
            "price_status": "missing_price_source",
            "spend_status": "not_observed",
            "missing_price_behavior": "report_observation_gap",
            "review_state": "ready_for_review",
            "next_gap": "connect_model_usage_telemetry",
        }
    ],
    "canonical_mutations_allowed": False,
    "tracked_artifacts_written": False,
}

MINIMAL_MODEL_USAGE_TELEMETRY: dict = {
    "artifact_kind": "model_usage_telemetry_index",
    "schema_version": 1,
    "generated_at": "2026-05-02T10:00:00+00:00",
    "review_state": "ready_for_review",
    "next_gap": "connect_token_usage_capture",
    "summary": {
        "model_usage_surface_count": 1,
        "run_count": 0,
        "telemetry_status_counts": {"configured_not_observed": 1},
        "token_usage_status_counts": {"not_observed": 1},
    },
    "entry_count": 1,
    "model_usage_surfaces": [
        {
            "model_usage_surface_id": "codex_supervisor_default_model",
            "provider": "openai",
            "model": "gpt-5.5",
            "tool": "codex_supervisor",
            "execution_profile": "standard",
            "reasoning_effort": "medium",
            "telemetry_status": "configured_not_observed",
            "run_count": 0,
            "usage_proxy": {
                "status": "not_observed",
                "unit": "supervisor_run",
                "value": 0,
            },
            "token_usage": {
                "status": "not_observed",
                "observed_record_count": 0,
                "input_tokens": None,
                "output_tokens": None,
                "total_tokens": None,
                "missing_behavior": "report_observation_gap",
            },
            "review_state": "ready_for_review",
            "next_gap": "connect_token_usage_capture",
        }
    ],
    "canonical_mutations_allowed": False,
    "tracked_artifacts_written": False,
}

MINIMAL_METRIC_SIGNALS: dict = {
    "artifact_kind": "metric_signal_index",
    "schema_version": 1,
    "generated_at": "2026-05-02T10:00:00+00:00",
    "metrics": [
        {
            "metric_id": "node_inference_cost",
            "title": "Node Inference Cost",
            "score": None,
            "minimum_score": None,
            "threshold_gap": None,
            "status": "observed_proxy",
            "signal_emitted": False,
            "derivation_mode": "proxy_from_existing_observation",
            "threshold_authority_state": "not_threshold_authority",
            "value": 5,
            "unit": "supervisor_run_proxy",
            "value_kind": "usage_proxy_not_monetary_cost",
            "price_status": "active_price_source",
            "input_summary": {
                "usage_surface_count": 4,
                "observed_run_count": 5,
            },
        }
    ],
    "canonical_mutations_allowed": False,
    "tracked_artifacts_written": False,
}

POPULATED_SOURCE_PROMOTION: dict = {
    **MINIMAL_SOURCE_PROMOTION,
    "entries": [
        {
            "metric_id": "sib_full",
            "promotion_status": "ready_for_promotion_review",
            "review_state": "pending",
            "authority_state": "promotion_candidate",
            "next_gap": "human_review_required",
            "source_artifact": "runs/metric_signal_index.json",
            "legacy_metric_ids": ["sib"],
            "guardrails": {"requires_human_review": True},
        }
    ],
    "summary": {
        "entry_count": 1,
        "promotion_status_counts": {"ready_for_promotion_review": 1},
        "review_state_counts": {"pending": 1},
    },
}

POPULATED_DELIVERY: dict = {
    **MINIMAL_DELIVERY,
    "entries": [
        {
            "consumer_id": "metrics_sib",
            "delivery_status": "blocked_by_repo_state",
            "review_state": "pending",
            "next_gap": "isolate_metrics_checkout_changes",
            "source_artifact": "runs/external_consumer_index.json",
            "repo_snapshot": {
                "current_branch": "metrics/sib-delivery",
                "upstream_branch": "main",
                "ahead_count": 3,
                "behind_count": 0,
                "changed_paths": ["sib/impl.py", "sib/tests.py", "unrelated/other.py"],
                "unrelated_changed_paths": ["unrelated/other.py"],
                "handoff_changed_paths": ["sib/impl.py", "sib/tests.py"],
                "has_unrelated_checkout_changes": True,
                "has_handoff_checkout_changes": True,
            },
        },
        {
            "consumer_id": "metrics_sib_full",
            "delivery_status": "ready_for_delivery_review",
            "review_state": "approved",
            "next_gap": "promotion_review_ready",
            "source_artifact": "runs/external_consumer_index.json",
            "source_handoff": {"generated_at": "2026-04-29T14:00:00+00:00"},
        },
    ],
    "summary": {
        "entry_count": 2,
        "delivery_status_counts": {"blocked_by_repo_state": 1, "ready_for_delivery_review": 1},
        "review_state_counts": {"pending": 1, "approved": 1},
    },
}

POPULATED_FEEDBACK: dict = {
    **MINIMAL_FEEDBACK,
    "entries": [
        {
            "consumer_id": "metrics_sib",
            "feedback_status": "blocked_by_delivery_gap",
            "review_state": "pending",
            "next_gap": "delivery_not_ready",
            "source_artifact": "runs/external_consumer_index.json",
        }
    ],
    "summary": {
        "entry_count": 1,
        "feedback_status_counts": {"blocked_by_delivery_gap": 1},
        "review_state_counts": {"pending": 1},
    },
}


# ---------------------------------------------------------------------------
# Server helpers (mirrors test_graph_backlog_projection.py)
# ---------------------------------------------------------------------------


def _make_spec_dir(base: Path) -> Path:
    spec_dir = base / "specs" / "nodes"
    spec_dir.mkdir(parents=True)
    runs = base / "runs"
    runs.mkdir(parents=True)
    return spec_dir


def _write_artifact(base: Path, filename: str, data: dict) -> None:
    (base / "runs" / filename).write_text(json.dumps(data), encoding="utf-8")


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


def _implementation_work_artifact(entry_count: int) -> dict:
    entries = [
        {
            "work_item_id": f"implementation_work::SG-SPEC-{idx:04d}::changed_spec",
            "affected_spec_ids": [f"SG-SPEC-{idx:04d}"],
            "implementation_reason": "changed_spec",
            "delta_refs": [f"changed_spec_ids::SG-SPEC-{idx:04d}"],
            "required_tests": [],
            "expected_evidence": [f"implementation_evidence::SG-SPEC-{idx:04d}"],
            "likely_code_refs": [],
            "readiness": "ready_for_planning",
            "blockers": [],
            "next_gap": "review_implementation_delta",
        }
        for idx in range(entry_count)
    ]
    return {
        "artifact_kind": "implementation_work_index",
        "schema_version": 1,
        "generated_at": "2026-05-11T10:00:00+00:00",
        "entry_count": len(entries),
        "entries": entries,
    }


# ---------------------------------------------------------------------------
# Parametric test factory
# ---------------------------------------------------------------------------

ENDPOINT_CONFIGS = [
    {
        "route": "/api/metrics-source-promotion",
        "filename": "metrics_source_promotion_index.json",
        "minimal": MINIMAL_SOURCE_PROMOTION,
        "populated": POPULATED_SOURCE_PROMOTION,
        "artifact_kind": "metrics_source_promotion_index",
    },
    {
        "route": "/api/metrics-delivery",
        "filename": "metrics_delivery_workflow.json",
        "minimal": MINIMAL_DELIVERY,
        "populated": POPULATED_DELIVERY,
        "artifact_kind": "metrics_delivery_workflow",
    },
    {
        "route": "/api/metrics-feedback",
        "filename": "metrics_feedback_index.json",
        "minimal": MINIMAL_FEEDBACK,
        "populated": POPULATED_FEEDBACK,
        "artifact_kind": "metrics_feedback_index",
    },
    {
        "route": "/api/metric-pack-adapters",
        "filename": "metric_pack_adapter_index.json",
        "minimal": MINIMAL_METRIC_PACK_ADAPTERS,
        "populated": MINIMAL_METRIC_PACK_ADAPTERS,
        "artifact_kind": "metric_pack_adapter_index",
    },
    {
        "route": "/api/metric-pack-runs",
        "filename": "metric_pack_runs.json",
        "minimal": MINIMAL_METRIC_PACK_RUNS,
        "populated": MINIMAL_METRIC_PACK_RUNS,
        "artifact_kind": "metric_pack_runs",
    },
    {
        "route": "/api/metric-pricing-provenance",
        "filename": "metric_pricing_provenance.json",
        "minimal": MINIMAL_METRIC_PRICING,
        "populated": MINIMAL_METRIC_PRICING,
        "artifact_kind": "metric_pricing_provenance",
    },
    {
        "route": "/api/model-usage-telemetry",
        "filename": "model_usage_telemetry_index.json",
        "minimal": MINIMAL_MODEL_USAGE_TELEMETRY,
        "populated": MINIMAL_MODEL_USAGE_TELEMETRY,
        "artifact_kind": "model_usage_telemetry_index",
    },
    {
        "route": "/api/metric-signals",
        "filename": "metric_signal_index.json",
        "minimal": MINIMAL_METRIC_SIGNALS,
        "populated": MINIMAL_METRIC_SIGNALS,
        "artifact_kind": "metric_signal_index",
    },
]


# ---------------------------------------------------------------------------
# Tests: endpoint availability for all metrics drilldown artifacts
# ---------------------------------------------------------------------------


class MetricsSurfaceEndpointMatrixTests(unittest.TestCase):
    def test_all_configured_endpoints_return_standard_envelope(self) -> None:
        for config in ENDPOINT_CONFIGS:
            with self.subTest(route=config["route"]):
                with tempfile.TemporaryDirectory() as tmp:
                    spec_dir = _make_spec_dir(Path(tmp))
                    _write_artifact(Path(tmp), config["filename"], config["minimal"])
                    httpd, thread, base = _start(Path(tmp), spec_dir)
                    try:
                        status, body = _get(f"{base}{config['route']}")
                    finally:
                        _stop(httpd, thread)

                self.assertEqual(status, 200)
                for field in ("path", "mtime", "mtime_iso", "data"):
                    self.assertIn(field, body)
                self.assertEqual(body["data"]["artifact_kind"], config["artifact_kind"])

    def test_all_configured_endpoints_report_missing_artifact(self) -> None:
        for config in ENDPOINT_CONFIGS:
            with self.subTest(route=config["route"]):
                with tempfile.TemporaryDirectory() as tmp:
                    spec_dir = _make_spec_dir(Path(tmp))
                    httpd, thread, base = _start(Path(tmp), spec_dir)
                    try:
                        status, body = _get(f"{base}{config['route']}")
                    finally:
                        _stop(httpd, thread)

                self.assertEqual(status, 404)
                self.assertIn(config["filename"], body["error"])


class ImplementationWorkIndexEndpointTests(unittest.TestCase):
    ROUTE = "/api/implementation-work-index"
    FILENAME = "implementation_work_index.json"

    def test_default_limit_caps_entries_at_50(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, _implementation_work_artifact(60))
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(len(body["data"]["entries"]), 50)
        self.assertEqual(body["data"]["entry_count"], 50)

    def test_limit_query_caps_entries(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, _implementation_work_artifact(60))
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}?limit=3")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(len(body["data"]["entries"]), 3)
        self.assertEqual(body["data"]["entry_count"], 3)


# ---------------------------------------------------------------------------
# Tests: source promotion endpoint
# ---------------------------------------------------------------------------


class MetricsSourcePromotionEndpointTests(unittest.TestCase):
    ROUTE = "/api/metrics-source-promotion"
    FILENAME = "metrics_source_promotion_index.json"
    MINIMAL = MINIMAL_SOURCE_PROMOTION
    POPULATED = POPULATED_SOURCE_PROMOTION

    def test_503_when_spec_dir_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = _start(Path(tmp), spec_dir=None)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 503)
        self.assertIn("error", body)

    def test_404_when_artifact_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)
        self.assertIn("error", body)

    def test_200_happy_path_minimal(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.MINIMAL)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertIn("data", body)

    def test_200_happy_path_populated(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.POPULATED)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(len(body["data"]["entries"]), len(self.POPULATED["entries"]))

    def test_envelope_fields_present(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.MINIMAL)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        for field in ("path", "mtime", "mtime_iso", "data"):
            self.assertIn(field, body)

    def test_envelope_mtime_is_float(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.MINIMAL)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertIsInstance(body["mtime"], float)

    def test_envelope_mtime_iso_is_string(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.MINIMAL)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertIsInstance(body["mtime_iso"], str)
        self.assertIn("T", body["mtime_iso"])

    def test_data_not_modified_by_server(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.MINIMAL)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        extra = set(body["data"].keys()) - set(self.MINIMAL.keys())
        self.assertEqual(extra, set())

    def test_422_when_artifact_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            (Path(tmp) / "runs" / self.FILENAME).write_text("{ bad json", encoding="utf-8")
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 422)
        self.assertIn("error", body)

    def test_path_traversal_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            (Path(tmp) / "secret.json").write_text('{"secret": true}', encoding="utf-8")
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}?path=../../secret.json")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)


class MetricsSourcePromotionShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        spec_dir = _make_spec_dir(tmp)
        _write_artifact(tmp, "metrics_source_promotion_index.json", POPULATED_SOURCE_PROMOTION)
        self._httpd, self._thread, base = _start(tmp, spec_dir)
        _, body = _get(f"{base}/api/metrics-source-promotion")
        self._envelope = body
        self._data = body["data"]

    def tearDown(self) -> None:
        _stop(self._httpd, self._thread)
        self._tmp.cleanup()

    def test_artifact_kind(self) -> None:
        self.assertEqual(self._data["artifact_kind"], "metrics_source_promotion_index")

    def test_schema_version_present(self) -> None:
        self.assertIn("schema_version", self._data)

    def test_entries_is_list(self) -> None:
        self.assertIsInstance(self._data["entries"], list)

    def test_summary_present(self) -> None:
        self.assertIn("summary", self._data)

    def test_entry_has_metric_id(self) -> None:
        for entry in self._data["entries"]:
            self.assertIn("metric_id", entry)

    def test_entry_has_promotion_status(self) -> None:
        for entry in self._data["entries"]:
            self.assertIn("promotion_status", entry)

    def test_entry_has_next_gap(self) -> None:
        for entry in self._data["entries"]:
            self.assertIn("next_gap", entry)

    def test_entry_has_guardrails(self) -> None:
        for entry in self._data["entries"]:
            self.assertIn("guardrails", entry)

    def test_entry_guardrails_has_requires_human_review(self) -> None:
        for entry in self._data["entries"]:
            self.assertIn("requires_human_review", entry["guardrails"])

    def test_unknown_promotion_status_passes_through(self) -> None:
        artifact = {
            **POPULATED_SOURCE_PROMOTION,
            "entries": [
                {**POPULATED_SOURCE_PROMOTION["entries"][0], "promotion_status": "future_unknown_status"}
            ],
        }
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), "metrics_source_promotion_index.json", artifact)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/metrics-source-promotion")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["entries"][0]["promotion_status"], "future_unknown_status")


# ---------------------------------------------------------------------------
# Tests: delivery endpoint
# ---------------------------------------------------------------------------


class MetricsDeliveryEndpointTests(unittest.TestCase):
    ROUTE = "/api/metrics-delivery"
    FILENAME = "metrics_delivery_workflow.json"
    MINIMAL = MINIMAL_DELIVERY
    POPULATED = POPULATED_DELIVERY

    def test_503_when_spec_dir_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = _start(Path(tmp), spec_dir=None)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 503)

    def test_404_when_artifact_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)

    def test_200_happy_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.POPULATED)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(len(body["data"]["entries"]), 2)

    def test_envelope_fields_present(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.MINIMAL)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        for field in ("path", "mtime", "mtime_iso", "data"):
            self.assertIn(field, body)

    def test_data_not_modified_by_server(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.MINIMAL)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        extra = set(body["data"].keys()) - set(self.MINIMAL.keys())
        self.assertEqual(extra, set())

    def test_422_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            (Path(tmp) / "runs" / self.FILENAME).write_text("{ bad json", encoding="utf-8")
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 422)

    def test_path_traversal_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, _ = _get(f"{base}{self.ROUTE}?path=../../secret.json")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)


class MetricsDeliveryShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        spec_dir = _make_spec_dir(tmp)
        _write_artifact(tmp, "metrics_delivery_workflow.json", POPULATED_DELIVERY)
        self._httpd, self._thread, base = _start(tmp, spec_dir)
        _, body = _get(f"{base}/api/metrics-delivery")
        self._data = body["data"]

    def tearDown(self) -> None:
        _stop(self._httpd, self._thread)
        self._tmp.cleanup()

    def test_artifact_kind(self) -> None:
        self.assertEqual(self._data["artifact_kind"], "metrics_delivery_workflow")

    def test_entries_is_list(self) -> None:
        self.assertIsInstance(self._data["entries"], list)

    def test_entry_has_consumer_id(self) -> None:
        for e in self._data["entries"]:
            self.assertIn("consumer_id", e)

    def test_entry_has_delivery_status(self) -> None:
        for e in self._data["entries"]:
            self.assertIn("delivery_status", e)

    def test_entry_has_review_state(self) -> None:
        for e in self._data["entries"]:
            self.assertIn("review_state", e)

    def test_entry_has_next_gap(self) -> None:
        for e in self._data["entries"]:
            self.assertIn("next_gap", e)

    def test_repo_snapshot_passes_through(self) -> None:
        blocked = self._data["entries"][0]
        self.assertIn("repo_snapshot", blocked)
        snap = blocked["repo_snapshot"]
        self.assertTrue(snap["has_unrelated_checkout_changes"])
        self.assertEqual(snap["current_branch"], "metrics/sib-delivery")
        self.assertEqual(snap["ahead_count"], 3)
        self.assertEqual(len(snap["unrelated_changed_paths"]), 1)

    def test_source_handoff_passes_through(self) -> None:
        ready = self._data["entries"][1]
        self.assertIn("source_handoff", ready)
        self.assertIn("generated_at", ready["source_handoff"])

    def test_entry_without_repo_snapshot_ok(self) -> None:
        ready = self._data["entries"][1]
        self.assertNotIn("repo_snapshot", ready)

    def test_unknown_delivery_status_passes_through(self) -> None:
        artifact = {
            **POPULATED_DELIVERY,
            "entries": [{**POPULATED_DELIVERY["entries"][0], "delivery_status": "future_status"}],
        }
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), "metrics_delivery_workflow.json", artifact)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/metrics-delivery")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["entries"][0]["delivery_status"], "future_status")


# ---------------------------------------------------------------------------
# Tests: feedback endpoint
# ---------------------------------------------------------------------------


class MetricsFeedbackEndpointTests(unittest.TestCase):
    ROUTE = "/api/metrics-feedback"
    FILENAME = "metrics_feedback_index.json"
    MINIMAL = MINIMAL_FEEDBACK
    POPULATED = POPULATED_FEEDBACK

    def test_503_when_spec_dir_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = _start(Path(tmp), spec_dir=None)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 503)

    def test_404_when_artifact_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)

    def test_200_happy_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.POPULATED)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(len(body["data"]["entries"]), 1)

    def test_envelope_fields_present(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.MINIMAL)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        for field in ("path", "mtime", "mtime_iso", "data"):
            self.assertIn(field, body)

    def test_data_not_modified_by_server(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), self.FILENAME, self.MINIMAL)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        extra = set(body["data"].keys()) - set(self.MINIMAL.keys())
        self.assertEqual(extra, set())

    def test_422_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            (Path(tmp) / "runs" / self.FILENAME).write_text("{ bad json", encoding="utf-8")
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}{self.ROUTE}")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 422)

    def test_path_traversal_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, _ = _get(f"{base}{self.ROUTE}?path=../../secret.json")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 404)


class MetricsFeedbackShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        spec_dir = _make_spec_dir(tmp)
        _write_artifact(tmp, "metrics_feedback_index.json", POPULATED_FEEDBACK)
        self._httpd, self._thread, base = _start(tmp, spec_dir)
        _, body = _get(f"{base}/api/metrics-feedback")
        self._data = body["data"]

    def tearDown(self) -> None:
        _stop(self._httpd, self._thread)
        self._tmp.cleanup()

    def test_artifact_kind(self) -> None:
        self.assertEqual(self._data["artifact_kind"], "metrics_feedback_index")

    def test_entries_is_list(self) -> None:
        self.assertIsInstance(self._data["entries"], list)

    def test_entry_has_consumer_id(self) -> None:
        for e in self._data["entries"]:
            self.assertIn("consumer_id", e)

    def test_entry_has_feedback_status(self) -> None:
        for e in self._data["entries"]:
            self.assertIn("feedback_status", e)

    def test_entry_has_review_state(self) -> None:
        for e in self._data["entries"]:
            self.assertIn("review_state", e)

    def test_entry_has_next_gap(self) -> None:
        for e in self._data["entries"]:
            self.assertIn("next_gap", e)

    def test_unknown_feedback_status_passes_through(self) -> None:
        artifact = {
            **POPULATED_FEEDBACK,
            "entries": [{**POPULATED_FEEDBACK["entries"][0], "feedback_status": "future_status"}],
        }
        with tempfile.TemporaryDirectory() as tmp:
            spec_dir = _make_spec_dir(Path(tmp))
            _write_artifact(Path(tmp), "metrics_feedback_index.json", artifact)
            httpd, thread, base = _start(Path(tmp), spec_dir)
            try:
                status, body = _get(f"{base}/api/metrics-feedback")
            finally:
                _stop(httpd, thread)
        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["entries"][0]["feedback_status"], "future_status")


if __name__ == "__main__":
    unittest.main()
