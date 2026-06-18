import json
import os
import shutil
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
from urllib.request import Request, urlopen

import yaml

from viewer import agent_surfaces, server, specspace_provider


REPO_ROOT = Path(__file__).resolve().parent.parent
AGENT_WORKBENCH_FIXTURES = Path(__file__).resolve().parent / "fixtures" / "agent_workbench"

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
    agent_workbench_dir: Path | None = None,
    hyperprompt_binary: str = "",
    hyperprompt_resolved_binary: str | None = None,
    hyperprompt_work_dir: Path | None = None,
    hyperprompt_http_compile_enabled: bool = False,
    hyperprompt_compile_timeout_seconds: str | None = None,
    hyperprompt_max_input_bytes: str | None = None,
    hyperprompt_max_output_bytes: str | None = None,
    hyperprompt_bundle_retention_count: str | None = None,
    specspace_state_dir: Path | None = None,
) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.ViewerHandler)
    httpd.repo_root = REPO_ROOT
    httpd.dialog_dir = dialog_dir
    httpd.hyperprompt_binary = hyperprompt_binary
    httpd.hyperprompt_resolved_binary = hyperprompt_resolved_binary
    httpd.hyperprompt_checked_paths = [hyperprompt_binary] if hyperprompt_binary else []
    httpd.hyperprompt_resolution_source = "configured" if hyperprompt_resolved_binary else "missing"
    httpd.hyperprompt_work_dir = hyperprompt_work_dir
    httpd.hyperprompt_http_compile_enabled = hyperprompt_http_compile_enabled
    httpd.hyperprompt_compile_timeout_seconds = hyperprompt_compile_timeout_seconds
    httpd.hyperprompt_max_input_bytes = hyperprompt_max_input_bytes
    httpd.hyperprompt_max_output_bytes = hyperprompt_max_output_bytes
    httpd.hyperprompt_bundle_retention_count = hyperprompt_bundle_retention_count
    httpd.hyperprompt_compile_available = False
    httpd.compile_available = False
    httpd.spec_dir = spec_dir
    httpd.spec_watcher = server.SpecWatcher(spec_dir) if spec_dir else None
    httpd.specgraph_dir = specgraph_dir
    httpd.runs_dir = runs_dir
    httpd.runs_watcher = server.RunsWatcher(runs_dir) if runs_dir else None
    httpd.artifact_base_url = artifact_base_url
    httpd.specpm_registry_url = specpm_registry_url
    httpd.agent_workbench_dir = agent_workbench_dir
    httpd.specspace_state_dir = specspace_state_dir or (dialog_dir.parent / "specspace-state")
    httpd.agent_available = False
    thread = threading.Thread(target=httpd.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
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


def _post(url: str, payload: dict) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urlopen(request)
        return resp.status, json.loads(resp.read())
    except HTTPError as exc:
        return exc.code, json.loads(exc.read())


def _write_hyperprompt_stub(path: Path, *, exit_code: int = 0, sleep_seconds: int = 0) -> None:
    if exit_code == 0:
        path.write_text(
            f"""#!/bin/sh
sleep {sleep_seconds}
out=""
manifest=""
while [ $# -gt 0 ]; do
  case "$1" in
    --output) shift; out="$1" ;;
    --manifest) shift; manifest="$1" ;;
  esac
  shift
done
[ -n "$out" ] && printf '# Compiled SpecSpace export\\n' > "$out"
[ -n "$manifest" ] && printf '{{"compiled":true}}\\n' > "$manifest"
exit 0
""",
            encoding="utf-8",
        )
    else:
        path.write_text(
            f"#!/bin/sh\necho 'syntax error' >&2\nexit {exit_code}\n",
            encoding="utf-8",
        )
    path.chmod(0o755)


class QuietStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        return


def _start_static(root: Path) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    handler = partial(QuietStaticHandler, directory=str(root))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
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


def _write_specgraph_core_ontology_artifacts(root: Path) -> None:
    ir_path = root / "ontology" / "specgraph-core" / "ontology.normalized.json"
    ir_path.parent.mkdir(parents=True)
    _write_json(
        ir_path,
        {
            "id": "org.0al.specgraph.core",
            "namespace": "sgcore",
            "version": "0.1.0",
            "classes": [
                {
                    "id": "SpecGraph",
                    "fqid": "sgcore:SpecGraph",
                    "uri": "ontology://org.0al.specgraph.core/classes/SpecGraph",
                    "description": "Executable product ontology.",
                },
                {
                    "id": "Spec",
                    "fqid": "sgcore:Spec",
                    "uri": "ontology://org.0al.specgraph.core/classes/Spec",
                    "description": "Versioned specification artifact.",
                },
                {
                    "id": "Requirement",
                    "fqid": "sgcore:Requirement",
                    "uri": "ontology://org.0al.specgraph.core/classes/Requirement",
                    "description": "Verifiable obligation.",
                },
            ],
            "relations": [
                {
                    "id": "definesRequirement",
                    "fqid": "sgcore:definesRequirement",
                    "domain": "sgcore:Spec",
                    "range": "sgcore:Requirement",
                    "uri": "ontology://org.0al.specgraph.core/relations/definesRequirement",
                }
            ],
        },
    )

    runs_dir = root / "runs"
    runs_dir.mkdir()
    _write_json(
        runs_dir / "ontology_package_index.json",
        {
            "artifact_kind": "ontology_package_index",
            "packages": [
                {
                    "package_id": "org.0al.specgraph.core",
                    "namespace": "sgcore",
                    "version": "0.1.0",
                    "materialized_ir": "ontology/specgraph-core/ontology.normalized.json",
                    "lock": {"package_ref": "org.0al.specgraph.core@0.1.0"},
                }
            ],
            "summary": {"resolved_ref_count": 2, "unresolved_ref_count": 1},
        },
    )
    _write_json(
        runs_dir / "ontology_binding_preview.json",
        {
            "artifact_kind": "ontology_binding_preview",
            "package_ref": "org.0al.specgraph.core@0.1.0",
            "source_fixture": "tests/fixtures/ontology_import/specgraph-core/import-fixture.yaml",
        },
    )
    _write_json(
        runs_dir / "ontology_import_gap_index.json",
        {
            "artifact_kind": "ontology_import_gap_index",
            "source_fixture": "tests/fixtures/ontology_import/specgraph-core/import-fixture.yaml",
            "gaps": [{"gap_id": "ontology-gap-sgcore-claimcalibration"}],
            "summary": {"gap_count": 1},
        },
    )
    _write_json(
        runs_dir / "ontology_compatibility_diff_preview.json",
        {
            "artifact_kind": "ontology_compatibility_diff_preview",
            "source_report": (
                "tests/fixtures/ontology_import/specgraph-core/compatibility/"
                "compatibility-report.yaml"
            ),
            "compatible": True,
            "from_ref": "org.0al.specgraph.core@0.1.0",
            "to_ref": "org.0al.specgraph.core@0.2.0",
            "changes": {
                "added_classes": ["sgcore:ClaimCalibration"],
                "breaking_changes": [],
            },
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


def _ontology_semantic_review_surface() -> dict:
    return {
        "artifact_kind": "ontology_semantic_review_surface",
        "schema_version": 1,
        "proposal_id": "0108",
        "policy_basis": ["docs/proposals/0103_semantic_control.md"],
        "source_policy": "tools/ontology_semantic_control_policy.json",
        "source_artifacts": {
            "semantic_context_pack": "runs/ontology_semantic_context_pack.json",
            "semantic_lint_report": "runs/ontology_semantic_lint_report.json",
            "ontology_delta_candidate_review_packet": (
                "runs/ontology_delta_candidate_review_packet.json"
            ),
        },
        "target": {
            "target_kind": "proposal",
            "target_ref": "SG-RFC-0108",
        },
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "grounding_summary": {
            "source_context_status": "ready_with_gaps",
            "source_lint_status": "blocked_relation_conflict",
            "source_delta_candidate_status": "review_required",
            "package_count": 1,
            "accepted_term_count": 1,
            "accepted_relation_count": 1,
            "alias_count": 1,
            "deprecated_term_count": 1,
            "relation_conflict_count": 1,
            "unresolved_gap_count": 1,
            "governance_evidence_count": 1,
        },
        "display_sections": [
            "grounding_summary",
            "blocking_findings",
            "review_required_findings",
            "delta_candidates",
            "review_actions",
            "authority_boundary",
        ],
        "blocking_findings": [
            {
                "term": "allows policy",
                "classification": "relation_conflict",
                "suggested_action": "use_accepted_relation",
            }
        ],
        "review_required_findings": [
            {
                "term": "CASFunction",
                "classification": "candidate_delta_term",
                "suggested_action": "emit_ontology_gap",
            }
        ],
        "delta_candidates": [
            {
                "candidate_id": "ontology-delta-candidate-examcalc-casfunction",
                "term": "examcalc:CASFunction",
                "review_state": "needs_ontology_owner_review",
            }
        ],
        "review_items": [
            {
                "item_id": "semantic-finding-allows-policy",
                "item_kind": "semantic_finding",
                "review_state": "blocked",
                "source": "ontology_semantic_lint_report.blocking_findings",
                "term": "allows policy",
                "classification": "relation_conflict",
                "suggested_action": "use_accepted_relation",
            },
            {
                "item_id": "ontology-delta-candidate-examcalc-casfunction",
                "item_kind": "ontology_delta_candidate",
                "review_state": "needs_ontology_owner_review",
                "source": "ontology_delta_candidate_review_packet.candidates",
                "term": "examcalc:CASFunction",
                "suggested_actions": [
                    "approve_for_ontology_package_draft",
                    "reject_candidate",
                    "request_clarification",
                ],
            },
        ],
        "review_actions": [
            {
                "action": "use_accepted_relation",
                "source": "ontology_semantic_lint_report.recommended_actions",
                "term_count": 1,
                "terms": ["allows policy"],
                "writes_ontology_package": False,
                "mutates_canonical_specs": False,
            },
            {
                "action": "approve_for_ontology_package_draft",
                "source": "ontology_delta_candidate_review_packet.review_actions",
                "effect": "Allows Ontology owner to draft package changes outside SpecSpace.",
                "candidate_count": 1,
                "writes_ontology_package": False,
                "mutates_canonical_specs": False,
            },
        ],
        "consumer_boundary": {
            "for_supervisor_gate_evidence": True,
            "for_specspace_review_surface": True,
            "may_execute_prompt_agent": False,
            "may_write_ontology_package": False,
            "may_update_ontology_lockfile": False,
            "may_mutate_canonical_specs": False,
            "may_mark_candidate_accepted": False,
        },
        "authority_boundary": {
            "semantic_review_surface_is_authority": False,
        },
        "summary": {
            "status": "blocked_relation_conflict",
            "blocking_count": 1,
            "review_required_count": 1,
            "candidate_count": 1,
            "review_item_count": 2,
            "next_gap": "build_specspace_semantic_review_surface_consumer",
        },
        "output_artifact": "runs/ontology_semantic_review_surface.json",
    }


def _ontology_review_dashboard() -> dict:
    surface = _ontology_semantic_review_surface()
    gate = {
        "gate_state": "blocked",
        "outcome": "semantic_gate_blocked",
        "required_human_action": "resolve_blocking_ontology_semantic_findings",
        "blocking_item_ids": ["semantic-finding-allows-policy"],
        "review_required_item_ids": ["ontology-delta-candidate-examcalc-casfunction"],
        "candidate_item_ids": ["ontology-delta-candidate-examcalc-casfunction"],
    }
    draft_request = {
        "intake_id": "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction",
        "candidate_id": "ontology-delta-candidate-examcalc-casfunction",
        "term": "examcalc:CASFunction",
        "review_state": "needs_ontology_owner_review",
        "intake_state": "blocked_by_semantic_gate",
        "required_human_action": "resolve_blocking_ontology_semantic_findings",
        "blocked_by_gate_state": "blocked",
        "blocking_item_ids": ["semantic-finding-allows-policy"],
        "draft_delta": {
            "operation": "draft_ontology_concept",
            "ref": "examcalc:CASFunction",
        },
        "writes_ontology_package": False,
        "updates_ontology_lockfile": False,
        "mutates_canonical_specs": False,
        "marks_candidate_accepted": False,
    }
    closed_loop_entry = {
        "evidence_id": "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-casfunction",
        "candidate_id": "ontology-delta-candidate-examcalc-casfunction",
        "intake_id": draft_request["intake_id"],
        "term": "examcalc:CASFunction",
        "source_intake_state": "blocked_by_semantic_gate",
        "evidence_state": "blocked_by_semantic_gate",
        "specgraph_review_state": "blocked",
        "required_human_action": "resolve_blocking_ontology_semantic_findings",
        "ontology_decision_ref": "",
        "accepted_ontology_delta": False,
        "closes_semantic_gate": False,
        "mutates_canonical_specs": False,
        "blocking_item_ids": ["semantic-finding-allows-policy"],
        "source_artifacts": {},
    }
    return {
        "artifact_kind": "ontology_review_dashboard",
        "schema_version": 1,
        "proposal_id": "0113",
        "policy_basis": ["docs/proposals/0100_ontology_grounded_semantic_control.md"],
        "source_policy": "tools/ontology_semantic_control_policy.json",
        "source_artifacts": {
            **surface["source_artifacts"],
            "semantic_review_surface": "runs/ontology_semantic_review_surface.json",
            "supervisor_semantic_gate": "runs/ontology_supervisor_semantic_gate.json",
            "ontology_delta_draft_intake": "runs/ontology_delta_draft_intake.json",
            "ontology_closed_loop_evidence": "runs/ontology_closed_loop_evidence.json",
        },
        "target": {
            "target_kind": "proposal",
            "target_ref": "SG-RFC-0113",
        },
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "dashboard_sections": [
            "status_summary",
            "gate",
            "blocking_items",
            "review_required_items",
            "delta_candidates",
            "draft_requests",
            "closed_loop_entries",
            "review_actions",
            "source_artifacts",
            "authority_boundary",
        ],
        "status_summary": {
            "status": "blocked_by_semantic_gate",
            "gate_state": "blocked",
            "review_surface_status": "blocked_relation_conflict",
            "intake_status": "blocked_by_semantic_gate",
            "closed_loop_status": "blocked_by_semantic_gate",
            "blocking_count": 1,
            "review_required_count": 1,
            "candidate_count": 1,
            "draft_request_count": 1,
            "evidence_entry_count": 1,
            "pending_decision_count": 0,
            "blocked_entry_count": 1,
            "required_human_action": "resolve_blocking_ontology_semantic_findings",
            "next_gap": "build_specspace_rich_ontology_review_panel",
        },
        "gate": gate,
        "blocking_items": [surface["review_items"][0]],
        "review_required_items": [surface["review_items"][1]],
        "delta_candidates": surface["delta_candidates"],
        "draft_requests": [draft_request],
        "closed_loop_entries": [closed_loop_entry],
        "review_actions": surface["review_actions"],
        "consumer_boundary": {
            "for_specgraph_review_dashboard": True,
            "for_specspace_review_dashboard": True,
            "may_execute_prompt_agent": False,
            "may_write_ontology_package": False,
            "may_update_ontology_lockfile": False,
            "may_mutate_canonical_specs": False,
            "may_mark_candidate_accepted": False,
            "may_import_owner_decision": False,
            "may_close_semantic_gate": False,
        },
        "authority_boundary": {
            "ontology_review_dashboard_is_authority": False,
        },
        "output_artifact": "runs/ontology_review_dashboard.json",
    }


def _ontology_owner_decision_review() -> dict:
    source_artifacts = {
        **_ontology_review_dashboard()["source_artifacts"],
        "ontology_review_dashboard": "runs/ontology_review_dashboard.json",
        "ontology_owner_decision_report": "runs/ontology_owner_decision_report.json",
    }
    accepted = {
        "preview_id": "ontology-decision-import-preview-accept-casfunction",
        "decision_id": "ontology-owner-decision-accept-casfunction",
        "candidate_id": "ontology-delta-candidate-examcalc-casfunction",
        "intake_id": "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-casfunction",
        "decision_state": "accepted",
        "ontology_decision_ref": "ontology-decision://edu.university.examcalc/0.1.0/casfunction/accepted",
        "decided_by": "ontology-owner",
        "decided_at": "2026-06-13T00:00:00Z",
        "reason": "accepted domain term",
        "accepted_ontology_delta": True,
        "matched_closed_loop_evidence_id": "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-casfunction",
        "matched_source_intake_state": "awaiting_ontology_owner_review",
        "matched_evidence_state": "pending_ontology_owner_decision",
        "preview_state": "ready_for_operator_review",
        "required_human_action": "operator_review_ontology_owner_decision",
        "import_recommended": True,
        "imports_into_specgraph": False,
        "closes_semantic_gate": False,
        "mutates_canonical_specs": False,
        "writes_ontology_package": False,
        "updates_ontology_lockfile": False,
    }
    rejected = {
        "preview_id": "ontology-decision-import-preview-reject-legacyterm",
        "decision_id": "ontology-owner-decision-reject-legacyterm",
        "candidate_id": "ontology-delta-candidate-examcalc-legacyterm",
        "intake_id": "ontology-delta-draft-intake-ontology-delta-candidate-examcalc-legacyterm",
        "decision_state": "rejected",
        "ontology_decision_ref": "ontology-decision://edu.university.examcalc/0.1.0/legacyterm/rejected",
        "decided_by": "ontology-owner",
        "decided_at": "2026-06-13T00:00:00Z",
        "reason": "ambiguous legacy term",
        "accepted_ontology_delta": False,
        "matched_closed_loop_evidence_id": "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-legacyterm",
        "matched_source_intake_state": "awaiting_ontology_owner_review",
        "matched_evidence_state": "pending_ontology_owner_decision",
        "preview_state": "rejected_by_owner",
        "required_human_action": "record_owner_rejection_without_import",
        "import_recommended": False,
        "imports_into_specgraph": False,
        "closes_semantic_gate": False,
        "mutates_canonical_specs": False,
        "writes_ontology_package": False,
        "updates_ontology_lockfile": False,
    }
    return {
        "artifact_kind": "ontology_decision_import_preview",
        "schema_version": 1,
        "proposal_id": "0115",
        "policy_basis": ["docs/proposals/0100_ontology_grounded_semantic_control.md"],
        "source_policy": "tools/ontology_semantic_control_policy.json",
        "source_artifacts": source_artifacts,
        "target": {
            "target_kind": "proposal",
            "target_ref": "SG-RFC-0115",
        },
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "decision_import_previews": [accepted, rejected],
        "ignored_owner_decisions": [
            {
                "decision_id": "ontology-owner-decision-stale-example",
                "candidate_id": "ontology-delta-candidate-stale-example",
                "intake_id": "ontology-delta-draft-intake-stale-example",
                "decision_state": "accepted",
                "reason": "missing_closed_loop_evidence",
            }
        ],
        "consumer_boundary": {
            "for_specgraph_decision_import_preview": True,
            "for_specspace_review_dashboard": True,
            "may_execute_prompt_agent": False,
            "may_write_ontology_package": False,
            "may_update_ontology_lockfile": False,
            "may_mutate_canonical_specs": False,
            "may_mark_candidate_accepted": False,
            "may_apply_preview": False,
            "may_import_into_specgraph": False,
            "may_close_semantic_gate": False,
        },
        "authority_boundary": {
            "ontology_decision_import_preview_is_authority": False,
            "prompt_agent_execution_allowed": False,
            "automatic_import_lock_update": False,
            "automatic_canonical_node_update": False,
            "canonical_mutations_allowed": False,
        },
        "summary": {
            "status": "ready_for_operator_review",
            "preview_count": 2,
            "accepted_count": 1,
            "rejected_count": 1,
            "clarification_count": 0,
            "importable_count": 1,
            "blocked_count": 0,
            "unmatched_count": 0,
            "ignored_decision_count": 1,
            "next_gap": "build_specspace_owner_decision_review_surface",
        },
        "output_artifact": "runs/ontology_decision_import_preview.json",
    }


def _write_agent_surface_artifacts(runs_dir: Path) -> None:
    runs_dir.mkdir(parents=True, exist_ok=True)
    _write_json(
        runs_dir / "supervisor_executor_adapter_index.json",
        {
            "artifact_kind": "supervisor_executor_adapter_index",
            "schema_version": 1,
            "generated_at": "2026-06-06T10:00:00Z",
            "summary": {
                "backend_count": 1,
                "available_backend_count": 0,
                "default_backend_id": "codex",
                "agent_passport_cli_status": "available",
                "next_gap": "none",
            },
            "entries": [
                {
                    "backend_id": "codex",
                    "display_name": "Codex CLI",
                    "backend_status": "not_applicable_in_producer_environment",
                    "authority_state": "default",
                    "runtime_environment": {
                        "producer_environment": "static_publish_environment",
                        "intended_environment": "local_operator_environment",
                        "executable_probe_scope": "current_process_environment",
                        "backend_status_semantics": (
                            "executable_probe_not_required_for_producer_environment"
                        ),
                        "static_publish_executable_required": False,
                        "local_operator_executable_required": True,
                        "producer_environment_executable_required": False,
                        "producer_environment_execution_suppressed": True,
                        "missing_executable_is_static_publish_gap": True,
                        "operator_next_action": "run_in_intended_runtime_environment",
                    },
                    "command_surface": "cli",
                    "protocol_contract": "run_outcome_blocker",
                    "passport_ref": "agent-passport://executors/codex-cli/0.1.0",
                    "passport_validation": {
                        "required": False,
                        "validation_state": "not_attempted",
                        "tool_status": "available",
                    },
                    "smoke_status": "not_run",
                    "canonical_trial_allowed": False,
                    "safe_next_action": "run_in_intended_runtime_environment",
                    "capability_gaps": [{"gap": "producer_environment_not_executor_runtime"}],
                }
            ],
        },
    )
    _write_json(
        runs_dir / "known_agent_passport_index.json",
        {
            "artifact_kind": "known_agent_passport_index",
            "schema_version": 1,
            "generated_at": "2026-06-06T10:00:00Z",
            "summary": {"agent_count": 1, "verified_count": 0},
            "entries": [
                {
                    "agent_surface": "specgraph.executor.codex",
                    "surface_type": "executor_backend",
                    "passport_ref": "agent-passport://executors/codex-cli/0.1.0",
                    "verification_state": "V3_schema_valid",
                    "runtime_enforcement_state": "policy_only",
                    "requires_passport": True,
                    "executor_backend_id": "codex",
                    "verification_result": {
                        "verification_status": "valid",
                        "valid": True,
                        "tool_status": "available",
                    },
                }
            ],
        },
    )
    _write_json(
        runs_dir / "agent_passport_verification_report.json",
        {
            "artifact_kind": "agent_passport_verification_report",
            "schema_version": 1,
            "generated_at": "2026-06-06T10:00:00Z",
            "summary": {
                "entry_count": 1,
                "valid_count": 1,
                "invalid_count": 0,
                "unavailable_count": 0,
                "tool_unavailable_count": 0,
                "agent_passport_cli_status": "available",
                "next_gap": "none",
            },
            "entries": [
                {
                    "agent_surface": "specgraph.executor.codex",
                    "surface_type": "executor_backend",
                    "passport_ref": "agent-passport://executors/codex-cli/0.1.0",
                    "verification_status": "valid",
                    "verification_state": "V3_schema_valid",
                    "valid": True,
                    "tool_status": "available",
                    "source_proposal_ids": ["0056", "0059", "0066", "0071"],
                }
            ],
        },
    )
    _write_json(
        runs_dir / "agent_surface_index.json",
        {
            "artifact_kind": "agent_surface_index",
            "schema_version": 1,
            "generated_at": "2026-06-06T10:00:00Z",
            "summary": {
                "surface_count": 2,
                "missing_passport_count": 0,
                "agent_passport_cli_status": "available",
                "next_gap": "close_agent_verification_gaps",
            },
            "surfaces": [
                {
                    "surface_id": "specgraph.supervisor.executor_adapter",
                    "title": "Supervisor executor adapter gateway",
                    "surface_type": "graph_runtime",
                    "source": "policy",
                    "source_proposal_ids": ["0056", "0059", "0077"],
                    "requires_passport": True,
                    "launches_agents": True,
                    "prepares_handoffs": True,
                    "passport_ref": "agent-passport://specgraph/supervisor-executor-adapter/0.1.0",
                    "verification_state": "V3_schema_valid",
                    "runtime_enforcement_state": "policy_only",
                },
                {
                    "surface_id": "specgraph.executor.codex",
                    "title": "Codex executor backend",
                    "surface_type": "executor_backend",
                    "source": "supervisor_executor_adapter_index",
                    "source_proposal_ids": ["0056", "0059"],
                    "requires_passport": True,
                    "launches_agents": True,
                    "prepares_handoffs": False,
                    "passport_ref": "agent-passport://executors/codex-cli/0.1.0",
                    "verification_state": "V2_passport_referenced",
                    "runtime_enforcement_state": "policy_only",
                    "executor_backend_id": "codex",
                    "backend_status": "not_applicable_in_producer_environment",
                    "runtime_environment": {
                        "producer_environment": "static_publish_environment",
                        "intended_environment": "local_operator_environment",
                        "executable_probe_scope": "current_process_environment",
                        "backend_status_semantics": (
                            "executable_probe_not_required_for_producer_environment"
                        ),
                        "static_publish_executable_required": False,
                        "local_operator_executable_required": True,
                        "producer_environment_executable_required": False,
                        "producer_environment_execution_suppressed": True,
                        "missing_executable_is_static_publish_gap": True,
                        "operator_next_action": "run_in_intended_runtime_environment",
                    },
                    "passport_validation": {
                        "required": False,
                        "validation_state": "not_attempted",
                        "tool_status": "available",
                    },
                }
            ],
        },
    )
    _write_json(
        runs_dir / "agent_runtime_enforcement_evidence_index.json",
        {
            "artifact_kind": "agent_runtime_enforcement_evidence_index",
            "schema_version": 1,
            "generated_at": "2026-06-06T10:00:00Z",
            "summary": {
                "evidence_count": 1,
                "passed_count": 1,
                "failed_count": 0,
                "missing_count": 0,
                "next_gap": "review_runtime_enforcement_evidence",
            },
            "entries": [
                {
                    "evidence_id": (
                        "agent_runtime_enforcement_evidence::"
                        "specgraph.supervisor.executor_adapter::runtime_smoke"
                    ),
                    "agent_surface": "specgraph.supervisor.executor_adapter",
                    "surface_id": "specgraph.supervisor.executor_adapter",
                    "evidence_kind": "runtime_smoke",
                    "runtime_enforcement_state": "policy_only",
                    "posture_claim": "runtime_enforcement_policy_only",
                    "status": "passed",
                    "evidence_ref": (
                        "runs/agent_runtime_enforcement_evidence/"
                        "supervisor-executor-adapter-smoke.json"
                    ),
                    "result_status": "passed",
                    "source_proposal_ids": ["0056", "0059", "0076", "0077"],
                }
            ],
        },
    )
    evidence_dir = runs_dir / "agent_runtime_enforcement_evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    _write_json(
        evidence_dir / "supervisor-executor-adapter-smoke.json",
        {
            "artifact_kind": "agent_runtime_enforcement_evidence",
            "schema_version": 1,
            "surface_id": "specgraph.supervisor.executor_adapter",
            "evidence_kind": "runtime_smoke",
            "status": "passed",
            "safe_evidence_ref": (
                "runs/agent_runtime_enforcement_evidence/"
                "supervisor-executor-adapter-smoke.json"
            ),
            "evidence": {
                "kind": "runtime_smoke",
                "checks": [
                    {
                        "check_id": "executor_adapter_invocation_boundary",
                        "status": "passed",
                        "message": (
                            "Supervisor executor adapter policy uses declarative CLI executable "
                            "lookup, and the generated adapter index does not persist executable "
                            "paths or command lines."
                        ),
                    }
                ],
            },
        },
    )
    _write_json(
        runs_dir / "agent_verification_gap_index.json",
        {
            "artifact_kind": "agent_verification_gap_index",
            "schema_version": 1,
            "generated_at": "2026-06-06T10:00:00Z",
            "summary": {
                "gap_count": 1,
                "missing_passport_count": 0,
                "runtime_enforcement_policy_only_count": 1,
                "runtime_enforcement_unknown_count": 0,
                "agent_passport_cli_status": "available",
                "next_gap": "close_agent_verification_gaps",
            },
            "gaps": [
                {
                    "gap_id": "agent_gap::specgraph.executor.codex::runtime_enforcement",
                    "agent_surface": "specgraph.executor.codex",
                    "surface_type": "executor_backend",
                    "gap": "runtime_enforcement_policy_only",
                    "severity": "low",
                    "reason": "Runtime enforcement posture is known but policy-only.",
                    "next_action": "define_runtime_enforcement_runtime",
                    "source_proposal_ids": ["0059"],
                    "source_artifacts": ["runs/agent_surface_index.json"],
                }
            ],
        },
    )
    _write_json(
        runs_dir / "external_consumer_handoff_packets.json",
        {
            "artifact_kind": "external_consumer_handoff_packets",
            "schema_version": 1,
            "generated_at": "2026-06-06T10:00:00Z",
            "entry_count": 1,
            "entries": [
                {
                    "handoff_id": "external_consumer_handoff::specspace",
                    "consumer_id": "specspace",
                    "handoff_status": "ready_for_handoff",
                    "review_state": "ready_for_review",
                    "next_gap": "review_handoff_packet",
                    "source_gap": "specspace_agent_surface_visibility",
                    "source_proposal_ids": ["0065", "0068"],
                    "artifact_contract": {
                        "required_artifacts": [
                            "runs/supervisor_executor_adapter_index.json",
                            "runs/agent_surface_index.json",
                            "runs/known_agent_passport_index.json",
                            "runs/agent_passport_verification_report.json",
                            "runs/agent_verification_gap_index.json",
                        ]
                    },
                    "expected_consumer_behavior": {
                        "surface": "utility_panel",
                        "mode": "readonly",
                    },
                    "evidence_requirements": {
                        "evidence_kind": "report_only",
                    },
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
    def test_agent_surface_runtime_environment_preserves_unknown_values(self) -> None:
        payload = agent_surfaces._runtime_environment(
            {
                "producer_environment": "static_publish_environment",
                "static_publish_executable_required": False,
                "producer_environment_execution_suppressed": True,
            }
        )

        self.assertIsNotNone(payload)
        assert payload is not None
        self.assertEqual(payload["producer_environment"], "static_publish_environment")
        self.assertIsNone(payload["intended_environment"])
        self.assertIs(payload["static_publish_executable_required"], False)
        self.assertIsNone(payload["local_operator_executable_required"])
        self.assertIsNone(payload["producer_environment_executable_required"])
        self.assertIs(payload["producer_environment_execution_suppressed"], True)

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
                "This proposal connects selected SpecGraph context to the Agent Workbench.\n"
                "\n## Details\n\nFull proposal body stays visible in the detail panel.\n",
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
        self.assertIn("# Agent Context Bridge", proposal["markdown"]["content_body"])
        self.assertIn("Full proposal body stays visible", proposal["markdown"]["content_body"])
        lane = by_key["lane::governance_proposal::SG-SPEC-0002::runtime"]
        self.assertEqual(lane["authority_state"], "under_review")
        self.assertEqual(lane["proposal_type"], "governance_proposal")
        self.assertEqual(lane["affected_spec_ids"], ["SG-SPEC-0002"])
        self.assertEqual(body["filters"]["authority_state_counts"]["under_review"], 1)
        self.assertIn("SG-SPEC-0001", body["filters"]["affected_spec_ids"])
        self.assertEqual(body["sources"]["proposal_markdown"]["entry_count"], 1)

    def test_practical_ontology_v1_returns_curated_core_seed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(
                spec_dir / "SG-SPEC-0001.yaml",
                {
                    **MINIMAL_SPEC,
                    "title": "SpecGraph Ontology Boundary",
                    "depends_on": ["SG-SPEC-0002"],
                    "specification": {
                        "objective": "Define vocabulary for SpecGraph ontology work.",
                        "node_kinds": [{"name": "OntologyBinding", "description": "Term binding."}],
                        "edge_kinds": [{"name": "USES_ONTOLOGY"}],
                        "terminology": {
                            404: "Not Found",
                            "500": "Server Error",
                            "provenance_record": (
                                "A structured metadata envelope attached to a canonical node."
                            )
                        },
                    },
                },
            )
            _write_yaml(
                spec_dir / "SG-SPEC-0002.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-0002",
                    "title": "SpecSpace Review Surface",
                    "specification": {"objective": "Expose review vocabulary in SpecSpace."},
                },
            )
            proposals_dir = root / "docs" / "proposals"
            proposals_dir.mkdir(parents=True)
            (proposals_dir / "0100_ontology_grounding.md").write_text(
                "# Ontology Grounding\n\nMentions SG-SPEC-0001 and fixes accepted vocabulary.\n",
                encoding="utf-8",
            )
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir, specgraph_dir=root)
            try:
                status, body = _get(f"{base}/api/v1/practical-ontology")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["artifact_kind"], "specspace_practical_ontology")
        self.assertTrue(body["read_only"])
        self.assertFalse(body["canonical_mutations_allowed"])
        self.assertFalse(body["authority_boundary"]["practical_ontology_is_authority"])
        self.assertFalse(body["authority_boundary"]["derived_from_specgraph_sources"])
        self.assertTrue(body["authority_boundary"]["curated_from_specgraph_seed"])
        self.assertEqual(body["source"]["ontology_mode"], "curated_core_seed")
        labels = {entry["label"] for entry in body["terms"]}
        self.assertIn("SpecGraph", labels)
        self.assertIn("Spec", labels)
        self.assertIn("Node", labels)
        self.assertIn("Edge", labels)
        self.assertIn("Requirement", labels)
        self.assertIn("AcceptanceCriterion", labels)
        self.assertIn("CodeSurface", labels)
        self.assertNotIn("SpecGraph Ontology Boundary", labels)
        self.assertNotIn("OntologyBinding", labels)
        self.assertNotIn("provenance_record", labels)
        self.assertNotIn("404", labels)
        self.assertNotIn("500", labels)
        self.assertNotIn("Ontology Grounding", labels)
        by_label = {entry["label"]: entry for entry in body["terms"]}
        self.assertEqual(
            by_label["SpecGraph"]["canonical_ref"],
            "SG-SPEC-0001",
        )
        self.assertNotIn("domain.a", {entry["domain_id"] for entry in body["domains"]})
        self.assertEqual(body["topology_edges"], [])
        self.assertEqual(body["proposal_references"], [])
        semantic_relation_pairs = {
            (entry["source_term"], entry["relation"], entry["target_term"])
            for entry in body["relations"]
        }
        self.assertIn(("SpecGraph", "contains", "Node"), semantic_relation_pairs)
        self.assertIn(("Spec", "defines", "Requirement"), semantic_relation_pairs)
        self.assertIn(("Requirement", "is_validated_by", "AcceptanceCriterion"), semantic_relation_pairs)
        self.assertEqual(by_label["SpecGraph"]["source_refs"], ["specs/nodes/SG-SPEC-0001.yaml#specification.seed"])
        self.assertEqual(body["summary"]["semantic_relation_count"], len(body["relations"]))
        self.assertEqual(body["summary"]["topology_edge_count"], len(body["topology_edges"]))
        self.assertEqual(
            body["summary"]["proposal_reference_count"],
            len(body["proposal_references"]),
        )

    def test_practical_ontology_v1_uses_conceptual_seed_ref_when_seed_file_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(
                spec_dir / "SG-SPEC-0002.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-0002",
                    "title": "Unrelated Spec",
                },
            )
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir, specgraph_dir=root)
            try:
                status, body = _get(f"{base}/api/v1/practical-ontology")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        by_label = {entry["label"]: entry for entry in body["terms"]}
        self.assertEqual(
            by_label["SpecGraph"]["source_refs"],
            ["curated://specspace/specgraph-core-v0"],
        )
        self.assertEqual(
            body["sources"]["curated_seed"]["source_ref"],
            "curated://specspace/specgraph-core-v0",
        )

    def test_practical_ontology_v1_prefers_compiler_backed_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(root)

            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=root / "runs",
                specgraph_dir=root,
            )
            try:
                status, body = _get(f"{base}/api/v1/practical-ontology")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["artifact_kind"], "specspace_practical_ontology")
        self.assertTrue(body["read_only"])
        self.assertFalse(body["canonical_mutations_allowed"])
        self.assertEqual(body["source"]["ontology_mode"], "compiler_artifact_projection")
        self.assertEqual(body["source"]["package_ref"], "org.0al.specgraph.core@0.1.0")
        self.assertTrue(body["source"]["normalized_ir_available"])
        self.assertFalse(body["authority_boundary"]["practical_ontology_is_authority"])
        self.assertTrue(body["authority_boundary"]["compiler_artifact_backed"])
        self.assertTrue(body["authority_boundary"]["derived_from_specgraph_sources"])
        self.assertFalse(body["authority_boundary"]["may_write_ontology_package"])
        self.assertFalse(body["authority_boundary"]["may_mutate_canonical_specs"])
        self.assertEqual(body["summary"]["term_count"], 3)
        self.assertEqual(body["summary"]["semantic_relation_count"], 1)
        self.assertEqual(body["summary"]["topology_edge_count"], 0)
        self.assertEqual(body["summary"]["proposal_reference_count"], 0)
        self.assertEqual(body["summary"]["gap_count"], 1)
        self.assertEqual(body["summary"]["diff_added_class_count"], 1)
        self.assertEqual(body["summary"]["diff_breaking_change_count"], 0)
        labels = {entry["label"] for entry in body["terms"]}
        self.assertEqual(labels, {"Requirement", "Spec", "SpecGraph"})
        relation_pairs = {
            (entry["source_term"], entry["relation"], entry["target_term"])
            for entry in body["relations"]
        }
        self.assertEqual(relation_pairs, {("Spec", "definesRequirement", "Requirement")})
        self.assertEqual(body["sources"]["compiler_ir"]["class_count"], 3)
        self.assertEqual(body["sources"]["compiler_ir"]["relation_count"], 1)
        self.assertTrue(body["sources"]["ontology_import_gap_index"]["available"])
        self.assertEqual(body["sources"]["ontology_import_gap_index"]["gap_count"], 1)
        self.assertTrue(body["sources"]["ontology_compatibility_diff_preview"]["available"])
        self.assertEqual(body["sources"]["ontology_compatibility_diff_preview"]["added_class_count"], 1)
        self.assertFalse(body["sources"]["curated_seed"]["available"])
        self.assertEqual(body["topology_edges"], [])
        self.assertEqual(body["proposal_references"], [])

    def test_practical_ontology_v1_reads_local_ir_without_specgraph_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(root)

            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=root / "runs",
            )
            try:
                status, body = _get(f"{base}/api/v1/practical-ontology")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["ontology_mode"], "compiler_artifact_projection")
        self.assertEqual(body["summary"]["term_count"], 3)

    def test_practical_ontology_v1_falls_back_to_binding_ref_for_non_object_lock(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(root)
            package_index_path = root / "runs" / "ontology_package_index.json"
            package_index = json.loads(package_index_path.read_text(encoding="utf-8"))
            package_index["packages"][0]["lock"] = None
            _write_json(package_index_path, package_index)

            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=root / "runs",
                specgraph_dir=root,
            )
            try:
                status, body = _get(f"{base}/api/v1/practical-ontology")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["ontology_mode"], "compiler_artifact_projection")
        self.assertEqual(body["source"]["package_ref"], "org.0al.specgraph.core@0.1.0")

    def test_practical_ontology_v1_reads_compiler_artifacts_from_http_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifacts"
            spec_dir = artifact_root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(artifact_root)
            _write_manifest(
                artifact_root,
                [
                    "specs/nodes/SG-SPEC-0001.yaml",
                    "runs/ontology_package_index.json",
                    "runs/ontology_binding_preview.json",
                    "runs/ontology_import_gap_index.json",
                    "runs/ontology_compatibility_diff_preview.json",
                    "ontology/specgraph-core/ontology.normalized.json",
                ],
            )

            static_httpd, static_thread, artifact_base = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base)
            try:
                status, body = _get(f"{base}/api/v1/practical-ontology")
            finally:
                _stop(httpd, thread)
                _stop(static_httpd, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["ontology_mode"], "compiler_artifact_projection")
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["source"]["package_ref"], "org.0al.specgraph.core@0.1.0")
        self.assertTrue(body["authority_boundary"]["compiler_artifact_backed"])
        self.assertEqual(body["summary"]["term_count"], 3)
        self.assertEqual(body["summary"]["semantic_relation_count"], 1)
        self.assertEqual(body["summary"]["gap_count"], 1)
        self.assertEqual(body["summary"]["diff_added_class_count"], 1)

    def test_artifacts_v1_lists_file_runs_and_materialized_ontology_ir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(root)
            runs_dir = root / "runs"
            _write_json(runs_dir / "local_operator_debug.json", {"secret": "local-only"})
            unsafe_dir = runs_dir / "agent_runtime_enforcement_evidence"
            unsafe_dir.mkdir()
            _write_json(unsafe_dir / "runtime-detail.json", {"secret": "runtime-detail"})

            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=runs_dir,
                specgraph_dir=root,
            )
            try:
                status, body = _get(f"{base}/api/v1/artifacts")
                content_status, content = _get(
                    f"{base}/api/v1/artifacts/content?"
                    f"path={quote('ontology/specgraph-core/ontology.normalized.json')}"
                )
                unsafe_status, unsafe = _get(f"{base}/api/v1/artifacts/content?path=../secret.json")
                local_only_status, local_only = _get(
                    f"{base}/api/v1/artifacts/content?"
                    f"path={quote('runs/local_operator_debug.json')}"
                )
                nested_status, nested = _get(
                    f"{base}/api/v1/artifacts/content?"
                    f"path={quote('runs/agent_runtime_enforcement_evidence/runtime-detail.json')}"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["artifact_kind"], "specspace_artifact_catalog")
        self.assertEqual(body["source"]["provider"], "file")
        self.assertGreaterEqual(body["summary"]["runs_count"], 4)
        self.assertEqual(body["summary"]["ontology_ir_count"], 1)
        by_path = {entry["path"]: entry for entry in body["artifacts"]}
        self.assertEqual(by_path["runs/ontology_package_index.json"]["group"], "ontology")
        self.assertEqual(
            by_path["ontology/specgraph-core/ontology.normalized.json"]["group"],
            "ontology_ir",
        )
        self.assertNotIn("runs/local_operator_debug.json", by_path)
        self.assertNotIn("runs/agent_runtime_enforcement_evidence/runtime-detail.json", by_path)
        self.assertEqual(content_status, 200)
        self.assertEqual(content["artifact_kind"], "specspace_artifact_content")
        self.assertEqual(content["content_kind"], "json")
        self.assertEqual(content["data"]["id"], "org.0al.specgraph.core")
        self.assertEqual(unsafe_status, 400)
        self.assertEqual(unsafe["reason"], "invalid_artifact_path")
        self.assertEqual(local_only_status, 404)
        self.assertEqual(local_only["reason"], "missing_artifact")
        self.assertEqual(nested_status, 404)
        self.assertEqual(nested["reason"], "missing_artifact")

    def test_artifacts_v1_file_catalog_skips_stat_races(self) -> None:
        provider = specspace_provider.FileSpecGraphProvider(
            spec_nodes_dir=None,
            runs_dir=None,
            specgraph_dir=None,
        )
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "missing.json"
            with mock.patch.object(
                specspace_provider.FileSpecGraphProvider,
                "_file_artifact_map",
                return_value={"runs/spec_activity_feed.json": missing},
            ):
                status, body = provider.read_artifact_catalog()

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["artifact_count"], 0)
        self.assertEqual(body["artifacts"], [])

    def test_artifacts_v1_lists_http_manifest_runs_and_materialized_ontology_ir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifacts"
            spec_dir = artifact_root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(artifact_root)
            _write_manifest(
                artifact_root,
                [
                    "specs/nodes/SG-SPEC-0001.yaml",
                    "runs/ontology_package_index.json",
                    "runs/ontology_binding_preview.json",
                    "runs/ontology_import_gap_index.json",
                    "runs/ontology_compatibility_diff_preview.json",
                    "ontology/specgraph-core/ontology.normalized.json",
                ],
            )

            static_httpd, static_thread, artifact_base = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base)
            try:
                status, body = _get(f"{base}/api/v1/artifacts")
                content_status, content = _get(
                    f"{base}/api/v1/artifacts/content?"
                    f"path={quote('ontology/specgraph-core/ontology.normalized.json')}"
                )
            finally:
                _stop(httpd, thread)
                _stop(static_httpd, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["summary"]["artifact_count"], 6)
        self.assertEqual(body["summary"]["ontology_artifact_count"], 4)
        self.assertEqual(body["summary"]["ontology_ir_count"], 1)
        by_path = {entry["path"]: entry for entry in body["artifacts"]}
        self.assertTrue(by_path["ontology/specgraph-core/ontology.normalized.json"]["referenced_by_package_index"])
        self.assertTrue(by_path["runs/ontology_package_index.json"]["url"].startswith(artifact_base))
        self.assertEqual(content_status, 200)
        self.assertEqual(content["source"]["provider"], "http")
        self.assertEqual(content["data"]["namespace"], "sgcore")

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

    def test_agent_surfaces_v1_combines_stable_specgraph_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_agent_surface_artifacts(root / "runs")
            httpd, thread, base = _start(root / "dialogs", runs_dir=root / "runs")
            try:
                status, body = _get(f"{base}/api/v1/agent-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertEqual(body["artifact_kind"], "specspace_agent_surface_index")
        self.assertEqual(body["schema_version"], 1)
        self.assertEqual(body["source"]["provider"], "file")
        self.assertEqual(body["entry_count"], 2)
        self.assertEqual(body["summary"]["surface_count"], 2)
        self.assertEqual(body["summary"]["executor_backend_count"], 1)
        self.assertEqual(body["summary"]["verification_gap_count"], 1)
        self.assertEqual(body["summary"]["verification_valid_count"], 1)
        self.assertEqual(body["summary"]["runtime_enforcement_policy_only_count"], 1)
        self.assertEqual(body["summary"]["runtime_enforcement_unknown_count"], 0)
        self.assertEqual(body["summary"]["runtime_enforcement_evidence_count"], 1)
        self.assertEqual(body["summary"]["runtime_enforcement_evidence_passed_count"], 1)
        self.assertEqual(body["summary"]["runtime_enforcement_evidence_failed_count"], 0)
        self.assertEqual(body["summary"]["runtime_enforcement_evidence_missing_count"], 0)
        self.assertEqual(body["summary"]["agent_passport_cli_status"], "available")
        self.assertEqual(body["handoff"]["handoff_status"], "ready_for_handoff")
        self.assertEqual(body["handoff"]["review_state"], "ready_for_review")
        entries = {entry["surface_id"]: entry for entry in body["entries"]}
        self.assertEqual(entries["specgraph.executor.codex"]["verification_state"], "V3_schema_valid")
        self.assertEqual(entries["specgraph.executor.codex"]["verification_status"], "valid")
        self.assertEqual(entries["specgraph.executor.codex"]["verification_tool_status"], "available")
        self.assertEqual(entries["specgraph.executor.codex"]["runtime_enforcement_state"], "policy_only")
        self.assertEqual(entries["specgraph.executor.codex"]["runtime_enforcement_observed"], False)
        self.assertEqual(
            entries["specgraph.executor.codex"]["backend_status"],
            "not_applicable_in_producer_environment",
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["runtime_environment"]["producer_environment"],
            "static_publish_environment",
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["runtime_environment"]["intended_environment"],
            "local_operator_environment",
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["runtime_environment"][
                "missing_executable_is_static_publish_gap"
            ],
            True,
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["runtime_environment"][
                "producer_environment_executable_required"
            ],
            False,
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["runtime_environment"][
                "producer_environment_execution_suppressed"
            ],
            True,
        )
        self.assertEqual(entries["specgraph.executor.codex"]["next_action"], "define_runtime_enforcement_runtime")
        self.assertEqual(entries["specgraph.executor.codex"]["gap_count"], 1)
        self.assertEqual(
            entries["specgraph.executor.codex"]["gaps"][0]["next_action"],
            "define_runtime_enforcement_runtime",
        )
        supervisor_entry = entries["specgraph.supervisor.executor_adapter"]
        self.assertIsNone(supervisor_entry["runtime_environment"])
        executor_entry = body["executor_adapters"][0]
        self.assertEqual(
            executor_entry["backend_status"],
            "not_applicable_in_producer_environment",
        )
        self.assertEqual(
            executor_entry["runtime_environment"]["operator_next_action"],
            "run_in_intended_runtime_environment",
        )
        self.assertEqual(supervisor_entry["runtime_enforcement_evidence_count"], 1)
        self.assertEqual(supervisor_entry["runtime_enforcement_evidence"][0]["status"], "passed")
        self.assertEqual(
            supervisor_entry["runtime_enforcement_evidence"][0]["evidence_ref"],
            "runs/agent_runtime_enforcement_evidence/supervisor-executor-adapter-smoke.json",
        )
        self.assertEqual(
            supervisor_entry["runtime_enforcement_evidence"][0]["detail_status"],
            "available",
        )
        self.assertEqual(
            supervisor_entry["runtime_enforcement_evidence"][0]["checks"][0]["check_id"],
            "executor_adapter_invocation_boundary",
        )
        self.assertEqual(
            supervisor_entry["runtime_enforcement_evidence"][0]["checks"][0]["status"],
            "passed",
        )
        self.assertEqual(body["executor_adapters"][0]["backend_id"], "codex")
        self.assertNotIn("supervisor_stdout", json.dumps(body))
        self.assertNotIn("/Users/", json.dumps(body["entries"]))

    def test_agent_surfaces_v1_rejects_unsafe_runtime_evidence_detail_ref(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_agent_surface_artifacts(runs_dir)
            index_path = runs_dir / "agent_runtime_enforcement_evidence_index.json"
            index = json.loads(index_path.read_text(encoding="utf-8"))
            index["entries"][0]["evidence_ref"] = "file:///Users/example/evidence.json"
            _write_json(index_path, index)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/agent-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        entries = {entry["surface_id"]: entry for entry in body["entries"]}
        evidence = entries["specgraph.supervisor.executor_adapter"]["runtime_enforcement_evidence"][0]
        self.assertIsNone(evidence["evidence_ref"])
        self.assertEqual(evidence["detail_status"], "invalid")
        self.assertEqual(evidence["detail_reason"], "unsafe_evidence_ref")
        self.assertEqual(evidence["checks"], [])
        self.assertNotIn("file:///Users/example/evidence.json", json.dumps(body))

    def test_agent_surfaces_v1_keeps_aggregate_when_runtime_evidence_detail_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_agent_surface_artifacts(runs_dir)
            (runs_dir / "agent_runtime_enforcement_evidence" / "supervisor-executor-adapter-smoke.json").unlink()
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/agent-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["runtime_enforcement_evidence_passed_count"], 1)
        entries = {entry["surface_id"]: entry for entry in body["entries"]}
        evidence = entries["specgraph.supervisor.executor_adapter"]["runtime_enforcement_evidence"][0]
        self.assertEqual(evidence["status"], "passed")
        self.assertEqual(evidence["detail_status"], "missing")
        self.assertEqual(evidence["detail_reason"], "missing_detail_artifact")
        self.assertEqual(evidence["checks"], [])

    def test_agent_surfaces_v1_marks_malformed_runtime_evidence_detail_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_agent_surface_artifacts(runs_dir)
            _write_json(
                runs_dir / "agent_runtime_enforcement_evidence" / "supervisor-executor-adapter-smoke.json",
                {"artifact_kind": "agent_runtime_enforcement_evidence", "checks": "not-a-list"},
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/agent-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        entries = {entry["surface_id"]: entry for entry in body["entries"]}
        evidence = entries["specgraph.supervisor.executor_adapter"]["runtime_enforcement_evidence"][0]
        self.assertEqual(evidence["detail_status"], "invalid")
        self.assertEqual(evidence["detail_reason"], "invalid_detail_artifact")
        self.assertEqual(evidence["checks"], [])

    def test_agent_surfaces_v1_degrades_when_optional_artifacts_are_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "agent_surface_index.json",
                {
                    "artifact_kind": "agent_surface_index",
                    "schema_version": 1,
                    "surfaces": [
                        {
                            "surface_id": "specspace.operator_handoff",
                            "title": "SpecSpace operator handoff",
                            "surface_type": "external_consumer",
                            "requires_passport": True,
                            "verification_state": "missing_passport",
                        }
                    ],
                    "summary": {
                        "surface_count": 1,
                        "missing_passport_count": 1,
                        "agent_passport_cli_status": "unknown",
                    },
                },
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/agent-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["entry_count"], 1)
        self.assertEqual(body["entries"][0]["surface_id"], "specspace.operator_handoff")
        self.assertEqual(body["handoff"]["available"], False)
        self.assertEqual(body["handoff"]["handoff_status"], "missing")
        self.assertEqual(body["sources"]["external_handoffs"]["available"], False)
        self.assertEqual(body["sources"]["external_handoffs"]["reason"], "missing_artifact")
        self.assertEqual(body["sources"]["runtime_evidence"]["available"], False)
        self.assertEqual(body["sources"]["runtime_evidence"]["reason"], "missing_artifact")

    def test_agent_surfaces_v1_reads_http_static_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            runs_dir = artifact_root / "runs"
            runs_dir.mkdir(parents=True)
            _write_agent_surface_artifacts(runs_dir)
            _write_manifest(
                artifact_root,
                [
                    "runs/supervisor_executor_adapter_index.json",
                    "runs/known_agent_passport_index.json",
                    "runs/agent_passport_verification_report.json",
                    "runs/agent_surface_index.json",
                    "runs/agent_verification_gap_index.json",
                    "runs/agent_runtime_enforcement_evidence_index.json",
                    "runs/agent_runtime_enforcement_evidence/supervisor-executor-adapter-smoke.json",
                    "runs/external_consumer_handoff_packets.json",
                ],
            )
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base_url)
            try:
                status, body = _get(f"{base}/api/v1/agent-surfaces")
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["source"]["artifact_base_url"], artifact_base_url)
        self.assertEqual(body["summary"]["handoff_status"], "ready_for_handoff")
        self.assertTrue(body["sources"]["agent_surfaces"]["available"])
        self.assertTrue(body["sources"]["runtime_evidence"]["available"])
        self.assertTrue(body["sources"]["external_handoffs"]["path"].startswith(artifact_base_url))
        entries = {entry["surface_id"]: entry for entry in body["entries"]}
        evidence = entries["specgraph.supervisor.executor_adapter"]["runtime_enforcement_evidence"][0]
        self.assertEqual(evidence["detail_status"], "available")
        self.assertEqual(evidence["checks"][0]["check_id"], "executor_adapter_invocation_boundary")

    def test_ontology_semantic_review_surface_v1_reads_file_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "ontology_semantic_review_surface.json",
                _ontology_semantic_review_surface(),
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-semantic-review-surface")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["artifact_kind"], "ontology_semantic_review_surface")
        self.assertEqual(body["data"]["proposal_id"], "0108")
        self.assertEqual(body["data"]["summary"]["review_item_count"], 2)
        self.assertEqual(body["data"]["review_items"][0]["review_state"], "blocked")
        self.assertFalse(body["data"]["canonical_mutations_allowed"])
        self.assertFalse(body["data"]["tracked_artifacts_written"])
        self.assertFalse(body["data"]["consumer_boundary"]["may_execute_prompt_agent"])
        self.assertFalse(body["data"]["authority_boundary"]["semantic_review_surface_is_authority"])

    def test_ontology_semantic_review_surface_v1_reports_missing_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-semantic-review-surface")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 404)
        self.assertEqual(body["reason"], "missing_artifact")
        self.assertEqual(body["artifact"], "runs/ontology_semantic_review_surface.json")
        self.assertIn("make ontology-imports", body["build_hint"])

    def test_ontology_semantic_review_surface_v1_rejects_authority_expansion(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            surface = _ontology_semantic_review_surface()
            surface["consumer_boundary"]["may_mutate_canonical_specs"] = True
            _write_json(runs_dir / "ontology_semantic_review_surface.json", surface)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-semantic-review-surface")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "authority_expansion")
        self.assertIn("may_mutate_canonical_specs", body["detail"])

    def test_ontology_semantic_review_surface_v1_rejects_action_authority_expansion(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            surface = _ontology_semantic_review_surface()
            surface["review_actions"][0]["writes_ontology_package"] = True
            _write_json(runs_dir / "ontology_semantic_review_surface.json", surface)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-semantic-review-surface")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "authority_expansion")
        self.assertIn("review_actions[0].writes_ontology_package", body["detail"])

    def test_ontology_semantic_review_surface_v1_reads_http_static_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            runs_dir = artifact_root / "runs"
            runs_dir.mkdir(parents=True)
            _write_json(
                runs_dir / "ontology_semantic_review_surface.json",
                _ontology_semantic_review_surface(),
            )
            _write_manifest(artifact_root, ["runs/ontology_semantic_review_surface.json"])
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base_url)
            try:
                status, body = _get(f"{base}/api/v1/ontology-semantic-review-surface")
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["summary"]["status"], "blocked_relation_conflict")

    def test_ontology_review_dashboard_v1_reads_file_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "ontology_review_dashboard.json",
                _ontology_review_dashboard(),
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-review-dashboard")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["artifact_kind"], "ontology_review_dashboard")
        self.assertEqual(body["data"]["proposal_id"], "0113")
        self.assertEqual(body["data"]["status_summary"]["status"], "blocked_by_semantic_gate")
        self.assertEqual(body["data"]["status_summary"]["pending_decision_count"], 0)
        self.assertEqual(body["data"]["draft_requests"][0]["intake_state"], "blocked_by_semantic_gate")
        self.assertFalse(body["data"]["canonical_mutations_allowed"])
        self.assertFalse(body["data"]["tracked_artifacts_written"])
        self.assertFalse(body["data"]["consumer_boundary"]["may_import_owner_decision"])
        self.assertFalse(body["data"]["authority_boundary"]["ontology_review_dashboard_is_authority"])

    def test_ontology_review_dashboard_v1_reports_missing_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-review-dashboard")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 404)
        self.assertEqual(body["reason"], "missing_artifact")
        self.assertEqual(body["artifact"], "runs/ontology_review_dashboard.json")
        self.assertIn("make ontology-imports", body["build_hint"])

    def test_ontology_review_dashboard_v1_rejects_authority_expansion(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            dashboard = _ontology_review_dashboard()
            dashboard["consumer_boundary"]["may_import_owner_decision"] = True
            _write_json(runs_dir / "ontology_review_dashboard.json", dashboard)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-review-dashboard")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "authority_expansion")
        self.assertIn("may_import_owner_decision", body["detail"])

    def test_ontology_review_dashboard_v1_rejects_closed_loop_authority_expansion(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            dashboard = _ontology_review_dashboard()
            dashboard["closed_loop_entries"][0]["accepted_ontology_delta"] = True
            _write_json(runs_dir / "ontology_review_dashboard.json", dashboard)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-review-dashboard")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "authority_expansion")
        self.assertIn("closed_loop_entries[0].accepted_ontology_delta", body["detail"])

    def test_ontology_review_dashboard_v1_rejects_draft_request_authority_expansion(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            dashboard = _ontology_review_dashboard()
            dashboard["draft_requests"][0]["writes_ontology_package"] = True
            _write_json(runs_dir / "ontology_review_dashboard.json", dashboard)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-review-dashboard")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "authority_expansion")
        self.assertIn("draft_requests[0].writes_ontology_package", body["detail"])

    def test_ontology_review_dashboard_v1_rejects_stale_summary_counts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            dashboard = _ontology_review_dashboard()
            dashboard["status_summary"]["draft_request_count"] = 2
            _write_json(runs_dir / "ontology_review_dashboard.json", dashboard)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-review-dashboard")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "stale_status_summary")
        self.assertIn("draft_request_count", body["detail"])

    def test_ontology_review_dashboard_v1_reads_http_static_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            runs_dir = artifact_root / "runs"
            runs_dir.mkdir(parents=True)
            _write_json(
                runs_dir / "ontology_review_dashboard.json",
                _ontology_review_dashboard(),
            )
            _write_manifest(artifact_root, ["runs/ontology_review_dashboard.json"])
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base_url)
            try:
                status, body = _get(f"{base}/api/v1/ontology-review-dashboard")
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["status_summary"]["next_gap"], "build_specspace_rich_ontology_review_panel")
        self.assertTrue(body["path"].startswith(artifact_base_url))

    def test_ontology_owner_decision_review_v1_reads_file_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "ontology_decision_import_preview.json",
                _ontology_owner_decision_review(),
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["artifact_kind"], "ontology_decision_import_preview")
        self.assertEqual(body["data"]["proposal_id"], "0115")
        self.assertEqual(body["data"]["summary"]["status"], "ready_for_operator_review")
        self.assertEqual(body["data"]["summary"]["accepted_count"], 1)
        self.assertEqual(body["data"]["summary"]["rejected_count"], 1)
        self.assertEqual(
            body["data"]["decision_import_previews"][0]["matched_closed_loop_evidence_id"],
            "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-casfunction",
        )
        self.assertFalse(body["data"]["canonical_mutations_allowed"])
        self.assertFalse(body["data"]["tracked_artifacts_written"])
        self.assertFalse(body["data"]["consumer_boundary"]["may_apply_preview"])
        self.assertFalse(
            body["data"]["authority_boundary"]["ontology_decision_import_preview_is_authority"]
        )

    def test_ontology_owner_decision_review_v1_reports_missing_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 404)
        self.assertEqual(body["reason"], "missing_artifact")
        self.assertEqual(body["artifact"], "runs/ontology_decision_import_preview.json")
        self.assertIn("make ontology-imports", body["build_hint"])

    def test_ontology_owner_decision_review_v1_rejects_apply_authority(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            review = _ontology_owner_decision_review()
            review["consumer_boundary"]["may_apply_preview"] = True
            _write_json(runs_dir / "ontology_decision_import_preview.json", review)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "authority_expansion")
        self.assertIn("may_apply_preview", body["detail"])

    def test_ontology_owner_decision_review_v1_rejects_preview_mutation_authority(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            review = _ontology_owner_decision_review()
            review["decision_import_previews"][0]["imports_into_specgraph"] = True
            _write_json(runs_dir / "ontology_decision_import_preview.json", review)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "authority_expansion")
        self.assertIn("decision_import_previews[0].imports_into_specgraph", body["detail"])

    def test_ontology_owner_decision_review_v1_rejects_ready_without_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            review = _ontology_owner_decision_review()
            review["decision_import_previews"][0]["matched_closed_loop_evidence_id"] = ""
            _write_json(runs_dir / "ontology_decision_import_preview.json", review)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "missing_evidence_link")
        self.assertIn("matched_closed_loop_evidence_id", body["detail"])

    def test_ontology_owner_decision_review_v1_rejects_stale_summary_counts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            review = _ontology_owner_decision_review()
            review["summary"]["preview_count"] = 3
            _write_json(runs_dir / "ontology_decision_import_preview.json", review)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "stale_summary")
        self.assertIn("preview_count", body["detail"])

    def test_ontology_owner_decision_review_v1_rejects_stale_derived_counts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            review = _ontology_owner_decision_review()
            review["summary"]["accepted_count"] = 0
            _write_json(runs_dir / "ontology_decision_import_preview.json", review)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "stale_summary")
        self.assertIn("accepted_count", body["detail"])

    def test_ontology_owner_decision_review_v1_rejects_malformed_ignored_decision(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            review = _ontology_owner_decision_review()
            del review["ignored_owner_decisions"][0]["decision_id"]
            _write_json(runs_dir / "ontology_decision_import_preview.json", review)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "invalid_ignored_owner_decisions")
        self.assertIn("ignored_owner_decisions[0].decision_id", body["detail"])

    def test_ontology_owner_decision_review_v1_rejects_no_decisions_with_previews(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            review = _ontology_owner_decision_review()
            review["summary"]["status"] = "no_decisions"
            _write_json(runs_dir / "ontology_decision_import_preview.json", review)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "state_mismatch")
        self.assertIn("no_decisions", body["detail"])

    def test_ontology_owner_decision_review_v1_reads_http_static_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            runs_dir = artifact_root / "runs"
            runs_dir.mkdir(parents=True)
            _write_json(
                runs_dir / "ontology_decision_import_preview.json",
                _ontology_owner_decision_review(),
            )
            _write_manifest(artifact_root, ["runs/ontology_decision_import_preview.json"])
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base_url)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["summary"]["next_gap"], "build_specspace_owner_decision_review_surface")
        self.assertTrue(body["path"].startswith(artifact_base_url))

    def test_ontology_owner_decision_acknowledgements_v1_reads_empty_specspace_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(root / "dialogs", specspace_state_dir=state_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-acknowledgements")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["artifact_kind"], "specspace_ontology_owner_decision_acknowledgement_state")
        self.assertEqual(body["summary"]["acknowledgement_count"], 0)
        self.assertTrue(body["consumer_boundary"]["specspace_owned_state"])
        self.assertFalse(body["consumer_boundary"]["may_import_into_specgraph"])
        self.assertFalse(body["authority_boundary"]["acknowledgement_state_is_authority"])
        self.assertFalse((state_dir / "ontology_owner_decision_acknowledgements.json").exists())

    def test_ontology_owner_decision_acknowledgements_v1_posts_specspace_owned_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            runs_dir.mkdir()
            review = _ontology_owner_decision_review()
            review_path = runs_dir / "ontology_decision_import_preview.json"
            _write_json(review_path, review)
            before_review = review_path.read_text(encoding="utf-8")
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/ontology-owner-decision-acknowledgements",
                    {
                        "preview_id": "ontology-decision-import-preview-accept-casfunction",
                        "acknowledged_by": "operator",
                    },
                )
                get_status, get_body = _get(f"{base}/api/v1/ontology-owner-decision-acknowledgements")
            finally:
                _stop(httpd, thread)
            state_path = state_dir / "ontology_owner_decision_acknowledgements.json"
            state_exists = state_path.exists()
            review_after = review_path.read_text(encoding="utf-8")

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["acknowledgement_count"], 1)
        self.assertEqual(get_status, 200)
        self.assertEqual(
            get_body["acknowledgements"][0]["preview_id"],
            "ontology-decision-import-preview-accept-casfunction",
        )
        self.assertEqual(
            get_body["acknowledgements"][0]["decision_id"],
            "ontology-owner-decision-accept-casfunction",
        )
        self.assertFalse(get_body["acknowledgements"][0]["imports_into_specgraph"])
        self.assertFalse(get_body["acknowledgements"][0]["closes_semantic_gate"])
        self.assertTrue(state_exists)
        self.assertEqual(review_after, before_review)

    def test_ontology_owner_decision_acknowledgements_v1_rejects_unknown_preview(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "ontology_decision_import_preview.json",
                _ontology_owner_decision_review(),
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/ontology-owner-decision-acknowledgements",
                    {"preview_id": "not-a-preview"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 404)
        self.assertEqual(body["preview_id"], "not-a-preview")
        self.assertFalse((state_dir / "ontology_owner_decision_acknowledgements.json").exists())

    def test_ontology_owner_decision_acknowledgements_v1_rejects_mutation_claims(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_json(
                state_dir / "ontology_owner_decision_acknowledgements.json",
                {
                    "artifact_kind": "specspace_ontology_owner_decision_acknowledgement_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "for_operator_review_workflow": True,
                        "may_import_into_specgraph": False,
                    },
                    "authority_boundary": {
                        "acknowledgement_state_is_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "acknowledgements": [
                        {
                            "preview_id": "ontology-decision-import-preview-accept-casfunction",
                            "decision_id": "ontology-owner-decision-accept-casfunction",
                            "candidate_id": "ontology-delta-candidate-examcalc-casfunction",
                            "imports_into_specgraph": True,
                        }
                    ],
                },
            )
            httpd, thread, base = _start(root / "dialogs", specspace_state_dir=state_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-acknowledgements")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertIn("imports_into_specgraph", body["error"])

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
        self.assertEqual(body["scope"], "subtree")
        self.assertEqual(body["manifest"]["scope"], "subtree")
        self.assertEqual(body["manifest"]["node_count"], 2)
        self.assertEqual(body["manifest"]["nodes_included"], ["SG-SPEC-0001", "SG-SPEC-0002"])
        self.assertIn("# SG-SPEC-0001", body["markdown"])
        self.assertIn("## 1. SG-SPEC-0002", body["markdown"])
        self.assertIn("> Define the readonly export boundary.", body["markdown"])

    def test_spec_markdown_v1_can_export_selected_node_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_yaml(
                spec_dir / "SG-SPEC-0002.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-0002",
                    "title": "Spec Markdown Child",
                    "refines": ["SG-SPEC-0001"],
                },
            )
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(
                    f"{base}/api/v1/spec-markdown?root={quote('SG-SPEC-0001')}&scope=node",
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["scope"], "node")
        self.assertEqual(body["manifest"]["scope"], "node")
        self.assertEqual(body["manifest"]["node_count"], 1)
        self.assertEqual(body["manifest"]["nodes_included"], ["SG-SPEC-0001"])
        self.assertIn("# SG-SPEC-0001", body["markdown"])
        self.assertNotIn("SG-SPEC-0002", body["markdown"])

    def test_capabilities_v1_distinguishes_markdown_export_from_hyperprompt_compile(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/v1/capabilities")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertTrue(body["capabilities"]["spec_markdown_export"])
        self.assertFalse(body["capabilities"]["hyperprompt_compile"])
        self.assertEqual(body["diagnostics"]["spec_markdown_export"]["status"], "available")
        self.assertEqual(body["diagnostics"]["hyperprompt_compile"]["status"], "compiler_missing")

    def test_capabilities_v1_reports_configured_hyperprompt_compile(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            binary = root / "hyperprompt"
            binary.write_text("#!/bin/sh\n", encoding="utf-8")
            binary.chmod(0o755)
            scratch = root / "scratch"
            scratch.mkdir()
            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                hyperprompt_binary=str(binary),
                hyperprompt_resolved_binary=str(binary),
                hyperprompt_work_dir=scratch,
            )
            try:
                status, body = _get(f"{base}/api/v1/capabilities")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertTrue(body["capabilities"]["spec_markdown_export"])
        self.assertTrue(body["capabilities"]["hyperprompt_compile"])
        self.assertEqual(body["diagnostics"]["hyperprompt_compile"]["status"], "available")
        self.assertEqual(body["diagnostics"]["hyperprompt_compile"]["resolved_binary"], str(binary))

    def test_spec_markdown_compile_v1_compiles_local_export_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_yaml(
                spec_dir / "SG-SPEC-0002.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-0002",
                    "title": "Spec Markdown Child",
                    "refines": ["SG-SPEC-0001"],
                },
            )
            binary = root / "hyperprompt"
            _write_hyperprompt_stub(binary)
            scratch = root / "scratch"
            scratch.mkdir()
            for index in range(25):
                stale = scratch / f"specspace-stale-{index}"
                stale.mkdir()
                (stale / ".specspace-hyperprompt-bundle").write_text("old\n", encoding="utf-8")
                os.utime(stale, (1000 + index, 1000 + index))
            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                hyperprompt_binary=str(binary),
                hyperprompt_resolved_binary=str(binary),
                hyperprompt_work_dir=scratch,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/spec-markdown/compile",
                    {"root": "SG-SPEC-0001", "scope": "subtree", "depth": 2},
                )
                root_hc_text = Path(body["compile"]["root_hc"]).read_text(encoding="utf-8") if status == 200 else ""
                export_manifest_data = (
                    json.loads(Path(body["compile"]["export_manifest"]).read_text(encoding="utf-8"))
                    if status == 200
                    else {}
                )
                owned_bundle_count = len([
                    path
                    for path in scratch.iterdir()
                    if path.is_dir()
                    and path.name.startswith("specspace-")
                    and (path / ".specspace-hyperprompt-bundle").is_file()
                ])
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["api_version"], "v1")
        self.assertEqual(body["artifact_kind"], "specspace_hyperprompt_compile")
        self.assertEqual(body["root_id"], "SG-SPEC-0001")
        self.assertEqual(body["scope"], "subtree")
        self.assertEqual(body["export"]["manifest"]["scope"], "subtree")
        self.assertEqual(body["export"]["manifest"]["node_count"], 2)
        self.assertEqual(body["compile"]["exit_code"], 0)
        self.assertIn("# Compiled SpecSpace export", body["compile"]["compiled_markdown"])
        self.assertEqual(body["compile"]["compiler_manifest"], {"compiled": True})
        root_hc = Path(body["compile"]["root_hc"])
        export_manifest = Path(body["compile"]["export_manifest"])
        self.assertTrue(root_hc.is_relative_to(scratch))
        self.assertTrue(export_manifest.is_relative_to(scratch))
        self.assertIn('"export.md"', root_hc_text)
        self.assertEqual(export_manifest_data["root_id"], "SG-SPEC-0001")
        self.assertLessEqual(owned_bundle_count, 20)

    def test_spec_markdown_compile_v1_returns_capability_diagnostic_when_disabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _post(
                    f"{base}/api/v1/spec-markdown/compile",
                    {"root": "SG-SPEC-0001"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertEqual(body["reason"], "hyperprompt_compile_unavailable")
        self.assertFalse(body["capabilities"]["hyperprompt_compile"])
        self.assertEqual(body["diagnostic"]["status"], "compiler_missing")

    def test_spec_markdown_compile_v1_rejects_http_provider(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            spec_dir = artifact_root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_manifest(artifact_root, ["specs/nodes/SG-SPEC-0001.yaml"])
            binary = root / "hyperprompt"
            _write_hyperprompt_stub(binary)
            scratch = root / "scratch"
            scratch.mkdir()
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(
                root / "dialogs",
                artifact_base_url=artifact_base_url,
                hyperprompt_binary=str(binary),
                hyperprompt_resolved_binary=str(binary),
                hyperprompt_work_dir=scratch,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/spec-markdown/compile",
                    {"root": "SG-SPEC-0001"},
                )
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 503)
        self.assertEqual(body["diagnostic"]["status"], "http_compile_disabled")
        self.assertFalse(body["capabilities"]["hyperprompt_compile"])

    def test_spec_markdown_compile_v1_compiles_http_provider_when_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            spec_dir = artifact_root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_manifest(artifact_root, ["specs/nodes/SG-SPEC-0001.yaml"])
            binary = root / "hyperprompt"
            _write_hyperprompt_stub(binary)
            scratch = root / "scratch"
            scratch.mkdir()
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(
                root / "dialogs",
                artifact_base_url=artifact_base_url,
                hyperprompt_binary=str(binary),
                hyperprompt_resolved_binary=str(binary),
                hyperprompt_work_dir=scratch,
                hyperprompt_http_compile_enabled=True,
                hyperprompt_compile_timeout_seconds="5",
                hyperprompt_bundle_retention_count="3",
            )
            try:
                capabilities_status, capabilities = _get(f"{base}/api/v1/capabilities")
                status, body = _post(
                    f"{base}/api/v1/spec-markdown/compile",
                    {"root": "SG-SPEC-0001"},
                )
                root_hc = Path(body["compile"]["root_hc"]) if status == 200 else None
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(capabilities_status, 200)
        self.assertTrue(capabilities["capabilities"]["hyperprompt_compile"])
        self.assertEqual(capabilities["diagnostics"]["hyperprompt_compile"]["status"], "available")
        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["source"]["artifact_base_url"], artifact_base_url)
        self.assertEqual(body["scope"], "subtree")
        self.assertEqual(body["export"]["manifest"]["scope"], "subtree")
        self.assertEqual(body["compile"]["exit_code"], 0)
        self.assertEqual(body["compile"]["timeout_seconds"], 5)
        self.assertIn("# Compiled SpecSpace export", body["compile"]["compiled_markdown"])
        self.assertIsNotNone(root_hc)
        assert root_hc is not None
        self.assertTrue(root_hc.is_relative_to(scratch))

    def test_spec_markdown_compile_v1_reports_http_provider_timeout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            spec_dir = artifact_root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_manifest(artifact_root, ["specs/nodes/SG-SPEC-0001.yaml"])
            binary = root / "hyperprompt"
            _write_hyperprompt_stub(binary, sleep_seconds=2)
            scratch = root / "scratch"
            scratch.mkdir()
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(
                root / "dialogs",
                artifact_base_url=artifact_base_url,
                hyperprompt_binary=str(binary),
                hyperprompt_resolved_binary=str(binary),
                hyperprompt_work_dir=scratch,
                hyperprompt_http_compile_enabled=True,
                hyperprompt_compile_timeout_seconds="1",
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/spec-markdown/compile",
                    {"root": "SG-SPEC-0001"},
                )
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 500)
        self.assertEqual(body["error"], "Hyperprompt compiler timed out")
        self.assertEqual(body["compile"]["timeout_seconds"], 1)

    def test_spec_markdown_compile_v1_reports_invalid_http_compile_limit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            spec_dir = artifact_root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_manifest(artifact_root, ["specs/nodes/SG-SPEC-0001.yaml"])
            binary = root / "hyperprompt"
            _write_hyperprompt_stub(binary)
            scratch = root / "scratch"
            scratch.mkdir()
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(
                root / "dialogs",
                artifact_base_url=artifact_base_url,
                hyperprompt_binary=str(binary),
                hyperprompt_resolved_binary=str(binary),
                hyperprompt_work_dir=scratch,
                hyperprompt_http_compile_enabled=True,
                hyperprompt_compile_timeout_seconds="fast",
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/spec-markdown/compile",
                    {"root": "SG-SPEC-0001"},
                )
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 503)
        self.assertEqual(body["diagnostic"]["status"], "invalid_limit")
        self.assertEqual(body["diagnostic"]["limit_error"]["field"], "hyperprompt_compile_timeout_seconds")

    def test_spec_markdown_compile_v1_returns_compiler_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            binary = root / "hyperprompt"
            _write_hyperprompt_stub(binary, exit_code=2)
            scratch = root / "scratch"
            scratch.mkdir()
            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                hyperprompt_binary=str(binary),
                hyperprompt_resolved_binary=str(binary),
                hyperprompt_work_dir=scratch,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/spec-markdown/compile",
                    {"root": "SG-SPEC-0001"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertIn("Hyperprompt compiler failed: Syntax error", body["error"])
        self.assertEqual(body["compile"]["exit_code"], 2)
        self.assertIn("syntax error", body["compile"]["stderr"])
        self.assertEqual(body["export"]["manifest"]["root_id"], "SG-SPEC-0001")

    def test_spec_markdown_compile_v1_rejects_invalid_request_options(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                depth_status, depth_body = _post(
                    f"{base}/api/v1/spec-markdown/compile",
                    {"root": "SG-SPEC-0001", "depth": True},
                )
                scope_status, scope_body = _post(
                    f"{base}/api/v1/spec-markdown/compile",
                    {"root": "SG-SPEC-0001", "scope": 42},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(depth_status, 400)
        self.assertEqual(depth_body["field"], "depth")
        self.assertEqual(scope_status, 400)
        self.assertEqual(scope_body["field"], "scope")

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

    def test_spec_markdown_v1_rejects_invalid_scope(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/v1/spec-markdown?root=SG-SPEC-0001&scope=wide")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["parameter"], "scope")

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

    def test_spec_markdown_v1_reports_idless_provider_data(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", {"title": "No id"})
            httpd, thread, base = _start(root / "dialogs", spec_dir=spec_dir)
            try:
                status, body = _get(f"{base}/api/v1/spec-markdown?root=SG-SPEC-0001")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "invalid_provider_data")
        self.assertEqual(body["invalid_nodes"][0]["file_name"], "SG-SPEC-0001.yaml")

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
            proposals_dir = artifact_root / "docs" / "proposals"
            spec_dir.mkdir(parents=True)
            runs_dir.mkdir()
            proposals_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            (proposals_dir / "0042_agent_context.md").write_text(
                "# Agent Context Bridge\n\nMentions SG-SPEC-0001 from static artifacts.\n",
                encoding="utf-8",
            )
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
                    "docs/proposals/0042_agent_context.md",
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
                ontology_status, ontology = _get(f"{base}/api/v1/practical-ontology")
                metrics_status, metrics = _get(f"{base}/api/v1/metrics")
                capabilities_status, capabilities = _get(f"{base}/api/v1/capabilities")
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
        self.assertEqual(proposals["sources"]["proposal_markdown"]["available"], True)
        self.assertIn("# Agent Context Bridge", proposals["entries"][0]["markdown"]["content_body"])
        self.assertEqual(proposals["entries"][0]["affected_spec_ids"], ["SG-SPEC-0001"])
        self.assertEqual(ontology_status, 200)
        self.assertEqual(ontology["source"]["provider"], "http")
        self.assertFalse(ontology["authority_boundary"]["practical_ontology_is_authority"])
        self.assertEqual(ontology["source"]["ontology_mode"], "curated_core_seed")
        self.assertGreaterEqual(ontology["summary"]["term_count"], 10)
        self.assertEqual(ontology["proposal_references"], [])
        self.assertIn("SpecGraph", {entry["label"] for entry in ontology["terms"]})
        self.assertEqual(metrics_status, 200)
        self.assertEqual(metrics["source"]["provider"], "http")
        self.assertEqual(metrics["entry_count"], 7)
        self.assertTrue(metrics["sources"]["graph_dashboard"]["available"])
        self.assertIn("SG-SPEC-0001", metrics["filters"]["reference_texts"])
        self.assertEqual(capabilities_status, 200)
        self.assertTrue(capabilities["capabilities"]["spec_markdown_export"])
        self.assertFalse(capabilities["capabilities"]["hyperprompt_compile"])
        self.assertEqual(
            capabilities["diagnostics"]["hyperprompt_compile"]["status"],
            "http_compile_disabled",
        )

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


class AgentWorkbenchV1ApiTests(unittest.TestCase):
    def test_agent_workbench_read_endpoints_are_guarded_when_unconfigured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(root / "dialogs")
            try:
                status, body = _get(f"{base}/api/v1/agent-workbench/conversations")
                capabilities_status, capabilities = _get(f"{base}/api/v1/capabilities")
                health_status, health = _get(f"{base}/api/v1/health")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertEqual(body["reason"], "agent_workbench_store_unavailable")
        self.assertEqual(body["source"]["status"], "not_configured")
        self.assertEqual(capabilities_status, 200)
        self.assertFalse(capabilities["capabilities"]["agent_workbench_conversations"])
        self.assertFalse(capabilities["capabilities"]["agent_workbench_writes"])
        self.assertEqual(
            capabilities["diagnostics"]["agent_workbench_conversations"]["source"]["status"],
            "not_configured",
        )
        self.assertEqual(health_status, 200)
        self.assertEqual(
            health["sources"]["agent_workbench_conversations"]["status"],
            "not_configured",
        )

    def test_agent_workbench_read_endpoints_return_configured_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            workbench = root / "workbench"
            conversations = workbench / "conversations"
            conversations.mkdir(parents=True)
            shutil.copyfile(AGENT_WORKBENCH_FIXTURES / "index-v1.json", conversations / "index.json")
            shutil.copyfile(
                AGENT_WORKBENCH_FIXTURES / "conversation-v1.json",
                conversations / "awb-conv-0001.json",
            )
            httpd, thread, base = _start(root / "dialogs", agent_workbench_dir=workbench)
            try:
                index_status, index = _get(f"{base}/api/v1/agent-workbench/conversations")
                conversation_status, conversation = _get(
                    f"{base}/api/v1/agent-workbench/conversations/awb-conv-0001",
                )
                capabilities_status, capabilities = _get(f"{base}/api/v1/capabilities")
            finally:
                _stop(httpd, thread)

        self.assertEqual(index_status, 200)
        self.assertEqual(index["source"]["status"], "ok")
        self.assertEqual(index["data"]["artifact_kind"], "specspace_agent_conversation_index")
        self.assertEqual(index["data"]["entry_count"], 1)
        self.assertEqual(conversation_status, 200)
        self.assertEqual(conversation["conversation_id"], "awb-conv-0001")
        self.assertEqual(conversation["data"]["artifact_kind"], "specspace_agent_conversation")
        self.assertEqual(capabilities_status, 200)
        self.assertTrue(capabilities["capabilities"]["agent_workbench_conversations"])
        self.assertFalse(capabilities["capabilities"]["agent_workbench_writes"])


if __name__ == "__main__":
    unittest.main()
