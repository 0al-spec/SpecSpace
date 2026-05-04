"""Regression guards for the read-only Exploration / Proposals viewer surface."""

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


def _start(
    dialog_dir: Path,
    specgraph_dir: Path | None,
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


def _write_proposal(root: Path, name: str, title: str, status: str) -> None:
    proposals = root / "docs" / "proposals"
    proposals.mkdir(parents=True, exist_ok=True)
    (proposals / name).write_text(
        f"# {title}\n\n## Status\n\n{status}\n\n## Context\n\nBody.\n",
        encoding="utf-8",
    )


def _write_inline_status_proposal(root: Path, name: str, content: str) -> None:
    proposals = root / "docs" / "proposals"
    proposals.mkdir(parents=True, exist_ok=True)
    (proposals / name).write_text(content, encoding="utf-8")


class ExplorationSurfacesEndpointTests(unittest.TestCase):
    def test_503_when_specgraph_dir_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            httpd, thread, base = _start(Path(tmp), None)
            try:
                status, body = _get(f"{base}/api/exploration-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertIn("error", body)

    def test_proposals_are_parsed_and_missing_artifacts_are_not_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "SpecGraph"
            root.mkdir()
            _write_proposal(root, "0002_intent_layer.md", "Intent Layer", "Draft proposal")
            _write_proposal(root, "0045_conversation_memory.md", "Conversation Memory", "Implemented")
            httpd, thread, base = _start(Path(tmp), root)
            try:
                status, body = _get(f"{base}/api/exploration-surfaces")
                proposal_status, proposal_body = _get(
                    f"{base}/api/exploration-proposal?file=0002_intent_layer.md"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertTrue(body["read_only"])
        self.assertEqual(body["proposals"]["count"], 2)
        self.assertEqual(body["proposals"]["entries"][0]["proposal_id"], "0002")
        self.assertEqual(body["proposals"]["entries"][0]["title"], "Intent Layer")
        self.assertEqual(body["proposals"]["entries"][0]["status"], "Draft proposal")
        self.assertNotIn("content", body["proposals"]["entries"][0])
        self.assertEqual(proposal_status, 200)
        self.assertEqual(proposal_body["file_name"], "0002_intent_layer.md")
        self.assertIn("## Status", proposal_body["content"])
        self.assertFalse(body["artifacts"]["conversation_memory"]["available"])
        self.assertTrue(body["artifacts"]["conversation_memory"]["not_built"])
        self.assertFalse(body["artifacts"]["graph_next_moves"]["available"])
        self.assertFalse(body["artifacts"]["proposal_spec_trace_index"]["available"])
        self.assertTrue(body["artifacts"]["proposal_spec_trace_index"]["not_built"])

    def test_proposal_markdown_endpoint_rejects_path_traversal(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "SpecGraph"
            root.mkdir()
            _write_proposal(root, "0002_intent_layer.md", "Intent Layer", "Draft proposal")
            httpd, thread, base = _start(Path(tmp), root)
            try:
                status, body = _get(f"{base}/api/exploration-proposal?file=../secret.md")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertIn("Invalid proposal file name", body["error"])

    def test_proposal_status_supports_inline_status_syntax(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "SpecGraph"
            root.mkdir()
            _write_inline_status_proposal(
                root,
                "0025_metrics_bridge.md",
                "# Metrics Bridge\n\nStatus: Draft proposal\n\n## Problem\n\nBody.\n",
            )
            _write_inline_status_proposal(
                root,
                "0027_specpm_export.md",
                "Status: Accepted for implementation.\n\n# SpecPM Export Preview\n\n## Problem\n\nBody.\n",
            )
            httpd, thread, base = _start(Path(tmp), root)
            try:
                status, body = _get(f"{base}/api/exploration-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        by_id = {entry["proposal_id"]: entry for entry in body["proposals"]["entries"]}
        self.assertEqual(by_id["0025"]["status"], "Draft proposal")
        self.assertEqual(by_id["0027"]["status"], "Accepted for implementation.")

    def test_malformed_runs_artifact_is_reported_as_error_not_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "SpecGraph"
            runs = root / "runs"
            runs.mkdir(parents=True)
            _write_proposal(root, "0045_conversation_memory.md", "Conversation Memory", "Draft proposal")
            (runs / "conversation_memory_index.json").write_text(
                '{"artifact_kind": "conversation_memory_index",',
                encoding="utf-8",
            )
            httpd, thread, base = _start(Path(tmp), root)
            try:
                status, body = _get(f"{base}/api/exploration-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        memory = body["artifacts"]["conversation_memory"]
        self.assertFalse(memory["available"])
        self.assertFalse(memory.get("not_built", False))
        self.assertIn("error", memory)

    def test_conversation_memory_boundary_values_are_passed_for_viewer_warning(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "SpecGraph"
            runs = root / "runs"
            runs.mkdir(parents=True)
            _write_proposal(root, "0045_conversation_memory.md", "Conversation Memory", "Draft proposal")
            (runs / "conversation_memory_index.json").write_text(
                json.dumps(
                    {
                        "artifact_kind": "conversation_memory_index",
                        "schema_version": 1,
                        "source_count": 0,
                        "structured_note_count": 0,
                        "review_state": "not_ready",
                        "next_gap": "capture_conversation_memory_source",
                        "sources": [],
                        "entries": [],
                        "canonical_mutations_allowed": True,
                        "tracked_artifacts_written": False,
                    }
                ),
                encoding="utf-8",
            )
            httpd, thread, base = _start(Path(tmp), root)
            try:
                status, body = _get(f"{base}/api/exploration-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        memory = body["artifacts"]["conversation_memory"]
        self.assertTrue(memory["available"])
        self.assertTrue(memory["data"]["canonical_mutations_allowed"])
        self.assertFalse(memory["data"]["tracked_artifacts_written"])

    def test_proposal_pressure_counts_are_compact_and_linkable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "SpecGraph"
            runs = root / "runs"
            runs.mkdir(parents=True)
            _write_proposal(root, "0001_vocab.md", "Vocabulary", "Draft proposal")
            (runs / "proposal_runtime_index.json").write_text(
                json.dumps(
                    {
                        "artifact_kind": "proposal_runtime_index",
                        "entry_count": 1,
                        "entries": [
                            {
                                "proposal_id": "0001",
                                "posture": "bounded_runtime_followup",
                                "reflective_chain": {"next_gap": "runtime_realization"},
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            httpd, thread, base = _start(Path(tmp), root)
            try:
                status, body = _get(f"{base}/api/exploration-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        runtime = body["proposal_pressure"]["runtime"]
        self.assertTrue(runtime["available"])
        self.assertEqual(runtime["entry_count"], 1)
        self.assertEqual(runtime["reflective_backlog_count"], 1)
        self.assertEqual(runtime["proposal_ids"], ["0001"])
        self.assertEqual(runtime["posture_counts"]["bounded_runtime_followup"], 1)

    def test_proposal_spec_trace_index_is_exposed_read_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "SpecGraph"
            runs = root / "runs"
            runs.mkdir(parents=True)
            _write_proposal(root, "0045_conversation_memory.md", "Conversation Memory", "Draft proposal")
            trace_artifact = {
                "artifact_kind": "proposal_spec_trace_index",
                "schema_version": 1,
                "generated_at": "2026-05-01T00:00:00+00:00",
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "entry_count": 1,
                "entries": [
                    {
                        "proposal_id": "0045",
                        "proposal_path": "docs/proposals/0045_conversation_memory.md",
                        "title": "Conversation Memory",
                        "status": "Draft proposal",
                        "mentioned_spec_ids": ["SG-SPEC-0008"],
                        "spec_refs": [
                            {
                                "spec_id": "SG-SPEC-0008",
                                "relation_kind": "mentions",
                                "authority": "textual_reference",
                                "trace_status": "inferred",
                                "next_gap": "attach_promotion_trace",
                                "source_refs": ["docs/proposals/0045_conversation_memory.md"],
                            }
                        ],
                        "promotion_trace": {
                            "trace_status": "missing_trace",
                            "next_gap": "attach_promotion_trace",
                            "source_refs": [],
                        },
                        "next_gap": "attach_promotion_trace",
                    }
                ],
                "lane_refs": [
                    {
                        "proposal_handle": "governance_proposal::SG-SPEC-0032::stalled_maturity_candidate",
                        "target_spec_id": "SG-SPEC-0032",
                        "relation_kind": "targets",
                        "authority": "lane_overlay",
                        "trace_status": "declared",
                        "authority_state": "under_review",
                        "source_refs": ["runs/proposal_lane_overlay.json"],
                        "next_gap": "human_review",
                    }
                ],
                "summary": {"entry_count": 1, "lane_ref_count": 1},
            }
            (runs / "proposal_spec_trace_index.json").write_text(
                json.dumps(trace_artifact),
                encoding="utf-8",
            )
            httpd, thread, base = _start(Path(tmp), root)
            try:
                status, body = _get(f"{base}/api/exploration-surfaces")
                direct_status, direct_body = _get(f"{base}/api/proposal-spec-trace-index")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        trace = body["artifacts"]["proposal_spec_trace_index"]
        self.assertTrue(trace["available"])
        self.assertEqual(trace["artifact_kind"], "proposal_spec_trace_index")
        self.assertFalse(trace["data"]["canonical_mutations_allowed"])
        self.assertFalse(trace["data"]["tracked_artifacts_written"])
        self.assertEqual(trace["data"]["entries"][0]["proposal_id"], "0045")
        self.assertEqual(trace["data"]["entries"][0]["mentioned_spec_ids"], ["SG-SPEC-0008"])
        self.assertEqual(trace["data"]["lane_refs"][0]["proposal_handle"], "governance_proposal::SG-SPEC-0032::stalled_maturity_candidate")
        self.assertEqual(direct_status, 200)
        self.assertTrue(direct_body["available"])
        self.assertEqual(direct_body["data"]["summary"]["lane_ref_count"], 1)


if __name__ == "__main__":
    unittest.main()
