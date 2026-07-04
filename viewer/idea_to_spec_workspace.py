"""Read-only Idea-to-Spec workspace read model."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from viewer import idea_maturity
from viewer.real_idea_answer_authoring_contract import (
    real_idea_answer_authoring_contract_error,
    real_idea_answer_set_contract_error,
)

IDEA_TO_SPEC_WORKSPACE_ARTIFACT_KIND = "specspace_idea_to_spec_workspace"
ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT = "active_idea_to_spec_candidate.json"
IDEA_EVENT_STORMING_INTAKE_ARTIFACT = "idea_event_storming_intake.json"
IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT = (
    "idea_intake_clarification_requests.json"
)
IDEA_INTAKE_CLARIFICATION_ANSWERS_ARTIFACT = (
    "idea_intake_clarification_answers.json"
)
IDEA_INTAKE_ANSWER_RERUN_INPUT_ARTIFACT = "idea_intake_answer_rerun_input.json"
CLARIFIED_USER_IDEA_INTAKE_SESSION_ARTIFACT = (
    "clarified_user_idea_intake_session.json"
)
CLARIFIED_USER_IDEA_INTAKE_SOURCE_ARTIFACT = "clarified_user_idea_intake_source.json"
IDEA_INTAKE_CLARIFICATION_RERUN_REPORT_ARTIFACT = (
    "idea_intake_clarification_rerun_report.json"
)
REAL_IDEA_ANSWER_TEMPLATE_ARTIFACT = (
    "real_idea_smoke/real_idea_answer_template.json"
)
REAL_IDEA_ANSWER_AUTHORING_REPORT_ARTIFACT = (
    "real_idea_smoke/real_idea_answer_authoring_report.json"
)
REAL_IDEA_ANSWER_SET_ARTIFACT = "real_idea_smoke/real_idea_answer_set.json"
SPECSPACE_REAL_IDEA_ANSWER_IMPORT_PREVIEW_ARTIFACT = (
    "real_idea_smoke/specspace_real_idea_answer_import_preview.json"
)
REAL_IDEA_ANSWER_CONTINUATION_REPORT_ARTIFACT = (
    "real_idea_smoke/real_idea_answer_continuation_report.json"
)
PLATFORM_REAL_IDEA_ENTRY_INTAKE_EXECUTION_REPORT_ARTIFACT = (
    "platform_real_idea_entry_intake_execution_report.json"
)
PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_PLAN_ARTIFACT = (
    "product_workspace_initialization_plan.json"
)
PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT = (
    "product_workspace_initialization_execution_request.json"
)
PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT = (
    "platform_product_workspace_initialization_execution_report.json"
)
CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT = "candidate_spec_graph_seed.json"
CANDIDATE_SPEC_GRAPH_ARTIFACT = "candidate_spec_graph.json"
CANDIDATE_OVERVIEW_ARTIFACT = "candidate_overview.json"
PRE_SIB_COHERENCE_REPORT_ARTIFACT = "pre_sib_coherence_report.json"
CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT = "candidate_repair_loop_report.json"
IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT = (
    "idea_to_spec_clarification_requests.json"
)
IDEA_TO_SPEC_CLARIFICATION_ANSWERS_ARTIFACT = (
    "idea_to_spec_clarification_answers.json"
)
PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT = (
    "product_ontology_gap_review_decisions.json"
)
PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT = (
    "project_local_ontology_review_lane.json"
)
SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_PREVIEW_ARTIFACT = (
    "specspace_project_local_ontology_decision_import_preview.json"
)
PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_REPORT_ARTIFACT = (
    "project_local_ontology_decision_effect_report.json"
)
IDEA_TO_SPEC_ANSWER_RERUN_INPUT_ARTIFACT = "idea_to_spec_answer_rerun_input.json"
IDEA_TO_SPEC_RERUN_PREVIEW_ARTIFACT = "idea_to_spec_rerun_preview.json"
IDEA_TO_SPEC_RERUN_MATERIALIZATION_ARTIFACT = (
    "idea_to_spec_rerun_materialization.json"
)
IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT = "idea_to_spec_repair_session.json"
SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT = (
    "specspace_repair_draft_import_preview.json"
)
SPECSPACE_REPAIR_DRAFT_RERUN_REPORT_ARTIFACT = (
    "specspace_repair_draft_rerun_report.json"
)
SPECSPACE_REPAIR_RERUN_REQUEST_GATE_ARTIFACT = (
    "specspace_repair_rerun_request_gate.json"
)
PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT = (
    "platform_product_repair_rerun_execution_report.json"
)
PLATFORM_PRODUCT_REPAIR_DRAFT_IMPORT_EXECUTION_REPORT_ARTIFACT = (
    "platform_product_repair_draft_import_preview_execution_report.json"
)
PLATFORM_PRODUCT_REPAIR_RERUN_REQUEST_GATE_EXECUTION_REPORT_ARTIFACT = (
    "platform_product_repair_rerun_request_gate_execution_report.json"
)
PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT = (
    "platform_product_repair_rerun_publication_report.json"
)
REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT = (
    "repaired_candidate_promotion_handoff_report.json"
)
REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT = (
    "repaired_active_idea_to_spec_candidate.json"
)
REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT = "repaired_candidate_spec_graph.json"
REPAIRED_PRE_SIB_COHERENCE_REPORT_ARTIFACT = "repaired_pre_sib_coherence_report.json"
REPAIRED_CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT = (
    "repaired_candidate_repair_loop_report.json"
)
REPAIRED_CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT = (
    "repaired_candidate_spec_materialization_report.json"
)
REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT = (
    "repaired_idea_to_spec_repair_session.json"
)
REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT = (
    "repaired_idea_to_spec_promotion_gate.json"
)
CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT = (
    "candidate_spec_materialization_report.json"
)
IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT = "idea_to_spec_promotion_gate.json"
PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT = (
    "platform_candidate_approval_execution_report.json"
)
CANDIDATE_APPROVAL_DECISION_ARTIFACT = "candidate_approval_decision.json"
GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT = "graph_repository_promotion_request.json"
PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT = (
    "product_candidate_promotion_execution_report.json"
)
GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT = (
    "git_service_promotion_execution_report.json"
)
GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT = (
    "graph_repository_review_status_report.json"
)
GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT = (
    "graph_repository_publish_read_model_report.json"
)
PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT = (
    "product_candidate_promotion_review_status_report.json"
)
PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT = (
    "product_candidate_promotion_read_model_publication_report.json"
)
GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT = (
    "git_service_promotion_finalization_report.json"
)

CORE_WORKSPACE_RUN_ARTIFACTS: tuple[str, ...] = (
    IDEA_EVENT_STORMING_INTAKE_ARTIFACT,
    CANDIDATE_SPEC_GRAPH_ARTIFACT,
    PRE_SIB_COHERENCE_REPORT_ARTIFACT,
    CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT,
    CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT,
    IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT,
)
OPTIONAL_WORKSPACE_RUN_ARTIFACTS: tuple[str, ...] = (
    IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT,
    IDEA_INTAKE_CLARIFICATION_ANSWERS_ARTIFACT,
    IDEA_INTAKE_ANSWER_RERUN_INPUT_ARTIFACT,
    CLARIFIED_USER_IDEA_INTAKE_SESSION_ARTIFACT,
    CLARIFIED_USER_IDEA_INTAKE_SOURCE_ARTIFACT,
    IDEA_INTAKE_CLARIFICATION_RERUN_REPORT_ARTIFACT,
    REAL_IDEA_ANSWER_TEMPLATE_ARTIFACT,
    REAL_IDEA_ANSWER_AUTHORING_REPORT_ARTIFACT,
    REAL_IDEA_ANSWER_SET_ARTIFACT,
    SPECSPACE_REAL_IDEA_ANSWER_IMPORT_PREVIEW_ARTIFACT,
    REAL_IDEA_ANSWER_CONTINUATION_REPORT_ARTIFACT,
    PLATFORM_REAL_IDEA_ENTRY_INTAKE_EXECUTION_REPORT_ARTIFACT,
    PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_PLAN_ARTIFACT,
    PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
    PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
    CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT,
    IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT,
    IDEA_TO_SPEC_CLARIFICATION_ANSWERS_ARTIFACT,
    PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT,
    PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT,
    SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_PREVIEW_ARTIFACT,
    PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_REPORT_ARTIFACT,
    CANDIDATE_OVERVIEW_ARTIFACT,
    IDEA_TO_SPEC_ANSWER_RERUN_INPUT_ARTIFACT,
    IDEA_TO_SPEC_RERUN_PREVIEW_ARTIFACT,
    IDEA_TO_SPEC_RERUN_MATERIALIZATION_ARTIFACT,
    IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT,
    SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT,
    SPECSPACE_REPAIR_DRAFT_RERUN_REPORT_ARTIFACT,
    SPECSPACE_REPAIR_RERUN_REQUEST_GATE_ARTIFACT,
    # Platform execution reports are public-safe telemetry. They expose
    # sanitized refs/status/digests so Product Workspace can show handoff
    # progress, but they do not grant execution or mutation authority.
    PLATFORM_PRODUCT_REPAIR_DRAFT_IMPORT_EXECUTION_REPORT_ARTIFACT,
    PLATFORM_PRODUCT_REPAIR_RERUN_REQUEST_GATE_EXECUTION_REPORT_ARTIFACT,
    PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT,
    PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT,
    REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT,
    REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
    REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT,
    REPAIRED_PRE_SIB_COHERENCE_REPORT_ARTIFACT,
    REPAIRED_CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT,
    REPAIRED_CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT,
    REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT,
    REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT,
)
PLATFORM_PROMOTION_ARTIFACTS: tuple[str, ...] = (
    PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT,
    CANDIDATE_APPROVAL_DECISION_ARTIFACT,
    GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT,
    PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
    GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
    PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT,
    PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT,
    GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT,
    GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT,
    GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT,
)
IDEA_MATURITY_ARTIFACTS: tuple[str, ...] = (
    idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT,
    idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT,
)
REAL_IDEA_ANSWER_AUTHORING_ARTIFACTS: tuple[str, ...] = (
    REAL_IDEA_ANSWER_TEMPLATE_ARTIFACT,
    REAL_IDEA_ANSWER_AUTHORING_REPORT_ARTIFACT,
)
SPECSPACE_REPAIR_DRAFT_HANDOFF_ARTIFACTS: tuple[str, ...] = (
    SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT,
    SPECSPACE_REPAIR_DRAFT_RERUN_REPORT_ARTIFACT,
)
WORKSPACE_RUN_ARTIFACTS: tuple[str, ...] = (
    ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
    IDEA_EVENT_STORMING_INTAKE_ARTIFACT,
    *OPTIONAL_WORKSPACE_RUN_ARTIFACTS,
    CANDIDATE_SPEC_GRAPH_ARTIFACT,
    PRE_SIB_COHERENCE_REPORT_ARTIFACT,
    CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT,
    CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT,
    IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT,
    *PLATFORM_PROMOTION_ARTIFACTS,
    *IDEA_MATURITY_ARTIFACTS,
)

ARTIFACT_KEYS: dict[str, str] = {
    ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT: "active_candidate",
    IDEA_EVENT_STORMING_INTAKE_ARTIFACT: "event_storming_intake",
    IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT: "intake_clarification_requests",
    IDEA_INTAKE_CLARIFICATION_ANSWERS_ARTIFACT: "intake_clarification_answers",
    IDEA_INTAKE_ANSWER_RERUN_INPUT_ARTIFACT: "intake_answer_rerun_input",
    CLARIFIED_USER_IDEA_INTAKE_SESSION_ARTIFACT: "clarified_intake_session",
    CLARIFIED_USER_IDEA_INTAKE_SOURCE_ARTIFACT: "clarified_intake_source",
    IDEA_INTAKE_CLARIFICATION_RERUN_REPORT_ARTIFACT: "intake_clarification_rerun",
    REAL_IDEA_ANSWER_TEMPLATE_ARTIFACT: "real_idea_answer_template",
    REAL_IDEA_ANSWER_AUTHORING_REPORT_ARTIFACT: "real_idea_answer_authoring_report",
    REAL_IDEA_ANSWER_SET_ARTIFACT: "real_idea_answer_set",
    SPECSPACE_REAL_IDEA_ANSWER_IMPORT_PREVIEW_ARTIFACT: (
        "specspace_real_idea_answer_import_preview"
    ),
    REAL_IDEA_ANSWER_CONTINUATION_REPORT_ARTIFACT: (
        "real_idea_answer_continuation_report"
    ),
    PLATFORM_REAL_IDEA_ENTRY_INTAKE_EXECUTION_REPORT_ARTIFACT: (
        "platform_real_idea_entry_intake_execution"
    ),
    PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_PLAN_ARTIFACT: (
        "workspace_initialization_plan"
    ),
    PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT: (
        "workspace_initialization_execution_request"
    ),
    PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT: (
        "workspace_initialization_execution"
    ),
    CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT: "ontology_seed",
    CANDIDATE_OVERVIEW_ARTIFACT: "candidate_overview",
    IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT: "clarification_requests",
    IDEA_TO_SPEC_CLARIFICATION_ANSWERS_ARTIFACT: "clarification_answers",
    PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT: "ontology_decisions",
    PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT: "project_local_ontology_review",
    SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_PREVIEW_ARTIFACT: (
        "specspace_project_local_ontology_decision_import_preview"
    ),
    PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_REPORT_ARTIFACT: (
        "project_local_ontology_decision_effect"
    ),
    IDEA_TO_SPEC_ANSWER_RERUN_INPUT_ARTIFACT: "rerun_input",
    IDEA_TO_SPEC_RERUN_PREVIEW_ARTIFACT: "rerun_preview",
    IDEA_TO_SPEC_RERUN_MATERIALIZATION_ARTIFACT: "rerun_materialization",
    IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT: "repair_session",
    SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT: "specspace_repair_draft_import_preview",
    SPECSPACE_REPAIR_DRAFT_RERUN_REPORT_ARTIFACT: "specspace_repair_draft_rerun_report",
    SPECSPACE_REPAIR_RERUN_REQUEST_GATE_ARTIFACT: "specspace_repair_rerun_request_gate",
    PLATFORM_PRODUCT_REPAIR_DRAFT_IMPORT_EXECUTION_REPORT_ARTIFACT: (
        "product_repair_draft_import_execution"
    ),
    PLATFORM_PRODUCT_REPAIR_RERUN_REQUEST_GATE_EXECUTION_REPORT_ARTIFACT: (
        "product_repair_rerun_request_gate_execution"
    ),
    PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT: "product_repair_rerun_execution",
    PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT: "product_repair_rerun_publication",
    REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT: "repaired_handoff",
    REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT: "repaired_active_candidate",
    REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT: "repaired_candidate_graph",
    REPAIRED_PRE_SIB_COHERENCE_REPORT_ARTIFACT: "repaired_pre_sib",
    REPAIRED_CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: "repaired_repair_loop",
    REPAIRED_CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: (
        "repaired_materialization"
    ),
    REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT: "repaired_repair_session",
    REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: "repaired_promotion_gate",
    CANDIDATE_SPEC_GRAPH_ARTIFACT: "candidate_graph",
    PRE_SIB_COHERENCE_REPORT_ARTIFACT: "pre_sib",
    CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: "repair_loop",
    CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: "materialization",
    IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: "promotion_gate",
    PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT: "candidate_approval_execution",
    CANDIDATE_APPROVAL_DECISION_ARTIFACT: "candidate_approval",
    GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT: "platform_promotion_request",
    PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT: "product_promotion_execution",
    GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT: "git_service_execution",
    PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT: (
        "product_review_status"
    ),
    PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT: (
        "product_read_model_publication"
    ),
    GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT: "review_status",
    GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT: "read_model_publication",
    GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT: "promotion_finalization",
    idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT: "idea_maturity_metrics",
    idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT: (
        "idea_maturity_validation"
    ),
}

EXPECTED_ARTIFACT_KINDS: dict[str, str] = {
    ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT: "active_idea_to_spec_candidate",
    IDEA_EVENT_STORMING_INTAKE_ARTIFACT: "idea_event_storming_intake",
    # Intake-stage and product repair-stage clarification artifacts intentionally
    # reuse the same SpecGraph clarification contracts; the filename separates
    # lifecycle stage while artifact_kind identifies the shared schema.
    IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT: (
        "idea_to_spec_clarification_requests"
    ),
    IDEA_INTAKE_CLARIFICATION_ANSWERS_ARTIFACT: (
        "idea_to_spec_clarification_answers"
    ),
    IDEA_INTAKE_ANSWER_RERUN_INPUT_ARTIFACT: "idea_intake_answer_rerun_input",
    CLARIFIED_USER_IDEA_INTAKE_SESSION_ARTIFACT: "user_idea_intake_session",
    CLARIFIED_USER_IDEA_INTAKE_SOURCE_ARTIFACT: "user_idea_intake_source",
    IDEA_INTAKE_CLARIFICATION_RERUN_REPORT_ARTIFACT: (
        "idea_intake_clarification_rerun_report"
    ),
    REAL_IDEA_ANSWER_TEMPLATE_ARTIFACT: "real_idea_answer_template",
    REAL_IDEA_ANSWER_AUTHORING_REPORT_ARTIFACT: "real_idea_answer_authoring_report",
    # Intentionally reuses the generic clarification answer-set contract; the
    # artifact path and workspace key identify the real-idea authoring source.
    REAL_IDEA_ANSWER_SET_ARTIFACT: "idea_to_spec_clarification_answer_set",
    SPECSPACE_REAL_IDEA_ANSWER_IMPORT_PREVIEW_ARTIFACT: (
        "specspace_real_idea_answer_import_preview"
    ),
    REAL_IDEA_ANSWER_CONTINUATION_REPORT_ARTIFACT: (
        "real_idea_answer_continuation_report"
    ),
    PLATFORM_REAL_IDEA_ENTRY_INTAKE_EXECUTION_REPORT_ARTIFACT: (
        "platform_real_idea_entry_intake_execution_report"
    ),
    PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_PLAN_ARTIFACT: (
        "platform_product_workspace_initialization_plan"
    ),
    PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT: (
        "platform_product_workspace_initialization_execution_request"
    ),
    PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT: (
        "platform_product_workspace_initialization_execution_report"
    ),
    CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT: "candidate_spec_graph_seed",
    CANDIDATE_OVERVIEW_ARTIFACT: "candidate_overview",
    IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT: (
        "idea_to_spec_clarification_requests"
    ),
    IDEA_TO_SPEC_CLARIFICATION_ANSWERS_ARTIFACT: (
        "idea_to_spec_clarification_answers"
    ),
    PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT: (
        "product_ontology_gap_review_decisions"
    ),
    PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT: (
        "project_local_ontology_review_lane"
    ),
    SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_PREVIEW_ARTIFACT: (
        "specspace_project_local_ontology_decision_import_preview"
    ),
    PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_REPORT_ARTIFACT: (
        "project_local_ontology_decision_effect_report"
    ),
    IDEA_TO_SPEC_ANSWER_RERUN_INPUT_ARTIFACT: "idea_to_spec_answer_rerun_input",
    IDEA_TO_SPEC_RERUN_PREVIEW_ARTIFACT: "idea_to_spec_rerun_preview",
    IDEA_TO_SPEC_RERUN_MATERIALIZATION_ARTIFACT: (
        "idea_to_spec_rerun_materialization"
    ),
    IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT: "idea_to_spec_repair_session_journal",
    SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT: "specspace_repair_draft_import_preview",
    SPECSPACE_REPAIR_DRAFT_RERUN_REPORT_ARTIFACT: "specspace_repair_draft_rerun_report",
    SPECSPACE_REPAIR_RERUN_REQUEST_GATE_ARTIFACT: "specspace_repair_rerun_request_gate",
    PLATFORM_PRODUCT_REPAIR_DRAFT_IMPORT_EXECUTION_REPORT_ARTIFACT: (
        "platform_product_repair_draft_import_preview_execution_report"
    ),
    PLATFORM_PRODUCT_REPAIR_RERUN_REQUEST_GATE_EXECUTION_REPORT_ARTIFACT: (
        "platform_product_repair_rerun_request_gate_execution_report"
    ),
    PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT: (
        "platform_product_repair_rerun_execution_report"
    ),
    PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT: (
        "platform_product_repair_rerun_publication_report"
    ),
    REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT: (
        "repaired_candidate_promotion_handoff_report"
    ),
    REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT: (
        "active_idea_to_spec_candidate"
    ),
    REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT: "candidate_spec_graph",
    REPAIRED_PRE_SIB_COHERENCE_REPORT_ARTIFACT: "pre_sib_coherence_report",
    REPAIRED_CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: "candidate_repair_loop_report",
    REPAIRED_CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: (
        "candidate_spec_materialization_report"
    ),
    REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT: (
        "idea_to_spec_repair_session_journal"
    ),
    REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: "idea_to_spec_promotion_gate",
    CANDIDATE_SPEC_GRAPH_ARTIFACT: "candidate_spec_graph",
    PRE_SIB_COHERENCE_REPORT_ARTIFACT: "pre_sib_coherence_report",
    CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: "candidate_repair_loop_report",
    CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: (
        "candidate_spec_materialization_report"
    ),
    IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: "idea_to_spec_promotion_gate",
    PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT: (
        "platform_candidate_approval_execution_report"
    ),
    CANDIDATE_APPROVAL_DECISION_ARTIFACT: "candidate_approval_decision",
    GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT: (
        "platform_graph_repository_promotion_request"
    ),
    PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT: (
        "platform_product_candidate_promotion_execution_report"
    ),
    GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT: (
        "platform_git_service_promotion_execution_report"
    ),
    PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT: (
        "platform_product_candidate_promotion_review_status_report"
    ),
    PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT: (
        "platform_product_candidate_promotion_read_model_publication_report"
    ),
    GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT: (
        "platform_graph_repository_review_status_report"
    ),
    GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT: (
        "platform_graph_repository_publish_read_model_report"
    ),
    GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT: (
        "platform_git_service_promotion_finalization_report"
    ),
    idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT: (
        idea_maturity.REPORT_ARTIFACT_KIND
    ),
    idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT: (
        idea_maturity.VALIDATION_ARTIFACT_KIND
    ),
}

DISPLAY_LIMITS = {
    "nodes": 40,
    "findings": 40,
    "repair_actions": 40,
    "ontology_bindings": 20,
    "ontology_gaps": 40,
    "clarification_requests": 40,
    "accepted_answers": 40,
    "ontology_decisions": 40,
    "project_local_ontology_terms": 40,
    "project_local_ontology_import_decisions": 40,
    "candidate_overview_items": 12,
    "resolved_gaps": 40,
    "materialized_files": 40,
    "git_service_operations": 20,
    "product_repair_rerun_output_artifacts": 20,
}


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _records(value: Any) -> list[dict[str, Any]]:
    return (
        [item for item in value if isinstance(item, dict)]
        if isinstance(value, list)
        else []
    )


def _string_list(value: Any) -> list[str]:
    if isinstance(value, str) and value:
        return [value]
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _text(value: Any, default: str = "") -> str:
    return value.strip() if isinstance(value, str) and value.strip() else default


def _optional_text(value: Any) -> str | None:
    text = _text(value)
    return text or None


def _number(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    return value if isinstance(value, int) and value >= 0 else 0


def _optional_number(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    return value if isinstance(value, int) and value >= 0 else None


def _first_optional_number(*values: Any) -> int:
    for value in values:
        number = _optional_number(value)
        if number is not None:
            return number
    return 0


def _artifact_contract_error(value: Any, filename: str) -> dict[str, Any] | None:
    if value is None:
        return {
            "reason": "missing_artifact",
            "detail": f"{filename} was not provided.",
        }
    if not isinstance(value, dict):
        return {
            "reason": "invalid_artifact_contract",
            "detail": "Artifact JSON root must be an object.",
        }
    if filename in idea_maturity.IDEA_MATURITY_ARTIFACTS:
        return idea_maturity.artifact_contract_error(value, filename)
    expected_kind = EXPECTED_ARTIFACT_KINDS.get(filename)
    if expected_kind is not None and value.get("artifact_kind") != expected_kind:
        return {
            "reason": "invalid_artifact_contract",
            "detail": f"artifact_kind must be {expected_kind}.",
            "artifact_kind": _optional_text(value.get("artifact_kind")),
        }
    if filename in REAL_IDEA_ANSWER_AUTHORING_ARTIFACTS:
        contract_error = real_idea_answer_authoring_contract_error(value)
        if contract_error is not None:
            return {
                "reason": "invalid_artifact_contract",
                "detail": contract_error["detail"],
                "artifact_kind": _optional_text(value.get("artifact_kind")),
                "field": contract_error.get("field"),
            }
        return None
    if filename == REAL_IDEA_ANSWER_SET_ARTIFACT:
        contract_error = real_idea_answer_set_contract_error(value)
        if contract_error is not None:
            return {
                "reason": "invalid_artifact_contract",
                "detail": contract_error["detail"],
                "artifact_kind": _optional_text(value.get("artifact_kind")),
                "field": contract_error.get("field"),
            }
        return None
    if filename in {
        SPECSPACE_REAL_IDEA_ANSWER_IMPORT_PREVIEW_ARTIFACT,
        REAL_IDEA_ANSWER_CONTINUATION_REPORT_ARTIFACT,
    }:
        for field in ("canonical_mutations_allowed", "tracked_artifacts_written"):
            if value.get(field) is True:
                return {
                    "reason": "invalid_artifact_contract",
                    "detail": f"{field} must not be true for real idea answer handoff artifacts.",
                    "artifact_kind": _optional_text(value.get("artifact_kind")),
                    "field": field,
                }
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "real idea answer handoff authority flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        privacy_boundary = _record(value.get("privacy_boundary"))
        if any(
            key.startswith("raw_") and key.endswith("_published") and flag is True
            for key, flag in privacy_boundary.items()
        ):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "real idea answer handoff privacy flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == PLATFORM_REAL_IDEA_ENTRY_INTAKE_EXECUTION_REPORT_ARTIFACT:
        authority_boundary = _record(value.get("authority_boundary"))
        for flag, enabled in authority_boundary.items():
            if flag == "executes_specgraph_make_target":
                continue
            if enabled is True:
                return {
                    "reason": "invalid_artifact_contract",
                    "detail": (
                        "real idea entry intake execution authority flags must "
                        "remain false except executes_specgraph_make_target."
                    ),
                    "artifact_kind": _optional_text(value.get("artifact_kind")),
                }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename in {
        PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT,
        SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_PREVIEW_ARTIFACT,
        PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_REPORT_ARTIFACT,
    }:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "project-local ontology authority flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        privacy_boundary = _record(value.get("privacy_boundary"))
        if any(
            key.startswith("raw_") and key.endswith("_published") and flag is True
            for key, flag in privacy_boundary.items()
        ):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "project-local ontology privacy flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if filename == SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_PREVIEW_ARTIFACT:
            decision_error = _project_local_import_decision_contract_error(value)
            if decision_error is not None:
                return {
                    "reason": "invalid_artifact_contract",
                    "detail": decision_error["detail"],
                    "artifact_kind": _optional_text(value.get("artifact_kind")),
                    "field": decision_error["field"],
                }
        if filename == PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_REPORT_ARTIFACT:
            decision_error = _project_local_effect_decision_contract_error(value)
            if decision_error is not None:
                return {
                    "reason": "invalid_artifact_contract",
                    "detail": decision_error["detail"],
                    "artifact_kind": _optional_text(value.get("artifact_kind")),
                    "field": decision_error["field"],
                }
        return None
    if filename in {
        ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
        REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
    }:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "active candidate authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename in {
        IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT,
        REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT,
    }:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "repair session authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        privacy_boundary = _record(value.get("privacy_boundary"))
        if any(
            key.startswith("raw_") and key.endswith("_published") and flag is True
            for key, flag in privacy_boundary.items()
        ):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "repair session privacy boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        action_boundary = _record(value.get("action_boundary"))
        unsafe_action_flags = {
            "may_apply_answers",
            "may_apply_decisions",
            "may_mutate_candidate_artifacts",
            "may_accept_ontology_terms",
            "may_write_ontology_package",
            "may_create_branch_or_commit",
        }
        if any(action_boundary.get(flag) is True for flag in unsafe_action_flags):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "repair session action boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if (
            action_boundary
            and (
                action_boundary.get("inspect_only") is not True
                or action_boundary.get("acknowledge_only") is not True
            )
        ):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "repair session action boundary must be inspect-only.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "repaired handoff authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        privacy_boundary = _record(value.get("privacy_boundary"))
        if any(
            key.startswith("raw_") and key.endswith("_published") and flag is True
            for key, flag in privacy_boundary.items()
        ):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "repaired handoff privacy boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT:
        source_generation = _record(value.get("source_generation"))
        authority_boundary = _record(source_generation.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "candidate seed authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        privacy_boundary = _record(source_generation.get("privacy_boundary"))
        if any(flag is True for flag in privacy_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "candidate seed privacy boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is True:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must not be true.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is True:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must not be true.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == CANDIDATE_OVERVIEW_ARTIFACT:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "candidate overview authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        action_boundary = _record(value.get("action_boundary"))
        if any(flag is True for flag in action_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "candidate overview action boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        privacy_boundary = _record(value.get("privacy_boundary"))
        if any(
            key.startswith("raw_") and key.endswith("_published") and flag is True
            for key, flag in privacy_boundary.items()
        ):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "candidate overview privacy boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "git service authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT:
        if value.get("workflow_lane") != "product_idea_to_spec":
            return {
                "reason": "invalid_artifact_contract",
                "detail": "product promotion execution workflow_lane must be product_idea_to_spec.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        authority_boundary = _record(value.get("authority_boundary"))
        allowed_true_flags = {
            "controlled_git_service_execution",
            "creates_candidate_worktree_or_branch",
            "creates_candidate_commit",
            "opens_pull_requests",
        }
        if any(
            flag is True and key not in allowed_true_flags
            for key, flag in authority_boundary.items()
        ):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "product promotion execution may only claim controlled Git review authority.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "candidate approval execution authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("ontology_writes_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "ontology_writes_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == CANDIDATE_APPROVAL_DECISION_ARTIFACT:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "candidate approval authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename in {
        PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT,
        PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT,
    }:
        authority_boundary = _record(value.get("authority_boundary"))
        for flag, enabled in authority_boundary.items():
            if flag == "executes_specgraph_make_target":
                continue
            if enabled is True:
                return {
                    "reason": "invalid_artifact_contract",
                    "detail": (
                        "product repair rerun authority boundary flags must "
                        "remain false except executes_specgraph_make_target."
                    ),
                    "artifact_kind": _optional_text(value.get("artifact_kind")),
                }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT:
        if value.get("workflow_lane") != "product_idea_to_spec":
            return {
                "reason": "invalid_artifact_contract",
                "detail": "product review status workflow_lane must be product_idea_to_spec.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "product review status authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename == PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT:
        if value.get("workflow_lane") != "product_idea_to_spec":
            return {
                "reason": "invalid_artifact_contract",
                "detail": "product read-model publication workflow_lane must be product_idea_to_spec.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        authority_boundary = _record(value.get("authority_boundary"))
        if any(
            flag is True and key != "publishes_read_models"
            for key, flag in authority_boundary.items()
        ):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "product read-model publication may only claim public read-model publication authority.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is True:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must not be true.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_tracked_artifacts_written") is True:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_tracked_artifacts_written must not be true.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is True:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "tracked_artifacts_written must not be true.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename in {
        GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT,
        GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT,
        GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT,
    }:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "post-review authority boundary flags must remain false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_mutations_allowed must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("canonical_tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": "canonical_tracked_artifacts_written must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if filename in SPECSPACE_REPAIR_DRAFT_HANDOFF_ARTIFACTS:
        if value.get("canonical_mutations_allowed") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": (
                    "SpecSpace repair draft handoff artifacts must declare "
                    "canonical_mutations_allowed false."
                ),
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("tracked_artifacts_written") is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": (
                    "SpecSpace repair draft handoff artifacts must declare "
                    "tracked_artifacts_written false."
                ),
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return None
    if value.get("canonical_mutations_allowed") is not False:
        return {
            "reason": "invalid_artifact_contract",
            "detail": "canonical_mutations_allowed must be false.",
            "artifact_kind": _optional_text(value.get("artifact_kind")),
        }
    if value.get("tracked_artifacts_written") is not False:
        return {
            "reason": "invalid_artifact_contract",
            "detail": "tracked_artifacts_written must be false.",
            "artifact_kind": _optional_text(value.get("artifact_kind")),
        }
    return None


def _project_local_import_decision_contract_error(
    value: dict[str, Any],
) -> dict[str, str] | None:
    false_fields = (
        "writes_ontology_package",
        "accepts_ontology_terms",
        "applies_to_specgraph",
        "applies_to_candidate_artifacts",
        "mutates_canonical_specs",
        "updates_ontology_lockfile",
        "creates_branch_or_commit",
        "opens_pull_request",
        "publishes_read_model",
        "may_publish_read_model",
        "may_mark_candidate_graph_accepted",
    )
    preview = _record(value.get("import_preview"))
    collections = (
        ("import_preview.accepted_decisions", preview.get("accepted_decisions")),
        (
            "import_preview.non_resolving_decisions",
            preview.get("non_resolving_decisions"),
        ),
        ("decision_candidates", value.get("decision_candidates")),
    )
    for collection_name, collection in collections:
        for index, item in enumerate(_records(collection)):
            for field in false_fields:
                if item.get(field) is True:
                    return {
                        "detail": f"{collection_name}[{index}].{field} must be false.",
                        "field": f"{collection_name}[{index}].{field}",
                    }
    return None


def _project_local_effect_decision_contract_error(
    value: dict[str, Any],
) -> dict[str, str] | None:
    false_fields = (
        "writes_ontology_package",
        "accepts_ontology_terms",
        "canonical_mutations_allowed",
    )
    for index, item in enumerate(_records(value.get("decision_effects"))):
        for field in false_fields:
            if item.get(field) is not False:
                return {
                    "detail": f"decision_effects[{index}].{field} must be false.",
                    "field": f"decision_effects[{index}].{field}",
                }
    return None


def _artifact_data(artifacts: dict[str, Any], filename: str) -> dict[str, Any] | None:
    value = artifacts.get(filename)
    if _artifact_contract_error(value, filename) is not None:
        return None
    return value


def _artifact_status(
    artifacts: dict[str, Any],
    filename: str,
) -> dict[str, Any]:
    path = f"runs/{filename}"
    value = artifacts.get(filename)
    contract_error = _artifact_contract_error(value, filename)
    if contract_error is not None:
        return {
            "available": False,
            "path": path,
            **contract_error,
        }
    assert isinstance(value, dict)
    data = value
    summary = (
        idea_maturity.safe_json_record(data.get("summary"))
        if filename in IDEA_MATURITY_ARTIFACTS
        else _record(data.get("summary"))
    )
    readiness = _record(data.get("readiness"))
    pre_sib_readiness = _record(data.get("pre_sib_readiness"))
    source_generation = (
        _record(data.get("source_generation"))
        if filename == CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT
        else {}
    )
    source_summary = _record(source_generation.get("summary"))
    source_readiness = _record(source_generation.get("readiness"))
    status_payload = {
        "available": True,
        "path": path,
        "artifact_kind": _optional_text(data.get("artifact_kind")),
        "schema_version": data.get("schema_version")
        if isinstance(data.get("schema_version"), int)
        else None,
        "proposal_id": _optional_text(
            data.get("proposal_id") or source_generation.get("proposal_id")
        ),
        "contract_ref": _optional_text(
            data.get("contract_ref") or source_generation.get("contract_ref")
        ),
        "status": _optional_text(
            data.get("status")
            or summary.get("status")
            or readiness.get("review_state")
            or pre_sib_readiness.get("review_state")
            or source_summary.get("status")
            or source_readiness.get("review_state")
        ),
        "summary": summary or source_summary or None,
    }
    source_artifacts = _safe_source_artifacts(data.get("source_artifacts"))
    if source_artifacts:
        status_payload["source_artifacts"] = source_artifacts
    workspace_id = _optional_text(data.get("workspace_id") or summary.get("workspace_id"))
    candidate_id = _optional_text(data.get("candidate_id") or summary.get("candidate_id"))
    repair_session_ref = _optional_text(
        data.get("repair_session_ref") or summary.get("repair_session_ref")
    )
    if workspace_id:
        status_payload["workspace_id"] = workspace_id
    if candidate_id:
        status_payload["candidate_id"] = candidate_id
    if repair_session_ref:
        status_payload["repair_session_ref"] = repair_session_ref
    if filename in {
        PLATFORM_PRODUCT_REPAIR_DRAFT_IMPORT_EXECUTION_REPORT_ARTIFACT,
        PLATFORM_PRODUCT_REPAIR_RERUN_REQUEST_GATE_EXECUTION_REPORT_ARTIFACT,
    }:
        status_payload["ok"] = data.get("ok") is True
        status_payload["dry_run"] = data.get("dry_run") is True
        status_payload["authority_boundary"] = _record(data.get("authority_boundary"))
        status_payload["output_artifacts"] = {
            row["key"]: row for row in _product_repair_rerun_output_artifacts(data)
        }
    session = _session_projection(data.get("session"))
    if session:
        status_payload["session"] = session
    selected_request = _selected_request_projection(data.get("selected_request"))
    if selected_request:
        status_payload["selected_request"] = selected_request
    return status_payload


def _safe_source_artifacts(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    safe: dict[str, Any] = {}
    for key, ref in value.items():
        key_text = _optional_text(key)
        if key_text is None:
            continue
        if isinstance(ref, str):
            ref_text = _optional_text(ref)
        elif isinstance(ref, dict):
            ref_text = _optional_text(ref.get("source_ref") or ref.get("path"))
        else:
            ref_text = None
        if ref_text is None or ref_text.startswith("/") or ".." in ref_text.split("/"):
            continue
        safe[key_text] = ref_text
    return safe


def _session_projection(value: Any) -> dict[str, Any]:
    session = _record(value)
    projected = {
        "session_id": _optional_text(session.get("session_id")),
        "candidate_id": _optional_text(session.get("candidate_id")),
        "workspace_route": _optional_text(session.get("workspace_route")),
    }
    return {key: item for key, item in projected.items() if item is not None}


def _selected_request_projection(value: Any) -> dict[str, Any]:
    request = _record(value)
    projected = {
        "id": _optional_text(request.get("id")),
        "workspace_id": _optional_text(request.get("workspace_id")),
        "candidate_id": _optional_text(request.get("candidate_id")),
        "repair_session_id": _optional_text(request.get("repair_session_id")),
        "repair_session_ref": _optional_text(request.get("repair_session_ref")),
    }
    return {key: item for key, item in projected.items() if item is not None}


def _active_frame(value: Any) -> dict[str, Any]:
    frame = _record(value)
    payload = {
        "project": _optional_text(frame.get("project")),
        "subsystem": _optional_text(frame.get("subsystem")),
        "agent_layer": _optional_text(frame.get("agent_layer")),
        "target_artifact": _optional_text(frame.get("target_artifact")),
        "lifecycle_phase": _optional_text(frame.get("lifecycle_phase")),
        "ontology_refs": _string_list(frame.get("ontology_refs")),
        "ontology_layer_refs": _string_list(frame.get("ontology_layer_refs")),
        "model_applicability_refs": _string_list(
            frame.get("model_applicability_refs")
        ),
        "domain_refs": _string_list(frame.get("domain_refs")),
        "context_refs": _string_list(frame.get("context_refs")),
    }
    return {key: item for key, item in payload.items() if item is not None}


def _list_count(payload: dict[str, Any] | None, key: str) -> int:
    return len(_records((payload or {}).get(key)))


def _candidate_nodes(candidate_graph: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for node in _records((candidate_graph or {}).get("nodes"))[
        : DISPLAY_LIMITS["nodes"]
    ]:
        node_id = _text(node.get("id"))
        if not node_id:
            continue
        rows.append(
            {
                "id": node_id,
                "title": _optional_text(node.get("title")),
                "kind": _optional_text(node.get("kind")),
                "ontology_refs": _string_list(node.get("ontology_refs")),
                "requirement_count": len(_records(node.get("requirements"))),
                "acceptance_criteria_count": len(
                    _records(node.get("acceptance_criteria"))
                ),
                "claim_count": len(_records(node.get("claims"))),
                "gap_count": len(_records(node.get("gaps"))),
            }
        )
    return rows


def _candidate_counts(candidate_graph: dict[str, Any] | None) -> dict[str, int]:
    nodes = _records((candidate_graph or {}).get("nodes"))
    edges = _records((candidate_graph or {}).get("edges"))
    return {
        "node_count": len(nodes),
        "edge_count": len(edges),
        "requirement_count": sum(
            len(_records(node.get("requirements"))) for node in nodes
        ),
        "acceptance_criteria_count": sum(
            len(_records(node.get("acceptance_criteria"))) for node in nodes
        ),
        "claim_count": sum(len(_records(node.get("claims"))) for node in nodes),
        "gap_count": sum(len(_records(node.get("gaps"))) for node in nodes),
    }


def _number_record(value: Any) -> dict[str, int]:
    return {
        key: _number(item)
        for key, item in _record(value).items()
        if _optional_text(key) is not None
    }


def _overview_items(value: Any) -> list[dict[str, Any]]:
    rows = []
    limit = DISPLAY_LIMITS["candidate_overview_items"]
    for index, item in enumerate(_records(value)[:limit]):
        item_id = (
            _text(item.get("id"))
            or _text(item.get("term"))
            or f"overview-item-{index}"
        )
        rows.append(
            {
                "id": item_id,
                "label": _optional_text(
                    item.get("label")
                    or item.get("title")
                    or item.get("name")
                    or item.get("term")
                ),
                "kind": _optional_text(item.get("kind") or item.get("type")),
                "detail": _optional_text(
                    item.get("detail")
                    or item.get("description")
                    or item.get("statement")
                    or item.get("source_ref")
                ),
            }
        )
    return rows


def _overview_edges(value: Any) -> list[dict[str, Any]]:
    rows = []
    limit = DISPLAY_LIMITS["candidate_overview_items"]
    for index, item in enumerate(_records(value)[:limit]):
        edge_id = _text(item.get("id")) or f"overview-edge-{index}"
        rows.append(
            {
                "id": edge_id,
                "relation": _optional_text(item.get("relation") or item.get("type")),
                "from": _optional_text(item.get("from") or item.get("source")),
                "to": _optional_text(item.get("to") or item.get("target")),
                "label": _optional_text(item.get("label") or item.get("title")),
            }
        )
    return rows


def _candidate_overview(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    candidate = _record((report or {}).get("candidate"))
    narrative = _record((report or {}).get("narrative"))
    sections = _record((report or {}).get("sections"))
    event_storming = _record(sections.get("event_storming"))
    candidate_nodes = _record(sections.get("candidate_nodes"))
    topology = _record(sections.get("topology"))
    repair = _record(sections.get("repair"))
    idea_maturity_section = _record(sections.get("idea_maturity"))
    project_local_ontology = _record(sections.get("project_local_ontology"))
    next_action = _record((report or {}).get("next_action"))
    return {
        "available": report is not None,
        "readiness": _readiness(report),
        "summary": {
            "candidate_id": _optional_text(summary.get("candidate_id")),
            "display_name": _optional_text(summary.get("display_name")),
            "graph_source": _optional_text(summary.get("graph_source")),
            "node_count": _number(summary.get("node_count")),
            "edge_count": _number(summary.get("edge_count")),
            "workflow_edge_count": _number(summary.get("workflow_edge_count")),
            "remaining_blocker_count": _number(summary.get("remaining_blocker_count")),
            "finding_count": _number(summary.get("finding_count")),
            "ready_for_candidate_approval": summary.get("ready_for_candidate_approval")
            is True,
            "ready_for_platform_promotion": summary.get("ready_for_platform_promotion")
            is True,
            "project_local_ontology_review_status": _optional_text(
                summary.get("project_local_ontology_review_status")
            ),
        },
        "candidate": {
            "candidate_id": _optional_text(candidate.get("candidate_id")),
            "display_name": _optional_text(candidate.get("display_name")),
            "workspace_route": _optional_text(candidate.get("workspace_route")),
            "workflow_lane": _optional_text(candidate.get("workflow_lane")),
        },
        "narrative": {
            "product_intent": _optional_text(narrative.get("product_intent")),
            "understood_scope": _optional_text(narrative.get("understood_scope")),
            "readiness": _optional_text(narrative.get("readiness")),
            "next_action": _optional_text(narrative.get("next_action")),
        },
        "event_storming": {
            "actor_count": _number(event_storming.get("actor_count")),
            "command_count": _number(event_storming.get("command_count")),
            "domain_event_count": _number(event_storming.get("domain_event_count")),
            "policy_count": _number(event_storming.get("policy_count")),
            "constraint_count": _number(event_storming.get("constraint_count")),
            "actors": _overview_items(event_storming.get("actors")),
            "commands": _overview_items(event_storming.get("commands")),
            "domain_events": _overview_items(event_storming.get("domain_events")),
            "policies": _overview_items(event_storming.get("policies")),
            "constraints": _overview_items(event_storming.get("constraints")),
        },
        "candidate_nodes": {
            "nodes": _overview_items(candidate_nodes.get("nodes")),
        },
        "topology": {
            "edge_count": _number(topology.get("edge_count")),
            "workflow_edge_count": _number(topology.get("workflow_edge_count")),
            "relation_counts": _number_record(topology.get("relation_counts")),
            "edges": _overview_edges(
                topology.get("edges")
                or topology.get("sample_edges")
                or topology.get("workflow_edges")
            ),
        },
        "repair": {
            "remaining_blocker_count": _number(repair.get("remaining_blocker_count")),
            "resolved_ontology_gap_count": _number(
                repair.get("resolved_ontology_gap_count")
            ),
            "resolved_candidate_gap_count": _number(
                repair.get("resolved_candidate_gap_count")
            ),
            "removed_gap_count": _number(repair.get("removed_gap_count")),
        },
        "idea_maturity": {
            "status": _optional_text(idea_maturity_section.get("status")),
            "lifecycle_state": _optional_text(
                idea_maturity_section.get("lifecycle_state")
            ),
            "trusted": idea_maturity_section.get("trusted") is True,
        },
        "project_local_ontology": {
            "status": _optional_text(project_local_ontology.get("status")),
            "term_count": _number(project_local_ontology.get("term_count")),
            "accepted_decision_count": _number(
                project_local_ontology.get("accepted_decision_count")
            ),
            "blocking_decision_count": _number(
                project_local_ontology.get("blocking_decision_count")
            ),
        },
        "next_action": {
            "action_id": _optional_text(next_action.get("action_id")),
            "label": _optional_text(next_action.get("label")),
            "source": _optional_text(next_action.get("source")),
            "evidence_refs": _string_list(next_action.get("evidence_refs")),
        },
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_mutate_candidate_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
        },
    }


def _summary_count(summary: dict[str, Any], key: str, rows: list[dict[str, Any]]) -> int:
    if key in summary:
        return _number(summary.get(key))
    return len(rows)


def _ontology_seed_bindings(seed: dict[str, Any] | None) -> list[dict[str, Any]]:
    source_generation = _record((seed or {}).get("source_generation"))
    rows = []
    for item in _records(source_generation.get("ontology_bindings"))[
        : DISPLAY_LIMITS["ontology_bindings"]
    ]:
        term = _text(item.get("term"))
        ontology_ref = _text(item.get("ontology_ref"))
        if not term and not ontology_ref:
            continue
        rows.append(
            {
                "term": term or "ontology term",
                "ontology_ref": ontology_ref or None,
                "binding_kind": _optional_text(item.get("binding_kind")),
                "authority": _optional_text(item.get("authority")),
                "reason": _optional_text(item.get("reason")),
            }
        )
    return rows


def _ontology_seed_gaps(seed: dict[str, Any] | None) -> list[dict[str, Any]]:
    source_generation = _record((seed or {}).get("source_generation"))
    rows = []
    for item in _records(source_generation.get("ontology_gaps"))[
        : DISPLAY_LIMITS["ontology_gaps"]
    ]:
        gap_id = _text(item.get("id"))
        if not gap_id:
            continue
        rows.append(
            {
                "id": gap_id,
                "kind": _text(item.get("kind"), "ontology_gap"),
                "term": _optional_text(item.get("term")),
                "source_ref": _optional_text(item.get("source_ref")),
                "source_kind": _optional_text(item.get("source_kind")),
                "suggested_action": _optional_text(item.get("suggested_action")),
                "blocks_candidate_graph": item.get("blocks_candidate_graph") is True,
                "statement": _optional_text(item.get("statement")),
            }
        )
    return rows


def _ontology_seed(seed: dict[str, Any] | None) -> dict[str, Any]:
    source_generation = _record((seed or {}).get("source_generation"))
    summary = _record(source_generation.get("summary"))
    ontology = _record(source_generation.get("ontology"))
    bindings = _ontology_seed_bindings(seed)
    gaps = _ontology_seed_gaps(seed)
    return {
        "available": seed is not None,
        "source_ref": _optional_text((seed or {}).get("source_ref")),
        "contract_ref": _optional_text((seed or {}).get("contract_ref")),
        "generation_contract_ref": _optional_text(source_generation.get("contract_ref")),
        "readiness": _readiness(source_generation),
        "summary": {
            "status": _optional_text(summary.get("status")),
            "node_count": _number(summary.get("node_count")),
            "edge_count": _number(summary.get("edge_count")),
            "ontology_binding_count": _summary_count(
                summary,
                "ontology_binding_count",
                _records(source_generation.get("ontology_bindings")),
            ),
            "ontology_gap_count": _summary_count(
                summary,
                "ontology_gap_count",
                _records(source_generation.get("ontology_gaps")),
            ),
            "finding_count": _summary_count(
                summary,
                "finding_count",
                _records(source_generation.get("findings")),
            ),
        },
        "ontology": {
            "id": _optional_text(ontology.get("id")),
            "namespace": _optional_text(ontology.get("namespace")),
            "version": _optional_text(ontology.get("version")),
            "source_ref": _optional_text(ontology.get("source_ref")),
            "source_digest": _optional_text(ontology.get("source_digest")),
            "class_count": _number(ontology.get("class_count")),
            "relation_count": _number(ontology.get("relation_count")),
        },
        "bindings": bindings,
        "gaps": gaps,
        "findings": _findings(source_generation),
        "privacy_boundary": _record(source_generation.get("privacy_boundary")),
    }


def _findings(payload: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for item in (
        _records((payload or {}).get("findings"))
        + _records((payload or {}).get("warnings"))
    )[: DISPLAY_LIMITS["findings"]]:
        rows.append(
            {
                "finding_id": _text(item.get("finding_id"), "finding"),
                "severity": _text(item.get("severity"), "unknown"),
                "message": _text(item.get("message"), "No message supplied."),
                "source_ref": _optional_text(
                    item.get("source_ref") or item.get("source")
                ),
                "target_ref": _optional_text(item.get("target_ref")),
                "next_action": _optional_text(item.get("next_action")),
            }
        )
    return rows


def _finding_count(payload: dict[str, Any] | None) -> int:
    return len(_records((payload or {}).get("findings"))) + len(
        _records((payload or {}).get("warnings"))
    )


def _blocking_finding_ids(payload: dict[str, Any] | None) -> list[str]:
    finding_ids = []
    for item in _records((payload or {}).get("findings")):
        finding_id = _text(item.get("finding_id"))
        if finding_id:
            finding_ids.append(finding_id)
    return finding_ids


def _ontology_seed_blocked(seed: dict[str, Any] | None) -> bool:
    if seed is None:
        return False
    source_generation = _record(seed.get("source_generation"))
    readiness = _readiness(source_generation)
    blocking_gap = any(
        gap.get("blocks_candidate_graph") is True
        for gap in _records(source_generation.get("ontology_gaps"))
    )
    return (
        not readiness["ready"]
        or bool(readiness["blocked_by"])
        or _finding_count(source_generation) > 0
        or blocking_gap
    )


def _repair_actions(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for item in _records((report or {}).get("repair_actions"))[
        : DISPLAY_LIMITS["repair_actions"]
    ]:
        rows.append(
            {
                "id": _text(item.get("id"), "repair-action"),
                "kind": _text(item.get("kind"), "unknown"),
                "status": _text(item.get("status"), "unknown"),
                "target_ref": _optional_text(item.get("target_ref")),
                "rationale": _optional_text(item.get("rationale")),
                "source_findings": _string_list(item.get("source_findings")),
            }
        )
    return rows


def _repair_action_count(report: dict[str, Any] | None) -> int:
    return len(_records((report or {}).get("repair_actions")))


def _clarification_request_rows(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for item in _records((report or {}).get("clarification_requests"))[
        : DISPLAY_LIMITS["clarification_requests"]
    ]:
        request_id = _text(item.get("id"))
        if not request_id:
            continue
        rows.append(
            {
                "id": request_id,
                "kind": _text(item.get("kind"), "clarification"),
                "severity": _text(item.get("severity"), "review_required"),
                "status": _text(item.get("status"), "open"),
                "target_ref": _optional_text(item.get("target_ref")),
                "target_artifact": _optional_text(item.get("target_artifact")),
                "question": _optional_text(item.get("question")),
                "suggested_actions": _string_list(item.get("suggested_actions")),
            }
        )
    return rows


def _repair_target_for_request(request: dict[str, Any]) -> dict[str, Any] | None:
    if request["kind"] == "ontology_gap":
        return None
    accepted_actions = [
        action
        for action in _string_list(request.get("suggested_actions"))
        if action in {"answer_question", "provide_candidate_context", "reject", "defer"}
    ]
    if not accepted_actions:
        return None
    haystack = " ".join(
        _text(value)
        for value in (
            request.get("kind"),
            request.get("id"),
            request.get("target_ref"),
            request.get("question"),
        )
        if _text(value)
    ).casefold()
    if "risk" in haystack:
        kind = "risk_requires_review"
        label = "Risk review"
        expected_effect = "risk_accepted"
        recommended_action = "Record the owner risk decision and mitigation context."
    elif "enforcement" in haystack:
        kind = "missing_enforcement_mechanism"
        label = "Enforcement mechanism"
        expected_effect = "enforcement_mechanism_added"
        recommended_action = "Describe the concrete enforcement mechanism and its owner."
    elif "required-field" in haystack or "required field" in haystack:
        kind = "missing_required_fields"
        label = "Required fields"
        expected_effect = "candidate_context_added"
        recommended_action = "Provide the required field set and validation scope."
    elif "policy" in haystack or "validation" in haystack:
        kind = "policy_or_validation_gap"
        label = "Policy / validation"
        expected_effect = "candidate_context_added"
        recommended_action = "Provide the policy or validation context needed for rerun."
    elif "constraint" in haystack:
        kind = "ambiguous_product_constraint"
        label = "Product constraint"
        expected_effect = "candidate_context_added"
        recommended_action = "Clarify the bounded product constraint and its scope."
    else:
        kind = "unknown"
        label = "Product/spec gap"
        expected_effect = "candidate_context_added"
        recommended_action = "Provide bounded product/spec context for the rerun."
    return {
        "request_id": request["id"],
        "kind": kind,
        "label": label,
        "target_ref": request.get("target_ref"),
        "source_ref": request.get("target_artifact"),
        "statement": request.get("question"),
        "recommended_action": recommended_action,
        "accepted_actions": accepted_actions,
        "expected_effect": expected_effect,
    }


def _product_spec_repair_targets(requests: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        target
        for request in requests
        if (target := _repair_target_for_request(request)) is not None
    ]


def _clarification_answer_count(report: dict[str, Any] | None) -> int:
    return len(_records((report or {}).get("answers")))


def _accepted_answer_rows(
    *,
    repair_session: dict[str, Any] | None,
    clarification_answers: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    workflow_journal = _record((repair_session or {}).get("workflow_journal"))
    source = _records(workflow_journal.get("accepted_answers"))
    if not source:
        source = [
            answer
            for answer in _records((clarification_answers or {}).get("answers"))
            if _text(answer.get("status")) == "accepted_for_candidate"
        ]
    rows = []
    for item in source[: DISPLAY_LIMITS["accepted_answers"]]:
        request_id = _text(item.get("request_id"))
        if not request_id:
            continue
        value = _record(item.get("value"))
        rows.append(
            {
                "request_id": request_id,
                "answer_kind": _text(item.get("answer_kind"), "answer"),
                "status": _text(item.get("status"), "accepted_for_candidate"),
                "request_kind": _optional_text(
                    item.get("request_kind")
                    or _record(item.get("request_snapshot")).get("kind")
                ),
                "target_artifact": _optional_text(
                    item.get("target_artifact")
                    or _record(item.get("request_snapshot")).get("target_artifact")
                ),
                "target_ref": _optional_text(
                    item.get("target_ref")
                    or _record(item.get("request_snapshot")).get("target_ref")
                ),
                "terms": _string_list(value.get("terms")),
                "term_scope": _optional_text(value.get("term_scope")),
            }
        )
    return rows


def _intake_answer_rows(
    clarification_answers: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    rows = []
    for item in _records((clarification_answers or {}).get("answers"))[
        : DISPLAY_LIMITS["accepted_answers"]
    ]:
        request_id = _text(item.get("request_id"))
        if not request_id:
            continue
        value = _record(item.get("value"))
        rows.append(
            {
                "request_id": request_id,
                "answer_kind": _text(item.get("answer_kind"), "answer"),
                "status": _text(item.get("status"), "proposed"),
                "authority": _optional_text(item.get("authority")),
                "target_artifact": _optional_text(
                    _record(item.get("request_snapshot")).get("target_artifact")
                ),
                "target_ref": _optional_text(
                    _record(item.get("request_snapshot")).get("target_ref")
                ),
                "refs": _string_list(value.get("refs")),
                "entries": _string_list(value.get("entries")),
                "text": _optional_text(value.get("text")),
            }
        )
    return rows


REAL_IDEA_ANSWER_TEMPLATE_VALUE_KEYS = {
    "answer",
    "context",
    "entries",
    "follow_up",
    "reason",
    "refs",
    "term",
    "terms",
    "text",
}
LOCAL_PATH_PREFIXES = ("/Users/", "/home/", "/tmp/", "/var/", "/private/")


def _safe_answer_value_template(value: Any) -> Any:
    if isinstance(value, str):
        return value if value and not value.startswith(LOCAL_PATH_PREFIXES) else ""
    if isinstance(value, list):
        return [
            item
            for item in (_safe_answer_value_template(item) for item in value)
            if item not in (None, {}, [])
        ]
    if isinstance(value, dict):
        safe: dict[str, Any] = {}
        for key, item in value.items():
            key_text = _optional_text(key)
            if key_text is None:
                continue
            if key_text not in REAL_IDEA_ANSWER_TEMPLATE_VALUE_KEYS:
                continue
            safe_item = _safe_answer_value_template(item)
            if safe_item not in (None, {}, []):
                safe[key_text] = safe_item
        return safe
    if isinstance(value, bool) or isinstance(value, int) or value is None:
        return value
    return None


def _real_idea_answer_targets(template: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for item in _records((template or {}).get("answer_targets"))[
        : DISPLAY_LIMITS["clarification_requests"]
    ]:
        target_id = _text(item.get("target_id"))
        request_id = _text(item.get("request_id"))
        if not target_id or not request_id:
            continue
        required_fields_by_action = {
            action: _string_list(fields)
            for action, fields in _record(item.get("required_fields_by_action")).items()
            if _optional_text(action)
        }
        value_templates_by_action = {
            action: _safe_answer_value_template(template_value)
            for action, template_value in _record(item.get("value_templates_by_action")).items()
            if _optional_text(action)
        }
        rows.append(
            {
                "target_id": target_id,
                "target_type": _text(item.get("target_type"), "clarification"),
                "request_id": request_id,
                "request_kind": _optional_text(item.get("request_kind")),
                "severity": _text(item.get("severity"), "review_required"),
                "status": _text(item.get("status"), "open"),
                "question": _optional_text(item.get("question")),
                "target_artifact": _optional_text(item.get("target_artifact")),
                "target_ref": _optional_text(item.get("target_ref")),
                "accepted_actions": _string_list(item.get("accepted_actions")),
                "suggested_answer_shape": _optional_text(
                    item.get("suggested_answer_shape")
                ),
                "value_templates_by_action": value_templates_by_action,
                "required_fields_by_action": required_fields_by_action,
                "evidence_refs": [
                    ref
                    for ref in _string_list(item.get("evidence_refs"))
                    if not ref.startswith("/") and ".." not in ref.split("/")
                ],
            }
        )
    return rows


def _real_idea_answer_authoring(
    *,
    template: dict[str, Any] | None,
    report: dict[str, Any] | None,
    answer_set: dict[str, Any] | None,
) -> dict[str, Any]:
    template_summary = _record((template or {}).get("summary"))
    report_summary = _record((report or {}).get("summary"))
    template_targets = _real_idea_answer_targets(template)
    report_findings = _findings(report)
    answer_count = len(_records((answer_set or {}).get("answers")))
    validation_status = (
        _optional_text(report_summary.get("status"))
        or _optional_text(_record((report or {}).get("readiness")).get("review_state"))
        or "unknown"
    )
    recommended_actions = []
    if template is None:
        recommended_actions.append(
            {
                "id": "generate_real_idea_answer_template",
                "label": "Generate answer template",
                "next_action": "Run `make real-idea-smoke-answer-template` in SpecGraph.",
            }
        )
    elif answer_count == 0:
        recommended_actions.append(
            {
                "id": "save_real_idea_answers",
                "label": "Save operator answers",
                "next_action": "Fill and save answers for the current clarification template.",
            }
        )
    elif report is None or not _readiness(report)["ready"]:
        recommended_actions.append(
            {
                "id": "validate_real_idea_answers",
                "label": "Validate answers",
                "next_action": "Run `make real-idea-smoke-validate-answers` before continuation.",
            }
        )
    else:
        recommended_actions.append(
            {
                "id": "continue_real_idea_intake",
                "label": "Continue intake",
                "next_action": "Run `make real-idea-smoke-materialize-answers` and continue the smoke.",
            }
        )
    return {
        "available": any(artifact is not None for artifact in (template, report, answer_set)),
        "template": {
            "available": template is not None,
            "readiness": _readiness(template),
            "stage": _optional_text((template or {}).get("stage")),
            "run_dir": _optional_text((template or {}).get("run_dir")),
            "contract_ref": _optional_text((template or {}).get("contract_ref")),
            "summary": template_summary,
            "target_count": len(template_targets)
            or _number(template_summary.get("target_count")),
            "blocking_target_count": _number(
                template_summary.get("blocking_target_count")
            ),
            "targets": template_targets,
        },
        "report": {
            "available": report is not None,
            "readiness": _readiness(report),
            "operation": _optional_text((report or {}).get("operation")),
            "stage": _optional_text((report or {}).get("stage")),
            "summary": report_summary,
            "findings": report_findings,
            "finding_count": _finding_count(report),
        },
        "answer_set": {
            "available": answer_set is not None,
            "artifact_kind": _optional_text((answer_set or {}).get("artifact_kind")),
            "contract_ref": _optional_text((answer_set or {}).get("contract_ref")),
            "answer_count": answer_count,
        },
        "validation": {
            "status": validation_status,
            "ready": _readiness(report)["ready"] if report is not None else False,
            "finding_count": _finding_count(report),
        },
        "recommended_actions": recommended_actions,
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_apply_answers": False,
            "may_mutate_candidate_source_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
        },
    }


def _real_idea_answer_continuation(
    *,
    import_preview: dict[str, Any] | None,
    continuation_report: dict[str, Any] | None,
) -> dict[str, Any]:
    preview_summary = _record((import_preview or {}).get("summary"))
    continuation_summary = _record((continuation_report or {}).get("summary"))
    preview_import = _record((import_preview or {}).get("import_preview"))
    preview_sources = _record((import_preview or {}).get("source_artifacts"))
    continuation_outputs = _record((continuation_report or {}).get("outputs"))
    ready = (
        import_preview is not None
        and _readiness(import_preview)["ready"]
        and continuation_report is not None
        and _readiness(continuation_report)["ready"]
    )
    recommended_actions = []
    if import_preview is None:
        recommended_actions.append(
            {
                "id": "build_specspace_answer_import_preview",
                "label": "Build answer import preview",
                "next_action": (
                    "Run `make specspace-real-idea-answer-import-preview` in SpecGraph."
                ),
                "command_hint": (
                    "make specspace-real-idea-answer-import-preview "
                    "SPECSPACE_REAL_IDEA_ANSWERS=<SpecSpace state>"
                ),
            }
        )
    elif not _readiness(import_preview)["ready"]:
        recommended_actions.append(
            {
                "id": "fix_specspace_answer_import_preview",
                "label": "Fix answer import preview",
                "next_action": "Resolve import preview findings before continuation.",
            }
        )
    elif continuation_report is None:
        recommended_actions.append(
            {
                "id": "materialize_specspace_answer_continuation",
                "label": "Materialize answer continuation",
                "next_action": (
                    "Run `make real-idea-intake-materialize-specspace-answers` "
                    "in SpecGraph."
                ),
                "command_hint": (
                    "make real-idea-intake-materialize-specspace-answers "
                    "SPECSPACE_REAL_IDEA_ANSWERS=<SpecSpace state>"
                ),
            }
        )
    elif not _readiness(continuation_report)["ready"]:
        recommended_actions.append(
            {
                "id": "fix_answer_continuation",
                "label": "Fix answer continuation",
                "next_action": "Resolve continuation findings before candidate generation.",
            }
        )
    else:
        recommended_actions.append(
            {
                "id": "continue_active_candidate",
                "label": "Continue active candidate",
                "next_action": (
                    "Run `make real-idea-intake-continue-from-specspace-answers` "
                    "or the Platform handoff."
                ),
                "command_hint": (
                    "scripts/platform.py product-real-idea-continuation execute "
                    "--answer-state <SpecSpace state dir>/"
                    "idea_to_spec_intake_clarification_answers.json"
                ),
            }
        )
    return {
        "available": import_preview is not None or continuation_report is not None,
        "ready": ready,
        "import_preview": {
            "available": import_preview is not None,
            "readiness": _readiness(import_preview),
            "summary": preview_summary,
            "accepted_answer_count": _number(
                preview_import.get("accepted_answer_count")
            )
            or _number(preview_summary.get("accepted_answer_count")),
            "answer_count": _number(preview_import.get("answer_count"))
            or _number(preview_summary.get("answer_count")),
            "findings": _findings(import_preview),
            "source_artifacts": preview_sources,
        },
        "continuation_report": {
            "available": continuation_report is not None,
            "readiness": _readiness(continuation_report),
            "summary": continuation_summary,
            "outputs": continuation_outputs,
            "findings": _findings(continuation_report),
        },
        "recommended_actions": recommended_actions,
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_apply_answers": False,
            "may_mutate_candidate_source_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
        },
    }


def _real_idea_entry_execution(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    target_make = _record((report or {}).get("target_make"))
    output_artifacts = _product_repair_rerun_output_artifacts(report)
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "dry_run": (report or {}).get("dry_run") is True,
        "status": _optional_text(summary.get("status")) or "missing",
        "run_dir": _safe_ref((report or {}).get("run_dir")),
        "target": _optional_text(target_make.get("target")),
        "entry_requests_handoff_ref": _safe_ref(
            (report or {}).get("entry_requests_handoff_ref")
        ),
        "entry_requests_source_digest": _optional_text(
            (report or {}).get("entry_requests_source_digest")
        ),
        "output_refs": _safe_refs([item.get("path") for item in output_artifacts]),
        "output_artifacts": output_artifacts,
        "output_artifact_count": _number(summary.get("output_artifact_count")),
        "diagnostic_count": len(_records((report or {}).get("diagnostics"))),
        "operations": _product_repair_rerun_operations(report),
    }


def _workspace_initialization_authority_trusted(report: dict[str, Any] | None) -> bool:
    if report is None:
        return False
    boundary = _record(report.get("authority_boundary"))
    for key in (
        "creates_git_commits",
        "opens_pull_requests",
        "publishes_read_models",
        "mutates_canonical_specs",
        "writes_ontology_packages",
        "accepts_ontology_terms",
    ):
        if boundary.get(key) is True:
            return False
    return True


def _workspace_initialization_request_authority_trusted(
    report: dict[str, Any] | None,
) -> bool:
    if report is None:
        return False
    boundary = _record(report.get("authority_boundary"))
    for key, value in boundary.items():
        if value is True and (
            key.startswith("may_")
            or key
            in {
                "executes_specgraph",
                "executes_platform",
                "creates_workspace_files",
                "updates_workspace_catalog",
                "creates_git_commits",
                "opens_pull_requests",
                "publishes_read_models",
                "mutates_canonical_specs",
                "writes_ontology_packages",
                "accepts_ontology_terms",
            }
        ):
            return False
    return True


def _workspace_initialization_surface(
    *,
    plan: dict[str, Any] | None,
    execution_request: dict[str, Any] | None,
    execution: dict[str, Any] | None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    plan_summary = _record((plan or {}).get("summary"))
    request_summary = _record((execution_request or {}).get("summary"))
    execution_summary = _record((execution or {}).get("summary"))
    workspace = _record((execution or execution_request or plan or {}).get("workspace"))
    plan_trusted = (
        plan is None
        or plan.get("artifact_kind")
        == "platform_product_workspace_initialization_plan"
    )
    request_trusted = (
        execution_request is None
        or (
            execution_request.get("artifact_kind")
            == "platform_product_workspace_initialization_execution_request"
            and _workspace_initialization_request_authority_trusted(execution_request)
        )
    )
    trusted = (
        execution is not None
        and execution.get("artifact_kind")
        == "platform_product_workspace_initialization_execution_report"
        and _workspace_initialization_authority_trusted(execution)
    )
    execution_workspace_id = _optional_text(_record((execution or {}).get("workspace")).get("workspace_id"))
    workspace_matches = (
        workspace_id is not None
        and execution_workspace_id is not None
        and execution_workspace_id == workspace_id
    )
    initialized = (
        trusted
        and workspace_matches
        and execution.get("ok") is True
        and execution.get("dry_run") is not True
        and execution_summary.get("catalog_written") is True
        and execution_summary.get("workspace_files_created") is True
    )
    return {
        "available": plan is not None or execution_request is not None or execution is not None,
        "trusted": (
            (trusted if execution is not None else True)
            and plan_trusted
            and request_trusted
        ),
        "initialized": initialized,
        "plan": {
            "available": plan is not None,
            "trusted": plan_trusted,
            "ok": plan_trusted and (plan or {}).get("ok") is True,
            "status": _optional_text(plan_summary.get("status")),
            "ready_for_platform_initialization": (
                plan_trusted
                and plan_summary.get("ready_for_platform_initialization") is True
            ),
        },
        "execution_request": {
            "available": execution_request is not None,
            "trusted": request_trusted,
            "ok": request_trusted and (execution_request or {}).get("ok") is True,
            "status": _optional_text(request_summary.get("status")),
            "ready_for_managed_execution": (
                request_trusted
                and request_summary.get("ready_for_managed_execution") is True
            ),
            "requested_operation": _optional_text(
                (execution_request or {}).get("requested_operation")
            ),
            "idempotency_key": _optional_text(
                (execution_request or {}).get("idempotency_key")
            ),
        },
        "execution": {
            "available": execution is not None,
            "ok": (execution or {}).get("ok") is True,
            "dry_run": (execution or {}).get("dry_run") is True,
            "status": _optional_text(execution_summary.get("status")),
            "specgraph_executed": execution_summary.get("specgraph_executed")
            is True,
            "catalog_written": execution_summary.get("catalog_written") is True,
            "workspace_files_created": execution_summary.get("workspace_files_created")
            is True,
            "error_count": _number(execution_summary.get("error_count")),
            "operations": _string_list((execution or {}).get("executed_operations")),
        },
        "workspace": {
            "workspace_id": _optional_text(workspace.get("workspace_id")),
            "display_name": _optional_text(workspace.get("display_name")),
            "route": _optional_text(workspace.get("route")),
            "repository_role": _optional_text(workspace.get("repository_role")),
        },
        "refs": {
            "plan": _safe_ref(
                (execution or execution_request or {}).get("plan_ref")
            ),
            "catalog": _safe_ref((execution or plan or {}).get("catalog_ref")),
            "specgraph_initialization_report": _safe_ref(
                (execution or {}).get("specgraph_initialization_report_ref")
            ),
        },
        "diagnostic_count": len(
            _records((execution or execution_request or plan or {}).get("diagnostics"))
        ),
        "authority_boundary": _record(
            (execution or execution_request or plan or {}).get("authority_boundary")
        ),
    }


def _intake_clarification_lane(
    *,
    clarification_requests: dict[str, Any] | None,
    clarification_answers: dict[str, Any] | None,
    rerun_input: dict[str, Any] | None,
    clarified_session: dict[str, Any] | None,
    clarified_source: dict[str, Any] | None,
    rerun_report: dict[str, Any] | None,
    answer_template: dict[str, Any] | None,
    answer_authoring_report: dict[str, Any] | None,
    real_idea_answer_set: dict[str, Any] | None,
    specspace_answer_import_preview: dict[str, Any] | None,
    answer_continuation_report: dict[str, Any] | None,
) -> dict[str, Any]:
    requests = _clarification_request_rows(clarification_requests)
    answer_rows = _intake_answer_rows(clarification_answers)
    request_counts = _record((clarification_requests or {}).get("request_counts"))
    answer_summary = _record((clarification_answers or {}).get("summary"))
    rerun_summary = _record((rerun_input or {}).get("summary"))
    report_summary = _record((rerun_report or {}).get("summary"))
    return {
        "available": any(
            artifact is not None
            for artifact in (
                clarification_requests,
                clarification_answers,
                rerun_input,
                clarified_session,
                clarified_source,
                rerun_report,
            )
        ),
        "clarification_requests": {
            "available": clarification_requests is not None,
            "readiness": _readiness(clarification_requests),
            "summary": request_counts,
            "requests": requests,
            "request_count": len(requests)
            or _number(request_counts.get("total"))
            or _number(request_counts.get("request_count")),
            "blocking_request_count": sum(
                1 for request in requests if request["severity"] == "blocking"
            )
            or _number(request_counts.get("blocking")),
        },
        "clarification_answers": {
            "available": clarification_answers is not None,
            "readiness": _readiness(clarification_answers),
            "summary": answer_summary,
            "answers": answer_rows,
            "answer_count": len(answer_rows)
            or _number(answer_summary.get("answer_count")),
            "accepted_answer_count": _number(answer_summary.get("accepted_answer_count")),
            "unresolved_blocking_count": _number(
                answer_summary.get("unresolved_blocking_count")
            ),
        },
        "rerun_input": {
            "available": rerun_input is not None,
            "readiness": _readiness(rerun_input),
            "summary": rerun_summary,
            "accepted_target_count": _number(rerun_summary.get("accepted_target_count")),
        },
        "clarified_session": {
            "available": clarified_session is not None,
            "readiness": _readiness(clarified_session),
            "summary": _record((clarified_session or {}).get("summary")),
        },
        "clarified_source": {
            "available": clarified_source is not None,
            "readiness": _readiness(clarified_source),
            "summary": _record((clarified_source or {}).get("summary")),
        },
        "rerun_report": {
            "available": rerun_report is not None,
            "readiness": _readiness(rerun_report),
            "summary": report_summary,
            "accepted_target_count": _number(report_summary.get("accepted_target_count")),
        },
        "answer_authoring": _real_idea_answer_authoring(
            template=answer_template,
            report=answer_authoring_report,
            answer_set=real_idea_answer_set,
        ),
        "answer_continuation": _real_idea_answer_continuation(
            import_preview=specspace_answer_import_preview,
            continuation_report=answer_continuation_report,
        ),
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_execute_specgraph": False,
            "may_execute_prompt_agent": False,
            "may_apply_answers": False,
            "may_mutate_candidate_source_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
        },
    }


def _real_idea_intake_boundary() -> dict[str, bool]:
    return {
        "inspect_only": True,
        "acknowledge_only": True,
        "may_execute_specgraph": False,
        "may_execute_platform": False,
        "may_execute_prompt_agent": False,
        "may_apply_answers": False,
        "may_mutate_candidate_source_artifacts": False,
        "may_mutate_canonical_specs": False,
        "may_write_ontology_package": False,
        "may_accept_ontology_terms": False,
        "may_create_branch_or_commit": False,
    }


def _safe_ref(value: Any) -> str | None:
    ref = _optional_text(value)
    if ref is None:
        return None
    if ref.startswith("/") or ".." in ref.split("/"):
        return None
    return ref


def _safe_refs(values: list[Any]) -> list[str]:
    refs = []
    for value in values:
        ref = _safe_ref(value)
        if ref is not None:
            refs.append(ref)
    return refs


def _real_idea_intake_command_hint(status: str) -> str | None:
    if status == "continuation_ready":
        return "make real-idea-intake-continue-from-specspace-answers"
    if status == "answers_ready":
        return "make specspace-real-idea-answer-import-preview"
    return None


def _real_idea_intake_projection(
    *,
    workspace_id: str | None,
    intake: dict[str, Any] | None,
    active_candidate: dict[str, Any] | None,
    active_candidate_ref: str | None,
    clarification_requests: dict[str, Any] | None,
    intake_clarification: dict[str, Any],
    answer_authoring: dict[str, Any],
    answer_continuation: dict[str, Any],
    entry_execution_report: dict[str, Any] | None,
    statuses: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    requests = _record(intake_clarification.get("clarification_requests"))
    answers = _record(intake_clarification.get("clarification_answers"))
    clarified_session = _record(intake_clarification.get("clarified_session"))
    clarified_source = _record(intake_clarification.get("clarified_source"))
    template = _record(answer_authoring.get("template"))
    validation = _record(answer_authoring.get("validation"))
    answer_set = _record(answer_authoring.get("answer_set"))
    import_preview = _record(answer_continuation.get("import_preview"))
    continuation_report = _record(answer_continuation.get("continuation_report"))
    entry_execution = _real_idea_entry_execution(entry_execution_report)

    question_count = _first_optional_number(
        requests.get("request_count")
        if requests.get("available") is True
        else None,
        template.get("target_count")
        if template.get("available") is True
        else None,
    )
    answered_count = _first_optional_number(
        answers.get("accepted_answer_count")
        if answers.get("available") is True
        else None,
        answer_set.get("answer_count")
        if answer_set.get("available") is True
        else None,
        import_preview.get("accepted_answer_count")
        if import_preview.get("available") is True
        else None,
    )
    missing_count = max(question_count - answered_count, 0)
    validation_available = _record(answer_authoring.get("report")).get("available") is True
    invalid_answer_count = (
        _number(validation.get("finding_count"))
        if answered_count > 0
        and validation_available
        and validation.get("ready") is not True
        else 0
    )
    template_ready = _record(template.get("readiness")).get("ready") is True
    continuation_ready = answer_continuation.get("ready") is True
    candidate_source_ready = (
        clarified_source.get("available") is True
        and _record(clarified_source.get("readiness")).get("ready") is True
    )
    active_candidate_available = active_candidate is not None
    active_readiness = _record((active_candidate or {}).get("readiness"))
    active_candidate_ready = (
        active_candidate_available and active_readiness.get("ready") is True
    )
    answer_set_available = answer_set.get("available") is True
    blockers: list[str] = []
    if invalid_answer_count:
        blockers.extend(
            finding["finding_id"]
            for finding in _findings(_record(answer_authoring.get("report")))
            if finding.get("finding_id")
        )
    if active_candidate_available and not active_candidate_ready:
        blockers.extend(_string_list(active_readiness.get("blocked_by")))
    if entry_execution["available"] and not entry_execution["ok"]:
        blockers.append("real_idea_entry_intake_execution_failed")
    blockers.extend(_string_list(_record(requests.get("readiness")).get("blocked_by")))
    blockers.extend(_string_list(_record(template.get("readiness")).get("blocked_by")))
    blockers.extend(
        _string_list(_record(import_preview.get("readiness")).get("blocked_by"))
    )
    blockers.extend(
        _string_list(_record(continuation_report.get("readiness")).get("blocked_by"))
    )

    if active_candidate_ready:
        status = "active_candidate_ready"
        next_action = "Continue with repair, ontology review, and promotion readiness."
    elif active_candidate_available:
        status = "blocked"
        next_action = "Inspect active candidate readiness before continuing."
    elif candidate_source_ready:
        status = "candidate_source_ready"
        next_action = "Build or inspect the active idea-to-spec candidate."
    elif continuation_ready:
        status = "continuation_ready"
        next_action = "Continue the real idea intake into candidate source generation."
    elif answer_set_available and validation.get("ready") is not True:
        status = "needs_clarification"
        next_action = "Validate saved intake clarification answers before import preview."
    elif answered_count > 0 and validation.get("ready") is True:
        status = "answers_ready"
        next_action = "Build the SpecGraph answer import preview and continuation report."
    elif question_count > 0 or clarification_requests is not None or template_ready:
        status = "needs_clarification"
        next_action = "Answer intake clarification questions before candidate generation."
    elif entry_execution["available"] and entry_execution["dry_run"]:
        status = "missing"
        next_action = "Run the Platform real idea entry intake execution without dry-run."
    elif entry_execution["available"] and not entry_execution["ok"]:
        status = "blocked"
        next_action = "Inspect the Platform real idea entry intake execution report."
    elif entry_execution["available"]:
        status = "intake_ready"
        next_action = "Inspect generated intake artifacts before candidate generation."
    elif intake is not None:
        status = "intake_ready"
        next_action = "Continue the captured idea into candidate source generation."
    else:
        status = "missing"
        next_action = "Create a real idea intake session in SpecGraph."

    handoff_blocked = (
        invalid_answer_count
        or (
            import_preview.get("available") is True
            and _record(import_preview.get("readiness")).get("ready") is False
        )
        or (
            continuation_report.get("available") is True
            and _record(continuation_report.get("readiness")).get("ready") is False
        )
    )
    if (
        handoff_blocked
        and not active_candidate_ready
        and not candidate_source_ready
        and not continuation_ready
    ):
        status = "blocked"

    return {
        "available": any(
            item is not None
            for item in (
                intake,
                active_candidate,
                clarification_requests,
                entry_execution_report,
            )
        )
        or answer_authoring.get("available") is True
        or answer_continuation.get("available") is True,
        "status": status,
        "workspace_id": workspace_id,
        "session_ref": _safe_ref(statuses["intake_clarification_requests"]["path"])
        if requests.get("available") is True
        else None,
        "clarified_session_ref": (
            _safe_ref(statuses["clarified_intake_session"]["path"])
            if clarified_session.get("available") is True
            else None
        ),
        "candidate_source_ref": _safe_ref(statuses["clarified_intake_source"]["path"])
        if clarified_source.get("available") is True
        else None,
        "active_candidate_ref": _safe_ref(active_candidate_ref)
        if active_candidate_available
        else None,
        "next_action": next_action,
        "blockers": (
            sorted(set(blockers))
            if status in {"blocked", "needs_clarification", "answers_ready"}
            else []
        ),
        "clarification_progress": {
            "question_count": question_count,
            "answered_count": answered_count,
            "missing_count": missing_count,
            "invalid_answer_count": invalid_answer_count,
            "stale_answer_count": 0,
            "required_field_findings": _findings(
                _record(answer_authoring.get("report"))
            ),
        },
        "answer_template": {
            "status": _optional_text(validation.get("status"))
            or _optional_text(_record(template.get("readiness")).get("review_state"))
            or "missing",
            "template_ref": _safe_ref(statuses["real_idea_answer_template"]["path"])
            if template.get("available") is True
            else None,
            "target_count": _number(template.get("target_count")),
            "blocking_target_count": _number(template.get("blocking_target_count")),
            "required_fields": sorted(
                {
                    field
                    for target in _records(template.get("targets"))
                    for fields in _record(target.get("required_fields_by_action")).values()
                    for field in _string_list(fields)
                }
            ),
            "validation_status": _optional_text(validation.get("status")) or "unknown",
            "validation_ready": validation.get("ready") is True,
        },
        "continuation_handoff": {
            "import_preview_status": _optional_text(
                _record(import_preview.get("readiness")).get("review_state")
            )
            or ("missing" if import_preview.get("available") is not True else "unknown"),
            "materialization_status": _optional_text(
                _record(continuation_report.get("readiness")).get("review_state")
            )
            or (
                "missing"
                if continuation_report.get("available") is not True
                else "unknown"
            ),
            "safe_to_continue": continuation_ready,
            "output_refs": _safe_refs(
                list(_record(continuation_report.get("outputs")).values())
            ),
            "command_hint": _real_idea_intake_command_hint(status),
        },
        "entry_execution": entry_execution,
        "source_refs": _safe_refs(
            [
                statuses["platform_real_idea_entry_intake_execution"]["path"]
                if entry_execution["available"] is True
                else None,
                statuses["intake_clarification_requests"]["path"]
                if requests.get("available") is True
                else None,
                statuses["real_idea_answer_template"]["path"]
                if template.get("available") is True
                else None,
                statuses["specspace_real_idea_answer_import_preview"]["path"]
                if import_preview.get("available") is True
                else None,
                statuses["real_idea_answer_continuation_report"]["path"]
                if continuation_report.get("available") is True
                else None,
            ]
        ),
        "authority_boundary": _real_idea_intake_boundary(),
    }


def _ontology_decision_rows(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for item in _records((report or {}).get("decisions"))[
        : DISPLAY_LIMITS["ontology_decisions"]
    ]:
        decision_id = _text(item.get("id"))
        if not decision_id:
            continue
        rows.append(
            {
                "id": decision_id,
                "decision_type": _text(item.get("decision_type"), "unknown"),
                "status": _text(item.get("status"), "unknown"),
                "term": _optional_text(item.get("term")),
                "ontology_ref": _optional_text(item.get("ontology_ref")),
                "alias_of": _optional_text(item.get("alias_of")),
                "target_ref": _optional_text(item.get("target_ref")),
                "request_id": _optional_text(item.get("request_id")),
                "materialization_intent": _optional_text(
                    item.get("materialization_intent")
                ),
            }
        )
    return rows


def _project_local_ontology_terms(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for item in _records((report or {}).get("terms"))[
        : DISPLAY_LIMITS["project_local_ontology_terms"]
    ]:
        term_key = _text(item.get("term_key"))
        if not term_key:
            continue
        effect = _record(item.get("effect"))
        rows.append(
            {
                "id": _text(item.get("id"), f"project-local-ontology-term.{term_key}"),
                "term": _optional_text(item.get("term")),
                "term_key": term_key,
                "status": _text(item.get("status"), "unreviewed"),
                "selected_decision_id": _optional_text(item.get("selected_decision_id")),
                "source_refs": _string_list(item.get("source_refs")),
                "suggested_actions": _string_list(item.get("suggested_actions")),
                "evidence_refs": _string_list(item.get("evidence_refs")),
                "gap_refs": [
                    {
                        "gap_id": _optional_text(gap.get("gap_id")),
                        "node_id": _optional_text(gap.get("node_id")),
                        "target_ref": _optional_text(gap.get("target_ref")),
                        "source_ref": _optional_text(gap.get("source_ref")),
                        "source_kind": _optional_text(gap.get("source_kind")),
                        "statement": _optional_text(gap.get("statement")),
                        "suggested_action": _optional_text(gap.get("suggested_action")),
                    }
                    for gap in _records(item.get("gap_refs"))
                ],
                "resolved_gap_refs": [
                    {
                        "gap_id": _optional_text(gap.get("gap_id")),
                        "node_id": _optional_text(gap.get("node_id")),
                        "target_ref": _optional_text(gap.get("target_ref")),
                        "decision": _optional_text(gap.get("decision")),
                        "match_kind": _optional_text(gap.get("match_kind")),
                    }
                    for gap in _records(item.get("resolved_gap_refs"))
                ],
                "decisions": [
                    {
                        "id": _optional_text(decision.get("id")),
                        "decision_type": _optional_text(decision.get("decision_type")),
                        "review_status": _optional_text(decision.get("review_status")),
                        "term": _optional_text(decision.get("term")),
                        "term_scope": _optional_text(decision.get("term_scope")),
                        "ontology_ref": _optional_text(decision.get("ontology_ref")),
                        "alias_of": _optional_text(decision.get("alias_of")),
                        "target_ref": _optional_text(decision.get("target_ref")),
                        "reason": _optional_text(decision.get("reason")),
                    }
                    for decision in _records(item.get("decisions"))
                ],
                "effect": {
                    "candidate_readiness_effect": _optional_text(
                        effect.get("candidate_readiness_effect")
                    ),
                    "next_action": _optional_text(effect.get("next_action")),
                    "resolved_gap_count": _number(effect.get("resolved_gap_count")),
                },
            }
        )
    return rows


def _project_local_ontology_effect_review(
    report: dict[str, Any] | None,
) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    context = _record((report or {}).get("context"))
    return {
        "available": report is not None,
        "readiness": _readiness(report),
        "summary": summary,
        "context": {
            "workspace_id": _optional_text(context.get("workspace_id")),
            "candidate_id": _optional_text(context.get("candidate_id")),
            "repair_session_id": _optional_text(context.get("repair_session_id")),
            "workflow_lane": _optional_text(context.get("workflow_lane")),
        },
        "status": _optional_text(summary.get("status"))
        or _optional_text(summary.get("review_status")),
        "accepted_decision_count": _number(summary.get("accepted_decision_count")),
        "maturity_evidence_decision_count": _number(
            summary.get("maturity_evidence_decision_count")
        ),
        "keep_project_local_count": _number(summary.get("keep_project_local_count")),
        "bind_existing_count": _number(summary.get("bind_existing_count")),
        "alias_count": _number(summary.get("alias_count")),
        "request_promotion_count": _number(summary.get("request_promotion_count")),
        "reject_count": _number(summary.get("reject_count")),
        "deferred_count": _number(summary.get("deferred_count")),
        "non_resolving_decision_count": _number(
            summary.get("non_resolving_decision_count")
        ),
        "invalid_decision_count": _number(summary.get("invalid_decision_count")),
        "missing_decision_count": _number(summary.get("missing_decision_count")),
        "blocking_decision_count": _number(summary.get("blocking_decision_count")),
        "follow_up_decision_count": _number(
            summary.get("follow_up_decision_count")
        ),
        "effect_count": _number(summary.get("effect_count")),
        "ready_for_maturity": summary.get("ready_for_maturity") is True,
        "source_ref": f"runs/{PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_REPORT_ARTIFACT}"
        if report is not None
        else None,
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_apply_decisions": False,
            "may_mutate_candidate_artifacts": False,
            "may_accept_ontology_terms": False,
            "may_write_ontology_package": False,
            "may_create_branch_or_commit": False,
        },
    }


def _project_local_ontology_review_lane(
    report: dict[str, Any] | None,
    effect_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    schema = _record((report or {}).get("review_decision_schema"))
    context = _record((report or {}).get("context"))
    effective_review = _project_local_ontology_effect_review(effect_report)
    return {
        "available": report is not None,
        "readiness": _readiness(report),
        "summary": summary,
        "effective_review": effective_review,
        "context": {
            "workspace_id": _optional_text(context.get("workspace_id")),
            "candidate_id": _optional_text(context.get("candidate_id")),
            "repair_session_id": _optional_text(context.get("repair_session_id")),
            "workflow_lane": _optional_text(context.get("workflow_lane")),
            "domain_refs": _string_list(context.get("domain_refs")),
            "context_refs": _string_list(context.get("context_refs")),
            "ontology_refs": _string_list(context.get("ontology_refs")),
        },
        "source_artifacts": _record((report or {}).get("source_artifacts")),
        "supported_actions": _string_list(schema.get("supported_actions")),
        "authority": _optional_text(schema.get("authority")),
        "request_workspace_promotion_effect": _optional_text(
            schema.get("request_workspace_promotion_effect")
        ),
        "terms": _project_local_ontology_terms(report),
        "term_count": _number(summary.get("term_count")),
        "reviewed_term_count": _number(summary.get("reviewed_term_count")),
        "blocking_term_count": _number(summary.get("blocking_term_count")),
        "unreviewed_term_count": _number(summary.get("unreviewed_term_count")),
        "deferred_term_count": _number(summary.get("deferred_term_count")),
        "status_counts": _record(summary.get("status_counts")),
        "findings": _findings(report),
        "warnings": _records((report or {}).get("warnings"))[
            : DISPLAY_LIMITS["findings"]
        ],
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_apply_decisions": False,
            "may_mutate_candidate_artifacts": False,
            "may_accept_ontology_terms": False,
            "may_write_ontology_package": False,
            "may_create_branch_or_commit": False,
        },
    }


def _project_local_ontology_effect_ready(
    project_local_ontology_review: dict[str, Any],
) -> bool:
    effective_review = _record(project_local_ontology_review.get("effective_review"))
    readiness = _record(effective_review.get("readiness"))
    return (
        effective_review.get("available") is True
        and readiness.get("ready") is True
        and effective_review.get("ready_for_maturity") is True
        and _number(effective_review.get("blocking_decision_count")) == 0
        and _number(effective_review.get("invalid_decision_count")) == 0
        and _number(effective_review.get("missing_decision_count")) == 0
        and _number(effective_review.get("deferred_count")) == 0
        and _number(effective_review.get("follow_up_decision_count")) == 0
    )


def _project_local_ontology_import_decision_rows(
    values: Any,
) -> list[dict[str, Any]]:
    rows = []
    for item in _records(values)[
        : DISPLAY_LIMITS["project_local_ontology_import_decisions"]
    ]:
        decision_id = _text(item.get("id")) or _text(item.get("decision_id"))
        if not decision_id:
            continue
        rows.append(
            {
                "id": decision_id,
                "source_decision_id": _optional_text(item.get("source_decision_id")),
                "source_artifact": _optional_text(item.get("source_artifact")),
                "decision_type": _optional_text(item.get("decision_type")),
                "review_action": _optional_text(item.get("review_action")),
                "status": _optional_text(item.get("status")),
                "materialization_intent": _optional_text(
                    item.get("materialization_intent")
                ),
                "term": _optional_text(item.get("term")),
                "term_key": _optional_text(item.get("term_key")),
                "target_ref": _optional_text(item.get("target_ref")),
                "gap_refs": [
                    {
                        "gap_id": _optional_text(gap.get("gap_id")),
                        "node_id": _optional_text(gap.get("node_id")),
                        "target_ref": _optional_text(gap.get("target_ref")),
                        "source_ref": _optional_text(gap.get("source_ref")),
                    }
                    for gap in _records(item.get("gap_refs"))
                ],
                "decision_value": _record(item.get("decision_value")),
                "writes_ontology_package": item.get("writes_ontology_package") is True,
                "accepts_ontology_terms": item.get("accepts_ontology_terms") is True,
                "applies_to_specgraph": item.get("applies_to_specgraph") is True,
            }
        )
    return rows


def _project_local_ontology_import_issue_rows(
    values: Any,
) -> list[dict[str, Any]]:
    rows = []
    seen_ids: dict[str, int] = {}
    for index, item in enumerate(_records(values)[
        : DISPLAY_LIMITS["project_local_ontology_import_decisions"]
    ]):
        base_issue_id = (
            _text(item.get("decision_id"))
            or _text(item.get("term_key"))
            or _text(item.get("id"))
            or f"import-issue-{index}"
        )
        occurrence = seen_ids.get(base_issue_id, 0)
        seen_ids[base_issue_id] = occurrence + 1
        issue_id = base_issue_id if occurrence == 0 else f"{base_issue_id}:{occurrence}"
        rows.append(
            {
                "id": issue_id,
                "source_id": _optional_text(item.get("id")),
                "decision_id": _optional_text(item.get("decision_id")),
                "term_key": _optional_text(item.get("term_key")),
                "term": _optional_text(item.get("term")),
                "action": _optional_text(item.get("action")),
                "reason": _optional_text(item.get("reason")),
                "field": _optional_text(item.get("field")),
                "expected": _optional_text(item.get("expected")),
                "actual": _optional_text(item.get("actual")),
                "status": _optional_text(item.get("status")),
            }
        )
    return rows


def _project_local_ontology_decision_import_preview(
    report: dict[str, Any] | None,
) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    context = _record((report or {}).get("context"))
    preview = _record((report or {}).get("import_preview"))
    return {
        "available": report is not None,
        "readiness": _readiness(report),
        "summary": summary,
        "context": {
            "workspace_id": _optional_text(context.get("workspace_id")),
            "candidate_id": _optional_text(context.get("candidate_id")),
            "repair_session_id": _optional_text(context.get("repair_session_id")),
            "workflow_lane": _optional_text(context.get("workflow_lane")),
            "domain_refs": _string_list(context.get("domain_refs")),
            "context_refs": _string_list(context.get("context_refs")),
            "ontology_refs": _string_list(context.get("ontology_refs")),
        },
        "source_artifacts": _record((report or {}).get("source_artifacts")),
        "accepted_decisions": _project_local_ontology_import_decision_rows(
            preview.get("accepted_decisions")
        ),
        "non_resolving_decisions": _project_local_ontology_import_decision_rows(
            preview.get("non_resolving_decisions")
        ),
        "invalid_decisions": _project_local_ontology_import_issue_rows(
            preview.get("invalid_decisions")
        ),
        "missing_decisions": _project_local_ontology_import_issue_rows(
            preview.get("missing_decisions")
        ),
        "decision_candidates": _project_local_ontology_import_decision_rows(
            (report or {}).get("decision_candidates")
        ),
        "decision_count": _number(summary.get("decision_count")),
        "accepted_decision_count": _number(summary.get("accepted_decision_count")),
        "non_resolving_decision_count": _number(
            summary.get("non_resolving_decision_count")
        ),
        "invalid_decision_count": _number(summary.get("invalid_decision_count")),
        "missing_decision_count": _number(summary.get("missing_decision_count")),
        "finding_count": _number(summary.get("finding_count")),
        "findings": _findings(report),
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_apply_decisions": False,
            "may_mutate_candidate_artifacts": False,
            "may_accept_ontology_terms": False,
            "may_write_ontology_package": False,
            "may_create_branch_or_commit": False,
        },
    }


def _repair_session_stage_rows(
    repair_session: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    workflow_journal = _record((repair_session or {}).get("workflow_journal"))
    rows = []
    for item in _records(workflow_journal.get("stages")):
        stage = _text(item.get("stage"))
        if not stage:
            continue
        stage_index = item.get("index")
        rows.append(
            {
                "stage": stage,
                "index": (
                    stage_index
                    if isinstance(stage_index, int)
                    and not isinstance(stage_index, bool)
                    else None
                ),
                "artifact_kind": _optional_text(item.get("artifact_kind")),
                "source_ref": _optional_text(item.get("source_ref")),
                "ready": item.get("ready") is True,
                "review_state": _optional_text(item.get("review_state")),
                "status": _optional_text(item.get("status")),
                "blocked_by": _string_list(item.get("blocked_by")),
                "next_artifact": _optional_text(item.get("next_artifact")),
            }
        )
    return rows


def _repair_session_open_blockers(
    repair_session: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    readiness_impact = _record((repair_session or {}).get("readiness_impact"))
    rows = [
        {"kind": "repair_session", "id": blocker}
        for blocker in _string_list(readiness_impact.get("blocked_by"))
    ]
    rows.extend(
        {"kind": "platform_promotion", "id": blocker}
        for blocker in _string_list(readiness_impact.get("platform_promotion_blocked_by"))
    )
    seen = set()
    unique_rows = []
    for row in rows:
        key = (row["kind"], row["id"])
        if key in seen:
            continue
        seen.add(key)
        unique_rows.append(row)
    return unique_rows


def _repair_session(
    repair_session: dict[str, Any] | None,
) -> dict[str, Any]:
    summary = _record((repair_session or {}).get("summary"))
    session = _record((repair_session or {}).get("session"))
    readiness_impact = _record((repair_session or {}).get("readiness_impact"))
    workflow_journal = _record((repair_session or {}).get("workflow_journal"))
    rerun_overlay_refs = _record(workflow_journal.get("rerun_overlay_refs"))
    preview_refs = _record(workflow_journal.get("preview_refs"))
    return {
        "available": repair_session is not None,
        "source_mode": "journal" if repair_session is not None else "legacy_artifacts",
        "readiness": _readiness(repair_session),
        "summary": summary,
        "session": {
            "session_id": _optional_text(session.get("session_id")),
            "candidate_id": _optional_text(session.get("candidate_id")),
            "workflow_lane": _optional_text(session.get("workflow_lane")),
            "workspace_route": _optional_text(session.get("workspace_route")),
            "target_repository_role": _optional_text(
                session.get("target_repository_role")
            ),
            "governance_profile": _optional_text(session.get("governance_profile")),
            "operator_ref": _optional_text(session.get("operator_ref")),
        },
        "readiness_impact": {
            "ready_for_candidate_approval": readiness_impact.get(
                "ready_for_candidate_approval"
            )
            is True
            or summary.get("ready_for_candidate_approval") is True,
            "ready_for_platform_promotion": readiness_impact.get(
                "ready_for_platform_promotion"
            )
            is True,
            "intermediate_artifacts_ready": readiness_impact.get(
                "intermediate_artifacts_ready"
            )
            is True,
            "candidate_quality_review_state": _optional_text(
                readiness_impact.get("candidate_quality_review_state")
            ),
            "promotion_gate_review_state": _optional_text(
                readiness_impact.get("promotion_gate_review_state")
            ),
            "active_candidate_review_state": _optional_text(
                readiness_impact.get("active_candidate_review_state")
            ),
            "resolved_ontology_gap_count": _number(
                readiness_impact.get("resolved_ontology_gap_count")
                if "resolved_ontology_gap_count" in readiness_impact
                else summary.get("resolved_ontology_gap_count")
            ),
            "unresolved_ontology_gap_count": _number(
                readiness_impact.get("unresolved_ontology_gap_count")
                if "unresolved_ontology_gap_count" in readiness_impact
                else summary.get("unresolved_ontology_gap_count")
            ),
            "rerun_removed_gap_count": _number(
                readiness_impact.get("rerun_removed_gap_count")
            ),
            "clarification_request_count": _number(
                readiness_impact.get("clarification_request_count")
                if "clarification_request_count" in readiness_impact
                else summary.get("clarification_request_count")
            ),
            "accepted_answer_count": _number(
                readiness_impact.get("accepted_answer_count")
                if "accepted_answer_count" in readiness_impact
                else summary.get("accepted_answer_count")
            ),
            "ontology_decision_count": _number(
                readiness_impact.get("ontology_decision_count")
                if "ontology_decision_count" in readiness_impact
                else summary.get("ontology_decision_count")
            ),
            "promotion_path_count": _number(
                readiness_impact.get("promotion_path_count")
            ),
            "blocked_by": _string_list(readiness_impact.get("blocked_by")),
            "platform_promotion_blocked_by": _string_list(
                readiness_impact.get("platform_promotion_blocked_by")
            ),
        },
        "stages": _repair_session_stage_rows(repair_session),
        "open_blockers": _repair_session_open_blockers(repair_session),
        "accepted_answers": _accepted_answer_rows(
            repair_session=repair_session,
            clarification_answers=None,
        ),
        "ontology_decisions": _ontology_decision_rows(
            {"decisions": _records(workflow_journal.get("ontology_decisions"))}
        ),
        "rerun_overlay": {
            "source_ref": _optional_text(rerun_overlay_refs.get("source_ref")),
            "summary": _record(rerun_overlay_refs.get("summary")),
        },
        "preview_refs": {
            "rerun_preview": _record(preview_refs.get("rerun_preview")),
            "rerun_materialization": _record(
                preview_refs.get("rerun_materialization")
            ),
        },
        "findings": _findings(repair_session),
        "authority_boundary": _record((repair_session or {}).get("authority_boundary")),
        "privacy_boundary": _record((repair_session or {}).get("privacy_boundary")),
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_apply_answers": False,
            "may_apply_decisions": False,
            "may_mutate_candidate_artifacts": False,
            "may_accept_ontology_terms": False,
            "may_write_ontology_package": False,
            "may_create_branch_or_commit": False,
        },
    }


def _ontology_hint_counts(rerun_input: dict[str, Any] | None) -> dict[str, int]:
    overlay = _record((rerun_input or {}).get("rerun_input_overlay"))
    hints = _record(overlay.get("ontology_review_hints"))
    return {
        "term_binding_count": len(_records(hints.get("term_bindings"))),
        "alias_count": len(_records(hints.get("aliases"))),
        "project_local_term_count": len(_records(hints.get("project_local_terms"))),
        "rejected_term_count": len(_records(hints.get("rejected_terms"))),
        "deferred_term_count": len(_records(hints.get("deferred_terms"))),
    }


def _resolved_gap_rows(rerun_preview: dict[str, Any] | None) -> list[dict[str, Any]]:
    preview = _record((rerun_preview or {}).get("rerun_preview"))
    gap_preview = _record(preview.get("ontology_gap_preview"))
    rows = []
    for item in _records(gap_preview.get("resolved_ontology_gaps"))[
        : DISPLAY_LIMITS["resolved_gaps"]
    ]:
        gap_id = _text(item.get("gap_id"))
        if not gap_id:
            continue
        resolution = _record(item.get("resolution_preview"))
        rows.append(
            {
                "gap_id": gap_id,
                "node_id": _optional_text(item.get("node_id")),
                "term": _optional_text(item.get("term")),
                "source_ref": _optional_text(item.get("source_ref")),
                "decision": _optional_text(resolution.get("decision")),
                "target_ref": _optional_text(resolution.get("target_ref")),
            }
        )
    return rows


def _repair_review_lane(
    *,
    repair_session: dict[str, Any] | None,
    clarification_requests: dict[str, Any] | None,
    clarification_answers: dict[str, Any] | None,
    ontology_decisions: dict[str, Any] | None,
    rerun_input: dict[str, Any] | None,
    rerun_preview: dict[str, Any] | None,
    rerun_materialization: dict[str, Any] | None,
    product_repair_rerun_execution: dict[str, Any] | None,
    product_repair_rerun_publication: dict[str, Any] | None,
) -> dict[str, Any]:
    session_view = _repair_session(repair_session)
    readiness_impact = session_view["readiness_impact"]
    workflow_journal = _record((repair_session or {}).get("workflow_journal"))
    requests = _clarification_request_rows(clarification_requests)
    accepted_answers = _accepted_answer_rows(
        repair_session=repair_session,
        clarification_answers=clarification_answers,
    )
    decisions = (
        session_view["ontology_decisions"]
        if repair_session is not None
        else _ontology_decision_rows(ontology_decisions)
    )
    rerun_preview_body = _record((rerun_preview or {}).get("rerun_preview"))
    gap_preview = _record(rerun_preview_body.get("ontology_gap_preview"))
    quality_preview = _record(rerun_preview_body.get("candidate_quality_preview"))
    materialization_preview = _record(
        (rerun_materialization or {}).get("materialization_preview")
    )
    delta = _record(materialization_preview.get("delta"))
    rerun_overlay_refs = _record(workflow_journal.get("rerun_overlay_refs"))
    preview_refs = _record(workflow_journal.get("preview_refs"))
    journal_rerun_preview_summary = _record(
        _record(preview_refs.get("rerun_preview")).get("summary")
    )
    journal_rerun_materialization_summary = _record(
        _record(preview_refs.get("rerun_materialization")).get("summary")
    )
    request_count = len(
        _records((clarification_requests or {}).get("clarification_requests"))
    )
    if request_count == 0:
        request_count = _number(readiness_impact.get("clarification_request_count"))
    answer_count = _clarification_answer_count(clarification_answers)
    if answer_count == 0:
        answer_count = len(accepted_answers)
    return {
        "available": any(
            artifact is not None
            for artifact in (
                repair_session,
                clarification_requests,
                clarification_answers,
                ontology_decisions,
                rerun_input,
                rerun_preview,
                rerun_materialization,
                product_repair_rerun_execution,
                product_repair_rerun_publication,
            )
        ),
        "clarification_requests": {
            "available": clarification_requests is not None,
            "readiness": _readiness(clarification_requests),
            "summary": _record((clarification_requests or {}).get("request_counts")),
            "requests": requests,
            "repair_targets": _product_spec_repair_targets(requests),
            "request_count": request_count,
            "ontology_gap_request_count": sum(
                1 for request in requests if request["kind"] == "ontology_gap"
            ),
        },
        "clarification_answers": {
            "available": clarification_answers is not None,
            "readiness": _readiness(clarification_answers),
            "summary": _record((clarification_answers or {}).get("summary")),
            "answer_count": answer_count,
            "accepted_answers": accepted_answers,
            "unresolved_blocking_count": len(
                _records((clarification_answers or {}).get("unresolved_blocking_requests"))
            ),
        },
        "ontology_decisions": {
            "available": ontology_decisions is not None,
            "readiness": _readiness(ontology_decisions),
            "summary": _record((ontology_decisions or {}).get("summary")),
            "decisions": decisions,
            "decision_count": len(decisions),
        },
        "rerun_input": {
            "available": rerun_input is not None,
            "readiness": _readiness(rerun_input),
            "summary": _record((rerun_input or {}).get("summary"))
            or _record(rerun_overlay_refs.get("summary")),
            "ontology_hint_counts": _ontology_hint_counts(rerun_input),
        },
        "rerun_preview": {
            "available": rerun_preview is not None,
            "readiness": _readiness(rerun_preview),
            "summary": _record((rerun_preview or {}).get("summary"))
            or journal_rerun_preview_summary,
            "candidate_quality_preview": {
                "review_state": _optional_text(
                    quality_preview.get("review_state")
                    or readiness_impact.get("candidate_quality_review_state")
                    or journal_rerun_preview_summary.get(
                        "candidate_quality_review_state"
                    )
                ),
                "ontology_gap_state": _optional_text(
                    quality_preview.get("ontology_gap_state")
                ),
                "resolved_ontology_gap_count": _number(
                    quality_preview.get("resolved_ontology_gap_count")
                    if "resolved_ontology_gap_count" in quality_preview
                    else readiness_impact.get("resolved_ontology_gap_count")
                ),
                "unresolved_ontology_gap_count": _number(
                    quality_preview.get("unresolved_ontology_gap_count")
                    if "unresolved_ontology_gap_count" in quality_preview
                    else readiness_impact.get("unresolved_ontology_gap_count")
                ),
            },
            "resolved_gaps": _resolved_gap_rows(rerun_preview),
            "unresolved_ontology_gap_count": _number(
                gap_preview.get("unresolved_ontology_gap_count")
                if "unresolved_ontology_gap_count" in gap_preview
                else readiness_impact.get("unresolved_ontology_gap_count")
            ),
        },
        "rerun_materialization": {
            "available": rerun_materialization is not None,
            "readiness": _readiness(rerun_materialization),
            "summary": _record((rerun_materialization or {}).get("summary"))
            or journal_rerun_materialization_summary,
            "delta": {
                "removed_gap_ids": _string_list(delta.get("removed_gap_ids")),
                "unresolved_ontology_gap_ids": _string_list(
                    delta.get("unresolved_ontology_gap_ids")
                ),
                "resolved_ontology_gap_count": _number(
                    delta.get("resolved_ontology_gap_count")
                    if "resolved_ontology_gap_count" in delta
                    else readiness_impact.get("resolved_ontology_gap_count")
                ),
                "unresolved_ontology_gap_count": _number(
                    delta.get("unresolved_ontology_gap_count")
                    if "unresolved_ontology_gap_count" in delta
                    else readiness_impact.get("unresolved_ontology_gap_count")
                ),
            },
        },
        "platform_execution": _product_repair_rerun_execution_lane(
            execution_report=product_repair_rerun_execution,
            publication_report=product_repair_rerun_publication,
        ),
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_apply_answers": False,
            "may_apply_decisions": False,
            "may_mutate_candidate_artifacts": False,
            "may_accept_ontology_terms": False,
            "may_write_ontology_package": False,
            "may_create_branch_or_commit": False,
        },
    }


def _materialized_files(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for item in _records((report or {}).get("materialized_files"))[
        : DISPLAY_LIMITS["materialized_files"]
    ]:
        path = _text(item.get("path"))
        promotion_path = _text(item.get("promotion_path")) or path
        rows.append(
            {
                "candidate_node_id": _text(
                    item.get("candidate_node_id"), "candidate-node"
                ),
                "materialized_id": _text(item.get("materialized_id"), "candidate-spec"),
                "path": path,
                "promotion_path": promotion_path,
            }
        )
    return rows


def _materialized_file_count(report: dict[str, Any] | None) -> int:
    return len(_records((report or {}).get("materialized_files")))


def _promotion_request(report: dict[str, Any] | None) -> dict[str, Any]:
    request = _record((report or {}).get("promotion_request"))
    return {
        "path_argument": _optional_text(request.get("path_argument")),
        "platform_artifact_kind": _optional_text(request.get("platform_artifact_kind")),
        "paths": _string_list(request.get("paths")),
    }


def _workspace(active_candidate: dict[str, Any] | None) -> dict[str, Any]:
    candidate = _record((active_candidate or {}).get("candidate"))
    readiness = _record((active_candidate or {}).get("readiness"))
    return {
        "available": active_candidate is not None,
        "id": _optional_text(candidate.get("candidate_id")),
        "display_name": _optional_text(candidate.get("display_name")),
        "public_route": _optional_text(candidate.get("public_route")),
        "workflow_lane": _optional_text(candidate.get("workflow_lane")),
        "target_repository_role": _optional_text(candidate.get("target_repository_role")),
        "governance_profile": _optional_text(candidate.get("governance_profile")),
        "authority_profile": _optional_text(candidate.get("authority_profile")),
        "source_mode": _optional_text((active_candidate or {}).get("source_mode")),
        "ready": readiness.get("ready") is True,
        "review_state": _optional_text(readiness.get("review_state")),
        "blocked_by": _string_list(readiness.get("blocked_by")),
        "next_artifact": _optional_text(readiness.get("next_artifact")),
    }


def _candidate_matches_workspace(
    active_candidate: dict[str, Any] | None,
    workspace_id: str | None,
) -> bool:
    if active_candidate is None or workspace_id is None:
        return True
    candidate = _record(active_candidate.get("candidate"))
    candidate_id = _optional_text(candidate.get("candidate_id"))
    public_route = _optional_text(candidate.get("public_route"))
    if candidate_id == workspace_id:
        return True
    return public_route == f"/{workspace_id}"


def _platform_promotion_request(report: dict[str, Any] | None) -> dict[str, Any]:
    review = _record((report or {}).get("review"))
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "candidate_id": _optional_text((report or {}).get("candidate_id")),
        "candidate_branch": _optional_text((report or {}).get("candidate_branch")),
        "commit_paths": _string_list((report or {}).get("commit_paths")),
        "requested_operations": _string_list(
            (report or {}).get("requested_operations")
        ),
        "review": {
            "title": _optional_text(review.get("title")),
            "base_branch": _optional_text(review.get("base_branch")),
        },
        "summary": _record((report or {}).get("summary")),
    }


def _candidate_approval_decision(report: dict[str, Any] | None) -> dict[str, Any]:
    decision = _record((report or {}).get("decision"))
    readiness = _record((report or {}).get("readiness"))
    candidate = _record((report or {}).get("candidate"))
    return {
        "available": report is not None,
        "ready": readiness.get("ready") is True,
        "decision_state": _optional_text(decision.get("state")),
        "requested_state": _optional_text(decision.get("requested_state")),
        "review_state": _optional_text(readiness.get("review_state")),
        "operator_ref": _optional_text(decision.get("operator_ref")),
        "reason": _optional_text(decision.get("reason")),
        "candidate_id": _optional_text(candidate.get("candidate_id")),
        "promotion_paths": _string_list(
            _record((report or {}).get("promotion_request")).get("paths")
        ),
        "blocked_by": _string_list(readiness.get("blocked_by")),
    }


def _candidate_approval_execution(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    output_artifacts = _product_repair_rerun_output_artifacts(report)
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "dry_run": (report or {}).get("dry_run") is True,
        "status": _optional_text((report or {}).get("status"))
        or _optional_text(summary.get("status")),
        "candidate_id": _optional_text((report or {}).get("candidate_id"))
        or _optional_text(summary.get("candidate_id")),
        "workspace_id": _optional_text((report or {}).get("workspace_id"))
        or _optional_text(summary.get("workspace_id")),
        "gate_report_ref": _optional_text((report or {}).get("gate_report_ref")),
        "candidate_approval_decision_ref": _optional_text(
            (report or {}).get("candidate_approval_decision_ref")
        ),
        "approval_intent_ref": _optional_text(
            (report or {}).get("approval_intent_ref")
        ),
        "approved_path_count": _number(summary.get("approved_path_count")),
        "decision_written": summary.get("decision_written") is True,
        "gate_ready": summary.get("gate_ready") is True,
        "error_count": _number(summary.get("error_count")),
        "operations": _product_repair_rerun_operations(report),
        "output_artifacts": output_artifacts,
        "diagnostic_count": len(_records((report or {}).get("diagnostics"))),
    }


def _git_service_operations(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for item in _records((report or {}).get("operations"))[
        : DISPLAY_LIMITS["git_service_operations"]
    ]:
        rows.append(
            {
                "name": _text(item.get("name"), "operation"),
                "status": _text(item.get("status"), "unknown"),
                "request_artifact_kind": _optional_text(
                    item.get("request_artifact_kind")
                ),
                "response_artifact_kind": _optional_text(
                    item.get("response_artifact_kind")
                ),
                "report_ref": _optional_text(item.get("report_ref")),
                "diagnostic_count": len(_records(item.get("diagnostics"))),
            }
        )
    return rows


def _git_service_execution(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "dry_run": (report or {}).get("dry_run") is True,
        "open_review_dry_run": (report or {}).get("open_review_dry_run") is True,
        "candidate_id": _optional_text((report or {}).get("candidate_id")),
        "candidate_ref": _optional_text((report or {}).get("candidate_ref")),
        "workspace_dir": _optional_text((report or {}).get("workspace_dir")),
        "operation_count": _number(summary.get("operation_count")),
        "completed_operation_count": _number(summary.get("completed_operation_count")),
        "error_count": _number(summary.get("error_count")),
        "copied_file_count": len(_records((report or {}).get("copied_materialized_files"))),
        "operations": _git_service_operations(report),
        "report_refs": _record((report or {}).get("report_refs")),
    }


def _product_promotion_execution(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    git_review = _record((report or {}).get("git_review"))
    git_service_execution = _record((report or {}).get("git_service_execution"))
    operations = _product_repair_rerun_operations(report)
    summary_error_count = summary.get("error_count")
    error_count = (
        summary_error_count
        if isinstance(summary_error_count, int)
        and not isinstance(summary_error_count, bool)
        and summary_error_count >= 0
        else len(_records((report or {}).get("diagnostics")))
    )
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "dry_run": (report or {}).get("dry_run") is True,
        "open_review_dry_run": (report or {}).get("open_review_dry_run") is True,
        "status": _optional_text(summary.get("status")),
        "candidate_id": _optional_text((report or {}).get("candidate_id")),
        "candidate_branch": _optional_text((report or {}).get("candidate_branch"))
        or _optional_text(git_review.get("candidate_branch")),
        "workspace_dir": _optional_text((report or {}).get("workspace_dir"))
        or _optional_text(git_review.get("worktree_dir")),
        "repository_dir": _optional_text((report or {}).get("repository_dir")),
        "materialized_source_dir": _optional_text(
            (report or {}).get("materialized_source_dir")
        ),
        "promotion_request_ref": _optional_text(
            (report or {}).get("promotion_request_ref")
        ),
        "approval_decision_ref": _optional_text(
            (report or {}).get("approval_decision_ref")
        ),
        "git_service_execution_report_ref": _optional_text(
            (report or {}).get("git_service_execution_report_ref")
        ),
        "commit_sha": _optional_text(git_review.get("commit_sha")),
        "review_url": _optional_text(git_review.get("review_url")),
        "review_number": _number(git_review.get("review_number")),
        "review_opened": git_review.get("review_opened") is True,
        "worktree_prepared": summary.get("worktree_prepared") is True,
        "commit_created": summary.get("commit_created") is True,
        "copied_file_count": _number(git_review.get("copied_file_count")),
        "child_operation_count": _number(summary.get("child_operation_count")),
        "completed_operation_count": sum(
            1
            for operation in _records(git_service_execution.get("operations"))
            if operation.get("status") in {"succeeded", "dry_run"}
        ),
        "error_count": error_count,
        "diagnostic_count": len(_records((report or {}).get("diagnostics"))),
        "operations": operations,
        "git_service_operations": _git_service_operations(git_service_execution),
        "child_report_refs": _record((report or {}).get("child_report_refs")),
    }


def _review_status(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    artifact_kind = _optional_text((report or {}).get("artifact_kind"))
    is_product = (
        artifact_kind
        == EXPECTED_ARTIFACT_KINDS[
            PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        ]
    )
    pull_request = _record((report or {}).get("pull_request"))
    graph_review = _record((report or {}).get("graph_repository_review_status"))
    graph_summary = _record(graph_review.get("summary"))
    review_state = _optional_text((report or {}).get("review_state"))
    review_merged = (
        review_state == "merged"
        or summary.get("review_merged") is True
        or graph_summary.get("review_merged") is True
        or _optional_text(pull_request.get("mergedAt")) is not None
    )
    error_count = (
        _number(summary.get("error_count"))
        or len(_records((report or {}).get("diagnostics")))
    )
    ok = (report or {}).get("ok") is True
    if report is None:
        next_action = "run_product_candidate_promotion_review_status"
    elif not ok:
        next_action = "repair_review_status_report"
    elif review_merged:
        next_action = "ready_to_publish_read_model"
    else:
        next_action = "wait_for_review_merge"
    return {
        "available": report is not None,
        "ok": ok,
        "source_mode": "product" if is_product else "legacy" if report else None,
        "status": _optional_text(summary.get("status")),
        "candidate_id": _optional_text((report or {}).get("candidate_id")),
        "candidate_branch": _optional_text((report or {}).get("candidate_branch")),
        "review_state": review_state,
        "review_decision": _optional_text((report or {}).get("review_decision")),
        "review_url": _optional_text(
            (report or {}).get("review_url")
            or graph_review.get("review_url")
            or pull_request.get("url")
        ),
        "review_number": _number(pull_request.get("number")),
        "base_branch": _optional_text(pull_request.get("baseRefName")),
        "head_branch": _optional_text(pull_request.get("headRefName")),
        "merged_at": _optional_text(pull_request.get("mergedAt")),
        "merge_commit": _optional_text(_record(pull_request.get("mergeCommit")).get("oid")),
        "review_merged": review_merged,
        "promotion_execution_report_ref": _optional_text(
            (report or {}).get("promotion_execution_report_ref")
        ),
        "graph_repository_review_status_report_ref": _optional_text(
            (report or {}).get("graph_repository_review_status_report_ref")
        ),
        "operation_count": len(_records((report or {}).get("operations"))),
        "operations": _product_repair_rerun_operations(report),
        "error_count": error_count,
        "next_action": next_action,
    }


def _read_model_publication(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    artifact_kind = _optional_text((report or {}).get("artifact_kind"))
    is_product = (
        artifact_kind
        == EXPECTED_ARTIFACT_KINDS[
            PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        ]
    )
    child = _record((report or {}).get("graph_repository_publish_read_model"))
    child_summary = _record(child.get("summary"))
    published = (
        summary.get("published") is True
        or summary.get("read_model_published") is True
        or child_summary.get("published") is True
    )
    ok = (report or {}).get("ok") is True
    dry_run = (report or {}).get("dry_run") is True
    if report is None:
        next_action = "run_product_candidate_promotion_publish_read_model"
    elif not ok:
        next_action = "repair_read_model_publication"
    elif dry_run:
        next_action = "run_real_read_model_publication"
    elif published:
        next_action = "read_model_live"
    else:
        next_action = "publish_read_model_after_review_merge"
    summary_file_count = _optional_number(summary.get("file_count"))
    file_count = (
        summary_file_count
        if summary_file_count is not None
        else _number(child_summary.get("file_count"))
    )
    return {
        "available": report is not None,
        "ok": ok,
        "source_mode": "product" if is_product else "legacy" if report else None,
        "status": _optional_text(summary.get("status")),
        "dry_run": dry_run,
        "candidate_id": _optional_text((report or {}).get("candidate_id")),
        "candidate_branch": _optional_text((report or {}).get("candidate_branch")),
        "review_state": _optional_text((report or {}).get("review_state")),
        "manifest": _optional_text(
            summary.get("published_manifest")
            or (report or {}).get("manifest")
            or (report or {}).get("manifest_name")
        ),
        "manifest_name": _optional_text((report or {}).get("manifest_name")),
        "bundle_dir": _optional_text((report or {}).get("bundle_dir")),
        "output_dir": _optional_text((report or {}).get("output_dir")),
        "published": published,
        "read_model_published": published,
        "file_count": file_count,
        "product_review_status_report_ref": _optional_text(
            (report or {}).get("product_review_status_report_ref")
        ),
        "graph_repository_review_status_report_ref": _optional_text(
            (report or {}).get("graph_repository_review_status_report_ref")
        ),
        "graph_repository_publish_read_model_report_ref": _optional_text(
            (report or {}).get("graph_repository_publish_read_model_report_ref")
        ),
        "operation_count": len(_records((report or {}).get("operations"))),
        "operations": _product_repair_rerun_operations(report),
        "error_count": _number(summary.get("error_count")),
        "next_action": next_action,
    }


def _promotion_finalization(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "dry_run": (report or {}).get("dry_run") is True,
        "review_state": _optional_text((report or {}).get("review_state")),
        "read_model_published": summary.get("read_model_published") is True,
        "operation_count": _number(summary.get("operation_count")),
        "completed_operation_count": _number(summary.get("completed_operation_count")),
        "error_count": _number(summary.get("error_count")),
        "operations": _git_service_operations(report),
        "report_refs": _record((report or {}).get("report_refs")),
    }


def _product_repair_rerun_operations(
    report: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    rows = []
    for item in _records((report or {}).get("operations"))[
        : DISPLAY_LIMITS["git_service_operations"]
    ]:
        rows.append(
            {
                "name": _text(item.get("name"), "operation"),
                "status": _text(item.get("status"), "unknown"),
                "reason": _optional_text(item.get("reason")),
                "evidence": _string_list(item.get("evidence")),
            }
        )
    return rows


def _product_repair_rerun_output_artifacts(
    report: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    rows = []
    output_artifacts = _record((report or {}).get("output_artifacts"))
    for key, item in output_artifacts.items():
        if not isinstance(item, dict):
            continue
        if len(rows) >= DISPLAY_LIMITS["product_repair_rerun_output_artifacts"]:
            break
        rows.append(
            {
                "key": _text(key, "artifact"),
                "path": _optional_text(item.get("path")),
                "present": item.get("present") is True,
                "artifact_kind": _optional_text(item.get("artifact_kind")),
                "contract_ref": _optional_text(item.get("contract_ref")),
                "status": _optional_text(item.get("status")),
                "summary": _record(item.get("summary")),
                "ready": item.get("ready") is True,
                "sha256": _optional_text(item.get("sha256")),
            }
        )
    return rows


def _product_repair_rerun_execution(
    report: dict[str, Any] | None,
) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "dry_run": (report or {}).get("dry_run") is True,
        "status": _optional_text(summary.get("status")),
        "error_count": _number(summary.get("error_count")),
        "output_artifact_count": _number(summary.get("output_artifact_count")),
        "rerun_report_digest": _optional_text(summary.get("rerun_report_digest")),
        "repair_session_digest": _optional_text(summary.get("repair_session_digest")),
        "operations": _product_repair_rerun_operations(report),
        "output_artifacts": _product_repair_rerun_output_artifacts(report),
        "diagnostic_count": len(_records((report or {}).get("diagnostics"))),
    }


def _product_repair_rerun_publication(
    report: dict[str, Any] | None,
) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    manifest = _record((report or {}).get("manifest"))
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "dry_run": (report or {}).get("dry_run") is True,
        "status": _optional_text(summary.get("status")),
        "error_count": _number(summary.get("error_count")),
        "published_artifact_count": _number(summary.get("published_artifact_count")),
        "missing_artifact_count": _number(summary.get("missing_artifact_count")),
        "manifest_path": _optional_text(manifest.get("path")),
        "manifest_present": manifest.get("present") is True,
        "published_artifacts": _string_list((report or {}).get("published_artifacts")),
        "missing_artifacts": _string_list((report or {}).get("missing_artifacts")),
        "diagnostic_count": len(_records((report or {}).get("diagnostics"))),
    }


def _product_repair_rerun_execution_lane(
    *,
    execution_report: dict[str, Any] | None,
    publication_report: dict[str, Any] | None,
) -> dict[str, Any]:
    return {
        "available": execution_report is not None or publication_report is not None,
        "execution": _product_repair_rerun_execution(execution_report),
        "publication": _product_repair_rerun_publication(publication_report),
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_execute_platform_adapter": False,
            "may_run_specgraph_make_target": False,
            "may_publish_bundle": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_mutate_canonical_specs": False,
        },
    }


def _summary_number(
    summary: dict[str, Any],
    key: str,
    fallback: int = 0,
) -> int:
    if key not in summary:
        return fallback
    value = summary.get(key)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        return fallback
    return value


def _publication_has_repaired_artifacts(
    publication_report: dict[str, Any] | None,
) -> bool:
    published = set(_string_list((publication_report or {}).get("published_artifacts")))
    required = {
        f"runs/{REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT}",
        f"runs/{REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT}",
        f"runs/{REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT}",
        f"runs/{REPAIRED_PRE_SIB_COHERENCE_REPORT_ARTIFACT}",
        f"runs/{REPAIRED_CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT}",
        f"runs/{REPAIRED_CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT}",
        f"runs/{REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT}",
        f"runs/{REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT}",
    }
    return required.issubset(published)


def _approval_readiness(
    *,
    active_candidate: dict[str, Any] | None,
    repair_session: dict[str, Any] | None,
    promotion_gate: dict[str, Any] | None,
    repaired_handoff: dict[str, Any] | None,
    repaired_active_candidate: dict[str, Any] | None,
    repaired_repair_session: dict[str, Any] | None,
    repaired_promotion_gate: dict[str, Any] | None,
    product_repair_rerun_execution: dict[str, Any] | None,
    product_repair_rerun_publication: dict[str, Any] | None,
    candidate_approval_execution: dict[str, Any] | None,
    candidate_approval: dict[str, Any] | None,
    ontology_seed_review_required: bool = False,
) -> dict[str, Any]:
    selected_active_candidate = repaired_active_candidate or active_candidate
    selected_repair_session = repaired_repair_session or repair_session
    selected_promotion_gate = repaired_promotion_gate or promotion_gate
    selected_mode = "standard"
    if repaired_handoff is not None:
        selected_mode = "repaired_handoff"
    elif any(
        artifact is not None
        for artifact in (
            repaired_active_candidate,
            repaired_repair_session,
            repaired_promotion_gate,
        )
    ):
        selected_mode = "partial_repaired"
    session_view = _repair_session(selected_repair_session)
    readiness_impact = session_view["readiness_impact"]
    handoff_readiness = _readiness(repaired_handoff)
    handoff_summary = _record((repaired_handoff or {}).get("summary"))
    active_readiness = _record((selected_active_candidate or {}).get("readiness"))
    promotion_readiness = _readiness(selected_promotion_gate)
    promotion_request = _promotion_request(selected_promotion_gate)
    execution_view = _product_repair_rerun_execution(product_repair_rerun_execution)
    publication_view = _product_repair_rerun_publication(
        product_repair_rerun_publication
    )
    approval_execution = _candidate_approval_execution(candidate_approval_execution)
    approval_decision = _candidate_approval_decision(candidate_approval)
    candidate_approval_decision_ready = (
        approval_decision["ready"]
        or (
            candidate_approval is None
            and approval_execution["ok"]
            and not approval_execution["dry_run"]
            and approval_execution["decision_written"]
            and approval_execution["candidate_approval_decision_ref"] is not None
        )
    )

    resolved_ontology_gap_count = _summary_number(
        handoff_summary,
        "resolved_ontology_gap_count",
        readiness_impact["resolved_ontology_gap_count"],
    )
    unresolved_ontology_gap_count = _summary_number(
        handoff_summary,
        "unresolved_ontology_gap_count",
        readiness_impact["unresolved_ontology_gap_count"],
    )
    resolved_candidate_gap_count = _summary_number(
        handoff_summary,
        "resolved_candidate_gap_count",
    )
    unresolved_candidate_gap_count = _summary_number(
        handoff_summary,
        "unresolved_candidate_gap_count",
    )
    removed_gap_count = _summary_number(
        handoff_summary,
        "removed_gap_count",
        readiness_impact["rerun_removed_gap_count"],
    )
    ready_for_candidate_approval = (
        handoff_summary.get("ready_for_candidate_approval") is True
        or readiness_impact["ready_for_candidate_approval"] is True
    )
    ready_for_platform_promotion = (
        handoff_summary.get("ready_for_platform_promotion") is True
        or readiness_impact["ready_for_platform_promotion"] is True
    )
    candidate_repaired = (
        repaired_handoff is not None
        and handoff_readiness["ready"]
        and removed_gap_count > 0
    )
    platform_rerun_executed = (
        not execution_view["available"]
        or (execution_view["ok"] and not execution_view["dry_run"])
    )
    publication_required = execution_view["available"] and platform_rerun_executed
    platform_rerun_published = (
        (not publication_view["available"] and not publication_required)
        or (publication_view["ok"] and not publication_view["dry_run"])
    )
    repaired_artifacts_published = _publication_has_repaired_artifacts(
        product_repair_rerun_publication
    )
    promotion_path_count = (
        len(promotion_request["paths"]) or readiness_impact["promotion_path_count"]
    )
    blockers = []
    blockers.extend(readiness_impact["blocked_by"])
    blockers.extend(
        blocker
        for blocker in readiness_impact["platform_promotion_blocked_by"]
        if blocker != "candidate_approval_decision_missing"
    )
    blockers.extend(handoff_readiness["blocked_by"])
    blockers.extend(promotion_readiness["blocked_by"])
    blockers.extend(_blocking_finding_ids(repaired_handoff))
    blockers.extend(_blocking_finding_ids(selected_promotion_gate))
    if unresolved_ontology_gap_count:
        blockers.append("unresolved_ontology_gaps")
    if unresolved_candidate_gap_count:
        blockers.append("unresolved_candidate_gaps")
    if promotion_path_count == 0:
        blockers.append("promotion_paths_missing")
    if repaired_handoff is not None and not repaired_artifacts_published:
        blockers.append("repaired_artifacts_not_published")
    if ontology_seed_review_required:
        blockers.append("ontology_seed_review_required")
    if not platform_rerun_executed and product_repair_rerun_execution is not None:
        blockers.append("repair_rerun_execution_not_complete")
    if not platform_rerun_published and product_repair_rerun_publication is not None:
        blockers.append("repair_rerun_publication_not_complete")
    unique_blockers = []
    seen = set()
    for blocker in blockers:
        if not blocker or blocker in seen:
            continue
        seen.add(blocker)
        unique_blockers.append(blocker)

    promotion_review_can_be_requested = (
        ready_for_candidate_approval
        and unresolved_ontology_gap_count == 0
        and unresolved_candidate_gap_count == 0
        and platform_rerun_executed
        and platform_rerun_published
        and promotion_path_count > 0
        and not candidate_approval_decision_ready
        and not unique_blockers
    )
    platform_approval_gate_can_materialize_decision = (
        promotion_review_can_be_requested
        and (repaired_handoff is None or handoff_readiness["ready"])
    )
    if candidate_approval_decision_ready:
        status = "approval_decision_materialized"
    elif promotion_review_can_be_requested:
        status = "approval_ready"
    elif repaired_handoff is not None and not handoff_readiness["ready"]:
        status = "repaired_handoff_review_required"
    elif ready_for_candidate_approval:
        status = "approval_blocked_by_handoff"
    else:
        status = "blocked"

    return {
        "available": (
            repaired_handoff is not None
            or selected_repair_session is not None
            or selected_promotion_gate is not None
        ),
        "source_mode": selected_mode,
        "status": status,
        "candidate_repaired": candidate_repaired,
        "ready_for_candidate_approval": ready_for_candidate_approval,
        "ready_for_platform_promotion": ready_for_platform_promotion,
        "promotion_review_can_be_requested": promotion_review_can_be_requested,
        "platform_approval_gate_can_materialize_decision": (
            platform_approval_gate_can_materialize_decision
        ),
        "candidate_approval_decision_ready": candidate_approval_decision_ready,
        "platform_rerun_executed": platform_rerun_executed,
        "platform_rerun_published": platform_rerun_published,
        "repaired_artifacts_published": repaired_artifacts_published,
        "resolved_ontology_gap_count": resolved_ontology_gap_count,
        "resolved_candidate_gap_count": resolved_candidate_gap_count,
        "unresolved_ontology_gap_count": unresolved_ontology_gap_count,
        "unresolved_candidate_gap_count": unresolved_candidate_gap_count,
        "removed_gap_count": removed_gap_count,
        "remaining_blocker_count": len(unique_blockers),
        "promotion_path_count": promotion_path_count,
        "blockers": unique_blockers[: DISPLAY_LIMITS["findings"]],
        "source_refs": {
            "handoff": (
                f"runs/{REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT}"
                if repaired_handoff is not None
                else None
            ),
            "active_candidate": (
                f"runs/{REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT}"
                if repaired_active_candidate is not None
                else f"runs/{ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT}"
            ),
            "repair_session": (
                f"runs/{REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT}"
                if repaired_repair_session is not None
                else f"runs/{IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT}"
            ),
            "promotion_gate": (
                f"runs/{REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT}"
                if repaired_promotion_gate is not None
                else f"runs/{IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT}"
            ),
        },
        "review_states": {
            "handoff": handoff_readiness["review_state"],
            "active_candidate": _optional_text(active_readiness.get("review_state")),
            "repair_session": session_view["readiness"]["review_state"],
            "promotion_gate": promotion_readiness["review_state"],
            "execution": execution_view["status"],
            "publication": publication_view["status"],
            "candidate_approval_execution": approval_execution["status"],
        },
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_materialize_candidate_approval_decision": False,
            "may_execute_platform_gate": False,
            "may_execute_git_service": False,
            "may_create_branch_or_commit": False,
            "may_mutate_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
        },
    }


def _workflow_item(
    *,
    item_id: str,
    label: str,
    status: str,
    artifact_key: str | None = None,
    detail: str | None = None,
) -> dict[str, Any]:
    return {
        "id": item_id,
        "label": label,
        "status": status,
        "artifact_key": artifact_key,
        "artifact_path": None if artifact_key is None else f"runs/{artifact_key}",
        "detail": detail,
    }


def _artifact_available(statuses: dict[str, dict[str, Any]], key: str) -> bool:
    return statuses.get(key, {}).get("available") is True


def _available_status(
    statuses: dict[str, dict[str, Any]],
    key: str,
    ready: bool,
    *,
    blocked: bool = False,
    dry_run: bool = False,
) -> str:
    if not _artifact_available(statuses, key):
        return "missing"
    if blocked:
        return "blocked"
    if dry_run:
        return "dry_run"
    return "ready" if ready else "review_required"


def _workflow(
    *,
    statuses: dict[str, dict[str, Any]],
    core_missing_artifact_count: int,
    active_candidate: dict[str, Any] | None,
    intake: dict[str, Any] | None,
    candidate_seed: dict[str, Any] | None,
    ontology_seed_review_resolved: bool,
    candidate_graph: dict[str, Any] | None,
    pre_sib: dict[str, Any] | None,
    repair_loop: dict[str, Any] | None,
    repair_session: dict[str, Any] | None,
    materialization: dict[str, Any] | None,
    promotion_gate: dict[str, Any] | None,
    product_repair_rerun_execution: dict[str, Any] | None,
    product_repair_rerun_publication: dict[str, Any] | None,
    candidate_approval_execution: dict[str, Any] | None,
    candidate_approval: dict[str, Any] | None,
    platform_promotion: dict[str, Any] | None,
    product_promotion_execution: dict[str, Any] | None,
    git_service_execution: dict[str, Any] | None,
    review_status: dict[str, Any] | None,
    read_model_publication: dict[str, Any] | None,
    promotion_finalization: dict[str, Any] | None,
) -> dict[str, Any]:
    pre_sib_readiness = _readiness(pre_sib)
    repair_readiness = _readiness(repair_loop)
    repair_session_view = _repair_session(repair_session)
    repair_session_impact = repair_session_view["readiness_impact"]
    materialization_readiness = _readiness(materialization)
    promotion_readiness = _readiness(promotion_gate)
    candidate_readiness = _record((candidate_graph or {}).get("pre_sib_readiness"))
    repair_summary = _record((repair_loop or {}).get("summary"))
    context_required_count = _number(repair_summary.get("context_required_count"))
    promotion_blocker_count = _finding_count(promotion_gate)
    product_repair_execution_view = _product_repair_rerun_execution(
        product_repair_rerun_execution
    )
    product_repair_publication_view = _product_repair_rerun_publication(
        product_repair_rerun_publication
    )
    product_repair_execution_failed = (
        product_repair_rerun_execution is not None
        and not product_repair_execution_view["ok"]
    )
    product_repair_publication_failed = (
        product_repair_rerun_publication is not None
        and not product_repair_publication_view["ok"]
    )
    product_repair_execution_ready = (
        product_repair_execution_view["ok"]
        and not product_repair_execution_view["dry_run"]
    )
    product_repair_execution_dry_run = (
        product_repair_execution_view["ok"]
        and product_repair_execution_view["dry_run"]
    )
    product_repair_publication_dry_run = (
        product_repair_publication_view["ok"]
        and product_repair_publication_view["dry_run"]
    )
    candidate_approval_execution_view = _candidate_approval_execution(
        candidate_approval_execution
    )
    candidate_approval_execution_failed = (
        candidate_approval_execution is not None
        and not candidate_approval_execution_view["ok"]
    )
    seed_source_generation = _record((candidate_seed or {}).get("source_generation"))
    seed_readiness = _readiness(seed_source_generation)
    seed_blocked = _ontology_seed_blocked(candidate_seed) and not ontology_seed_review_resolved
    platform_ok = (platform_promotion or {}).get("ok") is True
    approval_readiness = _record((candidate_approval or {}).get("readiness"))
    approval_decision = _record((candidate_approval or {}).get("decision"))
    approval_ready_from_execution = (
        candidate_approval is None
        and candidate_approval_execution_view["ok"]
        and not candidate_approval_execution_view["dry_run"]
        and candidate_approval_execution_view["decision_written"]
        and candidate_approval_execution_view["candidate_approval_decision_ref"]
        is not None
    )
    approval_ready = (
        (
            candidate_approval is not None
            and approval_readiness.get("ready") is True
            and approval_decision.get("state") == "approved"
        )
        or approval_ready_from_execution
    )
    product_promotion_execution_view = _product_promotion_execution(
        product_promotion_execution
    )
    git_summary = _record((git_service_execution or {}).get("summary"))
    git_error_count = _number(git_summary.get("error_count"))
    legacy_git_ok = (git_service_execution or {}).get("ok") is True
    legacy_git_dry_run = (git_service_execution or {}).get("dry_run") is True
    legacy_git_open_review_dry_run = (
        (git_service_execution or {}).get("open_review_dry_run") is True
    )
    promotion_execution_available = (
        product_promotion_execution is not None or git_service_execution is not None
    )
    product_execution_available = product_promotion_execution is not None
    promotion_execution_ok = (
        product_promotion_execution_view["ok"]
        if product_execution_available
        else legacy_git_ok
    )
    promotion_execution_error_count = (
        product_promotion_execution_view["error_count"]
        if product_execution_available
        else git_error_count
    )
    promotion_execution_dry_run = (
        product_promotion_execution_view["dry_run"]
        if product_execution_available
        else legacy_git_dry_run
    )
    promotion_execution_open_review_dry_run = (
        product_promotion_execution_view["open_review_dry_run"]
        if product_execution_available
        else legacy_git_open_review_dry_run
    )
    journal_platform_promotion_resolved = platform_ok or (
        promotion_execution_available and promotion_execution_ok
    )
    promotion_gate_blocked = (
        promotion_gate is not None
        and (
            not promotion_readiness["ready"]
            or bool(promotion_readiness["blocked_by"])
            or promotion_blocker_count > 0
        )
    )
    platform_failed = platform_promotion is not None and not platform_ok
    promotion_execution_failed = (
        promotion_execution_available and not promotion_execution_ok
    )
    approval_failed = candidate_approval is not None and not approval_ready
    journal_blocks_candidate_approval = (
        repair_session is not None
        and repair_session_impact["ready_for_candidate_approval"] is not True
    )
    journal_blocks_platform_promotion = (
        repair_session is not None
        and approval_ready
        and repair_session_impact["ready_for_platform_promotion"] is not True
        and not journal_platform_promotion_resolved
    )
    product_repair_downstream_blocked = (
        context_required_count > 0
        or promotion_gate_blocked
        or journal_blocks_candidate_approval
        or journal_blocks_platform_promotion
    )
    review_status_summary = _record((review_status or {}).get("summary"))
    review_merged = (
        (review_status or {}).get("review_state") == "merged"
        or review_status_summary.get("review_merged") is True
    )
    review_status_failed = review_status is not None and (review_status.get("ok") is not True)
    publish_summary = _record((read_model_publication or {}).get("summary"))
    publish_child_summary = _record(
        _record(
            (read_model_publication or {}).get("graph_repository_publish_read_model")
        ).get("summary")
    )
    read_model_published = (
        publish_summary.get("published") is True
        or publish_summary.get("read_model_published") is True
        or publish_child_summary.get("published") is True
        or _record((promotion_finalization or {}).get("summary")).get(
            "read_model_published"
        )
        is True
    )
    finalization_failed = (
        promotion_finalization is not None
        and promotion_finalization.get("ok") is not True
    )
    review_status_is_product = (
        (review_status or {}).get("artifact_kind")
        == EXPECTED_ARTIFACT_KINDS[
            PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        ]
    )
    review_status_artifact_key = (
        PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
        if review_status_is_product
        or (review_status is None and product_execution_available)
        else GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
    )
    review_status_status_key = ARTIFACT_KEYS[review_status_artifact_key]
    read_model_publication_is_product = (
        (read_model_publication or {}).get("artifact_kind")
        == EXPECTED_ARTIFACT_KINDS[
            PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        ]
    )
    read_model_publication_artifact_key = (
        PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
        if read_model_publication_is_product
        or (read_model_publication is None and product_execution_available)
        else GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT
    )
    read_model_publication_status_key = ARTIFACT_KEYS[
        read_model_publication_artifact_key
    ]

    items = [
        _workflow_item(
            item_id="active_candidate",
            label="Active candidate",
            status=_available_status(
                statuses,
                "active_candidate",
                _record((active_candidate or {}).get("readiness")).get("ready")
                is True,
            ),
            artifact_key=ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
            detail=_optional_text(
                _record((active_candidate or {}).get("readiness")).get(
                    "review_state"
                )
            ),
        ),
        _workflow_item(
            item_id="event_storming_intake",
            label="Event-storming intake",
            status=_available_status(
                statuses,
                "event_storming_intake",
                _artifact_available(statuses, "event_storming_intake"),
            ),
            artifact_key=IDEA_EVENT_STORMING_INTAKE_ARTIFACT,
            detail=_optional_text(_record((intake or {}).get("summary")).get("status")),
        ),
        _workflow_item(
            item_id="ontology_seed",
            label="Ontology-bound seed",
            status=_available_status(
                statuses,
                "ontology_seed",
                seed_readiness["ready"],
                blocked=seed_blocked,
            ),
            artifact_key=CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT,
            detail=_optional_text(seed_readiness["review_state"]),
        ),
        _workflow_item(
            item_id="candidate_graph",
            label="Candidate graph",
            status=_available_status(
                statuses,
                "candidate_graph",
                candidate_readiness.get("ready") is True,
            ),
            artifact_key=CANDIDATE_SPEC_GRAPH_ARTIFACT,
            detail=_optional_text(candidate_readiness.get("review_state")),
        ),
        _workflow_item(
            item_id="pre_sib",
            label="Pre-SIB coherence",
            status=_available_status(
                statuses,
                "pre_sib",
                pre_sib_readiness["ready"],
                blocked=bool(pre_sib_readiness["blocked_by"]),
            ),
            artifact_key=PRE_SIB_COHERENCE_REPORT_ARTIFACT,
            detail=_optional_text(pre_sib_readiness["review_state"]),
        ),
        _workflow_item(
            item_id="repair_loop",
            label="Repair loop",
            status=_available_status(
                statuses,
                "repair_loop",
                repair_readiness["ready"] and context_required_count == 0,
                blocked=context_required_count > 0,
            ),
            artifact_key=CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT,
            detail=(
                "context_required"
                if context_required_count > 0
                else _optional_text(repair_readiness["review_state"])
            ),
        ),
        _workflow_item(
            item_id="product_repair_rerun_execution",
            label="Repair rerun execution",
            status=_available_status(
                statuses,
                "product_repair_rerun_execution",
                product_repair_execution_view["ok"],
                blocked=product_repair_execution_failed,
                dry_run=product_repair_execution_view["dry_run"],
            ),
            artifact_key=PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT,
            detail=product_repair_execution_view["status"],
        ),
        _workflow_item(
            item_id="product_repair_rerun_publication",
            label="Repair rerun publication",
            status=_available_status(
                statuses,
                "product_repair_rerun_publication",
                product_repair_publication_view["ok"],
                blocked=product_repair_publication_failed,
                dry_run=product_repair_publication_view["dry_run"],
            ),
            artifact_key=PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT,
            detail=product_repair_publication_view["status"],
        ),
        _workflow_item(
            item_id="materialization",
            label="Materialization preview",
            status=_available_status(
                statuses,
                "materialization",
                materialization_readiness["ready"],
                blocked=bool(materialization_readiness["blocked_by"]),
            ),
            artifact_key=CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT,
            detail=_optional_text(materialization_readiness["review_state"]),
        ),
        _workflow_item(
            item_id="promotion_gate",
            label="Promotion gate",
            status=_available_status(
                statuses,
                "promotion_gate",
                promotion_readiness["ready"],
                blocked=promotion_blocker_count > 0
                or bool(promotion_readiness["blocked_by"]),
            ),
            artifact_key=IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT,
            detail=_optional_text(promotion_readiness["review_state"]),
        ),
        _workflow_item(
            item_id="candidate_approval_execution",
            label="Approval materialization",
            status=_available_status(
                statuses,
                "candidate_approval_execution",
                candidate_approval_execution_view["ok"],
                blocked=candidate_approval_execution_failed,
                dry_run=candidate_approval_execution_view["dry_run"],
            ),
            artifact_key=PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT,
            detail=candidate_approval_execution_view["status"],
        ),
        _workflow_item(
            item_id="candidate_approval",
            label="Candidate approval",
            status=(
                "ready"
                if approval_ready_from_execution
                else _available_status(
                    statuses,
                    "candidate_approval",
                    approval_ready,
                    blocked=approval_failed,
                )
            ),
            artifact_key=CANDIDATE_APPROVAL_DECISION_ARTIFACT,
            detail=_optional_text(
                approval_readiness.get("review_state")
                or approval_decision.get("state")
                or candidate_approval_execution_view["candidate_approval_decision_ref"]
            ),
        ),
        _workflow_item(
            item_id="platform_promotion_request",
            label="Platform promotion request",
            status=_available_status(
                statuses,
                "platform_promotion_request",
                platform_ok,
                blocked=platform_promotion is not None and not platform_ok,
            ),
            artifact_key=GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT,
            detail=_optional_text((platform_promotion or {}).get("candidate_branch")),
        ),
        _workflow_item(
            item_id="product_promotion_execution",
            label="Product promotion execution",
            status=_available_status(
                statuses,
                "product_promotion_execution",
                product_promotion_execution_view["ok"]
                and product_promotion_execution_view["error_count"] == 0,
                blocked=product_promotion_execution is not None
                and not product_promotion_execution_view["ok"],
                dry_run=product_promotion_execution_view["open_review_dry_run"]
                or product_promotion_execution_view["dry_run"],
            ),
            artifact_key=PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
            detail=(
                "open_review_dry_run"
                if product_promotion_execution_view["open_review_dry_run"]
                else _optional_text(product_promotion_execution_view["candidate_branch"])
            ),
        ),
        _workflow_item(
            item_id="git_service_execution",
            label="Git Service execution",
            status=_available_status(
                statuses,
                "git_service_execution",
                legacy_git_ok and git_error_count == 0,
                blocked=git_service_execution is not None and not legacy_git_ok,
                dry_run=legacy_git_ok and legacy_git_open_review_dry_run,
            ),
            artifact_key=GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
            detail=(
                "open_review_dry_run"
                if legacy_git_open_review_dry_run
                else _optional_text((git_service_execution or {}).get("candidate_ref"))
            ),
        ),
        _workflow_item(
            item_id="review_status",
            label="Review status",
            status=_available_status(
                statuses,
                review_status_status_key,
                review_merged,
                blocked=review_status_failed,
            ),
            artifact_key=review_status_artifact_key,
            detail=_optional_text((review_status or {}).get("review_state")),
        ),
        _workflow_item(
            item_id="read_model_publication",
            label="Read-model publication",
            status=(
                "ready"
                if read_model_published
                else _available_status(
                    statuses,
                    read_model_publication_status_key,
                    False,
                    blocked=finalization_failed
                    or (
                        read_model_publication is not None
                        and read_model_publication.get("ok") is not True
                    ),
                    dry_run=(read_model_publication or {}).get("dry_run") is True
                    or (promotion_finalization or {}).get("dry_run") is True,
                )
            ),
            artifact_key=read_model_publication_artifact_key,
            detail="published" if read_model_published else None,
        ),
    ]

    stage = "ready"
    status = "ready"
    next_handoff = {
        "kind": "none",
        "label": "No operator handoff",
        "status": "idle",
        "artifact_key": None,
        "artifact_path": None,
        "command_template": None,
        "authority_boundary": "read_only",
    }
    if core_missing_artifact_count:
        stage = "candidate_artifacts_missing"
        status = "blocked"
        next_handoff = {
            "kind": "specgraph_candidate_generation",
            "label": "Produce missing idea-to-spec run artifacts",
            "status": "blocked",
            "artifact_key": "missing_core_artifacts",
            "artifact_path": None,
            "command_template": (
                "cd <specgraph-repository> && "
                "make product-workspace-active-candidate"
            ),
            "authority_boundary": "operator_only",
        }
    elif seed_blocked:
        stage = "ontology_seed_review_required"
        status = "blocked"
        next_handoff = {
            "kind": "ontology_seed_review",
            "label": "Resolve ontology-bound seed gaps before candidate graph promotion",
            "status": "blocked",
            "artifact_key": "ontology_seed",
            "artifact_path": f"runs/{CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT}",
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif product_repair_execution_failed:
        stage = "repair_rerun_execution_failed"
        status = "blocked"
        next_handoff = {
            "kind": "product_repair_rerun_execution_repair",
            "label": "Repair the Product Repair Rerun execution report",
            "status": "blocked",
            "artifact_key": "product_repair_rerun_execution",
            "artifact_path": (
                f"runs/{PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT}"
            ),
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif product_repair_publication_failed:
        stage = "repair_rerun_publication_failed"
        status = "blocked"
        next_handoff = {
            "kind": "product_repair_rerun_publication_repair",
            "label": "Repair public-safe repair rerun publication",
            "status": "blocked",
            "artifact_key": "product_repair_rerun_publication",
            "artifact_path": (
                f"runs/{PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT}"
            ),
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif context_required_count > 0 or promotion_gate_blocked:
        stage = "repair_required"
        status = "blocked"
        next_handoff = {
            "kind": "operator_repair_review",
            "label": "Resolve context-required repairs before promotion",
            "status": "blocked",
            "artifact_key": "promotion_gate",
            "artifact_path": f"runs/{IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT}",
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif journal_blocks_candidate_approval:
        stage = "repair_session_review_required"
        status = "blocked"
        next_handoff = {
            "kind": "operator_repair_review",
            "label": "Resolve repair session blockers before candidate approval",
            "status": "blocked",
            "artifact_key": "repair_session",
            "artifact_path": f"runs/{IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT}",
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif product_repair_execution_dry_run and not product_repair_downstream_blocked:
        stage = "repair_rerun_execution_dry_run"
        status = "operator_review_required"
        next_handoff = {
            "kind": "product_repair_rerun_execution",
            "label": "Run non-dry-run Product Repair Rerun execution",
            "status": "operator_review_required",
            "artifact_key": "product_repair_rerun_execution",
            "artifact_path": (
                f"runs/{PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT}"
            ),
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif product_repair_execution_ready and (
        product_repair_rerun_publication is None or product_repair_publication_dry_run
    ) and not product_repair_downstream_blocked:
        stage = "repair_rerun_publication_required"
        status = "ready_for_handoff"
        next_handoff = {
            "kind": "product_repair_rerun_publication",
            "label": "Publish public-safe repair rerun artifacts",
            "status": "ready",
            "artifact_key": "product_repair_rerun_execution",
            "artifact_path": (
                f"runs/{PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT}"
            ),
            "command_template": (
                "scripts/platform.py product-repair-rerun publish "
                "--execution-report "
                "runs/platform_product_repair_rerun_execution_report.json"
            ),
            "authority_boundary": "operator_only",
        }
    elif platform_failed:
        stage = "promotion_request_failed"
        status = "blocked"
        next_handoff = {
            "kind": "platform_promotion_request_repair",
            "label": "Repair the Platform promotion request before Git Service execution",
            "status": "blocked",
            "artifact_key": "platform_promotion_request",
            "artifact_path": f"runs/{GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT}",
            "command_template": (
                "scripts/platform.py graph-repository promotion-request <inputs>"
            ),
            "authority_boundary": "operator_only",
        }
    elif candidate_approval_execution_failed:
        stage = "approval_execution_failed"
        status = "blocked"
        next_handoff = {
            "kind": "candidate_approval_execution_repair",
            "label": "Repair Platform candidate approval materialization",
            "status": "blocked",
            "artifact_key": "candidate_approval_execution",
            "artifact_path": (
                f"runs/{PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT}"
            ),
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif approval_failed:
        stage = "approval_blocked"
        status = "blocked"
        next_handoff = {
            "kind": "candidate_approval_repair",
            "label": "Resolve candidate approval before Git Service execution",
            "status": "blocked",
            "artifact_key": "candidate_approval",
            "artifact_path": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif promotion_readiness["ready"] and not approval_ready:
        stage = "approval_required"
        status = "operator_review_required"
        next_handoff = {
            "kind": "candidate_approval_decision",
            "label": "Materialize candidate approval through Platform",
            "status": "operator_review_required",
            "artifact_key": "candidate_approval_execution",
            "artifact_path": (
                f"runs/{PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT}"
            ),
            "command_template": (
                "scripts/platform.py product-candidate-approval approve "
                "--specgraph-dir <specgraph-repository> "
                "--approval-intents <specspace-state>/idea_to_spec_candidate_approval_intents.json"
            ),
            "authority_boundary": "operator_only",
        }
    elif journal_blocks_platform_promotion:
        stage = "repair_session_review_required"
        status = "blocked"
        next_handoff = {
            "kind": "operator_repair_review",
            "label": "Resolve repair session blockers before Platform promotion",
            "status": "blocked",
            "artifact_key": "repair_session",
            "artifact_path": f"runs/{IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT}",
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif promotion_execution_failed:
        stage = (
            "product_promotion_execution_failed"
            if product_execution_available
            else "git_service_execution_failed"
        )
        status = "blocked"
        next_handoff = {
            "kind": (
                "product_promotion_execution_repair"
                if product_execution_available
                else "git_service_execution_repair"
            ),
            "label": (
                "Repair the Product Promotion execution report before continuing"
                if product_execution_available
                else "Repair the Git Service execution report before continuing"
            ),
            "status": "blocked",
            "artifact_key": (
                "product_promotion_execution"
                if product_execution_available
                else "git_service_execution"
            ),
            "artifact_path": (
                f"runs/{PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT}"
                if product_execution_available
                else f"runs/{GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT}"
            ),
            "command_template": (
                "scripts/platform.py product-candidate-promotion execute <inputs>"
                if product_execution_available
                else "scripts/platform.py git-service execute-promotion <inputs>"
            ),
            "authority_boundary": "operator_only",
        }
    elif promotion_readiness["ready"] and approval_ready and platform_promotion is None:
        stage = "promotion_request_required"
        status = "ready_for_handoff"
        next_handoff = {
            "kind": "platform_promotion_request",
            "label": "Build Platform graph repository promotion request",
            "status": "ready",
            "artifact_key": "promotion_gate",
            "artifact_path": f"runs/{IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT}",
            "command_template": "scripts/platform.py graph-repository promotion-request <inputs>",
            "authority_boundary": "operator_only",
        }
    elif platform_ok and approval_ready and not promotion_execution_available:
        stage = "product_promotion_execution_ready"
        status = "ready_for_handoff"
        next_handoff = {
            "kind": "product_candidate_promotion_execute",
            "label": "Run product candidate promotion execution",
            "status": "ready",
            "artifact_key": "platform_promotion_request",
            "artifact_path": f"runs/{GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT}",
            "command_template": (
                "scripts/platform.py product-candidate-promotion execute "
                "--promotion-request runs/graph_repository_promotion_request.json "
                "--approval-decision runs/candidate_approval_decision.json "
                "--repository-dir <product-repository> "
                "--workspace-dir <candidate-worktree> "
                "--materialized-source-dir <public-bundle-root> "
                "--open-review-dry-run"
            ),
            "authority_boundary": "operator_only",
        }
    elif promotion_execution_ok and (
        promotion_execution_dry_run or promotion_execution_open_review_dry_run
    ):
        stage = "review_dry_run_ready"
        status = "operator_review_required"
        next_handoff = {
            "kind": (
                "product_candidate_promotion_open_review"
                if product_execution_available
                else "git_service_open_review"
            ),
            "label": (
                "Approve non-dry-run review creation"
                if promotion_execution_open_review_dry_run
                else "Run non-dry-run promotion execution"
            ),
            "status": "operator_review_required",
            "artifact_key": (
                "product_promotion_execution"
                if product_execution_available
                else "git_service_execution"
            ),
            "artifact_path": (
                f"runs/{PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT}"
                if product_execution_available
                else f"runs/{GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT}"
            ),
            "command_template": (
                (
                    "scripts/platform.py product-candidate-promotion execute "
                    "--promotion-request runs/graph_repository_promotion_request.json "
                    "--approval-decision runs/candidate_approval_decision.json "
                    "--repository-dir <product-repository> "
                    "--workspace-dir <candidate-worktree> "
                    "--materialized-source-dir <public-bundle-root>"
                )
                if product_execution_available
                else (
                    "scripts/platform.py git-service execute-promotion "
                    "--promotion-request runs/graph_repository_promotion_request.json "
                    "--approval-decision runs/candidate_approval_decision.json "
                    "--repository-dir <product-repository> "
                    "--workspace-dir <candidate-worktree> "
                    "--materialized-source-dir <public-bundle-root>"
                )
            ),
            "authority_boundary": "operator_only",
        }
    elif (
        promotion_execution_ok
        and promotion_execution_error_count == 0
        and review_status is None
        and promotion_finalization is None
    ):
        stage = "review_status_required"
        status = "ready_for_handoff"
        next_handoff = {
            "kind": (
                "product_candidate_promotion_review_status"
                if product_execution_available
                else "git_service_review_status"
            ),
            "label": "Inspect review status before read-model publish",
            "status": "ready",
            "artifact_key": (
                "product_promotion_execution"
                if product_execution_available
                else "git_service_execution"
            ),
            "artifact_path": (
                f"runs/{PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT}"
                if product_execution_available
                else f"runs/{GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT}"
            ),
            "command_template": (
                (
                    "scripts/platform.py product-candidate-promotion review-status "
                    "--execution-report "
                    "runs/product_candidate_promotion_execution_report.json"
                )
                if product_execution_available
                else "scripts/platform.py graph-repository review-status <open-review-report>"
            ),
            "authority_boundary": "operator_only",
        }
    elif review_status_failed or finalization_failed:
        stage = "post_review_failed"
        status = "blocked"
        next_handoff = {
            "kind": "post_review_repair",
            "label": "Repair post-review closure before publishing read model",
            "status": "blocked",
            "artifact_key": review_status_status_key,
            "artifact_path": f"runs/{review_status_artifact_key}",
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif review_status is not None and not review_merged:
        stage = "review_pending"
        status = "operator_review_required"
        next_handoff = {
            "kind": "repository_review",
            "label": "Wait for repository review merge before read-model publish",
            "status": "operator_review_required",
            "artifact_key": review_status_status_key,
            "artifact_path": f"runs/{review_status_artifact_key}",
            "command_template": None,
            "authority_boundary": "operator_only",
        }
    elif review_merged and not read_model_published:
        stage = "read_model_publish_required"
        status = "ready_for_handoff"
        next_handoff = {
            "kind": "publish_read_model",
            "label": "Publish read model after merged repository review",
            "status": "ready",
            "artifact_key": review_status_status_key,
            "artifact_path": f"runs/{review_status_artifact_key}",
            "command_template": (
                (
                    "scripts/platform.py product-candidate-promotion publish-read-model "
                    "--review-status-report "
                    "runs/product_candidate_promotion_review_status_report.json "
                    "--bundle-dir <public-bundle> --output-dir <read-model-dir>"
                )
                if review_status_is_product
                else (
                    "scripts/platform.py git-service finalize-promotion "
                    "--open-review-report <open-review-report> "
                    "--bundle-dir <public-bundle> --output-dir <read-model-dir>"
                )
            ),
            "authority_boundary": "operator_only",
        }
    elif read_model_published:
        stage = "read_model_published"
        status = "ready"
        next_handoff = {
            "kind": "read_model_review",
            "label": "Inspect published read model",
            "status": "ready",
            "artifact_key": read_model_publication_status_key,
            "artifact_path": f"runs/{read_model_publication_artifact_key}",
            "command_template": None,
            "authority_boundary": "read_only",
        }

    return {
        "stage": stage,
        "status": status,
        "items": items,
        "next_handoff": next_handoff,
    }


def _readiness(payload: dict[str, Any] | None) -> dict[str, Any]:
    readiness = _record((payload or {}).get("readiness"))
    return {
        "ready": readiness.get("ready") is True,
        "review_state": _optional_text(readiness.get("review_state")),
        "blocked_by": _string_list(readiness.get("blocked_by")),
        "next_artifact": _optional_text(readiness.get("next_artifact")),
    }


def _authority_boundary() -> dict[str, bool]:
    return {
        "idea_to_spec_workspace_is_authority": False,
        "may_execute_prompt_agent": False,
        "may_mutate_candidate_source_artifacts": False,
        "may_mutate_canonical_specs": False,
        "may_write_ontology_package": False,
        "may_create_branch_or_commit": False,
        "may_execute_git_service_operation": False,
        "may_mark_candidate_accepted": False,
    }


def _guided_flow_boundary() -> dict[str, bool]:
    return {
        "inspect_only": True,
        "acknowledge_only": True,
        "may_execute_specgraph": False,
        "may_execute_platform": False,
        "may_execute_git_service": False,
        "may_mutate_candidate_artifacts": False,
        "may_mutate_canonical_specs": False,
        "may_write_ontology_package": False,
        "may_accept_ontology_terms": False,
        "may_create_branch_or_commit": False,
        "may_open_pull_request": False,
        "may_merge_review": False,
    }


def _guided_stage(
    *,
    stage_id: str,
    label: str,
    status: str,
    next_action: str,
    target_section: str,
    blockers: list[str] | None = None,
    evidence_refs: list[str] | None = None,
    command_template: str | None = None,
) -> dict[str, Any]:
    return {
        "id": stage_id,
        "label": label,
        "status": status,
        "primary_next_action": next_action,
        "blockers": blockers or [],
        "evidence_refs": evidence_refs or [],
        "target_section": target_section,
        "command_template": command_template,
        "authority_boundary": _guided_flow_boundary(),
    }


def _stage_status_from_item(workflow: dict[str, Any], item_id: str) -> str:
    for item in _records(workflow.get("items")):
        if item.get("id") == item_id:
            return _text(item.get("status"), "unknown")
    return "missing"


def _stage_path_from_item(workflow: dict[str, Any], item_id: str) -> str | None:
    for item in _records(workflow.get("items")):
        if item.get("id") == item_id:
            return _optional_text(item.get("artifact_path"))
    return None


def _stage_done(status: str) -> bool:
    return status in {"ready", "completed", "published", "dry_run"}


def _guided_flow(payload: dict[str, Any]) -> dict[str, Any]:
    workflow = _record(payload.get("workflow"))
    real_idea_intake = _record(payload.get("real_idea_intake"))
    repair_review = _record(payload.get("repair_review"))
    repair_session = _record(payload.get("repair_session"))
    repair_session_impact = _record(repair_session.get("readiness_impact"))
    project_local_ontology = _record(payload.get("project_local_ontology_review"))
    project_local_import = _record(
        payload.get("project_local_ontology_decision_import_preview")
    )
    hygiene = _record(payload.get("workspace_state_hygiene"))
    hygiene_summary = _record(hygiene.get("summary"))
    approval = _record(payload.get("approval_readiness"))
    controlled = _record(payload.get("controlled_promotion"))
    candidate_approval = _record(controlled.get("candidate_approval"))
    candidate_approval_execution = _record(
        controlled.get("candidate_approval_execution")
    )
    promotion_request = _record(controlled.get("platform_request"))
    product_execution = _record(controlled.get("product_promotion_execution"))
    git_execution = _record(controlled.get("git_service_execution"))
    review_status = _record(controlled.get("review_status"))
    read_model_publication = _record(controlled.get("read_model_publication"))
    promotion_finalization = _record(controlled.get("promotion_finalization"))
    next_handoff = _record(workflow.get("next_handoff"))

    hygiene_blockers = [
        _text(state.get("reason"), _text(state.get("kind"), "stale_state"))
        for state in _records(hygiene.get("states"))
        if _text(state.get("status")) in {"stale", "invalid"}
    ]
    hygiene_blocked = _number(hygiene_summary.get("blocking_state_count")) > 0
    repair_review_section = (
        "idea-to-spec-workspace-state-hygiene"
        if hygiene_blocked
        else "idea-to-spec-repair-review"
    )
    repair_review_action = (
        _optional_text(hygiene_summary.get("next_action"))
        if hygiene_blocked
        else "Answer open repair requests and review ontology decisions."
    )

    repair_session_ready = repair_session_impact.get(
        "ready_for_candidate_approval"
    ) is True
    approval_ready = approval.get("ready_for_candidate_approval") is True
    approval_request_ready = approval.get("promotion_review_can_be_requested") is True
    approval_decision_available = candidate_approval.get("available") is True
    approval_decision_ready = candidate_approval.get("ready") is True
    approval_execution_ready = (
        candidate_approval_execution.get("ok") is True
        and candidate_approval_execution.get("dry_run") is not True
        and candidate_approval_execution.get("decision_written") is True
    )
    promotion_request_ready = promotion_request.get("ok") is True
    product_execution_available = product_execution.get("available") is True
    promotion_execution_status = (
        _stage_status_from_item(workflow, "product_promotion_execution")
        if product_execution_available
        else _stage_status_from_item(workflow, "git_service_execution")
    )
    promotion_execution_available = product_execution_available or (
        git_execution.get("available") is True
    )
    promotion_execution_ready_for_review = promotion_execution_status == "ready"
    promotion_execution_dry_run_complete = promotion_execution_status == "dry_run"
    promotion_execution_blocked = promotion_execution_status == "blocked"
    review_available = review_status.get("available") is True
    review_ok = review_status.get("ok") is True
    review_merged = review_status.get("review_merged") is True
    read_model_published = (
        read_model_publication.get("published") is True
        or promotion_finalization.get("read_model_published") is True
    )
    approval_decision_blocked = approval_decision_available and not approval_decision_ready
    approval_effective_ready = (
        not approval_decision_blocked
        and (
            approval_decision_ready
            or approval_execution_ready
            or promotion_request_ready
            or promotion_execution_available
            or review_available
            or read_model_published
        )
    )
    project_local_lane_available = project_local_ontology.get("available") is True
    project_local_term_count = _number(project_local_ontology.get("term_count"))
    project_local_review_required = project_local_lane_available and project_local_term_count > 0
    project_local_import_available = project_local_import.get("available") is True
    project_local_import_non_resolving_count = _number(
        project_local_import.get("non_resolving_decision_count")
    )
    project_local_import_invalid_count = _number(
        project_local_import.get("invalid_decision_count")
    )
    project_local_import_missing_count = _number(
        project_local_import.get("missing_decision_count")
    )
    project_local_import_ready = (
        _record(project_local_import.get("readiness")).get("ready") is True
        and project_local_import_non_resolving_count == 0
        and project_local_import_invalid_count == 0
        and project_local_import_missing_count == 0
    )
    project_local_import_blocked_by = _string_list(
        _record(project_local_import.get("readiness")).get("blocked_by")
    )
    project_local_stage_status = "completed"
    project_local_next_action = "No project-local ontology review is required."
    if (
        project_local_review_required
        and project_local_import_available
        and project_local_import_ready
    ):
        project_local_stage_status = "completed"
        project_local_next_action = "Inspect accepted project-local ontology decisions."
    elif project_local_review_required and project_local_import_available:
        project_local_stage_status = "blocked"
        project_local_next_action = (
            "Resolve invalid, missing, or deferred project-local ontology decisions."
        )
    elif project_local_review_required:
        project_local_stage_status = "available"
        project_local_next_action = (
            "Review project-local ontology terms and rebuild the import preview."
        )
    approval_stage_blockers = (
        _string_list(candidate_approval.get("blocked_by"))
        if approval_decision_blocked
        else []
        if approval_effective_ready or approval_request_ready
        else _string_list(approval.get("blockers"))
    )
    real_intake_status = _text(real_idea_intake.get("status"), "missing")
    real_intake_blockers = _string_list(real_idea_intake.get("blockers"))
    real_intake_source_refs = _string_list(real_idea_intake.get("source_refs"))
    real_intake_event_refs = [
        ref
        for ref in [
            _stage_path_from_item(workflow, "event_storming_intake"),
            _optional_text(real_idea_intake.get("session_ref")),
        ]
        if ref
    ]
    if real_intake_status in {
        "intake_ready",
        "needs_clarification",
        "answers_ready",
        "continuation_ready",
        "candidate_source_ready",
        "active_candidate_ready",
    }:
        idea_intake_stage_status = "completed"
    elif real_intake_status == "blocked":
        idea_intake_stage_status = "blocked"
    elif real_intake_status == "entry_submitted":
        idea_intake_stage_status = "available"
    else:
        idea_intake_stage_status = "missing"
    if real_intake_status in {
        "continuation_ready",
        "candidate_source_ready",
        "active_candidate_ready",
    }:
        intake_clarification_stage_status = "completed"
    elif real_intake_status == "blocked":
        intake_clarification_stage_status = "blocked"
    elif real_intake_status in {"needs_clarification", "answers_ready"}:
        intake_clarification_stage_status = "available"
    else:
        intake_clarification_stage_status = "missing"

    stages = [
        _guided_stage(
            stage_id="idea_intake",
            label="Idea intake",
            status=idea_intake_stage_status,
            next_action=_text(
                real_idea_intake.get("next_action"),
                "Capture product idea as event-storming intake.",
            ),
            target_section="idea-to-spec-idea-intake",
            blockers=real_intake_blockers if idea_intake_stage_status == "blocked" else [],
            evidence_refs=real_intake_event_refs,
        ),
        _guided_stage(
            stage_id="intake_clarification",
            label="Intake clarification",
            status=intake_clarification_stage_status,
            next_action=_text(
                real_idea_intake.get("next_action"),
                "Answer intake clarification questions before candidate generation.",
            ),
            target_section="idea-to-spec-intake-clarification",
            blockers=(
                real_intake_blockers
                if intake_clarification_stage_status == "blocked"
                else []
            ),
            evidence_refs=real_intake_source_refs,
            command_template=_optional_text(
                _record(real_idea_intake.get("continuation_handoff")).get(
                    "command_hint"
                )
            ),
        ),
        _guided_stage(
            stage_id="candidate_graph",
            label="Candidate graph",
            status=(
                "completed"
                if _stage_done(_stage_status_from_item(workflow, "candidate_graph"))
                else _stage_status_from_item(workflow, "candidate_graph")
            ),
            next_action="Inspect generated candidate graph and active ontology frame.",
            target_section="idea-to-spec-candidate-graph",
            evidence_refs=[
                ref
                for ref in [
                    _stage_path_from_item(workflow, "candidate_graph"),
                    _stage_path_from_item(workflow, "ontology_seed"),
                ]
                if ref
            ],
        ),
        _guided_stage(
            stage_id="repair_review",
            label="Repair review",
            status=(
                "blocked"
                if hygiene_blocked
                else "completed"
                if repair_session_ready or approval_ready
                else "available"
            ),
            next_action=repair_review_action
            or "Answer open repair requests and review ontology decisions.",
            target_section=repair_review_section,
            blockers=hygiene_blockers,
            evidence_refs=[
                ref
                for ref in [
                    _stage_path_from_item(workflow, "repair_loop"),
                    "workspace_state_hygiene",
                ]
                if ref
            ],
        ),
        _guided_stage(
            stage_id="ontology_decisions",
            label="Ontology decisions",
            status=(
                "completed"
                if _number(approval.get("unresolved_ontology_gap_count")) == 0
                and (
                    _number(approval.get("resolved_ontology_gap_count")) > 0
                    or repair_session_ready
                    or approval_ready
                )
                else "available"
                if _record(repair_review.get("ontology_decisions")).get("available")
                or _number(approval.get("unresolved_ontology_gap_count")) > 0
                else "missing"
            ),
            next_action="Bind, alias, propose, reject, or defer product ontology gaps.",
            target_section="idea-to-spec-repair-review",
            blockers=(
                ["unresolved_ontology_gaps"]
                if _number(approval.get("unresolved_ontology_gap_count")) > 0
                else []
            ),
            evidence_refs=[
                ref
                for ref in [
                    _stage_path_from_item(workflow, "ontology_seed"),
                    "runs/product_ontology_gap_review_decisions.json",
                ]
                if ref
            ],
        ),
        _guided_stage(
            stage_id="project_local_ontology_review",
            label="Project-local ontology review",
            status=project_local_stage_status,
            next_action=project_local_next_action,
            target_section="idea-to-spec-project-local-ontology-review",
            blockers=(
                project_local_import_blocked_by
                if project_local_stage_status == "blocked"
                else []
            ),
            evidence_refs=[
                ref
                for ref in [
                    "runs/project_local_ontology_review_lane.json",
                    "runs/specspace_project_local_ontology_decision_import_preview.json",
                ]
                if ref
            ],
            command_template=(
                "make specspace-project-local-ontology-decision-import-preview"
                if project_local_lane_available
                else None
            ),
        ),
        _guided_stage(
            stage_id="rerun_request",
            label="Repair rerun request",
            status=(
                "blocked"
                if hygiene_blocked
                else "completed"
                if _stage_done(
                    _stage_status_from_item(
                        workflow, "product_repair_rerun_execution"
                    )
                )
                or repair_session_ready
                or approval_ready
                else "available"
            ),
            next_action="Request rerun preview after drafts and import preview are ready.",
            target_section="idea-to-spec-repair-review",
            blockers=hygiene_blockers,
            evidence_refs=[
                ref
                for ref in [
                    "runs/specspace_repair_draft_import_preview.json",
                    "runs/specspace_repair_rerun_request_gate.json",
                    _stage_path_from_item(workflow, "product_repair_rerun_execution"),
                ]
                if ref
            ],
            command_template="scripts/platform.py product-repair-rerun smoke --profile happy-path-promotion-dry-run",
        ),
        _guided_stage(
            stage_id="repaired_handoff",
            label="Repaired handoff",
            status=(
                "completed"
                if approval_ready
                else "blocked"
                if _number(approval.get("remaining_blocker_count")) > 0
                else "available"
            ),
            next_action="Build or inspect the repaired candidate promotion handoff.",
            target_section="idea-to-spec-approval-readiness",
            blockers=_string_list(approval.get("blockers")),
            evidence_refs=[
                ref
                for ref in [
                    _optional_text(_record(approval.get("source_refs")).get("handoff")),
                    _optional_text(
                        _record(approval.get("source_refs")).get("repair_session")
                    ),
                    _optional_text(
                        _record(approval.get("source_refs")).get("promotion_gate")
                    ),
                ]
                if ref
            ],
            command_template="make product-workspace-repaired-promotion-handoff",
        ),
        _guided_stage(
            stage_id="candidate_approval_intent",
            label="Candidate approval intent",
            status=(
                "completed"
                if approval_effective_ready
                else "blocked"
                if approval_decision_blocked
                else "available"
                if approval_request_ready
                else "blocked"
            ),
            next_action="Record owner intent to approve candidate for promotion review.",
            target_section="idea-to-spec-approval-readiness",
            blockers=approval_stage_blockers,
            evidence_refs=[
                ref
                for ref in [
                    _optional_text(_record(approval.get("source_refs")).get("handoff")),
                    "specspace-state://idea_to_spec_candidate_approval_intents.json",
                ]
                if ref
            ],
        ),
        _guided_stage(
            stage_id="platform_approval_decision",
            label="Platform approval decision",
            status=(
                "completed"
                if approval_effective_ready
                else "blocked"
                if approval_decision_blocked
                else "available"
                if approval_request_ready
                else "blocked"
            ),
            next_action="Materialize candidate approval through Platform.",
            target_section="idea-to-spec-controlled-promotion",
            blockers=approval_stage_blockers,
            evidence_refs=[
                ref
                for ref in [
                    _stage_path_from_item(workflow, "candidate_approval_execution"),
                    _stage_path_from_item(workflow, "candidate_approval"),
                ]
                if ref
            ],
            command_template=(
                "scripts/platform.py product-candidate-approval approve "
                "--specgraph-dir <specgraph-repository>"
            ),
        ),
        _guided_stage(
            stage_id="promotion_request",
            label="Promotion request",
            status=(
                "completed"
                if promotion_request_ready
                else "available"
                if approval_effective_ready
                else "blocked"
            ),
            next_action="Create report-only graph repository promotion request.",
            target_section="idea-to-spec-controlled-promotion",
            blockers=[] if approval_effective_ready else ["candidate_approval_required"],
            evidence_refs=[
                ref
                for ref in [
                    _stage_path_from_item(workflow, "platform_promotion_request"),
                    _stage_path_from_item(workflow, "candidate_approval"),
                ]
                if ref
            ],
            command_template="scripts/platform.py product-candidate-promotion request <inputs>",
        ),
        _guided_stage(
            stage_id="git_dry_run",
            label="Git dry-run",
            status=(
                "completed"
                if promotion_execution_ready_for_review
                or promotion_execution_dry_run_complete
                else "blocked"
                if promotion_execution_blocked
                else "available"
                if promotion_request_ready
                else "blocked"
            ),
            next_action="Run controlled product promotion execution in dry-run mode.",
            target_section="idea-to-spec-controlled-promotion",
            blockers=(
                ["promotion_execution_failed"]
                if promotion_execution_blocked
                else [] if promotion_request_ready else ["promotion_request_required"]
            ),
            evidence_refs=[
                ref
                for ref in [
                    _stage_path_from_item(workflow, "product_promotion_execution"),
                    _stage_path_from_item(workflow, "git_service_execution"),
                ]
                if ref
            ],
            command_template=(
                "scripts/platform.py product-candidate-promotion execute "
                "--open-review-dry-run"
            ),
        ),
        _guided_stage(
            stage_id="review_publication",
            label="Review and publication",
            status=(
                "completed"
                if read_model_published
                else "blocked"
                if review_available and not review_ok
                else "waiting_for_operator"
                if review_available and not review_merged
                else "available"
                if promotion_execution_ready_for_review
                else "blocked"
            ),
            next_action="Inspect repository review status and publish public read model after merge.",
            target_section="idea-to-spec-controlled-promotion",
            blockers=(
                ["review_status_failed"]
                if review_available and not review_ok
                else []
                if promotion_execution_ready_for_review
                else ["git_dry_run_required"]
            ),
            evidence_refs=[
                ref
                for ref in [
                    _stage_path_from_item(workflow, "review_status"),
                    _stage_path_from_item(workflow, "read_model_publication"),
                ]
                if ref
            ],
        ),
    ]

    current = next(
        (
            stage
            for stage in stages
            if stage["status"] not in {"completed", "ready"}
        ),
        stages[-1],
    )
    if any(stage["status"] == "blocked" for stage in stages):
        overall_status = "blocked"
    elif read_model_published:
        overall_status = "completed"
    elif current["status"] in {"available", "waiting_for_operator"}:
        overall_status = "waiting_for_operator"
    else:
        overall_status = _text(workflow.get("status"), "ready")
    next_action = {
        "id": f"next.{current['id']}",
        "label": current["primary_next_action"],
        "status": current["status"],
        "target_section": current["target_section"],
        "command_template": current["command_template"],
        "evidence_refs": current["evidence_refs"],
        "authority_boundary": _guided_flow_boundary(),
    }
    return {
        "current_stage": current["id"],
        "current_stage_label": current["label"],
        "overall_status": overall_status,
        "workflow_stage": _text(workflow.get("stage"), "unknown"),
        "workflow_status": _text(workflow.get("status"), "unknown"),
        "next_handoff": next_handoff,
        "next_actions": [next_action],
        "stages": stages,
        "authority_boundary": _guided_flow_boundary(),
    }


def attach_guided_flow(payload: dict[str, Any]) -> dict[str, Any]:
    payload["guided_flow"] = _guided_flow(payload)
    return payload


def build_idea_to_spec_workspace(
    *,
    artifacts: dict[str, Any],
    source: dict[str, Any],
) -> dict[str, Any]:
    active_candidate = _artifact_data(artifacts, ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT)
    intake = _artifact_data(artifacts, IDEA_EVENT_STORMING_INTAKE_ARTIFACT)
    intake_clarification_requests = _artifact_data(
        artifacts, IDEA_INTAKE_CLARIFICATION_REQUESTS_ARTIFACT
    )
    intake_clarification_answers = _artifact_data(
        artifacts, IDEA_INTAKE_CLARIFICATION_ANSWERS_ARTIFACT
    )
    intake_answer_rerun_input = _artifact_data(
        artifacts, IDEA_INTAKE_ANSWER_RERUN_INPUT_ARTIFACT
    )
    clarified_intake_session = _artifact_data(
        artifacts, CLARIFIED_USER_IDEA_INTAKE_SESSION_ARTIFACT
    )
    clarified_intake_source = _artifact_data(
        artifacts, CLARIFIED_USER_IDEA_INTAKE_SOURCE_ARTIFACT
    )
    intake_clarification_rerun = _artifact_data(
        artifacts, IDEA_INTAKE_CLARIFICATION_RERUN_REPORT_ARTIFACT
    )
    real_idea_answer_template = _artifact_data(
        artifacts, REAL_IDEA_ANSWER_TEMPLATE_ARTIFACT
    )
    real_idea_answer_authoring_report = _artifact_data(
        artifacts, REAL_IDEA_ANSWER_AUTHORING_REPORT_ARTIFACT
    )
    real_idea_answer_set = _artifact_data(artifacts, REAL_IDEA_ANSWER_SET_ARTIFACT)
    specspace_real_idea_answer_import_preview = _artifact_data(
        artifacts, SPECSPACE_REAL_IDEA_ANSWER_IMPORT_PREVIEW_ARTIFACT
    )
    real_idea_answer_continuation_report = _artifact_data(
        artifacts, REAL_IDEA_ANSWER_CONTINUATION_REPORT_ARTIFACT
    )
    real_idea_entry_intake_execution = _artifact_data(
        artifacts, PLATFORM_REAL_IDEA_ENTRY_INTAKE_EXECUTION_REPORT_ARTIFACT
    )
    workspace_initialization_plan = _artifact_data(
        artifacts, PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_PLAN_ARTIFACT
    )
    workspace_initialization_execution_request = _artifact_data(
        artifacts,
        PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REQUEST_ARTIFACT,
    )
    workspace_initialization_execution = _artifact_data(
        artifacts,
        PLATFORM_PRODUCT_WORKSPACE_INITIALIZATION_EXECUTION_REPORT_ARTIFACT,
    )
    candidate_seed = _artifact_data(artifacts, CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT)
    candidate_graph = _artifact_data(artifacts, CANDIDATE_SPEC_GRAPH_ARTIFACT)
    candidate_overview = _artifact_data(artifacts, CANDIDATE_OVERVIEW_ARTIFACT)
    pre_sib = _artifact_data(artifacts, PRE_SIB_COHERENCE_REPORT_ARTIFACT)
    repair_loop = _artifact_data(artifacts, CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT)
    clarification_requests = _artifact_data(
        artifacts, IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT
    )
    clarification_answers = _artifact_data(
        artifacts, IDEA_TO_SPEC_CLARIFICATION_ANSWERS_ARTIFACT
    )
    ontology_decisions = _artifact_data(
        artifacts, PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT
    )
    project_local_ontology_review = _artifact_data(
        artifacts, PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT
    )
    project_local_ontology_decision_import_preview = _artifact_data(
        artifacts, SPECSPACE_PROJECT_LOCAL_ONTOLOGY_DECISION_IMPORT_PREVIEW_ARTIFACT
    )
    project_local_ontology_decision_effect = _artifact_data(
        artifacts, PROJECT_LOCAL_ONTOLOGY_DECISION_EFFECT_REPORT_ARTIFACT
    )
    rerun_input = _artifact_data(artifacts, IDEA_TO_SPEC_ANSWER_RERUN_INPUT_ARTIFACT)
    rerun_preview = _artifact_data(artifacts, IDEA_TO_SPEC_RERUN_PREVIEW_ARTIFACT)
    rerun_materialization = _artifact_data(
        artifacts, IDEA_TO_SPEC_RERUN_MATERIALIZATION_ARTIFACT
    )
    repair_session_journal = _artifact_data(
        artifacts, IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT
    )
    product_repair_rerun_execution = _artifact_data(
        artifacts, PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT
    )
    product_repair_rerun_publication = _artifact_data(
        artifacts, PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT
    )
    repaired_handoff = _artifact_data(
        artifacts, REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT
    )
    repaired_active_candidate = _artifact_data(
        artifacts, REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT
    )
    repaired_candidate_graph = _artifact_data(
        artifacts, REPAIRED_CANDIDATE_SPEC_GRAPH_ARTIFACT
    )
    repaired_pre_sib = _artifact_data(
        artifacts, REPAIRED_PRE_SIB_COHERENCE_REPORT_ARTIFACT
    )
    repaired_repair_loop = _artifact_data(
        artifacts, REPAIRED_CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT
    )
    repaired_materialization = _artifact_data(
        artifacts, REPAIRED_CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT
    )
    repaired_repair_session = _artifact_data(
        artifacts, REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT
    )
    repaired_promotion_gate = _artifact_data(
        artifacts, REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT
    )
    materialization = _artifact_data(
        artifacts, CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT
    )
    promotion_gate = _artifact_data(artifacts, IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT)
    candidate_approval_execution = _artifact_data(
        artifacts, PLATFORM_CANDIDATE_APPROVAL_EXECUTION_REPORT_ARTIFACT
    )
    candidate_approval = _artifact_data(artifacts, CANDIDATE_APPROVAL_DECISION_ARTIFACT)
    platform_promotion = _artifact_data(
        artifacts, GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT
    )
    product_promotion_execution = _artifact_data(
        artifacts, PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
    )
    git_service_execution = _artifact_data(
        artifacts, GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
    )
    product_review_status = _artifact_data(
        artifacts, PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
    )
    legacy_review_status = _artifact_data(
        artifacts, GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
    )
    review_status = product_review_status or legacy_review_status
    product_read_model_publication = _artifact_data(
        artifacts, PRODUCT_CANDIDATE_PROMOTION_READ_MODEL_PUBLICATION_REPORT_ARTIFACT
    )
    legacy_read_model_publication = _artifact_data(
        artifacts, GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT
    )
    read_model_publication = (
        product_read_model_publication or legacy_read_model_publication
    )
    promotion_finalization = _artifact_data(
        artifacts, GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT
    )
    idea_maturity_report_error = _artifact_contract_error(
        artifacts.get(idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT),
        idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT,
    )
    idea_maturity_validation_error = _artifact_contract_error(
        artifacts.get(idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT),
        idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT,
    )
    idea_maturity_report = _artifact_data(
        artifacts, idea_maturity.IDEA_MATURITY_METRICS_REPORT_ARTIFACT
    )
    idea_maturity_validation = _artifact_data(
        artifacts, idea_maturity.IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT
    )
    statuses = {
        key: _artifact_status(artifacts, filename)
        for filename, key in ARTIFACT_KEYS.items()
    }
    source_workspace_id = _optional_text(source.get("workspace_id"))
    if not _candidate_matches_workspace(active_candidate, source_workspace_id):
        active_candidate = None
    if not _candidate_matches_workspace(repaired_active_candidate, source_workspace_id):
        repaired_active_candidate = None
    repaired_surface_selected = repaired_handoff is not None
    selected_active_candidate = (
        repaired_active_candidate
        if repaired_surface_selected and repaired_active_candidate is not None
        else active_candidate
    )
    selected_candidate_graph = (
        repaired_candidate_graph
        if repaired_surface_selected and repaired_candidate_graph is not None
        else candidate_graph
    )
    selected_pre_sib = (
        repaired_pre_sib
        if repaired_surface_selected and repaired_pre_sib is not None
        else pre_sib
    )
    selected_repair_loop = (
        repaired_repair_loop
        if repaired_surface_selected and repaired_repair_loop is not None
        else repair_loop
    )
    selected_materialization = (
        repaired_materialization
        if repaired_surface_selected and repaired_materialization is not None
        else materialization
    )
    selected_repair_session_journal = (
        repaired_repair_session
        if repaired_surface_selected and repaired_repair_session is not None
        else repair_session_journal
    )
    selected_promotion_gate = (
        repaired_promotion_gate
        if repaired_surface_selected and repaired_promotion_gate is not None
        else promotion_gate
    )
    core_missing_artifact_count = sum(
        1
        for filename in CORE_WORKSPACE_RUN_ARTIFACTS
        if not statuses[ARTIFACT_KEYS[filename]]["available"]
    )
    platform_missing_artifact_count = sum(
        1
        for filename in PLATFORM_PROMOTION_ARTIFACTS
        if not statuses[ARTIFACT_KEYS[filename]]["available"]
    )
    missing_artifact_count = core_missing_artifact_count
    available_count = sum(1 for status in statuses.values() if status["available"])
    project_local_ontology_review_lane = _project_local_ontology_review_lane(
        project_local_ontology_review,
        project_local_ontology_decision_effect,
    )
    ontology_seed_review_resolved = _project_local_ontology_effect_ready(
        project_local_ontology_review_lane
    )
    status = "ready"
    if core_missing_artifact_count:
        status = "partial" if available_count else "unavailable"
    elif _ontology_seed_blocked(candidate_seed) and not ontology_seed_review_resolved:
        status = "blocked"
    elif selected_promotion_gate is not None and not _readiness(selected_promotion_gate)["ready"]:
        status = "blocked"
    candidate_counts = _candidate_counts(selected_candidate_graph)
    ontology_seed = _ontology_seed(candidate_seed)
    pre_sib_findings = _findings(selected_pre_sib)
    repair_actions = _repair_actions(selected_repair_loop)
    intake_clarification = _intake_clarification_lane(
        clarification_requests=intake_clarification_requests,
        clarification_answers=intake_clarification_answers,
        rerun_input=intake_answer_rerun_input,
        clarified_session=clarified_intake_session,
        clarified_source=clarified_intake_source,
        rerun_report=intake_clarification_rerun,
        answer_template=real_idea_answer_template,
        answer_authoring_report=real_idea_answer_authoring_report,
        real_idea_answer_set=real_idea_answer_set,
        specspace_answer_import_preview=specspace_real_idea_answer_import_preview,
        answer_continuation_report=real_idea_answer_continuation_report,
    )
    repair_session = _repair_session(selected_repair_session_journal)
    downstream_promotion_succeeded = (
        (platform_promotion or {}).get("ok") is True
        or (
            product_promotion_execution is not None
            and _product_promotion_execution(product_promotion_execution)["ok"]
            and not _product_promotion_execution(product_promotion_execution)["dry_run"]
        )
        or (
            git_service_execution is not None
            and _git_service_execution(git_service_execution)["ok"]
            and not _git_service_execution(git_service_execution)["dry_run"]
        )
        or _review_status(review_status)["ok"]
        or _read_model_publication(read_model_publication)["published"]
        or _promotion_finalization(promotion_finalization)["read_model_published"]
    )
    if (
        status != "partial"
        and not downstream_promotion_succeeded
        and selected_repair_session_journal is not None
        and (
            not repair_session["readiness_impact"]["ready_for_candidate_approval"]
            or not repair_session["readiness_impact"]["ready_for_platform_promotion"]
        )
    ):
        status = "blocked"
    repair_review = _repair_review_lane(
        repair_session=selected_repair_session_journal,
        clarification_requests=clarification_requests,
        clarification_answers=clarification_answers,
        ontology_decisions=ontology_decisions,
        rerun_input=rerun_input,
        rerun_preview=rerun_preview,
        rerun_materialization=rerun_materialization,
        product_repair_rerun_execution=product_repair_rerun_execution,
        product_repair_rerun_publication=product_repair_rerun_publication,
    )
    project_local_ontology_import_preview = (
        _project_local_ontology_decision_import_preview(
            project_local_ontology_decision_import_preview
        )
    )
    materialized_files = _materialized_files(selected_materialization)
    promotion_gate_findings = _findings(selected_promotion_gate)
    promotion_request = _promotion_request(selected_promotion_gate or selected_materialization)
    approval_readiness = _approval_readiness(
        active_candidate=active_candidate,
        repair_session=repair_session_journal,
        promotion_gate=promotion_gate,
        repaired_handoff=repaired_handoff,
        repaired_active_candidate=repaired_active_candidate,
        repaired_repair_session=repaired_repair_session,
        repaired_promotion_gate=repaired_promotion_gate,
        product_repair_rerun_execution=product_repair_rerun_execution,
        product_repair_rerun_publication=product_repair_rerun_publication,
        candidate_approval_execution=candidate_approval_execution,
        candidate_approval=candidate_approval,
        ontology_seed_review_required=(
            _ontology_seed_blocked(candidate_seed) and not ontology_seed_review_resolved
        ),
    )
    workflow = _workflow(
        statuses=statuses,
        core_missing_artifact_count=core_missing_artifact_count,
        active_candidate=selected_active_candidate,
        intake=intake,
        candidate_seed=candidate_seed,
        ontology_seed_review_resolved=ontology_seed_review_resolved,
        candidate_graph=selected_candidate_graph,
        pre_sib=selected_pre_sib,
        repair_loop=selected_repair_loop,
        repair_session=selected_repair_session_journal,
        materialization=selected_materialization,
        promotion_gate=selected_promotion_gate,
        product_repair_rerun_execution=product_repair_rerun_execution,
        product_repair_rerun_publication=product_repair_rerun_publication,
        candidate_approval_execution=candidate_approval_execution,
        candidate_approval=candidate_approval,
        platform_promotion=platform_promotion,
        product_promotion_execution=product_promotion_execution,
        git_service_execution=git_service_execution,
        review_status=review_status,
        read_model_publication=read_model_publication,
        promotion_finalization=promotion_finalization,
    )
    workspace_identity = _workspace(selected_active_candidate)
    effective_workspace_id = source_workspace_id or _optional_text(workspace_identity.get("id"))
    selected_active_candidate_ref = (
        statuses["repaired_active_candidate"]["path"]
        if repaired_surface_selected and repaired_active_candidate is not None
        else statuses["active_candidate"]["path"]
    )
    real_idea_intake = _real_idea_intake_projection(
        workspace_id=effective_workspace_id,
        intake=intake,
        active_candidate=selected_active_candidate,
        active_candidate_ref=selected_active_candidate_ref,
        clarification_requests=intake_clarification_requests,
        intake_clarification=intake_clarification,
        answer_authoring=intake_clarification["answer_authoring"],
        answer_continuation=intake_clarification["answer_continuation"],
        entry_execution_report=real_idea_entry_intake_execution,
        statuses=statuses,
    )
    workspace_initialization = _workspace_initialization_surface(
        plan=workspace_initialization_plan,
        execution_request=workspace_initialization_execution_request,
        execution=workspace_initialization_execution,
        workspace_id=effective_workspace_id,
    )
    payload = {
        "api_version": "v1",
        "artifact_kind": IDEA_TO_SPEC_WORKSPACE_ARTIFACT_KIND,
        "schema_version": 1,
        "generated_at": _now_iso(),
        "read_only": True,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source": source,
        "workspace": workspace_identity,
        "summary": {
            "status": status,
            "available_artifact_count": available_count,
            "missing_artifact_count": missing_artifact_count,
            "platform_missing_artifact_count": platform_missing_artifact_count,
            "candidate_node_count": candidate_counts["node_count"],
            "candidate_edge_count": candidate_counts["edge_count"],
            "ontology_seed_gap_count": ontology_seed["summary"][
                "ontology_gap_count"
            ],
            "ontology_seed_binding_count": ontology_seed["summary"][
                "ontology_binding_count"
            ],
            "pre_sib_finding_count": _finding_count(pre_sib),
            "repair_action_count": _repair_action_count(repair_loop),
            "clarification_request_count": repair_review["clarification_requests"][
                "request_count"
            ],
            "ontology_decision_count": repair_review["ontology_decisions"][
                "decision_count"
            ],
            "project_local_ontology_term_count": project_local_ontology_review_lane[
                "term_count"
            ],
            "project_local_ontology_import_accepted_count": (
                project_local_ontology_import_preview["accepted_decision_count"]
            ),
            "project_local_ontology_import_missing_count": (
                project_local_ontology_import_preview["missing_decision_count"]
            ),
            "project_local_ontology_import_invalid_count": (
                project_local_ontology_import_preview["invalid_decision_count"]
            ),
            "resolved_ontology_gap_count": (
                repair_session["readiness_impact"]["resolved_ontology_gap_count"]
                if selected_repair_session_journal is not None
                else repair_review["rerun_preview"]["candidate_quality_preview"][
                    "resolved_ontology_gap_count"
                ]
            ),
            "unresolved_ontology_gap_count": (
                repair_session["readiness_impact"]["unresolved_ontology_gap_count"]
                if selected_repair_session_journal is not None
                else repair_review["rerun_preview"]["candidate_quality_preview"][
                    "unresolved_ontology_gap_count"
                ]
            ),
            "rerun_removed_gap_count": (
                repair_session["readiness_impact"]["rerun_removed_gap_count"]
                if selected_repair_session_journal is not None
                else len(
                    repair_review["rerun_materialization"]["delta"][
                        "removed_gap_ids"
                    ]
                )
            ),
            "repair_context_required_count": _number(
                _record((selected_repair_loop or {}).get("summary")).get(
                    "context_required_count"
                )
            ),
            "materialized_file_count": _materialized_file_count(selected_materialization),
            "promotion_path_count": len(promotion_request["paths"]),
            "promotion_gate_blocker_count": _finding_count(selected_promotion_gate),
            "git_service_operation_count": _number(
                _record((git_service_execution or {}).get("summary")).get(
                    "operation_count"
                )
            ),
            "git_service_error_count": _number(
                _record((git_service_execution or {}).get("summary")).get(
                    "error_count"
                )
            ),
            "approval_ready": approval_readiness["candidate_approval_decision_ready"],
            "repair_session_ready_for_candidate_approval": repair_session[
                "readiness_impact"
            ]["ready_for_candidate_approval"],
            "repair_session_ready_for_platform_promotion": repair_session[
                "readiness_impact"
            ]["ready_for_platform_promotion"],
            "review_merged": _review_status(review_status)["review_merged"],
            "read_model_published": _read_model_publication(
                read_model_publication
            )["published"]
            or _promotion_finalization(promotion_finalization)[
                "read_model_published"
            ],
            "next_artifact": _optional_text(
                _record((selected_promotion_gate or {}).get("readiness")).get(
                    "next_artifact"
                )
                or _record((selected_materialization or {}).get("readiness")).get(
                    "next_artifact"
                )
                or _record((selected_repair_loop or {}).get("readiness")).get(
                    "next_artifact"
                )
            ),
        },
        "workflow": workflow,
        "workspace_initialization": workspace_initialization,
        "real_idea_intake": real_idea_intake,
        "intake": {
            "available": intake is not None,
            "active_frame": _active_frame((intake or {}).get("active_frame")),
            "summary": {
                "actor_count": _list_count(intake, "actors"),
                "domain_event_count": _list_count(intake, "domain_events"),
                "command_count": _list_count(intake, "commands"),
                "policy_count": _list_count(intake, "policies"),
                "external_system_count": _list_count(intake, "external_systems"),
                "constraint_count": _list_count(intake, "constraints"),
                "vocabulary_question_count": _list_count(
                    intake, "vocabulary_questions"
                ),
                "context_completion_question_count": _list_count(
                    intake, "context_completion_questions"
                ),
            },
        },
        "intake_clarification": intake_clarification,
        "candidate_graph": {
            "available": selected_candidate_graph is not None,
            "source_mode": "repaired_handoff"
            if repaired_surface_selected and repaired_candidate_graph is not None
            else "standard",
            "active_frame": _active_frame(
                (selected_candidate_graph or {}).get("active_frame")
            ),
            "summary": candidate_counts,
            "pre_sib_readiness": _record(
                (selected_candidate_graph or {}).get("pre_sib_readiness")
            ),
            "nodes": _candidate_nodes(selected_candidate_graph),
        },
        "candidate_overview": _candidate_overview(candidate_overview),
        "ontology_seed": ontology_seed,
        "pre_sib": {
            "available": selected_pre_sib is not None,
            "readiness": _readiness(selected_pre_sib),
            "metrics": _record((selected_pre_sib or {}).get("metrics")),
            "findings": pre_sib_findings,
        },
        "repair_loop": {
            "available": selected_repair_loop is not None,
            "readiness": _readiness(selected_repair_loop),
            "summary": _record((selected_repair_loop or {}).get("summary")),
            "metric_delta_projection": _record(
                (selected_repair_loop or {}).get("metric_delta_projection")
            ),
            "actions": repair_actions,
        },
        "repair_session": repair_session,
        "repair_review": repair_review,
        "project_local_ontology_review": project_local_ontology_review_lane,
        "project_local_ontology_decision_import_preview": (
            project_local_ontology_import_preview
        ),
        "idea_maturity": idea_maturity.build_surface(
            report=idea_maturity_report,
            validation=idea_maturity_validation,
            report_error=idea_maturity_report_error,
            validation_error=idea_maturity_validation_error,
        ),
        "approval_readiness": approval_readiness,
        "materialization": {
            "available": selected_materialization is not None,
            "readiness": _readiness(selected_materialization),
            "summary": _record((selected_materialization or {}).get("summary")),
            "materialization_source": _optional_text(
                (selected_materialization or {}).get("materialization_source")
            ),
            "files": materialized_files,
            "promotion_request": _promotion_request(selected_materialization),
        },
        "promotion_gate": {
            "available": selected_promotion_gate is not None,
            "readiness": _readiness(selected_promotion_gate),
            "summary": _record((selected_promotion_gate or {}).get("summary")),
            "metric_snapshot": _record(
                (selected_promotion_gate or {}).get("metric_snapshot")
            ),
            "promotion_request": promotion_request,
            "findings": promotion_gate_findings,
        },
        "controlled_promotion": {
            "available": platform_promotion is not None
            or product_promotion_execution is not None
            or git_service_execution is not None
            or candidate_approval_execution is not None
            or candidate_approval is not None
            or review_status is not None
            or read_model_publication is not None
            or promotion_finalization is not None,
            "candidate_approval_execution": _candidate_approval_execution(
                candidate_approval_execution
            ),
            "candidate_approval": _candidate_approval_decision(candidate_approval),
            "platform_request": _platform_promotion_request(platform_promotion),
            "product_promotion_execution": _product_promotion_execution(
                product_promotion_execution
            ),
            "git_service_execution": _git_service_execution(git_service_execution),
            "review_status": _review_status(review_status),
            "read_model_publication": _read_model_publication(
                read_model_publication
            ),
            "promotion_finalization": _promotion_finalization(
                promotion_finalization
            ),
            "action_boundary": {
                "inspect_only": True,
                "acknowledge_only": True,
                "may_execute_git_service": False,
                "may_create_branch_or_commit": False,
                "may_merge_review": False,
                "may_mutate_specs": False,
            },
        },
        "artifacts": statuses,
        "display_limits": DISPLAY_LIMITS,
        "authority_boundary": _authority_boundary(),
    }
    return attach_guided_flow(payload)
