import json
import tempfile
import time
import unittest
from http import HTTPStatus
from pathlib import Path
from unittest import mock

from viewer import idea_to_spec_workspace, specspace_provider


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


def _intake() -> dict:
    return {
        "artifact_kind": "idea_event_storming_intake",
        "schema_version": 1,
        "proposal_id": "0149",
        "contract_ref": "specgraph.idea-to-spec.event-storming-intake.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "active_frame": {
            "project": "DemoCalculator",
            "ontology_refs": ["ontology://specgraph-core"],
            "domain_refs": ["domain.calculator"],
            "context_refs": ["context.idea_to_spec"],
        },
        "actors": [{"id": "actor.user"}],
        "domain_events": [{"id": "event.result_shown"}],
        "commands": [{"id": "command.enter_digit"}],
        "policies": [{"id": "policy.input_only_digits"}],
        "external_systems": [],
        "constraints": [{"id": "constraint.browser_only"}],
        "vocabulary_questions": [{"id": "question.operation"}],
        "context_completion_questions": [],
        "summary": {"status": "ready_for_candidate_graph"},
    }


def _candidate_graph() -> dict:
    return {
        "artifact_kind": "candidate_spec_graph",
        "schema_version": 1,
        "proposal_id": "0150",
        "contract_ref": "specgraph.idea-to-spec.candidate-spec-graph.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "active_frame": {
            "project": "DemoCalculator",
            "ontology_refs": ["ontology://specgraph-core"],
            "domain_refs": ["domain.calculator"],
            "context_refs": ["context.idea_to_spec"],
        },
        "pre_sib_readiness": {"ready": True, "review_state": "ready_for_pre_sib"},
        "nodes": [
            {
                "id": "candidate-spec.calculator-product",
                "title": "Calculator Product",
                "kind": "product_boundary",
                "ontology_refs": ["ontology://specgraph-core#Spec"],
                "requirements": [{"id": "req.product.result"}],
                "acceptance_criteria": [{"id": "ac.product.result"}],
                "claims": [{"id": "claim.product.boundary"}],
                "gaps": [],
            },
            {
                "id": "candidate-spec.numeric-input",
                "title": "Numeric Input",
                "kind": "feature",
                "ontology_refs": [],
                "requirements": [{"id": "req.input.digits"}],
                "acceptance_criteria": [],
                "claims": [],
                "gaps": [{"id": "gap.input-format"}],
            },
        ],
        "edges": [{"id": "edge.product.input"}],
    }


def _pre_sib() -> dict:
    return {
        "artifact_kind": "pre_sib_coherence_report",
        "schema_version": 1,
        "proposal_id": "0151",
        "contract_ref": "specgraph.idea-to-spec.pre-sib-coherence-report.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": False,
            "review_state": "pre_sib_review_required",
            "blocked_by": ["pre_sib_ontology_coverage_gap"],
        },
        "metrics": {
            "node_count": 2,
            "edge_count": 1,
            "orphan_node_count": 0,
            "ontology_coverage_ratio": 0.5,
        },
        "findings": [
            {
                "finding_id": "pre_sib_ontology_coverage_gap",
                "severity": "review_required",
                "message": "Every candidate node should carry ontology refs.",
            }
        ],
        "warnings": [],
    }


def _repair_loop() -> dict:
    return {
        "artifact_kind": "candidate_repair_loop_report",
        "schema_version": 1,
        "proposal_id": "0152",
        "contract_ref": "specgraph.idea-to-spec.candidate-repair-loop.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": True,
            "review_state": "repair_preview_ready",
            "next_artifact": "runs/idea_to_spec_workspace_bundle.json",
        },
        "repair_actions": [
            {
                "id": "repair.ontology-gap.candidate-spec-numeric-input",
                "kind": "add_ontology_gap",
                "status": "requires_context",
                "target_ref": "candidate-spec.numeric-input",
                "source_findings": ["pre_sib_ontology_coverage_gap"],
                "rationale": "Ontology refs need owner context.",
            }
        ],
        "metric_delta_projection": {
            "delta": {
                "gap_count": 1,
            }
        },
        "summary": {
            "status": "repair_preview_ready",
            "action_count": 1,
            "applied_action_count": 0,
            "context_required_count": 1,
        },
    }


def _workspace_artifacts() -> dict[str, dict]:
    return {
        idea_to_spec_workspace.IDEA_EVENT_STORMING_INTAKE_ARTIFACT: _intake(),
        idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT: _candidate_graph(),
        idea_to_spec_workspace.PRE_SIB_COHERENCE_REPORT_ARTIFACT: _pre_sib(),
        idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: _repair_loop(),
    }


class IdeaToSpecWorkspaceTests(unittest.TestCase):
    def test_build_workspace_summarizes_candidate_graph_and_repairs(self) -> None:
        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=_workspace_artifacts(),
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["artifact_kind"], "specspace_idea_to_spec_workspace")
        self.assertEqual(body["summary"]["status"], "ready")
        self.assertEqual(body["summary"]["candidate_node_count"], 2)
        self.assertEqual(body["summary"]["repair_action_count"], 1)
        self.assertEqual(body["intake"]["summary"]["actor_count"], 1)
        self.assertEqual(body["candidate_graph"]["summary"]["requirement_count"], 2)
        self.assertEqual(
            body["candidate_graph"]["nodes"][1]["id"],
            "candidate-spec.numeric-input",
        )
        self.assertEqual(
            body["pre_sib"]["findings"][0]["finding_id"],
            "pre_sib_ontology_coverage_gap",
        )
        self.assertEqual(
            body["repair_loop"]["actions"][0]["status"],
            "requires_context",
        )
        self.assertEqual(
            body["artifacts"]["candidate_graph"]["status"],
            "ready_for_pre_sib",
        )
        self.assertFalse(
            body["authority_boundary"]["may_mutate_canonical_specs"]
        )
        self.assertFalse(
            body["authority_boundary"]["may_create_branch_or_commit"]
        )

    def test_summary_counts_raw_items_before_display_limits(self) -> None:
        artifacts = _workspace_artifacts()
        pre_sib = _pre_sib()
        pre_sib["findings"] = [
            {
                "finding_id": f"finding.{index}",
                "severity": "review_required",
                "message": "Needs review.",
            }
            for index in range(45)
        ]
        pre_sib["warnings"] = [
            {
                "finding_id": f"warning.{index}",
                "severity": "warning",
                "message": "Needs attention.",
            }
            for index in range(2)
        ]
        repair_loop = _repair_loop()
        repair_loop["repair_actions"] = [
            {
                "id": f"repair.{index}",
                "kind": "add_ontology_gap",
                "status": "requires_context",
            }
            for index in range(44)
        ]
        artifacts[idea_to_spec_workspace.PRE_SIB_COHERENCE_REPORT_ARTIFACT] = pre_sib
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["summary"]["pre_sib_finding_count"], 47)
        self.assertEqual(body["summary"]["repair_action_count"], 44)
        self.assertEqual(
            len(body["pre_sib"]["findings"]),
            idea_to_spec_workspace.DISPLAY_LIMITS["findings"],
        )
        self.assertEqual(
            len(body["repair_loop"]["actions"]),
            idea_to_spec_workspace.DISPLAY_LIMITS["repair_actions"],
        )

    def test_build_workspace_rejects_invalid_or_write_capable_artifacts(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts[idea_to_spec_workspace.IDEA_EVENT_STORMING_INTAKE_ARTIFACT] = {
            **_intake(),
            "canonical_mutations_allowed": True,
        }
        artifacts[idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT] = {
            **_candidate_graph(),
            "artifact_kind": "stale_candidate_graph",
        }
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = {
            **_repair_loop(),
            "tracked_artifacts_written": True,
        }

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["summary"]["status"], "partial")
        self.assertEqual(body["summary"]["available_artifact_count"], 1)
        self.assertEqual(body["summary"]["missing_artifact_count"], 3)
        self.assertEqual(body["summary"]["candidate_node_count"], 0)
        self.assertEqual(body["summary"]["repair_action_count"], 0)
        self.assertFalse(body["intake"]["available"])
        self.assertFalse(body["candidate_graph"]["available"])
        self.assertFalse(body["repair_loop"]["available"])
        self.assertEqual(
            body["artifacts"]["candidate_graph"]["reason"],
            "invalid_artifact_contract",
        )
        self.assertEqual(
            body["artifacts"]["repair_loop"]["reason"],
            "invalid_artifact_contract",
        )

    def test_build_workspace_degrades_when_artifacts_are_missing(self) -> None:
        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts={
                idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT: _candidate_graph()
            },
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["summary"]["status"], "partial")
        self.assertEqual(body["summary"]["available_artifact_count"], 1)
        self.assertEqual(body["summary"]["missing_artifact_count"], 3)
        self.assertFalse(body["artifacts"]["event_storming_intake"]["available"])
        self.assertTrue(body["artifacts"]["candidate_graph"]["available"])

    def test_file_provider_reads_workspace_runs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            for filename, payload in _workspace_artifacts().items():
                _write_json(runs_dir / filename, payload)
            provider = specspace_provider.FileSpecGraphProvider(
                spec_nodes_dir=None,
                runs_dir=runs_dir,
                specgraph_dir=root,
            )

            status, body = provider.read_idea_to_spec_workspace()

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(body["source"]["provider"], "file")
        self.assertEqual(body["summary"]["status"], "ready")
        self.assertTrue(body["artifacts"]["repair_loop"]["available"])

    def test_file_artifact_catalog_lists_workspace_runs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_json(
                runs_dir / idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT,
                _repair_loop(),
            )
            provider = specspace_provider.FileSpecGraphProvider(
                spec_nodes_dir=None,
                runs_dir=runs_dir,
                specgraph_dir=root,
            )

            status, body = provider.read_artifact_catalog()

        self.assertEqual(status, HTTPStatus.OK)
        paths = {entry["path"] for entry in body["artifacts"]}
        self.assertIn("runs/candidate_repair_loop_report.json", paths)

    def test_http_provider_reads_workspace_runs_from_manifest(self) -> None:
        manifest = {
            "artifact_kind": "specgraph_static_artifact_manifest",
            "files": [
                {
                    "path": f"runs/{filename}",
                    "root": "runs",
                    "sha256": "0" * 64,
                    "size_bytes": 100,
                }
                for filename in idea_to_spec_workspace.WORKSPACE_RUN_ARTIFACTS
            ],
        }
        payloads = {
            f"https://artifact.test/runs/{filename}": json.dumps(payload)
            for filename, payload in _workspace_artifacts().items()
        }
        provider = specspace_provider.HttpSpecGraphProvider(
            base_url="https://artifact.test",
            cache=specspace_provider.HttpArtifactCache(
                manifest=manifest,
                manifest_loaded_at=time.time(),
            ),
        )

        def fake_get(url: str, **_: object) -> tuple[HTTPStatus, str | None, None]:
            return HTTPStatus.OK, payloads[url], None

        with mock.patch.object(specspace_provider, "http_get_text", fake_get):
            status, body = provider.read_idea_to_spec_workspace()

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["summary"]["status"], "ready")
        self.assertTrue(body["artifacts"]["event_storming_intake"]["available"])


if __name__ == "__main__":
    unittest.main()
