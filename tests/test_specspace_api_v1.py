import json
import tempfile
import threading
import time
import unittest
from functools import partial
from http import HTTPStatus
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
    specpm_registry_url: str | None = None,
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
    httpd.specpm_registry_url = specpm_registry_url
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


def _write_specpm_registry(root: Path) -> None:
    status_dir = root / "v0" / "status"
    packages_dir = root / "v0" / "packages"
    package_dir = packages_dir / "specnode.core"
    version_dir = package_dir / "versions" / "0.1.0"
    status_dir.mkdir(parents=True)
    packages_dir.mkdir(parents=True)
    package_dir.mkdir(parents=True)
    version_dir.mkdir(parents=True)
    common = {"apiVersion": "specpm.registry/v0", "schemaVersion": 1, "status": "ok"}
    status_payload = {
        **common,
        "kind": "RemoteRegistryStatus",
        "registry": {
            "profile": "public_static_index",
            "api_version": "v0",
            "read_only": True,
            "authority": "metadata_only",
            "package_count": 1,
            "version_count": 1,
            "capability_count": 1,
            "intent_count": 1,
        },
    }
    packages_payload = {
        **common,
        "kind": "RemotePackageIndex",
        "package_count": 1,
        "version_count": 1,
        "packages": [
            {
                "package_id": "specnode.core",
                "name": "SpecNode Core",
                "summary": "Core SpecNode package.",
                "license": "MIT",
                "latest_version": "0.1.0",
                "capabilities": ["specnode.typed_job_protocol"],
                "versions": [{"version": "0.1.0", "yanked": False, "deprecated": False}],
            }
        ],
    }
    package_payload = {
        **common,
        "kind": "RemotePackage",
        "package": {
            "package_id": "specnode.core",
            "name": "SpecNode Core",
            "summary": "Core SpecNode package.",
            "license": "MIT",
            "latest_version": "0.1.0",
            "capabilities": ["specnode.typed_job_protocol"],
            "versions": [{"version": "0.1.0", "yanked": False, "deprecated": False}],
        },
    }
    version_payload = {
        **common,
        "kind": "RemotePackageVersion",
        "package_id": "specnode.core",
        "version": "0.1.0",
        "archive": {
            "path": "v0/packages/specnode.core/versions/0.1.0/specnode.core-0.1.0.specpm.tgz",
            "sha256": "1" * 64,
        },
    }
    for directory, payload in (
        (status_dir, status_payload),
        (packages_dir, packages_payload),
        (package_dir, package_payload),
        (version_dir, version_payload),
    ):
        _write_json(directory / "index.json", payload)
        _write_json(directory / "index.html", payload)


def _write_proposal_viewer_artifacts(runs_dir: Path) -> None:
    runs_dir.mkdir(parents=True, exist_ok=True)
    _write_json(
        runs_dir / "proposal_spec_trace_index.json",
        {
            "artifact_kind": "proposal_spec_trace_index",
            "generated_at": "2026-05-17T12:00:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "trace_entry_id": "proposal::0042",
                    "proposal_id": "0042",
                    "proposal_path": "docs/proposals/0042_agent_context.md",
                    "title": "Agent Context Bridge",
                    "status": "Draft proposal",
                    "spec_refs": [
                        {
                            "proposal_id": "0042",
                            "proposal_path": "docs/proposals/0042_agent_context.md",
                            "spec_id": "SG-SPEC-0001",
                            "relation_kind": "mentions",
                            "authority": "textual_reference",
                            "trace_status": "inferred",
                            "next_gap": "attach_promotion_trace",
                            "source_refs": ["docs/proposals/0042_agent_context.md"],
                        }
                    ],
                    "mentioned_spec_ids": ["SG-SPEC-0001"],
                    "promotion_trace": {
                        "status": "bounded",
                        "trace_status": "bounded",
                        "next_gap": "none",
                        "source_refs": ["docs/archive/proposal_sources/0042_agent_context.md"],
                    },
                    "next_gap": "none",
                }
            ],
            "lane_ref_count": 0,
            "lane_refs": [],
            "summary": {
                "entry_count": 1,
                "lane_ref_count": 0,
                "spec_ref_count": 1,
                "authority_counts": {"textual_reference": 1},
                "trace_status_counts": {"bounded": 1},
            },
            "viewer_projection": {"spec_id": {}, "authority": {}, "trace_status": {}, "named_filters": {}},
            "viewer_contract": {"contract_doc": "test", "read_only": True},
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
        },
    )
    _write_json(
        runs_dir / "proposal_runtime_index.json",
        {
            "artifact_kind": "proposal_runtime_index",
            "generated_at": "2026-05-17T12:00:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "proposal_id": "0042",
                    "title": "Agent Context Bridge",
                    "status": "Draft proposal",
                    "path": "docs/proposals/0042_agent_context.md",
                    "posture": "synchronous_runtime_slice",
                    "runtime_realization": {"status": "implemented"},
                    "reflective_chain": {"runtime_realization": "implemented", "next_gap": "none"},
                }
            ],
        },
    )
    _write_json(
        runs_dir / "proposal_promotion_index.json",
        {
            "artifact_kind": "proposal_promotion_index",
            "generated_at": "2026-05-17T12:00:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "proposal_id": "0042",
                    "title": "Agent Context Bridge",
                    "path": "docs/proposals/0042_agent_context.md",
                    "status": "Draft proposal",
                    "promotion_traceability": {"status": "bounded", "next_gap": "none"},
                }
            ],
        },
    )
    _write_json(
        runs_dir / "proposal_lane_overlay.json",
        {
            "artifact_kind": "proposal_lane_overlay",
            "generated_at": "2026-05-17T12:00:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "tracked_path": "proposal_lane/nodes/governance_proposal--sg-spec-0002.json",
                    "title": "Governance Proposal for SG-SPEC-0002",
                    "proposal_handle": "governance_proposal::SG-SPEC-0002::runtime",
                    "proposal_authority_state": "under_review",
                    "proposal_type": "governance_proposal",
                    "target_region": {
                        "target_kind": "canonical_node",
                        "target_reference": "SG-SPEC-0002",
                    },
                    "lineage_links": [
                        {
                            "lineage_role": "motivated_by",
                            "source_kind": "canonical_node",
                            "source_reference": "SG-SPEC-0002",
                        }
                    ],
                    "query_contract": {"status": "queryable", "findings": []},
                }
            ],
        },
    )


def _write_metrics_viewer_artifacts(runs_dir: Path) -> None:
    runs_dir.mkdir(parents=True, exist_ok=True)
    _write_json(
        runs_dir / "graph_dashboard.json",
        {
            "artifact_kind": "graph_dashboard",
            "schema_version": 1,
            "generated_at": "2026-05-17T12:30:00Z",
            "sections": {
                "metrics": {
                    "metric_count": 1,
                    "metric_status_counts": {"healthy": 1},
                    "metric_scores": {
                        "sib": {
                            "score": 0.74,
                            "minimum_score": 0.6,
                            "status": "healthy",
                            "threshold_gap": -0.14,
                            "target_spec_ids": ["SG-SPEC-0001"],
                        }
                    },
                    "below_threshold_metric_ids": [],
                    "metric_pack_entry_count": 1,
                    "metric_pack_adapter_entry_count": 1,
                },
                "external_consumers": {
                    "entry_count": 1,
                    "metrics_delivery_entry_count": 1,
                    "metrics_feedback_entry_count": 1,
                    "metrics_source_promotion_entry_count": 1,
                },
            },
        },
    )
    _write_json(
        runs_dir / "metric_signal_index.json",
        {
            "artifact_kind": "metric_signal_index",
            "generated_at": "2026-05-17T12:30:00Z",
            "metrics": [
                {
                    "metric_id": "sib",
                    "title": "Specification-Implementation Balance",
                    "score": 0.74,
                    "minimum_score": 0.6,
                    "status": "healthy",
                    "target_spec_ids": ["SG-SPEC-0001"],
                }
            ],
        },
    )
    _write_json(
        runs_dir / "metrics_source_promotion_index.json",
        {
            "artifact_kind": "metrics_source_promotion_index",
            "generated_at": "2026-05-17T12:30:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "promotion_id": "metrics_source_promotion::metrics_sib::sib",
                    "metric_id": "sib",
                    "title": "Promote SIB source",
                    "promotion_status": "draft_visible_only",
                    "authority_state": "not_threshold_authority",
                    "next_gap": "review_draft_metric_source",
                    "target_spec_ids": ["SG-SPEC-0001"],
                }
            ],
        },
    )
    _write_json(
        runs_dir / "metrics_delivery_workflow.json",
        {
            "artifact_kind": "metrics_delivery_workflow",
            "generated_at": "2026-05-17T12:30:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "delivery_id": "metrics_delivery::metrics_sib",
                    "consumer_id": "metrics_sib",
                    "title": "Metrics SIB delivery",
                    "delivery_status": "ready_for_delivery_review",
                    "review_state": "ready_for_review",
                    "bound_metric_ids": ["sib"],
                    "delivery_paths": [".specgraph_handoffs/metrics_sib/handoff.json"],
                }
            ],
        },
    )
    _write_json(
        runs_dir / "metrics_feedback_index.json",
        {
            "artifact_kind": "metrics_feedback_index",
            "generated_at": "2026-05-17T12:30:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "feedback_id": "metrics_feedback::metrics_sib",
                    "consumer_id": "metrics_sib",
                    "title": "Metrics SIB feedback",
                    "feedback_status": "adoption_observed_locally",
                    "review_state": "adoption_visible",
                    "bound_metric_ids": ["sib"],
                }
            ],
        },
    )
    _write_json(
        runs_dir / "metric_pack_adapter_index.json",
        {
            "artifact_kind": "metric_pack_adapter_index",
            "generated_at": "2026-05-17T12:30:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "metric_pack_id": "sib",
                    "title": "SIB metric pack adapter",
                    "adapter_status": "ready_for_adapter_review",
                    "pack_status": "ready_for_index_review",
                    "input_count": 1,
                    "missing_input_count": 0,
                    "inputs": [
                        {
                            "input_id": "specification_signal",
                            "computability": "available",
                            "source_artifact": "runs/metric_signal_index.json",
                        }
                    ],
                }
            ],
        },
    )
    _write_json(
        runs_dir / "metric_pack_runs.json",
        {
            "artifact_kind": "metric_pack_runs",
            "generated_at": "2026-05-17T12:30:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "run_id": "metric_pack_run::sib::latest",
                    "metric_pack_id": "sib",
                    "title": "SIB metric pack run",
                    "run_status": "computed",
                    "review_state": "ready_for_review",
                    "computed_values": [{"metric_id": "sib", "score": 0.74, "status": "healthy"}],
                    "gaps": [],
                }
            ],
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

    def test_http_provider_recent_runs_reads_only_artifact_prefix(self) -> None:
        manifest = {
            "artifact_kind": "specgraph_static_artifact_manifest",
            "files": [
                {
                    "path": "runs/20260513T100001Z-SG-SPEC-0001-abcdef1.json",
                    "root": "runs",
                    "sha256": "0" * 64,
                    "size_bytes": 100_000,
                }
            ],
        }
        cache = specspace_provider.HttpArtifactCache(
            manifest=manifest,
            manifest_loaded_at=time.time(),
        )
        provider = specspace_provider.HttpSpecGraphProvider(
            base_url="https://artifact.test",
            cache=cache,
        )

        with mock.patch.object(
            specspace_provider,
            "http_get_text",
            return_value=(HTTPStatus.PARTIAL_CONTENT, '{"title":"Recent run"}', None),
        ) as get_text:
            status, body = provider.read_recent_runs(limit=1, since_iso=None)

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(body["events"][0]["title"], "Recent run")
        self.assertEqual(cache.text_by_path, {})
        get_text.assert_called_once_with(
            "https://artifact.test/runs/20260513T100001Z-SG-SPEC-0001-abcdef1.json",
            max_bytes=specspace_provider.HTTP_ARTIFACT_PREFIX_BYTES,
            range_bytes=specspace_provider.HTTP_ARTIFACT_PREFIX_BYTES,
            allow_truncated=True,
        )

    def test_http_artifact_text_cache_evicts_expired_entries(self) -> None:
        cache = specspace_provider.HttpArtifactCache(
            text_by_path={
                "runs/old.json": (0.0, "{}"),
                "runs/fresh.json": (time.time(), "{}"),
            },
        )
        provider = specspace_provider.HttpSpecGraphProvider(
            base_url="https://artifact.test",
            cache=cache,
            cache_ttl_seconds=30,
        )

        with mock.patch.object(
            specspace_provider,
            "http_get_text",
            return_value=(HTTPStatus.OK, '{"ok":true}', None),
        ):
            status, text, error = provider._read_artifact_text("runs/new.json")

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(text, '{"ok":true}')
        self.assertIsNone(error)
        self.assertNotIn("runs/old.json", cache.text_by_path or {})
        self.assertIn("runs/fresh.json", cache.text_by_path or {})
        self.assertIn("runs/new.json", cache.text_by_path or {})


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
        self.assertEqual(body["sources"]["specpm_registry"]["status"], "not_configured")

    def test_health_reports_configured_specpm_registry_source(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            runs_dir = root / "runs"
            spec_dir.mkdir(parents=True)
            runs_dir.mkdir()
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=runs_dir,
                specpm_registry_url="https://0al-spec.github.io/SpecPM/",
            )
            try:
                status, body = _get(f"{base}/api/v1/health")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["sources"]["specpm_registry"]["status"], "configured")
        self.assertEqual(body["sources"]["specpm_registry"]["path"], "https://0al-spec.github.io/SpecPM")

    def test_specpm_registry_v1_returns_status_and_packages(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            registry_root = root / "registry"
            _write_specpm_registry(registry_root)
            registry, registry_thread, registry_url = _start_static(registry_root)
            httpd, thread, base = _start(root / "dialogs", specpm_registry_url=registry_url)
            try:
                status, body = _get(f"{base}/api/v1/specpm/registry")
            finally:
                _stop(httpd, thread)
                _stop(registry, registry_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["status"], "configured")
        self.assertEqual(body["registry"]["kind"], "RemoteRegistryStatus")
        self.assertEqual(body["packages"]["kind"], "RemotePackageIndex")
        self.assertEqual(body["packages"]["package_count"], 1)

    def test_specpm_registry_v1_returns_package_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            registry_root = root / "registry"
            _write_specpm_registry(registry_root)
            registry, registry_thread, registry_url = _start_static(registry_root)
            httpd, thread, base = _start(root / "dialogs", specpm_registry_url=registry_url)
            try:
                status, body = _get(f"{base}/api/v1/specpm/registry/packages/specnode.core")
            finally:
                _stop(httpd, thread)
                _stop(registry, registry_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["status"], "configured")
        self.assertEqual(body["data"]["kind"], "RemotePackage")
        self.assertEqual(body["data"]["package"]["package_id"], "specnode.core")

    def test_specpm_registry_v1_returns_package_version_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            registry_root = root / "registry"
            _write_specpm_registry(registry_root)
            registry, registry_thread, registry_url = _start_static(registry_root)
            httpd, thread, base = _start(root / "dialogs", specpm_registry_url=registry_url)
            try:
                status, body = _get(
                    f"{base}/api/v1/specpm/registry/packages/specnode.core/versions/0.1.0",
                )
            finally:
                _stop(httpd, thread)
                _stop(registry, registry_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["status"], "configured")
        self.assertEqual(body["data"]["kind"], "RemotePackageVersion")
        self.assertEqual(body["data"]["package_id"], "specnode.core")
        self.assertEqual(body["data"]["version"], "0.1.0")

    def test_proposals_v1_combines_static_artifacts_and_local_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_proposal_viewer_artifacts(root / "runs")
            proposals_dir = root / "docs" / "proposals"
            proposals_dir.mkdir(parents=True)
            (proposals_dir / "0042_agent_context.md").write_text(
                "# Agent Context Bridge\n\n## Status\n\nDraft proposal\n\n"
                "This proposal connects selected SpecGraph context to the Agent Workbench.\n",
                encoding="utf-8",
            )
            httpd, thread, base = _start(root / "dialogs", specgraph_dir=root)
            try:
                status, body = _get(f"{base}/api/v1/proposals")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertEqual(body["artifact_kind"], "specspace_proposal_index")
        self.assertEqual(body["source"]["provider"], "file")
        self.assertEqual(body["entry_count"], 2)
        by_key = {entry["proposal_key"]: entry for entry in body["entries"]}
        proposal = by_key["proposal::0042"]
        self.assertEqual(proposal["title"], "Agent Context Bridge")
        self.assertEqual(proposal["status"], "Draft proposal")
        self.assertEqual(proposal["runtime_state"], "implemented")
        self.assertEqual(proposal["runtime_posture"], "synchronous_runtime_slice")
        self.assertEqual(proposal["promotion_status"], "bounded")
        self.assertEqual(proposal["trace_status"], "bounded")
        self.assertEqual(proposal["affected_spec_ids"], ["SG-SPEC-0001"])
        self.assertTrue(proposal["markdown"]["available"])
        self.assertEqual(
            proposal["markdown"]["content_excerpt"],
            "This proposal connects selected SpecGraph context to the Agent Workbench.",
        )
        self.assertEqual(
            proposal["markdown"]["content_preview"],
            "This proposal connects selected SpecGraph context to the Agent Workbench.",
        )
        lane = by_key["lane::governance_proposal::SG-SPEC-0002::runtime"]
        self.assertEqual(lane["authority_state"], "under_review")
        self.assertEqual(lane["proposal_type"], "governance_proposal")
        self.assertEqual(lane["affected_spec_ids"], ["SG-SPEC-0002"])
        self.assertEqual(body["filters"]["authority_state_counts"]["under_review"], 1)
        self.assertIn("SG-SPEC-0001", body["filters"]["affected_spec_ids"])
        self.assertEqual(body["sources"]["proposal_markdown"]["entry_count"], 1)

    def test_proposals_v1_degrades_when_optional_artifacts_are_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "proposal_spec_trace_index.json",
                {
                    "artifact_kind": "proposal_spec_trace_index",
                    "entry_count": 1,
                    "entries": [
                        {
                            "trace_entry_id": "proposal::0007",
                            "proposal_id": "0007",
                            "proposal_path": "docs/proposals/0007.md",
                            "title": "Trace-only proposal",
                            "status": "Draft proposal",
                            "spec_refs": [],
                            "mentioned_spec_ids": ["SG-SPEC-0007"],
                            "promotion_trace": {"status": "missing_trace"},
                            "next_gap": "attach_promotion_trace",
                        }
                    ],
                },
            )
            httpd, thread, base = _start(root / "dialogs", specgraph_dir=root)
            try:
                status, body = _get(f"{base}/api/v1/proposals")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["entry_count"], 1)
        self.assertEqual(body["entries"][0]["proposal_id"], "0007")
        self.assertEqual(body["sources"]["proposal_runtime_index"]["available"], False)
        self.assertEqual(body["sources"]["proposal_runtime_index"]["reason"], "missing_artifact")

    def test_metrics_v1_combines_static_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_metrics_viewer_artifacts(root / "runs")
            httpd, thread, base = _start(root / "dialogs", runs_dir=root / "runs")
            try:
                status, body = _get(f"{base}/api/v1/metrics")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertEqual(body["artifact_kind"], "specspace_metrics_index")
        self.assertEqual(body["source"]["provider"], "file")
        self.assertEqual(body["entry_count"], 7)
        self.assertEqual(body["filters"]["category_counts"]["metric_score"], 1)
        self.assertEqual(body["filters"]["category_counts"]["metric_signal"], 1)
        self.assertEqual(body["filters"]["category_counts"]["source_promotion"], 1)
        self.assertEqual(body["filters"]["category_counts"]["delivery"], 1)
        self.assertEqual(body["filters"]["category_counts"]["feedback"], 1)
        self.assertEqual(body["filters"]["category_counts"]["metric_pack_adapter"], 1)
        self.assertEqual(body["filters"]["category_counts"]["metric_pack_run"], 1)
        self.assertIn("SG-SPEC-0001", body["filters"]["reference_texts"])
        self.assertEqual(body["dashboard"]["metric_count"], 1)
        self.assertEqual(body["dashboard"]["metrics_delivery_entry_count"], 1)
        self.assertTrue(body["sources"]["graph_dashboard"]["available"])
        self.assertEqual(body["sources"]["graph_dashboard"]["entry_count"], 1)
        self.assertTrue(body["sources"]["metric_pack_runs"]["available"])

    def test_metrics_v1_degrades_when_optional_artifacts_are_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "metric_signal_index.json",
                {
                    "artifact_kind": "metric_signal_index",
                    "metrics": [
                        {
                            "metric_id": "specification_verifiability",
                            "title": "Specification Verifiability",
                            "status": "healthy",
                        }
                    ],
                },
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/metrics")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["entry_count"], 1)
        self.assertEqual(body["entries"][0]["category"], "metric_signal")
        self.assertEqual(body["entries"][0]["item_id"], "specification_verifiability")
        self.assertEqual(body["sources"]["graph_dashboard"]["available"], False)
        self.assertEqual(body["sources"]["graph_dashboard"]["reason"], "missing_artifact")

    def test_metrics_v1_rejects_non_object_file_artifact_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            (runs_dir / "metric_signal_index.json").write_text("[]", encoding="utf-8")
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/metrics")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["entry_count"], 0)
        self.assertEqual(body["entries"], [])
        self.assertEqual(body["sources"]["metric_signals"]["available"], False)
        self.assertEqual(body["sources"]["metric_signals"]["reason"], "invalid_json_root")
        self.assertEqual(
            body["sources"]["metric_signals"]["detail"],
            "JSON root is not an object",
        )

    def test_specpm_registry_v1_package_endpoint_requires_package_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(root / "dialogs", specpm_registry_url="https://example.invalid")
            try:
                status, body = _get(f"{base}/api/v1/specpm/registry/packages/")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "Missing SpecPM package id in path.")

    def test_specpm_registry_v1_version_endpoint_requires_version(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(root / "dialogs", specpm_registry_url="https://example.invalid")
            try:
                status, body = _get(f"{base}/api/v1/specpm/registry/packages/specnode.core/versions/")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "SpecPM package id and version are required in path.")

    def test_specpm_registry_v1_version_endpoint_requires_version_without_trailing_slash(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(root / "dialogs", specpm_registry_url="https://example.invalid")
            try:
                status, body = _get(f"{base}/api/v1/specpm/registry/packages/specnode.core/versions")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "SpecPM package id and version are required in path.")

    def test_specpm_registry_v1_rejects_dot_segment_package_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(root / "dialogs", specpm_registry_url="https://example.invalid")
            try:
                status, body = _get(f"{base}/api/v1/specpm/registry/packages/%2E%2E")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "SpecPM package id must not contain dot path segments.")

    def test_specpm_registry_v1_reports_not_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(root / "dialogs")
            try:
                status, body = _get(f"{base}/api/v1/specpm/registry")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertEqual(body["source"]["status"], "not_configured")

    def test_health_reports_deployment_metadata(self) -> None:
        env = {
            "SPECSPACE_VERSION": "0.0.7",
            "SPECSPACE_RELEASE_COMMIT": "c05f17df6bd3ae338f98a4694561d640bcfda6d1",
            "SPECSPACE_RELEASE_CREATED_AT": "2026-05-16T16:16:38Z",
            "SPECSPACE_API_IMAGE_REF": "ghcr.io/0al-spec/specspace-api@sha256:" + "1" * 64,
            "SPECSPACE_UI_IMAGE_REF": "ghcr.io/0al-spec/specspace-ui@sha256:" + "2" * 64,
        }
        with mock.patch.dict("os.environ", env, clear=False):
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
        self.assertEqual(body["deployment"], {
            "version": "0.0.7",
            "commit": "c05f17df6bd3ae338f98a4694561d640bcfda6d1",
            "created_at": "2026-05-16T16:16:38Z",
            "api_image_ref": "ghcr.io/0al-spec/specspace-api@sha256:" + "1" * 64,
            "ui_image_ref": "ghcr.io/0al-spec/specspace-ui@sha256:" + "2" * 64,
        })

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

    def test_spec_markdown_v1_exports_file_provider_subtree(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(
                spec_dir / "SG-SPEC-0001.yaml",
                {
                    **MINIMAL_SPEC,
                    "depends_on": ["SG-SPEC-0002"],
                    "specification": {
                        "objective": "Define the readonly export boundary.",
                        "decisions": [],
                    },
                },
            )
            _write_yaml(
                spec_dir / "SG-SPEC-0002.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-0002",
                    "title": "Spec Markdown Child",
                    "refines": ["SG-SPEC-0001"],
                    "acceptance": ["Child included"],
                },
            )
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/v1/spec-markdown?root={quote('SG-SPEC-0001')}&depth=2")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertEqual(body["root_id"], "SG-SPEC-0001")
        self.assertEqual(body["download_filename"], "SG-SPEC-0001.md")
        self.assertEqual(body["source"]["provider"], "file")
        self.assertEqual(body["manifest"]["node_count"], 2)
        self.assertEqual(body["manifest"]["nodes_included"], ["SG-SPEC-0001", "SG-SPEC-0002"])
        self.assertIn("# SG-SPEC-0001", body["markdown"])
        self.assertIn("## 1. SG-SPEC-0002", body["markdown"])
        self.assertIn("> Define the readonly export boundary.", body["markdown"])

    def test_spec_markdown_v1_rejects_invalid_depth(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/v1/spec-markdown?root=SG-SPEC-0001&depth=deep")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["parameter"], "depth")

    def test_spec_markdown_v1_reports_unknown_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/v1/spec-markdown?root=SG-SPEC-9999")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 404)
        self.assertEqual(body["root_id"], "SG-SPEC-9999")

    def test_spec_markdown_v1_reports_malformed_provider_data(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            (spec_dir / "SG-SPEC-0001.yaml").write_text("- not\n- a\n- mapping\n", encoding="utf-8")
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/v1/spec-markdown?root=SG-SPEC-0001")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "invalid_provider_data")
        self.assertEqual(body["load_errors"][0]["file_name"], "SG-SPEC-0001.yaml")

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
            _write_proposal_viewer_artifacts(runs_dir)
            _write_metrics_viewer_artifacts(runs_dir)
            _write_manifest(
                artifact_root,
                [
                    "specs/nodes/SG-SPEC-0001.yaml",
                    "runs/spec_activity_feed.json",
                    "runs/proposal_spec_trace_index.json",
                    "runs/proposal_lane_overlay.json",
                    "runs/proposal_runtime_index.json",
                    "runs/proposal_promotion_index.json",
                    "runs/graph_dashboard.json",
                    "runs/metrics_source_promotion_index.json",
                    "runs/metrics_delivery_workflow.json",
                    "runs/metrics_feedback_index.json",
                    "runs/metric_pack_adapter_index.json",
                    "runs/metric_pack_runs.json",
                    "runs/metric_signal_index.json",
                ],
            )
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base_url)
            try:
                health_status, health = _get(f"{base}/api/v1/health")
                graph_status, graph = _get(f"{base}/api/v1/spec-graph")
                node_status, node = _get(f"{base}/api/v1/spec-nodes/{quote('SG-SPEC-0001')}")
                markdown_status, markdown = _get(f"{base}/api/v1/spec-markdown?root={quote('SG-SPEC-0001')}")
                activity_status, activity = _get(f"{base}/api/v1/spec-activity?limit=1")
                trace_status, trace = _get(f"{base}/api/v1/proposal-spec-trace-index")
                proposals_status, proposals = _get(f"{base}/api/v1/proposals")
                metrics_status, metrics = _get(f"{base}/api/v1/metrics")
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
        self.assertEqual(markdown_status, 200)
        self.assertEqual(markdown["source"]["provider"], "http")
        self.assertEqual(markdown["source"]["artifact_base_url"], artifact_base_url)
        self.assertIn("# SG-SPEC-0001", markdown["markdown"])
        self.assertEqual(activity_status, 200)
        self.assertEqual(activity["data"]["entry_count"], 1)
        self.assertTrue(activity["path"].endswith("/runs/spec_activity_feed.json"))
        self.assertEqual(trace_status, 200)
        self.assertEqual(trace["data"]["artifact_kind"], "proposal_spec_trace_index")
        self.assertEqual(proposals_status, 200)
        self.assertEqual(proposals["source"]["provider"], "http")
        self.assertEqual(proposals["entry_count"], 2)
        self.assertEqual(proposals["sources"]["proposal_markdown"]["available"], False)
        self.assertEqual(proposals["entries"][0]["affected_spec_ids"], ["SG-SPEC-0001"])
        self.assertEqual(metrics_status, 200)
        self.assertEqual(metrics["source"]["provider"], "http")
        self.assertEqual(metrics["entry_count"], 7)
        self.assertTrue(metrics["sources"]["graph_dashboard"]["available"])
        self.assertIn("SG-SPEC-0001", metrics["filters"]["reference_texts"])

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
        self.assertEqual(body["reason"], "missing_artifact")
        self.assertEqual(body["artifact"], "runs/implementation_work_index.json")
        self.assertEqual(body["artifact_base_url"], artifact_base_url)


if __name__ == "__main__":
    unittest.main()
