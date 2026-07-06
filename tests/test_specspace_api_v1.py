import json
import os
import shutil
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

import yaml

from viewer import (
    agent_surfaces,
    idea_to_spec_candidate_approval_intents,
    idea_to_spec_intake_clarification_answers,
    idea_to_spec_repair_rerun_requests,
    idea_to_spec_workspace,
    idea_to_spec_workspace_state_hygiene,
    server,
    specspace_v1_api,
    specspace_provider,
)


REPO_ROOT = Path(__file__).resolve().parent.parent
AGENT_WORKBENCH_FIXTURES = (
    Path(__file__).resolve().parent / "fixtures" / "agent_workbench"
)

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


def _write_product_workspace_runs(
    runs_dir: Path,
    *,
    candidate_id: str = "team-decision-log",
    display_name: str = "Team Decision Log",
    public_route: str = "/team-decision-log",
    project: str = "TeamDecisionLog",
    domain_ref: str = "domain.team_decision_log",
    root_node_id: str = "candidate-spec.team-decision-log-product",
    root_title: str = "Team Decision Log Product",
) -> None:
    runs_dir.mkdir(parents=True, exist_ok=True)
    _write_json(
        runs_dir / idea_to_spec_workspace.ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
        {
            "artifact_kind": "active_idea_to_spec_candidate",
            "schema_version": 1,
            "candidate": {
                "candidate_id": candidate_id,
                "display_name": display_name,
                "public_route": public_route,
                "workflow_lane": "product_idea_to_spec",
                "target_repository_role": "product_spec_workspace",
            },
            "readiness": {
                "ready": True,
                "review_state": "active_candidate_ready",
                "blocked_by": [],
            },
            "authority_boundary": {
                "may_create_branch_or_commit": False,
                "may_mutate_canonical_specs": False,
            },
            "canonical_mutations_allowed": False,
        },
    )
    _write_json(
        runs_dir / idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT,
        {
            "artifact_kind": "candidate_spec_graph_seed",
            "schema_version": 1,
            "contract_ref": "specgraph.idea-to-spec.candidate-spec-graph-seed.v0.1",
            "source_ref": f"product://{candidate_id}/candidate-spec-graph-seed",
            "candidate_graph": {"nodes": [], "edges": []},
            "source_generation": {
                "artifact_kind": "ontology_bound_candidate_graph_seed_generation",
                "schema_version": 1,
                "proposal_id": "0159",
                "contract_ref": (
                    "specgraph.idea-to-spec."
                    "ontology-bound-candidate-graph-seed.v0.1"
                ),
                "ontology": {
                    "id": "org.0al.specgraph.core",
                    "namespace": "sgcore",
                    "version": "0.1.0",
                    "source_ref": (
                        "ontology/packages/specgraph-core/generated/"
                        "ontology.normalized.json"
                    ),
                    "class_count": 14,
                    "relation_count": 16,
                },
                "ontology_bindings": [
                    {
                        "term": "Spec",
                        "ontology_ref": (
                            "ontology://org.0al.specgraph.core/0.1.0/classes/Spec"
                        ),
                        "binding_kind": "core_type",
                        "authority": "ontology_ir",
                    }
                ],
                "ontology_gaps": [
                    {
                        "id": "ontology-gap.decision-record",
                        "kind": "ontology_gap",
                        "term": "Decision Record",
                        "source_ref": "candidate-spec.decision-record",
                        "source_kind": "domain_entity",
                        "suggested_action": "confirm_bind_or_promote_domain_term",
                        "blocks_candidate_graph": False,
                    }
                ],
                "readiness": {
                    "ready": True,
                    "review_state": "ready_for_candidate_graph",
                    "blocked_by": [],
                },
                "authority_boundary": {
                    "may_execute_prompt_agent": False,
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_write_ontology_lockfile": False,
                    "may_accept_ontology_terms": False,
                    "may_mark_candidate_graph_accepted": False,
                    "may_create_branch_or_commit": False,
                },
                "privacy_boundary": {
                    "raw_intent_text_published": False,
                    "raw_prompt_published": False,
                    "raw_model_output_published": False,
                },
                "findings": [],
                "warnings": [],
                "summary": {
                    "status": "ready_for_candidate_graph",
                    "node_count": 2,
                    "edge_count": 1,
                    "ontology_binding_count": 1,
                    "ontology_gap_count": 1,
                    "finding_count": 0,
                },
            },
        },
    )
    _write_json(
        runs_dir / idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT,
        {
            "artifact_kind": "candidate_spec_graph",
            "schema_version": 1,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "active_frame": {
                "project": project,
                "domain_refs": [domain_ref],
                "context_refs": ["context.idea_to_spec"],
                "ontology_refs": ["ontology://specgraph-core"],
            },
            "nodes": [
                {
                    "id": root_node_id,
                    "title": root_title,
                    "kind": "product_boundary",
                    "description": "Product boundary for the pilot workspace.",
                    "requirements": [
                        {
                            "id": "req.product.record-decision",
                            "statement": "The product must capture reviewable decisions.",
                        }
                    ],
                    "acceptance_criteria": [
                        {
                            "id": "ac.product.record-decision",
                            "statement": "A reviewer can inspect a decision record.",
                        }
                    ],
                },
                {
                    "id": "candidate-spec.decision-record",
                    "title": "Decision Record",
                    "kind": "domain_entity",
                    "description": "Minimum structure of a decision record.",
                    "requirements": [],
                    "acceptance_criteria": [],
                },
            ],
            "edges": [
                {
                    "source_id": "candidate-spec.decision-record",
                    "target_id": root_node_id,
                    "edge_kind": "refines",
                }
            ],
        },
    )


def _write_repair_draft_workspace_runs(
    runs_dir: Path,
    *,
    include_repair_session: bool = True,
    include_secondary_request: bool = False,
    include_import_preview: bool = False,
    import_preview_ready: bool = True,
    accepted_for_rerun_count: int | None = None,
    include_platform_import_preview_report: bool = False,
    include_rerun_report: bool = False,
    include_platform_request_gate_report: bool = False,
    include_platform_rerun_reports: bool = False,
    include_platform_publication_report: bool = True,
    ready_for_candidate_approval: bool = False,
    platform_reports_ok: bool = True,
    include_repaired_handoff: bool = False,
    repaired_artifacts_published: bool = True,
) -> None:
    _write_product_workspace_runs(runs_dir)
    clarification_requests = [
        {
            "id": "clarification.candidate-gap.ontology-gap-decision-record",
            "kind": "ontology_gap",
            "severity": "review_required",
            "status": "open",
            "target_ref": "candidate-spec.decision-record.gaps.ontology-gap.decision-record",
            "question": "Should Decision Record bind, alias, remain local, or be rejected?",
            "suggested_actions": [
                "bind_existing_term",
                "alias",
                "propose_project_local_term",
                "reject",
                "defer",
            ],
        }
    ]
    if include_secondary_request:
        clarification_requests.append(
            {
                "id": "clarification.candidate-gap.ontology-gap-decision-owner",
                "kind": "ontology_gap",
                "severity": "review_required",
                "status": "open",
                "target_ref": "candidate-spec.decision-record.gaps.ontology-gap.decision-owner",
                "question": "Should Decision Owner bind, alias, remain local, or be rejected?",
                "suggested_actions": [
                    "bind_existing_term",
                    "alias",
                    "propose_project_local_term",
                    "reject",
                    "defer",
                ],
            }
        )
    _write_json(
        runs_dir / idea_to_spec_workspace.IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT,
        {
            "artifact_kind": "idea_to_spec_clarification_requests",
            "schema_version": 1,
            "proposal_id": "0163",
            "contract_ref": "specgraph.idea-to-spec.clarification-requests.v0.1",
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "readiness": {
                "ready": False,
                "review_state": "clarification_required",
                "blocked_by": [item["id"] for item in clarification_requests],
            },
            "clarification_requests": clarification_requests,
            "request_counts": {
                "total": len(clarification_requests),
                "by_kind": {"ontology_gap": len(clarification_requests)},
                "by_status": {"open": len(clarification_requests)},
            },
        },
    )
    if include_repair_session:
        _write_json(
            runs_dir / idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT,
            {
                "artifact_kind": "idea_to_spec_repair_session_journal",
                "schema_version": 1,
                "proposal_id": "0171",
                "contract_ref": "specgraph.idea-to-spec.repair-session-journal.v0.1",
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "readiness": {
                    "ready": True,
                    "review_state": "repair_session_journal_ready",
                    "blocked_by": [],
                    "next_artifact": "SpecSpace product repair workspace",
                },
                "session": {
                    "session_id": "repair-session.team-decision-log",
                    "candidate_id": "team-decision-log",
                    "workspace_route": "/team-decision-log",
                    "workflow_lane": "product_idea_to_spec",
                    "target_repository_role": "product_spec_workspace",
                    "governance_profile": "product_workspace",
                    "operator_ref": "operator://workspace-owner",
                },
                "readiness_impact": {
                    "ready_for_candidate_approval": ready_for_candidate_approval,
                    "ready_for_platform_promotion": False,
                    "intermediate_artifacts_ready": True,
                    "candidate_quality_review_state": "candidate_quality_partially_improved",
                    "promotion_gate_review_state": (
                        "idea_to_spec_promotion_ready"
                        if ready_for_candidate_approval
                        else "idea_to_spec_promotion_blocked"
                    ),
                    "active_candidate_review_state": "active_candidate_review_required",
                    "resolved_ontology_gap_count": 1 if ready_for_candidate_approval else 0,
                    "unresolved_ontology_gap_count": 0 if ready_for_candidate_approval else 1,
                    "rerun_removed_gap_count": 1 if ready_for_candidate_approval else 0,
                    "clarification_request_count": 1,
                    "accepted_answer_count": 1 if ready_for_candidate_approval else 0,
                    "ontology_decision_count": 1 if ready_for_candidate_approval else 0,
                    "promotion_path_count": 1 if ready_for_candidate_approval else 0,
                    "blocked_by": (
                        [] if ready_for_candidate_approval else ["unresolved_ontology_gaps"]
                    ),
                    "platform_promotion_blocked_by": (
                        []
                        if ready_for_candidate_approval
                        else ["candidate_not_ready_for_approval"]
                    ),
                },
                "workflow_journal": {
                    "stages": [],
                    "accepted_answers": [],
                    "ontology_decisions": [],
                    "rerun_overlay_refs": {},
                    "preview_refs": {},
                },
                "source_artifacts": {},
                "summary": {
                    "status": "repair_session_journal_ready",
                    "candidate_id": "team-decision-log",
                    "workflow_lane": "product_idea_to_spec",
                    "accepted_answer_count": 1 if ready_for_candidate_approval else 0,
                    "ontology_decision_count": 1 if ready_for_candidate_approval else 0,
                    "resolved_ontology_gap_count": 1 if ready_for_candidate_approval else 0,
                    "unresolved_ontology_gap_count": 0 if ready_for_candidate_approval else 1,
                    "ready_for_candidate_approval": ready_for_candidate_approval,
                    "finding_count": 0,
                },
                "authority_boundary": {
                    "may_execute_prompt_agent": False,
                    "may_apply_answers_to_source_artifacts": False,
                    "may_apply_decisions_to_source_artifacts": False,
                    "may_mutate_candidate_source_artifacts": False,
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_write_ontology_lockfile": False,
                    "may_accept_ontology_terms": False,
                    "may_mark_candidate_graph_accepted": False,
                    "may_create_branch_or_commit": False,
                    "may_open_pull_request": False,
                    "may_publish_read_model": False,
                },
                "privacy_boundary": {
                    "raw_idea_text_published": False,
                    "raw_prompt_published": False,
                    "raw_model_output_published": False,
                    "raw_operator_note_published": False,
                    "static_flags_are_asserted_invariants": True,
                    "redaction_enforced_by": "recursive_public_safe_field_filter",
                },
                "findings": [],
            },
        )
    if include_repaired_handoff:
        _write_json(
            runs_dir
            / idea_to_spec_workspace.REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT,
            {
                "artifact_kind": "repaired_candidate_promotion_handoff_report",
                "schema_version": 1,
                "proposal_id": "0177",
                "contract_ref": "specgraph.idea-to-spec.repaired-candidate-promotion-handoff.v0.1",
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "readiness": {
                    "ready": True,
                    "review_state": "repaired_candidate_promotion_handoff_ready",
                    "blocked_by": [],
                    "next_artifact": "candidate_approval_decision",
                },
                "authority_boundary": {
                    "may_execute_prompt_agent": False,
                    "may_mutate_candidate_source_artifacts": False,
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_write_ontology_lockfile": False,
                    "may_accept_ontology_terms": False,
                    "may_mark_candidate_graph_accepted": False,
                    "may_create_branch_or_commit": False,
                    "may_open_pull_request": False,
                    "may_publish_read_model": False,
                },
                "privacy_boundary": {
                    "raw_idea_text_published": False,
                    "raw_prompt_published": False,
                    "raw_model_output_published": False,
                    "raw_operator_note_published": False,
                },
                "findings": [],
                "summary": {
                    "status": "repaired_candidate_promotion_handoff_ready",
                    "finding_count": 0,
                    "removed_gap_count": 2,
                    "resolved_ontology_gap_count": 1,
                    "unresolved_ontology_gap_count": 0,
                    "resolved_candidate_gap_count": 1,
                    "unresolved_candidate_gap_count": 0,
                    "ready_for_candidate_approval": True,
                    "ready_for_platform_promotion": False,
                },
            },
        )
        _write_json(
            runs_dir
            / idea_to_spec_workspace.REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
            {
                "artifact_kind": "active_idea_to_spec_candidate",
                "schema_version": 1,
                "canonical_mutations_allowed": False,
                "candidate": {
                    "candidate_id": "team-decision-log",
                    "display_name": "Team Decision Log",
                    "public_route": "/team-decision-log",
                    "workflow_lane": "product_idea_to_spec",
                    "target_repository_role": "product_spec_workspace",
                    "governance_profile": "product_workspace",
                    "authority_profile": "workspace_owner_controlled",
                },
                "readiness": {
                    "ready": True,
                    "review_state": "active_candidate_ready",
                    "blocked_by": [],
                },
                "authority_boundary": {
                    "may_execute_prompt_agent": False,
                    "may_mutate_candidate_source_artifacts": False,
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_create_branch_or_commit": False,
                    "may_open_pull_request": False,
                    "may_mark_candidate_graph_accepted": False,
                },
            },
        )
        _write_json(
            runs_dir / idea_to_spec_workspace.REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT,
            {
                "artifact_kind": "candidate_spec_graph",
                "schema_version": 1,
                "readiness": {
                    "ready": True,
                    "review_state": "candidate_graph_ready",
                    "blocked_by": [],
                },
                "nodes": [],
                "edges": [],
                "summary": {
                    "candidate_id": "team-decision-log",
                    "node_count": 0,
                    "edge_count": 0,
                },
                "authority_boundary": {
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_accept_ontology_terms": False,
                },
            },
        )
        _write_json(
            runs_dir / idea_to_spec_workspace.REPAIRED_PRE_SIB_COHERENCE_REPORT_ARTIFACT,
            {
                "artifact_kind": "pre_sib_coherence_report",
                "schema_version": 1,
                "readiness": {
                    "ready": True,
                    "review_state": "pre_sib_ready",
                    "blocked_by": [],
                },
                "findings": [],
                "summary": {"finding_count": 0},
            },
        )
        _write_json(
            runs_dir
            / idea_to_spec_workspace.REPAIRED_CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT,
            {
                "artifact_kind": "candidate_repair_loop_report",
                "schema_version": 1,
                "readiness": {
                    "ready": True,
                    "review_state": "repair_preview_ready",
                    "blocked_by": [],
                },
                "actions": [],
                "summary": {"context_required_count": 0},
            },
        )
        _write_json(
            runs_dir
            / idea_to_spec_workspace.REPAIRED_CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT,
            {
                "artifact_kind": "candidate_spec_materialization_report",
                "schema_version": 1,
                "readiness": {
                    "ready": True,
                    "review_state": "materialized_candidate_review_ready",
                    "blocked_by": [],
                },
                "materialized_files": [
                    {
                        "promotion_path": (
                            "runs/materialized_candidate_specs/"
                            "CANDIDATE-TEAM-DECISION-LOG.yaml"
                        )
                    }
                ],
                "summary": {"materialized_file_count": 1},
            },
        )
        _write_json(
            runs_dir
            / idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT,
            {
                "artifact_kind": "idea_to_spec_repair_session_journal",
                "schema_version": 1,
                "proposal_id": "0171",
                "contract_ref": "specgraph.idea-to-spec.repair-session-journal.v0.1",
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "readiness": {
                    "ready": True,
                    "review_state": "repair_session_journal_ready",
                    "blocked_by": [],
                },
                "session": {
                    "session_id": "repaired-session.team-decision-log",
                    "candidate_id": "team-decision-log",
                    "workspace_route": "/team-decision-log",
                    "workflow_lane": "product_idea_to_spec",
                    "target_repository_role": "product_spec_workspace",
                    "governance_profile": "product_workspace",
                    "operator_ref": "operator://workspace-owner",
                },
                "readiness_impact": {
                    "ready_for_candidate_approval": True,
                    "ready_for_platform_promotion": False,
                    "intermediate_artifacts_ready": True,
                    "candidate_quality_review_state": "candidate_quality_repaired",
                    "promotion_gate_review_state": "ready_for_platform_promotion_request",
                    "active_candidate_review_state": "active_candidate_ready",
                    "resolved_ontology_gap_count": 1,
                    "unresolved_ontology_gap_count": 0,
                    "resolved_candidate_gap_count": 1,
                    "unresolved_candidate_gap_count": 0,
                    "rerun_removed_gap_count": 2,
                    "promotion_path_count": 1,
                    "blocked_by": [],
                    "platform_promotion_blocked_by": [],
                },
                "workflow_journal": {
                    "stages": [],
                    "accepted_answers": [],
                    "ontology_decisions": [],
                    "rerun_overlay_refs": {},
                    "preview_refs": {},
                },
                "summary": {
                    "status": "repair_session_journal_ready",
                    "candidate_id": "team-decision-log",
                    "workflow_lane": "product_idea_to_spec",
                    "resolved_ontology_gap_count": 1,
                    "unresolved_ontology_gap_count": 0,
                    "ready_for_candidate_approval": True,
                    "finding_count": 0,
                },
                "authority_boundary": {
                    "may_execute_prompt_agent": False,
                    "may_mutate_candidate_source_artifacts": False,
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_write_ontology_lockfile": False,
                    "may_accept_ontology_terms": False,
                    "may_mark_candidate_graph_accepted": False,
                    "may_create_branch_or_commit": False,
                    "may_open_pull_request": False,
                    "may_publish_read_model": False,
                },
                "privacy_boundary": {
                    "raw_idea_text_published": False,
                    "raw_prompt_published": False,
                    "raw_model_output_published": False,
                    "raw_operator_note_published": False,
                },
                "findings": [],
            },
        )
        _write_json(
            runs_dir
            / idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT,
            {
                "artifact_kind": "idea_to_spec_promotion_gate",
                "schema_version": 1,
                "proposal_id": "0154",
                "contract_ref": "specgraph.idea-to-spec.promotion-gate.v0.1",
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "readiness": {
                    "ready": True,
                    "review_state": "ready_for_platform_promotion_request",
                    "blocked_by": [],
                    "next_artifact": "candidate_approval_decision",
                },
                "promotion_request": {
                    "path_argument": "--path",
                    "paths": [
                        "runs/materialized_candidate_specs/CANDIDATE-TEAM-DECISION-LOG.yaml"
                    ],
                    "platform_artifact_kind": "platform_graph_repository_promotion_request",
                },
                "metric_snapshot": {"promotion_path_count": 1},
                "findings": [],
                "warnings": [],
                "summary": {
                    "status": "ready_for_platform_promotion_request",
                    "finding_count": 0,
                    "promotion_path_count": 1,
                    "materialized_file_count": 1,
                },
            },
        )
    if include_import_preview:
        import_ready = import_preview_ready
        accepted_count = (
            accepted_for_rerun_count
            if accepted_for_rerun_count is not None
            else (1 if import_ready else 0)
        )
        _write_json(
            runs_dir / idea_to_spec_workspace.SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT,
            {
                "artifact_kind": "specspace_repair_draft_import_preview",
                "schema_version": 1,
                "proposal_id": "0172",
                "contract_ref": "specgraph.specspace.repair-draft-import-preview.v0.1",
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "readiness": {
                    "ready": import_ready,
                    "review_state": (
                        "repair_draft_import_preview_ready"
                        if import_ready
                        else "repair_draft_import_preview_review_required"
                    ),
                    "blocked_by": [] if import_ready else ["invalid_repair_drafts"],
                },
                "import_preview": {
                    "valid_imports": [
                        {
                            "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                            "action": "propose_project_local_term",
                        }
                    ]
                    if accepted_count
                    else [],
                    "invalid_drafts": [] if import_ready else [{"id": "draft.invalid"}],
                    "deferred_drafts": [],
                    "superseded_drafts": [],
                },
                "summary": {
                    "status": (
                        "repair_draft_import_preview_ready"
                        if import_ready
                        else "repair_draft_import_preview_review_required"
                    ),
                    "workspace_id": "team-decision-log",
                    "candidate_id": "team-decision-log",
                    "draft_count": 1,
                    "selected_workspace_draft_count": 1,
                    "accepted_for_rerun_count": accepted_count,
                    "deferred_count": 0,
                    "invalid_draft_count": 0 if import_ready else 1,
                    "superseded_draft_count": 0,
                    "clarification_answer_candidate_count": accepted_count,
                    "ontology_decision_candidate_count": accepted_count,
                    "would_resolve_blocking_request_count": accepted_count,
                    "would_leave_unresolved_gap_count": 0 if accepted_count else 1,
                    "finding_count": 0 if import_ready else 1,
                },
                "authority_boundary": {
                    "may_execute_prompt_agent": False,
                    "may_apply_answers_to_source_artifacts": False,
                    "may_apply_decisions_to_source_artifacts": False,
                    "may_mutate_candidate_source_artifacts": False,
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_accept_ontology_terms": False,
                    "may_create_branch_or_commit": False,
                    "may_open_pull_request": False,
                },
                "privacy_boundary": {
                    "raw_idea_text_published": False,
                    "raw_prompt_published": False,
                    "raw_model_output_published": False,
                },
                "findings": [] if import_ready else [{"finding_id": "invalid_repair_drafts"}],
            },
        )
    if include_platform_import_preview_report:
        _write_json(
            runs_dir
            / idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_DRAFT_IMPORT_EXECUTION_REPORT_ARTIFACT,
            {
                "artifact_kind": "platform_product_repair_draft_import_preview_execution_report",
                "schema_version": 1,
                "ok": True,
                "dry_run": False,
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "repair_session_ref": "runs/isolated/idea_to_spec_repair_session.json",
                "clarification_requests_ref": "runs/idea_to_spec_clarification_requests.json",
                "authority_boundary": {
                    "executes_specgraph_make_target": True,
                    "executes_git_commands": False,
                    "opens_pull_requests": False,
                    "merges_pull_requests": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                    "mutates_canonical_specs": False,
                    "publishes_private_artifacts": False,
                },
                "output_artifacts": {
                    "import_preview": {
                        "path": "runs/isolated/specspace_repair_draft_import_preview.json",
                        "present": True,
                        "artifact_kind": "specspace_repair_draft_import_preview",
                        "contract_ref": (
                            "specgraph.idea-to-spec.specspace-repair-draft-import-preview.v0.1"
                        ),
                        "ready": True,
                        "status": "repair_draft_import_preview_ready",
                        "summary": {
                            "status": "repair_draft_import_preview_ready",
                            "accepted_for_rerun_count": 1,
                        },
                        "sha256": "sha256:import-preview",
                    }
                },
                "diagnostics": [],
                "summary": {
                    "status": "completed",
                    "error_count": 0,
                    "import_preview_digest": "sha256:import-preview",
                    "import_preview_status": "repair_draft_import_preview_ready",
                },
            },
        )
    if include_platform_request_gate_report:
        _write_json(
            runs_dir
            / idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_REQUEST_GATE_EXECUTION_REPORT_ARTIFACT,
            {
                "artifact_kind": "platform_product_repair_rerun_request_gate_execution_report",
                "schema_version": 1,
                "ok": True,
                "dry_run": False,
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "repair_session_ref": "runs/isolated/idea_to_spec_repair_session.json",
                "import_preview_ref": "runs/isolated/specspace_repair_draft_import_preview.json",
                "authority_boundary": {
                    "executes_specgraph_make_target": True,
                    "executes_git_commands": False,
                    "opens_pull_requests": False,
                    "merges_pull_requests": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                    "mutates_canonical_specs": False,
                    "publishes_private_artifacts": False,
                },
                "output_artifacts": {
                    "request_gate": {
                        "path": "runs/isolated/specspace_repair_rerun_request_gate.json",
                        "present": True,
                        "artifact_kind": "specspace_repair_rerun_request_gate",
                        "contract_ref": (
                            "specgraph.idea-to-spec.specspace-repair-rerun-request-gate.v0.1"
                        ),
                        "ready": True,
                        "status": "ready",
                        "summary": {"status": "ready"},
                        "sha256": "sha256:request-gate",
                    }
                },
                "diagnostics": [],
                "summary": {
                    "status": "completed",
                    "error_count": 0,
                    "request_gate_digest": "sha256:request-gate",
                    "request_gate_status": "ready",
                },
            },
        )
    if include_platform_rerun_reports:
        _write_json(
            runs_dir
            / idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT,
            {
                "artifact_kind": "platform_product_repair_rerun_execution_report",
                "schema_version": 1,
                "ok": platform_reports_ok,
                "dry_run": False,
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "authority_boundary": {
                    "executes_specgraph_make_target": True,
                    "executes_git_commands": False,
                    "opens_pull_requests": False,
                    "merges_pull_requests": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                    "mutates_canonical_specs": False,
                    "publishes_private_artifacts": False,
                },
                "operations": [
                    {
                        "name": "execute_specgraph_requested_rerun",
                        "status": "succeeded" if platform_reports_ok else "failed",
                        "reason": "SpecGraph requested rerun target executed",
                        "evidence": [
                            "product-workspace-requested-repair-draft-rerun"
                        ],
                    }
                ],
                "output_artifacts": {
                    "rerun_report": {
                        "path": "runs/specspace_repair_draft_rerun_report.json",
                        "present": platform_reports_ok,
                        "artifact_kind": "specspace_repair_draft_rerun_report",
                        "contract_ref": "specgraph.idea-to-spec.specspace-repair-draft-rerun.v0.1",
                        "status": "repair_draft_rerun_ready" if platform_reports_ok else "blocked",
                        "ready": platform_reports_ok,
                        "sha256": "sha256:rerun",
                    },
                    "repair_session": {
                        "path": "runs/idea_to_spec_repair_session.json",
                        "present": True,
                        "artifact_kind": "idea_to_spec_repair_session_journal",
                        "status": "repair_session_journal_ready",
                        "ready": True,
                        "sha256": "sha256:session",
                    },
                },
                "diagnostics": [] if platform_reports_ok else [{"level": "error", "message": "failed"}],
                "summary": {
                    "status": "completed" if platform_reports_ok else "failed",
                    "error_count": 0 if platform_reports_ok else 1,
                    "output_artifact_count": 2,
                    "rerun_report_digest": "sha256:rerun" if platform_reports_ok else None,
                    "repair_session_digest": "sha256:session" if platform_reports_ok else None,
                },
            },
        )
        if include_platform_publication_report:
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT,
                {
                    "artifact_kind": "platform_product_repair_rerun_publication_report",
                    "schema_version": 1,
                    "ok": platform_reports_ok,
                    "dry_run": False,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "authority_boundary": {
                        "executes_specgraph_make_target": True,
                        "executes_git_commands": False,
                        "opens_pull_requests": False,
                        "merges_pull_requests": False,
                        "writes_ontology_packages": False,
                        "accepts_ontology_terms": False,
                        "mutates_canonical_specs": False,
                        "publishes_private_artifacts": False,
                    },
                    "manifest": {
                        "path": "dist/specgraph-public/artifact_manifest.json",
                        "present": platform_reports_ok,
                        "sha256": "sha256:manifest" if platform_reports_ok else None,
                    },
                    "published_artifacts": (
                        [
                            "runs/idea_to_spec_repair_session.json",
                            "runs/specspace_repair_draft_rerun_report.json",
                        ]
                        + (
                            [
                                "runs/repaired_candidate_promotion_handoff_report.json",
                                "runs/repaired_active_idea_to_spec_candidate.json",
                                "runs/repaired_candidate_spec_graph.json",
                                "runs/repaired_pre_sib_coherence_report.json",
                                "runs/repaired_candidate_repair_loop_report.json",
                                (
                                    "runs/"
                                    "repaired_candidate_spec_materialization_report.json"
                                ),
                                "runs/repaired_idea_to_spec_repair_session.json",
                                "runs/repaired_idea_to_spec_promotion_gate.json",
                            ]
                            if include_repaired_handoff
                            and repaired_artifacts_published
                            else []
                        )
                    ) if platform_reports_ok else [],
                    "missing_artifacts": [] if platform_reports_ok else ["runs/idea_to_spec_repair_session.json"],
                    "diagnostics": [] if platform_reports_ok else [{"level": "error", "message": "missing"}],
                    "summary": {
                        "status": "published" if platform_reports_ok else "blocked",
                        "error_count": 0 if platform_reports_ok else 1,
                        "published_artifact_count": (
                            6
                            if platform_reports_ok
                            and include_repaired_handoff
                            and repaired_artifacts_published
                            else 2 if platform_reports_ok else 0
                        ),
                        "missing_artifact_count": 0 if platform_reports_ok else 1,
                    },
                },
            )
    if include_rerun_report:
        _write_json(
            runs_dir / idea_to_spec_workspace.SPECSPACE_REPAIR_DRAFT_RERUN_REPORT_ARTIFACT,
            {
                "artifact_kind": "specspace_repair_draft_rerun_report",
                "schema_version": 1,
                "proposal_id": "0173",
                "contract_ref": "specgraph.specspace.repair-draft-rerun.v0.1",
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "readiness": {
                    "ready": True,
                    "review_state": "repair_draft_rerun_ready",
                    "blocked_by": [],
                },
                "summary": {
                    "status": "repair_draft_rerun_ready",
                    "accepted_for_rerun_count": 1,
                    "clarification_answer_count": 1,
                    "ontology_decision_count": 1,
                    "resolved_ontology_gap_count": 1,
                    "unresolved_ontology_gap_count": 0,
                    "finding_count": 0,
                },
                "authority_boundary": {
                    "may_execute_prompt_agent": False,
                    "may_mutate_candidate_source_artifacts": False,
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_accept_ontology_terms": False,
                    "may_create_branch_or_commit": False,
                    "may_open_pull_request": False,
                },
                "findings": [],
            },
    )


def _write_candidate_approval_intent_state(state_dir: Path) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)
    _write_json(
        state_dir / "idea_to_spec_candidate_approval_intents.json",
        {
            "artifact_kind": "specspace_idea_to_spec_candidate_approval_intent_state",
            "schema_version": 1,
            "state_owner": "SpecSpace",
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "source_artifacts": {},
            "consumer_boundary": {
                "specspace_owned_state": True,
                "may_execute_specgraph": False,
            },
            "authority_boundary": {
                "candidate_approval_intent_state_is_authority": False,
                "canonical_mutations_allowed": False,
            },
            "intents": [
                {
                    "id": "candidate-approval-intent.team-decision-log.1",
                    "status": "requested",
                    "requested_action": "approve_candidate_for_promotion_review",
                    "workspace_id": "team-decision-log",
                    "candidate_id": "team-decision-log",
                    "repair_session_id": "repaired-session.team-decision-log",
                    "repair_session_ref": (
                        "runs/repaired_idea_to_spec_repair_session.json"
                    ),
                    "created_at": "2026-06-29T10:00:00Z",
                    "updated_at": "2026-06-29T10:00:00Z",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "may_execute_specgraph": False,
                    "may_execute_prompt_agent": False,
                    "may_apply_to_specgraph": False,
                    "may_mutate_candidate_source_artifacts": False,
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_accept_ontology_terms": False,
                    "may_mark_candidate_accepted": False,
                    "may_mark_candidate_graph_accepted": False,
                    "may_create_branch_or_commit": False,
                    "may_open_pull_request": False,
                    "may_execute_git_service_operation": False,
                }
            ],
        },
    )


def _write_candidate_approval_artifacts(runs_dir: Path) -> None:
    _write_json(
        runs_dir
        / idea_to_spec_workspace.PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT,
        {
            "artifact_kind": "platform_candidate_approval_execution_report",
            "schema_version": 1,
            "ok": True,
            "dry_run": False,
            "canonical_mutations_allowed": False,
            "ontology_writes_allowed": False,
            "tracked_artifacts_written": False,
            "candidate_id": "team-decision-log",
            "workspace_id": "team-decision-log",
            "gate_report_ref": "runs/candidate_approval_gate_report.json",
            "approval_intent_ref": (
                "specspace-state://idea_to_spec_candidate_approval_intents.json"
            ),
            "candidate_approval_decision_ref": (
                "runs/candidate_approval_decision.json"
            ),
            "output_artifacts": {
                "candidate_approval_decision": {
                    "path": "runs/candidate_approval_decision.json",
                    "present": True,
                    "artifact_kind": "candidate_approval_decision",
                    "ready": True,
                    "status": "approved",
                    "sha256": "sha256:candidate-approval",
                }
            },
            "summary": {
                "status": "candidate_approval_decision_materialized",
                "gate_ready": True,
                "decision_written": True,
                "approved_path_count": 1,
                "error_count": 0,
            },
            "authority_boundary": {
                "executes_specgraph": False,
                "executes_git_commands": False,
                "opens_pull_requests": False,
                "merges_pull_requests": False,
                "writes_ontology_packages": False,
                "accepts_ontology_terms": False,
                "mutates_canonical_specs": False,
            },
            "diagnostics": [],
        },
    )
    _write_json(
        runs_dir / idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT,
        {
            "artifact_kind": "candidate_approval_decision",
            "schema_version": 1,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "decision": {
                "state": "approved",
                "requested_state": "approved",
                "operator_ref": "operator://workspace-owner",
                "reason": "candidate is ready for promotion review",
            },
            "candidate": {"candidate_id": "team-decision-log"},
            "promotion_request": {
                "paths": [
                    "runs/materialized_candidate_specs/CANDIDATE-TEAM-DECISION-LOG.yaml"
                ]
            },
            "readiness": {
                "ready": True,
                "review_state": "candidate_approval_ready",
                "blocked_by": [],
            },
            "authority_boundary": {
                "may_execute_git_service": False,
                "may_create_branch_or_commit": False,
                "may_open_pull_request": False,
                "may_mutate_canonical_specs": False,
                "may_write_ontology_package": False,
                "may_accept_ontology_terms": False,
            },
        },
    )


def _write_product_promotion_artifacts(
    runs_dir: Path,
    *,
    include_execution: bool = False,
    include_review_status: bool = False,
    include_publication: bool = False,
) -> None:
    _write_json(
        runs_dir / idea_to_spec_workspace.GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT,
        {
            "artifact_kind": "platform_graph_repository_promotion_request",
            "schema_version": 1,
            "ok": True,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "candidate_id": "team-decision-log",
            "candidate_branch": "graph-candidate/team-decision-log",
            "commit_paths": [
                "runs/materialized_candidate_specs/CANDIDATE-TEAM-DECISION-LOG.yaml"
            ],
            "requested_operations": [
                "prepare_worktree",
                "commit_candidate_paths",
                "open_review_pr",
            ],
            "review": {
                "title": "Promote Team Decision Log candidate spec graph",
                "base_branch": "main",
            },
            "summary": {"status": "promotion_ready", "promotion_ready": True},
            "authority_boundary": {
                "may_execute_git_service": False,
                "may_create_branch_or_commit": False,
                "may_open_pull_request": False,
            },
        },
    )
    if include_execution:
        _write_json(
            runs_dir
            / idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
            {
                "artifact_kind": (
                    "platform_product_candidate_promotion_execution_report"
                ),
                "schema_version": 1,
                "ok": True,
                "dry_run": False,
                "open_review_dry_run": False,
                "workflow_lane": "product_idea_to_spec",
                "candidate_id": "team-decision-log",
                "candidate_branch": "graph-candidate/team-decision-log",
                "promotion_request_ref": (
                    "runs/graph_repository_promotion_request.json"
                ),
                "approval_decision_ref": "runs/candidate_approval_decision.json",
                "git_review": {
                    "candidate_branch": "graph-candidate/team-decision-log",
                    "commit_sha": "5ea1638",
                    "review_url": "https://github.com/0al-spec/SpecGraph/pull/662",
                    "review_number": 662,
                    "review_opened": True,
                    "copied_file_count": 1,
                },
                "git_service_execution": {
                    "operations": [
                        {"name": "open_review_pr", "status": "succeeded"}
                    ],
                },
                "summary": {
                    "status": "promotion_review_opened",
                    "worktree_prepared": True,
                    "commit_created": True,
                    "child_operation_count": 1,
                    "error_count": 0,
                },
                "diagnostics": [],
                "authority_boundary": {
                    "controlled_git_service_execution": True,
                    "creates_candidate_worktree_or_branch": True,
                    "creates_candidate_commit": True,
                    "opens_pull_requests": True,
                    "merges_pull_requests": False,
                    "publishes_read_models": False,
                    "mutates_canonical_specs": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                },
            },
        )
    if include_review_status:
        _write_json(
            runs_dir
            / idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT,
            {
                "artifact_kind": (
                    "platform_product_candidate_promotion_review_status_report"
                ),
                "schema_version": 1,
                "ok": True,
                "workflow_lane": "product_idea_to_spec",
                "candidate_id": "team-decision-log",
                "candidate_branch": "graph-candidate/team-decision-log",
                "review_state": "merged",
                "review_decision": "merged",
                "review_url": "https://github.com/0al-spec/SpecGraph/pull/662",
                "pull_request": {
                    "number": 662,
                    "baseRefName": "main",
                    "headRefName": "graph-candidate/team-decision-log",
                    "mergedAt": "2026-07-05T10:00:00Z",
                    "mergeCommit": {"oid": "abc123"},
                },
                "summary": {
                    "status": "review_merged",
                    "review_merged": True,
                    "error_count": 0,
                },
                "diagnostics": [],
                "authority_boundary": {
                    "may_merge_review": False,
                    "may_publish_read_model": False,
                    "may_mutate_canonical_specs": False,
                },
            },
        )
    if include_publication:
        _write_json(
            runs_dir
            / idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT,
            {
                "artifact_kind": (
                    "platform_product_candidate_promotion_read_model_publication_report"
                ),
                "schema_version": 1,
                "ok": True,
                "dry_run": False,
                "workflow_lane": "product_idea_to_spec",
                "canonical_mutations_allowed": False,
                "canonical_tracked_artifacts_written": False,
                "tracked_artifacts_written": False,
                "candidate_id": "team-decision-log",
                "candidate_branch": "graph-candidate/team-decision-log",
                "review_state": "merged",
                "manifest_name": "artifact_manifest.json",
                "bundle_dir": "dist/specgraph-public/workspaces/team-decision-log",
                "summary": {
                    "status": "read_model_published",
                    "published": True,
                    "read_model_published": True,
                    "file_count": 6,
                    "error_count": 0,
                },
                "operations": [
                    {
                        "name": "publish_product_read_model",
                        "status": "succeeded",
                    }
                ],
                "authority_boundary": {
                    "publishes_read_models": True,
                    "may_mutate_canonical_specs": False,
                    "may_create_branch_or_commit": False,
                    "may_open_pull_request": False,
                },
            },
        )


def _write_project_local_ontology_review_workspace_runs(runs_dir: Path) -> None:
    _write_repair_draft_workspace_runs(runs_dir)
    _write_json(
        runs_dir / idea_to_spec_workspace.PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT,
        {
            "artifact_kind": "project_local_ontology_review_lane",
            "schema_version": 1,
            "proposal_id": "0197",
            "contract_ref": "specgraph.project-local-ontology-review-lane.v0.1",
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "readiness": {
                "ready": True,
                "review_state": "project_local_ontology_review_required",
                "blocked_by": ["project_local_ontology_terms_unreviewed"],
            },
            "context": {
                "workspace_id": "team-decision-log",
                "candidate_id": "team-decision-log",
                "repair_session_id": "repair-session.team-decision-log",
                "workflow_lane": "product_idea_to_spec",
                "domain_refs": ["domain.team_decision_log"],
                "context_refs": ["context.idea_to_spec"],
                "ontology_refs": ["ontology://specgraph-core"],
            },
            "review_decision_schema": {
                "supported_actions": [
                    "keep_project_local",
                    "bind_existing",
                    "alias",
                    "reject",
                    "request_workspace_promotion",
                    "defer",
                ],
                "authority": "operator_intent_only",
                "request_workspace_promotion_effect": "handoff_only",
            },
            "terms": [
                {
                    "id": "project-local-ontology-term.decisionrecord",
                    "term": "Decision Record",
                    "term_key": "decisionrecord",
                    "status": "unreviewed",
                    "source_refs": ["candidate-spec.decision-record"],
                    "suggested_actions": [
                        "keep_project_local",
                        "bind_existing",
                        "alias",
                        "reject",
                        "request_workspace_promotion",
                        "defer",
                    ],
                    "gap_refs": [
                        {
                            "gap_id": "ontology-gap.decision-record",
                            "node_id": "candidate-spec.decision-record",
                            "target_ref": (
                                "candidate-spec.decision-record.gaps."
                                "ontology-gap.decision-record"
                            ),
                            "source_ref": "candidate-spec.decision-record",
                            "source_kind": "domain_entity",
                        }
                    ],
                    "decisions": [],
                    "effect": {
                        "candidate_readiness_effect": "requires_operator_review",
                        "next_action": "record_project_local_ontology_decision",
                        "resolved_gap_count": 0,
                    },
                }
            ],
            "summary": {
                "status": "project_local_ontology_review_required",
                "term_count": 1,
                "reviewed_term_count": 0,
                "blocking_term_count": 1,
                "unreviewed_term_count": 1,
                "deferred_term_count": 0,
                "status_counts": {"unreviewed": 1},
            },
            "source_artifacts": {
                "repair_session": "runs/idea_to_spec_repair_session.json",
                "rerun_materialization": "runs/idea_to_spec_rerun_materialization.json",
            },
            "authority_boundary": {
                "may_execute_prompt_agent": False,
                "may_mutate_candidate_source_artifacts": False,
                "may_mutate_canonical_specs": False,
                "may_write_ontology_package": False,
                "may_write_ontology_lockfile": False,
                "may_accept_ontology_terms": False,
                "may_mark_candidate_graph_accepted": False,
                "may_create_branch_or_commit": False,
                "may_open_pull_request": False,
            },
            "privacy_boundary": {
                "raw_idea_text_published": False,
                "raw_prompt_published": False,
                "raw_model_output_published": False,
                "raw_operator_note_published": False,
            },
            "findings": [],
            "warnings": [],
        },
    )


def _append_product_repair_request(runs_dir: Path) -> str:
    path = runs_dir / idea_to_spec_workspace.IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT
    payload = json.loads(path.read_text(encoding="utf-8"))
    request_id = "clarification.candidate-gap.subscription-payment-enforcement"
    payload["clarification_requests"].append(
        {
            "id": request_id,
            "kind": "candidate_gap",
            "severity": "blocking",
            "status": "open",
            "target_ref": (
                "candidate-spec.subscription-payment.gaps."
                "subscription-payment.enforcement-mechanism"
            ),
            "question": "How should subscription payment enforcement be described?",
            "suggested_actions": [
                "answer_question",
                "provide_candidate_context",
                "reject",
                "defer",
            ],
        }
    )
    payload["readiness"]["blocked_by"].append(request_id)
    payload["request_counts"] = {
        "total": len(payload["clarification_requests"]),
        "by_kind": {"ontology_gap": 1, "candidate_gap": 1},
        "by_status": {"open": len(payload["clarification_requests"])},
    }
    _write_json(path, payload)
    return request_id


def _write_intake_clarification_workspace_runs(runs_dir: Path) -> None:
    _write_product_workspace_runs(runs_dir)
    _write_json(
        runs_dir / idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT,
        {
            "artifact_kind": "idea_to_spec_clarification_requests",
            "schema_version": 1,
            "proposal_id": "0186",
            "contract_ref": "specgraph.idea-to-spec.clarification-requests.v0.1",
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "readiness": {
                "ready": False,
                "review_state": "clarification_required",
                "blocked_by": [
                    "clarification.intake.question-active-frame-domain-refs"
                ],
                "next_artifact": "idea_intake_clarification_answers",
            },
            "clarification_requests": [
                {
                    "id": "clarification.intake.question-active-frame-domain-refs",
                    "kind": "intake_context_gap",
                    "severity": "blocking",
                    "status": "open",
                    "target_artifact": "user_idea_intake_session",
                    "target_ref": "active_frame.domain_refs",
                    "question": "Which product domain refs bound this idea?",
                    "suggested_actions": ["answer_question", "defer"],
                }
            ],
            "request_counts": {
                "total": 1,
                "blocking": 1,
                "by_kind": {"intake_context_gap": 1},
                "by_status": {"open": 1},
            },
        },
    )


def _start(
    dialog_dir: Path,
    *,
    spec_dir: Path | None = None,
    runs_dir: Path | None = None,
    specgraph_dir: Path | None = None,
    artifact_base_url: str | None = None,
    team_decision_log_artifact_base_url: str | None = None,
    product_workspace_artifact_base_urls: dict[str, str] | None = None,
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
    platform_dir: Path | None = None,
    platform_execution_enabled: bool = False,
    platform_execution_timeout_seconds: int = 120,
) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.ViewerHandler)
    httpd.repo_root = REPO_ROOT
    httpd.dialog_dir = dialog_dir
    httpd.hyperprompt_binary = hyperprompt_binary
    httpd.hyperprompt_resolved_binary = hyperprompt_resolved_binary
    httpd.hyperprompt_checked_paths = [hyperprompt_binary] if hyperprompt_binary else []
    httpd.hyperprompt_resolution_source = (
        "configured" if hyperprompt_resolved_binary else "missing"
    )
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
    httpd.platform_dir = platform_dir
    httpd.platform_execution_enabled = platform_execution_enabled
    httpd.platform_execution_timeout_seconds = platform_execution_timeout_seconds
    httpd.artifact_base_url = artifact_base_url
    httpd.team_decision_log_artifact_base_url = team_decision_log_artifact_base_url
    httpd.product_workspace_artifact_base_urls = (
        dict(product_workspace_artifact_base_urls or {})
    )
    httpd.specpm_registry_url = specpm_registry_url
    httpd.agent_workbench_dir = agent_workbench_dir
    httpd.specspace_state_dir = specspace_state_dir or (
        dialog_dir.parent / "specspace-state"
    )
    httpd.agent_available = False
    thread = threading.Thread(
        target=httpd.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True
    )
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


def _write_hyperprompt_stub(
    path: Path, *, exit_code: int = 0, sleep_seconds: int = 0
) -> None:
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
    thread = threading.Thread(
        target=httpd.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True
    )
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
                    "ontology_layer_summary": {
                        "known_layers": [
                            "objective",
                            "mechanics",
                            "execution",
                            "meta",
                            "multi_agent",
                        ],
                        "entry_count": 4,
                        "layered_entry_count": 2,
                        "unlayered_entry_count": 2,
                        "used_layers": ["objective", "mechanics"],
                        "layer_counts": {"objective": 1, "mechanics": 1},
                    },
                    "model_applicability": {
                        "applies_to": {
                            "domains": ["specgraph_core"],
                            "lifecyclePhases": [
                                "draft_spec_authoring",
                                "ontology_import_review",
                            ],
                            "agentTypes": [
                                "SpecAuthorAgent",
                                "SpecGraphSupervisor",
                            ],
                        },
                        "excludes": {"domains": ["unrelated_product_domain"]},
                        "assumptions": [
                            {
                                "id": "project_local_authority",
                                "layer": "meta",
                                "text": (
                                    "SpecGraph core ontology packages remain "
                                    "project-local unless explicitly published."
                                ),
                            },
                            {
                                "id": "human_review_required",
                                "layer": "execution",
                                "text": (
                                    "Generated or imported ontology changes require "
                                    "human review before canonical specs are updated."
                                ),
                            },
                        ],
                        "invalidation_triggers": [
                            {
                                "id": "ontology_layer_contract_changed",
                                "layer": "meta",
                                "text": (
                                    "Re-review applicability when ontology layer "
                                    "semantics change."
                                ),
                            },
                            {
                                "id": "specgraph_core_vocabulary_changed",
                                "layer": "mechanics",
                                "text": (
                                    "Re-review applicability when core SpecGraph "
                                    "classes or relations change."
                                ),
                            },
                        ],
                    },
                    "model_applicability_summary": {
                        "status": "declared",
                        "applies_to_domains": ["specgraph_core"],
                        "excluded_domains": ["unrelated_product_domain"],
                        "assumption_count": 2,
                        "invalidation_trigger_count": 2,
                        "used_layer_count": 3,
                        "used_layers": ["mechanics", "execution", "meta"],
                        "layer_counts": {"mechanics": 1, "execution": 1, "meta": 2},
                    },
                }
            ],
            "summary": {
                "resolved_ref_count": 2,
                "unresolved_ref_count": 1,
                "layered_entry_count": 2,
                "unlayered_entry_count": 2,
                "used_layer_count": 2,
                "model_applicability_profile_count": 1,
                "applicability_assumption_count": 2,
                "applicability_invalidation_trigger_count": 2,
            },
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
            "gaps": [
                {
                    "gap_id": "ontology-gap-sgcore-claimcalibration",
                    "missing_concept": {
                        "concept_hint": "ClaimCalibration",
                        "namespace_hint": "sgcore",
                        "ref": "sgcore:ClaimCalibration",
                    },
                    "layer_review": {
                        "status": "assigned",
                        "layer": "meta",
                        "source": "fixture.binding.layerHints",
                        "known_layers": [
                            "objective",
                            "mechanics",
                            "execution",
                            "meta",
                            "multi_agent",
                        ],
                    },
                    "needed_by": ["0060", "SG-RFC-0130"],
                    "recommended_route": "ontology_package_draft",
                    "severity": "medium",
                    "subject": {"id": "SG-RFC-0130", "kind": "proposal"},
                    "target_package": "org.0al.specgraph.core@0.1.0",
                }
            ],
            "summary": {
                "gap_count": 1,
                "layer_review": {
                    "known_layers": [
                        "objective",
                        "mechanics",
                        "execution",
                        "meta",
                        "multi_agent",
                    ],
                    "layer_counts": {"meta": 1},
                    "used_layers": ["meta"],
                    "status_counts": {"assigned": 1},
                    "unassigned_layer_count": 0,
                },
            },
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
            "change_classification": {
                "structural_changes": [
                    {"kind": "classAdded", "ref": "sgcore:ClaimCalibration"}
                ],
                "annotation_changes": [
                    {
                        "kind": "layerChanged",
                        "ref": "sgcore:Spec",
                        "target_kind": "class",
                        "before": "objective",
                        "after": "mechanics",
                        "compatibility": "compatible",
                    }
                ],
                "applicability_changes": [
                    {
                        "kind": "invalidationTriggerAdded",
                        "ref": (
                            "modelApplicability.invalidationTriggers."
                            "specgraph_core_vocabulary_changed"
                        ),
                        "compatibility": "compatible",
                    }
                ],
            },
            "layer_review": {
                "known_layers": [
                    "objective",
                    "mechanics",
                    "execution",
                    "meta",
                    "multi_agent",
                ],
                "layered_change_count": 1,
                "unassigned_change_count": 0,
                "used_layers": ["meta"],
                "layer_counts": {"meta": 1},
                "by_layer": {"meta": {"added_classes": ["sgcore:ClaimCalibration"]}},
                "unassigned_refs": [],
            },
        },
    )
    _write_json(
        runs_dir / "ontology_governance_evidence_index.json",
        {
            "artifact_kind": "ontology_governance_evidence_index",
            "source_fixture": "tests/fixtures/ontology_import/specgraph-core/import-fixture.yaml",
            "summary": {"evidence_count": 1, "next_gap": "none"},
            "evidence": [
                {
                    "package_ref": "org.0al.specgraph.core@0.1.0",
                    "lifecycle_state": "draft",
                    "decision_ref": "https://github.com/0al-spec/Ontology/pull/57",
                    "validation_report_ref": "Ontology:SPECS/INPROGRESS/ONT-038_Validation_Report.md",
                    "repeatability_report_ref": (
                        "Ontology:Tests/OntologyCompilerTests/"
                        "SpecGraphCorePackageTests.swift"
                    ),
                    "trusted_registry_gate_ref": (
                        "Ontology:SPECS/ontology/packages/specgraph-core/README.md#scope"
                    ),
                }
            ],
        },
    )


def _write_ontology_workbench_artifacts(root: Path) -> None:
    runs_dir = root / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    _write_json(
        runs_dir / "spec_ontology_validation_report.json",
        _spec_ontology_validation_report(),
    )
    _write_json(
        runs_dir / "ontology_decision_import_preview.json",
        _ontology_owner_decision_review(),
    )
    _write_json(
        runs_dir / "ontology_gap_review_workflow.json",
        {
            "artifact_kind": "ontology_gap_review_workflow",
            "schema_version": 1,
            "proposal_id": "0138",
            "status": "review_required",
            "review_state": "needs_owner_review",
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "source_artifacts": {
                "spec_ontology_validation_report": "runs/spec_ontology_validation_report.json",
            },
            "validation_modes": {
                "legacy_specs": "report_only",
                "generated_artifacts": "review_required",
            },
            "summary": {
                "gap_group_count": 1,
                "source_spec_count": 1,
                "affected_generated_artifact_count": 0,
                "recommended_owner_action_counts": {
                    "review_legacy_term_for_package_draft": 1,
                },
                "next_gap": "review_grouped_ontology_gaps",
            },
            "gap_groups": [
                {
                    "group_id": "ontology-gap-review-legacy-term-intent",
                    "gap_key": "legacy_term:intent",
                    "gap_kind": "legacy_term",
                    "missing_ref": "ontology-gap-sg-spec-0001-intent",
                    "proposed_term": "Intent",
                    "proposed_relation": None,
                    "recommended_owner_action": "review_legacy_term_for_package_draft",
                    "recommended_route": "ontology_owner_review",
                    "review_state": "needs_owner_review",
                    "source_spec_count": 1,
                    "affected_generated_artifact_count": 0,
                    "source_specs": [
                        {
                            "spec_id": "SG-SPEC-0001",
                            "path": "specs/nodes/SG-SPEC-0001.yaml",
                            "source": "specification.terminology",
                            "term": "intent",
                            "classification": "unknown_legacy_term",
                        }
                    ],
                }
            ],
            "operator_actions": [],
            "authority_boundary": {
                "ontology_gap_review_workflow_is_authority": False,
                "may_write_ontology_package": False,
                "may_mutate_canonical_specs": False,
            },
        },
    )
    _write_json(
        runs_dir / "ontology_owner_decision_import_v2.json",
        {
            "artifact_kind": "ontology_owner_decision_import_v2",
            "schema_version": 1,
            "proposal_id": "0139",
            "status": "ready_for_operator_review",
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "source_artifacts": {
                "ontology_gap_review_workflow": "runs/ontology_gap_review_workflow.json",
                "ontology_decision_import_preview": "runs/ontology_decision_import_preview.json",
            },
            "summary": {
                "status": "ready_for_operator_review",
                "review_count": 1,
                "accepted_count": 1,
                "rejected_count": 0,
                "clarification_count": 0,
                "importable_count": 1,
                "matched_gap_group_count": 1,
                "unmatched_decision_count": 0,
                "unresolved_gap_group_count": 0,
                "compliance_finding_count": 1,
                "write_gate_finding_count": 2,
                "next_gap": "review_owner_decision_import_v2",
            },
            "decision_import_reviews": [
                {
                    "review_id": "ontology-owner-decision-review-intent",
                    "decision_id": "ontology-owner-decision-accept-intent",
                    "decision_state": "accepted",
                    "review_state": "ready_for_operator_review",
                    "candidate_id": "ontology-delta-candidate-intent",
                    "gap_group_id": "ontology-gap-review-legacy-term-intent",
                    "matched_gap_group_id": "ontology-gap-review-legacy-term-intent",
                    "before_semantic_status": "unknown_legacy_term",
                    "after_semantic_status": "accepted_term",
                    "required_human_action": "operator_acknowledge_owner_decision",
                    "import_recommended": True,
                    "evidence_refs": ["runs/ontology_closed_loop_evidence.json#intent"],
                }
            ],
            "unresolved_gap_group_count": 0,
            "operator_actions": [],
            "authority_boundary": {
                "ontology_owner_decision_import_v2_is_authority": False,
                "may_write_ontology_package": False,
                "may_mutate_canonical_specs": False,
                "may_import_owner_decision": False,
            },
        },
    )
    _write_json(
        runs_dir / "legacy_spec_ontology_backfill_plan.json",
        {
            "artifact_kind": "legacy_spec_ontology_backfill_plan",
            "schema_version": 1,
            "proposal_id": "0140",
            "status": "review_required",
            "review_state": "ready_for_review",
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "source_artifacts": {
                "spec_ontology_validation_report": "runs/spec_ontology_validation_report.json",
                "ontology_gap_review_workflow": "runs/ontology_gap_review_workflow.json",
            },
            "summary": {
                "status": "review_required",
                "spec_count": 1,
                "clean_spec_count": 0,
                "warning_only_spec_count": 1,
                "review_required_spec_count": 1,
                "finding_count": 1,
                "unknown_term_count": 1,
                "new_term_decision_spec_count": 1,
                "large_new_term_decision_spec_count": 0,
                "relation_review_spec_count": 0,
                "small_pr_candidate_spec_count": 1,
                "small_pr_batch_count": 1,
                "next_gap": "review_legacy_spec_backfill_batches",
            },
            "planning_thresholds": {"small_pr_max_specs": 3},
            "spec_reviews": [],
            "small_pr_batches": [
                {
                    "batch_id": "legacy-spec-ontology-backfill-batch-001",
                    "review_state": "ready_for_review",
                    "recommended_pr_scope": "small_reviewed_terminology_backfill",
                    "spec_count": 1,
                    "finding_count": 1,
                    "writes_ontology_package": False,
                    "mutates_canonical_specs": False,
                    "specs": [
                        {
                            "spec_id": "SG-SPEC-0001",
                            "path": "specs/nodes/SG-SPEC-0001.yaml",
                            "finding_count": 1,
                            "unknown_terms": ["intent"],
                        }
                    ],
                }
            ],
            "operator_actions": [],
            "authority_boundary": {
                "legacy_spec_ontology_backfill_plan_is_authority": False,
                "may_write_ontology_package": False,
                "may_mutate_canonical_specs": False,
            },
        },
    )
    _write_json(
        runs_dir / "specauthor_ontology_write_gate_report.json",
        {
            "artifact_kind": "specauthor_ontology_write_gate_report",
            "schema_version": 1,
            "proposal_id": "0137",
            "ok": False,
            "review_state": "review_required",
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "would_reject_in_hard_gate": True,
            "write_decision": "review_required",
            "source_artifact": "memory://specauthor-review-required",
            "validation_modes": {"generated_artifacts": "review_required"},
            "summary": {
                "finding_count": 2,
                "warning_count": 0,
                "active_frame_finding_count": 1,
                "claim_finding_count": 1,
                "term_binding_finding_count": 0,
                "artifact_kind_finding_count": 0,
            },
            "findings": [
                {
                    "finding_id": "active_frame_incomplete",
                    "severity": "review_required",
                    "message": "active_frame must resolve ontology/domain/context.",
                    "source_ref": "memory://specauthor-review-required",
                },
                {
                    "finding_id": "claim_without_fgr",
                    "severity": "review_required",
                    "message": "Strong claim requires F/G/R calibration.",
                    "source_ref": "memory://specauthor-review-required",
                },
            ],
            "warnings": [],
            "term_binding_gate": {},
            "policy_refs": [
                "docs/proposals/0137_specauthor_generated_artifact_contract.md"
            ],
            "authority_boundary": {
                "specauthor_ontology_write_gate_report_is_authority": False,
                "may_write_ontology_package": False,
                "may_mutate_canonical_specs": False,
            },
        },
    )
    _write_json(
        runs_dir / "specauthor_invocation_artifact.json",
        {
            "artifact_kind": "specauthor_invocation_artifact",
            "schema_version": 1,
            "contract_ref": "specgraph.specauthor.invocation-artifact.v0.1",
            "source_ref": "memory://specauthor-authoring-flow-ready",
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": False,
            "invocation": {
                "invocation_id": "specauthor-invocation-0146-ready",
                "agent_id": "SpecAuthorAgent",
                "mode": "draft_authoring",
                "prompt_contract_ref": (
                    "docs/proposals/0126_specauthor_claim_calibration_prompt_contract.md"
                ),
                "user_intent": {
                    "text": (
                        "Draft a review-only proposal using existing SpecGraph ontology terms."
                    ),
                    "source_ref": "operator://local-intent/0146",
                },
            },
            "active_frame": {
                "project": "SpecGraph",
                "subsystem": "Application.AgentLayer.SpecificationAuthoring",
                "agent_layer": "SpecificationAuthoring",
                "target_artifact": "Proposal",
                "lifecycle_phase": "draft",
                "ontology_refs": ["sgcore:Spec"],
                "ontology_layer_refs": ["meta"],
                "model_applicability_refs": [
                    "org.0al.specgraph.core@0.1.0#modelApplicability"
                ],
                "domain_refs": ["domain.specification_authoring"],
                "context_refs": ["context.specgraph.agent_layer"],
            },
            "model_applicability": {
                "package_ref": "org.0al.specgraph.core@0.1.0",
                "assumption_refs": [
                    "modelApplicability.assumptions.project_local_authority",
                    "modelApplicability.assumptions.human_review_required",
                ],
                "invalidation_trigger_refs": [
                    "modelApplicability.invalidationTriggers.ontology_layer_contract_changed",
                    "modelApplicability.invalidationTriggers.specgraph_core_vocabulary_changed",
                ],
            },
            "operator_decision": {
                "decision_state": "pending_review",
                "reviewer": None,
                "may_execute_prompt_agent": False,
                "may_write_ontology_package": False,
                "may_mutate_canonical_specs": False,
            },
        },
    )
    _write_json(
        runs_dir / "specauthor_invocation_artifact_contract_report.json",
        {
            "artifact_kind": "specauthor_invocation_artifact_contract_report",
            "schema_version": 1,
            "proposal_id": "0145",
            "ok": True,
            "review_state": "ready_for_operator_review",
            "invocation_ready": True,
            "summary": {
                "finding_count": 0,
                "operator_decision_state": "pending_review",
            },
            "findings": [],
        },
    )
    _write_json(
        runs_dir / "specauthor_authoring_flow_report.json",
        {
            "artifact_kind": "specauthor_authoring_flow_report",
            "schema_version": 1,
            "proposal_id": "0146",
            "ok": False,
            "review_state": "review_required",
            "validation_chain_summary": {
                "generated_artifact_contract_ok": True,
                "write_gate_ok": True,
                "write_decision": "allow_graph_write",
                "invocation_contract_ok": True,
                "invocation_review_state": "ready_for_operator_review",
            },
            "summary": {"finding_count": 1},
            "findings": [
                {
                    "finding_id": "active_frame_mismatch",
                    "severity": "review_required",
                    "message": "Context active frame does not match generated artifact.",
                    "source_ref": "runs/specauthor_authoring_flow_report.json",
                }
            ],
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
                "versions": [
                    {"version": "0.1.0", "yanked": False, "deprecated": False}
                ],
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
                        "source_refs": [
                            "docs/archive/proposal_sources/0042_agent_context.md"
                        ],
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
            "viewer_projection": {
                "spec_id": {},
                "authority": {},
                "trace_status": {},
                "named_filters": {},
            },
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
                    "reflective_chain": {
                        "runtime_realization": "implemented",
                        "next_gap": "none",
                    },
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
                    "computed_values": [
                        {"metric_id": "sib", "score": 0.74, "status": "healthy"}
                    ],
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


def _spec_ontology_validation_report() -> dict:
    return {
        "artifact_kind": "spec_ontology_validation_report",
        "schema_version": 1,
        "proposal_id": "0135",
        "status": "report_only",
        "review_state": "ready_for_review",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "ontology_ir_ref": "ontology/packages/specgraph-core/generated/ontology.normalized.json",
        "source_binding_index_kind": "spec_ontology_binding_index",
        "validation_modes": {
            "legacy_specs": "report_only",
            "generated_artifacts": "review_required",
            "hard_gate_enabled": False,
        },
        "summary": {
            "spec_count": 1,
            "finding_count": 1,
            "warning_count": 1,
            "passed_check_count": 3,
            "next_gap": "review_spec_ontology_validation_findings",
        },
        "entries": [
            {
                "spec_id": "SG-SPEC-0001",
                "path": "specs/nodes/SG-SPEC-0001.yaml",
                "validation_status": "report_only_findings",
                "checks": [
                    {
                        "check_id": "required_binding.sgcore_spec",
                        "status": "passed",
                        "ontology_ref": "sgcore:Spec",
                    },
                    {
                        "check_id": "relation_contract.sgcore:hasAcceptanceCriterion",
                        "status": "passed",
                        "relation_ref": "sgcore:hasAcceptanceCriterion",
                    },
                    {
                        "check_id": "relation_contract.sgcore:evidenceSupportsCriterion",
                        "status": "passed",
                        "relation_ref": "sgcore:evidenceSupportsCriterion",
                    },
                ],
                "findings": [
                    {
                        "finding_id": "SG-SPEC-0001.gap.intent",
                        "severity": "warning",
                        "classification": "unknown_legacy_term",
                        "term": "intent",
                        "source": "specification.terminology",
                        "gap_ref": "ontology-gap-sg-spec-0001-intent",
                        "suggested_action": "review_ontology_gap",
                    }
                ],
            }
        ],
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
                    "capability_gaps": [
                        {"gap": "producer_environment_not_executor_runtime"}
                    ],
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
                },
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
            (populated / "SG-SPEC-0001.yaml").write_text(
                "id: SG-SPEC-0001\n", encoding="utf-8"
            )

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

    def test_workspaces_catalog_reports_public_product_route(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(
                root / "dialogs",
                artifact_base_url="https://specgraph.space/artifacts/specgraph",
                product_workspace_artifact_base_urls={
                    "team-decision-log": (
                        "https://specgraph.space/artifacts/team-decision-log"
                    ),
                    "support-triage-log": (
                        "https://specgraph.space/artifacts/support-triage-log"
                    ),
                },
            )
            try:
                status, body = _get(f"{base}/api/v1/workspaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        workspaces = {item["id"]: item for item in body["workspaces"]}
        self.assertEqual(workspaces["specgraph-bootstrap"]["route"], "/")
        self.assertEqual(
            workspaces["team-decision-log"]["route"],
            "/team-decision-log",
        )
        self.assertEqual(
            workspaces["team-decision-log"]["target_repository_role"],
            "product_spec_workspace",
        )
        self.assertEqual(
            workspaces["team-decision-log"]["artifact_base_url"],
            "https://specgraph.space/artifacts/team-decision-log",
        )
        self.assertEqual(
            workspaces["team-decision-log"]["provider"],
            "http-product-workspace",
        )
        self.assertEqual(
            workspaces["support-triage-log"]["route"],
            "/support-triage-log",
        )
        self.assertEqual(
            workspaces["support-triage-log"]["display_name"],
            "Support Triage Log",
        )
        self.assertEqual(
            workspaces["support-triage-log"]["provider"],
            "http-product-workspace",
        )

    def test_idea_to_spec_workspace_query_selects_team_artifact_base(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            default_artifact_root = root / "default-artifacts"
            team_artifact_root = root / "team-artifacts"
            (default_artifact_root / "runs").mkdir(parents=True)
            (team_artifact_root / "runs").mkdir(parents=True)
            _write_json(
                team_artifact_root
                / "runs"
                / idea_to_spec_workspace.ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
                {
                    "artifact_kind": "active_idea_to_spec_candidate",
                    "schema_version": 1,
                    "proposal_id": "0155",
                    "contract_ref": (
                        "specgraph.idea-to-spec.active-candidate-source.v0.1"
                    ),
                    "canonical_mutations_allowed": False,
                    "source_mode": "active_candidate",
                    "candidate": {
                        "candidate_id": "team-decision-log",
                        "display_name": "Team Decision Log",
                        "public_route": "/team-decision-log",
                        "workflow_lane": "product_idea_to_spec",
                        "target_repository_role": "product_spec_workspace",
                    },
                    "readiness": {
                        "ready": True,
                        "review_state": "active_candidate_ready",
                        "blocked_by": [],
                    },
                    "authority_boundary": {
                        "may_create_branch_or_commit": False,
                        "may_mutate_canonical_specs": False,
                    },
                },
            )
            _write_manifest(default_artifact_root, [])
            _write_manifest(
                team_artifact_root,
                [
                    "runs/"
                    + idea_to_spec_workspace.ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT
                ],
            )
            default_static, default_thread, default_base_url = _start_static(
                default_artifact_root
            )
            team_static, team_thread, team_base_url = _start_static(team_artifact_root)
            httpd, thread, base = _start(
                root / "dialogs",
                artifact_base_url=default_base_url,
                product_workspace_artifact_base_urls={"team-decision-log": team_base_url},
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)
                _stop(default_static, default_thread)
                _stop(team_static, team_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["selected_workspace_id"], "team-decision-log")
        self.assertEqual(body["source"]["artifact_base_url"], team_base_url)
        self.assertEqual(body["source"]["provider"], "http-product-workspace")
        self.assertEqual(body["workspace"]["id"], "team-decision-log")
        self.assertEqual(body["workspace"]["review_state"], "active_candidate_ready")

    def test_idea_to_spec_workspace_surfaces_platform_repair_rerun_status(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=True,
                include_rerun_report=True,
                include_platform_rerun_reports=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specgraph_dir=root,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        repair_execution = body["repair_review"]["platform_execution"]
        self.assertTrue(repair_execution["available"])
        self.assertTrue(repair_execution["execution"]["ok"])
        self.assertEqual(repair_execution["execution"]["status"], "completed")
        self.assertEqual(
            repair_execution["execution"]["operations"][0]["name"],
            "execute_specgraph_requested_rerun",
        )
        self.assertTrue(repair_execution["publication"]["ok"])
        self.assertEqual(repair_execution["publication"]["status"], "published")
        self.assertFalse(
            repair_execution["action_boundary"]["may_execute_platform_adapter"]
        )
        self.assertFalse(
            repair_execution["action_boundary"]["may_run_specgraph_make_target"]
        )
        self.assertTrue(
            body["artifacts"]["product_repair_rerun_execution"]["available"]
        )
        workflow_ids = {item["id"] for item in body["workflow"]["items"]}
        self.assertIn("product_repair_rerun_execution", workflow_ids)
        self.assertIn("product_repair_rerun_publication", workflow_ids)

    def test_workspace_query_scopes_spec_graph_to_product_http_candidate_graph(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            default_artifact_root = root / "default-artifacts"
            team_artifact_root = root / "team-artifacts"
            default_spec_dir = default_artifact_root / "specs" / "nodes"
            team_spec_dir = team_artifact_root / "specs" / "nodes"
            team_runs_dir = team_artifact_root / "runs"
            default_spec_dir.mkdir(parents=True)
            team_spec_dir.mkdir(parents=True)
            _write_yaml(
                default_spec_dir / "SG-SPEC-BOOTSTRAP.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-BOOTSTRAP",
                    "title": "Bootstrap Graph",
                },
            )
            _write_yaml(
                team_spec_dir / "SG-SPEC-TEAM-DECISION-LOG.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-TEAM-DECISION-LOG",
                    "title": "Team Decision Log",
                },
            )
            _write_product_workspace_runs(team_runs_dir)
            _write_manifest(default_artifact_root, ["specs/nodes/SG-SPEC-BOOTSTRAP.yaml"])
            _write_manifest(
                team_artifact_root,
                [
                    "specs/nodes/SG-SPEC-TEAM-DECISION-LOG.yaml",
                    "runs/" + idea_to_spec_workspace.ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
                    "runs/" + idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT,
                ],
            )
            default_static, default_thread, default_base_url = _start_static(
                default_artifact_root
            )
            team_static, team_thread, team_base_url = _start_static(team_artifact_root)
            httpd, thread, base = _start(
                root / "dialogs",
                artifact_base_url=default_base_url,
                product_workspace_artifact_base_urls={"team-decision-log": team_base_url},
            )
            try:
                default_status, default_graph = _get(f"{base}/api/v1/spec-graph")
                team_status, team_graph = _get(
                    f"{base}/api/v1/spec-graph?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)
                _stop(default_static, default_thread)
                _stop(team_static, team_thread)

        self.assertEqual(default_status, 200)
        self.assertEqual(team_status, 200)
        self.assertEqual(default_graph["artifact_base_url"], default_base_url)
        self.assertEqual(team_graph["artifact_base_url"], team_base_url)
        self.assertEqual(
            default_graph["graph"]["nodes"][0]["node_id"],
            "SG-SPEC-BOOTSTRAP",
        )
        self.assertEqual(
            {node["node_id"] for node in team_graph["graph"]["nodes"]},
            {
                "candidate-spec.team-decision-log-product",
                "candidate-spec.decision-record",
            },
        )
        self.assertEqual(team_graph["source"]["provider"], "http-product-workspace")

    def test_team_workspace_file_provider_uses_candidate_graph_not_bootstrap_specs(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            runs_dir = root / "runs"
            spec_dir.mkdir(parents=True)
            _write_yaml(
                spec_dir / "SG-SPEC-BOOTSTRAP.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-BOOTSTRAP",
                    "title": "Bootstrap Graph",
                },
            )
            _write_product_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=runs_dir,
                specgraph_dir=root,
            )
            try:
                default_status, default_graph = _get(f"{base}/api/v1/spec-graph")
                team_status, team_graph = _get(
                    f"{base}/api/v1/spec-graph?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(default_status, 200)
        self.assertEqual(team_status, 200)
        self.assertEqual(
            default_graph["graph"]["nodes"][0]["node_id"],
            "SG-SPEC-BOOTSTRAP",
        )
        team_node_ids = {
            node["node_id"] for node in team_graph["graph"]["nodes"]
        }
        self.assertIn("candidate-spec.team-decision-log-product", team_node_ids)
        self.assertIn("candidate-spec.decision-record", team_node_ids)
        self.assertNotIn("SG-SPEC-BOOTSTRAP", team_node_ids)
        self.assertEqual(team_graph["workspace_id"], "team-decision-log")
        self.assertEqual(team_graph["source"]["surface"], "candidate_spec_graph")

    def test_team_workspace_uses_candidate_graph_when_only_default_artifact_base_is_set(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            default_artifact_root = root / "default-artifacts"
            default_spec_dir = default_artifact_root / "specs" / "nodes"
            default_spec_dir.mkdir(parents=True)
            _write_yaml(
                default_spec_dir / "SG-SPEC-BOOTSTRAP.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-BOOTSTRAP",
                    "title": "Bootstrap Graph",
                },
            )
            _write_manifest(default_artifact_root, ["specs/nodes/SG-SPEC-BOOTSTRAP.yaml"])
            default_static, default_thread, default_base_url = _start_static(
                default_artifact_root
            )

            local_spec_dir = root / "specs" / "nodes"
            local_runs_dir = root / "runs"
            local_spec_dir.mkdir(parents=True)
            _write_product_workspace_runs(local_runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=local_spec_dir,
                runs_dir=local_runs_dir,
                specgraph_dir=root,
                artifact_base_url=default_base_url,
            )
            try:
                status, team_graph = _get(
                    f"{base}/api/v1/spec-graph?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)
                _stop(default_static, default_thread)

        self.assertEqual(status, 200)
        node_ids = {node["node_id"] for node in team_graph["graph"]["nodes"]}
        self.assertIn("candidate-spec.team-decision-log-product", node_ids)
        self.assertNotIn("SG-SPEC-BOOTSTRAP", node_ids)
        self.assertEqual(team_graph["source"]["provider"], "file-product-workspace")

    def test_generic_product_workspace_uses_candidate_graph_without_team_specific_logic(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            runs_dir = root / "runs"
            spec_dir.mkdir(parents=True)
            _write_yaml(
                spec_dir / "SG-SPEC-BOOTSTRAP.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-BOOTSTRAP",
                    "title": "Bootstrap Graph",
                },
            )
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="support-triage-log",
                display_name="Support Triage Log",
                public_route="/support-triage-log",
                project="SupportTriageLog",
                domain_ref="domain.support_triage_log",
                root_node_id="candidate-spec.support-triage-log-product",
                root_title="Support Triage Log Product",
            )
            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=runs_dir,
                specgraph_dir=root,
            )
            try:
                status, product_graph = _get(
                    f"{base}/api/v1/spec-graph?workspace=support-triage-log"
                )
                workspace_status, workspace_body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=support-triage-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(workspace_status, 200)
        node_ids = {node["node_id"] for node in product_graph["graph"]["nodes"]}
        self.assertIn("candidate-spec.support-triage-log-product", node_ids)
        self.assertNotIn("SG-SPEC-BOOTSTRAP", node_ids)
        self.assertEqual(product_graph["workspace_id"], "support-triage-log")
        self.assertEqual(workspace_body["workspace"]["id"], "support-triage-log")

    def test_requested_product_workspace_does_not_reuse_default_product_runs(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            spec_dir.mkdir(parents=True)
            _write_yaml(
                spec_dir / "SG-SPEC-BOOTSTRAP.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-BOOTSTRAP",
                    "title": "Bootstrap Graph",
                },
            )
            _write_product_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=runs_dir,
                specgraph_dir=root,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _ = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "calcus",
                        "display_name": "calcus",
                        "route": "/calcus",
                        "root_intent_summary": "Calculator for students on exams",
                    },
                )
                graph_status, product_graph = _get(
                    f"{base}/api/v1/spec-graph?workspace=calcus"
                )
                workspace_status, workspace_body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=calcus"
                )
            finally:
                _stop(httpd, thread)
            health = specspace_provider.ProductWorkspaceFileProvider(
                specspace_provider.FileSpecGraphProvider(
                    spec_nodes_dir=spec_dir,
                    runs_dir=runs_dir,
                    specgraph_dir=root,
                ),
                "calcus",
            ).health()

        self.assertEqual(post_status, 200)
        self.assertEqual(graph_status, 200)
        self.assertEqual(workspace_status, 200)
        node_ids = {node["node_id"] for node in product_graph["graph"]["nodes"]}
        self.assertNotIn("candidate-spec.team-decision-log-product", node_ids)
        self.assertEqual(product_graph["workspace_id"], "calcus")
        self.assertEqual(workspace_body["source"]["workspace_id"], "calcus")
        self.assertEqual(workspace_body["summary"]["status"], "unavailable")
        self.assertFalse(workspace_body["workspace"]["available"])
        self.assertEqual(health["status"], "pending")
        self.assertEqual(health["sources"]["candidate_spec_graph"]["status"], "not_built")

    def test_requested_product_workspace_keeps_matching_initialization_artifact(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(runs_dir)
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "dry_run": False,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "workspace": {
                        "workspace_id": "calcus",
                        "display_name": "calcus",
                        "route": "/calcus",
                        "repository_role": "product_spec_workspace",
                    },
                    "summary": {
                        "status": "workspace_initialization_executed",
                        "catalog_written": True,
                        "workspace_files_created": True,
                        "error_count": 0,
                    },
                    "authority_boundary": {
                        "creates_git_commits": False,
                        "opens_pull_requests": False,
                        "publishes_read_models": False,
                        "mutates_canonical_specs": False,
                        "writes_ontology_packages": False,
                        "accepts_ontology_terms": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specgraph_dir=root,
                specspace_state_dir=state_dir,
            )
            try:
                _, _ = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "calcus",
                        "display_name": "calcus",
                        "route": "/calcus",
                    },
                )
                status, workspace_body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=calcus"
                )
                artifact_status, artifact_catalog = _get(
                    f"{base}/api/v1/artifacts?workspace=calcus"
                )
                content_status, content = _get(
                    f"{base}/api/v1/artifacts/content?workspace=calcus&"
                    f"path={quote('runs/' + idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT)}"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertTrue(workspace_body["workspace_initialization"]["initialized"])
        self.assertEqual(
            workspace_body["workspace_initialization"]["execution"]["status"],
            "workspace_initialization_executed",
        )
        self.assertEqual(workspace_body["summary"]["candidate_node_count"], 0)
        self.assertEqual(artifact_status, 200)
        by_path = {entry["path"]: entry for entry in artifact_catalog["artifacts"]}
        self.assertIn(
            f"runs/{idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT}",
            by_path,
        )
        self.assertEqual(content_status, 200)
        self.assertEqual(
            content["data"]["artifact_kind"],
            "platform_product_workspace_initialization_execution_report",
        )

    def test_requested_product_workspace_ignores_unstructured_id_mentions(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(runs_dir)
            _write_json(
                runs_dir / idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT,
                {
                    "artifact_kind": "idea_to_spec_clarification_requests",
                    "schema_version": 1,
                    "workspace": {
                        "workspace_id": "team-decision-log",
                        "route": "/team-decision-log",
                    },
                    "summary": {
                        "status": "needs_clarification",
                        "diagnostic": "Operator mentioned /calcus in a note.",
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specgraph_dir=root,
                specspace_state_dir=state_dir,
            )
            try:
                _, _ = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "calcus",
                        "display_name": "calcus",
                        "route": "/calcus",
                    },
                )
                status, workspace_body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=calcus"
                )
                artifact_status, artifact_catalog = _get(
                    f"{base}/api/v1/artifacts?workspace=calcus"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(workspace_body["summary"]["status"], "unavailable")
        self.assertEqual(artifact_status, 200)
        by_path = {entry["path"]: entry for entry in artifact_catalog["artifacts"]}
        self.assertNotIn(
            f"runs/{idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT}",
            by_path,
        )

    def test_team_workspace_artifact_catalog_excludes_bootstrap_manifest_files(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            runs_dir = root / "runs"
            spec_dir.mkdir(parents=True)
            _write_yaml(
                spec_dir / "SG-SPEC-BOOTSTRAP.yaml",
                {
                    **MINIMAL_SPEC,
                    "id": "SG-SPEC-BOOTSTRAP",
                    "title": "Bootstrap Graph",
                },
            )
            _write_product_workspace_runs(runs_dir)
            _write_json(
                runs_dir / idea_to_spec_workspace.CANDIDATE_OVERVIEW_ARTIFACT,
                {
                    "artifact_kind": "candidate_overview",
                    "schema_version": 1,
                },
            )
            _write_json(
                root / "artifact_manifest.json",
                {
                    "artifact_kind": "specgraph_static_artifact_manifest",
                    "files": [
                        {"path": "specs/nodes/SG-SPEC-BOOTSTRAP.yaml"},
                        {
                            "path": "runs/"
                            + idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT
                        },
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=runs_dir,
                specgraph_dir=root,
            )
            try:
                status, catalog = _get(
                    f"{base}/api/v1/artifacts?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        paths = {entry["path"] for entry in catalog["artifacts"]}
        self.assertIn(
            "runs/" + idea_to_spec_workspace.ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
            paths,
        )
        self.assertIn(
            "runs/" + idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT,
            paths,
        )
        self.assertNotIn(
            "runs/" + idea_to_spec_workspace.CANDIDATE_OVERVIEW_ARTIFACT,
            paths,
        )
        self.assertNotIn("specs/nodes/SG-SPEC-BOOTSTRAP.yaml", paths)
        self.assertEqual(catalog["source"]["workspace_id"], "team-decision-log")

    def test_product_http_workspace_artifact_content_enforces_preview_limit(
        self,
    ) -> None:
        artifact_path = (
            "runs/" + idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT
        )
        manifest = {
            "artifact_kind": "specgraph_static_artifact_manifest",
            "files": [{"path": artifact_path}],
        }
        cache = specspace_provider.HttpArtifactCache(
            manifest=manifest,
            manifest_loaded_at=time.time(),
        )
        delegate = specspace_provider.HttpSpecGraphProvider(
            base_url="https://artifact.test",
            cache=cache,
        )
        provider = specspace_provider.ProductWorkspaceHttpProvider(
            delegate=delegate,
            workspace_id="team-decision-log",
        )

        with mock.patch.object(
            specspace_provider,
            "http_get_text",
            return_value=(
                HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                None,
                {"detail": "artifact exceeds preview limit"},
            ),
        ) as get_text:
            status, body = provider.read_artifact_content(artifact_path)

        self.assertEqual(status, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        self.assertEqual(body["reason"], "artifact_fetch_failed")
        get_text.assert_called_once_with(
            "https://artifact.test/" + artifact_path,
            max_bytes=specspace_provider.ARTIFACT_CONTENT_MAX_BYTES,
        )

    def test_product_http_workspace_does_not_preview_candidate_seed_raw_json(
        self,
    ) -> None:
        for filename in (
            idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT,
            idea_to_spec_workspace.CANDIDATE_OVERVIEW_ARTIFACT,
        ):
            with self.subTest(filename=filename):
                artifact_path = "runs/" + filename
                manifest = {
                    "artifact_kind": "specgraph_static_artifact_manifest",
                    "files": [{"path": artifact_path}],
                }
                cache = specspace_provider.HttpArtifactCache(
                    manifest=manifest,
                    manifest_loaded_at=time.time(),
                )
                delegate = specspace_provider.HttpSpecGraphProvider(
                    base_url="https://artifact.test",
                    cache=cache,
                )
                provider = specspace_provider.ProductWorkspaceHttpProvider(
                    delegate=delegate,
                    workspace_id="team-decision-log",
                )

                status, body = provider.read_artifact_content(artifact_path)

                self.assertEqual(status, HTTPStatus.NOT_FOUND)
                self.assertEqual(body["reason"], "missing_product_workspace_artifact")

    def test_directory_health_distinguishes_unreadable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            with mock.patch.object(
                Path, "glob", side_effect=OSError("permission denied")
            ):
                source = specspace_provider.inspect_directory_source(
                    name="spec_nodes",
                    path=path,
                    pattern="*.yaml",
                )

        self.assertEqual(source.status, "unreadable")
        self.assertIn("permission denied", source.detail or "")

    def test_provider_health_degrades_when_configured_specgraph_root_is_missing(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            runs_dir = root / "runs"
            spec_dir.mkdir(parents=True)
            runs_dir.mkdir()
            (spec_dir / "SG-SPEC-0001.yaml").write_text(
                "id: SG-SPEC-0001\n", encoding="utf-8"
            )
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
        self.assertIsNone(
            specspace_provider.safe_manifest_path("/specs/nodes/SG-SPEC-0001.yaml")
        )
        self.assertIsNone(specspace_provider.safe_manifest_path("specs/../secret.yaml"))
        self.assertIsNone(
            specspace_provider.safe_manifest_path("https://example.test/spec.yaml")
        )
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
            httpd, thread, base = _start(
                root / "dialogs", spec_dir=spec_dir, runs_dir=runs_dir
            )
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
        self.assertEqual(
            body["sources"]["specpm_registry"]["path"],
            "https://0al-spec.github.io/SpecPM",
        )

    def test_specpm_registry_v1_returns_status_and_packages(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            registry_root = root / "registry"
            _write_specpm_registry(registry_root)
            registry, registry_thread, registry_url = _start_static(registry_root)
            httpd, thread, base = _start(
                root / "dialogs", specpm_registry_url=registry_url
            )
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
            httpd, thread, base = _start(
                root / "dialogs", specpm_registry_url=registry_url
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/specpm/registry/packages/specnode.core"
                )
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
            httpd, thread, base = _start(
                root / "dialogs", specpm_registry_url=registry_url
            )
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
        self.assertIn(
            "Full proposal body stays visible", proposal["markdown"]["content_body"]
        )
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
                        "node_kinds": [
                            {"name": "OntologyBinding", "description": "Term binding."}
                        ],
                        "edge_kinds": [{"name": "USES_ONTOLOGY"}],
                        "terminology": {
                            404: "Not Found",
                            "500": "Server Error",
                            "provenance_record": (
                                "A structured metadata envelope attached to a canonical node."
                            ),
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
                    "specification": {
                        "objective": "Expose review vocabulary in SpecSpace."
                    },
                },
            )
            proposals_dir = root / "docs" / "proposals"
            proposals_dir.mkdir(parents=True)
            (proposals_dir / "0100_ontology_grounding.md").write_text(
                "# Ontology Grounding\n\nMentions SG-SPEC-0001 and fixes accepted vocabulary.\n",
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs", spec_dir=spec_dir, specgraph_dir=root
            )
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
        self.assertIn(
            ("Requirement", "is_validated_by", "AcceptanceCriterion"),
            semantic_relation_pairs,
        )
        self.assertEqual(
            by_label["SpecGraph"]["source_refs"],
            ["specs/nodes/SG-SPEC-0001.yaml#specification.seed"],
        )
        self.assertEqual(
            body["summary"]["semantic_relation_count"], len(body["relations"])
        )
        self.assertEqual(
            body["summary"]["topology_edge_count"], len(body["topology_edges"])
        )
        self.assertEqual(
            body["summary"]["proposal_reference_count"],
            len(body["proposal_references"]),
        )

    def test_practical_ontology_v1_uses_conceptual_seed_ref_when_seed_file_missing(
        self,
    ) -> None:
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
            httpd, thread, base = _start(
                root / "dialogs", spec_dir=spec_dir, specgraph_dir=root
            )
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
        self.assertEqual(
            body["source"]["ontology_mode"], "compiler_artifact_projection"
        )
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
        self.assertEqual(body["package"]["package_id"], "org.0al.specgraph.core")
        self.assertEqual(body["package"]["namespace"], "sgcore")
        self.assertEqual(body["package"]["version"], "0.1.0")
        self.assertEqual(
            body["package"]["materialized_ir"],
            "ontology/specgraph-core/ontology.normalized.json",
        )
        self.assertEqual(
            body["gaps"][0]["gap_id"], "ontology-gap-sgcore-claimcalibration"
        )
        self.assertEqual(body["gaps"][0]["missing_concept"], "ClaimCalibration")
        self.assertEqual(
            body["compatibility_diff"]["to_ref"], "org.0al.specgraph.core@0.2.0"
        )
        self.assertEqual(
            body["compatibility_diff"]["added_classes"], ["sgcore:ClaimCalibration"]
        )
        self.assertEqual(body["governance_evidence"][0]["lifecycle_state"], "draft")
        self.assertEqual(
            body["governance_evidence"][0]["decision_ref"],
            "https://github.com/0al-spec/Ontology/pull/57",
        )
        raw_artifact_paths = {entry["path"] for entry in body["raw_artifacts"]}
        self.assertIn("runs/ontology_package_index.json", raw_artifact_paths)
        self.assertIn(
            "ontology/specgraph-core/ontology.normalized.json", raw_artifact_paths
        )
        labels = {entry["label"] for entry in body["terms"]}
        self.assertEqual(labels, {"Requirement", "Spec", "SpecGraph"})
        relation_pairs = {
            (entry["source_term"], entry["relation"], entry["target_term"])
            for entry in body["relations"]
        }
        self.assertEqual(
            relation_pairs, {("Spec", "definesRequirement", "Requirement")}
        )
        self.assertEqual(body["sources"]["compiler_ir"]["class_count"], 3)
        self.assertEqual(body["sources"]["compiler_ir"]["relation_count"], 1)
        self.assertTrue(body["sources"]["ontology_import_gap_index"]["available"])
        self.assertEqual(body["sources"]["ontology_import_gap_index"]["gap_count"], 1)
        self.assertTrue(
            body["sources"]["ontology_compatibility_diff_preview"]["available"]
        )
        self.assertEqual(
            body["sources"]["ontology_compatibility_diff_preview"]["added_class_count"],
            1,
        )
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
        self.assertEqual(
            body["source"]["ontology_mode"], "compiler_artifact_projection"
        )
        self.assertEqual(body["summary"]["term_count"], 3)

    def test_practical_ontology_v1_falls_back_to_binding_ref_for_non_object_lock(
        self,
    ) -> None:
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
        self.assertEqual(
            body["source"]["ontology_mode"], "compiler_artifact_projection"
        )
        self.assertEqual(body["source"]["package_ref"], "org.0al.specgraph.core@0.1.0")

    def test_practical_ontology_v1_reads_compiler_artifacts_from_http_manifest(
        self,
    ) -> None:
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
                    "runs/ontology_governance_evidence_index.json",
                    "ontology/specgraph-core/ontology.normalized.json",
                ],
            )

            static_httpd, static_thread, artifact_base = _start_static(artifact_root)
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base
            )
            try:
                status, body = _get(f"{base}/api/v1/practical-ontology")
            finally:
                _stop(httpd, thread)
                _stop(static_httpd, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["source"]["ontology_mode"], "compiler_artifact_projection"
        )
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["source"]["package_ref"], "org.0al.specgraph.core@0.1.0")
        self.assertTrue(body["authority_boundary"]["compiler_artifact_backed"])
        self.assertEqual(body["summary"]["term_count"], 3)
        self.assertEqual(body["summary"]["semantic_relation_count"], 1)
        self.assertEqual(body["summary"]["gap_count"], 1)
        self.assertEqual(body["summary"]["diff_added_class_count"], 1)
        self.assertEqual(
            body["governance_evidence"][0]["package_ref"],
            "org.0al.specgraph.core@0.1.0",
        )

    def test_ontology_workbench_v1_reads_file_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(root)
            _write_ontology_workbench_artifacts(root)

            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=root / "runs",
                specgraph_dir=root,
            )
            try:
                status, body = _get(f"{base}/api/v1/ontology-workbench")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["artifact_kind"], "specspace_ontology_workbench")
        self.assertTrue(body["read_only"])
        self.assertFalse(body["canonical_mutations_allowed"])
        self.assertFalse(body["authority_boundary"]["ontology_workbench_is_authority"])
        self.assertFalse(body["authority_boundary"]["may_write_ontology_package"])
        self.assertFalse(body["authority_boundary"]["may_mutate_canonical_specs"])
        self.assertEqual(body["summary"]["term_count"], 3)
        self.assertEqual(body["summary"]["relation_count"], 1)
        self.assertEqual(body["summary"]["gap_group_count"], 1)
        self.assertEqual(body["summary"]["compliance_finding_count"], 1)
        self.assertEqual(body["summary"]["write_gate_finding_count"], 2)
        self.assertEqual(body["summary"]["specauthor_invocation_finding_count"], 1)
        self.assertEqual(body["summary"]["owner_decision_review_count"], 1)
        self.assertEqual(body["summary"]["legacy_small_pr_batch_count"], 1)
        self.assertEqual(body["package"]["package_id"], "org.0al.specgraph.core")
        self.assertEqual(body["normalized_ir"]["classes"][0]["id"], "SpecGraph")
        layer_rows = {row["layer"]: row for row in body["layers"]["rows"]}
        self.assertEqual(body["layers"]["summary"]["used_layer_count"], 3)
        self.assertEqual(body["layers"]["summary"]["package_layered_entry_count"], 2)
        self.assertEqual(body["layers"]["summary"]["gap_unassigned_layer_count"], 0)
        self.assertEqual(body["layers"]["summary"]["diff_unassigned_change_count"], 0)
        self.assertEqual(layer_rows["objective"]["package_entry_count"], 1)
        self.assertEqual(layer_rows["mechanics"]["package_entry_count"], 1)
        self.assertEqual(layer_rows["meta"]["gap_count"], 1)
        self.assertEqual(layer_rows["meta"]["diff_change_count"], 1)
        self.assertEqual(body["applicability"]["summary"]["profile_count"], 1)
        self.assertEqual(body["applicability"]["summary"]["assumption_count"], 2)
        self.assertEqual(
            body["applicability"]["profiles"][0]["applies_to"]["domains"],
            ["specgraph_core"],
        )
        self.assertEqual(
            body["applicability"]["profiles"][0]["applies_to"]["agent_types"],
            ["SpecAuthorAgent", "SpecGraphSupervisor"],
        )
        self.assertEqual(
            body["applicability"]["profiles"][0]["invalidation_triggers"][1]["id"],
            "specgraph_core_vocabulary_changed",
        )
        self.assertEqual(
            body["diff_classification"]["summary"]["structural_change_count"], 1
        )
        self.assertEqual(
            body["diff_classification"]["summary"]["annotation_change_count"], 1
        )
        self.assertTrue(body["specauthor_invocation"]["available"])
        self.assertEqual(
            body["specauthor_invocation"]["invocation"]["invocation_id"],
            "specauthor-invocation-0146-ready",
        )
        self.assertEqual(
            body["specauthor_invocation"]["validation_chain"]["write_decision"],
            "allow_graph_write",
        )
        self.assertFalse(body["specauthor_invocation"]["summary"]["authoring_flow_ok"])
        self.assertEqual(
            body["specauthor_invocation"]["findings"][0]["finding_id"],
            "active_frame_mismatch",
        )
        self.assertFalse(
            body["specauthor_invocation"]["operator_decision"][
                "may_execute_prompt_agent"
            ]
        )
        self.assertEqual(
            body["diff_classification"]["summary"]["applicability_change_count"], 1
        )
        self.assertEqual(
            body["diff_classification"]["annotation_changes"][0]["after"],
            "mechanics",
        )
        self.assertEqual(body["gap_review"]["groups"][0]["proposed_term"], "Intent")
        self.assertEqual(body["compliance"]["entries"][0]["terms"], ["intent"])
        self.assertEqual(
            body["write_gate"]["findings"][0]["finding_id"], "active_frame_incomplete"
        )
        self.assertTrue(body["write_gate"]["would_reject_in_hard_gate"])
        self.assertEqual(
            body["owner_decisions"]["reviews"][0]["after_semantic_status"],
            "accepted_term",
        )
        self.assertFalse(
            body["legacy_backfill"]["small_pr_batches"][0]["mutates_canonical_specs"]
        )
        self.assertTrue(body["artifacts"]["gap_review_workflow"]["available"])
        self.assertTrue(body["artifacts"]["owner_decision_import_v2"]["available"])

    def test_ontology_workbench_v1_layer_lens_aggregates_packages_and_vocabularies(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(root)
            _write_ontology_workbench_artifacts(root)
            runs_dir = root / "runs"
            package_index_path = runs_dir / "ontology_package_index.json"
            package_index = json.loads(package_index_path.read_text(encoding="utf-8"))
            package_index["packages"].append(
                {
                    "package_id": "org.0al.specgraph.product",
                    "namespace": "sgproduct",
                    "version": "0.1.0",
                    "materialized_ir": "ontology/specgraph-product/ontology.normalized.json",
                    "lock": {"package_ref": "org.0al.specgraph.product@0.1.0"},
                    "ontology_layer_summary": {
                        "known_layers": ["product"],
                        "entry_count": 4,
                        "layered_entry_count": 3,
                        "unlayered_entry_count": 1,
                        "used_layers": ["product"],
                        "layer_counts": {"product": 3},
                    },
                }
            )
            package_index["summary"]["package_count"] = 2
            _write_json(package_index_path, package_index)

            gap_index_path = runs_dir / "ontology_import_gap_index.json"
            gap_index = json.loads(gap_index_path.read_text(encoding="utf-8"))
            gap_index["summary"]["layer_review"]["known_layers"] = ["governance"]
            gap_index["summary"]["layer_review"]["used_layers"] = ["governance"]
            gap_index["summary"]["layer_review"]["layer_counts"] = {"governance": 2}
            _write_json(gap_index_path, gap_index)

            diff_path = runs_dir / "ontology_compatibility_diff_preview.json"
            compatibility_diff = json.loads(diff_path.read_text(encoding="utf-8"))
            compatibility_diff["layer_review"]["known_layers"] = ["compatibility"]
            compatibility_diff["layer_review"]["used_layers"] = ["compatibility"]
            compatibility_diff["layer_review"]["layer_counts"] = {"compatibility": 4}
            _write_json(diff_path, compatibility_diff)

            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=runs_dir,
                specgraph_dir=root,
            )
            try:
                status, body = _get(f"{base}/api/v1/ontology-workbench")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["package_count"], 2)
        layer_rows = {row["layer"]: row for row in body["layers"]["rows"]}
        self.assertEqual(body["layers"]["summary"]["package_layered_entry_count"], 5)
        self.assertEqual(body["layers"]["summary"]["package_unlayered_entry_count"], 3)
        self.assertEqual(body["layers"]["summary"]["used_layer_count"], 5)
        self.assertEqual(layer_rows["objective"]["package_entry_count"], 1)
        self.assertEqual(layer_rows["mechanics"]["package_entry_count"], 1)
        self.assertEqual(layer_rows["product"]["package_entry_count"], 3)
        self.assertEqual(layer_rows["governance"]["gap_count"], 2)
        self.assertEqual(layer_rows["compatibility"]["diff_change_count"], 4)

    def test_ontology_workbench_v1_omits_invalid_file_contract_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(root)
            _write_ontology_workbench_artifacts(root)
            runs_dir = root / "runs"
            invalid_validation = _spec_ontology_validation_report()
            invalid_validation["summary"]["finding_count"] = 0
            _write_json(runs_dir / "spec_ontology_validation_report.json", invalid_validation)
            invalid_review = _ontology_owner_decision_review()
            invalid_review["decision_import_previews"][0]["imports_into_specgraph"] = True
            _write_json(runs_dir / "ontology_decision_import_preview.json", invalid_review)
            (runs_dir / "ontology_owner_decision_import_v2.json").unlink()

            httpd, thread, base = _start(
                root / "dialogs",
                spec_dir=spec_dir,
                runs_dir=runs_dir,
                specgraph_dir=root,
            )
            try:
                status, body = _get(f"{base}/api/v1/ontology-workbench")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["compliance_finding_count"], 0)
        self.assertEqual(body["summary"]["owner_decision_review_count"], 0)
        self.assertEqual(body["compliance"]["entries"], [])
        self.assertEqual(body["owner_decisions"]["reviews"], [])
        self.assertFalse(body["artifacts"]["compliance_review"]["available"])
        self.assertFalse(body["artifacts"]["owner_decision_import_preview"]["available"])

    def test_ontology_workbench_v1_reads_http_static_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            spec_dir = artifact_root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(artifact_root)
            _write_ontology_workbench_artifacts(artifact_root)
            _write_manifest(
                artifact_root,
                [
                    "specs/nodes/SG-SPEC-0001.yaml",
                    "runs/ontology_package_index.json",
                    "runs/ontology_binding_preview.json",
                    "runs/ontology_import_gap_index.json",
                    "runs/ontology_compatibility_diff_preview.json",
                    "runs/ontology_governance_evidence_index.json",
                    "runs/spec_ontology_validation_report.json",
                    "runs/ontology_decision_import_preview.json",
                    "runs/ontology_gap_review_workflow.json",
                    "runs/ontology_owner_decision_import_v2.json",
                    "runs/legacy_spec_ontology_backfill_plan.json",
                    "runs/specauthor_ontology_write_gate_report.json",
                    "runs/specauthor_invocation_artifact.json",
                    "runs/specauthor_invocation_artifact_contract_report.json",
                    "runs/specauthor_authoring_flow_report.json",
                    "ontology/specgraph-core/ontology.normalized.json",
                ],
            )

            static_httpd, static_thread, artifact_base = _start_static(artifact_root)
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base
            )
            try:
                status, body = _get(f"{base}/api/v1/ontology-workbench")
            finally:
                _stop(httpd, thread)
                _stop(static_httpd, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["summary"]["status"], "ready")
        self.assertEqual(body["summary"]["legacy_review_required_spec_count"], 1)
        self.assertEqual(
            body["artifacts"]["normalized_ir"]["path"],
            "ontology/specgraph-core/ontology.normalized.json",
        )
        self.assertEqual(body["layers"]["summary"]["used_layer_count"], 3)
        self.assertEqual(body["layers"]["unassigned"]["diff_change_count"], 0)
        self.assertTrue(body["artifacts"]["write_gate"]["available"])
        self.assertEqual(
            body["legacy_backfill"]["small_pr_batches"][0]["batch_id"],
            "legacy-spec-ontology-backfill-batch-001",
        )

    def test_ontology_workbench_v1_omits_invalid_http_contract_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            spec_dir = artifact_root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(artifact_root)
            _write_ontology_workbench_artifacts(artifact_root)
            runs_dir = artifact_root / "runs"
            invalid_validation = _spec_ontology_validation_report()
            invalid_validation["summary"]["finding_count"] = 0
            _write_json(runs_dir / "spec_ontology_validation_report.json", invalid_validation)
            invalid_review = _ontology_owner_decision_review()
            invalid_review["decision_import_previews"][0]["imports_into_specgraph"] = True
            _write_json(runs_dir / "ontology_decision_import_preview.json", invalid_review)
            (runs_dir / "ontology_owner_decision_import_v2.json").unlink()
            _write_manifest(
                artifact_root,
                [
                    "specs/nodes/SG-SPEC-0001.yaml",
                    "runs/ontology_package_index.json",
                    "runs/ontology_binding_preview.json",
                    "runs/ontology_import_gap_index.json",
                    "runs/ontology_compatibility_diff_preview.json",
                    "runs/ontology_governance_evidence_index.json",
                    "runs/spec_ontology_validation_report.json",
                    "runs/ontology_decision_import_preview.json",
                    "runs/ontology_gap_review_workflow.json",
                    "runs/legacy_spec_ontology_backfill_plan.json",
                    "runs/specauthor_ontology_write_gate_report.json",
                    "ontology/specgraph-core/ontology.normalized.json",
                ],
            )

            static_httpd, static_thread, artifact_base = _start_static(artifact_root)
            httpd, thread, base = _start(root / "dialogs", artifact_base_url=artifact_base)
            try:
                status, body = _get(f"{base}/api/v1/ontology-workbench")
            finally:
                _stop(httpd, thread)
                _stop(static_httpd, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["summary"]["compliance_finding_count"], 0)
        self.assertEqual(body["summary"]["owner_decision_review_count"], 0)
        self.assertEqual(body["compliance"]["entries"], [])
        self.assertEqual(body["owner_decisions"]["reviews"], [])
        self.assertFalse(body["artifacts"]["compliance_review"]["available"])
        self.assertFalse(body["artifacts"]["owner_decision_import_preview"]["available"])

    def test_artifacts_v1_lists_file_runs_and_materialized_ontology_ir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spec_dir = root / "specs" / "nodes"
            spec_dir.mkdir(parents=True)
            _write_yaml(spec_dir / "SG-SPEC-0001.yaml", MINIMAL_SPEC)
            _write_specgraph_core_ontology_artifacts(root)
            runs_dir = root / "runs"
            _write_json(
                runs_dir / "local_operator_debug.json", {"secret": "local-only"}
            )
            unsafe_dir = runs_dir / "agent_runtime_enforcement_evidence"
            unsafe_dir.mkdir()
            _write_json(
                unsafe_dir / "runtime-detail.json", {"secret": "runtime-detail"}
            )
            _write_json(
                runs_dir / "spec_ontology_validation_report.json",
                _spec_ontology_validation_report(),
            )

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
                unsafe_status, unsafe = _get(
                    f"{base}/api/v1/artifacts/content?path=../secret.json"
                )
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
        self.assertEqual(
            by_path["runs/ontology_package_index.json"]["group"], "ontology"
        )
        self.assertEqual(
            by_path["runs/spec_ontology_validation_report.json"]["group"],
            "runs",
        )
        self.assertEqual(
            by_path["ontology/specgraph-core/ontology.normalized.json"]["group"],
            "ontology_ir",
        )
        self.assertNotIn("runs/local_operator_debug.json", by_path)
        self.assertNotIn(
            "runs/agent_runtime_enforcement_evidence/runtime-detail.json", by_path
        )
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

    def test_artifacts_v1_lists_http_manifest_runs_and_materialized_ontology_ir(
        self,
    ) -> None:
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
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base
            )
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
        self.assertTrue(
            by_path["ontology/specgraph-core/ontology.normalized.json"][
                "referenced_by_package_index"
            ]
        )
        self.assertTrue(
            by_path["runs/ontology_package_index.json"]["url"].startswith(artifact_base)
        )
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
        self.assertEqual(
            body["sources"]["proposal_runtime_index"]["reason"], "missing_artifact"
        )

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
        self.assertEqual(
            body["sources"]["graph_dashboard"]["reason"], "missing_artifact"
        )

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
        self.assertEqual(
            body["sources"]["metric_signals"]["reason"], "invalid_json_root"
        )
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
        self.assertEqual(
            body["summary"]["runtime_enforcement_evidence_passed_count"], 1
        )
        self.assertEqual(
            body["summary"]["runtime_enforcement_evidence_failed_count"], 0
        )
        self.assertEqual(
            body["summary"]["runtime_enforcement_evidence_missing_count"], 0
        )
        self.assertEqual(body["summary"]["agent_passport_cli_status"], "available")
        self.assertEqual(body["handoff"]["handoff_status"], "ready_for_handoff")
        self.assertEqual(body["handoff"]["review_state"], "ready_for_review")
        entries = {entry["surface_id"]: entry for entry in body["entries"]}
        self.assertEqual(
            entries["specgraph.executor.codex"]["verification_state"], "V3_schema_valid"
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["verification_status"], "valid"
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["verification_tool_status"], "available"
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["runtime_enforcement_state"],
            "policy_only",
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["runtime_enforcement_observed"], False
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["backend_status"],
            "not_applicable_in_producer_environment",
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["runtime_environment"][
                "producer_environment"
            ],
            "static_publish_environment",
        )
        self.assertEqual(
            entries["specgraph.executor.codex"]["runtime_environment"][
                "intended_environment"
            ],
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
        self.assertEqual(
            entries["specgraph.executor.codex"]["next_action"],
            "define_runtime_enforcement_runtime",
        )
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
        self.assertEqual(
            supervisor_entry["runtime_enforcement_evidence"][0]["status"], "passed"
        )
        self.assertEqual(
            supervisor_entry["runtime_enforcement_evidence"][0]["evidence_ref"],
            "runs/agent_runtime_enforcement_evidence/supervisor-executor-adapter-smoke.json",
        )
        self.assertEqual(
            supervisor_entry["runtime_enforcement_evidence"][0]["detail_status"],
            "available",
        )
        self.assertEqual(
            supervisor_entry["runtime_enforcement_evidence"][0]["checks"][0][
                "check_id"
            ],
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
        evidence = entries["specgraph.supervisor.executor_adapter"][
            "runtime_enforcement_evidence"
        ][0]
        self.assertIsNone(evidence["evidence_ref"])
        self.assertEqual(evidence["detail_status"], "invalid")
        self.assertEqual(evidence["detail_reason"], "unsafe_evidence_ref")
        self.assertEqual(evidence["checks"], [])
        self.assertNotIn("file:///Users/example/evidence.json", json.dumps(body))

    def test_agent_surfaces_v1_keeps_aggregate_when_runtime_evidence_detail_missing(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_agent_surface_artifacts(runs_dir)
            (
                runs_dir
                / "agent_runtime_enforcement_evidence"
                / "supervisor-executor-adapter-smoke.json"
            ).unlink()
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/agent-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["summary"]["runtime_enforcement_evidence_passed_count"], 1
        )
        entries = {entry["surface_id"]: entry for entry in body["entries"]}
        evidence = entries["specgraph.supervisor.executor_adapter"][
            "runtime_enforcement_evidence"
        ][0]
        self.assertEqual(evidence["status"], "passed")
        self.assertEqual(evidence["detail_status"], "missing")
        self.assertEqual(evidence["detail_reason"], "missing_detail_artifact")
        self.assertEqual(evidence["checks"], [])

    def test_agent_surfaces_v1_marks_malformed_runtime_evidence_detail_invalid(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_agent_surface_artifacts(runs_dir)
            _write_json(
                runs_dir
                / "agent_runtime_enforcement_evidence"
                / "supervisor-executor-adapter-smoke.json",
                {
                    "artifact_kind": "agent_runtime_enforcement_evidence",
                    "checks": "not-a-list",
                },
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/agent-surfaces")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        entries = {entry["surface_id"]: entry for entry in body["entries"]}
        evidence = entries["specgraph.supervisor.executor_adapter"][
            "runtime_enforcement_evidence"
        ][0]
        self.assertEqual(evidence["detail_status"], "invalid")
        self.assertEqual(evidence["detail_reason"], "invalid_detail_artifact")
        self.assertEqual(evidence["checks"], [])

    def test_agent_surfaces_v1_degrades_when_optional_artifacts_are_missing(
        self,
    ) -> None:
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
        self.assertEqual(
            body["sources"]["external_handoffs"]["reason"], "missing_artifact"
        )
        self.assertEqual(body["sources"]["runtime_evidence"]["available"], False)
        self.assertEqual(
            body["sources"]["runtime_evidence"]["reason"], "missing_artifact"
        )

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
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base_url
            )
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
        self.assertTrue(
            body["sources"]["external_handoffs"]["path"].startswith(artifact_base_url)
        )
        entries = {entry["surface_id"]: entry for entry in body["entries"]}
        evidence = entries["specgraph.supervisor.executor_adapter"][
            "runtime_enforcement_evidence"
        ][0]
        self.assertEqual(evidence["detail_status"], "available")
        self.assertEqual(
            evidence["checks"][0]["check_id"], "executor_adapter_invocation_boundary"
        )

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
        self.assertEqual(
            body["data"]["artifact_kind"], "ontology_semantic_review_surface"
        )
        self.assertEqual(body["data"]["proposal_id"], "0108")
        self.assertEqual(body["data"]["summary"]["review_item_count"], 2)
        self.assertEqual(body["data"]["review_items"][0]["review_state"], "blocked")
        self.assertFalse(body["data"]["canonical_mutations_allowed"])
        self.assertFalse(body["data"]["tracked_artifacts_written"])
        self.assertFalse(body["data"]["consumer_boundary"]["may_execute_prompt_agent"])
        self.assertFalse(
            body["data"]["authority_boundary"]["semantic_review_surface_is_authority"]
        )

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

    def test_ontology_semantic_review_surface_v1_rejects_authority_expansion(
        self,
    ) -> None:
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

    def test_ontology_semantic_review_surface_v1_rejects_action_authority_expansion(
        self,
    ) -> None:
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

    def test_ontology_semantic_review_surface_v1_reads_http_static_artifact(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            runs_dir = artifact_root / "runs"
            runs_dir.mkdir(parents=True)
            _write_json(
                runs_dir / "ontology_semantic_review_surface.json",
                _ontology_semantic_review_surface(),
            )
            _write_manifest(
                artifact_root, ["runs/ontology_semantic_review_surface.json"]
            )
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base_url
            )
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
        self.assertEqual(
            body["data"]["status_summary"]["status"], "blocked_by_semantic_gate"
        )
        self.assertEqual(body["data"]["status_summary"]["pending_decision_count"], 0)
        self.assertEqual(
            body["data"]["draft_requests"][0]["intake_state"],
            "blocked_by_semantic_gate",
        )
        self.assertFalse(body["data"]["canonical_mutations_allowed"])
        self.assertFalse(body["data"]["tracked_artifacts_written"])
        self.assertFalse(body["data"]["consumer_boundary"]["may_import_owner_decision"])
        self.assertFalse(
            body["data"]["authority_boundary"]["ontology_review_dashboard_is_authority"]
        )

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

    def test_ontology_review_dashboard_v1_rejects_closed_loop_authority_expansion(
        self,
    ) -> None:
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

    def test_ontology_review_dashboard_v1_rejects_draft_request_authority_expansion(
        self,
    ) -> None:
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
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base_url
            )
            try:
                status, body = _get(f"{base}/api/v1/ontology-review-dashboard")
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["data"]["status_summary"]["next_gap"],
            "build_specspace_rich_ontology_review_panel",
        )
        self.assertTrue(body["path"].startswith(artifact_base_url))

    def test_ontology_compliance_review_v1_reads_file_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            _write_json(
                runs_dir / "spec_ontology_validation_report.json",
                _spec_ontology_validation_report(),
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-compliance-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["data"]["artifact_kind"], "spec_ontology_validation_report"
        )
        self.assertEqual(body["data"]["proposal_id"], "0135")
        self.assertEqual(body["data"]["summary"]["spec_count"], 1)
        self.assertEqual(
            body["data"]["entries"][0]["validation_status"], "report_only_findings"
        )
        self.assertFalse(body["data"]["validation_modes"]["hard_gate_enabled"])

    def test_ontology_compliance_review_v1_reports_missing_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-compliance-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 404)
        self.assertEqual(body["reason"], "missing_artifact")
        self.assertEqual(body["artifact"], "runs/spec_ontology_validation_report.json")
        self.assertIn("make spec-ontology-validation", body["build_hint"])

    def test_ontology_compliance_review_v1_rejects_hard_gate_authority(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            report = _spec_ontology_validation_report()
            report["validation_modes"]["hard_gate_enabled"] = True
            _write_json(runs_dir / "spec_ontology_validation_report.json", report)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-compliance-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "authority_expansion")
        self.assertIn("hard_gate_enabled", body["detail"])

    def test_ontology_compliance_review_v1_rejects_generated_artifact_authority(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            report = _spec_ontology_validation_report()
            report["validation_modes"]["generated_artifacts"] = "auto_apply"
            _write_json(runs_dir / "spec_ontology_validation_report.json", report)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-compliance-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "authority_expansion")
        self.assertIn("generated_artifacts", body["detail"])

    def test_ontology_compliance_review_v1_rejects_stale_summary_counters(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            report = _spec_ontology_validation_report()
            report["summary"]["finding_count"] = 0
            _write_json(runs_dir / "spec_ontology_validation_report.json", report)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-compliance-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "stale_summary")
        self.assertIn("finding_count", body["detail"])

    def test_ontology_compliance_review_v1_rejects_invalid_finding_records(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            report = _spec_ontology_validation_report()
            del report["entries"][0]["findings"][0]["finding_id"]
            _write_json(runs_dir / "spec_ontology_validation_report.json", report)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-compliance-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "invalid_findings")
        self.assertIn("finding_id", body["detail"])

    def test_ontology_compliance_review_v1_reads_http_static_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifact_root = root / "artifact-site"
            runs_dir = artifact_root / "runs"
            runs_dir.mkdir(parents=True)
            _write_json(
                runs_dir / "spec_ontology_validation_report.json",
                _spec_ontology_validation_report(),
            )
            _write_manifest(
                artifact_root, ["runs/spec_ontology_validation_report.json"]
            )
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base_url
            )
            try:
                status, body = _get(f"{base}/api/v1/ontology-compliance-review")
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["data"]["summary"]["finding_count"], 1)
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
        self.assertEqual(
            body["data"]["artifact_kind"], "ontology_decision_import_preview"
        )
        self.assertEqual(body["data"]["proposal_id"], "0115")
        self.assertEqual(body["data"]["summary"]["status"], "ready_for_operator_review")
        self.assertEqual(body["data"]["summary"]["accepted_count"], 1)
        self.assertEqual(body["data"]["summary"]["rejected_count"], 1)
        self.assertEqual(
            body["data"]["decision_import_previews"][0][
                "matched_closed_loop_evidence_id"
            ],
            "ontology-closed-loop-evidence-ontology-delta-candidate-examcalc-casfunction",
        )
        self.assertFalse(body["data"]["canonical_mutations_allowed"])
        self.assertFalse(body["data"]["tracked_artifacts_written"])
        self.assertFalse(body["data"]["consumer_boundary"]["may_apply_preview"])
        self.assertFalse(
            body["data"]["authority_boundary"][
                "ontology_decision_import_preview_is_authority"
            ]
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

    def test_ontology_owner_decision_review_v1_rejects_preview_mutation_authority(
        self,
    ) -> None:
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
        self.assertIn(
            "decision_import_previews[0].imports_into_specgraph", body["detail"]
        )

    def test_ontology_owner_decision_review_v1_rejects_ready_without_evidence(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            review = _ontology_owner_decision_review()
            review["decision_import_previews"][0]["matched_closed_loop_evidence_id"] = (
                ""
            )
            _write_json(runs_dir / "ontology_decision_import_preview.json", review)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["reason"], "missing_evidence_link")
        self.assertIn("matched_closed_loop_evidence_id", body["detail"])

    def test_ontology_owner_decision_review_v1_rejects_stale_summary_counts(
        self,
    ) -> None:
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

    def test_ontology_owner_decision_review_v1_rejects_stale_derived_counts(
        self,
    ) -> None:
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

    def test_ontology_owner_decision_review_v1_rejects_malformed_ignored_decision(
        self,
    ) -> None:
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

    def test_ontology_owner_decision_review_v1_rejects_no_decisions_with_previews(
        self,
    ) -> None:
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
            _write_manifest(
                artifact_root, ["runs/ontology_decision_import_preview.json"]
            )
            static, static_thread, artifact_base_url = _start_static(artifact_root)
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base_url
            )
            try:
                status, body = _get(f"{base}/api/v1/ontology-owner-decision-review")
            finally:
                _stop(httpd, thread)
                _stop(static, static_thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["data"]["summary"]["next_gap"],
            "build_specspace_owner_decision_review_surface",
        )
        self.assertTrue(body["path"].startswith(artifact_base_url))

    def test_ontology_owner_decision_acknowledgements_v1_reads_empty_specspace_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/ontology-owner-decision-acknowledgements"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_ontology_owner_decision_acknowledgement_state",
        )
        self.assertEqual(body["summary"]["acknowledgement_count"], 0)
        self.assertTrue(body["consumer_boundary"]["specspace_owned_state"])
        self.assertFalse(body["consumer_boundary"]["may_import_into_specgraph"])
        self.assertFalse(
            body["authority_boundary"]["acknowledgement_state_is_authority"]
        )
        self.assertFalse(
            (state_dir / "ontology_owner_decision_acknowledgements.json").exists()
        )

    def test_ontology_owner_decision_acknowledgements_v1_posts_specspace_owned_state(
        self,
    ) -> None:
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
                get_status, get_body = _get(
                    f"{base}/api/v1/ontology-owner-decision-acknowledgements"
                )
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

    def test_ontology_owner_decision_acknowledgements_v1_rejects_unknown_preview(
        self,
    ) -> None:
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
        self.assertFalse(
            (state_dir / "ontology_owner_decision_acknowledgements.json").exists()
        )

    def test_ontology_owner_decision_acknowledgements_v1_rejects_mutation_claims(
        self,
    ) -> None:
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
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/ontology-owner-decision-acknowledgements"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertIn("imports_into_specgraph", body["error"])

    def test_idea_to_spec_repair_drafts_v1_reads_empty_specspace_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_idea_to_spec_repair_draft_state",
        )
        self.assertEqual(body["selected_workspace_id"], "team-decision-log")
        self.assertEqual(body["summary"]["draft_count"], 0)
        self.assertTrue(body["consumer_boundary"]["specspace_owned_state"])
        self.assertFalse(body["consumer_boundary"]["may_apply_to_specgraph"])
        self.assertFalse(body["authority_boundary"]["repair_draft_state_is_authority"])
        self.assertFalse((state_dir / "idea_to_spec_repair_drafts.json").exists())

    def test_project_local_ontology_review_decisions_v1_reads_empty_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs",
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/project-local-ontology-review-decisions?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_project_local_ontology_review_decision_state",
        )
        self.assertEqual(body["selected_workspace_id"], "team-decision-log")
        self.assertEqual(body["summary"]["decision_count"], 0)
        self.assertTrue(body["consumer_boundary"]["specspace_owned_state"])
        self.assertFalse(body["consumer_boundary"]["may_apply_to_specgraph"])
        self.assertFalse(body["authority_boundary"]["ontology_authority"])
        self.assertFalse(
            (state_dir / "project_local_ontology_review_decisions.json").exists()
        )

    def test_project_local_ontology_review_decisions_v1_posts_operator_intent(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_project_local_ontology_review_workspace_runs(runs_dir)
            lane_path = (
                runs_dir
                / idea_to_spec_workspace.PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT
            )
            before_lane = lane_path.read_text(encoding="utf-8")
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/project-local-ontology-review-decisions?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "term_key": "decisionrecord",
                        "action": "keep_project_local",
                        "decision_value": {
                            "reason": "Product-local term for this workspace."
                        },
                        "operator_ref": "operator://local-reviewer",
                    },
                )
                get_status, get_body = _get(
                    f"{base}/api/v1/project-local-ontology-review-decisions?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)
            state_path = state_dir / "project_local_ontology_review_decisions.json"
            state_exists = state_path.exists()
            lane_after = lane_path.read_text(encoding="utf-8")

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["decision_count"], 1)
        self.assertEqual(get_status, 200)
        decision = get_body["decisions"][0]
        self.assertEqual(decision["term_key"], "decisionrecord")
        self.assertEqual(decision["review_action"], "keep_project_local")
        self.assertEqual(decision["decision_value"]["term_scope"], "project_local")
        self.assertFalse(decision["writes_ontology_package"])
        self.assertFalse(decision["accepts_ontology_terms"])
        self.assertTrue(state_exists)
        self.assertEqual(lane_after, before_lane)

    def test_project_local_ontology_review_decisions_v1_posts_raw_lane_terms_beyond_display_limit(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_project_local_ontology_review_workspace_runs(runs_dir)
            lane_path = (
                runs_dir
                / idea_to_spec_workspace.PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT
            )
            lane = json.loads(lane_path.read_text(encoding="utf-8"))
            lane["terms"] = [
                {
                    "id": f"project-local-ontology-term.term-{index}",
                    "term": f"Term {index}",
                    "term_key": f"term{index}",
                    "status": "unreviewed",
                    "suggested_actions": ["keep_project_local"],
                    "effect": {
                        "candidate_readiness_effect": "requires_operator_review",
                        "next_action": "record_project_local_ontology_decision",
                        "resolved_gap_count": 0,
                    },
                }
                for index in range(41)
            ]
            lane["summary"]["term_count"] = 41
            lane_path.write_text(json.dumps(lane), encoding="utf-8")
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/project-local-ontology-review-decisions?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "term_key": "term40",
                        "action": "keep_project_local",
                        "decision_value": {
                            "reason": "Keep this late-display term local."
                        },
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["decision_count"], 1)
        self.assertEqual(body["decisions"][0]["term_key"], "term40")

    def test_project_local_ontology_review_decisions_v1_reports_invalid_stored_decisions(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir(parents=True)
            state_path = state_dir / "project_local_ontology_review_decisions.json"
            state = {
                "artifact_kind": "specspace_project_local_ontology_review_decision_state",
                "schema_version": 1,
                "state_owner": "SpecSpace",
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "consumer_boundary": {
                    "may_execute_prompt_agent": False,
                    "may_execute_specgraph": False,
                    "may_execute_platform": False,
                    "may_apply_to_specgraph": False,
                    "may_apply_decisions": False,
                    "may_mutate_candidate_artifacts": False,
                    "may_mutate_canonical_specs": False,
                    "may_write_ontology_package": False,
                    "may_write_ontology_lockfile": False,
                    "may_accept_ontology_terms": False,
                    "may_create_branch_or_commit": False,
                    "may_open_pull_request": False,
                },
                "authority_boundary": {
                    "project_local_ontology_review_decision_state_is_authority": False,
                    "specgraph_artifact_authority": False,
                    "ontology_authority": False,
                    "git_service_authority": False,
                    "canonical_mutations_allowed": False,
                },
                "source_artifacts": {},
                "decisions": [
                    {
                        "workspace_id": "team-decision-log",
                        "candidate_id": "team-decision-log",
                        "term_key": "decisionrecord",
                        "review_action": "keep_project_local",
                        "decision_value": {"term": "Decision Record"},
                    },
                    {
                        "workspace_id": "team-decision-log",
                        "term_key": "broken",
                        "review_action": "keep_project_local",
                        "decision_value": {"term": "Broken"},
                    },
                ],
            }
            state_path.write_text(json.dumps(state), encoding="utf-8")
            httpd, thread, base = _start(
                root / "dialogs",
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/project-local-ontology-review-decisions?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["decision_count"], 1)
        self.assertEqual(body["summary"]["invalid_decision_count"], 1)
        self.assertEqual(body["summary"]["dropped_decision_count"], 1)

    def test_idea_to_spec_intake_clarification_answers_v1_reads_empty_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_idea_intake_clarification_answer_state",
        )
        self.assertEqual(body["selected_workspace_id"], "team-decision-log")
        self.assertEqual(body["summary"]["answer_count"], 0)
        self.assertTrue(body["consumer_boundary"]["specspace_owned_state"])
        self.assertFalse(body["consumer_boundary"]["may_apply_answers"])
        self.assertFalse(body["authority_boundary"]["intake_answer_state_is_authority"])
        self.assertFalse(
            (state_dir / "idea_to_spec_intake_clarification_answers.json").exists()
        )

    def test_idea_to_spec_intake_clarification_answers_v1_reads_empty_global_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertIsNone(body["selected_workspace_id"])

    def test_real_idea_entry_requests_v1_reads_empty_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_real_idea_entry_request_state",
        )
        self.assertEqual(body["selected_workspace_id"], "team-decision-log")
        self.assertEqual(body["summary"]["request_count"], 0)
        self.assertEqual(body["summary"]["next_gap"], "submit_real_idea_entry_request")
        self.assertTrue(body["consumer_boundary"]["specspace_owned_state"])
        self.assertFalse(body["consumer_boundary"]["may_execute_specgraph"])
        self.assertFalse(body["authority_boundary"]["specgraph_artifact_authority"])
        self.assertFalse((state_dir / "real_idea_entry_requests.json").exists())

    def test_real_idea_intake_execution_requests_v1_reads_empty_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_real_idea_intake_execution_request_state",
        )
        self.assertEqual(
            body["state_path"],
            str(state_dir / "real_idea_intake_execution_requests.json"),
        )
        self.assertEqual(body["selected_workspace_id"], "pantry-rotation")
        self.assertEqual(body["summary"]["request_count"], 0)
        self.assertEqual(
            body["summary"]["next_gap"],
            "request_real_idea_intake_execution",
        )
        self.assertFalse(body["consumer_boundary"]["may_execute_platform"])
        self.assertFalse(body["authority_boundary"]["platform_execution_authority"])
        self.assertFalse((state_dir / "real_idea_intake_execution_requests.json").exists())

    def test_real_idea_intake_execution_requests_v1_posts_requested_execution(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "entry_request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                state_written = (
                    state_dir / "real_idea_intake_execution_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["request_count"], 1)
        self.assertEqual(body["summary"]["active_requested_count"], 1)
        request = body["requests"][0]
        self.assertEqual(request["workspace_id"], "pantry-rotation")
        self.assertEqual(request["status"], "requested")
        self.assertEqual(
            request["entry_request_id"],
            "real-idea-entry.pantry-rotation.20260704.abcd12",
        )
        self.assertEqual(
            request["workspace_initialization_ref"],
            "runs/platform_product_workspace_initialization_execution_report.json",
        )
        self.assertFalse(request["consumer_boundary"]["may_execute_platform"])
        self.assertFalse(
            request["authority_boundary"][
                "real_idea_intake_execution_request_state_is_authority"
            ]
        )
        self.assertTrue(state_written)

    def test_real_idea_intake_execution_requests_v1_reports_corrupt_state_path(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            state_path = state_dir / "real_idea_intake_execution_requests.json"
            state_path.write_text("{not-json", encoding="utf-8")
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertEqual(body["path"], str(state_path))

    def test_real_idea_intake_execution_requests_v1_prioritizes_blocked_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            state_path = state_dir / "real_idea_intake_execution_requests.json"
            state_path.write_text(
                json.dumps(
                    {
                        "artifact_kind": "specspace_real_idea_intake_execution_request_state",
                        "schema_version": 1,
                        "state_owner": "SpecSpace",
                        "requests": [
                            {
                                "request_id": "real-idea-intake-execute.pantry.consumed",
                                "workspace_id": "pantry-rotation",
                                "entry_request_id": "real-idea-entry.pantry.old",
                                "workspace_initialization_ref": "runs/init.json",
                                "status": "consumed",
                            },
                            {
                                "request_id": "real-idea-intake-execute.pantry.blocked",
                                "workspace_id": "pantry-rotation",
                                "entry_request_id": "real-idea-entry.pantry.new",
                                "workspace_initialization_ref": "runs/init.json",
                                "status": "blocked",
                            },
                        ],
                    }
                ),
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["summary"]["status"],
            "real_idea_intake_execution_blocked",
        )
        self.assertEqual(
            body["summary"]["next_gap"],
            "repair_real_idea_intake_execution_request",
        )

    def test_real_idea_intake_execution_requests_v1_rejects_authority_expansion(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "entry_request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                        "may_execute_platform": True,
                    },
                )
                state_written = (
                    state_dir / "real_idea_intake_execution_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertIn("may_execute_platform", body["error"])
        self.assertFalse(state_written)

    def test_real_idea_intake_execute_disabled_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs",
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-intake/execute?workspace=pantry-rotation",
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_unavailable")
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertFalse(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )

    def test_real_idea_intake_execute_runs_allowlisted_platform(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            specgraph_run_dir = specgraph_dir / "runs" / "isolated"
            specgraph_run_dir.mkdir(parents=True)
            (specgraph_dir / "Makefile").write_text(
                "real-idea-intake-from-entry-request:\n\t@true\n",
                encoding="utf-8",
            )
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "\n".join(
                    [
                        "import json",
                        "import sys",
                        "from pathlib import Path",
                        "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                        "report = {",
                        "    'artifact_kind': 'platform_real_idea_entry_intake_execution_report',",
                        "    'schema_version': 1,",
                        "    'ok': True,",
                        "    'dry_run': True,",
                        "    'summary': {",
                        "        'status': 'real_idea_entry_intake_dry_run',",
                        "        'workspace_id': 'pantry-rotation',",
                        "        'specgraph_executed': False,",
                        "    },",
                        "    'authority_boundary': {",
                        "        'executes_specgraph_make_target': False,",
                        "        'creates_git_commits': False,",
                        "        'opens_pull_requests': False,",
                        "        'publishes_read_models': False,",
                        "        'writes_ontology_packages': False,",
                        "        'accepts_ontology_terms': False,",
                        "    },",
                        "}",
                        "output.write_text(json.dumps(report), encoding='utf-8')",
                        "print(json.dumps(report))",
                    ]
                ),
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "ok": True,
                    "dry_run": False,
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "summary": {
                        "status": "workspace_initialization_executed",
                        "catalog_written": True,
                        "workspace_files_created": True,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                entry_status, _entry_body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "idea_text": "Track pantry stock before food expires.",
                        "idea_summary_hint": "Pantry rotation",
                    },
                )
                request_status, _request_body = _post(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "entry_request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/real-idea-intake/execute?workspace=pantry-rotation",
                    {"workspace_id": "pantry-rotation"},
                )
                request_state_status, request_state = _get(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation"
                )
                report_file_exists = (
                    runs_dir
                    / idea_to_spec_workspace.PLATFORM_REAL_IDEA_ENTRY_INTAKE_EXECUTION_REPORT_ARTIFACT
                ).is_file()
            finally:
                _stop(httpd, thread)

        self.assertEqual(entry_status, 200)
        self.assertEqual(request_status, 200)
        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["status"], "completed")
        self.assertEqual(
            body["output_ref"],
            "runs/platform_real_idea_entry_intake_execution_report.json",
        )
        self.assertEqual(body["workspace_id"], "pantry-rotation")
        self.assertEqual(
            body["entry_request_id"],
            "real-idea-entry.pantry-rotation.20260704.abcd12",
        )
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertTrue(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )
        self.assertTrue(report_file_exists)
        self.assertEqual(request_state_status, 200)
        self.assertEqual(request_state["summary"]["consumed_count"], 1)
        self.assertEqual(request_state["summary"]["requested_count"], 0)

    def test_real_idea_intake_execute_rejects_consumed_request_without_platform(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "raise SystemExit('must not execute consumed request')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "ok": True,
                    "dry_run": False,
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "summary": {
                        "status": "workspace_initialization_executed",
                        "catalog_written": True,
                        "workspace_files_created": True,
                    },
                },
            )
            _write_json(
                state_dir / "real_idea_entry_requests.json",
                {
                    "artifact_kind": "specspace_real_idea_entry_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "request_id": (
                                "real-idea-entry.pantry-rotation.20260704.abcd12"
                            ),
                            "workspace_id": "pantry-rotation",
                            "status": "submitted",
                            "idea_summary_hint": "Pantry rotation",
                            "created_at": "2026-07-04T00:00:00Z",
                            "updated_at": "2026-07-04T00:00:00Z",
                        }
                    ],
                },
            )
            _write_json(
                state_dir / "real_idea_intake_execution_requests.json",
                {
                    "artifact_kind": (
                        "specspace_real_idea_intake_execution_request_state"
                    ),
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "request_id": (
                                "real-idea-intake-execute.pantry-rotation.abcd12"
                            ),
                            "workspace_id": "pantry-rotation",
                            "entry_request_id": (
                                "real-idea-entry.pantry-rotation.20260704.abcd12"
                            ),
                            "workspace_initialization_ref": (
                                "runs/platform_product_workspace_initialization_execution_report.json"
                            ),
                            "status": "consumed",
                            "created_at": "2026-07-04T00:00:00Z",
                            "updated_at": "2026-07-04T00:00:00Z",
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-intake/execute?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "request_id": (
                            "real-idea-intake-execute.pantry-rotation.abcd12"
                        ),
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertIn("No active real idea intake execution request", body["error"])

    def test_real_idea_intake_execute_rejects_stale_entry_request(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "dry_run": False,
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "summary": {
                        "status": "workspace_initialization_executed",
                        "catalog_written": True,
                        "workspace_files_created": True,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                first_entry_status, _first_entry_body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "idea_text": "Track pantry stock before food expires.",
                    },
                )
                second_entry_status, _second_entry_body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "request_id": "real-idea-entry.pantry-rotation.20260704.ef3456",
                        "idea_text": "Track pantry stock before food expires, revised.",
                    },
                )
                request_status, _request_body = _post(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "entry_request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/real-idea-intake/execute?workspace=pantry-rotation",
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(first_entry_status, 200)
        self.assertEqual(second_entry_status, 200)
        self.assertEqual(request_status, 200)
        self.assertEqual(status, 409)
        self.assertIn("active submitted request", body["error"])

    def test_real_idea_intake_execute_rejects_untrusted_initialization_report(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "dry_run": False,
                    "workspace": {"workspace_id": "other-workspace"},
                    "summary": {
                        "status": "workspace_initialization_executed",
                        "catalog_written": True,
                        "workspace_files_created": True,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                entry_status, _entry_body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "idea_text": "Track pantry stock before food expires.",
                    },
                )
                request_status, _request_body = _post(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "entry_request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/real-idea-intake/execute?workspace=pantry-rotation",
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(entry_status, 200)
        self.assertEqual(request_status, 200)
        self.assertEqual(status, 409)
        self.assertIn("workspace_id does not match", body["error"])

    def test_real_idea_intake_execute_returns_timeout_payload(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "import time\ntime.sleep(5)\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "dry_run": False,
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "summary": {
                        "status": "workspace_initialization_executed",
                        "catalog_written": True,
                        "workspace_files_created": True,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
                platform_execution_timeout_seconds=1,
            )
            try:
                entry_status, _entry_body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "idea_text": "Track pantry stock before food expires.",
                    },
                )
                request_status, _request_body = _post(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "entry_request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/real-idea-intake/execute?workspace=pantry-rotation",
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(entry_status, 200)
        self.assertEqual(request_status, 200)
        self.assertEqual(status, 504)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_timeout")
        self.assertEqual(body["summary"]["status"], "managed_real_idea_intake_timeout")

    def test_real_idea_intake_execute_requires_initialization_report(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            _write_json(
                state_dir / "real_idea_entry_requests.json",
                {
                    "artifact_kind": "specspace_real_idea_entry_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                request_status, _request_body = _post(
                    f"{base}/api/v1/real-idea-intake-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "entry_request_id": "real-idea-entry.pantry-rotation.20260704.abcd12",
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/real-idea-intake/execute?workspace=pantry-rotation",
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(request_status, 200)
        self.assertEqual(status, 404)
        self.assertEqual(
            body["workspace_initialization_ref"],
            "runs/platform_product_workspace_initialization_execution_report.json",
        )

    def test_real_idea_answer_continuation_execution_requests_v1_reads_empty_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/real-idea-answer-continuation-execution-requests?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_real_idea_answer_continuation_execution_request_state",
        )
        self.assertEqual(
            body["state_path"],
            str(state_dir / "real_idea_answer_continuation_execution_requests.json"),
        )
        self.assertEqual(body["selected_workspace_id"], "pantry-rotation")
        self.assertEqual(body["summary"]["request_count"], 0)
        self.assertEqual(
            body["summary"]["next_gap"],
            "request_real_idea_answer_continuation_execution",
        )
        self.assertFalse(body["consumer_boundary"]["may_execute_platform"])
        self.assertFalse(body["consumer_boundary"]["may_apply_answers"])
        self.assertFalse(body["authority_boundary"]["platform_execution_authority"])
        self.assertFalse(
            (state_dir / "real_idea_answer_continuation_execution_requests.json").exists()
        )

    def test_real_idea_answer_continuation_execution_requests_v1_posts_requested_execution(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "answer_state_ref": (
                            "specspace-state://idea_to_spec_intake_clarification_answers.json"
                        ),
                        "answer_template_ref": (
                            "runs/real_idea_smoke/real_idea_answer_template.json"
                        ),
                        "intake_execution_ref": (
                            "runs/platform_real_idea_entry_intake_execution_report.json"
                        ),
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                state_written = (
                    state_dir
                    / "real_idea_answer_continuation_execution_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["request_count"], 1)
        self.assertEqual(body["summary"]["active_requested_count"], 1)
        request = body["requests"][0]
        self.assertEqual(request["workspace_id"], "pantry-rotation")
        self.assertEqual(request["status"], "requested")
        self.assertEqual(
            request["answer_state_ref"],
            "specspace-state://idea_to_spec_intake_clarification_answers.json",
        )
        self.assertEqual(
            request["intake_execution_ref"],
            "runs/platform_real_idea_entry_intake_execution_report.json",
        )
        self.assertFalse(request["consumer_boundary"]["may_execute_platform"])
        self.assertFalse(request["consumer_boundary"]["may_apply_answers"])
        self.assertFalse(
            request["authority_boundary"][
                "real_idea_answer_continuation_execution_request_state_is_authority"
            ]
        )
        self.assertTrue(state_written)

    def test_real_idea_answer_continuation_execution_requests_v1_rejects_authority_expansion(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "answer_state_ref": (
                            "specspace-state://idea_to_spec_intake_clarification_answers.json"
                        ),
                        "intake_execution_ref": (
                            "runs/platform_real_idea_entry_intake_execution_report.json"
                        ),
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                        "may_apply_answers": True,
                    },
                )
                state_written = (
                    state_dir
                    / "real_idea_answer_continuation_execution_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertIn("may_apply_answers", body["error"])
        self.assertFalse(state_written)

    def test_real_idea_answer_continuation_execute_disabled_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs",
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation/execute?workspace=pantry-rotation",
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_unavailable")
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertFalse(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )

    def test_real_idea_answer_continuation_execute_accepts_workspace_aliases(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs",
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation/execute?workspace=specgraph",
                    {"workspace_id": "bootstrap"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertEqual(body["status"], "platform_execution_unavailable")

    def test_real_idea_answer_continuation_execute_runs_allowlisted_platform(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text(
                "real-idea-intake-continue-from-specspace-answers:\n\t@true\n",
                encoding="utf-8",
            )
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "\n".join(
                    [
                        "import json",
                        "import sys",
                        "from pathlib import Path",
                        "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                        "report = {",
                        "    'artifact_kind': 'platform_real_idea_answer_continuation_execution_report',",
                        "    'schema_version': 1,",
                        "    'ok': True,",
                        "    'dry_run': True,",
                        "    'summary': {",
                        "        'status': 'real_idea_answer_continuation_dry_run',",
                        "        'workspace_id': 'pantry-rotation',",
                        "        'specgraph_executed': False,",
                        "    },",
                        "    'authority_boundary': {",
                        "        'executes_specgraph_make_target': False,",
                        "        'executes_git_commands': False,",
                        "        'opens_pull_requests': False,",
                        "        'publishes_read_models': False,",
                        "        'writes_ontology_packages': False,",
                        "        'accepts_ontology_terms': False,",
                        "    },",
                        "}",
                        "output.write_text(json.dumps(report), encoding='utf-8')",
                        "print(json.dumps(report))",
                    ]
                ),
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / "platform_product_workspace_initialization_execution_report.json",
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "ok": True,
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "summary": {"status": "workspace_initialization_executed"},
                },
            )
            _write_json(
                runs_dir / "platform_real_idea_entry_intake_execution_report.json",
                {
                    "artifact_kind": "platform_real_idea_entry_intake_execution_report",
                    "ok": True,
                    "summary": {
                        "status": "real_idea_entry_intake_executed",
                        "workspace_id": "pantry-rotation",
                    },
                    "authority_boundary": {
                        "executes_specgraph_make_target": True,
                        "executes_git_commands": False,
                        "opens_pull_requests": False,
                        "publishes_read_models": False,
                    },
                },
            )
            _write_json(
                state_dir / "idea_to_spec_intake_clarification_answers.json",
                {
                    "artifact_kind": "specspace_idea_intake_clarification_answer_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "answers": [],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                request_status, _request_body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "answer_state_ref": (
                            "specspace-state://idea_to_spec_intake_clarification_answers.json"
                        ),
                        "intake_execution_ref": (
                            "runs/platform_real_idea_entry_intake_execution_report.json"
                        ),
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                request_id = _request_body["requests"][0]["request_id"]
                status, body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation/execute?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "request_id": request_id,
                    },
                )
                report_file_exists = (
                    runs_dir
                    / "platform_real_idea_answer_continuation_execution_report.json"
                ).is_file()
            finally:
                _stop(httpd, thread)

        self.assertEqual(request_status, 200)
        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["status"], "completed")
        self.assertEqual(
            body["output_ref"],
            "runs/platform_real_idea_answer_continuation_execution_report.json",
        )
        self.assertEqual(body["workspace_id"], "pantry-rotation")
        self.assertEqual(body["request_id"], request_id)
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertTrue(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )
        self.assertFalse(body["authority_boundary"]["applies_answers"])
        self.assertTrue(report_file_exists)

    def test_real_idea_answer_continuation_execute_reports_timeout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text(
                "real-idea-intake-continue-from-specspace-answers:\n\t@true\n",
                encoding="utf-8",
            )
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "import time\ntime.sleep(2)\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / "platform_product_workspace_initialization_execution_report.json",
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "ok": True,
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "summary": {"status": "workspace_initialization_executed"},
                },
            )
            _write_json(
                runs_dir / "platform_real_idea_entry_intake_execution_report.json",
                {
                    "artifact_kind": "platform_real_idea_entry_intake_execution_report",
                    "ok": True,
                    "summary": {
                        "status": "real_idea_entry_intake_executed",
                        "workspace_id": "pantry-rotation",
                    },
                    "authority_boundary": {
                        "executes_specgraph_make_target": True,
                        "executes_git_commands": False,
                        "opens_pull_requests": False,
                        "publishes_read_models": False,
                    },
                },
            )
            _write_json(
                state_dir / "idea_to_spec_intake_clarification_answers.json",
                {
                    "artifact_kind": "specspace_idea_intake_clarification_answer_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "answers": [],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                platform_execution_timeout_seconds=1,
                specgraph_dir=specgraph_dir,
            )
            try:
                request_status, request_body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "answer_state_ref": (
                            "specspace-state://idea_to_spec_intake_clarification_answers.json"
                        ),
                        "intake_execution_ref": (
                            "runs/platform_real_idea_entry_intake_execution_report.json"
                        ),
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                request_id = request_body["requests"][0]["request_id"]
                status, body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation/execute?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "request_id": request_id,
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(request_status, 200)
        self.assertEqual(status, 504)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_timeout")
        self.assertEqual(
            body["summary"]["status"],
            "managed_real_idea_answer_continuation_timeout",
        )
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertTrue(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )
        self.assertFalse(body["authority_boundary"]["executes_specgraph"])

    def test_real_idea_answer_continuation_execute_requires_answer_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / "platform_product_workspace_initialization_execution_report.json",
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "ok": True,
                    "workspace": {"workspace_id": "pantry-rotation"},
                },
            )
            _write_json(
                runs_dir / "platform_real_idea_entry_intake_execution_report.json",
                {
                    "artifact_kind": "platform_real_idea_entry_intake_execution_report",
                    "ok": True,
                    "summary": {"workspace_id": "pantry-rotation"},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                request_status, _request_body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation-execution-requests?workspace=pantry-rotation",
                    {
                        "workspace_id": "pantry-rotation",
                        "answer_state_ref": (
                            "specspace-state://idea_to_spec_intake_clarification_answers.json"
                        ),
                        "intake_execution_ref": (
                            "runs/platform_real_idea_entry_intake_execution_report.json"
                        ),
                        "workspace_initialization_ref": (
                            "runs/platform_product_workspace_initialization_execution_report.json"
                        ),
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/real-idea-answer-continuation/execute?workspace=pantry-rotation",
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(request_status, 200)
        self.assertEqual(status, 404)
        self.assertEqual(
            body["answer_state_ref"],
            "specspace-state://idea_to_spec_intake_clarification_answers.json",
        )

    def test_repair_rerun_request_gate_execute_disabled_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs",
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun-request-gate/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_unavailable")
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertFalse(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )

    def test_repair_rerun_request_gate_execute_runs_allowlisted_platform(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            specgraph_run_dir = specgraph_dir / "runs" / "isolated"
            specgraph_run_dir.mkdir(parents=True)
            (specgraph_dir / "Makefile").write_text(
                "specspace-repair-rerun-request-gate:\n\t@true\n",
                encoding="utf-8",
            )
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "\n".join(
                    [
                        "import json",
                        "import sys",
                        "from pathlib import Path",
                        "output_gate = Path(sys.argv[sys.argv.index('--output-gate') + 1])",
                        "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                        "gate = {",
                        "    'artifact_kind': 'specspace_repair_rerun_request_gate',",
                        "    'status': 'specspace_repair_rerun_request_gate_ready',",
                        "    'readiness': {'ready': True, 'blocked_by': []},",
                        "}",
                        "report = {",
                        "    'artifact_kind': 'platform_product_repair_rerun_request_gate_execution_report',",
                        "    'schema_version': 1,",
                        "    'ok': True,",
                        "    'dry_run': False,",
                        "    'summary': {'status': 'completed'},",
                        "    'authority_boundary': {",
                        "        'executes_specgraph_make_target': True,",
                        "        'executes_git_commands': False,",
                        "        'opens_pull_requests': False,",
                        "        'publishes_read_models': False,",
                        "        'writes_ontology_packages': False,",
                        "        'accepts_ontology_terms': False,",
                        "    },",
                        "}",
                        "output_gate.write_text(json.dumps(gate), encoding='utf-8')",
                        "output.write_text(json.dumps(report), encoding='utf-8')",
                        "print(json.dumps(report))",
                    ]
                ),
                encoding="utf-8",
            )
            _write_json(
                specgraph_run_dir / "specspace_repair_draft_import_preview.json",
                {
                    "artifact_kind": "specspace_repair_draft_import_preview",
                    "summary": {"accepted_for_rerun_count": 1},
                },
            )
            _write_json(
                runs_dir / "idea_to_spec_repair_session.json",
                {
                    "artifact_kind": "idea_to_spec_repair_session",
                    "summary": {"ready_for_candidate_approval": False},
                },
            )
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "id": "repair-rerun-request.pantry-rotation.1",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "pantry-rotation",
                            "candidate_id": "pantry-rotation",
                            "created_at": "2026-01-01T00:00:00Z",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "import_preview_ref": (
                                "runs/isolated/specspace_repair_draft_import_preview.json"
                            ),
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun-request-gate/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
                report_file_exists = (
                    runs_dir
                    / "platform_product_repair_rerun_request_gate_execution_report.json"
                ).is_file()
                gate_file_exists = (
                    runs_dir / "specspace_repair_rerun_request_gate.json"
                ).is_file()
                request_state_status, request_state = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["status"], "completed")
        self.assertEqual(body["workspace_id"], "pantry-rotation")
        self.assertEqual(
            body["request_id"],
            "repair-rerun-request.pantry-rotation.1",
        )
        self.assertEqual(
            body["output_gate_ref"],
            "runs/specspace_repair_rerun_request_gate.json",
        )
        self.assertEqual(
            body["output_ref"],
            "runs/platform_product_repair_rerun_request_gate_execution_report.json",
        )
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertTrue(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )
        self.assertTrue(body["authority_boundary"]["executes_specgraph"])
        self.assertFalse(body["authority_boundary"]["executes_repair_rerun"])
        self.assertTrue(report_file_exists)
        self.assertTrue(gate_file_exists)
        self.assertEqual(request_state_status, 200)
        self.assertEqual(request_state["summary"]["active_request_count"], 0)
        self.assertEqual(request_state["requests"][0]["status"], "consumed")

    def test_repair_rerun_request_gate_execute_requires_import_preview(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir / "idea_to_spec_repair_session.json",
                {"artifact_kind": "idea_to_spec_repair_session"},
            )
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "id": "repair-rerun-request.pantry-rotation.1",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "pantry-rotation",
                            "candidate_id": "pantry-rotation",
                            "created_at": "2026-01-01T00:00:00Z",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "import_preview_ref": (
                                "runs/specspace_repair_draft_import_preview.json"
                            ),
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun-request-gate/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 404)
        self.assertEqual(
            body["import_preview_ref"],
            "runs/specspace_repair_draft_import_preview.json",
        )


    def test_repair_rerun_request_gate_execute_rejects_stale_request(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir / "specspace_repair_draft_import_preview.json",
                {
                    "artifact_kind": "specspace_repair_draft_import_preview",
                    "summary": {"accepted_for_rerun_count": 1},
                },
            )
            _write_json(
                runs_dir / "idea_to_spec_repair_session.json",
                {"artifact_kind": "idea_to_spec_repair_session"},
            )
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "id": "repair-rerun-request.pantry-rotation.old",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "pantry-rotation",
                            "candidate_id": "pantry-rotation",
                            "created_at": "2026-01-01T00:00:00Z",
                            "repair_session_ref": "runs/old_repair_session.json",
                            "import_preview_ref": (
                                "runs/specspace_repair_draft_import_preview.json"
                            ),
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun-request-gate/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["reason"], "repair_rerun_request_not_usable")
        state = body["workspace_state_hygiene"]["states"][0]
        self.assertEqual(state["kind"], "repair_rerun_request")
        self.assertEqual(state["status"], "stale")

    def test_repair_rerun_execute_disabled_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs",
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_unavailable")
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertFalse(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )

    def test_repair_rerun_execute_runs_allowlisted_platform_plan_and_execute(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text(
                "product-workspace-requested-repair-draft-rerun:\n\t@true\n"
                "product-workspace-repaired-promotion-handoff:\n\t@true\n",
                encoding="utf-8",
            )
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "\n".join(
                    [
                        "import json",
                        "import sys",
                        "from pathlib import Path",
                        "cmd = sys.argv[1:3]",
                        "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                        "if cmd == ['product-repair-rerun', 'plan']:",
                        "    report = {",
                        "        'artifact_kind': 'platform_product_repair_rerun_execution_plan',",
                        "        'schema_version': 1,",
                        "        'ready_to_execute': True,",
                        "        'specgraph_dir': sys.argv[sys.argv.index('--specgraph-dir') + 1],",
                        "        'summary': {'status': 'ready_to_execute'},",
                        "    }",
                        "else:",
                        "    report = {",
                        "        'artifact_kind': 'platform_product_repair_rerun_execution_report',",
                        "        'schema_version': 1,",
                        "        'ok': True,",
                        "        'dry_run': False,",
                        "        'summary': {'status': 'completed'},",
                        "        'authority_boundary': {",
                        "            'executes_specgraph_make_target': True,",
                        "            'executes_git_commands': False,",
                        "            'opens_pull_requests': False,",
                        "            'publishes_read_models': False,",
                        "            'writes_ontology_packages': False,",
                        "            'accepts_ontology_terms': False,",
                        "        },",
                        "        'operations': [",
                        "            {'name': 'execute_specgraph_requested_rerun', 'status': 'succeeded'},",
                        "            {'name': 'execute_specgraph_repaired_promotion_handoff', 'status': 'succeeded'},",
                        "        ],",
                        "    }",
                        "output.write_text(json.dumps(report), encoding='utf-8')",
                        "print(json.dumps(report))",
                    ]
                ),
                encoding="utf-8",
            )
            _write_json(
                runs_dir / "specspace_repair_draft_import_preview.json",
                {
                    "artifact_kind": "specspace_repair_draft_import_preview",
                    "summary": {"accepted_for_rerun_count": 1},
                },
            )
            _write_json(
                runs_dir / "idea_to_spec_repair_session.json",
                {
                    "artifact_kind": "idea_to_spec_repair_session",
                    "summary": {"ready_for_candidate_approval": False},
                },
            )
            _write_json(
                runs_dir / "specspace_repair_rerun_request_gate.json",
                {
                    "artifact_kind": "specspace_repair_rerun_request_gate",
                    "status": "specspace_repair_rerun_request_gate_ready",
                    "readiness": {"ready": True, "blocked_by": []},
                },
            )
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "id": "repair-rerun-request.pantry-rotation.1",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "pantry-rotation",
                            "candidate_id": "pantry-rotation",
                            "created_at": "2026-01-01T00:00:00Z",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "import_preview_ref": (
                                "runs/specspace_repair_draft_import_preview.json"
                            ),
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
                plan_file_exists = (
                    runs_dir
                    / "managed_repair_rerun_plans"
                    / (
                        "repair-rerun-request-pantry-rotation-1."
                        "platform_product_repair_rerun_execution_plan.json"
                    )
                ).is_file()
                report_file_exists = (
                    runs_dir / "platform_product_repair_rerun_execution_report.json"
                ).is_file()
                request_state_status, request_state = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["status"], "completed")
        self.assertEqual(body["workspace_id"], "pantry-rotation")
        self.assertEqual(
            body["request_id"],
            "repair-rerun-request.pantry-rotation.1",
        )
        self.assertEqual(
            body["plan_ref"],
            (
                "runs/managed_repair_rerun_plans/"
                "repair-rerun-request-pantry-rotation-1."
                "platform_product_repair_rerun_execution_plan.json"
            ),
        )
        self.assertEqual(
            body["output_ref"],
            "runs/platform_product_repair_rerun_execution_report.json",
        )
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertTrue(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )
        self.assertTrue(body["authority_boundary"]["executes_specgraph"])
        self.assertTrue(body["authority_boundary"]["executes_repair_rerun"])
        self.assertTrue(body["authority_boundary"]["builds_repaired_handoff"])
        self.assertFalse(body["authority_boundary"]["publishes_public_bundle"])
        self.assertTrue(plan_file_exists)
        self.assertTrue(report_file_exists)
        self.assertEqual(request_state_status, 200)
        self.assertEqual(request_state["summary"]["active_request_count"], 0)
        self.assertEqual(request_state["requests"][0]["status"], "consumed")

    def test_repair_rerun_execute_reports_timeout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "import time\ntime.sleep(5)\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir / "specspace_repair_draft_import_preview.json",
                {
                    "artifact_kind": "specspace_repair_draft_import_preview",
                    "summary": {"accepted_for_rerun_count": 1},
                },
            )
            _write_json(
                runs_dir / "idea_to_spec_repair_session.json",
                {
                    "artifact_kind": "idea_to_spec_repair_session",
                    "summary": {"ready_for_candidate_approval": False},
                },
            )
            _write_json(
                runs_dir / "specspace_repair_rerun_request_gate.json",
                {
                    "artifact_kind": "specspace_repair_rerun_request_gate",
                    "status": "specspace_repair_rerun_request_gate_ready",
                    "readiness": {"ready": True, "blocked_by": []},
                },
            )
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "id": "repair-rerun-request.pantry-rotation.1",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "pantry-rotation",
                            "candidate_id": "pantry-rotation",
                            "created_at": "2026-01-01T00:00:00Z",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "import_preview_ref": (
                                "runs/specspace_repair_draft_import_preview.json"
                            ),
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
                platform_execution_timeout_seconds=1,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 504)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_timeout")
        self.assertEqual(
            body["summary"]["status"],
            "managed_repair_rerun_plan_timeout",
        )

    def test_repair_rerun_execute_requires_request_gate(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir / "specspace_repair_draft_import_preview.json",
                {"artifact_kind": "specspace_repair_draft_import_preview"},
            )
            _write_json(
                runs_dir / "idea_to_spec_repair_session.json",
                {"artifact_kind": "idea_to_spec_repair_session"},
            )
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "id": "repair-rerun-request.pantry-rotation.1",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "pantry-rotation",
                            "candidate_id": "pantry-rotation",
                            "created_at": "2026-01-01T00:00:00Z",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "import_preview_ref": (
                                "runs/specspace_repair_draft_import_preview.json"
                            ),
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["reason"], "request_gate_missing")
        self.assertEqual(
            body["request_gate_ref"],
            "runs/specspace_repair_rerun_request_gate.json",
        )

    def test_repair_rerun_execute_rejects_unready_request_gate(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir / "specspace_repair_draft_import_preview.json",
                {"artifact_kind": "specspace_repair_draft_import_preview"},
            )
            _write_json(
                runs_dir / "idea_to_spec_repair_session.json",
                {"artifact_kind": "idea_to_spec_repair_session"},
            )
            _write_json(
                runs_dir / "specspace_repair_rerun_request_gate.json",
                {
                    "artifact_kind": "specspace_repair_rerun_request_gate",
                    "status": "specspace_repair_rerun_request_gate_blocked",
                    "readiness": {"ready": False, "blocked_by": ["stale_request"]},
                    "workspace_id": "pantry-rotation",
                },
            )
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "id": "repair-rerun-request.pantry-rotation.1",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "pantry-rotation",
                            "candidate_id": "pantry-rotation",
                            "created_at": "2026-01-01T00:00:00Z",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "import_preview_ref": (
                                "runs/specspace_repair_draft_import_preview.json"
                            ),
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["reason"], "request_gate_not_ready")
        self.assertEqual(
            body["request_gate_ref"],
            "runs/specspace_repair_rerun_request_gate.json",
        )

    def test_repair_rerun_execute_treats_failed_platform_report_as_failed(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text(
                "product-workspace-requested-repair-draft-rerun:\n\t@true\n"
                "product-workspace-repaired-promotion-handoff:\n\t@true\n",
                encoding="utf-8",
            )
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "\n".join(
                    [
                        "import json",
                        "import sys",
                        "from pathlib import Path",
                        "cmd = sys.argv[1:3]",
                        "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                        "if cmd == ['product-repair-rerun', 'plan']:",
                        "    report = {'ready_to_execute': True, 'ok': True}",
                        "else:",
                        "    report = {",
                        "        'artifact_kind': 'platform_product_repair_rerun_execution_report',",
                        "        'ok': False,",
                        "        'summary': {'status': 'blocked'},",
                        "        'authority_boundary': {'executes_specgraph_make_target': False},",
                        "    }",
                        "output.write_text(json.dumps(report), encoding='utf-8')",
                        "print(json.dumps(report))",
                    ]
                ),
                encoding="utf-8",
            )
            _write_json(
                runs_dir / "specspace_repair_draft_import_preview.json",
                {"artifact_kind": "specspace_repair_draft_import_preview"},
            )
            _write_json(
                runs_dir / "idea_to_spec_repair_session.json",
                {"artifact_kind": "idea_to_spec_repair_session"},
            )
            _write_json(
                runs_dir / "specspace_repair_rerun_request_gate.json",
                {
                    "artifact_kind": "specspace_repair_rerun_request_gate",
                    "status": "specspace_repair_rerun_request_gate_ready",
                    "readiness": {"ready": True, "blocked_by": []},
                },
            )
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "requests": [
                        {
                            "id": "repair-rerun-request.pantry-rotation.1",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "pantry-rotation",
                            "candidate_id": "pantry-rotation",
                            "created_at": "2026-01-01T00:00:00Z",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "import_preview_ref": (
                                "runs/specspace_repair_draft_import_preview.json"
                            ),
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 502)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "failed")
        self.assertEqual(body["platform_report"]["summary"]["status"], "blocked")

    def test_repair_rerun_publish_disabled_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(root / "dialogs")
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun/publish"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_unavailable")
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertFalse(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )

    def test_repair_rerun_publish_requires_workspace_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs",
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-rerun/publish",
                    {},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertIn("workspace_id is required", body["error"])

    def test_repair_rerun_publish_runs_allowlisted_platform_publish(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            specgraph_dir = root / "SpecGraph"
            specgraph_dir.mkdir()
            (specgraph_dir / "Makefile").write_text(
                "publish-bundle:\n\t@true\n",
                encoding="utf-8",
            )
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "\n".join(
                    [
                        "import json",
                        "import sys",
                        "from pathlib import Path",
                        "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                        "report = {",
                        "    'artifact_kind': 'platform_product_repair_rerun_publication_report',",
                        "    'schema_version': 1,",
                        "    'ok': True,",
                        "    'dry_run': False,",
                        "    'summary': {'status': 'published'},",
                        "    'authority_boundary': {",
                        "        'executes_specgraph_make_target': True,",
                        "        'executes_git_commands': False,",
                        "        'opens_pull_requests': False,",
                        "        'publishes_read_models': False,",
                        "        'writes_ontology_packages': False,",
                        "        'accepts_ontology_terms': False,",
                        "    },",
                        "}",
                        "output.write_text(json.dumps(report), encoding='utf-8')",
                        "print(json.dumps(report))",
                    ]
                ),
                encoding="utf-8",
            )
            _write_json(
                runs_dir / "platform_product_repair_rerun_execution_report.json",
                {
                    "artifact_kind": "platform_product_repair_rerun_execution_report",
                    "ok": True,
                    "dry_run": False,
                    "specgraph_dir": str(specgraph_dir),
                    "summary": {"status": "completed"},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-repair-rerun/publish"
                        "?workspace=pantry-rotation"
                    ),
                    {"workspace_id": "pantry-rotation"},
                )
                report_file_exists = (
                    runs_dir / "platform_product_repair_rerun_publication_report.json"
                ).is_file()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["status"], "completed")
        self.assertEqual(body["workspace_id"], "pantry-rotation")
        self.assertEqual(
            body["execution_report_ref"],
            "runs/platform_product_repair_rerun_execution_report.json",
        )
        self.assertEqual(
            body["output_ref"],
            "runs/platform_product_repair_rerun_publication_report.json",
        )
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertTrue(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )
        self.assertTrue(body["authority_boundary"]["executes_specgraph"])
        self.assertTrue(body["authority_boundary"]["publishes_public_bundle"])
        self.assertTrue(report_file_exists)

    def test_candidate_approval_execute_runs_allowlisted_platform_approve(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            specgraph_dir = root / "SpecGraph"
            runs_dir = specgraph_dir / "runs"
            runs_dir.mkdir(parents=True)
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "\n".join(
                    [
                        "import json",
                        "import sys",
                        "from pathlib import Path",
                        "gate = Path(sys.argv[sys.argv.index('--gate-output') + 1])",
                        "decision = Path(sys.argv[sys.argv.index('--decision-output') + 1])",
                        "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                        "paths = [sys.argv[index + 1] for index, value in enumerate(sys.argv) if value == '--path']",
                        "gate_report = {'artifact_kind': 'platform_candidate_approval_intent_gate_report', 'ok': True, 'ready_to_materialize': True, 'approved_paths': paths, 'summary': {'candidate_id': 'team-decision-log', 'workspace_id': 'team-decision-log'}}",
                        "decision_report = {'artifact_kind': 'candidate_approval_decision', 'readiness': {'ready': True}, 'promotion_request': {'paths': paths}}",
                        "report = {",
                        "    'artifact_kind': 'platform_candidate_approval_execution_report',",
                        "    'schema_version': 1,",
                        "    'ok': True,",
                        "    'dry_run': False,",
                        "    'status': 'candidate_approval_materialized',",
                        "    'candidate_id': 'team-decision-log',",
                        "    'workspace_id': 'team-decision-log',",
                        "    'candidate_approval_decision_ref': str(decision),",
                        "    'summary': {'status': 'candidate_approval_materialized', 'decision_written': True, 'approved_path_count': len(paths), 'gate_ready': True, 'error_count': 0},",
                        "    'authority_boundary': {'executes_git_commands': False, 'opens_pull_requests': False, 'publishes_read_models': False, 'writes_ontology_packages': False, 'accepts_ontology_terms': False, 'mutates_canonical_specs': False},",
                        "}",
                        "gate.write_text(json.dumps(gate_report), encoding='utf-8')",
                        "decision.write_text(json.dumps(decision_report), encoding='utf-8')",
                        "output.write_text(json.dumps(report), encoding='utf-8')",
                        "print(json.dumps(report))",
                    ]
                ),
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-candidate-approval/execute"
                        "?workspace=team-decision-log"
                    ),
                    {"workspace_id": "team-decision-log"},
                )
                execution_exists = (
                    runs_dir / "platform_candidate_approval_execution_report.json"
                ).is_file()
                decision_exists = (
                    runs_dir / "candidate_approval_decision.json"
                ).is_file()
                intent_state_status, intent_state = _get(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["status"], "completed")
        self.assertEqual(body["workspace_id"], "team-decision-log")
        self.assertEqual(
            body["output_ref"],
            "runs/platform_candidate_approval_execution_report.json",
        )
        self.assertTrue(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )
        self.assertTrue(
            body["authority_boundary"]["materializes_candidate_approval_decision"]
        )
        self.assertTrue(execution_exists)
        self.assertTrue(decision_exists)
        self.assertEqual(intent_state_status, 200)
        self.assertEqual(intent_state["summary"]["active_intent_count"], 0)
        self.assertEqual(intent_state["intents"][0]["status"], "consumed")

    def test_candidate_approval_execute_requires_current_intent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            specgraph_dir = root / "SpecGraph"
            runs_dir = specgraph_dir / "runs"
            runs_dir.mkdir(parents=True)
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            state_path = state_dir / "idea_to_spec_candidate_approval_intents.json"
            state = json.loads(state_path.read_text(encoding="utf-8"))
            state["intents"][0]["repair_session_ref"] = "runs/old_repair_session.json"
            state_path.write_text(json.dumps(state), encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-candidate-approval/execute"
                        "?workspace=team-decision-log"
                    ),
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["reason"], "candidate_approval_intent_not_current")

    def test_candidate_approval_execute_requires_successful_repair_reports(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            specgraph_dir = root / "SpecGraph"
            runs_dir = specgraph_dir / "runs"
            runs_dir.mkdir(parents=True)
            (specgraph_dir / "Makefile").write_text("noop:\n\t@true\n", encoding="utf-8")
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            execution_path = runs_dir / "platform_product_repair_rerun_execution_report.json"
            execution = json.loads(execution_path.read_text(encoding="utf-8"))
            execution["dry_run"] = True
            execution_path.write_text(json.dumps(execution), encoding="utf-8")
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                specgraph_dir=specgraph_dir,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/idea-to-spec-candidate-approval/execute"
                        "?workspace=team-decision-log"
                    ),
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["reason"], "repair_execution_report_not_approval_ready")

    def test_product_workspace_creation_requests_v1_reads_route_only_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/product-workspace-creation-requests?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_product_workspace_creation_request_state",
        )
        self.assertEqual(body["selected_workspace_id"], "pantry-rotation")
        self.assertEqual(body["summary"]["status"], "route_only_workspace")
        self.assertEqual(
            body["summary"]["next_gap"],
            "submit_product_workspace_creation_request",
        )
        self.assertFalse(body["consumer_boundary"]["may_execute_platform"])
        self.assertFalse(body["authority_boundary"]["workspace_catalog_authority"])
        self.assertFalse((state_dir / "product_workspace_creation_requests.json").exists())
        self.assertNotIn(str(state_dir), json.dumps(body))

    def test_product_workspace_creation_requests_v1_posts_requested_workspace(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "display_name": "Pantry Rotation",
                        "root_intent_summary": "Rotate pantry stock before expiry.",
                    },
                )
                state_written = (
                    state_dir / "product_workspace_creation_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["request_count"], 1)
        self.assertEqual(body["summary"]["active_requested_count"], 1)
        request = body["requests"][0]
        self.assertEqual(request["workspace_id"], "pantry-rotation")
        self.assertEqual(request["display_name"], "Pantry Rotation")
        self.assertEqual(request["route"], "/pantry-rotation")
        self.assertEqual(request["status"], "requested")
        self.assertNotIn("root_intent_summary", request)
        self.assertTrue(request["root_intent_summary_present"])
        self.assertTrue(state_written)

    def test_product_workspace_creation_requests_v1_allocates_non_english_route(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "display_name": "Домашний контроль подписок",
                        "root_intent_summary": "Локальный контроль цифровых подписок.",
                    },
                )
                state_written = (
                    state_dir / "product_workspace_creation_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        request = body["requests"][0]
        self.assertRegex(request["workspace_id"], r"^idea-[a-f0-9]{10}$")
        self.assertEqual(request["route"], f"/{request['workspace_id']}")
        self.assertEqual(request["display_name"], "Домашний контроль подписок")
        self.assertTrue(state_written)
        self.assertNotIn(str(state_dir), json.dumps(body))

    def test_product_workspace_creation_requests_v1_redacts_root_intent_on_get(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "display_name": "Pantry Rotation",
                        "root_intent_summary": "Rotate pantry stock before expiry.",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/product-workspace-creation-requests?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        request = body["requests"][0]
        self.assertNotIn("root_intent_summary", request)
        self.assertTrue(request["root_intent_summary_present"])

    def test_product_workspace_creation_requests_v1_rejects_terminal_status(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "display_name": "Pantry Rotation",
                        "status": "initialized",
                    },
                )
                state_written = (
                    state_dir / "product_workspace_creation_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertIn("requested", body["error"])
        self.assertFalse(state_written)

    def test_product_workspace_creation_requests_v1_rejects_long_root_intent(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "display_name": "Pantry Rotation",
                        "root_intent_summary": "x" * 2001,
                    },
                )
                state_written = (
                    state_dir / "product_workspace_creation_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["field"], "root_intent_summary")
        self.assertFalse(state_written)

    def test_product_workspace_creation_requests_v1_uses_selected_workspace_fallback(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests?workspace=crm",
                    {
                        "display_name": "Customer Relationship Management",
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["requests"][0]["workspace_id"], "crm")
        self.assertEqual(body["requests"][0]["route"], "/crm")

    def test_product_workspace_creation_requests_v1_rejects_authority_expansion(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "display_name": "Pantry Rotation",
                        "may_execute_platform": True,
                    },
                )
                state_written = (
                    state_dir / "product_workspace_creation_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertIn("may_execute_platform", body["error"])
        self.assertFalse(state_written)

    def test_product_workspace_creation_requests_v1_rejects_catalog_workspace(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "team-decision-log",
                        "display_name": "Team Decision Log",
                    },
                )
                state_written = (
                    state_dir / "product_workspace_creation_requests.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["field"], "workspace_id")
        self.assertIn("already exists", body["error"])
        self.assertFalse(state_written)

    def test_product_workspace_creation_requests_v1_rejects_initialized_workspace(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir(parents=True)
            _write_json(
                state_dir / "product_workspace_creation_requests.json",
                {
                    "artifact_kind": "specspace_product_workspace_creation_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "selected_workspace_id": None,
                    "requests": [
                        {
                            "request_id": "product-workspace-create.pantry-rotation.1",
                            "workspace_id": "pantry-rotation",
                            "display_name": "Pantry Rotation",
                            "route": "/pantry-rotation",
                            "status": "initialized",
                            "created_at": "2026-07-04T00:00:00Z",
                            "updated_at": "2026-07-04T00:00:00Z",
                            "canonical_mutations_allowed": False,
                            "tracked_artifacts_written": False,
                        }
                    ],
                    "summary": {},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                    },
                )
                stored = json.loads(
                    (state_dir / "product_workspace_creation_requests.json").read_text()
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["field"], "workspace_id")
        self.assertIn("already initialized", body["error"])
        self.assertEqual(len(stored["requests"]), 1)
        self.assertEqual(stored["requests"][0]["status"], "initialized")

    def test_real_idea_entry_requests_v1_posts_submitted_request(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "idea_text": "A team decision log for product discussions.",
                        "idea_summary_hint": "Team decision log",
                        "workspace_display_name": "Team Decision Log",
                        "domain_hints": ["team collaboration"],
                        "constraints": ["review-only candidate first"],
                    },
                )
                state_written = (state_dir / "real_idea_entry_requests.json").exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["request_count"], 1)
        self.assertEqual(body["summary"]["active_submitted_count"], 1)
        request = body["requests"][0]
        self.assertEqual(request["workspace_id"], "team-decision-log")
        self.assertEqual(request["status"], "submitted")
        self.assertEqual(
            request["idea_text"],
            "A team decision log for product discussions.",
        )
        self.assertFalse(request["authority_boundary"]["may_execute_specgraph"])
        self.assertFalse(request["privacy_boundary"]["raw_idea_text_public_safe"])
        self.assertTrue(state_written)

    def test_real_idea_entry_requests_v1_supersedes_previous_request(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                first_status, first_body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "idea_text": "First team decision log idea.",
                        "idea_summary_hint": "First decision log",
                    },
                )
                second_status, second_body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "idea_text": "Second team decision log idea.",
                        "idea_summary_hint": "Second decision log",
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(first_status, 200)
        self.assertEqual(second_status, 200)
        first_id = first_body["requests"][0]["request_id"]
        statuses = {item["request_id"]: item["status"] for item in second_body["requests"]}
        submitted_ids = [
            item["request_id"]
            for item in second_body["requests"]
            if item["status"] == "submitted"
        ]
        self.assertEqual(len(statuses), 2)
        self.assertEqual(len(submitted_ids), 1)
        self.assertNotEqual(first_id, submitted_ids[0])
        self.assertEqual(statuses[first_id], "superseded")
        superseded = [item for item in second_body["requests"] if item["request_id"] == first_id][0]
        self.assertIn("superseded_at", superseded)
        self.assertEqual(second_body["summary"]["active_submitted_count"], 1)

    def test_real_idea_entry_requests_v1_rejects_authority_expansion(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "idea_text": "A team decision log for product discussions.",
                        "may_execute_specgraph": True,
                    },
                )
                state_written = (state_dir / "real_idea_entry_requests.json").exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertIn("may_execute_specgraph", body["error"])
        self.assertFalse(state_written)

    def test_idea_to_spec_workspace_embeds_real_idea_entry_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "idea_text": "A team decision log for product discussions.",
                        "idea_summary_hint": "Team decision log",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        entry_state = body["real_idea_entry"]
        self.assertEqual(
            entry_state["artifact_kind"],
            "specspace_real_idea_entry_request_state",
        )
        self.assertEqual(entry_state["summary"]["active_submitted_count"], 1)
        self.assertEqual(entry_state["requests"][0]["workspace_id"], "team-decision-log")
        self.assertNotIn("idea_text", entry_state["requests"][0])
        self.assertTrue(entry_state["requests"][0]["idea_summary_hint_present"])

    def test_idea_to_spec_workspace_embeds_answer_continuation_execution(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_product_workspace_runs(runs_dir)
            _write_json(
                runs_dir
                / "platform_real_idea_answer_continuation_execution_report.json",
                {
                    "artifact_kind": (
                        "platform_real_idea_answer_continuation_execution_report"
                    ),
                    "ok": True,
                    "platform_returncode": 0,
                    "output_ref": "runs/real_idea_answer_continuation_report.json",
                    "summary": {
                        "status": "real_idea_answer_continuation_executed",
                        "workspace_id": "team-decision-log",
                    },
                    "authority_boundary": {
                        "executes_specgraph_make_target": True,
                        "executes_git_commands": False,
                        "opens_pull_requests": False,
                        "publishes_read_models": False,
                    },
                },
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        execution = body["intake_clarification"]["answer_continuation"]["execution"]
        self.assertTrue(execution["available"])
        self.assertTrue(execution["ok"])
        self.assertEqual(execution["status"], "real_idea_answer_continuation_executed")
        artifact_status = body["artifacts"][
            "platform_real_idea_answer_continuation_execution"
        ]
        self.assertTrue(artifact_status["available"])
        self.assertEqual(
            artifact_status["status"],
            "real_idea_answer_continuation_executed",
        )

    def test_idea_to_spec_workspace_embeds_workspace_creation_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "display_name": "Pantry Rotation",
                        "root_intent_summary": "Rotate pantry stock before expiry.",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        creation = body["workspace_creation"]
        self.assertEqual(
            creation["artifact_kind"],
            "specspace_product_workspace_creation_request_state",
        )
        self.assertEqual(creation["summary"]["status"], "workspace_creation_requested")
        self.assertEqual(creation["active_request"]["workspace_id"], "pantry-rotation")
        self.assertEqual(creation["active_request"]["route"], "/pantry-rotation")
        self.assertEqual(
            creation["active_request"]["root_intent_summary"],
            "Rotate pantry stock before expiry.",
        )
        self.assertTrue(creation["active_request"]["root_intent_summary_present"])
        self.assertNotIn("root_intent_summary", creation["requests"][0])
        self.assertEqual(
            body["workspace_initialization_path"]["status"],
            "initialization_request_needed",
        )
        self.assertEqual(
            body["workspace_initialization_path"]["next_safe_action"],
            "Request controlled Platform workspace initialization.",
        )
        self.assertTrue(body["workspace_initialization_path"]["initial_idea_present"])
        self.assertEqual(
            body["guided_flow"]["current_stage"],
            "workspace_initialization",
        )
        self.assertEqual(body["guided_flow"]["overall_status"], "waiting_for_operator")
        self.assertEqual(
            body["guided_flow"]["next_actions"][0]["target_section"],
            "idea-to-spec-workspace-initialization-path",
        )
        self.assertEqual(
            body["guided_flow"]["next_handoff"]["kind"],
            "workspace_initialization",
        )
        self.assertEqual(
            body["guided_flow"]["next_handoff"]["label"],
            "Request controlled Platform workspace initialization.",
        )
        overview = body["product_workspace_overview"]
        self.assertTrue(overview["available"])
        self.assertEqual(overview["status"], "creation_requested")
        self.assertEqual(overview["current_phase"], "workspace")
        self.assertEqual(
            overview["next_safe_action"],
            "Request controlled Platform workspace initialization.",
        )
        self.assertEqual(
            overview["primary_target_section"],
            "idea-to-spec-workspace-initialization-path",
        )
        self.assertEqual(overview["readiness"]["blocker_count"], 0)
        self.assertEqual(
            [phase["id"] for phase in overview["phases"]],
            [
                "workspace",
                "intake",
                "clarification",
                "candidate",
                "repair",
                "approval",
                "publication",
            ],
        )
        self.assertFalse(overview["authority_boundary"]["may_execute_platform"])
        dumped = json.dumps(creation)
        self.assertNotIn(str(state_dir), dumped)

    def test_idea_to_spec_workspace_root_does_not_embed_global_workspace_creation_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "display_name": "Pantry Rotation",
                    },
                )
                status, body = _get(f"{base}/api/v1/idea-to-spec-workspace")
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        self.assertNotIn("workspace_creation", body)

    def test_idea_to_spec_workspace_skips_initialization_stage_for_published_workspace(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["workspace_initialization_path"]["status"],
            "route_only",
        )
        self.assertEqual(body["workspace"]["id"], "pantry-rotation")
        self.assertNotEqual(
            body["guided_flow"]["current_stage"],
            "workspace_initialization",
        )
        stage_ids = [stage["id"] for stage in body["guided_flow"]["stages"]]
        self.assertNotIn("workspace_initialization", stage_ids)
        overview = body["product_workspace_overview"]
        self.assertTrue(overview["available"])
        self.assertNotEqual(overview["current_phase"], "workspace")
        self.assertEqual(overview["total_phase_count"], 6)
        self.assertEqual(
            [phase["id"] for phase in overview["phases"]],
            [
                "workspace",
                "intake",
                "clarification",
                "candidate",
                "repair",
                "approval",
                "publication",
            ],
        )
        self.assertEqual(overview["phases"][0]["state"], "not_applicable")
        self.assertFalse(overview["authority_boundary"]["may_create_branch_or_commit"])

    def test_idea_to_spec_workspace_overview_covers_lifecycle_statuses(
        self,
    ) -> None:
        def stage(
            stage_id: str,
            status: str,
            *,
            blockers: list[str] | None = None,
        ) -> dict[str, object]:
            return {
                "id": stage_id,
                "label": stage_id.replace("_", " ").title(),
                "status": status,
                "primary_next_action": f"Next action for {stage_id}",
                "target_section": f"section-{stage_id}",
                "blockers": blockers or [],
                "evidence_refs": [f"runs/{stage_id}.json"],
            }

        def overview(
            stages: list[dict[str, object]],
            current_stage: str,
            *,
            overall_status: str = "waiting_for_operator",
            workspace_ready: bool = True,
            initialization_status: str | None = None,
            read_model_published: bool = False,
            maturity_trusted: bool = True,
        ) -> dict[str, object]:
            return idea_to_spec_workspace._product_workspace_overview(
                {
                    "guided_flow": {
                        "current_stage": current_stage,
                        "current_stage_label": current_stage,
                        "overall_status": overall_status,
                        "next_actions": [
                            {
                                "label": f"Next action for {current_stage}",
                                "target_section": f"section-{current_stage}",
                                "evidence_refs": [f"runs/{current_stage}.json"],
                            }
                        ],
                        "stages": stages,
                    },
                    "summary": {"read_model_published": read_model_published},
                    "workspace": {
                        "available": workspace_ready,
                        "ready": workspace_ready,
                    },
                    "workspace_initialization_path": (
                        {"status": initialization_status}
                        if initialization_status is not None
                        else {}
                    ),
                    "idea_maturity": {
                        "trusted": maturity_trusted,
                        "report": {
                            "summary": {"lifecycle_state": "test_lifecycle"}
                        },
                    },
                }
            )

        cases = [
            {
                "name": "route_only",
                "stages": [
                    stage(
                        idea_to_spec_workspace.STAGE_WORKSPACE_INITIALIZATION,
                        "available",
                    )
                ],
                "current": idea_to_spec_workspace.STAGE_WORKSPACE_INITIALIZATION,
                "initialization_status": "route_only",
                "workspace_ready": False,
                "status": "route_only",
                "phase": "workspace",
                "confidence": "partial",
            },
            {
                "name": "creation_requested",
                "stages": [
                    stage(
                        idea_to_spec_workspace.STAGE_WORKSPACE_INITIALIZATION,
                        "available",
                    )
                ],
                "current": idea_to_spec_workspace.STAGE_WORKSPACE_INITIALIZATION,
                "initialization_status": "initialization_request_needed",
                "workspace_ready": False,
                "status": "creation_requested",
                "phase": "workspace",
                "confidence": "partial",
            },
            {
                "name": "initialized_without_idea",
                "stages": [
                    stage(
                        idea_to_spec_workspace.STAGE_WORKSPACE_INITIALIZATION,
                        "completed",
                    ),
                    stage(idea_to_spec_workspace.STAGE_IDEA_INTAKE, "missing"),
                ],
                "current": idea_to_spec_workspace.STAGE_IDEA_INTAKE,
                "status": "initialized",
                "phase": "intake",
                "confidence": "trusted",
            },
            {
                "name": "clarification_required",
                "stages": [
                    stage(idea_to_spec_workspace.STAGE_IDEA_INTAKE, "completed"),
                    stage(
                        idea_to_spec_workspace.STAGE_INTAKE_CLARIFICATION,
                        "available",
                    ),
                ],
                "current": idea_to_spec_workspace.STAGE_INTAKE_CLARIFICATION,
                "status": "clarification",
                "phase": "clarification",
                "confidence": "trusted",
            },
            {
                "name": "candidate_review",
                "stages": [
                    stage(idea_to_spec_workspace.STAGE_IDEA_INTAKE, "completed"),
                    stage(
                        idea_to_spec_workspace.STAGE_INTAKE_CLARIFICATION,
                        "completed",
                    ),
                    stage(idea_to_spec_workspace.STAGE_CANDIDATE_GRAPH, "available"),
                ],
                "current": idea_to_spec_workspace.STAGE_CANDIDATE_GRAPH,
                "status": "candidate_review",
                "phase": "candidate",
                "confidence": "trusted",
            },
            {
                "name": "repair_blocked",
                "stages": [
                    stage(idea_to_spec_workspace.STAGE_IDEA_INTAKE, "completed"),
                    stage(
                        idea_to_spec_workspace.STAGE_INTAKE_CLARIFICATION,
                        "completed",
                    ),
                    stage(idea_to_spec_workspace.STAGE_CANDIDATE_GRAPH, "completed"),
                    stage(
                        idea_to_spec_workspace.STAGE_REPAIR_REVIEW,
                        "blocked",
                        blockers=["repair_required"],
                    ),
                ],
                "current": idea_to_spec_workspace.STAGE_REPAIR_REVIEW,
                "overall_status": "blocked",
                "status": "blocked",
                "phase": "repair",
                "confidence": "blocked",
            },
            {
                "name": "approval_ready",
                "stages": [
                    stage(idea_to_spec_workspace.STAGE_IDEA_INTAKE, "completed"),
                    stage(
                        idea_to_spec_workspace.STAGE_INTAKE_CLARIFICATION,
                        "completed",
                    ),
                    stage(idea_to_spec_workspace.STAGE_CANDIDATE_GRAPH, "completed"),
                    stage(idea_to_spec_workspace.STAGE_REPAIR_REVIEW, "completed"),
                    stage(
                        idea_to_spec_workspace.STAGE_CANDIDATE_APPROVAL_INTENT,
                        "available",
                    ),
                ],
                "current": idea_to_spec_workspace.STAGE_CANDIDATE_APPROVAL_INTENT,
                "status": "approval",
                "phase": "approval",
                "confidence": "trusted",
            },
            {
                "name": "promotion",
                "stages": [
                    stage(idea_to_spec_workspace.STAGE_IDEA_INTAKE, "completed"),
                    stage(
                        idea_to_spec_workspace.STAGE_INTAKE_CLARIFICATION,
                        "completed",
                    ),
                    stage(idea_to_spec_workspace.STAGE_CANDIDATE_GRAPH, "completed"),
                    stage(idea_to_spec_workspace.STAGE_REPAIR_REVIEW, "completed"),
                    stage(
                        idea_to_spec_workspace.STAGE_CANDIDATE_APPROVAL_INTENT,
                        "completed",
                    ),
                    stage(
                        idea_to_spec_workspace.STAGE_PLATFORM_APPROVAL_DECISION,
                        "completed",
                    ),
                    stage(idea_to_spec_workspace.STAGE_PROMOTION_REQUEST, "completed"),
                    stage(idea_to_spec_workspace.STAGE_GIT_DRY_RUN, "available"),
                ],
                "current": idea_to_spec_workspace.STAGE_GIT_DRY_RUN,
                "status": "promotion",
                "phase": "publication",
                "confidence": "trusted",
            },
            {
                "name": "published",
                "stages": [
                    stage(idea_to_spec_workspace.STAGE_IDEA_INTAKE, "completed"),
                    stage(idea_to_spec_workspace.STAGE_CANDIDATE_GRAPH, "completed"),
                    stage(idea_to_spec_workspace.STAGE_REVIEW_PUBLICATION, "completed"),
                ],
                "current": idea_to_spec_workspace.STAGE_REVIEW_PUBLICATION,
                "read_model_published": True,
                "status": "published",
                "phase": "publication",
                "confidence": "trusted",
            },
            {
                "name": "untrusted_maturity",
                "stages": [
                    stage(idea_to_spec_workspace.STAGE_IDEA_INTAKE, "completed"),
                    stage(
                        idea_to_spec_workspace.STAGE_INTAKE_CLARIFICATION,
                        "available",
                    ),
                ],
                "current": idea_to_spec_workspace.STAGE_INTAKE_CLARIFICATION,
                "maturity_trusted": False,
                "status": "clarification",
                "phase": "clarification",
                "confidence": "untrusted",
            },
        ]

        for case in cases:
            with self.subTest(case["name"]):
                result = overview(
                    case["stages"],
                    case["current"],
                    overall_status=case.get("overall_status", "waiting_for_operator"),
                    workspace_ready=case.get("workspace_ready", True),
                    initialization_status=case.get("initialization_status"),
                    read_model_published=case.get("read_model_published", False),
                    maturity_trusted=case.get("maturity_trusted", True),
                )

                self.assertEqual(result["status"], case["status"])
                self.assertEqual(result["current_phase"], case["phase"])
                self.assertEqual(result["confidence"]["level"], case["confidence"])
                if case["name"] == "route_only":
                    self.assertEqual(
                        result["next_safe_action"],
                        "Create workspace request before initialization.",
                    )
                    self.assertEqual(
                        result["primary_target_section"],
                        "idea-to-spec-workspace-creation",
                    )
                self.assertIn(
                    result["status"],
                    {
                        "missing",
                        "route_only",
                        "creation_requested",
                        "initialized",
                        "intake",
                        "clarification",
                        "candidate_review",
                        "repair",
                        "approval",
                        "promotion",
                        "published",
                        "blocked",
                    },
                )

    def test_idea_to_spec_workspace_overview_phase_mapping_tracks_guided_stage_ids(
        self,
    ) -> None:
        covered_stage_ids = {
            stage_id
            for _phase_id, _label, stage_ids in (
                idea_to_spec_workspace.PRODUCT_WORKSPACE_OVERVIEW_PHASES
            )
            for stage_id in stage_ids
        }

        self.assertEqual(
            covered_stage_ids,
            {
                idea_to_spec_workspace.STAGE_WORKSPACE_INITIALIZATION,
                idea_to_spec_workspace.STAGE_IDEA_INTAKE,
                idea_to_spec_workspace.STAGE_INTAKE_CLARIFICATION,
                idea_to_spec_workspace.STAGE_CANDIDATE_GRAPH,
                idea_to_spec_workspace.STAGE_REPAIR_REVIEW,
                idea_to_spec_workspace.STAGE_ONTOLOGY_DECISIONS,
                idea_to_spec_workspace.STAGE_PROJECT_LOCAL_ONTOLOGY_REVIEW,
                idea_to_spec_workspace.STAGE_RERUN_REQUEST,
                idea_to_spec_workspace.STAGE_REPAIRED_HANDOFF,
                idea_to_spec_workspace.STAGE_CANDIDATE_APPROVAL_INTENT,
                idea_to_spec_workspace.STAGE_PLATFORM_APPROVAL_DECISION,
                idea_to_spec_workspace.STAGE_PROMOTION_REQUEST,
                idea_to_spec_workspace.STAGE_GIT_DRY_RUN,
                idea_to_spec_workspace.STAGE_REVIEW_PUBLICATION,
            },
        )

    def test_idea_to_spec_workspace_marks_creation_initialized_from_platform_report(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "dry_run": False,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "workspace": {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                        "route": "/pantry-rotation",
                        "repository_role": "product_spec_workspace",
                    },
                    "summary": {
                        "status": "workspace_initialization_executed",
                        "specgraph_executed": True,
                        "catalog_written": True,
                        "workspace_files_created": True,
                    },
                    "authority_boundary": {
                        "executes_platform": True,
                        "executes_specgraph": True,
                        "creates_workspace_files": True,
                        "updates_workspace_catalog": True,
                        "creates_git_commits": False,
                        "opens_pull_requests": False,
                        "publishes_read_models": False,
                        "mutates_canonical_specs": False,
                        "writes_ontology_packages": False,
                        "accepts_ontology_terms": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        creation = body["workspace_creation"]
        self.assertEqual(creation["summary"]["status"], "workspace_initialized")
        self.assertEqual(creation["summary"]["next_gap"], "start_real_idea_intake")
        self.assertEqual(creation["summary"]["requested_count"], 0)
        self.assertEqual(creation["summary"]["active_requested_count"], 0)
        self.assertEqual(creation["summary"]["initialized_count"], 1)
        self.assertEqual(creation["requests"][0]["status"], "initialized")
        self.assertTrue(creation["initialization"]["initialized"])
        self.assertTrue(
            creation["initialization"]["execution"]["catalog_written"]
        )
        self.assertEqual(
            body["workspace_initialization"]["execution"]["status"],
            "workspace_initialization_executed",
        )

    def test_idea_to_spec_workspace_reports_initialization_execution_request(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_PLAN_ARTIFACT,
                {
                    "artifact_kind": "platform_product_workspace_initialization_plan",
                    "schema_version": 1,
                    "ok": True,
                    "workspace": {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                        "route": "/pantry-rotation",
                        "repository_role": "product_spec_workspace",
                    },
                    "summary": {
                        "status": "workspace_initialization_planned",
                        "ready_for_platform_initialization": True,
                    },
                    "authority_boundary": {
                        "executes_platform": False,
                        "executes_specgraph": False,
                    },
                },
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "request_only": True,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "workspace": {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                        "route": "/pantry-rotation",
                        "repository_role": "product_spec_workspace",
                    },
                    "plan_ref": "runs/product_workspace_initialization_plan.json",
                    "requested_operation": "workspace.execute-initialization-plan",
                    "idempotency_key": "a" * 64,
                    "summary": {
                        "status": "workspace_initialization_execution_requested",
                        "ready_for_managed_execution": True,
                    },
                    "authority_boundary": {
                        "executes_platform": False,
                        "executes_specgraph": False,
                        "creates_workspace_files": False,
                        "updates_workspace_catalog": False,
                        "may_execute_platform": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        creation = body["workspace_creation"]
        self.assertEqual(creation["summary"]["status"], "workspace_creation_requested")
        request = body["workspace_initialization"]["execution_request"]
        self.assertTrue(request["available"])
        self.assertTrue(request["trusted"])
        self.assertEqual(
            request["status"],
            "workspace_initialization_execution_requested",
        )
        self.assertTrue(request["ready_for_managed_execution"])
        self.assertEqual(
            request["requested_operation"],
            "workspace.execute-initialization-plan",
        )
        self.assertEqual(request["idempotency_key"], "a" * 64)
        self.assertFalse(body["workspace_initialization"]["initialized"])
        self.assertEqual(
            body["workspace_initialization"]["refs"]["plan"],
            "runs/product_workspace_initialization_plan.json",
        )
        self.assertEqual(
            body["workspace_initialization"]["refs"]["execution_request"],
            "runs/product_workspace_initialization_execution_request.json",
        )
        self.assertEqual(
            body["workspace_initialization_path"]["initialization_request_ref"],
            "runs/product_workspace_initialization_execution_request.json",
        )
        self.assertEqual(
            body["guided_flow"]["current_stage"],
            "workspace_initialization",
        )
        self.assertEqual(
            body["guided_flow"]["next_handoff"]["artifact_path"],
            "runs/product_workspace_initialization_execution_request.json",
        )

    def test_product_workspace_initialization_execute_disabled_by_default(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir(parents=True)
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "requested_operation": "workspace.execute-initialization-plan",
                    "summary": {"ready_for_managed_execution": True},
                },
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/product-workspace-initialization/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {
                        "workspace_id": "pantry-rotation",
                        "execution_request_ref": (
                            "runs/"
                            + idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT
                        ),
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 503)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_unavailable")
        self.assertFalse(
            (
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT
            ).exists()
        )

    def test_product_workspace_initialization_execute_runs_allowlisted_platform(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            workspace_runs_dir = runs_dir / "pantry-rotation"
            workspace_runs_dir.mkdir(parents=True)
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "\n".join(
                    [
                        "import json",
                        "import sys",
                        "from pathlib import Path",
                        "output = Path(sys.argv[sys.argv.index('--output') + 1])",
                        "report = {",
                        "    'artifact_kind': 'platform_product_workspace_initialization_execution_report',",
                        "    'schema_version': 1,",
                        "    'ok': True,",
                        "    'dry_run': True,",
                        "    'summary': {",
                        "        'status': 'workspace_initialization_dry_run',",
                        "        'specgraph_executed': False,",
                        "        'workspace_files_created': False,",
                        "        'catalog_written': False,",
                        "    },",
                        "    'authority_boundary': {",
                        "        'creates_git_commits': False,",
                        "        'opens_pull_requests': False,",
                        "        'publishes_read_models': False,",
                        "        'writes_ontology_packages': False,",
                        "        'accepts_ontology_terms': False,",
                        "    },",
                        "}",
                        "output.write_text(json.dumps(report), encoding='utf-8')",
                        "print(json.dumps(report))",
                    ]
                ),
                encoding="utf-8",
            )
            _write_json(
                workspace_runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "requested_operation": "workspace.execute-initialization-plan",
                    "summary": {"ready_for_managed_execution": True},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/product-workspace-initialization/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {
                        "workspace_id": "pantry-rotation",
                        "execution_request_ref": (
                            "runs/pantry-rotation/"
                            + idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT
                        ),
                    },
                )
                nested_report_file_exists = (
                    workspace_runs_dir
                    / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT
                ).is_file()
                report_file_exists = (
                    runs_dir
                    / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT
                ).is_file()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["status"], "completed")
        self.assertEqual(
            body["output_ref"],
            "runs/"
            + idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
        )
        self.assertEqual(
            body["platform_report"]["summary"]["status"],
            "workspace_initialization_dry_run",
        )
        self.assertFalse(body["authority_boundary"]["browser_executes_platform"])
        self.assertTrue(
            body["authority_boundary"]["specspace_backend_executes_platform"]
        )
        self.assertTrue(report_file_exists)
        self.assertFalse(nested_report_file_exists)

    def test_product_workspace_initialization_execute_rejects_cross_workspace_request_artifact(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir(parents=True)
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "workspace": {"workspace_id": "other-workspace"},
                    "requested_operation": "workspace.execute-initialization-plan",
                    "summary": {"ready_for_managed_execution": True},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/product-workspace-initialization/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {
                        "workspace_id": "pantry-rotation",
                        "execution_request_ref": (
                            "runs/"
                            + idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT
                        ),
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertIn("workspace_id does not match", body["error"])
        self.assertEqual(body["expected"], "pantry-rotation")
        self.assertEqual(body["actual"], "other-workspace")

    def test_product_workspace_initialization_execute_rejects_invalid_platform_json(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir(parents=True)
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "print('not json')\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "requested_operation": "workspace.execute-initialization-plan",
                    "summary": {"ready_for_managed_execution": True},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/product-workspace-initialization/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {
                        "workspace_id": "pantry-rotation",
                        "execution_request_ref": (
                            "runs/"
                            + idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT
                        ),
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 502)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_report_invalid_json")
        self.assertEqual(
            body["summary"]["status"],
            "managed_initialization_invalid_platform_report",
        )

    def test_product_workspace_initialization_execute_returns_timeout_payload(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir(parents=True)
            platform_dir = root / "Platform"
            scripts_dir = platform_dir / "scripts"
            scripts_dir.mkdir(parents=True)
            (scripts_dir / "platform.py").write_text(
                "import time\ntime.sleep(5)\n",
                encoding="utf-8",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "workspace": {"workspace_id": "pantry-rotation"},
                    "requested_operation": "workspace.execute-initialization-plan",
                    "summary": {"ready_for_managed_execution": True},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
                platform_execution_timeout_seconds=1,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/product-workspace-initialization/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {
                        "workspace_id": "pantry-rotation",
                        "execution_request_ref": (
                            "runs/"
                            + idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT
                        ),
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 504)
        self.assertFalse(body["ok"])
        self.assertEqual(body["status"], "platform_execution_timeout")
        self.assertEqual(body["summary"]["status"], "managed_initialization_timeout")

    def test_product_workspace_initialization_execute_rejects_unsafe_request_ref(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            platform_dir = root / "Platform"
            (platform_dir / "scripts").mkdir(parents=True)
            (platform_dir / "scripts" / "platform.py").write_text(
                "raise SystemExit('must not execute')\n",
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                platform_dir=platform_dir,
                platform_execution_enabled=True,
            )
            try:
                status, body = _post(
                    (
                        f"{base}/api/v1/product-workspace-initialization/execute"
                        "?workspace=pantry-rotation"
                    ),
                    {
                        "workspace_id": "pantry-rotation",
                        "execution_request_ref": (
                            "runs/../product_workspace_initialization_execution_request.json"
                        ),
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(
            body["field"],
            "execution_request_ref",
        )

    def test_idea_to_spec_workspace_blocks_unready_initialization_execution_request(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "request_only": True,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "workspace": {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                        "route": "/pantry-rotation",
                        "repository_role": "product_spec_workspace",
                    },
                    "plan_ref": "runs/product_workspace_initialization_plan.json",
                    "requested_operation": "workspace.execute-initialization-plan",
                    "idempotency_key": "a" * 64,
                    "summary": {
                        "status": "workspace_initialization_execution_requested",
                        "ready_for_managed_execution": False,
                    },
                    "authority_boundary": {
                        "executes_platform": False,
                        "executes_specgraph": False,
                        "creates_workspace_files": False,
                        "updates_workspace_catalog": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        self.assertTrue(
            body["workspace_initialization"]["execution_request"]["available"]
        )
        self.assertFalse(
            body["workspace_initialization"]["execution_request"][
                "ready_for_managed_execution"
            ]
        )
        self.assertEqual(
            body["workspace_initialization_path"]["status"],
            "blocked",
        )
        self.assertEqual(
            body["workspace_initialization_path"]["blockers"],
            ["workspace_initialization_request_not_ready"],
        )

    def test_idea_to_spec_workspace_blocks_failed_initialization_execution_report(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": False,
                    "dry_run": False,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "workspace": {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                        "route": "/pantry-rotation",
                        "repository_role": "product_spec_workspace",
                    },
                    "summary": {
                        "status": "workspace_initialization_failed",
                        "specgraph_executed": False,
                        "catalog_written": False,
                        "workspace_files_created": False,
                    },
                    "authority_boundary": {
                        "executes_platform": True,
                        "executes_specgraph": False,
                        "creates_workspace_files": False,
                        "updates_workspace_catalog": False,
                        "creates_git_commits": False,
                        "opens_pull_requests": False,
                        "publishes_read_models": False,
                        "mutates_canonical_specs": False,
                        "writes_ontology_packages": False,
                        "accepts_ontology_terms": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        self.assertTrue(body["workspace_initialization"]["execution"]["available"])
        self.assertFalse(body["workspace_initialization"]["execution"]["ok"])
        self.assertEqual(
            body["workspace_initialization_path"]["status"],
            "blocked",
        )
        self.assertEqual(
            body["workspace_initialization_path"]["blockers"],
            ["workspace_initialization_execution_failed"],
        )

    def test_idea_to_spec_workspace_rejects_mutating_initialization_execution_request(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "request_only": False,
                    "canonical_mutations_allowed": True,
                    "tracked_artifacts_written": True,
                    "workspace": {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                        "route": "/pantry-rotation",
                        "repository_role": "product_spec_workspace",
                    },
                    "plan_ref": "runs/product_workspace_initialization_plan.json",
                    "requested_operation": "workspace.execute-initialization-plan",
                    "idempotency_key": "a" * 64,
                    "summary": {
                        "status": "workspace_initialization_execution_requested",
                        "ready_for_managed_execution": True,
                    },
                    "authority_boundary": {
                        "executes_platform": False,
                        "executes_specgraph": False,
                        "creates_workspace_files": False,
                        "updates_workspace_catalog": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        initialization = body["workspace_initialization"]
        request = initialization["execution_request"]
        self.assertFalse(initialization["trusted"])
        self.assertFalse(request["available"])
        self.assertFalse(request["trusted"])
        self.assertFalse(request["ok"])
        self.assertFalse(request["ready_for_managed_execution"])
        self.assertIsNone(request["status"])
        self.assertIsNone(request["requested_operation"])
        self.assertIsNone(request["idempotency_key"])
        self.assertEqual(
            body["workspace_initialization_path"]["status"],
            "blocked",
        )
        self.assertEqual(
            body["workspace_initialization_path"]["blockers"],
            ["workspace_initialization_untrusted"],
        )

    def test_idea_to_spec_workspace_ignores_initialization_request_for_other_workspace(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "request_only": True,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "workspace": {
                        "workspace_id": "different-workspace",
                        "display_name": "Different Workspace",
                        "route": "/different-workspace",
                        "repository_role": "product_spec_workspace",
                    },
                    "plan_ref": "runs/product_workspace_initialization_plan.json",
                    "requested_operation": "workspace.execute-initialization-plan",
                    "idempotency_key": "a" * 64,
                    "summary": {
                        "status": "workspace_initialization_execution_requested",
                        "ready_for_managed_execution": True,
                    },
                    "authority_boundary": {
                        "executes_platform": False,
                        "executes_specgraph": False,
                        "creates_workspace_files": False,
                        "updates_workspace_catalog": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        request = body["workspace_initialization"]["execution_request"]
        self.assertFalse(request["available"])
        self.assertFalse(request["trusted"])
        self.assertFalse(request["ready_for_managed_execution"])
        self.assertIsNone(request["requested_operation"])
        self.assertFalse(body["workspace_initialization"]["available"])
        self.assertEqual(
            body["workspace_initialization_path"]["status"],
            "initialization_request_needed",
        )
        self.assertEqual(
            body["workspace_creation"]["summary"]["next_gap"],
            "run_platform_workspace_initialization",
        )

    def test_idea_to_spec_workspace_execution_supersedes_stale_bad_request(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_request"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "request_only": False,
                    "canonical_mutations_allowed": True,
                    "tracked_artifacts_written": True,
                    "workspace": {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                        "route": "/pantry-rotation",
                        "repository_role": "product_spec_workspace",
                    },
                    "requested_operation": "workspace.execute-initialization-plan",
                    "idempotency_key": "a" * 64,
                    "summary": {
                        "status": "workspace_initialization_execution_requested",
                        "ready_for_managed_execution": True,
                    },
                    "authority_boundary": {},
                },
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "dry_run": False,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "workspace": {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                        "route": "/pantry-rotation",
                        "repository_role": "product_spec_workspace",
                    },
                    "summary": {
                        "status": "workspace_initialization_executed",
                        "specgraph_executed": True,
                        "catalog_written": True,
                        "workspace_files_created": True,
                    },
                    "authority_boundary": {
                        "executes_platform": True,
                        "executes_specgraph": True,
                        "creates_workspace_files": True,
                        "updates_workspace_catalog": True,
                        "creates_git_commits": False,
                        "opens_pull_requests": False,
                        "publishes_read_models": False,
                        "mutates_canonical_specs": False,
                        "writes_ontology_packages": False,
                        "accepts_ontology_terms": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        initialization = body["workspace_initialization"]
        self.assertTrue(initialization["trusted"])
        self.assertTrue(initialization["initialized"])
        self.assertEqual(
            body["workspace_creation"]["summary"]["status"],
            "workspace_initialized",
        )

    def test_idea_to_spec_workspace_ignores_initialization_for_other_workspace(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_product_workspace_initialization_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "dry_run": False,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "workspace": {
                        "workspace_id": "different-workspace",
                        "display_name": "Different Workspace",
                        "route": "/different-workspace",
                        "repository_role": "product_spec_workspace",
                    },
                    "summary": {
                        "status": "workspace_initialization_executed",
                        "specgraph_executed": True,
                        "catalog_written": True,
                        "workspace_files_created": True,
                    },
                    "authority_boundary": {
                        "executes_platform": True,
                        "executes_specgraph": True,
                        "creates_workspace_files": True,
                        "updates_workspace_catalog": True,
                        "creates_git_commits": False,
                        "opens_pull_requests": False,
                        "publishes_read_models": False,
                        "mutates_canonical_specs": False,
                        "writes_ontology_packages": False,
                        "accepts_ontology_terms": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/product-workspace-creation-requests",
                    {
                        "workspace_id": "pantry-rotation",
                        "display_name": "Pantry Rotation",
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        creation = body["workspace_creation"]
        self.assertEqual(creation["summary"]["status"], "workspace_creation_requested")
        self.assertEqual(
            creation["summary"]["next_gap"],
            "run_platform_workspace_initialization",
        )
        self.assertFalse(creation["initialization"]["initialized"])
        self.assertFalse(body["workspace_initialization"]["initialized"])

    def test_idea_to_spec_workspace_rejects_invalid_initialization_plan_artifact(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_product_workspace_runs(
                runs_dir,
                candidate_id="pantry-rotation",
                display_name="Pantry Rotation",
                public_route="/pantry-rotation",
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_PLAN_ARTIFACT,
                {
                    "artifact_kind": "unexpected_plan",
                    "schema_version": 1,
                    "ok": True,
                    "summary": {
                        "status": "product_workspace_initialization_ready",
                        "ready_for_platform_initialization": True,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=pantry-rotation"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        initialization = body["workspace_initialization"]
        self.assertTrue(initialization["trusted"])
        self.assertFalse(initialization["plan"]["available"])
        self.assertFalse(initialization["plan"]["ok"])
        self.assertFalse(
            initialization["plan"]["ready_for_platform_initialization"]
        )

    def test_real_idea_entry_projection_marks_missing_intake_submitted(self) -> None:
        payload = {
            "real_idea_intake": {
                "available": False,
                "status": "missing",
                "source_refs": [],
                "blockers": [],
            }
        }
        specspace_v1_api._apply_real_idea_entry_projection(
            payload,
            {
                "summary": {
                    "active_submitted_count": 1,
                }
            },
        )

        self.assertEqual(payload["real_idea_intake"]["status"], "entry_submitted")
        self.assertTrue(payload["real_idea_intake"]["available"])
        self.assertIn(
            "specspace-state://real_idea_entry_requests.json",
            payload["real_idea_intake"]["source_refs"],
        )

    def test_idea_to_spec_workspace_sanitizes_invalid_real_idea_entry_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            state_dir.mkdir(parents=True)
            _write_product_workspace_runs(runs_dir)
            (state_dir / "real_idea_entry_requests.json").write_text(
                "{not-json",
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        entry_state = body["real_idea_entry"]
        self.assertEqual(
            entry_state["summary"]["status"],
            "real_idea_entry_state_invalid",
        )
        dumped = json.dumps(entry_state)
        self.assertNotIn(str(state_dir), dumped)
        self.assertNotIn("path", entry_state.get("error", {}))

    def test_real_idea_entry_requests_v1_drops_unknown_fields_and_caps_history(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir(parents=True)
            requests = []
            for index in range(25):
                requests.append(
                    {
                        "request_id": f"entry-{index}",
                        "workspace_id": "team-decision-log",
                        "idea_text": f"Old idea {index}",
                        "status": "superseded",
                        "created_at": f"2026-07-03T00:00:{index:02d}Z",
                        "updated_at": f"2026-07-03T00:00:{index:02d}Z",
                        "superseded_at": f"2026-07-03T00:01:{index:02d}Z",
                        "private_extra": "/Users/egor/raw.txt",
                    }
                )
            requests.append(
                {
                    "request_id": "entry-active",
                    "workspace_id": "team-decision-log",
                    "idea_text": "Current idea",
                    "idea_summary_hint": "Current idea summary",
                    "status": "submitted",
                    "created_at": "2026-07-03T00:02:00Z",
                    "updated_at": "2026-07-03T00:02:00Z",
                    "private_extra": "/Users/egor/raw.txt",
                }
            )
            state = {
                "artifact_kind": "specspace_real_idea_entry_request_state",
                "schema_version": 1,
                "state_owner": "SpecSpace",
                "canonical_mutations_allowed": False,
                "tracked_artifacts_written": False,
                "consumer_boundary": {"may_execute_specgraph": False},
                "authority_boundary": {
                    "real_idea_entry_request_state_is_authority": False
                },
                "privacy_boundary": {
                    "raw_idea_text_local_only": True,
                    "raw_idea_text_public_safe": False,
                    "public_safe": False,
                },
                "requests": requests,
            }
            (state_dir / "real_idea_entry_requests.json").write_text(
                json.dumps(state),
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/real-idea-entry-requests?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["superseded_count"], 20)
        self.assertEqual(body["summary"]["active_submitted_count"], 1)
        dumped = json.dumps(body)
        self.assertNotIn("private_extra", dumped)
        self.assertIn("superseded_at", body["requests"][0])

    def test_idea_to_spec_workspace_shows_real_idea_entry_execution(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_product_workspace_runs(runs_dir)
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_REAL_IDEA_ENTRY_INTAKE_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_real_idea_entry_intake_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": True,
                    "dry_run": False,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "run_dir": "runs/real_idea_smoke",
                    "entry_requests_handoff_ref": (
                        "runs/real_idea_smoke/real_idea_entry_requests.json"
                    ),
                    "entry_requests_source_digest": "0" * 64,
                    "authority_boundary": {
                        "executes_specgraph_make_target": True,
                        "executes_git_commands": False,
                        "opens_pull_requests": False,
                        "merges_pull_requests": False,
                        "writes_ontology_packages": False,
                        "accepts_ontology_terms": False,
                        "mutates_canonical_specs": False,
                        "publishes_private_artifacts": False,
                    },
                    "target_make": {
                        "target": "real-idea-intake-from-entry-request",
                    },
                    "output_artifacts": {
                        "entry_intake_report": {
                            "path": (
                                "runs/real_idea_smoke/"
                                "real_idea_entry_request_intake_report.json"
                            ),
                            "present": True,
                            "artifact_kind": (
                                "real_idea_entry_request_intake_report"
                            ),
                            "status": "ready",
                            "ready": True,
                        }
                    },
                    "operations": [
                        {
                            "name": "execute_specgraph_real_idea_entry_intake",
                            "status": "succeeded",
                            "evidence": ["real-idea-intake-from-entry-request"],
                        }
                    ],
                    "diagnostics": [],
                    "summary": {
                        "status": "completed",
                        "error_count": 0,
                        "output_artifact_count": 1,
                    },
                },
            )
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        execution = body["real_idea_intake"]["entry_execution"]
        self.assertTrue(execution["available"])
        self.assertTrue(execution["ok"])
        self.assertEqual(execution["status"], "completed")
        self.assertEqual(
            execution["target"], "real-idea-intake-from-entry-request"
        )
        self.assertEqual(execution["output_artifact_count"], 1)
        self.assertIn(
            "runs/real_idea_smoke/real_idea_entry_request_intake_report.json",
            execution["output_refs"],
        )
        self.assertEqual(
            execution["operations"][0]["name"],
            "execute_specgraph_real_idea_entry_intake",
        )
        self.assertEqual(
            execution["output_artifacts"][0]["key"],
            "entry_intake_report",
        )

    def test_idea_to_spec_intake_clarification_answers_v1_posts_answer(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_intake_clarification_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "answer_question",
                        "value": {"refs": ["domain.team_decision_log"]},
                    },
                )
                state_written = (
                    state_dir / "idea_to_spec_intake_clarification_answers.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["answer_count"], 1)
        self.assertEqual(body["summary"]["accepted_answer_count"], 1)
        self.assertEqual(
            body["answer_set"]["artifact_kind"],
            "idea_to_spec_clarification_answer_set",
        )
        answer = body["answer_set"]["answers"][0]
        self.assertEqual(
            answer["request_id"],
            "clarification.intake.question-active-frame-domain-refs",
        )
        self.assertEqual(answer["value"]["refs"], ["domain.team_decision_log"])
        self.assertTrue(state_written)

    def test_idea_to_spec_intake_answers_use_real_idea_template_required_fields(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_intake_clarification_workspace_runs(runs_dir)
            (runs_dir / "real_idea_smoke").mkdir(parents=True, exist_ok=True)
            _write_json(
                runs_dir / "real_idea_smoke" / "real_idea_answer_template.json",
                {
                    "artifact_kind": "real_idea_answer_template",
                    "schema_version": 1,
                    "proposal_id": "0194",
                    "contract_ref": "specgraph.real-idea.answer-template.v0.1",
                    "stage": "intake",
                    "answer_targets": [
                        {
                            "target_id": "answer-target.active-frame-domain-refs",
                            "target_type": "active_frame_ref",
                            "request_id": "clarification.intake.question-active-frame-domain-refs",
                            "accepted_actions": ["answer_question", "defer"],
                            "required_fields_by_action": {
                                "answer_question": ["value.refs[]"],
                                "defer": ["value.follow_up"],
                            },
                            "value_templates_by_action": {
                                "answer_question": {"refs": [""]},
                                "defer": {"follow_up": ""},
                            },
                        }
                    ],
                    "readiness": {
                        "ready": True,
                        "review_state": "answer_template_ready",
                        "blocked_by": [],
                    },
                    "authority_boundary": {"may_execute_specgraph": False},
                    "privacy_boundary": {"raw_idea_text_published": False},
                    "summary": {"status": "answer_template_ready", "target_count": 1},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                bad_status, bad_body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "answer_question",
                        "value": {"text": "domain.team_decision_log"},
                    },
                )
                ok_status, ok_body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "answer_question",
                        "value": {"refs": ["domain.team_decision_log"]},
                    },
                )
                defer_status, defer_body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "defer",
                        "value": {"follow_up": "Ask the product owner."},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(bad_status, 400)
        self.assertEqual(bad_body["missing_fields"], ["value.refs[]"])
        self.assertEqual(ok_status, 200)
        answer = ok_body["answers"][0]
        self.assertEqual(answer["template_ref"], "runs/real_idea_smoke/real_idea_answer_template.json")
        self.assertEqual(answer["value"]["refs"], ["domain.team_decision_log"])
        self.assertEqual(defer_status, 200)
        self.assertEqual(defer_body["answers"][0]["value"]["reason"], "Ask the product owner.")

    def test_idea_to_spec_intake_answers_support_template_terms(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_intake_clarification_workspace_runs(runs_dir)
            (runs_dir / "real_idea_smoke").mkdir(parents=True, exist_ok=True)
            _write_json(
                runs_dir / "real_idea_smoke" / "real_idea_answer_template.json",
                {
                    "artifact_kind": "real_idea_answer_template",
                    "schema_version": 1,
                    "contract_ref": "specgraph.real-idea.answer-template.v0.1",
                    "stage": "intake",
                    "answer_targets": [
                        {
                            "target_id": "answer-target.local-terms",
                            "target_type": "domain_terms",
                            "request_id": "clarification.intake.question-active-frame-domain-refs",
                            "accepted_actions": ["answer_question"],
                            "required_fields_by_action": {
                                "answer_question": ["value.terms[]"],
                            },
                            "value_templates_by_action": {
                                "answer_question": {"terms": [""]},
                            },
                        }
                    ],
                    "authority_boundary": {"may_execute_specgraph": False},
                    "privacy_boundary": {"raw_idea_text_published": False},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "answer_question",
                        "value": {"terms": ["Payment", "Subscription"]},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["answers"][0]["value"]["terms"], ["Payment", "Subscription"])

    def test_idea_to_spec_intake_answers_expand_generic_template_value_shape(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_intake_clarification_workspace_runs(runs_dir)
            (runs_dir / "real_idea_smoke").mkdir(parents=True, exist_ok=True)
            _write_json(
                runs_dir / "real_idea_smoke" / "real_idea_answer_template.json",
                {
                    "artifact_kind": "real_idea_answer_template",
                    "schema_version": 1,
                    "contract_ref": "specgraph.real-idea.answer-template.v0.1",
                    "stage": "intake",
                    "answer_targets": [
                        {
                            "target_id": "answer-target.event-storming-actors",
                            "target_type": "intake_clarification",
                            "request_id": "clarification.intake.question-active-frame-domain-refs",
                            "accepted_actions": ["answer_question"],
                            "required_fields_by_action": {
                                "answer_question": ["value"],
                            },
                            "value_templates_by_action": {
                                "answer_question": {"entries": [""]},
                            },
                        }
                    ],
                    "authority_boundary": {"may_execute_specgraph": False},
                    "privacy_boundary": {"raw_idea_text_published": False},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                bad_status, bad_body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "answer_question",
                        "value": {"answer": "Decision Owner"},
                    },
                )
                ok_status, ok_body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "answer_question",
                        "value": {"entries": ["Decision Owner"]},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(bad_status, 400)
        self.assertEqual(bad_body["missing_fields"], ["value.entries[]"])
        self.assertEqual(ok_status, 200)
        self.assertEqual(ok_body["answers"][0]["value"]["entries"], ["Decision Owner"])

    def test_idea_to_spec_intake_answers_reject_bad_template_contracts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_intake_clarification_workspace_runs(runs_dir)
            (runs_dir / "real_idea_smoke").mkdir(parents=True, exist_ok=True)
            _write_json(
                runs_dir / "real_idea_smoke" / "real_idea_answer_template.json",
                {
                    "artifact_kind": "real_idea_answer_template",
                    "schema_version": 1,
                    "answer_targets": [],
                    "authority_boundary": {"specgraph_artifact_authority": True},
                    "privacy_boundary": {"raw_idea_text_published": False},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "answer_question",
                        "value": {"text": "domain.team_decision_log"},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["field"], "specgraph_artifact_authority")

    def test_idea_to_spec_intake_answers_rejects_unreadable_template(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_intake_clarification_workspace_runs(runs_dir)
            template_dir = runs_dir / "real_idea_smoke"
            template_dir.mkdir(parents=True, exist_ok=True)
            (template_dir / "real_idea_answer_template.json").write_text(
                "{not-json",
                encoding="utf-8",
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "answer_question",
                        "value": {"text": "domain.team_decision_log"},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["reason"], "real_idea_answer_template_invalid_contract")

    def test_idea_to_spec_intake_answers_intersects_template_actions(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_intake_clarification_workspace_runs(runs_dir)
            (runs_dir / "real_idea_smoke").mkdir(parents=True, exist_ok=True)
            _write_json(
                runs_dir / "real_idea_smoke" / "real_idea_answer_template.json",
                {
                    "artifact_kind": "real_idea_answer_template",
                    "schema_version": 1,
                    "answer_targets": [
                        {
                            "target_id": "answer-target.unsupported-action",
                            "request_id": "clarification.intake.question-active-frame-domain-refs",
                            "accepted_actions": ["provide_candidate_context"],
                            "required_fields_by_action": {
                                "provide_candidate_context": ["value.context"],
                            },
                        }
                    ],
                    "authority_boundary": {"may_execute_specgraph": False},
                    "privacy_boundary": {"raw_idea_text_published": False},
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "provide_candidate_context",
                        "value": {"context": "Use the local product domain."},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["allowed_actions"], [])

    def test_idea_to_spec_intake_clarification_answers_v1_uses_full_request_artifact(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_intake_clarification_workspace_runs(runs_dir)
            requests_path = (
                runs_dir
                / idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT
            )
            requests = json.loads(requests_path.read_text(encoding="utf-8"))
            for index in range(45):
                requests["clarification_requests"].append(
                    {
                        "id": f"clarification.intake.question-extra-{index}",
                        "kind": "intake_context_gap",
                        "severity": "blocking",
                        "status": "open",
                        "target_artifact": "user_idea_intake_session",
                        "target_ref": f"active_frame.context_refs.{index}",
                        "question": f"Which context ref {index} applies?",
                        "suggested_actions": ["answer_question", "defer"],
                    }
                )
            _write_json(requests_path, requests)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-extra-44",
                        "answer_kind": "answer_question",
                        "value": {"refs": ["context.team_decision_log"]},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["answer_count"], 1)
        self.assertEqual(
            body["answer_set"]["answers"][0]["request_id"],
            "clarification.intake.question-extra-44",
        )

    def test_idea_to_spec_intake_clarification_answers_v1_reports_invalid_stored_rows(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir(parents=True)
            _write_json(
                state_dir / "idea_to_spec_intake_clarification_answers.json",
                {
                    "artifact_kind": "specspace_idea_intake_clarification_answer_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "consumer_boundary": {"may_apply_answers": False},
                    "authority_boundary": {"intake_answer_state_is_authority": False},
                    "answers": [
                        {
                            "workspace_id": "team-decision-log",
                            "request_id": "clarification.intake.invalid",
                            "answer_kind": "answer_question",
                            "status": "accepted_for_candidate",
                            "authority": "operator_approved",
                            "value": {"text": "missing candidate id"},
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["answer_count"], 0)
        self.assertEqual(body["summary"]["invalid_answer_count"], 1)

    def test_idea_to_spec_intake_clarification_answers_v1_rejects_mutation_claims(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_intake_clarification_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-intake-clarification-answers?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.intake.question-active-frame-domain-refs",
                        "answer_kind": "answer_question",
                        "value": {"refs": ["domain.team_decision_log"]},
                        "applies_to_specgraph": True,
                    },
                )
                state_written = (
                    state_dir / "idea_to_spec_intake_clarification_answers.json"
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertIn("applies_to_specgraph", body["error"])
        self.assertFalse(state_written)

    def test_idea_to_spec_workspace_state_hygiene_v1_reports_missing_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
                workspace_status, workspace_body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_idea_to_spec_workspace_state_hygiene",
        )
        self.assertEqual(body["workspace_id"], "team-decision-log")
        self.assertEqual(body["summary"]["status"], "partial")
        self.assertGreater(body["summary"]["missing_state_count"], 0)
        self.assertEqual(body["summary"]["stale_state_count"], 0)
        self.assertGreater(body["summary"]["recommended_action_count"], 0)
        self.assertGreater(body["summary"]["enabled_recommended_action_count"], 0)
        first_action = body["recommended_actions"][0]
        self.assertEqual(first_action["id"], "workspace_state.save_repair_drafts")
        self.assertTrue(first_action["enabled"])
        self.assertFalse(first_action["authority_boundary"]["may_execute_platform"])
        self.assertFalse(first_action["authority_boundary"]["may_clear_state"])
        self.assertFalse(body["authority_boundary"]["may_execute_platform"])
        self.assertFalse(body["action_boundary"]["may_clear_state"])
        self.assertEqual(workspace_status, 200)
        self.assertEqual(
            workspace_body["workspace_state_hygiene"]["summary"]["status"],
            "partial",
        )
        self.assertEqual(
            workspace_body["workspace_state_hygiene"]["recommended_actions"][0]["id"],
            "workspace_state.save_repair_drafts",
        )

    def test_idea_to_spec_workspace_state_hygiene_v1_preserves_invalid_state_path(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_repair_draft_workspace_runs(runs_dir)
            draft_path = state_dir / "idea_to_spec_repair_drafts.json"
            draft_path.write_text("{", encoding="utf-8")
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
                workspace_status, workspace_body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        invalid = [item for item in body["states"] if item["kind"] == "repair_drafts"][0]
        self.assertEqual(invalid["status"], "invalid")
        self.assertEqual(invalid["path"], str(draft_path))

    def test_idea_to_spec_workspace_state_hygiene_blocks_import_without_journal(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_repair_session=False,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                post_status, _post_body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(post_status, 200)
        self.assertEqual(status, 200)
        repair_drafts = [
            item for item in body["states"] if item["kind"] == "repair_drafts"
        ][0]
        self.assertEqual(repair_drafts["status"], "usable")
        import_action = [
            item
            for item in body["recommended_actions"]
            if item["target_state"] == "repair_draft_import_preview"
        ][0]
        journal_action = [
            item
            for item in body["recommended_actions"]
            if item["target_state"] == "repair_session_journal"
        ][0]
        self.assertTrue(journal_action["enabled"])
        self.assertIn(
            "idea-to-spec-initial-repair-session-journal",
            journal_action["command_hint"],
        )
        self.assertFalse(import_action["enabled"])
        self.assertIn("Build repair session journal first.", import_action["blockers"])

    def test_idea_to_spec_workspace_state_hygiene_uses_platform_import_preview_report(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=False,
                include_platform_import_preview_report=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        import_state = [
            item
            for item in body["states"]
            if item["kind"] == "repair_draft_import_preview"
        ][0]
        self.assertEqual(import_state["status"], "usable")
        self.assertEqual(
            import_state["path"],
            "runs/isolated/specspace_repair_draft_import_preview.json",
        )
        actions = {
            item["target_state"]: item for item in body["recommended_actions"]
        }
        self.assertNotIn("repair_draft_import_preview", actions)

    def test_idea_to_spec_workspace_state_hygiene_rejects_platform_unknown_authority(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=False,
                include_platform_import_preview_report=True,
            )
            report_path = (
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_DRAFT_IMPORT_EXECUTION_REPORT_ARTIFACT
            )
            report = json.loads(report_path.read_text(encoding="utf-8"))
            report["authority_boundary"]["publishes_read_models"] = True
            _write_json(report_path, report)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
                request_status, request_body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        import_state = [
            item
            for item in body["states"]
            if item["kind"] == "repair_draft_import_preview"
        ][0]
        self.assertEqual(import_state["status"], "missing")
        self.assertEqual(request_status, 200)
        self.assertEqual(
            request_body["workflow_status"]["import_preview_status"],
            "missing",
        )

    def test_idea_to_spec_workspace_state_hygiene_rejects_wrong_platform_session_ref(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=False,
                include_platform_import_preview_report=True,
            )
            report_path = (
                runs_dir
                / idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_DRAFT_IMPORT_EXECUTION_REPORT_ARTIFACT
            )
            report = json.loads(report_path.read_text(encoding="utf-8"))
            report["repair_session_ref"] = "runs/isolated/old_repair_session.json"
            _write_json(report_path, report)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        import_state = [
            item
            for item in body["states"]
            if item["kind"] == "repair_draft_import_preview"
        ][0]
        self.assertEqual(import_state["status"], "stale")
        self.assertEqual(import_state["reason"], "repair_session_ref_mismatch")
        self.assertEqual(
            import_state["stored_repair_session_ref"],
            "runs/isolated/old_repair_session.json",
        )

    def test_idea_to_spec_repair_rerun_requests_v1_posts_with_platform_import_preview_report(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=False,
                include_platform_import_preview_report=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                draft_status, _draft_body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
                get_status, get_body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log"
                )
                post_status, post_body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "requested_action": "prepare_repair_draft_rerun",
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(draft_status, 200)
        self.assertEqual(get_status, 200)
        self.assertEqual(get_body["workflow_status"]["import_preview_status"], "ready")
        self.assertEqual(
            get_body["workflow_status"]["import_preview_ref"],
            "runs/isolated/specspace_repair_draft_import_preview.json",
        )
        self.assertEqual(get_body["workflow_status"]["accepted_for_rerun_count"], 1)
        self.assertTrue(get_body["workflow_status"]["request_ready"])
        self.assertEqual(post_status, 200)
        request = post_body["requests"][0]
        self.assertEqual(
            request["import_preview_ref"],
            "runs/isolated/specspace_repair_draft_import_preview.json",
        )
        self.assertFalse(request["may_execute_specgraph"])

    def test_idea_to_spec_workspace_state_hygiene_uses_platform_request_gate_report(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_request_gate_report=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        request_gate_state = [
            item
            for item in body["states"]
            if item["kind"] == "repair_rerun_request_gate"
        ][0]
        self.assertEqual(request_gate_state["status"], "usable")
        self.assertEqual(
            request_gate_state["path"],
            "runs/isolated/specspace_repair_rerun_request_gate.json",
        )

    def test_idea_to_spec_workspace_state_hygiene_v1_reports_stale_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_repair_draft_workspace_runs(runs_dir)
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "source_artifacts": {},
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "may_execute_specgraph": False,
                    },
                    "authority_boundary": {
                        "rerun_request_state_is_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "requests": [
                        {
                            "id": "repair-rerun-request.local-subscription-control.1",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "local-subscription-control",
                            "candidate_id": "local-subscription-control",
                            "repair_session_id": "repair-session.local-subscription-control",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "draft_state_ref": "specspace-state://idea_to_spec_repair_drafts.json",
                            "import_preview_ref": "runs/specspace_repair_draft_import_preview.json",
                            "rerun_report_ref": "runs/specspace_repair_draft_rerun_report.json",
                            "requested_by": "operator://specspace-local",
                            "created_at": "2026-06-29T10:00:00Z",
                            "updated_at": "2026-06-29T10:00:00Z",
                            "draft_count": 1,
                            "accepted_for_rerun_count": 1,
                            "canonical_mutations_allowed": False,
                            "tracked_artifacts_written": False,
                            "may_execute_specgraph": False,
                            "may_run_make_target": False,
                            "may_mutate_candidate_source_artifacts": False,
                            "may_mutate_canonical_specs": False,
                            "may_write_ontology_package": False,
                            "may_accept_ontology_terms": False,
                            "may_create_branch_or_commit": False,
                            "may_open_pull_request": False,
                            "may_execute_git_service_operation": False,
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
                workspace_status, workspace_body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["status"], "blocked")
        stale = [
            item
            for item in body["states"]
            if item["kind"] == "repair_rerun_request"
        ][0]
        self.assertEqual(stale["status"], "stale")
        self.assertEqual(stale["reason"], "workspace_id_mismatch")
        self.assertEqual(stale["stored_workspace_id"], "local-subscription-control")
        self.assertIn("repair_rerun_smoke", stale["blocks"])
        rerun_action = [
            item
            for item in body["recommended_actions"]
            if item["target_state"] == "repair_rerun_request"
        ][0]
        self.assertEqual(
            rerun_action["id"],
            "workspace_state.recreate_repair_rerun_request",
        )
        self.assertFalse(rerun_action["enabled"])
        self.assertIn("Save repair drafts first.", rerun_action["blockers"])
        self.assertEqual(workspace_status, 200)
        repair_review_stage = [
            stage
            for stage in workspace_body["guided_flow"]["stages"]
            if stage["id"] == "repair_review"
        ][0]
        self.assertIn(
            "workspace_id_mismatch",
            repair_review_stage["blockers"],
        )
        self.assertEqual(
            repair_review_stage["target_section"],
            "idea-to-spec-workspace-state-hygiene",
        )

    def test_idea_to_spec_workspace_state_hygiene_v1_uses_repaired_session_ref(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_json(
                state_dir / "idea_to_spec_candidate_approval_intents.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_candidate_approval_intent_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "source_artifacts": {},
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "may_execute_specgraph": False,
                    },
                    "authority_boundary": {
                        "candidate_approval_intent_state_is_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "intents": [
                        {
                            "id": "candidate-approval-intent.team-decision-log.1",
                            "status": "requested",
                            "requested_action": "approve_candidate_for_promotion_review",
                            "workspace_id": "team-decision-log",
                            "candidate_id": "team-decision-log",
                            "repair_session_id": "repaired-session.team-decision-log",
                            "repair_session_ref": "runs/repaired_idea_to_spec_repair_session.json",
                            "created_at": "2026-06-29T10:00:00Z",
                            "updated_at": "2026-06-29T10:00:00Z",
                            "canonical_mutations_allowed": False,
                            "tracked_artifacts_written": False,
                            "may_execute_specgraph": False,
                            "may_execute_prompt_agent": False,
                            "may_apply_to_specgraph": False,
                            "may_mutate_candidate_source_artifacts": False,
                            "may_mutate_canonical_specs": False,
                            "may_write_ontology_package": False,
                            "may_accept_ontology_terms": False,
                            "may_mark_candidate_accepted": False,
                            "may_mark_candidate_graph_accepted": False,
                            "may_create_branch_or_commit": False,
                            "may_open_pull_request": False,
                            "may_execute_git_service_operation": False,
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["repair_session_ref"],
            "runs/repaired_idea_to_spec_repair_session.json",
        )
        intent = [
            item
            for item in body["states"]
            if item["kind"] == "candidate_approval_intent"
        ][0]
        self.assertEqual(intent["status"], "usable")

    def test_idea_to_spec_workspace_guided_approval_path_waits_for_intent(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertTrue(path["available"])
        self.assertEqual(path["stage"], "approval_intent_needed")
        self.assertEqual(path["status"], "waiting_for_operator")
        self.assertEqual(path["target_section"], "idea-to-spec-approval-readiness")
        self.assertEqual(path["counts"]["promotion_path_count"], 1)
        self.assertEqual(path["state"]["approval_intent_status"], "missing")
        boundary = path["authority_boundary"]
        self.assertTrue(boundary["inspect_only"])
        self.assertFalse(boundary["may_execute_platform"])
        self.assertFalse(boundary["may_execute_git_service"])
        self.assertFalse(boundary["may_materialize_candidate_approval_decision"])
        self.assertFalse(boundary["may_create_promotion_request"])
        self.assertFalse(boundary["may_publish_read_model"])
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertEqual(checkpoints["approval_readiness"]["status"], "completed")
        self.assertEqual(checkpoints["approval_intent"]["status"], "required")

    def test_idea_to_spec_workspace_guided_approval_path_is_missing_without_artifacts(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            runs_dir.mkdir()
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertFalse(path["available"])
        self.assertEqual(path["stage"], "missing")
        self.assertEqual(path["status"], "missing")
        self.assertEqual(
            path["next_action"],
            "Publish approval readiness and controlled promotion artifacts.",
        )
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertEqual(checkpoints["approval_readiness"]["status"], "required")

    def test_idea_to_spec_workspace_guided_approval_path_waits_for_execution(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertEqual(path["stage"], "approval_execution_needed")
        self.assertEqual(path["status"], "waiting_for_operator")
        self.assertEqual(path["state"]["approval_intent_status"], "usable")
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertEqual(checkpoints["approval_intent"]["status"], "completed")
        self.assertEqual(checkpoints["approval_decision"]["status"], "required")

    def test_idea_to_spec_workspace_guided_approval_path_requires_approval_decision_ref(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            _write_json(
                runs_dir
                / idea_to_spec_workspace.PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": "platform_candidate_approval_execution_report",
                    "schema_version": 1,
                    "ok": True,
                    "dry_run": False,
                    "canonical_mutations_allowed": False,
                    "ontology_writes_allowed": False,
                    "tracked_artifacts_written": False,
                    "candidate_id": "team-decision-log",
                    "workspace_id": "team-decision-log",
                    "summary": {
                        "status": "candidate_approval_decision_materialized",
                        "gate_ready": True,
                        "decision_written": True,
                        "approved_path_count": 1,
                        "error_count": 0,
                    },
                    "authority_boundary": {
                        "executes_specgraph": False,
                        "executes_git_commands": False,
                        "opens_pull_requests": False,
                        "merges_pull_requests": False,
                        "writes_ontology_packages": False,
                        "accepts_ontology_terms": False,
                        "mutates_canonical_specs": False,
                    },
                    "diagnostics": [],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertEqual(path["stage"], "approval_execution_needed")
        self.assertEqual(path["status"], "waiting_for_operator")
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertEqual(checkpoints["approval_decision"]["status"], "required")

    def test_idea_to_spec_workspace_guided_approval_path_blocks_failed_approval_execution(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            _write_candidate_approval_artifacts(runs_dir)
            execution_path = (
                runs_dir
                / idea_to_spec_workspace.PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT
            )
            execution = json.loads(execution_path.read_text(encoding="utf-8"))
            execution["ok"] = False
            execution["summary"]["status"] = "candidate_approval_failed"
            execution["summary"]["error_count"] = 1
            _write_json(execution_path, execution)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertEqual(path["stage"], "approval_execution_needed")
        self.assertEqual(path["status"], "blocked")
        self.assertIn("candidate_approval_execution_failed", path["blockers"])
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertEqual(checkpoints["approval_decision"]["status"], "blocked")

    def test_idea_to_spec_workspace_guided_approval_path_waits_for_promotion_request(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            _write_candidate_approval_artifacts(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertEqual(path["stage"], "promotion_request_needed")
        self.assertEqual(path["status"], "waiting_for_operator")
        self.assertEqual(path["counts"]["approved_path_count"], 1)
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertEqual(checkpoints["approval_decision"]["status"], "completed")
        self.assertIn(
            "runs/candidate_approval_decision.json",
            path["evidence_refs"],
        )

    def test_idea_to_spec_workspace_guided_approval_path_blocks_failed_git_execution(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            _write_candidate_approval_artifacts(runs_dir)
            _write_product_promotion_artifacts(runs_dir, include_execution=True)
            _write_json(
                runs_dir
                / idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
                {
                    "artifact_kind": (
                        "platform_git_service_promotion_execution_report"
                    ),
                    "schema_version": 1,
                    "ok": False,
                    "dry_run": False,
                    "open_review_dry_run": False,
                    "candidate_ref": "graph-candidate/team-decision-log",
                    "summary": {
                        "status": "promotion_execution_failed",
                        "error_count": 1,
                    },
                    "authority_boundary": {
                        "may_execute_git_service": False,
                        "may_create_branch_or_commit": False,
                        "may_open_pull_request": False,
                        "may_merge_review": False,
                        "may_mutate_canonical_specs": False,
                        "may_write_ontology_package": False,
                        "may_accept_ontology_terms": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertEqual(path["stage"], "promotion_execution_needed")
        self.assertEqual(path["status"], "blocked")
        self.assertIn("promotion_execution_failed", path["blockers"])
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertEqual(checkpoints["promotion_execution"]["status"], "blocked")
        self.assertIn(
            f"runs/{idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT}",
            path["evidence_refs"],
        )

    def test_idea_to_spec_workspace_guided_approval_path_blocks_product_execution_errors(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            _write_candidate_approval_artifacts(runs_dir)
            _write_product_promotion_artifacts(runs_dir, include_execution=True)
            execution_path = (
                runs_dir
                / idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
            )
            execution = json.loads(execution_path.read_text(encoding="utf-8"))
            execution["summary"]["error_count"] = 1
            execution["diagnostics"] = [{"severity": "error", "id": "copy_failed"}]
            _write_json(execution_path, execution)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertEqual(path["stage"], "promotion_execution_needed")
        self.assertEqual(path["status"], "blocked")
        self.assertIn("promotion_execution_failed", path["blockers"])

    def test_idea_to_spec_workspace_guided_approval_path_ignores_stale_review_after_dry_run(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            _write_candidate_approval_artifacts(runs_dir)
            _write_product_promotion_artifacts(
                runs_dir,
                include_execution=True,
                include_review_status=True,
            )
            execution_path = (
                runs_dir
                / idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
            )
            execution = json.loads(execution_path.read_text(encoding="utf-8"))
            execution["dry_run"] = True
            execution["open_review_dry_run"] = True
            execution["summary"]["status"] = "dry_run"
            _write_json(execution_path, execution)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertEqual(path["stage"], "promotion_execution_needed")
        self.assertEqual(path["status"], "waiting_for_operator")
        self.assertEqual(
            path["next_action"],
            "Run non-dry-run product promotion execution when ready.",
        )
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertEqual(checkpoints["review_status"]["status"], "required")

    def test_idea_to_spec_workspace_guided_approval_path_uses_legacy_review_ref(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            _write_candidate_approval_artifacts(runs_dir)
            _write_product_promotion_artifacts(runs_dir)
            _write_json(
                runs_dir
                / idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT,
                {
                    "artifact_kind": "platform_graph_repository_review_status_report",
                    "schema_version": 1,
                    "ok": True,
                    "canonical_mutations_allowed": False,
                    "canonical_tracked_artifacts_written": False,
                    "tracked_artifacts_written": False,
                    "review_state": "open",
                    "summary": {"status": "waiting_for_review_merge"},
                    "authority_boundary": {
                        "may_merge_review": False,
                        "may_publish_read_model": False,
                        "may_mutate_canonical_specs": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertEqual(path["stage"], "review_merge_waiting")
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertIn(
            f"runs/{idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT}",
            checkpoints["review_status"]["evidence_refs"],
        )

    def test_idea_to_spec_workspace_guided_approval_path_reports_published_read_model(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            _write_candidate_approval_intent_state(state_dir)
            _write_candidate_approval_artifacts(runs_dir)
            _write_product_promotion_artifacts(
                runs_dir,
                include_execution=True,
                include_review_status=True,
                include_publication=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        path = body["guided_approval_path"]
        self.assertEqual(path["stage"], "published")
        self.assertEqual(path["status"], "completed")
        self.assertTrue(path["state"]["read_model_published"])
        checkpoints = {item["id"]: item for item in path["checkpoints"]}
        self.assertEqual(checkpoints["promotion_request"]["status"], "completed")
        self.assertEqual(checkpoints["promotion_execution"]["status"], "completed")
        self.assertEqual(checkpoints["review_status"]["status"], "completed")
        self.assertEqual(checkpoints["read_model_publication"]["status"], "completed")
        self.assertIn(
            "runs/product_candidate_promotion_read_model_publication_report.json",
            path["evidence_refs"],
        )

    def test_idea_to_spec_workspace_state_hygiene_v1_keeps_source_repair_state_usable_after_repaired_handoff(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=True,
                include_repaired_handoff=True,
                ready_for_candidate_approval=True,
            )
            preview_path = (
                runs_dir
                / idea_to_spec_workspace.SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT
            )
            preview = json.loads(preview_path.read_text(encoding="utf-8"))
            preview["source_artifacts"] = {
                "idea_to_spec_repair_session": "runs/idea_to_spec_repair_session.json"
            }
            preview["summary"].pop("repair_session_id", None)
            preview["session"] = {
                "session_id": "repair-session.team-decision-log",
                "candidate_id": "team-decision-log",
            }
            _write_json(preview_path, preview)
            _write_json(
                state_dir / "idea_to_spec_repair_drafts.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_draft_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "workspace_id": "team-decision-log",
                    "candidate_id": "team-decision-log",
                    "repair_session_id": "repair-session.team-decision-log",
                    "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "for_product_repair_workflow": True,
                        "may_execute_prompt_agent": False,
                        "may_apply_to_specgraph": False,
                        "may_apply_answers": False,
                        "may_apply_decisions": False,
                        "may_mutate_candidate_source_artifacts": False,
                        "may_mutate_canonical_specs": False,
                        "may_write_ontology_package": False,
                        "may_accept_ontology_terms": False,
                        "may_create_branch_or_commit": False,
                        "may_open_pull_request": False,
                    },
                    "authority_boundary": {
                        "repair_draft_state_is_authority": False,
                        "specgraph_artifact_authority": False,
                        "ontology_authority": False,
                        "git_service_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "drafts": [
                        {
                            "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                            "workspace_id": "team-decision-log",
                            "candidate_id": "team-decision-log",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "allowed_action": "propose_project_local_term",
                            "answer_value": {
                                "terms": ["Decision Record"],
                                "term_scope": "project_local",
                            },
                            "updated_at": "2026-06-29T10:00:00Z",
                        }
                    ],
                },
            )
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "workspace_id": "team-decision-log",
                    "candidate_id": "team-decision-log",
                    "repair_session_id": "repair-session.team-decision-log",
                    "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "for_product_repair_workflow": True,
                        "may_execute_specgraph": False,
                        "may_execute_prompt_agent": False,
                        "may_apply_to_specgraph": False,
                        "may_apply_answers": False,
                        "may_apply_decisions": False,
                        "may_mutate_candidate_source_artifacts": False,
                        "may_mutate_canonical_specs": False,
                        "may_write_ontology_package": False,
                        "may_accept_ontology_terms": False,
                        "may_create_branch_or_commit": False,
                        "may_open_pull_request": False,
                        "may_execute_git_service_operation": False,
                    },
                    "authority_boundary": {
                        "rerun_request_state_is_authority": False,
                        "specgraph_execution_authority": False,
                        "specgraph_artifact_authority": False,
                        "ontology_authority": False,
                        "git_service_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "requests": [
                        {
                            "id": "repair-rerun-request.team-decision-log.1",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "team-decision-log",
                            "candidate_id": "team-decision-log",
                            "repair_session_id": "repair-session.team-decision-log",
                            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                            "draft_state_ref": "specspace-state://idea_to_spec_repair_drafts.json",
                            "import_preview_ref": "runs/specspace_repair_draft_import_preview.json",
                            "created_at": "2026-06-29T10:00:00Z",
                            "updated_at": "2026-06-29T10:00:00Z",
                            "canonical_mutations_allowed": False,
                            "tracked_artifacts_written": False,
                            "may_execute_specgraph": False,
                            "may_run_make_target": False,
                            "may_mutate_candidate_source_artifacts": False,
                            "may_mutate_canonical_specs": False,
                            "may_write_ontology_package": False,
                            "may_accept_ontology_terms": False,
                            "may_create_branch_or_commit": False,
                            "may_open_pull_request": False,
                            "may_execute_git_service_operation": False,
                        }
                    ],
                },
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.SPECSPACE_REPAIR_RERUN_REQUEST_GATE_ARTIFACT,
                {
                    "artifact_kind": "specspace_repair_rerun_request_gate",
                    "schema_version": 1,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "status": "specspace_repair_rerun_request_ready",
                    "summary": {
                        "status": "specspace_repair_rerun_request_ready",
                        "workspace_id": "team-decision-log",
                        "candidate_id": "team-decision-log",
                    },
                    "session": {
                        "session_id": "repair-session.team-decision-log",
                        "candidate_id": "team-decision-log",
                    },
                    "selected_request": {
                        "id": "repair-rerun-request.team-decision-log.1",
                        "workspace_id": "team-decision-log",
                        "candidate_id": "team-decision-log",
                        "repair_session_id": "repair-session.team-decision-log",
                        "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                    },
                    "source_artifacts": {
                        "idea_to_spec_repair_session": "runs/idea_to_spec_repair_session.json"
                    },
                    "authority_boundary": {
                        "may_execute_prompt_agent": False,
                        "may_mutate_candidate_source_artifacts": False,
                        "may_mutate_canonical_specs": False,
                        "may_write_ontology_package": False,
                        "may_accept_ontology_terms": False,
                        "may_create_branch_or_commit": False,
                        "may_open_pull_request": False,
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["repair_session_ref"],
            "runs/repaired_idea_to_spec_repair_session.json",
        )
        states = {item["kind"]: item for item in body["states"]}
        for kind in ("repair_drafts", "repair_rerun_request"):
            self.assertEqual(states[kind]["status"], "usable")
            self.assertEqual(
                states[kind]["reason"],
                "source_repair_state_consumed_by_repaired_handoff",
            )
        for kind in ("repair_draft_import_preview", "repair_rerun_request_gate"):
            self.assertEqual(states[kind]["status"], "usable", states[kind])
            self.assertEqual(
                states[kind]["reason"],
                "source_repair_artifact_consumed_by_repaired_handoff",
            )
        self.assertEqual(states["candidate_approval_intent"]["status"], "missing")
        approval_action = [
            item
            for item in body["recommended_actions"]
            if item["target_state"] == "candidate_approval_intent"
        ][0]
        self.assertTrue(approval_action["enabled"])
        self.assertEqual(approval_action["blockers"], [])

    def test_idea_to_spec_workspace_projects_repair_gate_selected_request(
        self,
    ) -> None:
        status = idea_to_spec_workspace._artifact_status(
            {
                idea_to_spec_workspace.SPECSPACE_REPAIR_RERUN_REQUEST_GATE_ARTIFACT: {
                    "artifact_kind": "specspace_repair_rerun_request_gate",
                    "schema_version": 1,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "status": "specspace_repair_rerun_request_ready",
                    "session": {
                        "session_id": "repair-session.team-decision-log",
                        "candidate_id": "team-decision-log",
                    },
                    "selected_request": {
                        "id": "repair-rerun-request.team-decision-log.1",
                        "workspace_id": "team-decision-log",
                        "candidate_id": "team-decision-log",
                        "repair_session_id": "repair-session.team-decision-log",
                        "repair_session_ref": "runs/idea_to_spec_repair_session.json",
                    },
                    "source_artifacts": {
                        "idea_to_spec_repair_session": "runs/idea_to_spec_repair_session.json"
                    },
                }
            },
            idea_to_spec_workspace.SPECSPACE_REPAIR_RERUN_REQUEST_GATE_ARTIFACT,
        )

        self.assertEqual(
            status["selected_request"]["repair_session_id"],
            "repair-session.team-decision-log",
        )
        self.assertEqual(status["session"]["candidate_id"], "team-decision-log")

    def test_idea_to_spec_workspace_state_hygiene_v1_does_not_consume_state_for_partial_repaired(
        self,
    ) -> None:
        current = {
            "workspace_id": "team-decision-log",
            "candidate_id": "team-decision-log",
            "repair_session_id": "repaired-session.team-decision-log",
            "repair_session_ref": "runs/repaired_idea_to_spec_repair_session.json",
            "source_repair_session_id": "repair-session.team-decision-log",
            "source_repair_session_ref": "runs/idea_to_spec_repair_session.json",
            "repaired_selected": "true",
            "repaired_handoff_selected": None,
        }
        item = {
            "workspace_id": "team-decision-log",
            "candidate_id": "team-decision-log",
            "repair_session_id": "repair-session.team-decision-log",
            "repair_session_ref": "runs/idea_to_spec_repair_session.json",
        }

        self.assertFalse(
            idea_to_spec_workspace_state_hygiene._source_repair_state_consumed_by_repaired_handoff(
                "repair_drafts",
                item,
                current,
            )
        )

    def test_idea_to_spec_workspace_state_hygiene_v1_requires_ready_consumed_artifacts(
        self,
    ) -> None:
        current = {
            "workspace_id": "team-decision-log",
            "candidate_id": "team-decision-log",
            "repair_session_id": "repaired-session.team-decision-log",
            "repair_session_ref": "runs/repaired_idea_to_spec_repair_session.json",
            "source_repair_session_id": "repair-session.team-decision-log",
            "source_repair_session_ref": "runs/idea_to_spec_repair_session.json",
            "repaired_selected": "true",
            "repaired_handoff_selected": "true",
        }

        self.assertFalse(
            idea_to_spec_workspace_state_hygiene._source_repair_artifact_consumed_by_repaired_handoff(
                "repair_draft_import_preview",
                status="repair_draft_import_preview_review_required",
                ready_statuses={"repair_draft_import_preview_ready"},
                session_ref="runs/idea_to_spec_repair_session.json",
                stored_workspace_id="team-decision-log",
                stored_candidate_id="team-decision-log",
                stored_repair_session_id="repair-session.team-decision-log",
                current=current,
            )
        )

    def test_idea_to_spec_workspace_state_hygiene_v1_reads_candidate_id_from_runtime_session(
        self,
    ) -> None:
        current = {
            "workspace_id": "team-decision-log",
            "candidate_id": "team-decision-log",
            "repair_session_id": "repaired-session.team-decision-log",
            "repair_session_ref": "runs/repaired_idea_to_spec_repair_session.json",
            "source_repair_session_id": "repair-session.team-decision-log",
            "source_repair_session_ref": "runs/idea_to_spec_repair_session.json",
            "repaired_selected": "true",
            "repaired_handoff_selected": "true",
        }

        state = idea_to_spec_workspace_state_hygiene._artifact_state_status(
            kind="repair_draft_import_preview",
            artifact={
                "available": True,
                "status": "repair_draft_import_preview_ready",
                "source_artifacts": {
                    "idea_to_spec_repair_session": "runs/idea_to_spec_repair_session.json"
                },
                "session": {
                    "session_id": "repair-session.team-decision-log",
                    "candidate_id": "other-candidate",
                },
            },
            current=current,
            blocks=["repair_draft_import_preview"],
            missing_next_action="Run import preview.",
        )

        self.assertEqual(state["status"], "stale")
        self.assertEqual(state["reason"], "repair_session_ref_mismatch")
        self.assertEqual(state["stored_candidate_id"], "other-candidate")

    def test_idea_to_spec_workspace_state_hygiene_v1_allows_missing_source_session_id_for_consumed_artifacts(
        self,
    ) -> None:
        current = {
            "workspace_id": "team-decision-log",
            "candidate_id": "team-decision-log",
            "repair_session_id": "repaired-session.team-decision-log",
            "repair_session_ref": "runs/repaired_idea_to_spec_repair_session.json",
            "source_repair_session_id": "repair-session.team-decision-log",
            "source_repair_session_ref": "runs/idea_to_spec_repair_session.json",
            "repaired_selected": "true",
            "repaired_handoff_selected": "true",
        }

        self.assertTrue(
            idea_to_spec_workspace_state_hygiene._source_repair_artifact_consumed_by_repaired_handoff(
                "repair_rerun_request_gate",
                status="specspace_repair_rerun_request_gate_ready",
                ready_statuses={"specspace_repair_rerun_request_gate_ready"},
                session_ref="runs/idea_to_spec_repair_session.json",
                stored_workspace_id="team-decision-log",
                stored_candidate_id="team-decision-log",
                stored_repair_session_id=None,
                current=current,
            )
        )
        self.assertFalse(
            idea_to_spec_workspace_state_hygiene._source_repair_artifact_consumed_by_repaired_handoff(
                "repair_rerun_request_gate",
                status="specspace_repair_rerun_request_gate_ready",
                ready_statuses={"specspace_repair_rerun_request_gate_ready"},
                session_ref="runs/idea_to_spec_repair_session.json",
                stored_workspace_id="team-decision-log",
                stored_candidate_id="team-decision-log",
                stored_repair_session_id="old-repair-session.team-decision-log",
                current=current,
            )
        )

    def test_idea_to_spec_workspace_state_hygiene_v1_detects_stale_handoff_source_ref(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir, include_import_preview=True)
            preview_path = (
                runs_dir
                / idea_to_spec_workspace.SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT
            )
            preview = json.loads(preview_path.read_text(encoding="utf-8"))
            preview["source_artifacts"] = {
                "idea_to_spec_repair_session": "runs/old_repair_session.json"
            }
            _write_json(preview_path, preview)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        preview_state = [
            item
            for item in body["states"]
            if item["kind"] == "repair_draft_import_preview"
        ][0]
        self.assertEqual(preview_state["status"], "stale")
        self.assertEqual(preview_state["reason"], "repair_session_ref_mismatch")
        self.assertEqual(
            preview_state["stored_repair_session_ref"],
            "runs/old_repair_session.json",
        )

    def test_idea_to_spec_workspace_state_hygiene_v1_detects_candidate_mismatch(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            _write_json(
                runs_dir
                / idea_to_spec_workspace.SPECSPACE_REPAIR_RERUN_REQUEST_GATE_ARTIFACT,
                {
                    "artifact_kind": "specspace_repair_rerun_request_gate",
                    "schema_version": 1,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "status": "specspace_repair_rerun_request_gate_ready",
                    "summary": {
                        "status": "specspace_repair_rerun_request_gate_ready",
                        "workspace_id": "team-decision-log",
                        "candidate_id": "old-candidate",
                    },
                    "source_artifacts": {
                        "idea_to_spec_repair_session": "runs/idea_to_spec_repair_session.json"
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        gate = [
            item
            for item in body["states"]
            if item["kind"] == "repair_rerun_request_gate"
        ][0]
        self.assertEqual(gate["status"], "stale")
        self.assertEqual(gate["reason"], "candidate_id_mismatch")

    def test_idea_to_spec_workspace_state_hygiene_v1_validates_ready_status_by_kind(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            _write_json(
                runs_dir
                / idea_to_spec_workspace.SPECSPACE_REPAIR_RERUN_REQUEST_GATE_ARTIFACT,
                {
                    "artifact_kind": "specspace_repair_rerun_request_gate",
                    "schema_version": 1,
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "status": "repair_draft_import_preview_ready",
                    "summary": {
                        "status": "repair_draft_import_preview_ready",
                        "workspace_id": "team-decision-log",
                        "candidate_id": "team-decision-log",
                    },
                    "source_artifacts": {
                        "idea_to_spec_repair_session": "runs/idea_to_spec_repair_session.json"
                    },
                },
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace-state-hygiene?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        gate = [
            item
            for item in body["states"]
            if item["kind"] == "repair_rerun_request_gate"
        ][0]
        self.assertEqual(gate["status"], "invalid")
        self.assertEqual(gate["reason"], "repair_draft_import_preview_ready")

    def test_idea_to_spec_repair_drafts_v1_filters_source_artifacts_to_string_map(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_json(
                state_dir / "idea_to_spec_repair_drafts.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_draft_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "source_artifacts": {
                        "idea_to_spec_repair_session": "runs/idea_to_spec_repair_session.json",
                        "bad_number": 42,
                        "bad_empty": "",
                    },
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "for_product_repair_workflow": True,
                    },
                    "authority_boundary": {
                        "repair_draft_state_is_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "drafts": [],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["source_artifacts"],
            {
                "idea_to_spec_repair_session": "runs/idea_to_spec_repair_session.json",
            },
        )

    def test_idea_to_spec_repair_drafts_v1_posts_specspace_owned_draft(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            candidate_graph_path = runs_dir / idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT
            before_candidate_graph = candidate_graph_path.read_text(encoding="utf-8")
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {
                            "terms": ["Decision Record"],
                            "term_scope": "project_local",
                        },
                        "operator_ref": "operator://local-reviewer",
                    },
                )
                get_status, get_body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)
            state_path = state_dir / "idea_to_spec_repair_drafts.json"
            state_exists = state_path.exists()
            candidate_graph_after = candidate_graph_path.read_text(encoding="utf-8")

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["draft_count"], 1)
        self.assertEqual(get_status, 200)
        draft = get_body["drafts"][0]
        self.assertEqual(
            draft["request_id"],
            "clarification.candidate-gap.ontology-gap-decision-record",
        )
        self.assertEqual(draft["allowed_action"], "propose_project_local_term")
        self.assertEqual(draft["answer_value"]["terms"], ["Decision Record"])
        self.assertEqual(draft["candidate_id"], "team-decision-log")
        self.assertFalse(draft["applies_to_specgraph"])
        self.assertFalse(draft["mutates_canonical_specs"])
        self.assertTrue(state_exists)
        self.assertEqual(candidate_graph_after, before_candidate_graph)

    def test_idea_to_spec_repair_drafts_v1_posts_draft_with_legacy_repair_artifacts(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_repair_session=False,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["draft_count"], 1)
        draft = body["drafts"][0]
        self.assertEqual(
            draft["request_id"],
            "clarification.candidate-gap.ontology-gap-decision-record",
        )
        self.assertEqual(
            draft["repair_session_ref"],
            "runs/idea_to_spec_repair_session.json",
        )
        self.assertIsNone(draft["repair_session_id"])
        self.assertFalse(draft["applies_to_specgraph"])

    def test_idea_to_spec_repair_drafts_v1_preserves_bind_term(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "bind_existing_term",
                        "answer_value": {
                            "term": "Decision Record",
                            "ontology_ref": "ontology://specgraph-core/classes/Spec",
                        },
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        draft = body["drafts"][0]
        self.assertEqual(draft["allowed_action"], "bind_existing_term")
        self.assertEqual(draft["answer_value"]["term"], "Decision Record")
        self.assertEqual(
            draft["answer_value"]["ontology_ref"],
            "ontology://specgraph-core/classes/Spec",
        )

    def test_idea_to_spec_repair_drafts_v1_rejects_bind_without_term(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "bind_existing_term",
                        "answer_value": {
                            "ontology_ref": "ontology://specgraph-core/classes/Spec",
                        },
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "bind_existing_term requires answer_value.term")
        self.assertFalse((state_dir / "idea_to_spec_repair_drafts.json").exists())

    def test_idea_to_spec_repair_drafts_v1_preserves_alias_term(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "alias",
                        "answer_value": {
                            "term": "Decision Record",
                            "alias_of": "Spec",
                        },
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        draft = body["drafts"][0]
        self.assertEqual(draft["allowed_action"], "alias")
        self.assertEqual(draft["answer_value"]["term"], "Decision Record")
        self.assertEqual(draft["answer_value"]["alias_of"], "Spec")

    def test_idea_to_spec_repair_drafts_v1_rejects_alias_without_term(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "alias",
                        "answer_value": {"alias_of": "Spec"},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "alias requires answer_value.term")
        self.assertFalse((state_dir / "idea_to_spec_repair_drafts.json").exists())

    def test_idea_to_spec_repair_drafts_v1_rejects_empty_project_terms(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": [" ", ""]},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(
            body["error"],
            "propose_project_local_term requires at least one term",
        )
        self.assertFalse((state_dir / "idea_to_spec_repair_drafts.json").exists())

    def test_idea_to_spec_repair_drafts_v1_preserves_product_context_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            request_id = _append_product_repair_request(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": request_id,
                        "action": "provide_candidate_context",
                        "answer_value": {
                            "resolution_intent": "enforcement_mechanism_added",
                            "mechanism": "Validate every subscription payment before storing it.",
                            "owner": "Subscription owner",
                            "scope": "Local subscription workspace",
                            "affected_ref": "candidate-spec.subscription-payment",
                        },
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        draft = body["drafts"][0]
        self.assertEqual(draft["request_id"], request_id)
        self.assertEqual(draft["allowed_action"], "provide_candidate_context")
        self.assertEqual(
            draft["answer_value"]["resolution_intent"],
            "enforcement_mechanism_added",
        )
        self.assertEqual(
            draft["answer_value"]["mechanism"],
            "Validate every subscription payment before storing it.",
        )
        self.assertIn("Mechanism:", draft["answer_value"]["text"])
        self.assertFalse(draft["applies_to_candidate_artifacts"])

    def test_idea_to_spec_repair_drafts_v1_preserves_product_defer_follow_up(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            request_id = _append_product_repair_request(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": request_id,
                        "action": "defer",
                        "answer_value": {
                            "reason": "Needs owner review.",
                            "follow_up": "Ask the subscription owner for validation evidence.",
                        },
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        draft = body["drafts"][0]
        self.assertEqual(draft["allowed_action"], "defer")
        self.assertEqual(draft["answer_value"]["reason"], "Needs owner review.")
        self.assertEqual(
            draft["answer_value"]["follow_up"],
            "Ask the subscription owner for validation evidence.",
        )

    def test_idea_to_spec_repair_drafts_v1_rejects_empty_product_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            request_id = _append_product_repair_request(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": request_id,
                        "action": "provide_candidate_context",
                        "answer_value": {
                            "resolution_intent": "enforcement_mechanism_added",
                            "affected_ref": "candidate-spec.subscription-payment",
                        },
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(
            body["error"],
            (
                "provide_candidate_context requires answer_value.text or "
                "substantive structured context"
            ),
        )
        self.assertFalse((state_dir / "idea_to_spec_repair_drafts.json").exists())

    def test_idea_to_spec_workspace_v1_projects_product_repair_targets(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_repair_draft_workspace_runs(runs_dir)
            request_id = _append_product_repair_request(runs_dir)
            httpd, thread, base = _start(root / "dialogs", runs_dir=runs_dir)
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-workspace?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        targets = body["repair_review"]["clarification_requests"]["repair_targets"]
        target = [item for item in targets if item["request_id"] == request_id][0]
        self.assertEqual(target["kind"], "missing_enforcement_mechanism")
        self.assertEqual(target["label"], "Enforcement mechanism")
        self.assertEqual(target["expected_effect"], "enforcement_mechanism_added")
        self.assertEqual(
            target["accepted_actions"],
            ["answer_question", "provide_candidate_context", "reject", "defer"],
        )

    def test_idea_to_spec_repair_drafts_v1_preserves_answer_question_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            request_id = _append_product_repair_request(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": request_id,
                        "action": "answer_question",
                        "answer_value": {
                            "text": "Payments require amount, currency, due date, and paid state.",
                            "affected_ref": "candidate-spec.subscription-payment",
                        },
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        draft = body["drafts"][0]
        self.assertEqual(draft["allowed_action"], "answer_question")
        self.assertEqual(
            draft["answer_value"]["text"],
            "Payments require amount, currency, due date, and paid state.",
        )
        self.assertEqual(
            draft["answer_value"]["affected_ref"],
            "candidate-spec.subscription-payment",
        )

    def test_idea_to_spec_repair_drafts_v1_rejects_product_context_authority_claim(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            request_id = _append_product_repair_request(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": request_id,
                        "action": "provide_candidate_context",
                        "answer_value": {
                            "mechanism": "Apply this directly.",
                            "may_apply_state": True,
                        },
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(
            body["error"],
            "repair draft answer_value cannot claim may_apply_state",
        )
        self.assertFalse((state_dir / "idea_to_spec_repair_drafts.json").exists())

    def test_idea_to_spec_repair_drafts_v1_accepts_normalized_workspace_alias(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team_decision_log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["selected_workspace_id"], "team-decision-log")
        self.assertEqual(body["drafts"][0]["workspace_id"], "team-decision-log")

    def test_idea_to_spec_repair_drafts_v1_preserves_concurrent_draft_posts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_secondary_request=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            url = f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log"
            payloads = [
                {
                    "workspace_id": "team-decision-log",
                    "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                    "action": "propose_project_local_term",
                    "answer_value": {"terms": ["Decision Record"]},
                },
                {
                    "workspace_id": "team-decision-log",
                    "request_id": "clarification.candidate-gap.ontology-gap-decision-owner",
                    "action": "propose_project_local_term",
                    "answer_value": {"terms": ["Decision Owner"]},
                },
            ]
            try:
                with ThreadPoolExecutor(max_workers=2) as pool:
                    results = list(pool.map(lambda payload: _post(url, payload), payloads))
                get_status, get_body = _get(url)
            finally:
                _stop(httpd, thread)

        self.assertEqual([status for status, _body in results], [200, 200])
        self.assertEqual(get_status, 200)
        self.assertEqual(get_body["summary"]["draft_count"], 2)
        draft_terms = {
            draft["request_id"]: draft["answer_value"]["terms"]
            for draft in get_body["drafts"]
        }
        self.assertEqual(
            draft_terms,
            {
                "clarification.candidate-gap.ontology-gap-decision-record": [
                    "Decision Record"
                ],
                "clarification.candidate-gap.ontology-gap-decision-owner": [
                    "Decision Owner"
                ],
            },
        )

    def test_idea_to_spec_repair_drafts_v1_skips_stored_bind_without_term(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_json(
                state_dir / "idea_to_spec_repair_drafts.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_draft_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "for_product_repair_workflow": True,
                        "may_apply_to_specgraph": False,
                    },
                    "authority_boundary": {
                        "repair_draft_state_is_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "drafts": [
                        {
                            "workspace_id": "team-decision-log",
                            "candidate_id": "team-decision-log",
                            "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                            "allowed_action": "bind_existing_term",
                            "answer_value": {
                                "ontology_ref": "ontology://specgraph-core/classes/Spec"
                            },
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["draft_count"], 0)
        self.assertEqual(body["drafts"], [])

    def test_idea_to_spec_repair_drafts_v1_rejects_unknown_request(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "request_id": "clarification.unknown",
                        "action": "defer",
                        "answer_value": {"reason": "needs review"},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 404)
        self.assertEqual(body["request_id"], "clarification.unknown")
        self.assertFalse((state_dir / "idea_to_spec_repair_drafts.json").exists())

    def test_idea_to_spec_repair_drafts_v1_rejects_disallowed_action(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "apply_to_specgraph",
                        "answer_value": {"text": "do it"},
                    },
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertIn("not allowed", body["error"])
        self.assertIn("propose_project_local_term", body["allowed_actions"])
        self.assertFalse((state_dir / "idea_to_spec_repair_drafts.json").exists())

    def test_idea_to_spec_repair_drafts_v1_rejects_mutation_claims(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_json(
                state_dir / "idea_to_spec_repair_drafts.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_draft_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "for_product_repair_workflow": True,
                        "may_apply_to_specgraph": False,
                    },
                    "authority_boundary": {
                        "repair_draft_state_is_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "drafts": [
                        {
                            "workspace_id": "team-decision-log",
                            "candidate_id": "team-decision-log",
                            "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                            "allowed_action": "propose_project_local_term",
                            "answer_value": {"terms": ["Decision Record"]},
                            "applies_to_specgraph": True,
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertIn("applies_to_specgraph", body["error"])

    def test_idea_to_spec_repair_rerun_requests_v1_reads_empty_specspace_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_idea_to_spec_repair_rerun_request_state",
        )
        self.assertEqual(body["selected_workspace_id"], "team-decision-log")
        self.assertEqual(body["summary"]["request_count"], 0)
        self.assertEqual(body["workflow_status"]["import_preview_status"], "missing")
        self.assertFalse(body["consumer_boundary"]["may_execute_specgraph"])
        self.assertFalse(
            body["authority_boundary"]["rerun_request_state_is_authority"]
        )
        self.assertFalse(
            (state_dir / "idea_to_spec_repair_rerun_requests.json").exists()
        )

    def test_idea_to_spec_repair_rerun_requests_v1_posts_request_intent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir, include_import_preview=True)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                draft_status, _draft_body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "requested_action": "prepare_repair_draft_rerun",
                        "operator_ref": "operator://workspace-owner",
                    },
                )
                get_status, get_body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)
            state_path = state_dir / "idea_to_spec_repair_rerun_requests.json"
            state_exists = state_path.exists()

        self.assertEqual(draft_status, 200)
        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["active_request_count"], 1)
        self.assertEqual(get_status, 200)
        request = get_body["requests"][0]
        self.assertEqual(request["requested_action"], "prepare_repair_draft_rerun")
        self.assertEqual(request["workspace_id"], "team-decision-log")
        self.assertEqual(request["candidate_id"], "team-decision-log")
        self.assertEqual(
            request["import_preview_ref"],
            "runs/specspace_repair_draft_import_preview.json",
        )
        self.assertIn(
            "make product-workspace-repair-draft-rerun",
            request["operator_command"],
        )
        self.assertFalse(request["may_execute_specgraph"])
        self.assertFalse(request["may_create_branch_or_commit"])
        self.assertEqual(get_body["workflow_status"]["drafts_saved"], True)
        self.assertEqual(get_body["workflow_status"]["import_preview_status"], "ready")
        self.assertEqual(get_body["workflow_status"]["rerun_status"], "not_prepared")
        self.assertEqual(get_body["workflow_status"]["latest_journal_state"], "fresh")
        self.assertTrue(state_exists)

    def test_idea_to_spec_repair_rerun_requests_v1_reports_prepared_rerun(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=True,
                include_rerun_report=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log",
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["workflow_status"]["rerun_status"], "prepared")

    def test_idea_to_spec_repair_rerun_requests_v1_disables_zero_accepted_preview(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=True,
                accepted_for_rerun_count=0,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
                get_status, get_body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log"
                )
                post_status, post_body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log",
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(get_status, 200)
        self.assertEqual(get_body["workflow_status"]["accepted_for_rerun_count"], 0)
        self.assertFalse(get_body["workflow_status"]["request_ready"])
        self.assertEqual(post_status, 409)
        self.assertEqual(post_body["reason"], "accepted_draft_imports_missing")

    def test_idea_to_spec_repair_rerun_requests_v1_clamps_negative_accepted_preview(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=True,
                accepted_for_rerun_count=-2,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                get_status, get_body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(get_status, 200)
        self.assertEqual(get_body["workflow_status"]["accepted_for_rerun_count"], 0)
        self.assertFalse(get_body["workflow_status"]["request_ready"])

    def test_idea_to_spec_repair_rerun_requests_v1_rejects_stale_drafts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir, include_import_preview=True)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                draft_status, _draft_body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
                state_path = state_dir / "idea_to_spec_repair_drafts.json"
                draft_state = json.loads(state_path.read_text(encoding="utf-8"))
                draft_state["drafts"][0]["repair_session_id"] = "repair-session.old"
                draft_state["drafts"][0]["repair_session_ref"] = "runs/old_repair_session.json"
                state_path.write_text(
                    json.dumps(draft_state, indent=2, sort_keys=True) + "\n",
                    encoding="utf-8",
                )
                get_status, get_body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log"
                )
                post_status, post_body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log",
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(draft_status, 200)
        self.assertEqual(get_status, 200)
        self.assertEqual(get_body["workflow_status"]["draft_count"], 0)
        self.assertFalse(get_body["workflow_status"]["request_ready"])
        self.assertEqual(post_status, 409)
        self.assertEqual(post_body["reason"], "repair_drafts_stale")

    def test_idea_to_spec_repair_rerun_requests_v1_generates_unique_ids(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir, include_import_preview=True)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
                with mock.patch.object(
                    idea_to_spec_repair_rerun_requests,
                    "now_iso",
                    return_value="2026-06-26T10:00:00Z",
                ):
                    first_status, first_body = _post(
                        f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log",
                        {"workspace_id": "team-decision-log"},
                    )
                    second_status, second_body = _post(
                        f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log",
                        {"workspace_id": "team-decision-log"},
                    )
            finally:
                _stop(httpd, thread)

        self.assertEqual(first_status, 200)
        self.assertEqual(second_status, 200)
        request_ids = [request["id"] for request in second_body["requests"]]
        self.assertEqual(len(request_ids), 2)
        self.assertEqual(len(set(request_ids)), 2)
        active = [request for request in second_body["requests"] if request["status"] == "requested"]
        superseded = [
            request for request in second_body["requests"] if request["status"] == "superseded"
        ]
        self.assertEqual(len(active), 1)
        self.assertEqual(len(superseded), 1)
        self.assertNotEqual(first_body["requests"][0]["id"], active[0]["id"])
        self.assertNotEqual(superseded[0]["id"], superseded[0]["superseded_by"])
        self.assertEqual(superseded[0]["superseded_by"], active[0]["id"])

    def test_idea_to_spec_repair_rerun_requests_v1_rejects_missing_import_preview(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log",
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["reason"], "import_preview_missing")
        self.assertFalse(
            (state_dir / "idea_to_spec_repair_rerun_requests.json").exists()
        )

    def test_idea_to_spec_repair_rerun_requests_v1_rejects_unready_import_preview(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_import_preview=True,
                import_preview_ready=False,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                _post(
                    f"{base}/api/v1/idea-to-spec-repair-drafts?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "request_id": "clarification.candidate-gap.ontology-gap-decision-record",
                        "action": "propose_project_local_term",
                        "answer_value": {"terms": ["Decision Record"]},
                    },
                )
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log",
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(body["reason"], "import_preview_not_ready")

    def test_idea_to_spec_repair_rerun_requests_v1_rejects_mutation_claims(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_json(
                state_dir / "idea_to_spec_repair_rerun_requests.json",
                {
                    "artifact_kind": "specspace_idea_to_spec_repair_rerun_request_state",
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "for_product_repair_workflow": True,
                        "may_execute_specgraph": False,
                    },
                    "authority_boundary": {
                        "rerun_request_state_is_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "requests": [
                        {
                            "id": "repair-rerun-request.team-decision-log",
                            "status": "requested",
                            "requested_action": "prepare_repair_draft_rerun",
                            "workspace_id": "team-decision-log",
                            "candidate_id": "team-decision-log",
                            "may_execute_specgraph": True,
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-repair-rerun-requests?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertIn("may_execute_specgraph", body["error"])

    def test_idea_to_spec_candidate_approval_intents_v1_reads_empty_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["artifact_kind"],
            "specspace_idea_to_spec_candidate_approval_intent_state",
        )
        self.assertEqual(body["selected_workspace_id"], "team-decision-log")
        self.assertEqual(body["summary"]["intent_count"], 0)
        self.assertFalse(body["workflow_status"]["request_ready"])
        self.assertFalse(
            body["authority_boundary"]["candidate_approval_intent_state_is_authority"]
        )
        self.assertFalse(
            (
                state_dir
                / idea_to_spec_candidate_approval_intents.APPROVAL_INTENT_FILENAME
            ).exists()
        )

    def test_idea_to_spec_candidate_approval_intents_v1_posts_approval_intent(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                ready_for_candidate_approval=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "requested_action": "approve_candidate_for_promotion_review",
                        "operator_ref": "operator://workspace-owner",
                        "reason": "Review-ready candidate.",
                    },
                )
                get_status, get_body = _get(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log"
                )
                state_exists = (
                    state_dir
                    / idea_to_spec_candidate_approval_intents.APPROVAL_INTENT_FILENAME
                ).exists()
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["active_intent_count"], 1)
        self.assertEqual(get_status, 200)
        self.assertTrue(get_body["workflow_status"]["request_ready"])
        self.assertTrue(get_body["workflow_status"]["repair_session_ready"])
        self.assertEqual(
            get_body["workflow_status"]["platform_rerun_execution_status"],
            "successful",
        )
        self.assertEqual(
            get_body["workflow_status"]["platform_rerun_publication_status"],
            "published",
        )
        self.assertEqual(get_body["workflow_status"]["latest_journal_state"], "fresh")
        intent = get_body["intents"][0]
        self.assertEqual(
            intent["requested_action"], "approve_candidate_for_promotion_review"
        )
        self.assertEqual(intent["workspace_id"], "team-decision-log")
        self.assertEqual(intent["candidate_id"], "team-decision-log")
        self.assertEqual(intent["requested_by"], "operator://workspace-owner")
        self.assertEqual(intent["reason"], "Review-ready candidate.")
        self.assertFalse(intent["may_create_branch_or_commit"])
        self.assertFalse(intent["may_execute_git_service_operation"])
        self.assertFalse(intent["may_execute_prompt_agent"])
        self.assertFalse(intent["may_apply_to_specgraph"])
        self.assertFalse(intent["may_mark_candidate_accepted"])
        self.assertTrue(state_exists)

    def test_idea_to_spec_candidate_approval_intents_v1_posts_repaired_intent(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                ready_for_candidate_approval=False,
                include_repaired_handoff=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log",
                    {
                        "workspace_id": "team-decision-log",
                        "requested_action": "approve_candidate_for_promotion_review",
                        "operator_ref": "operator://workspace-owner",
                        "reason": "Review repaired candidate.",
                    },
                )
                get_status, get_body = _get(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["active_intent_count"], 1)
        self.assertEqual(get_status, 200)
        self.assertTrue(get_body["workflow_status"]["request_ready"])
        self.assertEqual(
            get_body["workflow_status"]["repair_session_ref"],
            "runs/repaired_idea_to_spec_repair_session.json",
        )
        self.assertEqual(
            get_body["workflow_status"]["promotion_gate_ref"],
            "runs/repaired_idea_to_spec_promotion_gate.json",
        )
        intent = get_body["intents"][0]
        self.assertEqual(
            intent["repair_session_ref"],
            "runs/repaired_idea_to_spec_repair_session.json",
        )
        self.assertEqual(
            intent["promotion_gate_ref"],
            "runs/repaired_idea_to_spec_promotion_gate.json",
        )
        self.assertEqual(intent["reason"], "Review repaired candidate.")

    def test_idea_to_spec_candidate_approval_intents_v1_rejects_unready_journal(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(runs_dir)
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                get_status, get_body = _get(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log"
                )
                post_status, post_body = _post(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log",
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(get_status, 200)
        self.assertFalse(get_body["workflow_status"]["request_ready"])
        self.assertIn(
            "candidate_not_ready_for_approval",
            get_body["workflow_status"]["blocked_by"],
        )
        self.assertEqual(post_status, 409)
        self.assertEqual(post_body["reason"], "candidate_approval_intent_not_ready")

    def test_idea_to_spec_candidate_approval_intents_v1_rejects_failed_platform_report(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                ready_for_candidate_approval=True,
                platform_reports_ok=False,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log",
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertIn(
            "platform_rerun_execution_not_successful",
            body["workflow_status"]["blocked_by"],
        )
        self.assertIn(
            "platform_rerun_publication_not_successful",
            body["workflow_status"]["blocked_by"],
        )

    def test_idea_to_spec_candidate_approval_intents_v1_requires_publication_after_execution(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            state_dir = root / "specspace-state"
            _write_repair_draft_workspace_runs(
                runs_dir,
                include_platform_rerun_reports=True,
                include_platform_publication_report=False,
                ready_for_candidate_approval=True,
            )
            httpd, thread, base = _start(
                root / "dialogs",
                runs_dir=runs_dir,
                specspace_state_dir=state_dir,
            )
            try:
                status, body = _post(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log",
                    {"workspace_id": "team-decision-log"},
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 409)
        self.assertEqual(
            body["workflow_status"]["platform_rerun_execution_status"],
            "successful",
        )
        self.assertEqual(
            body["workflow_status"]["platform_rerun_publication_status"],
            "missing",
        )
        self.assertIn(
            "platform_rerun_publication_not_successful",
            body["workflow_status"]["blocked_by"],
        )

    def test_idea_to_spec_candidate_approval_intents_v1_rejects_mutation_claims(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_json(
                state_dir
                / idea_to_spec_candidate_approval_intents.APPROVAL_INTENT_FILENAME,
                {
                    "artifact_kind": (
                        "specspace_idea_to_spec_candidate_approval_intent_state"
                    ),
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                        "may_create_branch_or_commit": True,
                    },
                    "authority_boundary": {
                        "candidate_approval_intent_state_is_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "intents": [],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 422)
        self.assertIn("may_create_branch_or_commit", body["error"])

    def test_idea_to_spec_candidate_approval_intents_v1_rejects_intent_authority_aliases(
        self,
    ) -> None:
        for field in (
            "may_execute_prompt_agent",
            "may_apply_to_specgraph",
            "may_mark_candidate_accepted",
        ):
            with self.subTest(field=field):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    state_dir = root / "specspace-state"
                    state_dir.mkdir()
                    _write_json(
                        state_dir
                        / idea_to_spec_candidate_approval_intents.APPROVAL_INTENT_FILENAME,
                        {
                            "artifact_kind": (
                                "specspace_idea_to_spec_candidate_approval_intent_state"
                            ),
                            "schema_version": 1,
                            "state_owner": "SpecSpace",
                            "canonical_mutations_allowed": False,
                            "tracked_artifacts_written": False,
                            "consumer_boundary": {
                                "specspace_owned_state": True,
                            },
                            "authority_boundary": {
                                "candidate_approval_intent_state_is_authority": False,
                                "canonical_mutations_allowed": False,
                            },
                            "intents": [
                                {
                                    "id": "candidate-approval-intent.team-decision-log.1",
                                    "status": "requested",
                                    "requested_action": "approve_candidate_for_promotion_review",
                                    "workspace_id": "team-decision-log",
                                    "candidate_id": "team-decision-log",
                                    "created_at": "2026-06-26T10:00:00Z",
                                    field: True,
                                }
                            ],
                        },
                    )
                    httpd, thread, base = _start(
                        root / "dialogs", specspace_state_dir=state_dir
                    )
                    try:
                        status, body = _get(
                            f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log"
                        )
                    finally:
                        _stop(httpd, thread)

                self.assertEqual(status, 422)
                self.assertIn(field, body["error"])

    def test_idea_to_spec_candidate_approval_intents_v1_rejects_authority_aliases(
        self,
    ) -> None:
        for field in (
            "approval_intent_state_is_authority",
            "candidate_approval_authority",
            "specgraph_execution_authority",
        ):
            with self.subTest(field=field):
                with tempfile.TemporaryDirectory() as tmp:
                    root = Path(tmp)
                    state_dir = root / "specspace-state"
                    state_dir.mkdir()
                    _write_json(
                        state_dir
                        / idea_to_spec_candidate_approval_intents.APPROVAL_INTENT_FILENAME,
                        {
                            "artifact_kind": (
                                "specspace_idea_to_spec_candidate_approval_intent_state"
                            ),
                            "schema_version": 1,
                            "state_owner": "SpecSpace",
                            "canonical_mutations_allowed": False,
                            "tracked_artifacts_written": False,
                            "consumer_boundary": {
                                "specspace_owned_state": True,
                            },
                            "authority_boundary": {
                                "candidate_approval_intent_state_is_authority": False,
                                "canonical_mutations_allowed": False,
                                field: True,
                            },
                            "intents": [],
                        },
                    )
                    httpd, thread, base = _start(
                        root / "dialogs", specspace_state_dir=state_dir
                    )
                    try:
                        status, body = _get(
                            f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log"
                        )
                    finally:
                        _stop(httpd, thread)

                self.assertEqual(status, 422)
                self.assertIn(field, body["error"])

    def test_idea_to_spec_candidate_approval_intents_v1_skips_malformed_intent_timestamp(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            state_dir = root / "specspace-state"
            state_dir.mkdir()
            _write_json(
                state_dir
                / idea_to_spec_candidate_approval_intents.APPROVAL_INTENT_FILENAME,
                {
                    "artifact_kind": (
                        "specspace_idea_to_spec_candidate_approval_intent_state"
                    ),
                    "schema_version": 1,
                    "state_owner": "SpecSpace",
                    "canonical_mutations_allowed": False,
                    "tracked_artifacts_written": False,
                    "consumer_boundary": {
                        "specspace_owned_state": True,
                    },
                    "authority_boundary": {
                        "candidate_approval_intent_state_is_authority": False,
                        "canonical_mutations_allowed": False,
                    },
                    "intents": [
                        {
                            "id": "candidate-approval-intent.team-decision-log.1",
                            "status": "requested",
                            "requested_action": "approve_candidate_for_promotion_review",
                            "workspace_id": "team-decision-log",
                            "candidate_id": "team-decision-log",
                        }
                    ],
                },
            )
            httpd, thread, base = _start(
                root / "dialogs", specspace_state_dir=state_dir
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/idea-to-spec-candidate-approval-intents?workspace=team-decision-log"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(body["summary"]["intent_count"], 0)

    def test_specpm_registry_v1_package_endpoint_requires_package_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(
                root / "dialogs", specpm_registry_url="https://example.invalid"
            )
            try:
                status, body = _get(f"{base}/api/v1/specpm/registry/packages/")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "Missing SpecPM package id in path.")

    def test_specpm_registry_v1_version_endpoint_requires_version(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(
                root / "dialogs", specpm_registry_url="https://example.invalid"
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/specpm/registry/packages/specnode.core/versions/"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(
            body["error"], "SpecPM package id and version are required in path."
        )

    def test_specpm_registry_v1_version_endpoint_requires_version_without_trailing_slash(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(
                root / "dialogs", specpm_registry_url="https://example.invalid"
            )
            try:
                status, body = _get(
                    f"{base}/api/v1/specpm/registry/packages/specnode.core/versions"
                )
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(
            body["error"], "SpecPM package id and version are required in path."
        )

    def test_specpm_registry_v1_rejects_dot_segment_package_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            httpd, thread, base = _start(
                root / "dialogs", specpm_registry_url="https://example.invalid"
            )
            try:
                status, body = _get(f"{base}/api/v1/specpm/registry/packages/%2E%2E")
            finally:
                _stop(httpd, thread)

        self.assertEqual(status, 400)
        self.assertEqual(
            body["error"], "SpecPM package id must not contain dot path segments."
        )

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
            "SPECSPACE_API_IMAGE_REF": "ghcr.io/0al-spec/specspace-api@sha256:"
            + "1" * 64,
            "SPECSPACE_UI_IMAGE_REF": "ghcr.io/0al-spec/specspace-ui@sha256:"
            + "2" * 64,
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
                httpd, thread, base = _start(
                    root / "dialogs", spec_dir=spec_dir, runs_dir=runs_dir
                )
                try:
                    status, body = _get(f"{base}/api/v1/health")
                finally:
                    _stop(httpd, thread)

        self.assertEqual(status, 200)
        self.assertEqual(
            body["deployment"],
            {
                "version": "0.0.7",
                "commit": "c05f17df6bd3ae338f98a4694561d640bcfda6d1",
                "created_at": "2026-05-16T16:16:38Z",
                "api_image_ref": "ghcr.io/0al-spec/specspace-api@sha256:" + "1" * 64,
                "ui_image_ref": "ghcr.io/0al-spec/specspace-ui@sha256:" + "2" * 64,
            },
        )

    def test_spec_graph_v1_returns_existing_graph_contract_with_version_metadata(
        self,
    ) -> None:
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
                status, body = _get(
                    f"{base}/api/v1/spec-markdown?root={quote('SG-SPEC-0001')}&depth=2"
                )
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
        self.assertEqual(
            body["manifest"]["nodes_included"], ["SG-SPEC-0001", "SG-SPEC-0002"]
        )
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

    def test_capabilities_v1_distinguishes_markdown_export_from_hyperprompt_compile(
        self,
    ) -> None:
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
        self.assertEqual(
            body["diagnostics"]["spec_markdown_export"]["status"], "available"
        )
        self.assertEqual(
            body["diagnostics"]["hyperprompt_compile"]["status"], "compiler_missing"
        )

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
        self.assertEqual(
            body["diagnostics"]["hyperprompt_compile"]["status"], "available"
        )
        self.assertEqual(
            body["diagnostics"]["hyperprompt_compile"]["resolved_binary"], str(binary)
        )

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
                (stale / ".specspace-hyperprompt-bundle").write_text(
                    "old\n", encoding="utf-8"
                )
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
                root_hc_text = (
                    Path(body["compile"]["root_hc"]).read_text(encoding="utf-8")
                    if status == 200
                    else ""
                )
                export_manifest_data = (
                    json.loads(
                        Path(body["compile"]["export_manifest"]).read_text(
                            encoding="utf-8"
                        )
                    )
                    if status == 200
                    else {}
                )
                owned_bundle_count = len(
                    [
                        path
                        for path in scratch.iterdir()
                        if path.is_dir()
                        and path.name.startswith("specspace-")
                        and (path / ".specspace-hyperprompt-bundle").is_file()
                    ]
                )
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
        self.assertIn(
            "# Compiled SpecSpace export", body["compile"]["compiled_markdown"]
        )
        self.assertEqual(body["compile"]["compiler_manifest"], {"compiled": True})
        root_hc = Path(body["compile"]["root_hc"])
        export_manifest = Path(body["compile"]["export_manifest"])
        self.assertTrue(root_hc.is_relative_to(scratch))
        self.assertTrue(export_manifest.is_relative_to(scratch))
        self.assertIn('"export.md"', root_hc_text)
        self.assertEqual(export_manifest_data["root_id"], "SG-SPEC-0001")
        self.assertLessEqual(owned_bundle_count, 20)

    def test_spec_markdown_compile_v1_returns_capability_diagnostic_when_disabled(
        self,
    ) -> None:
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
        self.assertEqual(
            capabilities["diagnostics"]["hyperprompt_compile"]["status"], "available"
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["source"]["artifact_base_url"], artifact_base_url)
        self.assertEqual(body["scope"], "subtree")
        self.assertEqual(body["export"]["manifest"]["scope"], "subtree")
        self.assertEqual(body["compile"]["exit_code"], 0)
        self.assertEqual(body["compile"]["timeout_seconds"], 5)
        self.assertIn(
            "# Compiled SpecSpace export", body["compile"]["compiled_markdown"]
        )
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
        self.assertEqual(
            body["diagnostic"]["limit_error"]["field"],
            "hyperprompt_compile_timeout_seconds",
        )

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
                status, body = _get(
                    f"{base}/api/v1/spec-markdown?root=SG-SPEC-0001&depth=deep"
                )
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
                status, body = _get(
                    f"{base}/api/v1/spec-markdown?root=SG-SPEC-0001&scope=wide"
                )
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
            (spec_dir / "SG-SPEC-0001.yaml").write_text(
                "- not\n- a\n- mapping\n", encoding="utf-8"
            )
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
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base_url
            )
            try:
                health_status, health = _get(f"{base}/api/v1/health")
                graph_status, graph = _get(f"{base}/api/v1/spec-graph")
                node_status, node = _get(
                    f"{base}/api/v1/spec-nodes/{quote('SG-SPEC-0001')}"
                )
                markdown_status, markdown = _get(
                    f"{base}/api/v1/spec-markdown?root={quote('SG-SPEC-0001')}"
                )
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
        self.assertIn(
            "# Agent Context Bridge",
            proposals["entries"][0]["markdown"]["content_body"],
        )
        self.assertEqual(proposals["entries"][0]["affected_spec_ids"], ["SG-SPEC-0001"])
        self.assertEqual(ontology_status, 200)
        self.assertEqual(ontology["source"]["provider"], "http")
        self.assertFalse(
            ontology["authority_boundary"]["practical_ontology_is_authority"]
        )
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
            httpd, thread, base = _start(
                root / "dialogs", artifact_base_url=artifact_base_url
            )
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
            capabilities["diagnostics"]["agent_workbench_conversations"]["source"][
                "status"
            ],
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
            shutil.copyfile(
                AGENT_WORKBENCH_FIXTURES / "index-v1.json", conversations / "index.json"
            )
            shutil.copyfile(
                AGENT_WORKBENCH_FIXTURES / "conversation-v1.json",
                conversations / "awb-conv-0001.json",
            )
            httpd, thread, base = _start(
                root / "dialogs", agent_workbench_dir=workbench
            )
            try:
                index_status, index = _get(
                    f"{base}/api/v1/agent-workbench/conversations"
                )
                conversation_status, conversation = _get(
                    f"{base}/api/v1/agent-workbench/conversations/awb-conv-0001",
                )
                capabilities_status, capabilities = _get(f"{base}/api/v1/capabilities")
            finally:
                _stop(httpd, thread)

        self.assertEqual(index_status, 200)
        self.assertEqual(index["source"]["status"], "ok")
        self.assertEqual(
            index["data"]["artifact_kind"], "specspace_agent_conversation_index"
        )
        self.assertEqual(index["data"]["entry_count"], 1)
        self.assertEqual(conversation_status, 200)
        self.assertEqual(conversation["conversation_id"], "awb-conv-0001")
        self.assertEqual(
            conversation["data"]["artifact_kind"], "specspace_agent_conversation"
        )
        self.assertEqual(capabilities_status, 200)
        self.assertTrue(capabilities["capabilities"]["agent_workbench_conversations"])
        self.assertFalse(capabilities["capabilities"]["agent_workbench_writes"])


if __name__ == "__main__":
    unittest.main()
