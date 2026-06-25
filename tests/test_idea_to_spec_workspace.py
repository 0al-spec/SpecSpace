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


def _candidate_seed() -> dict:
    return {
        "artifact_kind": "candidate_spec_graph_seed",
        "schema_version": 1,
        "contract_ref": "specgraph.idea-to-spec.candidate-spec-graph-seed.v0.1",
        "source_ref": "product://demo-calculator/candidate-spec-graph-seed",
        "candidate_graph": {"nodes": [], "edges": []},
        "source_generation": {
            "artifact_kind": "ontology_bound_candidate_graph_seed_generation",
            "schema_version": 1,
            "proposal_id": "0159",
            "contract_ref": (
                "specgraph.idea-to-spec.ontology-bound-candidate-graph-seed.v0.1"
            ),
            "ontology": {
                "id": "org.0al.specgraph.core",
                "namespace": "sgcore",
                "version": "0.1.0",
                "source_ref": (
                    "ontology/packages/specgraph-core/generated/"
                    "ontology.normalized.json"
                ),
                "source_digest": "sha256:fixture",
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
                    "reason": "Candidate product boundary maps to a proposed Spec.",
                },
                {
                    "term": "Node",
                    "ontology_ref": (
                        "ontology://org.0al.specgraph.core/0.1.0/classes/Node"
                    ),
                    "binding_kind": "core_type",
                    "authority": "ontology_ir",
                    "reason": (
                        "Each generated candidate item is represented as a "
                        "SpecGraph node."
                    ),
                },
                {
                    "term": "Requirement",
                    "ontology_ref": (
                        "ontology://org.0al.specgraph.core/0.1.0/classes/"
                        "Requirement"
                    ),
                    "binding_kind": "core_type",
                    "authority": "ontology_ir",
                    "reason": "Commands and constraints become proposed requirements.",
                },
                {
                    "term": "AcceptanceCriterion",
                    "ontology_ref": (
                        "ontology://org.0al.specgraph.core/0.1.0/classes/"
                        "AcceptanceCriterion"
                    ),
                    "binding_kind": "core_type",
                    "authority": "ontology_ir",
                    "reason": (
                        "Each requirement carries reviewable acceptance criteria."
                    ),
                },
                {
                    "term": "Constraint",
                    "ontology_ref": (
                        "ontology://org.0al.specgraph.core/0.1.0/classes/"
                        "Constraint"
                    ),
                    "binding_kind": "core_type",
                    "authority": "ontology_ir",
                    "reason": (
                        "Event-storming constraints and policies remain "
                        "constraint-shaped nodes."
                    ),
                },
            ],
            "ontology_gaps": [
                {
                    "id": "ontology-gap.numeric-input",
                    "kind": "ontology_gap",
                    "term": "Numeric Input",
                    "source_ref": "command.enter_digit",
                    "source_kind": "command",
                    "suggested_action": "confirm_bind_or_promote_domain_term",
                    "blocks_candidate_graph": False,
                    "statement": (
                        "Confirm whether `Numeric Input` should bind to an "
                        "existing ontology term or remain a project-local domain term."
                    ),
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
                "ontology_binding_count": 5,
                "ontology_gap_count": 1,
                "finding_count": 0,
            },
        },
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


def _clarification_requests() -> dict:
    return {
        "artifact_kind": "idea_to_spec_clarification_requests",
        "schema_version": 1,
        "proposal_id": "0163",
        "contract_ref": "specgraph.idea-to-spec.clarification-requests.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": False,
            "review_state": "clarification_required",
            "blocked_by": ["clarification.candidate-gap.ontology-gap-numeric-input"],
        },
        "clarification_requests": [
            {
                "id": "clarification.candidate-gap.ontology-gap-numeric-input",
                "kind": "ontology_gap",
                "severity": "review_required",
                "status": "open",
                "target_ref": "candidate-spec.numeric-input.gaps.ontology-gap.numeric-input",
                "question": "Should Numeric Input bind, alias, remain local, or be rejected?",
                "suggested_actions": [
                    "bind_existing_term",
                    "alias",
                    "propose_project_local_term",
                    "reject",
                    "defer",
                ],
            }
        ],
        "request_counts": {
            "total": 1,
            "by_kind": {"ontology_gap": 1},
            "by_status": {"open": 1},
        },
    }


def _clarification_answers() -> dict:
    return {
        "artifact_kind": "idea_to_spec_clarification_answers",
        "schema_version": 1,
        "proposal_id": "0164",
        "contract_ref": "specgraph.idea-to-spec.clarification-answers.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": True,
            "review_state": "answers_ready_for_rerun",
            "blocked_by": [],
        },
        "answers": [
            {
                "request_id": "clarification.candidate-gap.ontology-gap-numeric-input",
                "answer_kind": "propose_project_local_term",
                "status": "accepted_for_candidate",
                "authority": "operator_approved",
                "request_snapshot": {
                    "kind": "ontology_gap",
                    "target_artifact": "runs/candidate_spec_graph.json",
                    "target_ref": "candidate-spec.numeric-input.gaps.ontology-gap.numeric-input",
                },
                "value": {"terms": ["Numeric Input"], "term_scope": "project_local"},
            }
        ],
        "unresolved_blocking_requests": [],
        "summary": {
            "status": "answers_ready_for_rerun",
            "answer_count": 1,
            "accepted_answer_count": 1,
            "unresolved_blocking_count": 0,
        },
    }


def _ontology_decisions() -> dict:
    return {
        "artifact_kind": "product_ontology_gap_review_decisions",
        "schema_version": 1,
        "proposal_id": "0168",
        "contract_ref": "specgraph.product-ontology.gap-review-decisions.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": True,
            "review_state": "ontology_gap_decisions_ready",
            "blocked_by": [],
        },
        "decisions": [
            {
                "id": "product-ontology-decision.numeric-input.0",
                "decision_type": "propose_project_local_term",
                "status": "accepted_for_candidate_preview",
                "term": "Numeric Input",
                "term_scope": "project_local",
                "request_id": "clarification.candidate-gap.ontology-gap-numeric-input",
                "target_ref": "candidate-spec.numeric-input.gaps.ontology-gap.numeric-input",
                "materialization_intent": "rerun_overlay_only",
            }
        ],
        "summary": {
            "status": "ontology_gap_decisions_ready",
            "decision_count": 1,
            "decision_counts": {"propose_project_local_term": 1},
        },
    }


def _rerun_input() -> dict:
    return {
        "artifact_kind": "idea_to_spec_answer_rerun_input",
        "schema_version": 1,
        "proposal_id": "0169",
        "contract_ref": "specgraph.idea-to-spec.answer-rerun-input.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": True,
            "review_state": "rerun_input_ready",
            "blocked_by": [],
        },
        "rerun_input_overlay": {
            "ontology_review_hints": {
                "term_bindings": [],
                "aliases": [],
                "project_local_terms": [
                    {
                        "term": "Numeric Input",
                        "term_scope": "project_local",
                        "decision_id": "product-ontology-decision.numeric-input.0",
                    }
                ],
                "rejected_terms": [],
                "deferred_terms": [],
            }
        },
        "summary": {
            "status": "rerun_input_ready",
            "ontology_decision_source": "product_ontology_gap_review_decisions",
            "ontology_decision_count": 1,
            "project_local_term_count": 1,
        },
    }


def _rerun_preview() -> dict:
    return {
        "artifact_kind": "idea_to_spec_rerun_preview",
        "schema_version": 1,
        "proposal_id": "0169",
        "contract_ref": "specgraph.idea-to-spec.rerun-preview.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": True,
            "review_state": "rerun_preview_ready",
            "blocked_by": [],
        },
        "rerun_preview": {
            "ontology_gap_preview": {
                "resolved_ontology_gap_count": 1,
                "unresolved_ontology_gap_count": 0,
                "resolved_ontology_gaps": [
                    {
                        "gap_id": "ontology-gap.numeric-input",
                        "node_id": "candidate-spec.numeric-input",
                        "term": "Numeric Input",
                        "source_ref": "command.enter_digit",
                        "resolution_preview": {
                            "decision": "project_local_term",
                            "target_ref": "candidate-spec.numeric-input.gaps.ontology-gap.numeric-input",
                        },
                    }
                ],
            },
            "candidate_quality_preview": {
                "review_state": "candidate_quality_improved",
                "ontology_gap_state": "all_preview_resolved",
                "resolved_ontology_gap_count": 1,
                "unresolved_ontology_gap_count": 0,
            },
        },
        "summary": {
            "status": "rerun_preview_ready",
            "resolved_ontology_gap_count": 1,
            "unresolved_ontology_gap_count": 0,
            "candidate_quality_review_state": "candidate_quality_improved",
        },
    }


def _rerun_materialization() -> dict:
    return {
        "artifact_kind": "idea_to_spec_rerun_materialization",
        "schema_version": 1,
        "proposal_id": "0167",
        "contract_ref": "specgraph.idea-to-spec.rerun-materialization.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": True,
            "review_state": "rerun_materialization_ready",
            "blocked_by": [],
        },
        "materialization_preview": {
            "delta": {
                "removed_gap_ids": ["ontology-gap.numeric-input"],
                "unresolved_ontology_gap_ids": [],
                "resolved_ontology_gap_count": 1,
                "unresolved_ontology_gap_count": 0,
            }
        },
        "summary": {
            "status": "rerun_materialization_ready",
            "resolved_ontology_gap_count": 1,
            "unresolved_ontology_gap_count": 0,
            "removed_gap_count": 1,
        },
    }


def _materialization() -> dict:
    return {
        "artifact_kind": "candidate_spec_materialization_report",
        "schema_version": 1,
        "proposal_id": "0153",
        "contract_ref": "specgraph.idea-to-spec.candidate-spec-materialization.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": True,
            "review_state": "materialized_candidate_review_ready",
            "next_artifact": "Platform graph-repository promotion-request",
        },
        "materialization_source": "repair_loop_preview",
        "materialized_files": [
            {
                "candidate_node_id": "candidate-spec.calculator-product",
                "materialized_id": "CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT",
                "path": "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT.yaml",
                "promotion_path": "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT.yaml",
            },
            {
                "candidate_node_id": "candidate-spec.numeric-input",
                "materialized_id": "CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT",
                "path": "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT.yaml",
                "promotion_path": "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT.yaml",
            },
        ],
        "promotion_request": {
            "path_argument": "--path",
            "paths": [
                "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT.yaml",
                "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT.yaml",
            ],
            "platform_artifact_kind": "platform_graph_repository_promotion_request",
        },
        "summary": {
            "status": "materialized_candidate_review_ready",
            "materialized_file_count": 2,
            "candidate_node_count": 2,
            "finding_count": 0,
        },
    }


def _promotion_gate() -> dict:
    return {
        "artifact_kind": "idea_to_spec_promotion_gate",
        "schema_version": 1,
        "proposal_id": "0154",
        "contract_ref": "specgraph.idea-to-spec.promotion-gate.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": False,
            "review_state": "idea_to_spec_promotion_blocked",
            "blocked_by": ["repair_context_required"],
            "next_artifact": "owner/operator repair before promotion",
        },
        "metric_snapshot": {
            "pre_sib": {"ontology_coverage_ratio": 0.5},
            "materialized_file_count": 2,
            "promotion_path_count": 0,
        },
        "promotion_request": {
            "path_argument": "--path",
            "paths": [],
            "platform_artifact_kind": "platform_graph_repository_promotion_request",
        },
        "findings": [
            {
                "finding_id": "repair_context_required",
                "severity": "review_required",
                "message": "Owner/operator context is still required.",
                "source": "idea_to_spec_promotion_gate",
            }
        ],
        "warnings": [],
        "summary": {
            "status": "idea_to_spec_promotion_blocked",
            "finding_count": 1,
            "warning_count": 0,
            "promotion_path_count": 0,
            "materialized_file_count": 2,
        },
    }


def _platform_promotion_request() -> dict:
    return {
        "artifact_kind": "platform_graph_repository_promotion_request",
        "schema_version": 1,
        "generated_at": "2026-06-21T00:00:00Z",
        "plan_ref": "runs/graph_repository_execution_plan.json",
        "ok": True,
        "dry_run": False,
        "candidate_id": "idea-alpha",
        "candidate_branch": "graph-candidate/idea-alpha",
        "commit_paths": [
            "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT.yaml",
            "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT.yaml",
        ],
        "review": {
            "title": "Add candidate spec graph",
            "body": "Review materialized candidate graph.",
            "base_branch": "main",
        },
        "requested_operations": [
            "prepare_branch",
            "create_commit",
            "open_review",
        ],
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "write_actions_executed": [],
        "git_commands_executed": [],
        "pull_requests_opened": [],
        "merges_performed": [],
        "read_models_published": [],
        "authority_boundary": {
            "executes_git_commands": False,
            "creates_commits": False,
            "opens_pull_requests": False,
            "merges_pull_requests": False,
            "writes_ontology_packages": False,
            "mutates_canonical_specs": False,
            "publishes_read_models": False,
        },
        "summary": {
            "error_count": 0,
            "commit_path_count": 2,
            "promotion_ready": True,
        },
    }


def _candidate_approval_decision() -> dict:
    return {
        "artifact_kind": "candidate_approval_decision",
        "schema_version": 1,
        "proposal_id": "0157",
        "contract_ref": "specgraph.idea-to-spec.candidate-approval-decision.v0.1",
        "canonical_mutations_allowed": False,
        "ontology_writes_allowed": False,
        "tracked_artifacts_written": False,
        "workspace": {
            "workspace_id": "team-decision-log",
            "mode": "product_idea_to_spec",
            "repository_role": "product_spec_workspace",
            "public_route": "/team-decision-log",
        },
        "candidate": {
            "candidate_id": "idea-alpha",
            "display_name": "Team Decision Log",
            "active_candidate_ref": "runs/active_idea_to_spec_candidate.json",
            "promotion_gate_ref": "runs/idea_to_spec_promotion_gate.json",
        },
        "decision": {
            "requested_state": "approved",
            "state": "approved",
            "operator_ref": "operator://workspace-owner",
            "reason": "Approve review-ready product workspace candidate.",
            "conditions": [],
        },
        "readiness": {
            "ready": True,
            "review_state": "candidate_approval_ready",
            "blocked_by": [],
            "next_artifact": "Platform graph-repository promotion-request",
        },
        "promotion_request": {
            "platform_artifact_kind": "platform_graph_repository_promotion_request",
            "paths": [
                "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT.yaml",
                "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT.yaml",
            ],
            "requires_git_service_execution": True,
        },
        "authority_boundary": {
            "may_execute_prompt_agent": False,
            "may_mutate_candidate_source_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_write_ontology_lockfile": False,
            "may_mark_candidate_graph_accepted": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
            "may_publish_read_model": False,
        },
    }


def _git_service_execution() -> dict:
    return {
        "artifact_kind": "platform_git_service_promotion_execution_report",
        "schema_version": 1,
        "generated_at": "2026-06-21T00:00:00Z",
        "contract_ref": "git-service-operation-contract.example.json",
        "promotion_request_ref": "runs/graph_repository_promotion_request.json",
        "ok": True,
        "dry_run": False,
        "open_review_dry_run": True,
        "candidate_id": "idea-alpha",
        "candidate_ref": "graph-candidate/idea-alpha",
        "repository_dir": "../SpecGraph",
        "workspace_dir": ".platform/candidates/idea-alpha-worktree",
        "materialized_source_dir": "runs/materialized_candidate_specs",
        "copied_materialized_files": [
            {
                "source": "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT.yaml",
                "target": ".platform/candidates/idea-alpha-worktree/runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT.yaml",
            }
        ],
        "operations": [
            {
                "name": "prepare_worktree",
                "status": "succeeded",
                "request_artifact_kind": "platform_git_service_prepare_worktree_request",
                "response_artifact_kind": "platform_git_service_prepare_worktree_response",
                "report_ref": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_worktree_prepare_report.json",
                "diagnostics": [],
            },
            {
                "name": "commit_candidate",
                "status": "succeeded",
                "request_artifact_kind": "platform_git_service_commit_candidate_request",
                "response_artifact_kind": "platform_git_service_commit_candidate_response",
                "report_ref": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_review_commit_report.json",
                "diagnostics": [],
            },
            {
                "name": "open_review",
                "status": "dry_run",
                "request_artifact_kind": "platform_git_service_open_review_request",
                "response_artifact_kind": "platform_git_service_open_review_response",
                "report_ref": None,
                "diagnostics": [],
            },
        ],
        "adapter_command_results": [],
        "report_refs": {
            "prepare_worktree": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_worktree_prepare_report.json",
            "commit_candidate": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_review_commit_report.json",
        },
        "authority_boundary": {
            "specspace_direct_git_write": False,
            "canonical_spec_mutation_without_review": False,
            "ontology_package_write": False,
            "auto_merge": False,
            "private_artifact_publication": False,
        },
        "diagnostics": [],
        "summary": {
            "error_count": 0,
            "operation_count": 3,
            "completed_operation_count": 3,
        },
    }


def _review_status(review_state: str = "open") -> dict:
    return {
        "artifact_kind": "platform_graph_repository_review_status_report",
        "schema_version": 1,
        "ok": True,
        "review_url": "https://github.com/example/product/pull/12",
        "review_state": review_state,
        "review_decision": "APPROVED",
        "canonical_mutations_allowed": False,
        "canonical_tracked_artifacts_written": False,
        "merges_performed": [],
        "read_models_published": [],
        "authority_boundary": {
            "specspace_direct_git_write": False,
            "canonical_spec_mutation_without_review": False,
            "ontology_package_write": False,
            "auto_merge": False,
            "private_artifact_publication": False,
        },
        "diagnostics": [],
        "summary": {
            "review_merged": review_state == "merged",
        },
    }


def _read_model_publication(published: bool = False) -> dict:
    return {
        "artifact_kind": "platform_graph_repository_publish_read_model_report",
        "schema_version": 1,
        "ok": True,
        "dry_run": False,
        "review_state": "merged" if published else "open",
        "manifest": "published-read-model/artifact_manifest.json",
        "canonical_mutations_allowed": False,
        "canonical_tracked_artifacts_written": False,
        "ontology_packages_written": False,
        "merges_performed": [],
        "read_models_published": ["published-read-model/artifact_manifest.json"]
        if published
        else [],
        "authority_boundary": {
            "specspace_direct_git_write": False,
            "canonical_spec_mutation_without_review": False,
            "ontology_package_write": False,
            "auto_merge": False,
            "private_artifact_publication": False,
        },
        "diagnostics": [],
        "summary": {
            "error_count": 0,
            "file_count": 7 if published else 0,
            "published": published,
        },
    }


def _promotion_finalization(read_model_published: bool = False) -> dict:
    return {
        "artifact_kind": "platform_git_service_promotion_finalization_report",
        "schema_version": 1,
        "ok": True,
        "dry_run": False,
        "review_state": "merged" if read_model_published else "open",
        "canonical_mutations_allowed": False,
        "canonical_tracked_artifacts_written": False,
        "operations": [
            {
                "name": "review_status",
                "status": "succeeded",
                "request_artifact_kind": "platform_git_service_review_status_request",
                "response_artifact_kind": "platform_git_service_review_status_response",
                "report_ref": ".platform/graph_repository_review_status_report.json",
                "diagnostics": [],
            }
        ],
        "report_refs": {
            "review_status": ".platform/graph_repository_review_status_report.json"
        },
        "authority_boundary": {
            "specspace_direct_git_write": False,
            "canonical_spec_mutation_without_review": False,
            "ontology_package_write": False,
            "auto_merge": False,
            "private_artifact_publication": False,
        },
        "diagnostics": [],
        "summary": {
            "error_count": 0,
            "operation_count": 1,
            "completed_operation_count": 1,
            "read_model_published": read_model_published,
        },
    }


def _active_candidate() -> dict:
    return {
        "artifact_kind": "active_idea_to_spec_candidate",
        "schema_version": 1,
        "proposal_id": "0155",
        "contract_ref": "specgraph.idea-to-spec.active-candidate-source.v0.1",
        "canonical_mutations_allowed": False,
        "source_mode": "active_candidate",
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
            "next_artifact": "SpecSpace product workspace route",
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
    }


def _workspace_artifacts() -> dict[str, dict]:
    return {
        idea_to_spec_workspace.ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT: _active_candidate(),
        idea_to_spec_workspace.IDEA_EVENT_STORMING_INTAKE_ARTIFACT: _intake(),
        idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT: _candidate_seed(),
        idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_ARTIFACT: _candidate_graph(),
        idea_to_spec_workspace.PRE_SIB_COHERENCE_REPORT_ARTIFACT: _pre_sib(),
        idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: _repair_loop(),
        idea_to_spec_workspace.IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT: _clarification_requests(),
        idea_to_spec_workspace.IDEA_TO_SPEC_CLARIFICATION_ANSWERS_ARTIFACT: _clarification_answers(),
        idea_to_spec_workspace.PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT: _ontology_decisions(),
        idea_to_spec_workspace.IDEA_TO_SPEC_ANSWER_RERUN_INPUT_ARTIFACT: _rerun_input(),
        idea_to_spec_workspace.IDEA_TO_SPEC_RERUN_PREVIEW_ARTIFACT: _rerun_preview(),
        idea_to_spec_workspace.IDEA_TO_SPEC_RERUN_MATERIALIZATION_ARTIFACT: _rerun_materialization(),
        idea_to_spec_workspace.CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: _materialization(),
        idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: _promotion_gate(),
        idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT: _candidate_approval_decision(),
        idea_to_spec_workspace.GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT: _platform_promotion_request(),
        idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT: _git_service_execution(),
        idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT: _review_status(),
        idea_to_spec_workspace.GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT: _read_model_publication(),
        idea_to_spec_workspace.GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT: _promotion_finalization(),
    }


class IdeaToSpecWorkspaceTests(unittest.TestCase):
    def test_build_workspace_summarizes_candidate_graph_and_repairs(self) -> None:
        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=_workspace_artifacts(),
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["artifact_kind"], "specspace_idea_to_spec_workspace")
        self.assertEqual(body["workspace"]["id"], "team-decision-log")
        self.assertEqual(body["workspace"]["display_name"], "Team Decision Log")
        self.assertEqual(
            body["workspace"]["target_repository_role"],
            "product_spec_workspace",
        )
        self.assertTrue(body["workspace"]["ready"])
        self.assertEqual(body["summary"]["status"], "blocked")
        self.assertEqual(body["summary"]["candidate_node_count"], 2)
        self.assertEqual(body["summary"]["ontology_seed_gap_count"], 1)
        self.assertEqual(body["summary"]["ontology_seed_binding_count"], 5)
        self.assertEqual(body["summary"]["repair_action_count"], 1)
        self.assertEqual(body["summary"]["clarification_request_count"], 1)
        self.assertEqual(body["summary"]["ontology_decision_count"], 1)
        self.assertEqual(body["summary"]["resolved_ontology_gap_count"], 1)
        self.assertEqual(body["summary"]["unresolved_ontology_gap_count"], 0)
        self.assertEqual(body["summary"]["rerun_removed_gap_count"], 1)
        self.assertEqual(body["summary"]["materialized_file_count"], 2)
        self.assertEqual(body["summary"]["promotion_path_count"], 0)
        self.assertEqual(body["summary"]["promotion_gate_blocker_count"], 1)
        self.assertEqual(body["summary"]["platform_missing_artifact_count"], 0)
        self.assertEqual(body["summary"]["git_service_operation_count"], 3)
        self.assertEqual(body["summary"]["git_service_error_count"], 0)
        self.assertTrue(body["summary"]["approval_ready"])
        self.assertFalse(body["summary"]["review_merged"])
        self.assertFalse(body["summary"]["read_model_published"])
        self.assertEqual(body["workflow"]["stage"], "repair_required")
        self.assertEqual(body["workflow"]["status"], "blocked")
        self.assertEqual(len(body["workflow"]["items"]), 13)
        self.assertEqual(body["workflow"]["items"][2]["id"], "ontology_seed")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "operator_repair_review",
        )
        self.assertEqual(
            body["workflow"]["next_handoff"]["authority_boundary"],
            "operator_only",
        )
        self.assertEqual(body["intake"]["summary"]["actor_count"], 1)
        self.assertTrue(body["ontology_seed"]["readiness"]["ready"])
        self.assertEqual(
            body["ontology_seed"]["ontology"]["id"],
            "org.0al.specgraph.core",
        )
        self.assertEqual(
            body["ontology_seed"]["bindings"][0]["term"],
            "Spec",
        )
        self.assertEqual(
            body["ontology_seed"]["gaps"][0]["id"],
            "ontology-gap.numeric-input",
        )
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
            body["repair_review"]["clarification_requests"]["requests"][0]["kind"],
            "ontology_gap",
        )
        self.assertEqual(
            body["repair_review"]["ontology_decisions"]["decisions"][0][
                "decision_type"
            ],
            "propose_project_local_term",
        )
        self.assertEqual(
            body["repair_review"]["rerun_preview"]["candidate_quality_preview"][
                "review_state"
            ],
            "candidate_quality_improved",
        )
        self.assertEqual(
            body["repair_review"]["rerun_materialization"]["delta"][
                "removed_gap_ids"
            ],
            ["ontology-gap.numeric-input"],
        )
        self.assertFalse(
            body["repair_review"]["action_boundary"]["may_accept_ontology_terms"]
        )
        self.assertEqual(
            body["materialization"]["readiness"]["review_state"],
            "materialized_candidate_review_ready",
        )
        self.assertEqual(
            body["materialization"]["files"][1]["candidate_node_id"],
            "candidate-spec.numeric-input",
        )
        self.assertEqual(
            body["materialization"]["promotion_request"]["platform_artifact_kind"],
            "platform_graph_repository_promotion_request",
        )
        self.assertEqual(
            body["promotion_gate"]["readiness"]["review_state"],
            "idea_to_spec_promotion_blocked",
        )
        self.assertEqual(
            body["promotion_gate"]["findings"][0]["finding_id"],
            "repair_context_required",
        )
        self.assertTrue(body["controlled_promotion"]["available"])
        self.assertEqual(
            body["controlled_promotion"]["candidate_approval"]["decision_state"],
            "approved",
        )
        self.assertEqual(
            body["controlled_promotion"]["platform_request"]["candidate_branch"],
            "graph-candidate/idea-alpha",
        )
        self.assertEqual(
            body["controlled_promotion"]["git_service_execution"]["operations"][2][
                "status"
            ],
            "dry_run",
        )
        self.assertFalse(
            body["controlled_promotion"]["action_boundary"][
                "may_execute_git_service"
            ]
        )
        self.assertEqual(
            body["controlled_promotion"]["review_status"]["review_state"],
            "open",
        )
        self.assertFalse(
            body["controlled_promotion"]["read_model_publication"]["published"]
        )
        self.assertEqual(
            body["artifacts"]["active_candidate"]["status"],
            "active_candidate_ready",
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
        artifacts[idea_to_spec_workspace.ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT] = {
            **_active_candidate(),
            "authority_boundary": {
                **_active_candidate()["authority_boundary"],
                "may_create_branch_or_commit": True,
            },
        }

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["summary"]["status"], "partial")
        self.assertEqual(body["summary"]["available_artifact_count"], 16)
        self.assertEqual(body["summary"]["missing_artifact_count"], 3)
        self.assertEqual(body["summary"]["candidate_node_count"], 0)
        self.assertEqual(body["summary"]["repair_action_count"], 0)
        self.assertFalse(body["intake"]["available"])
        self.assertFalse(body["workspace"]["available"])
        self.assertFalse(body["candidate_graph"]["available"])
        self.assertFalse(body["repair_loop"]["available"])
        self.assertTrue(body["materialization"]["available"])
        self.assertTrue(body["promotion_gate"]["available"])
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
        self.assertEqual(body["summary"]["missing_artifact_count"], 5)
        self.assertEqual(body["summary"]["platform_missing_artifact_count"], 6)
        self.assertEqual(body["workflow"]["stage"], "candidate_artifacts_missing")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "specgraph_candidate_generation",
        )
        self.assertEqual(
            body["workflow"]["next_handoff"]["command_template"],
            "cd <specgraph-repository> && make product-workspace-active-candidate",
        )
        self.assertFalse(body["artifacts"]["event_storming_intake"]["available"])
        self.assertTrue(body["artifacts"]["candidate_graph"]["available"])

    def test_missing_ontology_seed_does_not_block_legacy_workspace_runs(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts.pop(idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT)

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["summary"]["status"], "blocked")
        self.assertEqual(body["summary"]["missing_artifact_count"], 0)
        self.assertEqual(body["workflow"]["stage"], "repair_required")
        self.assertEqual(body["workflow"]["items"][2]["id"], "ontology_seed")
        self.assertEqual(body["workflow"]["items"][2]["status"], "missing")
        self.assertFalse(body["ontology_seed"]["available"])
        self.assertEqual(
            body["artifacts"]["ontology_seed"]["reason"],
            "missing_artifact",
        )

    def test_workflow_blocks_ontology_seed_review_findings(self) -> None:
        artifacts = _workspace_artifacts()
        seed = _candidate_seed()
        source_generation = seed["source_generation"]
        source_generation["readiness"] = {
            "ready": False,
            "review_state": "ontology_seed_review_required",
            "blocked_by": ["active_frame_ontology_context_missing"],
        }
        source_generation["findings"] = [
            {
                "finding_id": "active_frame_ontology_context_missing",
                "severity": "blocking",
                "message": "Active frame must include ontology layer refs.",
                "source_ref": "runs/candidate_spec_graph_seed.json",
            }
        ]
        source_generation["summary"]["status"] = "ontology_seed_review_required"
        source_generation["summary"]["finding_count"] = 1
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        artifacts[idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT] = seed
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["summary"]["status"], "blocked")
        self.assertEqual(body["workflow"]["stage"], "ontology_seed_review_required")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "ontology_seed_review",
        )
        self.assertEqual(body["workflow"]["items"][2]["status"], "blocked")
        self.assertEqual(
            body["ontology_seed"]["findings"][0]["finding_id"],
            "active_frame_ontology_context_missing",
        )

    def test_workflow_blocks_ontology_seed_blocking_gaps(self) -> None:
        artifacts = _workspace_artifacts()
        seed = _candidate_seed()
        source_generation = seed["source_generation"]
        source_generation["ontology_gaps"][0]["blocks_candidate_graph"] = True
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        artifacts[idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT] = seed
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["summary"]["status"], "blocked")
        self.assertEqual(body["workflow"]["stage"], "ontology_seed_review_required")
        self.assertEqual(body["workflow"]["items"][2]["status"], "blocked")

    def test_build_workspace_rejects_write_capable_ontology_seed(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts[idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT] = {
            **_candidate_seed(),
            "tracked_artifacts_written": True,
        }

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertFalse(body["ontology_seed"]["available"])
        self.assertEqual(
            body["artifacts"]["ontology_seed"]["reason"],
            "invalid_artifact_contract",
        )

    def test_workflow_uses_repair_stage_for_readiness_blockers_without_findings(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": False,
            "review_state": "idea_to_spec_promotion_blocked",
            "blocked_by": ["owner_decision_required"],
            "next_artifact": "owner/operator repair before promotion",
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "repair_required")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "operator_repair_review",
        )

    def test_workflow_blocks_failed_promotion_request_artifact(self) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
            "next_artifact": "Platform graph-repository promotion-request",
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        promotion_request = _platform_promotion_request()
        promotion_request["ok"] = False
        promotion_request["summary"]["error_count"] = 1
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[
            idea_to_spec_workspace.GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT
        ] = promotion_request

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "promotion_request_failed")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "platform_promotion_request_repair",
        )

    def test_workflow_blocks_failed_git_service_execution_artifact(self) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
            "next_artifact": "Platform graph-repository promotion-request",
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        execution = _git_service_execution()
        execution["ok"] = False
        execution["summary"]["error_count"] = 1
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = execution

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "git_service_execution_failed")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "git_service_execution_repair",
        )

    def test_workflow_requires_candidate_approval_before_promotion_request(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
            "next_artifact": "candidate approval decision",
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts.pop(idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT)
        artifacts.pop(idea_to_spec_workspace.GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT)
        artifacts.pop(idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT)
        artifacts.pop(idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT)
        artifacts.pop(
            idea_to_spec_workspace.GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT
        )
        artifacts.pop(
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "approval_required")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "candidate_approval_decision",
        )
        self.assertIn(
            "candidate-approval-decision",
            body["workflow"]["next_handoff"]["command_template"],
        )

    def test_workflow_blocks_unapproved_candidate_decision(self) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        approval = _candidate_approval_decision()
        approval["decision"]["state"] = "rejected"
        approval["readiness"] = {
            "ready": False,
            "review_state": "candidate_approval_blocked",
            "blocked_by": ["decision_rejected"],
        }
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[
            idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT
        ] = approval

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "approval_blocked")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "candidate_approval_repair",
        )
        self.assertFalse(
            body["controlled_promotion"]["candidate_approval"]["ready"]
        )

    def test_workflow_waits_for_review_merge_before_read_model_publish(self) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        execution = _git_service_execution()
        execution["open_review_dry_run"] = False
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = execution
        artifacts[
            idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _review_status("open")

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "review_pending")
        self.assertFalse(body["summary"]["review_merged"])

    def test_workflow_requires_read_model_publish_after_merged_review(self) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        execution = _git_service_execution()
        execution["open_review_dry_run"] = False
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = execution
        artifacts[
            idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _review_status("merged")
        artifacts.pop(
            idea_to_spec_workspace.GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT
        )
        artifacts.pop(
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "read_model_publish_required")
        self.assertTrue(body["summary"]["review_merged"])
        self.assertFalse(body["summary"]["read_model_published"])

    def test_workflow_marks_published_read_model(self) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        execution = _git_service_execution()
        execution["open_review_dry_run"] = False
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = execution
        artifacts[
            idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _review_status("merged")
        artifacts[
            idea_to_spec_workspace.GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT
        ] = _read_model_publication(published=True)
        artifacts[
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT
        ] = _promotion_finalization(read_model_published=True)

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "read_model_published")
        self.assertTrue(body["summary"]["read_model_published"])
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "read_model_review",
        )

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
        self.assertEqual(body["summary"]["status"], "blocked")
        self.assertTrue(body["artifacts"]["repair_loop"]["available"])

    def test_file_artifact_catalog_lists_workspace_runs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs_dir = root / "runs"
            _write_json(
                runs_dir / idea_to_spec_workspace.CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT,
                _candidate_seed(),
            )
            _write_json(
                runs_dir / idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT,
                _repair_loop(),
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT,
                _materialization(),
            )
            _write_json(
                runs_dir / idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT,
                _promotion_gate(),
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT,
                _platform_promotion_request(),
            )
            _write_json(
                runs_dir
                / idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
                _git_service_execution(),
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
        self.assertIn("runs/candidate_spec_materialization_report.json", paths)
        self.assertIn("runs/idea_to_spec_promotion_gate.json", paths)
        self.assertIn("runs/graph_repository_promotion_request.json", paths)
        self.assertIn("runs/git_service_promotion_execution_report.json", paths)
        self.assertNotIn("runs/candidate_spec_graph_seed.json", paths)

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

        def fake_get(url: str, **_: object):
            return HTTPStatus.OK, payloads[url], None

        with mock.patch.object(specspace_provider, "http_get_text", fake_get):
            status, body = provider.read_idea_to_spec_workspace()

        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(body["source"]["provider"], "http")
        self.assertEqual(body["summary"]["status"], "blocked")
        self.assertTrue(body["artifacts"]["event_storming_intake"]["available"])


if __name__ == "__main__":
    unittest.main()
