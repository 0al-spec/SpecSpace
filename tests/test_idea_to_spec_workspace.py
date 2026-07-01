import json
import math
import tempfile
import time
import unittest
from http import HTTPStatus
from pathlib import Path
from unittest import mock

from viewer import idea_maturity, idea_to_spec_workspace, specspace_provider


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


def _intake_clarification_requests() -> dict:
    return {
        "artifact_kind": "idea_to_spec_clarification_requests",
        "schema_version": 1,
        "proposal_id": "0186",
        "contract_ref": "specgraph.idea-to-spec.clarification-requests.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": False,
            "review_state": "clarification_required",
            "blocked_by": ["clarification.intake.question-active-frame-domain-refs"],
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
    }


def _intake_clarification_answers() -> dict:
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
                "request_id": "clarification.intake.question-active-frame-domain-refs",
                "answer_kind": "answer_question",
                "status": "accepted_for_candidate",
                "authority": "operator_approved",
                "request_snapshot": {
                    "kind": "intake_context_gap",
                    "target_artifact": "user_idea_intake_session",
                    "target_ref": "active_frame.domain_refs",
                },
                "value": {"refs": ["domain.team_decision_log"]},
            }
        ],
        "summary": {
            "status": "answers_ready_for_rerun",
            "answer_count": 1,
            "accepted_answer_count": 1,
            "blocking_request_count": 1,
            "unresolved_blocking_count": 0,
            "finding_count": 0,
        },
    }


def _real_idea_answer_template() -> dict:
    return {
        "artifact_kind": "real_idea_answer_template",
        "schema_version": 1,
        "proposal_id": "0194",
        "contract_ref": "specgraph.real-idea.answer-template.v0.1",
        "stage": "intake",
        "run_dir": "runs/real_idea_smoke",
        "source_artifacts": {
            "clarification_requests": {
                "artifact_kind": "idea_to_spec_clarification_requests",
                "contract_ref": "specgraph.idea-to-spec.clarification-requests.v0.1",
                "source_ref": "runs/idea_intake_clarification_requests.json",
                "request_count": 1,
            }
        },
        "answer_targets": [
            {
                "target_id": "answer-target.active-frame-domain-refs",
                "target_type": "active_frame_ref",
                "request_id": "clarification.intake.question-active-frame-domain-refs",
                "request_kind": "intake_context_gap",
                "severity": "blocking",
                "status": "open",
                "question": "Which product domain refs bound this idea?",
                "target_artifact": "user_idea_intake_session",
                "target_ref": "active_frame.domain_refs",
                "accepted_actions": ["answer_question", "defer"],
                "suggested_answer_shape": "refs[]",
                "value_templates_by_action": {
                    "answer_question": {"refs": [""]},
                    "defer": {"follow_up": ""},
                },
                "required_fields_by_action": {
                    "answer_question": ["value.refs[]"],
                    "defer": ["value.follow_up"],
                },
                "evidence_refs": [],
            }
        ],
        "readiness": {
            "ready": True,
            "review_state": "answer_template_ready",
            "blocked_by": [],
            "next_artifact": "real_idea_answer_set.json",
        },
        "authority_boundary": {
            "may_execute_specgraph": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
        },
        "privacy_boundary": {
            "raw_idea_text_published": False,
            "raw_prompt_published": False,
            "raw_model_output_published": False,
            "raw_operator_note_published": False,
        },
        "findings": [],
        "summary": {
            "status": "answer_template_ready",
            "stage": "intake",
            "target_count": 1,
            "blocking_target_count": 1,
            "finding_count": 0,
        },
    }


def _real_idea_answer_authoring_report() -> dict:
    return {
        "artifact_kind": "real_idea_answer_authoring_report",
        "schema_version": 1,
        "proposal_id": "0194",
        "contract_ref": "specgraph.real-idea.answer-authoring-report.v0.1",
        "operation": "validate",
        "stage": "intake",
        "source_artifacts": {},
        "validated_answers": {
            "artifact_kind": "idea_to_spec_clarification_answers",
            "ready": True,
            "review_state": "answers_ready_for_rerun",
            "accepted_answer_count": 1,
            "unresolved_blocking_count": 0,
        },
        "readiness": {
            "ready": True,
            "review_state": "answers_ready_for_materialization",
            "blocked_by": [],
            "next_artifact": "idea_intake_clarification_answers.json",
        },
        "authority_boundary": {
            "may_execute_specgraph": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
        },
        "privacy_boundary": {
            "raw_idea_text_published": False,
            "raw_prompt_published": False,
            "raw_model_output_published": False,
            "raw_operator_note_published": False,
        },
        "findings": [],
        "summary": {
            "status": "answers_ready_for_materialization",
            "stage": "intake",
            "answer_count": 1,
            "accepted_answer_count": 1,
            "finding_count": 0,
        },
    }


def _real_idea_answer_set() -> dict:
    return {
        "artifact_kind": "idea_to_spec_clarification_answer_set",
        "schema_version": 1,
        "contract_ref": "specgraph.idea-to-spec.clarification-answer-set.v0.1",
        "answers": [
            {
                "request_id": "clarification.intake.question-active-frame-domain-refs",
                "answer_kind": "answer_question",
                "status": "accepted_for_candidate",
                "authority": "operator_approved",
                "value": {"refs": ["domain.team_decision_log"]},
            }
        ],
    }


def _specspace_real_idea_answer_import_preview() -> dict:
    return {
        "artifact_kind": "specspace_real_idea_answer_import_preview",
        "schema_version": 1,
        "proposal_id": "0195",
        "contract_ref": (
            "specgraph.idea-to-spec.specspace-real-idea-answer-import-preview.v0.1"
        ),
        "stage": "intake",
        "run_dir": "runs/real_idea_smoke",
        "source_artifacts": {
            "specspace_answer_state": {
                "artifact_kind": "specspace_idea_intake_clarification_answer_state",
                "source_ref": "specspace-state://idea_to_spec_intake_clarification_answers.json",
                "answer_count": 1,
            },
            "real_idea_answer_template": {
                "artifact_kind": "real_idea_answer_template",
                "source_ref": "runs/real_idea_smoke/real_idea_answer_template.json",
            },
            "clarification_requests": {
                "artifact_kind": "idea_to_spec_clarification_requests",
                "source_ref": "runs/idea_intake_clarification_requests.json",
            },
        },
        "import_preview": {
            "accepted_answer_count": 1,
            "answer_count": 1,
            "validated_answers": {
                "artifact_kind": "idea_to_spec_clarification_answers",
                "ready": True,
                "review_state": "answers_ready_for_rerun",
                "summary": {"accepted_answer_count": 1},
            },
        },
        "readiness": {
            "ready": True,
            "review_state": "specspace_real_idea_answers_ready_for_continuation",
            "blocked_by": [],
            "next_artifact": "real_idea_answer_continuation_report.json",
        },
        "authority_boundary": {
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_apply_answers": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
        },
        "privacy_boundary": {
            "raw_idea_text_published": False,
            "raw_prompt_published": False,
            "raw_model_output_published": False,
            "raw_operator_note_published": False,
        },
        "findings": [],
        "summary": {
            "status": "specspace_real_idea_answers_ready_for_continuation",
            "candidate_id": "team-decision-log",
            "workspace_id": "team-decision-log",
            "answer_count": 1,
            "accepted_answer_count": 1,
            "finding_count": 0,
        },
    }


def _real_idea_answer_continuation_report() -> dict:
    return {
        "artifact_kind": "real_idea_answer_continuation_report",
        "schema_version": 1,
        "proposal_id": "0195",
        "contract_ref": "specgraph.idea-to-spec.real-idea-answer-continuation.v0.1",
        "stage": "intake",
        "run_dir": "runs/real_idea_smoke",
        "source_artifacts": {
            "specspace_real_idea_answer_import_preview": {
                "artifact_kind": "specspace_real_idea_answer_import_preview",
                "source_ref": (
                    "runs/real_idea_smoke/"
                    "specspace_real_idea_answer_import_preview.json"
                ),
            },
            "clarification_requests": {
                "artifact_kind": "idea_to_spec_clarification_requests",
                "source_ref": "runs/idea_intake_clarification_requests.json",
            },
        },
        "outputs": {
            "authoring_report": (
                "runs/real_idea_smoke/real_idea_answer_authoring_report.json"
            ),
            "answer_set": "runs/real_idea_smoke/real_idea_answer_set.json",
            "validated_answers": "runs/idea_intake_clarification_answers.json",
            "clarified_intake_session": (
                "runs/real_idea_smoke/clarified_user_idea_intake_session.json"
            ),
            "rerun_report": (
                "runs/real_idea_smoke/"
                "idea_intake_clarification_rerun_report.json"
            ),
        },
        "readiness": {
            "ready": True,
            "review_state": "real_idea_answer_continuation_ready",
            "blocked_by": [],
            "next_artifact": (
                "runs/real_idea_smoke/clarified_user_idea_intake_session.json"
            ),
        },
        "authority_boundary": {
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_apply_answers": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
        },
        "privacy_boundary": {
            "raw_idea_text_published": False,
            "raw_prompt_published": False,
            "raw_model_output_published": False,
            "raw_operator_note_published": False,
        },
        "findings": [],
        "summary": {
            "status": "real_idea_answer_continuation_ready",
            "answer_count": 1,
            "accepted_answer_count": 1,
            "finding_count": 0,
        },
    }


def _intake_answer_rerun_input() -> dict:
    return {
        "artifact_kind": "idea_intake_answer_rerun_input",
        "schema_version": 1,
        "proposal_id": "0186",
        "contract_ref": "specgraph.idea-to-spec.intake-answer-rerun-input.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": True,
            "review_state": "intake_answer_rerun_ready",
            "blocked_by": [],
        },
        "summary": {
            "status": "intake_answer_rerun_ready",
            "accepted_answer_count": 1,
            "accepted_target_count": 1,
            "finding_count": 0,
        },
    }


def _intake_clarification_rerun_report() -> dict:
    return {
        "artifact_kind": "idea_intake_clarification_rerun_report",
        "schema_version": 1,
        "proposal_id": "0186",
        "contract_ref": "specgraph.idea-to-spec.intake-clarification-rerun.v0.1",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "readiness": {
            "ready": True,
            "review_state": "intake_clarification_rerun_ready",
            "blocked_by": [],
        },
        "summary": {
            "status": "intake_clarification_rerun_ready",
            "accepted_target_count": 1,
            "finding_count": 0,
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


def _repair_session_journal() -> dict:
    return {
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
            "ready_for_candidate_approval": False,
            "ready_for_platform_promotion": False,
            "intermediate_artifacts_ready": True,
            "candidate_quality_review_state": "candidate_quality_partially_improved",
            "promotion_gate_review_state": "idea_to_spec_promotion_blocked",
            "active_candidate_review_state": "active_candidate_review_required",
            "resolved_ontology_gap_count": 1,
            "unresolved_ontology_gap_count": 7,
            "rerun_removed_gap_count": 1,
            "clarification_request_count": 1,
            "accepted_answer_count": 1,
            "ontology_decision_count": 1,
            "promotion_path_count": 0,
            "blocked_by": [
                "repair_context_required",
                "unresolved_ontology_gaps",
            ],
            "platform_promotion_blocked_by": [
                "candidate_not_ready_for_approval",
            ],
        },
        "workflow_journal": {
            "stages": [
                {
                    "index": 1,
                    "stage": "active_candidate",
                    "artifact_kind": "active_idea_to_spec_candidate",
                    "source_ref": "runs/active_idea_to_spec_candidate.json",
                    "ready": False,
                    "review_state": "active_candidate_review_required",
                    "status": "active_candidate_review_required",
                    "blocked_by": ["promotion_gate_not_ready"],
                    "next_artifact": "repair active candidate source before public handoff",
                },
                {
                    "index": 8,
                    "stage": "promotion_gate",
                    "artifact_kind": "idea_to_spec_promotion_gate",
                    "source_ref": "runs/idea_to_spec_promotion_gate.json",
                    "ready": False,
                    "review_state": "idea_to_spec_promotion_blocked",
                    "status": "idea_to_spec_promotion_blocked",
                    "blocked_by": ["repair_context_required"],
                    "next_artifact": "owner/operator repair before promotion",
                },
            ],
            "accepted_answers": [
                {
                    "request_id": "clarification.candidate-gap.ontology-gap-numeric-input",
                    "request_kind": "ontology_gap",
                    "answer_kind": "propose_project_local_term",
                    "status": "accepted_for_candidate",
                    "target_artifact": "runs/candidate_spec_graph.json",
                    "target_ref": "candidate-spec.numeric-input.gaps.ontology-gap.numeric-input",
                    "value": {
                        "terms": ["Numeric Input"],
                        "term_scope": "project_local",
                    },
                }
            ],
            "ontology_decisions": [
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
            "rerun_overlay_refs": {
                "source_ref": "runs/idea_to_spec_answer_rerun_input.json",
                "summary": {
                    "status": "rerun_input_ready",
                    "ontology_decision_source": "product_ontology_gap_review_decisions",
                    "ontology_decision_count": 1,
                    "project_local_term_count": 1,
                },
            },
            "preview_refs": {
                "rerun_preview": {
                    "source_ref": "runs/idea_to_spec_rerun_preview.json",
                    "summary": {
                        "status": "rerun_preview_ready",
                        "candidate_quality_review_state": "candidate_quality_partially_improved",
                        "resolved_ontology_gap_count": 1,
                        "unresolved_ontology_gap_count": 7,
                    },
                },
                "rerun_materialization": {
                    "source_ref": "runs/idea_to_spec_rerun_materialization.json",
                    "summary": {
                        "status": "rerun_materialization_ready",
                        "removed_gap_count": 1,
                        "resolved_ontology_gap_count": 1,
                        "unresolved_ontology_gap_count": 7,
                    },
                },
            },
        },
        "source_artifacts": {},
        "summary": {
            "status": "repair_session_journal_ready",
            "candidate_id": "team-decision-log",
            "workflow_lane": "product_idea_to_spec",
            "source_artifact_count": 8,
            "accepted_answer_count": 1,
            "ontology_decision_count": 1,
            "resolved_ontology_gap_count": 1,
            "unresolved_ontology_gap_count": 7,
            "ready_for_candidate_approval": False,
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
    }


def _promotion_ready_repair_session_journal() -> dict:
    journal = _repair_session_journal()
    journal["readiness_impact"] = {
        **journal["readiness_impact"],
        "ready_for_candidate_approval": True,
        "ready_for_platform_promotion": True,
        "blocked_by": [],
        "platform_promotion_blocked_by": [],
    }
    journal["summary"] = {
        **journal["summary"],
        "ready_for_candidate_approval": True,
    }
    return journal


def _repaired_repair_session_journal() -> dict:
    journal = _promotion_ready_repair_session_journal()
    journal["session"]["session_id"] = "repaired-session.team-decision-log"
    journal["readiness_impact"] = {
        **journal["readiness_impact"],
        "ready_for_candidate_approval": True,
        "ready_for_platform_promotion": False,
        "candidate_quality_review_state": "candidate_quality_repaired",
        "promotion_gate_review_state": "ready_for_platform_promotion_request",
        "active_candidate_review_state": "active_candidate_ready",
        "resolved_ontology_gap_count": 11,
        "unresolved_ontology_gap_count": 0,
        "resolved_candidate_gap_count": 4,
        "unresolved_candidate_gap_count": 0,
        "rerun_removed_gap_count": 15,
        "promotion_path_count": 2,
        "blocked_by": [],
        "platform_promotion_blocked_by": [],
    }
    journal["summary"] = {
        **journal["summary"],
        "status": "repair_session_journal_ready",
        "resolved_ontology_gap_count": 11,
        "unresolved_ontology_gap_count": 0,
        "ready_for_candidate_approval": True,
    }
    return journal


def _repaired_promotion_gate() -> dict:
    gate = _promotion_gate()
    gate["readiness"] = {
        "ready": True,
        "review_state": "ready_for_platform_promotion_request",
        "blocked_by": [],
        "next_artifact": "candidate_approval_decision",
    }
    gate["promotion_request"] = {
        "path_argument": "--path",
        "paths": [
            "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT.yaml",
            "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT.yaml",
        ],
        "platform_artifact_kind": "platform_graph_repository_promotion_request",
    }
    gate["findings"] = []
    gate["summary"] = {
        **gate["summary"],
        "status": "ready_for_platform_promotion_request",
        "finding_count": 0,
        "promotion_path_count": 2,
    }
    return gate


def _repaired_handoff_report() -> dict:
    return {
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
        },
        "findings": [],
        "summary": {
            "status": "repaired_candidate_promotion_handoff_ready",
            "finding_count": 0,
            "generated_artifact_count": 7,
            "removed_gap_count": 15,
            "resolved_ontology_gap_count": 11,
            "unresolved_ontology_gap_count": 0,
            "resolved_candidate_gap_count": 4,
            "unresolved_candidate_gap_count": 0,
            "ready_for_candidate_approval": True,
            "ready_for_platform_promotion": False,
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


def _product_repair_rerun_execution_report(
    *, ok: bool = True, dry_run: bool = False
) -> dict:
    return {
        "artifact_kind": "platform_product_repair_rerun_execution_report",
        "schema_version": 1,
        "ok": ok,
        "dry_run": dry_run,
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
                "status": "succeeded" if ok else "failed",
                "reason": "SpecGraph requested rerun target executed",
                "evidence": ["product-workspace-requested-repair-draft-rerun"],
            }
        ],
        "output_artifacts": {
            "rerun_report": {
                "path": "runs/specspace_repair_draft_rerun_report.json",
                "present": ok,
                "artifact_kind": "specspace_repair_draft_rerun_report",
                "contract_ref": (
                    "specgraph.idea-to-spec.specspace-repair-draft-rerun.v0.1"
                ),
                "status": "repair_draft_rerun_ready" if ok else "blocked",
                "ready": ok,
                "sha256": "sha256:rerun",
            }
        },
        "diagnostics": [] if ok else [{"level": "error", "message": "failed"}],
        "summary": {
            "status": "completed" if ok else "failed",
            "error_count": 0 if ok else 1,
            "output_artifact_count": 1,
            "rerun_report_digest": "sha256:rerun" if ok else None,
            "repair_session_digest": "sha256:session" if ok else None,
        },
    }


def _product_repair_rerun_publication_report(
    *, ok: bool = True, dry_run: bool = False
) -> dict:
    return {
        "artifact_kind": "platform_product_repair_rerun_publication_report",
        "schema_version": 1,
        "ok": ok,
        "dry_run": dry_run,
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
            "present": ok,
            "sha256": "sha256:manifest",
        },
        "published_artifacts": (
            ["runs/specspace_repair_draft_rerun_report.json"] if ok else []
        ),
        "missing_artifacts": [] if ok else ["runs/idea_to_spec_repair_session.json"],
        "diagnostics": [] if ok else [{"level": "error", "message": "missing"}],
        "summary": {
            "status": "published" if ok else "blocked",
            "error_count": 0 if ok else 1,
            "published_artifact_count": 1 if ok else 0,
            "missing_artifact_count": 0 if ok else 1,
        },
    }


def _published_repaired_artifacts() -> list[str]:
    return [
        f"runs/{idea_to_spec_workspace.REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT}",
        f"runs/{idea_to_spec_workspace.REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT}",
        f"runs/{idea_to_spec_workspace.REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT}",
        f"runs/{idea_to_spec_workspace.REPAIRED_PRE_SIB_COHERENCE_REPORT_ARTIFACT}",
        f"runs/{idea_to_spec_workspace.REPAIRED_CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT}",
        f"runs/{idea_to_spec_workspace.REPAIRED_CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT}",
        f"runs/{idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT}",
        f"runs/{idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT}",
    ]


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


def _candidate_approval_execution() -> dict:
    return {
        "artifact_kind": "platform_candidate_approval_execution_report",
        "schema_version": 1,
        "generated_at": "2026-06-28T00:00:00Z",
        "ok": True,
        "dry_run": False,
        "status": "candidate_approval_materialized",
        "canonical_mutations_allowed": False,
        "ontology_writes_allowed": False,
        "tracked_artifacts_written": False,
        "gate_report_ref": "runs/platform_candidate_approval_intent_gate_report.json",
        "candidate_approval_decision_ref": "runs/candidate_approval_decision.json",
        "execution_report_ref": "runs/platform_candidate_approval_execution_report.json",
        "candidate_id": "idea-alpha",
        "workspace_id": "team-decision-log",
        "repair_session_ref": "runs/repaired_idea_to_spec_repair_session.json",
        "approval_intent_ref": "approval-intent-1",
        "approved_paths": [
            "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-CALCULATOR-PRODUCT.yaml",
            "runs/materialized_candidate_specs/CANDIDATE-CANDIDATE-SPEC-NUMERIC-INPUT.yaml",
        ],
        "operations": [
            {
                "name": "build_candidate_approval_gate",
                "status": "ready",
                "reason": "candidate approval gate is ready",
                "evidence": ["platform_candidate_approval_intent_gate_report"],
            },
            {
                "name": "materialize_candidate_approval_decision",
                "status": "succeeded",
                "reason": "candidate approval decision written",
                "evidence": ["candidate_approval_decision"],
            },
        ],
        "diagnostics": [],
        "output_artifacts": {
            "gate_report": {
                "path": "runs/platform_candidate_approval_intent_gate_report.json",
                "artifact_kind": "platform_candidate_approval_intent_gate_report",
                "present": True,
                "sha256": "sha256:gate",
            },
            "candidate_approval_decision": {
                "path": "runs/candidate_approval_decision.json",
                "artifact_kind": "candidate_approval_decision",
                "present": True,
                "ready": True,
                "sha256": "sha256:decision",
            },
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
        "summary": {
            "status": "candidate_approval_materialized",
            "candidate_id": "idea-alpha",
            "workspace_id": "team-decision-log",
            "selected_intent_id": "approval-intent-1",
            "gate_ready": True,
            "decision_written": True,
            "approved_path_count": 2,
            "error_count": 0,
            "next_artifact": "runs/graph_repository_promotion_request.json",
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


def _product_promotion_execution() -> dict:
    return {
        "artifact_kind": "platform_product_candidate_promotion_execution_report",
        "schema_version": 1,
        "generated_at": "2026-06-28T00:00:00Z",
        "promotion_request_ref": "runs/graph_repository_promotion_request.json",
        "approval_decision_ref": "runs/candidate_approval_decision.json",
        "deployment_profile_ref": "graph-repository-service.example.json",
        "contract_ref": "git-service-operation-contract.example.json",
        "graph_repository_plan_ref": "graph_repository_execution_plan.json",
        "git_service_execution_report_ref": "runs/git_service_promotion_execution_report.json",
        "ok": True,
        "dry_run": False,
        "open_review_dry_run": True,
        "workflow_lane": "product_idea_to_spec",
        "candidate_id": "idea-alpha",
        "candidate_branch": "graph-candidate/idea-alpha",
        "repository_dir": "../SpecGraph",
        "workspace_dir": ".platform/candidates/idea-alpha-worktree",
        "materialized_source_dir": "runs/materialized_candidate_specs",
        "child_report_refs": {
            "prepare_worktree": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_worktree_prepare_report.json",
            "commit_candidate": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_review_commit_report.json",
            "open_review": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_open_review_report.json",
        },
        "git_review": {
            "candidate_branch": "graph-candidate/idea-alpha",
            "worktree_dir": ".platform/candidates/idea-alpha-worktree",
            "commit_sha": "abc1234",
            "review_url": None,
            "review_number": None,
            "review_opened": False,
            "open_review_dry_run": True,
            "candidate_branch_pushed": False,
            "copied_file_count": 1,
            "prepare_worktree_report_ref": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_worktree_prepare_report.json",
            "commit_report_ref": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_review_commit_report.json",
            "open_review_report_ref": ".platform/candidates/idea-alpha-worktree/.platform/graph_repository_open_review_report.json",
        },
        "git_service_execution": _git_service_execution(),
        "operations": [
            {
                "name": "validate_product_promotion_handoff",
                "status": "ready",
                "reason": "promotion request and candidate approval decision are valid",
                "evidence": [
                    "runs/graph_repository_promotion_request.json",
                    "runs/candidate_approval_decision.json",
                ],
            },
            {
                "name": "execute_git_service_promotion",
                "status": "succeeded",
                "reason": "Git Service promotion executor completed",
                "evidence": ["git-service execute-promotion"],
            },
            {
                "name": "publish_read_model",
                "status": "blocked_until_review_merge",
                "reason": "read model publication is a separate post-review step",
                "evidence": ["git-service finalize-promotion"],
            },
        ],
        "authority_boundary": {
            "specspace_direct_git_write": False,
            "controlled_git_service_execution": True,
            "creates_candidate_worktree_or_branch": True,
            "creates_candidate_commit": True,
            "opens_pull_requests": False,
            "merges_pull_requests": False,
            "publishes_read_models": False,
            "canonical_spec_mutation_without_review": False,
            "ontology_package_write": False,
            "ontology_term_acceptance": False,
            "private_artifact_publication": False,
        },
        "diagnostics": [],
        "summary": {
            "status": "completed",
            "error_count": 0,
            "child_operation_count": 3,
            "worktree_prepared": True,
            "commit_created": True,
            "review_opened": False,
            "read_model_published": False,
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


def _product_review_status(review_state: str = "open") -> dict:
    review_merged = review_state == "merged"
    return {
        "artifact_kind": (
            "platform_product_candidate_promotion_review_status_report"
        ),
        "schema_version": 1,
        "ok": True,
        "workflow_lane": "product_idea_to_spec",
        "candidate_id": "team-decision-log",
        "candidate_branch": "graph-candidate/idea-alpha",
        "promotion_execution_report_ref": (
            "runs/product_candidate_promotion_execution_report.json"
        ),
        "graph_repository_review_status_report_ref": (
            "/tmp/team-decision-log-worktree/.platform/"
            "graph_repository_review_status_report.json"
        ),
        "review_state": review_state,
        "review_decision": "APPROVED",
        "pull_request": {
            "number": 12,
            "url": "https://github.com/example/product/pull/12",
            "state": "MERGED" if review_merged else "OPEN",
            "isDraft": False,
            "mergedAt": "2026-06-21T16:00:00Z" if review_merged else None,
            "mergeCommit": {"oid": "abc123"},
            "headRefName": "graph-candidate/idea-alpha",
            "baseRefName": "main",
            "reviewDecision": "APPROVED",
        },
        "graph_repository_review_status": {
            "artifact_kind": "platform_graph_repository_review_status_report",
            "ok": True,
            "review_url": "https://github.com/example/product/pull/12",
            "review_state": review_state,
            "summary": {"review_merged": review_merged},
        },
        "operations": [
            {
                "name": "validate_product_promotion_execution",
                "status": "ready",
                "reason": "product promotion execution is ready for review status",
                "evidence": ["runs/product_candidate_promotion_execution_report.json"],
            },
            {
                "name": "inspect_review_status",
                "status": "succeeded",
                "reason": "graph repository review status inspected",
                "evidence": ["graph-repository review-status"],
            },
            {
                "name": "publish_read_model",
                "status": "ready"
                if review_merged
                else "blocked_until_review_merge",
                "reason": "review gate status",
                "evidence": ["/tmp/team-decision-log-worktree/.platform/report.json"],
            },
        ],
        "authority_boundary": {
            "specspace_direct_git_write": False,
            "executes_git_commands": False,
            "opens_pull_requests": False,
            "merges_pull_requests": False,
            "publishes_read_models": False,
            "canonical_spec_mutation_without_review": False,
            "ontology_package_write": False,
            "ontology_term_acceptance": False,
            "private_artifact_publication": False,
        },
        "diagnostics": [],
        "summary": {
            "status": "ready_for_read_model_publication"
            if review_merged
            else "waiting_for_review_merge",
            "error_count": 0,
            "review_merged": review_merged,
            "read_model_published": False,
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


def _product_read_model_publication(
    *,
    published: bool = False,
    dry_run: bool | None = None,
) -> dict:
    effective_dry_run = (not published) if dry_run is None else dry_run
    return {
        "artifact_kind": (
            "platform_product_candidate_promotion_read_model_publication_report"
        ),
        "schema_version": 1,
        "ok": True,
        "dry_run": effective_dry_run,
        "workflow_lane": "product_idea_to_spec",
        "candidate_id": "team-decision-log",
        "candidate_branch": "graph-candidate/idea-alpha",
        "review_state": "merged",
        "product_review_status_report_ref": (
            "runs/product_candidate_promotion_review_status_report.json"
        ),
        "graph_repository_review_status_report_ref": (
            "/tmp/team-decision-log-worktree/.platform/"
            "graph_repository_review_status_report.json"
        ),
        "graph_repository_publish_read_model_report_ref": (
            "/tmp/published-read-model/.platform/"
            "graph_repository_publish_read_model_report.json"
        )
        if published
        else None,
        "bundle_dir": "/tmp/public-bundle",
        "output_dir": "/tmp/published-read-model",
        "manifest_name": "artifact_manifest.json",
        "graph_repository_publish_read_model": {
            "artifact_kind": "platform_graph_repository_publish_read_model_report",
            "ok": True,
            "dry_run": effective_dry_run,
            "review_state": "merged",
            "read_models_published": [
                "/tmp/published-read-model/artifact_manifest.json"
            ]
            if published
            else [],
            "summary": {"published": published, "file_count": 7 if published else 0},
        },
        "operations": [
            {
                "name": "validate_product_review_status",
                "status": "ready",
                "reason": "product review is merged and ready for read-model publication",
                "evidence": [
                    "runs/product_candidate_promotion_review_status_report.json"
                ],
            },
            {
                "name": "publish_read_model",
                "status": "succeeded" if published else "dry_run",
                "reason": "public-safe read model published"
                if published
                else "dry_run",
                "evidence": ["graph-repository publish-read-model"],
            },
        ],
        "authority_boundary": {
            "specspace_direct_git_write": False,
            "executes_git_commands": False,
            "opens_pull_requests": False,
            "merges_pull_requests": False,
            "publishes_read_models": published,
            "canonical_spec_mutation_without_review": False,
            "ontology_package_write": False,
            "ontology_term_acceptance": False,
            "private_artifact_publication": False,
        },
        "diagnostics": [],
        "summary": {
            "status": "published"
            if published
            else "dry_run"
            if effective_dry_run
            else "failed",
            "error_count": 0,
            "review_merged": True,
            "read_model_published": published,
            "published_manifest": "/tmp/published-read-model/artifact_manifest.json"
            if published
            else None,
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


def _idea_maturity_metrics_report() -> dict:
    return {
        "artifact_kind": "idea_maturity_metrics_report",
        "schema_version": 1,
        "proposal_id": "0178",
        "contract_ref": "specgraph.idea-to-spec.maturity-metrics-report.v0.1",
        "contract": {
            "schema_version": 1,
            "schema_ref": "schemas/idea_maturity_metrics_report.schema.json",
            "validation_report_schema_ref": (
                "schemas/idea_maturity_metrics_validation_report.schema.json"
            ),
            "validator_id": "metrics.idea_maturity_metrics.validator.v0.1",
            "validator_version": "0.1.0",
            "compatibility_policy": "additive_v1",
            "compatibility_policy_ref": "VALIDATOR_CONTRACT.md#compatibility-policy",
            "metrics_rfc_ref": "Metrics/IDEA_MATURITY_METRICS.md",
            "proposal_id": "0181",
        },
        "metric_pack_id": "idea_to_spec_maturity",
        "metric_pack_ref": "metrics.idea_to_spec_maturity.v0.1",
        "metrics_rfc_ref": "Metrics/IDEA_MATURITY_METRICS.md",
        "generated_at": "2026-06-28T15:20:21+00:00",
        "status": "blocked",
        "authority_state": "draft_reference",
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "candidate": {
            "candidate_id": "team-decision-log",
            "workspace_route": "/team-decision-log",
            "workflow_lane": "product_idea_to_spec",
            "target_repository_role": "product_spec_workspace",
            "governance_profile": "product_workspace",
        },
        "derived_state": {
            "lifecycle_state": "repair_required",
            "candidate_approval_state": "blocked",
            "platform_promotion_state": "not_reached",
            "review_status": "not_available",
            "read_model_publication_state": "not_reached",
            "blockers": ["repair_context_required"],
        },
        "groups": {
            "clarification_load": {
                "clarification_question_count": 22,
                "review_required_question_count": 14,
                "blocking_question_count": 1,
            },
            "answer_materialization": {
                "answered_question_count": 5,
                "accepted_answer_count": 5,
                "materialized_answer_count": 5,
                "unmaterialized_answer_count": 0,
                "deferred_answer_count": 0,
                "invalid_answer_count": 0,
                "answer_materialization_rate": 1.0,
            },
            "ontology_grounding": {
                "ontology_gap_count_initial": 11,
                "ontology_gap_resolved_count": 11,
                "ontology_gap_unresolved_count": 0,
                "ontology_gap_resolution_rate": 1.0,
            },
            "candidate_repair": {
                "candidate_gap_count_initial": 4,
                "candidate_gap_resolved_count": 4,
                "candidate_gap_unresolved_count": 0,
                "candidate_gap_closure_rate": 1.0,
                "remaining_blocker_count": 0,
            },
            "workflow_friction": {
                "stale_ref_count": 0,
                "failed_gate_count": 0,
                "dry_run_count": 1,
                "rerun_count": 1,
                "rerun_request_count": 1,
                "manual_handoff_count": 6,
                "operator_command_count": 11,
            },
            "promotion_readiness": {
                "candidate_approval_intent_state": "requested",
                "candidate_approval_decision_state": "materialized",
                "candidate_approval_state": "ready",
                "promotion_request_state": "not_reached",
                "promotion_execution_state": "not_reached",
                "platform_promotion_state": "not_reached",
                "promotion_path_count": 2,
            },
            "review_publication": {
                "review_status": "not_available",
                "review_pr_number": None,
                "review_merge_commit_sha": None,
                "read_model_publication_state": "not_reached",
                "published_file_count": 0,
                "published_manifest_digest": None,
            },
            "temporal_progress": {
                "last_progress_at": "2026-06-28T15:20:21+00:00",
                "stalled_phase": None,
                "time_to_first_candidate_seconds": 0.052,
                "time_to_approval_ready_seconds": None,
                "time_to_first_materialization_seconds": None,
            },
        },
        "metrics": {
            "candidate_node_count": 2,
            "clarification_question_count": 22,
            "review_required_question_count": 14,
            "blocking_question_count": 1,
            "answered_question_count": 5,
            "accepted_answer_count": 5,
            "deferred_answer_count": 0,
            "invalid_answer_count": 0,
            "materialized_answer_count": 5,
            "unmaterialized_answer_count": 0,
            "answer_materialization_rate": 1.0,
            "ontology_gap_count_initial": 11,
            "ontology_gap_resolved_count": 11,
            "ontology_gap_unresolved_count": 0,
            "ontology_gap_resolution_rate": 1.0,
            "candidate_gap_count_initial": 4,
            "candidate_gap_resolved_count": 4,
            "candidate_gap_unresolved_count": 0,
            "candidate_gap_closure_rate": 1.0,
            "remaining_blocker_count": 0,
            "stale_ref_count": 0,
            "failed_gate_count": 0,
            "dry_run_count": 1,
            "rerun_count": 1,
            "rerun_request_count": 1,
            "manual_handoff_count": 6,
            "operator_command_count": 11,
            "promotion_path_count": 2,
            "published_file_count": 0,
            "last_progress_at": "2026-06-28T15:20:21+00:00",
        },
        "summary": {
            "lifecycle_state": "repair_required",
            "candidate_node_count": 2,
            "clarification_question_count": 22,
            "ontology_gap_resolution_rate": 1.0,
            "candidate_gap_closure_rate": 1.0,
            "candidate_approval_state": "ready",
            "platform_promotion_state": "not_reached",
            "review_status": "not_available",
            "read_model_publication_state": "not_reached",
            "stale_ref_count": 0,
            "failed_gate_count": 0,
            "dry_run_count": 1,
        },
        "source_artifacts": [
            "runs/idea_event_storming_intake.json",
            "runs/candidate_spec_graph.json",
        ],
        "readiness_explainers": [
            {
                "id": "readiness-explainer.pre-sib-ontology-coverage-gap",
                "proposal_id": "0180",
                "kind": "pre_sib_finding",
                "source": "repaired_pre_sib",
                "severity": "high",
                "blocks": ["pre_sib_review", "candidate_approval"],
                "message": "Ontology coverage is incomplete for the candidate graph.",
                "next_action": (
                    "Inspect Pre-SIB coherence findings and close the referenced "
                    "candidate graph condition."
                ),
                "evidence_refs": [
                    "runs/repaired_pre_sib_coherence_report.json#findings.pre-sib-ontology-coverage-gap",
                    "/Users/egor/Development/GitHub/0AL/SpecGraph/runs/repaired_idea_to_spec_repair_session.json#blockers.0",
                    "runs/local_operator_diagnostics.json",
                    "runs/ontology_term_binding_gate_report.json",
                    "/tmp/private_operator_notes.json",
                ],
            }
        ],
        "findings": [],
        "invariant_findings": [],
        "policy_findings": [],
        "authority_boundary": {
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_execute_prompt_agent": False,
            "may_merge_pull_request": False,
            "may_mutate_canonical_specs": False,
            "may_open_pull_request": False,
            "may_publish_read_model": False,
            "may_write_ontology_package": False,
        },
        "privacy_boundary": {
            "contains_human_operator_identity": False,
            "join_to_identity_allowed": False,
            "minimum_aggregation_subject": "candidate_run",
            "raw_prompt_or_operator_text_included": False,
        },
    }


def _idea_maturity_validation_report(*, status: str = "ok") -> dict:
    return {
        "artifact_kind": "idea_maturity_metrics_validation_report",
        "schema_version": 1,
        "generated_at": "2026-06-28T15:20:22+00:00",
        "metric_pack_id": "idea_to_spec_maturity",
        "validator": {
            "id": "metrics.idea_maturity_metrics.validator.v0.1",
            "version": "0.1.0",
            "rfc_ref": "IDEA_MATURITY_METRICS.md",
            "schema_ref": "schemas/idea_maturity_metrics_report.schema.json",
            "validation_report_schema_ref": (
                "schemas/idea_maturity_metrics_validation_report.schema.json"
            ),
            "script_ref": "scripts/metrics.py",
            "compatibility_policy_ref": "VALIDATOR_CONTRACT.md#compatibility-policy",
        },
        "summary": {
            "status": status,
            "report_count": 1,
            "valid_count": 1 if status == "ok" else 0,
            "invalid_count": 0 if status == "ok" else 1,
        },
        "authority_boundary": {
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
            "may_merge_pull_request": False,
            "may_publish_read_model": False,
            "may_execute_prompt_agent": False,
        },
        "reports": [
            {
                "path": "/tmp/runs/idea_maturity_metrics_report.json",
                "status": status,
                "diagnostics": []
                if status == "ok"
                else [{"level": "error", "message": "invalid"}],
            }
        ],
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
        idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT: _repair_session_journal(),
        idea_to_spec_workspace.CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: _materialization(),
        idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: _promotion_gate(),
        idea_to_spec_workspace.PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT: _candidate_approval_execution(),
        idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT: _candidate_approval_decision(),
        idea_to_spec_workspace.GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT: _platform_promotion_request(),
        idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT: _product_promotion_execution(),
        idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT: _git_service_execution(),
        idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT: _product_review_status(),
        idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT: _product_read_model_publication(),
        idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT: _review_status(),
        idea_to_spec_workspace.GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT: _read_model_publication(),
        idea_to_spec_workspace.GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT: _promotion_finalization(),
        idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT: _idea_maturity_metrics_report(),
        idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT: _idea_maturity_validation_report(),
    }


def _guided_stage(body: dict, stage_id: str) -> dict:
    return [
        stage
        for stage in body["guided_flow"]["stages"]
        if stage["id"] == stage_id
    ][0]


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
        self.assertEqual(body["summary"]["unresolved_ontology_gap_count"], 7)
        self.assertEqual(body["summary"]["rerun_removed_gap_count"], 1)
        self.assertEqual(body["summary"]["materialized_file_count"], 2)
        self.assertEqual(body["summary"]["promotion_path_count"], 0)
        self.assertEqual(body["summary"]["promotion_gate_blocker_count"], 1)
        self.assertEqual(body["summary"]["platform_missing_artifact_count"], 0)
        self.assertEqual(body["summary"]["git_service_operation_count"], 3)
        self.assertEqual(body["summary"]["git_service_error_count"], 0)
        self.assertTrue(body["summary"]["approval_ready"])

        self.assertFalse(body["summary"]["repair_session_ready_for_candidate_approval"])
        self.assertFalse(body["summary"]["repair_session_ready_for_platform_promotion"])
        self.assertFalse(body["summary"]["review_merged"])
        self.assertFalse(body["summary"]["read_model_published"])
        self.assertEqual(body["workflow"]["stage"], "repair_required")
        self.assertEqual(body["workflow"]["status"], "blocked")
        self.assertEqual(len(body["workflow"]["items"]), 17)
        self.assertEqual(body["workflow"]["items"][2]["id"], "ontology_seed")
        self.assertEqual(
            body["workflow"]["items"][6]["id"],
            "product_repair_rerun_execution",
        )
        self.assertEqual(
            body["workflow"]["items"][7]["id"],
            "product_repair_rerun_publication",
        )
        self.assertEqual(
            body["workflow"]["items"][10]["id"],
            "candidate_approval_execution",
        )
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "operator_repair_review",
        )
        self.assertEqual(
            body["workflow"]["next_handoff"]["authority_boundary"],
            "operator_only",
        )
        self.assertEqual(body["guided_flow"]["current_stage"], "repair_review")
        self.assertEqual(body["guided_flow"]["overall_status"], "blocked")
        self.assertEqual(len(body["guided_flow"]["stages"]), 11)
        self.assertEqual(
            body["guided_flow"]["next_actions"][0]["target_section"],
            "idea-to-spec-repair-review",
        )
        self.assertFalse(
            body["guided_flow"]["authority_boundary"]["may_execute_platform"]
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
        self.assertTrue(body["repair_session"]["available"])
        self.assertEqual(body["repair_session"]["source_mode"], "journal")
        self.assertEqual(
            body["repair_session"]["session"]["session_id"],
            "repair-session.team-decision-log",
        )
        self.assertEqual(
            body["repair_session"]["readiness_impact"][
                "candidate_quality_review_state"
            ],
            "candidate_quality_partially_improved",
        )
        self.assertEqual(
            body["repair_session"]["readiness_impact"][
                "platform_promotion_blocked_by"
            ],
            ["candidate_not_ready_for_approval"],
        )
        self.assertEqual(
            body["repair_session"]["open_blockers"][0]["id"],
            "repair_context_required",
        )
        self.assertEqual(
            body["repair_session"]["stages"][1]["stage"],
            "promotion_gate",
        )
        self.assertEqual(
            body["repair_session"]["accepted_answers"][0]["answer_kind"],
            "propose_project_local_term",
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
        self.assertEqual(body["idea_maturity"]["status"], "available")
        self.assertTrue(body["idea_maturity"]["trusted"])
        self.assertEqual(
            body["idea_maturity"]["report"]["derived_state"]["lifecycle_state"],
            "repair_required",
        )
        self.assertEqual(
            body["idea_maturity"]["report"]["metrics"][
                "ontology_gap_resolution_rate"
            ],
            1.0,
        )
        self.assertEqual(
            body["idea_maturity"]["report"]["contract"]["schema_ref"],
            "schemas/idea_maturity_metrics_report.schema.json",
        )
        self.assertEqual(
            body["idea_maturity"]["report"]["contract"][
                "validation_report_schema_ref"
            ],
            "schemas/idea_maturity_metrics_validation_report.schema.json",
        )
        self.assertEqual(
            body["idea_maturity"]["report"]["contract"]["validator_version"],
            "0.1.0",
        )
        self.assertEqual(
            body["idea_maturity"]["validation"]["validator"]["version"],
            "0.1.0",
        )
        self.assertEqual(
            body["idea_maturity"]["validation"]["validator"][
                "validation_report_schema_ref"
            ],
            "schemas/idea_maturity_metrics_validation_report.schema.json",
        )
        self.assertEqual(
            body["idea_maturity"]["report"]["readiness_explainers"][0]["kind"],
            "pre_sib_finding",
        )
        self.assertEqual(
            body["idea_maturity"]["report"]["readiness_explainers"][0]["blocks"],
            ["pre_sib_review", "candidate_approval"],
        )
        self.assertEqual(
            body["idea_maturity"]["report"]["readiness_explainers"][0][
                "proposal_id"
            ],
            "0180",
        )
        self.assertEqual(
            body["idea_maturity"]["report"]["readiness_explainers"][0][
                "evidence_refs"
            ],
            [
                "runs/repaired_pre_sib_coherence_report.json#findings.pre-sib-ontology-coverage-gap",
                "runs/repaired_idea_to_spec_repair_session.json#blockers.0",
            ],
        )
        self.assertEqual(
            body["idea_maturity"]["validation"]["summary"]["status"],
            "ok",
        )
        self.assertFalse(
            body["idea_maturity"]["action_boundary"]["may_recalculate_metrics"]
        )
        self.assertFalse(
            body["repair_review"]["action_boundary"]["may_accept_ontology_terms"]
        )
        self.assertFalse(
            body["repair_review"]["action_boundary"]["may_apply_decisions"]
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
            body["controlled_promotion"]["candidate_approval_execution"]["status"],
            "candidate_approval_materialized",
        )
        self.assertTrue(
            body["controlled_promotion"]["candidate_approval_execution"][
                "decision_written"
            ]
        )
        self.assertEqual(
            body["controlled_promotion"]["candidate_approval_execution"][
                "operations"
            ][1]["status"],
            "succeeded",
        )
        self.assertEqual(
            body["controlled_promotion"]["candidate_approval"]["decision_state"],
            "approved",
        )
        self.assertEqual(
            body["controlled_promotion"]["platform_request"]["candidate_branch"],
            "graph-candidate/idea-alpha",
        )
        self.assertEqual(
            body["controlled_promotion"]["product_promotion_execution"][
                "commit_sha"
            ],
            "abc1234",
        )
        self.assertTrue(
            body["controlled_promotion"]["product_promotion_execution"][
                "open_review_dry_run"
            ]
        )
        self.assertEqual(
            body["controlled_promotion"]["product_promotion_execution"][
                "operations"
            ][2]["status"],
            "blocked_until_review_merge",
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
        self.assertEqual(
            body["controlled_promotion"]["review_status"]["source_mode"],
            "product",
        )
        self.assertEqual(
            body["controlled_promotion"]["review_status"]["review_number"],
            12,
        )
        self.assertEqual(
            body["controlled_promotion"]["review_status"]["base_branch"],
            "main",
        )
        self.assertEqual(
            body["controlled_promotion"]["review_status"]["next_action"],
            "wait_for_review_merge",
        )
        self.assertEqual(
            body["controlled_promotion"]["review_status"]["operations"][1][
                "name"
            ],
            "inspect_review_status",
        )
        self.assertEqual(
            body["workflow"]["items"][15]["artifact_key"],
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT,
        )
        self.assertFalse(
            body["controlled_promotion"]["read_model_publication"]["published"]
        )
        self.assertEqual(
            body["controlled_promotion"]["read_model_publication"]["source_mode"],
            "product",
        )
        self.assertEqual(
            body["controlled_promotion"]["read_model_publication"]["status"],
            "dry_run",
        )
        self.assertEqual(
            body["controlled_promotion"]["read_model_publication"]["next_action"],
            "run_real_read_model_publication",
        )
        self.assertEqual(
            body["controlled_promotion"]["read_model_publication"][
                "product_review_status_report_ref"
            ],
            "runs/product_candidate_promotion_review_status_report.json",
        )
        self.assertEqual(
            body["workflow"]["items"][16]["artifact_key"],
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT,
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

    def test_build_workspace_projects_intake_clarification_lane(self) -> None:
        artifacts = {
            **_workspace_artifacts(),
            idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT: _intake_clarification_requests(),
            idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_ANSWERS_ARTIFACT: _intake_clarification_answers(),
            idea_to_spec_workspace.IDEA_INTAKE_ANSWER_RERUN_INPUT_ARTIFACT: _intake_answer_rerun_input(),
            idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_RERUN_REPORT_ARTIFACT: _intake_clarification_rerun_report(),
        }

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        lane = body["intake_clarification"]
        self.assertTrue(lane["available"])
        self.assertEqual(lane["clarification_requests"]["request_count"], 1)
        self.assertEqual(lane["clarification_requests"]["blocking_request_count"], 1)
        self.assertEqual(lane["clarification_answers"]["accepted_answer_count"], 1)
        self.assertEqual(
            lane["clarification_answers"]["answers"][0]["refs"],
            ["domain.team_decision_log"],
        )
        self.assertEqual(lane["rerun_input"]["accepted_target_count"], 1)
        self.assertEqual(lane["rerun_report"]["accepted_target_count"], 1)
        self.assertFalse(lane["action_boundary"]["may_execute_specgraph"])

    def test_build_workspace_projects_real_idea_answer_authoring(self) -> None:
        artifacts = {
            **_workspace_artifacts(),
            idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT: _intake_clarification_requests(),
            idea_to_spec_workspace.REAL_IDEA_ANSWER_TEMPLATE_ARTIFACT: _real_idea_answer_template(),
            idea_to_spec_workspace.REAL_IDEA_ANSWER_AUTHORING_REPORT_ARTIFACT: _real_idea_answer_authoring_report(),
            idea_to_spec_workspace.REAL_IDEA_ANSWER_SET_ARTIFACT: _real_idea_answer_set(),
        }

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        authoring = body["intake_clarification"]["answer_authoring"]
        self.assertTrue(authoring["available"])
        self.assertEqual(authoring["template"]["target_count"], 1)
        self.assertEqual(
            authoring["template"]["targets"][0]["target_type"],
            "active_frame_ref",
        )
        self.assertEqual(
            authoring["template"]["targets"][0]["required_fields_by_action"][
                "answer_question"
            ],
            ["value.refs[]"],
        )
        self.assertEqual(authoring["answer_set"]["answer_count"], 1)
        self.assertTrue(authoring["validation"]["ready"])
        self.assertFalse(authoring["action_boundary"]["may_execute_specgraph"])
        self.assertFalse(authoring["action_boundary"]["may_apply_answers"])

    def test_build_workspace_projects_real_idea_answer_continuation(self) -> None:
        artifacts = {
            **_workspace_artifacts(),
            idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT: _intake_clarification_requests(),
            idea_to_spec_workspace.REAL_IDEA_ANSWER_TEMPLATE_ARTIFACT: _real_idea_answer_template(),
            idea_to_spec_workspace.REAL_IDEA_ANSWER_SET_ARTIFACT: _real_idea_answer_set(),
            idea_to_spec_workspace.SPECSPACE_REAL_IDEA_ANSWER_IMPORT_PREVIEW_ARTIFACT: (
                _specspace_real_idea_answer_import_preview()
            ),
            idea_to_spec_workspace.REAL_IDEA_ANSWER_CONTINUATION_REPORT_ARTIFACT: (
                _real_idea_answer_continuation_report()
            ),
        }

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        continuation = body["intake_clarification"]["answer_continuation"]
        self.assertTrue(continuation["available"])
        self.assertTrue(continuation["ready"])
        self.assertEqual(continuation["import_preview"]["accepted_answer_count"], 1)
        self.assertEqual(
            continuation["continuation_report"]["readiness"]["review_state"],
            "real_idea_answer_continuation_ready",
        )
        self.assertEqual(
            continuation["continuation_report"]["outputs"]["validated_answers"],
            "runs/idea_intake_clarification_answers.json",
        )
        self.assertFalse(continuation["action_boundary"]["may_execute_specgraph"])
        self.assertFalse(continuation["action_boundary"]["may_apply_answers"])

    def test_build_workspace_rejects_write_capable_real_idea_answer_handoff(
        self,
    ) -> None:
        import_preview = _specspace_real_idea_answer_import_preview()
        import_preview["authority_boundary"]["may_execute_specgraph"] = True
        artifacts = {
            **_workspace_artifacts(),
            idea_to_spec_workspace.SPECSPACE_REAL_IDEA_ANSWER_IMPORT_PREVIEW_ARTIFACT: (
                import_preview
            ),
        }

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(
            body["artifacts"]["specspace_real_idea_answer_import_preview"]["reason"],
            "invalid_artifact_contract",
        )
        continuation = body["intake_clarification"]["answer_continuation"]
        self.assertFalse(continuation["import_preview"]["available"])

    def test_build_workspace_rejects_nested_raw_real_idea_answer_set(self) -> None:
        answer_set = _real_idea_answer_set()
        answer_set["answers"][0]["value"] = {
            "context": {"raw_operator_note": "private note"},
        }
        artifacts = {
            **_workspace_artifacts(),
            idea_to_spec_workspace.IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT: _intake_clarification_requests(),
            idea_to_spec_workspace.REAL_IDEA_ANSWER_TEMPLATE_ARTIFACT: _real_idea_answer_template(),
            idea_to_spec_workspace.REAL_IDEA_ANSWER_SET_ARTIFACT: answer_set,
        }

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(
            body["artifacts"]["real_idea_answer_set"]["reason"],
            "invalid_artifact_contract",
        )
        self.assertFalse(
            body["intake_clarification"]["answer_authoring"]["answer_set"][
                "available"
            ]
        )

    def test_idea_maturity_allows_missing_validation_as_untrusted_surface(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts.pop(idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT)

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        maturity = body["idea_maturity"]
        self.assertEqual(maturity["status"], "validation_unavailable")
        self.assertFalse(maturity["trusted"])
        self.assertTrue(maturity["report"]["available"])
        self.assertFalse(maturity["validation"]["available"])

    def test_idea_maturity_surfaces_validation_failure(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts[idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT] = (
            _idea_maturity_validation_report(status="invalid")
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        maturity = body["idea_maturity"]
        self.assertEqual(maturity["status"], "validation_failed")
        self.assertFalse(maturity["trusted"])
        self.assertEqual(maturity["validation"]["reports"][0]["status"], "invalid")

    def test_idea_maturity_trust_uses_full_validation_report_list(self) -> None:
        artifacts = _workspace_artifacts()
        validation = _idea_maturity_validation_report(status="ok")
        validation["summary"]["report_count"] = 9
        validation["summary"]["valid_count"] = 8
        validation["summary"]["invalid_count"] = 1
        validation["reports"] = [
            {
                "path": f"/tmp/runs/ok-{index}.json",
                "status": "ok",
                "diagnostics": [],
            }
            for index in range(8)
        ]
        validation["reports"].append(
            {
                "path": "/tmp/runs/idea_maturity_metrics_report.json",
                "status": "invalid",
                "diagnostics": [{"level": "error", "message": "late invalid report"}],
            }
        )
        artifacts[idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT] = (
            validation
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        maturity = body["idea_maturity"]
        self.assertEqual(maturity["status"], "validation_failed")
        self.assertFalse(maturity["trusted"])
        self.assertEqual(len(maturity["validation"]["reports"]), 8)

    def test_idea_maturity_normalizes_validation_paths(self) -> None:
        artifacts = _workspace_artifacts()

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(
            body["idea_maturity"]["validation"]["reports"][0]["path"],
            "runs/idea_maturity_metrics_report.json",
        )

    def test_idea_maturity_preserves_finding_next_action(self) -> None:
        artifacts = _workspace_artifacts()
        report = _idea_maturity_metrics_report()
        report["findings"] = [
            {
                "finding_id": "maturity.pre_sib.blocker",
                "severity": "warning",
                "message": "Candidate is blocked by Pre-SIB finding.",
                "source": "pre_sib",
                "next_action": "Inspect Pre-SIB coherence findings.",
            }
        ]
        artifacts[idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT] = report

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        finding = body["idea_maturity"]["report"]["findings"][0]
        self.assertEqual(
            finding["next_action"],
            "Inspect Pre-SIB coherence findings.",
        )

    def test_idea_maturity_reads_temporal_metrics_from_group(self) -> None:
        artifacts = _workspace_artifacts()
        report = _idea_maturity_metrics_report()
        report["metrics"].pop("time_to_first_candidate_seconds", None)
        report["groups"]["temporal_progress"][
            "time_to_first_candidate_seconds"
        ] = 0.125
        artifacts[idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT] = report

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(
            body["idea_maturity"]["report"]["metrics"][
                "time_to_first_candidate_seconds"
            ],
            0.125,
        )

    def test_idea_maturity_sanitizes_non_finite_group_and_summary_values(self) -> None:
        artifacts = _workspace_artifacts()
        report = _idea_maturity_metrics_report()
        report["groups"]["temporal_progress"][
            "time_to_first_candidate_seconds"
        ] = math.inf
        report["summary"]["candidate_gap_closure_rate"] = math.nan
        artifacts[idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT] = report

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertIsNone(
            body["idea_maturity"]["report"]["groups"]["temporal_progress"][
                "time_to_first_candidate_seconds"
            ]
        )
        self.assertIsNone(
            body["idea_maturity"]["report"]["summary"]["candidate_gap_closure_rate"]
        )
        json.dumps(body, allow_nan=False)

    def test_idea_maturity_quarantines_authority_expansion(self) -> None:
        artifacts = _workspace_artifacts()
        report = _idea_maturity_metrics_report()
        report["authority_boundary"]["may_mutate_canonical_specs"] = "true"
        artifacts[idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT] = report

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        maturity = body["idea_maturity"]
        self.assertEqual(maturity["status"], "invalid")
        self.assertFalse(maturity["trusted"])
        self.assertEqual(
            maturity["report_error"]["reason"],
            "invalid_artifact_contract",
        )
        self.assertFalse(body["artifacts"]["idea_maturity_metrics"]["available"])

    def test_approval_readiness_prefers_repaired_handoff(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts.pop(idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT)
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = _product_repair_rerun_execution_report()
        publication = _product_repair_rerun_publication_report()
        publication["published_artifacts"] = _published_repaired_artifacts()
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT
        ] = publication
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT
        ] = _repaired_handoff_report()
        artifacts[
            idea_to_spec_workspace.REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT
        ] = _active_candidate()
        repaired_session = _repaired_repair_session_journal()
        repaired_session["readiness_impact"]["platform_promotion_blocked_by"] = [
            "candidate_approval_decision_missing"
        ]
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT
        ] = repaired_session
        repaired_gate = _repaired_promotion_gate()
        repaired_gate["warnings"] = [
            {
                "finding_id": "pre_sib_findings_repaired_by_preview",
                "severity": "warning",
                "message": "Original pre-SIB findings are allowed because repair preview was used.",
                "source": "idea_to_spec_promotion_gate",
            }
        ]
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = repaired_gate

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        readiness = body["approval_readiness"]
        self.assertEqual(readiness["source_mode"], "repaired_handoff")
        self.assertEqual(readiness["status"], "approval_ready")
        self.assertTrue(readiness["candidate_repaired"])
        self.assertTrue(readiness["ready_for_candidate_approval"])
        self.assertFalse(readiness["ready_for_platform_promotion"])
        self.assertTrue(readiness["promotion_review_can_be_requested"])
        self.assertTrue(
            readiness["platform_approval_gate_can_materialize_decision"]
        )
        self.assertTrue(readiness["platform_rerun_executed"])
        self.assertTrue(readiness["platform_rerun_published"])
        self.assertTrue(readiness["repaired_artifacts_published"])
        self.assertEqual(readiness["resolved_ontology_gap_count"], 11)
        self.assertEqual(readiness["resolved_candidate_gap_count"], 4)
        self.assertEqual(readiness["unresolved_ontology_gap_count"], 0)
        self.assertEqual(readiness["unresolved_candidate_gap_count"], 0)
        self.assertEqual(readiness["remaining_blocker_count"], 0)
        self.assertNotIn("candidate_approval_decision_missing", readiness["blockers"])
        self.assertNotIn("pre_sib_findings_repaired_by_preview", readiness["blockers"])
        self.assertEqual(readiness["promotion_path_count"], 2)
        self.assertFalse(
            readiness["action_boundary"][
                "may_materialize_candidate_approval_decision"
            ]
        )

    def test_repaired_handoff_selects_repaired_workspace_surface(self) -> None:
        artifacts = _workspace_artifacts()
        repaired_active = _active_candidate()
        repaired_active["candidate"] = {
            **repaired_active["candidate"],
            "candidate_id": "local-subscription-control",
            "display_name": "Local Subscription Control",
            "public_route": "/local-subscription-control",
        }
        repaired_graph = {
            **_candidate_graph(),
            "active_frame": {
                "project": "LocalSubscriptionControl",
                "ontology_refs": ["ontology://specgraph-core"],
                "domain_refs": ["domain.local_subscription_control"],
                "context_refs": ["context.idea_to_spec"],
            },
            "nodes": [
                {
                    "id": "candidate-spec.subscription-product",
                    "title": "Subscription Product",
                    "kind": "product_boundary",
                    "ontology_refs": ["ontology://specgraph-core#Spec"],
                    "requirements": [{"id": "req.subscription.result"}],
                    "acceptance_criteria": [{"id": "ac.subscription.result"}],
                    "claims": [],
                    "gaps": [],
                }
            ],
            "edges": [],
        }
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT
        ] = _repaired_handoff_report()
        artifacts[
            idea_to_spec_workspace.REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT
        ] = repaired_active
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT
        ] = repaired_graph
        artifacts[
            idea_to_spec_workspace.REPAIRED_PRE_SIB_COHERENCE_REPORT_ARTIFACT
        ] = {
            **_pre_sib(),
            "readiness": {"ready": True, "review_state": "pre_sib_ready"},
            "findings": [],
        }
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = {
            **_repair_loop(),
            "readiness": {"ready": True, "review_state": "repair_preview_ready"},
            "summary": {"context_required_count": 0},
            "actions": [],
        }
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT
        ] = _materialization()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT
        ] = _repaired_repair_session_journal()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = _repaired_promotion_gate()

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workspace"]["id"], "local-subscription-control")
        self.assertEqual(body["workspace"]["display_name"], "Local Subscription Control")
        self.assertEqual(body["workspace"]["public_route"], "/local-subscription-control")
        self.assertEqual(body["candidate_graph"]["source_mode"], "repaired_handoff")
        self.assertEqual(
            body["candidate_graph"]["active_frame"]["project"],
            "LocalSubscriptionControl",
        )
        self.assertEqual(body["candidate_graph"]["summary"]["node_count"], 1)
        self.assertEqual(
            body["candidate_graph"]["nodes"][0]["id"],
            "candidate-spec.subscription-product",
        )
        self.assertEqual(
            body["repair_review"]["rerun_preview"]["candidate_quality_preview"][
                "unresolved_ontology_gap_count"
            ],
            0,
        )
        self.assertEqual(body["summary"]["promotion_path_count"], 2)

    def test_approval_readiness_requires_all_rendered_repaired_artifacts_published(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        artifacts.pop(idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT)
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = _product_repair_rerun_execution_report()
        publication = _product_repair_rerun_publication_report()
        publication["published_artifacts"] = [
            artifact
            for artifact in _published_repaired_artifacts()
            if artifact
            != f"runs/{idea_to_spec_workspace.REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT}"
        ]
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT
        ] = publication
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT
        ] = _repaired_handoff_report()
        artifacts[
            idea_to_spec_workspace.REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT
        ] = _active_candidate()
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT
        ] = _candidate_graph()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT
        ] = _repaired_repair_session_journal()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = _repaired_promotion_gate()

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        readiness = body["approval_readiness"]
        self.assertFalse(readiness["repaired_artifacts_published"])
        self.assertIn("repaired_artifacts_not_published", readiness["blockers"])

    def test_approval_readiness_allows_legacy_missing_rerun_reports(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts.pop(idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT)
        artifacts.pop(
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT,
            None,
        )
        artifacts.pop(
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT,
            None,
        )
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _repaired_repair_session_journal()
        )
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT] = (
            _repaired_promotion_gate()
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        readiness = body["approval_readiness"]
        self.assertEqual(readiness["source_mode"], "standard")
        self.assertTrue(readiness["platform_rerun_executed"])
        self.assertTrue(readiness["platform_rerun_published"])
        self.assertTrue(readiness["promotion_review_can_be_requested"])
        self.assertTrue(
            readiness["platform_approval_gate_can_materialize_decision"]
        )

    def test_approval_readiness_blocks_unpublished_repaired_artifacts(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts.pop(idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT)
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = _product_repair_rerun_execution_report()
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT
        ] = _product_repair_rerun_publication_report()
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT
        ] = _repaired_handoff_report()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT
        ] = _repaired_repair_session_journal()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = _repaired_promotion_gate()

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        readiness = body["approval_readiness"]
        self.assertFalse(readiness["repaired_artifacts_published"])
        self.assertFalse(readiness["promotion_review_can_be_requested"])
        self.assertIn("repaired_artifacts_not_published", readiness["blockers"])

    def test_approval_readiness_blocks_empty_promotion_paths(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts.pop(idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT)
        publication = _product_repair_rerun_publication_report()
        publication["published_artifacts"] = _published_repaired_artifacts()
        repaired_session = _repaired_repair_session_journal()
        repaired_session["readiness_impact"]["promotion_path_count"] = 0
        repaired_gate = _repaired_promotion_gate()
        repaired_gate["promotion_request"]["paths"] = []
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = _product_repair_rerun_execution_report()
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT
        ] = publication
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT
        ] = _repaired_handoff_report()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT
        ] = repaired_session
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = repaired_gate

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        readiness = body["approval_readiness"]
        self.assertEqual(readiness["promotion_path_count"], 0)
        self.assertFalse(readiness["promotion_review_can_be_requested"])
        self.assertIn("promotion_paths_missing", readiness["blockers"])

    def test_approval_readiness_uses_fallback_for_invalid_handoff_counts(self) -> None:
        artifacts = _workspace_artifacts()
        handoff = _repaired_handoff_report()
        handoff["summary"] = {
            **handoff["summary"],
            "resolved_ontology_gap_count": None,
            "unresolved_ontology_gap_count": None,
            "removed_gap_count": None,
            "resolved_candidate_gap_count": None,
            "unresolved_candidate_gap_count": None,
        }
        artifacts[
            idea_to_spec_workspace.REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT
        ] = handoff
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT
        ] = _repaired_repair_session_journal()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = _repaired_promotion_gate()

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        readiness = body["approval_readiness"]
        self.assertEqual(readiness["resolved_ontology_gap_count"], 11)
        self.assertEqual(readiness["unresolved_ontology_gap_count"], 0)
        self.assertEqual(readiness["removed_gap_count"], 15)
        self.assertEqual(readiness["resolved_candidate_gap_count"], 0)
        self.assertEqual(readiness["unresolved_candidate_gap_count"], 0)

    def test_approval_readiness_marks_partial_repaired_source_mode(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT
        ] = _repaired_repair_session_journal()
        artifacts[
            idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = _repaired_promotion_gate()

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        readiness = body["approval_readiness"]
        self.assertEqual(readiness["source_mode"], "partial_repaired")
        self.assertEqual(
            readiness["source_refs"]["repair_session"],
            "runs/repaired_idea_to_spec_repair_session.json",
        )
        self.assertEqual(
            readiness["source_refs"]["promotion_gate"],
            "runs/repaired_idea_to_spec_promotion_gate.json",
        )

    def test_repair_review_falls_back_to_legacy_artifacts_without_journal(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts.pop(idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT)

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertFalse(body["repair_session"]["available"])
        self.assertEqual(body["repair_session"]["source_mode"], "legacy_artifacts")
        self.assertEqual(body["summary"]["unresolved_ontology_gap_count"], 0)
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

    def test_repair_review_counts_journal_decisions_without_legacy_artifact(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertFalse(body["repair_review"]["ontology_decisions"]["available"])
        self.assertEqual(
            body["repair_review"]["ontology_decisions"]["decision_count"],
            1,
        )
        self.assertEqual(body["summary"]["ontology_decision_count"], 1)
        self.assertEqual(
            body["repair_review"]["ontology_decisions"]["decisions"][0][
                "decision_type"
            ],
            "propose_project_local_term",
        )

    def test_repair_session_stage_index_rejects_boolean_values(self) -> None:
        artifacts = _workspace_artifacts()
        repair_session = _repair_session_journal()
        repair_session["workflow_journal"]["stages"][0]["index"] = True
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            repair_session
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertIsNone(body["repair_session"]["stages"][0]["index"])

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
        self.assertEqual(body["summary"]["available_artifact_count"], 23)
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

    def test_build_workspace_rejects_unknown_raw_repair_session_privacy_flag(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        repair_session = _repair_session_journal()
        repair_session["privacy_boundary"] = {
            **repair_session["privacy_boundary"],
            "raw_clarification_text_published": True,
        }
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            repair_session
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(
            body["artifacts"]["repair_session"]["reason"],
            "invalid_artifact_contract",
        )
        self.assertFalse(body["repair_session"]["available"])
        self.assertEqual(body["repair_session"]["source_mode"], "legacy_artifacts")
        self.assertEqual(body["summary"]["resolved_ontology_gap_count"], 1)

    def test_build_workspace_rejects_write_capable_repair_session_action_boundary(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        repair_session = _repair_session_journal()
        repair_session["action_boundary"] = {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_apply_answers": False,
            "may_apply_decisions": False,
            "may_mutate_candidate_artifacts": False,
            "may_accept_ontology_terms": False,
            "may_write_ontology_package": False,
            "may_create_branch_or_commit": True,
        }
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            repair_session
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(
            body["artifacts"]["repair_session"]["reason"],
            "invalid_artifact_contract",
        )
        self.assertFalse(body["repair_session"]["available"])

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
        self.assertEqual(body["summary"]["platform_missing_artifact_count"], 10)
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

    def test_build_workspace_reports_repair_handoff_contract_errors(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts[
            idea_to_spec_workspace.SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT
        ] = {
            "artifact_kind": "specspace_repair_draft_import_preview",
            "schema_version": 1,
            "canonical_mutations_allowed": False,
            "tracked_artifacts_written": True,
            "summary": {"status": "repair_draft_import_preview_ready"},
        }

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        artifact = body["artifacts"]["specspace_repair_draft_import_preview"]
        self.assertFalse(artifact["available"])
        self.assertEqual(artifact["reason"], "invalid_artifact_contract")
        self.assertIn("SpecSpace repair draft handoff", artifact["detail"])

    def test_build_workspace_allows_product_read_model_publication_only(self) -> None:
        artifacts = _workspace_artifacts()
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        ] = _product_read_model_publication(published=True)

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertTrue(
            body["artifacts"]["product_read_model_publication"]["available"]
        )
        self.assertTrue(
            body["controlled_promotion"]["read_model_publication"][
                "read_model_published"
            ]
        )

        zero_file_count_artifacts = _workspace_artifacts()
        zero_file_count_report = _product_read_model_publication(published=True)
        zero_file_count_report["summary"]["file_count"] = 0
        zero_file_count_report["graph_repository_publish_read_model"]["summary"][
            "file_count"
        ] = 7
        zero_file_count_artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        ] = zero_file_count_report

        zero_file_count_body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=zero_file_count_artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(
            zero_file_count_body["controlled_promotion"][
                "read_model_publication"
            ]["file_count"],
            0,
        )

        unsafe_artifacts = _workspace_artifacts()
        unsafe_report = _product_read_model_publication(published=True)
        unsafe_report["authority_boundary"] = {
            **unsafe_report["authority_boundary"],
            "private_artifact_publication": True,
        }
        unsafe_artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        ] = unsafe_report

        unsafe_body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=unsafe_artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        artifact = unsafe_body["artifacts"]["product_read_model_publication"]
        self.assertFalse(artifact["available"])
        self.assertEqual(artifact["reason"], "invalid_artifact_contract")

        unknown_flag_artifacts = _workspace_artifacts()
        unknown_flag_report = _product_read_model_publication(published=True)
        unknown_flag_report["authority_boundary"] = {
            **unknown_flag_report["authority_boundary"],
            "future_write_capability": True,
        }
        unknown_flag_artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        ] = unknown_flag_report

        unknown_flag_body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=unknown_flag_artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertFalse(
            unknown_flag_body["artifacts"]["product_read_model_publication"][
                "available"
            ]
        )

        canonical_write_artifacts = _workspace_artifacts()
        canonical_write_report = _product_read_model_publication(published=True)
        canonical_write_report["canonical_mutations_allowed"] = True
        canonical_write_artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        ] = canonical_write_report

        canonical_write_body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=canonical_write_artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertFalse(
            canonical_write_body["artifacts"]["product_read_model_publication"][
                "available"
            ]
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
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
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
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        )
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

    def test_workflow_blocks_failed_product_promotion_execution_artifact(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
            "next_artifact": "candidate promotion execution",
        }
        promotion_gate["findings"] = []
        promotion_gate["warnings"] = []
        repair_loop = _repair_loop()
        repair_loop["summary"]["context_required_count"] = 0
        execution = _product_promotion_execution()
        execution["ok"] = False
        execution["summary"]["error_count"] = 1
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = execution

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(
            body["workflow"]["stage"],
            "product_promotion_execution_failed",
        )
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "product_promotion_execution_repair",
        )
        self.assertEqual(_guided_stage(body, "git_dry_run")["status"], "blocked")
        self.assertIn(
            "promotion_execution_failed",
            _guided_stage(body, "git_dry_run")["blockers"],
        )

    def test_workflow_preserves_legacy_git_service_open_review_handoff(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        promotion_gate = _promotion_gate()
        promotion_gate["readiness"] = {
            "ready": True,
            "review_state": "idea_to_spec_promotion_ready",
            "blocked_by": [],
            "next_artifact": "repository review",
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
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "review_dry_run_ready")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "git_service_open_review",
        )
        self.assertEqual(
            body["workflow"]["next_handoff"]["artifact_key"],
            "git_service_execution",
        )

    def test_product_promotion_diagnostics_do_not_count_as_errors(
        self,
    ) -> None:
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
        product_execution = _product_promotion_execution()
        product_execution["open_review_dry_run"] = False
        product_execution["git_review"]["open_review_dry_run"] = False
        product_execution["git_review"]["review_opened"] = True
        product_execution["summary"]["error_count"] = 0
        product_execution["diagnostics"] = [
            {
                "level": "WARNING",
                "code": "non_blocking_note",
                "subject": "product_promotion_execution",
                "message": "non-error diagnostic",
            }
        ]
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = product_execution
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        )
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        )
        artifacts.pop(
            idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
        )
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

        self.assertEqual(body["workflow"]["stage"], "review_status_required")
        self.assertEqual(
            body["controlled_promotion"]["product_promotion_execution"][
                "error_count"
            ],
            0,
        )
        self.assertEqual(
            body["controlled_promotion"]["product_promotion_execution"][
                "diagnostic_count"
            ],
            1,
        )

    def test_product_promotion_dry_run_requires_non_dry_run_execution(
        self,
    ) -> None:
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
        product_execution = _product_promotion_execution()
        product_execution["dry_run"] = True
        product_execution["open_review_dry_run"] = False
        product_execution["git_review"]["open_review_dry_run"] = False
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = product_execution
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        )
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        )
        artifacts.pop(
            idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
        )
        artifacts.pop(
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT
        )

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "review_dry_run_ready")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "product_candidate_promotion_open_review",
        )
        self.assertEqual(_guided_stage(body, "git_dry_run")["status"], "available")
        self.assertEqual(
            _guided_stage(body, "review_publication")["status"],
            "blocked",
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
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts.pop(
            idea_to_spec_workspace.PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT
        )
        artifacts.pop(idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT)
        artifacts.pop(idea_to_spec_workspace.GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT)
        artifacts.pop(idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT)
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        )
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        )
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
        self.assertEqual(
            body["workflow"]["next_handoff"]["artifact_key"],
            "candidate_approval_execution",
        )
        self.assertIn(
            "product-candidate-approval approve",
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
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
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
        self.assertEqual(
            _guided_stage(body, "candidate_approval_intent")["status"],
            "blocked",
        )
        self.assertIn(
            "decision_rejected",
            _guided_stage(body, "candidate_approval_intent")["blockers"],
        )

    def test_workflow_blocks_stale_promotion_when_repair_session_not_ready(
        self,
    ) -> None:
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

        self.assertEqual(body["workflow"]["stage"], "repair_session_review_required")
        self.assertEqual(
            body["workflow"]["next_handoff"]["artifact_key"],
            "repair_session",
        )
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "operator_repair_review",
        )

    def test_repair_rerun_publication_does_not_override_journal_blocker(
        self,
    ) -> None:
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
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = _product_repair_rerun_execution_report()

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "repair_session_review_required")
        self.assertEqual(body["workflow"]["status"], "blocked")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "operator_repair_review",
        )

    def test_repair_rerun_dry_run_execution_does_not_prompt_publish(self) -> None:
        artifacts = self._repair_rerun_ready_artifacts()
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = _product_repair_rerun_execution_report(dry_run=True)

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "repair_rerun_execution_dry_run")
        self.assertEqual(body["workflow"]["status"], "operator_review_required")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "product_repair_rerun_execution",
        )
        self.assertIsNone(body["workflow"]["next_handoff"]["command_template"])

    def test_repair_rerun_execution_requires_publication_when_unblocked(self) -> None:
        artifacts = self._repair_rerun_ready_artifacts()
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = _product_repair_rerun_execution_report()

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "repair_rerun_publication_required")
        self.assertEqual(body["workflow"]["status"], "ready_for_handoff")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "product_repair_rerun_publication",
        )

    def test_repair_rerun_dry_run_publication_still_requires_publication(
        self,
    ) -> None:
        artifacts = self._repair_rerun_ready_artifacts()
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = _product_repair_rerun_execution_report()
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT
        ] = _product_repair_rerun_publication_report(dry_run=True)

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "repair_rerun_publication_required")
        self.assertEqual(body["workflow"]["status"], "ready_for_handoff")
        self.assertEqual(
            body["workflow"]["items"][7]["status"],
            "dry_run",
        )

    def test_repair_rerun_publication_failure_blocks_workflow(self) -> None:
        artifacts = self._repair_rerun_ready_artifacts()
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = _product_repair_rerun_execution_report()
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT
        ] = _product_repair_rerun_publication_report(ok=False)

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "repair_rerun_publication_failed")
        self.assertEqual(body["workflow"]["status"], "blocked")
        self.assertEqual(
            body["workflow"]["next_handoff"]["kind"],
            "product_repair_rerun_publication_repair",
        )

    def test_platform_repair_rerun_reports_are_optional(self) -> None:
        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=_workspace_artifacts(),
            source={"provider": "fixture", "read_only": True},
        )

        self.assertFalse(body["repair_review"]["platform_execution"]["available"])
        self.assertFalse(
            body["artifacts"]["product_repair_rerun_execution"]["available"]
        )

    def test_platform_repair_rerun_authority_expansion_drops_report(self) -> None:
        artifacts = _workspace_artifacts()
        execution = _product_repair_rerun_execution_report()
        execution["authority_boundary"]["executes_git_commands"] = True
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = execution

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertFalse(body["repair_review"]["platform_execution"]["available"])
        self.assertFalse(
            body["artifacts"]["product_repair_rerun_execution"]["available"]
        )

    def test_candidate_approval_execution_authority_expansion_drops_report(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        execution = _candidate_approval_execution()
        execution["authority_boundary"]["may_create_branch_or_commit"] = True
        artifacts[
            idea_to_spec_workspace.PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT
        ] = execution

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertFalse(
            body["controlled_promotion"]["candidate_approval_execution"][
                "available"
            ]
        )
        self.assertFalse(
            body["artifacts"]["candidate_approval_execution"]["available"]
        )
        self.assertEqual(
            body["artifacts"]["candidate_approval_execution"]["reason"],
            "invalid_artifact_contract",
        )

    def test_product_promotion_execution_authority_expansion_drops_report(
        self,
    ) -> None:
        artifacts = _workspace_artifacts()
        execution = _product_promotion_execution()
        execution["authority_boundary"]["publishes_read_models"] = True
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = execution

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertFalse(
            body["controlled_promotion"]["product_promotion_execution"][
                "available"
            ]
        )
        self.assertFalse(
            body["artifacts"]["product_promotion_execution"]["available"]
        )
        self.assertEqual(
            body["artifacts"]["product_promotion_execution"]["reason"],
            "invalid_artifact_contract",
        )

    def test_platform_repair_rerun_output_artifacts_are_limited(self) -> None:
        artifacts = _workspace_artifacts()
        execution = _product_repair_rerun_execution_report()
        execution["output_artifacts"] = {
            f"artifact_{index}": {
                "path": f"runs/artifact_{index}.json",
                "present": True,
                "ready": True,
            }
            for index in range(
                idea_to_spec_workspace.DISPLAY_LIMITS[
                    "product_repair_rerun_output_artifacts"
                ]
                + 5
            )
        }
        artifacts[
            idea_to_spec_workspace.PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
        ] = execution

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(
            len(
                body["repair_review"]["platform_execution"]["execution"][
                    "output_artifacts"
                ]
            ),
            idea_to_spec_workspace.DISPLAY_LIMITS[
                "product_repair_rerun_output_artifacts"
            ],
        )

    def _repair_rerun_ready_artifacts(self) -> dict[str, dict]:
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
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        return artifacts

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
        product_execution = _product_promotion_execution()
        product_execution["open_review_dry_run"] = False
        product_execution["git_review"]["open_review_dry_run"] = False
        product_execution["git_review"]["review_opened"] = True
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts[
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = execution
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = product_execution
        artifacts[
            idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _review_status("open")
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _product_review_status("open")

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
        product_execution = _product_promotion_execution()
        product_execution["open_review_dry_run"] = False
        product_execution["git_review"]["open_review_dry_run"] = False
        product_execution["git_review"]["review_opened"] = True
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts[
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = execution
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = product_execution
        artifacts[
            idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _review_status("merged")
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _product_review_status("merged")
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        )
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

    def test_guided_flow_blocks_failed_review_status(self) -> None:
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
        product_execution = _product_promotion_execution()
        product_execution["open_review_dry_run"] = False
        product_execution["git_review"]["open_review_dry_run"] = False
        product_execution["git_review"]["review_opened"] = True
        review_status = _product_review_status("open")
        review_status["ok"] = False
        review_status["summary"]["error_count"] = 1
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = product_execution
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        ] = review_status
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        )
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

        self.assertEqual(body["workflow"]["stage"], "post_review_failed")
        self.assertEqual(
            _guided_stage(body, "review_publication")["status"],
            "blocked",
        )
        self.assertIn(
            "review_status_failed",
            _guided_stage(body, "review_publication")["blockers"],
        )

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
        product_execution = _product_promotion_execution()
        product_execution["open_review_dry_run"] = False
        product_execution["git_review"]["open_review_dry_run"] = False
        product_execution["git_review"]["review_opened"] = True
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts[
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = execution
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = product_execution
        artifacts[
            idea_to_spec_workspace.GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _review_status("merged")
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _product_review_status("merged")
        artifacts[
            idea_to_spec_workspace.GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT
        ] = _read_model_publication(published=True)
        product_publication = _product_read_model_publication(published=True)
        product_publication["summary"].pop("read_model_published")
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        ] = product_publication
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
        self.assertEqual(body["guided_flow"]["overall_status"], "completed")
        self.assertEqual(
            _guided_stage(body, "review_publication")["status"],
            "completed",
        )

    def test_guided_flow_marks_finalization_only_publication_completed(self) -> None:
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
        product_execution = _product_promotion_execution()
        product_execution["open_review_dry_run"] = False
        product_execution["git_review"]["open_review_dry_run"] = False
        product_execution["git_review"]["review_opened"] = True
        artifacts[
            idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
        ] = promotion_gate
        artifacts[
            idea_to_spec_workspace.CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
        ] = repair_loop
        artifacts[idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT] = (
            _promotion_ready_repair_session_journal()
        )
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
        ] = product_execution
        artifacts[
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        ] = _product_review_status("merged")
        artifacts.pop(
            idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        )
        artifacts.pop(
            idea_to_spec_workspace.GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT
        )
        artifacts[
            idea_to_spec_workspace.GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT
        ] = _promotion_finalization(read_model_published=True)

        body = idea_to_spec_workspace.build_idea_to_spec_workspace(
            artifacts=artifacts,
            source={"provider": "fixture", "read_only": True},
        )

        self.assertEqual(body["workflow"]["stage"], "read_model_published")
        self.assertTrue(body["summary"]["read_model_published"])
        self.assertEqual(body["guided_flow"]["overall_status"], "completed")
        self.assertEqual(
            _guided_stage(body, "review_publication")["status"],
            "completed",
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
            _write_json(
                runs_dir / idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT,
                _idea_maturity_metrics_report(),
            )
            _write_json(
                runs_dir
                / idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT,
                _idea_maturity_validation_report(),
            )
            provider = specspace_provider.FileSpecGraphProvider(
                spec_nodes_dir=None,
                runs_dir=runs_dir,
                specgraph_dir=root,
            )

            status, body = provider.read_artifact_catalog()
            content_status, content_body = provider.read_artifact_content(
                "runs/idea_maturity_metrics_report.json"
            )

        self.assertEqual(status, HTTPStatus.OK)
        paths = {entry["path"] for entry in body["artifacts"]}
        self.assertIn("runs/candidate_repair_loop_report.json", paths)
        self.assertIn("runs/candidate_spec_materialization_report.json", paths)
        self.assertIn("runs/idea_to_spec_promotion_gate.json", paths)
        self.assertIn("runs/graph_repository_promotion_request.json", paths)
        self.assertIn("runs/git_service_promotion_execution_report.json", paths)
        self.assertNotIn("runs/candidate_spec_graph_seed.json", paths)
        self.assertNotIn("runs/idea_maturity_metrics_report.json", paths)
        self.assertNotIn("runs/idea_maturity_metrics_validation_report.json", paths)
        self.assertEqual(content_status, HTTPStatus.NOT_FOUND)
        self.assertEqual(content_body["reason"], "missing_artifact")

    def test_http_provider_reads_workspace_runs_from_manifest(self) -> None:
        workspace_artifacts = _workspace_artifacts()
        manifest = {
            "artifact_kind": "specgraph_static_artifact_manifest",
            "files": [
                {
                    "path": f"runs/{filename}",
                    "root": "runs",
                    "sha256": "0" * 64,
                    "size_bytes": 100,
                }
                for filename in workspace_artifacts
            ],
        }
        payloads = {
            f"https://artifact.test/runs/{filename}": json.dumps(payload)
            for filename, payload in workspace_artifacts.items()
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
