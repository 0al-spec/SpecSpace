"""Read-only Idea-to-Spec workspace read model."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

IDEA_TO_SPEC_WORKSPACE_ARTIFACT_KIND = "specspace_idea_to_spec_workspace"
ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT = "active_idea_to_spec_candidate.json"
IDEA_EVENT_STORMING_INTAKE_ARTIFACT = "idea_event_storming_intake.json"
CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT = "candidate_spec_graph_seed.json"
CANDIDATE_SPEC_GRAPH_ARTIFACT = "candidate_spec_graph.json"
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
PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT = (
    "platform_product_repair_rerun_execution_report.json"
)
PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT = (
    "platform_product_repair_rerun_publication_report.json"
)
CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT = (
    "candidate_spec_materialization_report.json"
)
IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT = "idea_to_spec_promotion_gate.json"
CANDIDATE_APPROVAL_DECISION_ARTIFACT = "candidate_approval_decision.json"
GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT = "graph_repository_promotion_request.json"
GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT = (
    "git_service_promotion_execution_report.json"
)
GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT = (
    "graph_repository_review_status_report.json"
)
GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT = (
    "graph_repository_publish_read_model_report.json"
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
    CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT,
    IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT,
    IDEA_TO_SPEC_CLARIFICATION_ANSWERS_ARTIFACT,
    PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT,
    IDEA_TO_SPEC_ANSWER_RERUN_INPUT_ARTIFACT,
    IDEA_TO_SPEC_RERUN_PREVIEW_ARTIFACT,
    IDEA_TO_SPEC_RERUN_MATERIALIZATION_ARTIFACT,
    IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT,
    SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT,
    SPECSPACE_REPAIR_DRAFT_RERUN_REPORT_ARTIFACT,
    PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT,
    PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT,
)
PLATFORM_PROMOTION_ARTIFACTS: tuple[str, ...] = (
    CANDIDATE_APPROVAL_DECISION_ARTIFACT,
    GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT,
    GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
    GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT,
    GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT,
    GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT,
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
)

ARTIFACT_KEYS: dict[str, str] = {
    ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT: "active_candidate",
    IDEA_EVENT_STORMING_INTAKE_ARTIFACT: "event_storming_intake",
    CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT: "ontology_seed",
    IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT: "clarification_requests",
    IDEA_TO_SPEC_CLARIFICATION_ANSWERS_ARTIFACT: "clarification_answers",
    PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT: "ontology_decisions",
    IDEA_TO_SPEC_ANSWER_RERUN_INPUT_ARTIFACT: "rerun_input",
    IDEA_TO_SPEC_RERUN_PREVIEW_ARTIFACT: "rerun_preview",
    IDEA_TO_SPEC_RERUN_MATERIALIZATION_ARTIFACT: "rerun_materialization",
    IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT: "repair_session",
    SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT: "specspace_repair_draft_import_preview",
    SPECSPACE_REPAIR_DRAFT_RERUN_REPORT_ARTIFACT: "specspace_repair_draft_rerun_report",
    PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT: "product_repair_rerun_execution",
    PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT: "product_repair_rerun_publication",
    CANDIDATE_SPEC_GRAPH_ARTIFACT: "candidate_graph",
    PRE_SIB_COHERENCE_REPORT_ARTIFACT: "pre_sib",
    CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: "repair_loop",
    CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: "materialization",
    IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: "promotion_gate",
    CANDIDATE_APPROVAL_DECISION_ARTIFACT: "candidate_approval",
    GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT: "platform_promotion_request",
    GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT: "git_service_execution",
    GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT: "review_status",
    GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT: "read_model_publication",
    GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT: "promotion_finalization",
}

EXPECTED_ARTIFACT_KINDS: dict[str, str] = {
    ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT: "active_idea_to_spec_candidate",
    IDEA_EVENT_STORMING_INTAKE_ARTIFACT: "idea_event_storming_intake",
    CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT: "candidate_spec_graph_seed",
    IDEA_TO_SPEC_CLARIFICATION_REQUESTS_ARTIFACT: (
        "idea_to_spec_clarification_requests"
    ),
    IDEA_TO_SPEC_CLARIFICATION_ANSWERS_ARTIFACT: (
        "idea_to_spec_clarification_answers"
    ),
    PRODUCT_ONTOLOGY_GAP_REVIEW_DECISIONS_ARTIFACT: (
        "product_ontology_gap_review_decisions"
    ),
    IDEA_TO_SPEC_ANSWER_RERUN_INPUT_ARTIFACT: "idea_to_spec_answer_rerun_input",
    IDEA_TO_SPEC_RERUN_PREVIEW_ARTIFACT: "idea_to_spec_rerun_preview",
    IDEA_TO_SPEC_RERUN_MATERIALIZATION_ARTIFACT: (
        "idea_to_spec_rerun_materialization"
    ),
    IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT: "idea_to_spec_repair_session_journal",
    SPECSPACE_REPAIR_DRAFT_IMPORT_PREVIEW_ARTIFACT: "specspace_repair_draft_import_preview",
    SPECSPACE_REPAIR_DRAFT_RERUN_REPORT_ARTIFACT: "specspace_repair_draft_rerun_report",
    PLATFORM_PRODUCT_REPAIR_RERUN_EXECUTION_REPORT_ARTIFACT: (
        "platform_product_repair_rerun_execution_report"
    ),
    PLATFORM_PRODUCT_REPAIR_RERUN_PUBLICATION_REPORT_ARTIFACT: (
        "platform_product_repair_rerun_publication_report"
    ),
    CANDIDATE_SPEC_GRAPH_ARTIFACT: "candidate_spec_graph",
    PRE_SIB_COHERENCE_REPORT_ARTIFACT: "pre_sib_coherence_report",
    CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: "candidate_repair_loop_report",
    CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: (
        "candidate_spec_materialization_report"
    ),
    IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: "idea_to_spec_promotion_gate",
    CANDIDATE_APPROVAL_DECISION_ARTIFACT: "candidate_approval_decision",
    GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT: (
        "platform_graph_repository_promotion_request"
    ),
    GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT: (
        "platform_git_service_promotion_execution_report"
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
    "resolved_gaps": 40,
    "materialized_files": 40,
    "git_service_operations": 20,
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
    expected_kind = EXPECTED_ARTIFACT_KINDS.get(filename)
    if expected_kind is not None and value.get("artifact_kind") != expected_kind:
        return {
            "reason": "invalid_artifact_contract",
            "detail": f"artifact_kind must be {expected_kind}.",
            "artifact_kind": _optional_text(value.get("artifact_kind")),
        }
    if filename == ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT:
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
    if filename == IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT:
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
    if filename == GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "git service authority boundary flags must remain false.",
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
    summary = _record(data.get("summary"))
    readiness = _record(data.get("readiness"))
    pre_sib_readiness = _record(data.get("pre_sib_readiness"))
    source_generation = (
        _record(data.get("source_generation"))
        if filename == CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT
        else {}
    )
    source_summary = _record(source_generation.get("summary"))
    source_readiness = _record(source_generation.get("readiness"))
    return {
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


def _active_frame(value: Any) -> dict[str, Any]:
    frame = _record(value)
    return {
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
            }
        )
    return rows


def _finding_count(payload: dict[str, Any] | None) -> int:
    return len(_records((payload or {}).get("findings"))) + len(
        _records((payload or {}).get("warnings"))
    )


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
                "question": _optional_text(item.get("question")),
                "suggested_actions": _string_list(item.get("suggested_actions")),
            }
        )
    return rows


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


def _review_status(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "review_state": _optional_text((report or {}).get("review_state")),
        "review_decision": _optional_text((report or {}).get("review_decision")),
        "review_url": _optional_text((report or {}).get("review_url")),
        "review_merged": summary.get("review_merged") is True,
        "error_count": _number(summary.get("error_count"))
        or len(_records((report or {}).get("diagnostics"))),
    }


def _read_model_publication(report: dict[str, Any] | None) -> dict[str, Any]:
    summary = _record((report or {}).get("summary"))
    return {
        "available": report is not None,
        "ok": (report or {}).get("ok") is True,
        "dry_run": (report or {}).get("dry_run") is True,
        "review_state": _optional_text((report or {}).get("review_state")),
        "manifest": _optional_text((report or {}).get("manifest")),
        "published": summary.get("published") is True,
        "file_count": _number(summary.get("file_count")),
        "error_count": _number(summary.get("error_count")),
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
        rows.append(
            {
                "key": _text(key, "artifact"),
                "path": _optional_text(item.get("path")),
                "present": item.get("present") is True,
                "artifact_kind": _optional_text(item.get("artifact_kind")),
                "contract_ref": _optional_text(item.get("contract_ref")),
                "status": _optional_text(item.get("status")),
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
    candidate_graph: dict[str, Any] | None,
    pre_sib: dict[str, Any] | None,
    repair_loop: dict[str, Any] | None,
    repair_session: dict[str, Any] | None,
    materialization: dict[str, Any] | None,
    promotion_gate: dict[str, Any] | None,
    product_repair_rerun_execution: dict[str, Any] | None,
    product_repair_rerun_publication: dict[str, Any] | None,
    candidate_approval: dict[str, Any] | None,
    platform_promotion: dict[str, Any] | None,
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
    seed_source_generation = _record((candidate_seed or {}).get("source_generation"))
    seed_readiness = _readiness(seed_source_generation)
    seed_blocked = _ontology_seed_blocked(candidate_seed)
    platform_ok = (platform_promotion or {}).get("ok") is True
    approval_readiness = _record((candidate_approval or {}).get("readiness"))
    approval_decision = _record((candidate_approval or {}).get("decision"))
    approval_ready = (
        candidate_approval is not None
        and approval_readiness.get("ready") is True
        and approval_decision.get("state") == "approved"
    )
    git_summary = _record((git_service_execution or {}).get("summary"))
    git_error_count = _number(git_summary.get("error_count"))
    git_ok = (git_service_execution or {}).get("ok") is True
    git_open_review_dry_run = (
        (git_service_execution or {}).get("open_review_dry_run") is True
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
    git_service_failed = git_service_execution is not None and not git_ok
    approval_failed = candidate_approval is not None and not approval_ready
    journal_blocks_candidate_approval = (
        repair_session is not None
        and repair_session_impact["ready_for_candidate_approval"] is not True
    )
    journal_blocks_platform_promotion = (
        repair_session is not None
        and candidate_approval is not None
        and repair_session_impact["ready_for_platform_promotion"] is not True
    )
    review_status_summary = _record((review_status or {}).get("summary"))
    review_merged = (
        (review_status or {}).get("review_state") == "merged"
        or review_status_summary.get("review_merged") is True
    )
    review_status_failed = review_status is not None and (review_status.get("ok") is not True)
    publish_summary = _record((read_model_publication or {}).get("summary"))
    read_model_published = (
        publish_summary.get("published") is True
        or _record((promotion_finalization or {}).get("summary")).get(
            "read_model_published"
        )
        is True
    )
    finalization_failed = (
        promotion_finalization is not None
        and promotion_finalization.get("ok") is not True
    )

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
            item_id="candidate_approval",
            label="Candidate approval",
            status=_available_status(
                statuses,
                "candidate_approval",
                approval_ready,
                blocked=approval_failed,
            ),
            artifact_key=CANDIDATE_APPROVAL_DECISION_ARTIFACT,
            detail=_optional_text(
                approval_readiness.get("review_state")
                or approval_decision.get("state")
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
            item_id="git_service_execution",
            label="Git Service execution",
            status=_available_status(
                statuses,
                "git_service_execution",
                git_ok and git_error_count == 0,
                blocked=git_service_execution is not None and not git_ok,
                dry_run=git_ok and git_open_review_dry_run,
            ),
            artifact_key=GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
            detail=(
                "open_review_dry_run"
                if git_open_review_dry_run
                else _optional_text((git_service_execution or {}).get("candidate_ref"))
            ),
        ),
        _workflow_item(
            item_id="review_status",
            label="Review status",
            status=_available_status(
                statuses,
                "review_status",
                review_merged,
                blocked=review_status_failed,
            ),
            artifact_key=GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT,
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
                    "read_model_publication",
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
            artifact_key=GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT,
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
    elif product_repair_execution_view["ok"] and product_repair_rerun_publication is None:
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
    elif promotion_readiness["ready"] and candidate_approval is None:
        stage = "approval_required"
        status = "operator_review_required"
        next_handoff = {
            "kind": "candidate_approval_decision",
            "label": "Approve or reject the candidate before Git Service execution",
            "status": "operator_review_required",
            "artifact_key": "promotion_gate",
            "artifact_path": f"runs/{IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT}",
            "command_template": (
                "cd <specgraph-repository> && make candidate-approval-decision "
                "CANDIDATE_APPROVAL_DECISION_STATE=approved "
                "CANDIDATE_APPROVAL_REASON='<public-safe rationale>'"
            ),
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
    elif git_service_failed:
        stage = "git_service_execution_failed"
        status = "blocked"
        next_handoff = {
            "kind": "git_service_execution_repair",
            "label": "Repair the Git Service execution report before continuing",
            "status": "blocked",
            "artifact_key": "git_service_execution",
            "artifact_path": f"runs/{GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT}",
            "command_template": (
                "scripts/platform.py git-service execute-promotion <inputs>"
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
    elif platform_ok and approval_ready and git_service_execution is None:
        stage = "git_service_ready"
        status = "ready_for_handoff"
        next_handoff = {
            "kind": "git_service_execute_promotion",
            "label": "Run Git Service promotion execution",
            "status": "ready",
            "artifact_key": "platform_promotion_request",
            "artifact_path": f"runs/{GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT}",
            "command_template": (
                "scripts/platform.py git-service execute-promotion "
                "--promotion-request runs/graph_repository_promotion_request.json "
                "--approval-decision runs/candidate_approval_decision.json "
                "--repository-dir <product-repository> "
                "--workspace-dir <candidate-worktree> "
                "--materialized-source-dir <public-bundle-root> "
                "--open-review-dry-run"
            ),
            "authority_boundary": "operator_only",
        }
    elif git_ok and git_open_review_dry_run:
        stage = "review_dry_run_ready"
        status = "operator_review_required"
        next_handoff = {
            "kind": "git_service_open_review",
            "label": "Approve non-dry-run review creation",
            "status": "operator_review_required",
            "artifact_key": "git_service_execution",
            "artifact_path": f"runs/{GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT}",
            "command_template": (
                "scripts/platform.py git-service execute-promotion "
                "--promotion-request runs/graph_repository_promotion_request.json "
                "--approval-decision runs/candidate_approval_decision.json "
                "--repository-dir <product-repository> "
                "--workspace-dir <candidate-worktree> "
                "--materialized-source-dir <public-bundle-root>"
            ),
            "authority_boundary": "operator_only",
        }
    elif git_ok and review_status is None and promotion_finalization is None:
        stage = "review_status_required"
        status = "ready_for_handoff"
        next_handoff = {
            "kind": "git_service_review_status",
            "label": "Inspect review status before read-model publish",
            "status": "ready",
            "artifact_key": "git_service_execution",
            "artifact_path": f"runs/{GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT}",
            "command_template": "scripts/platform.py graph-repository review-status <open-review-report>",
            "authority_boundary": "operator_only",
        }
    elif review_status_failed or finalization_failed:
        stage = "post_review_failed"
        status = "blocked"
        next_handoff = {
            "kind": "post_review_repair",
            "label": "Repair post-review closure before publishing read model",
            "status": "blocked",
            "artifact_key": "review_status",
            "artifact_path": f"runs/{GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT}",
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
            "artifact_key": "review_status",
            "artifact_path": f"runs/{GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT}",
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
            "artifact_key": "review_status",
            "artifact_path": f"runs/{GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT}",
            "command_template": (
                "scripts/platform.py git-service finalize-promotion "
                "--open-review-report <open-review-report> "
                "--bundle-dir <public-bundle> --output-dir <read-model-dir>"
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
            "artifact_key": "read_model_publication",
            "artifact_path": f"runs/{GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT}",
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


def build_idea_to_spec_workspace(
    *,
    artifacts: dict[str, Any],
    source: dict[str, Any],
) -> dict[str, Any]:
    active_candidate = _artifact_data(artifacts, ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT)
    intake = _artifact_data(artifacts, IDEA_EVENT_STORMING_INTAKE_ARTIFACT)
    candidate_seed = _artifact_data(artifacts, CANDIDATE_SPEC_GRAPH_SEED_ARTIFACT)
    candidate_graph = _artifact_data(artifacts, CANDIDATE_SPEC_GRAPH_ARTIFACT)
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
    materialization = _artifact_data(
        artifacts, CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT
    )
    promotion_gate = _artifact_data(artifacts, IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT)
    candidate_approval = _artifact_data(artifacts, CANDIDATE_APPROVAL_DECISION_ARTIFACT)
    platform_promotion = _artifact_data(
        artifacts, GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT
    )
    git_service_execution = _artifact_data(
        artifacts, GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
    )
    review_status = _artifact_data(
        artifacts, GRAPH_REPOSITORY_REVIEW_STATUS_REPORT_ARTIFACT
    )
    read_model_publication = _artifact_data(
        artifacts, GRAPH_REPOSITORY_PUBLISH_READ_MODEL_REPORT_ARTIFACT
    )
    promotion_finalization = _artifact_data(
        artifacts, GIT_SERVICE_PROMOTION_FINALIZATION_REPORT_ARTIFACT
    )
    statuses = {
        key: _artifact_status(artifacts, filename)
        for filename, key in ARTIFACT_KEYS.items()
    }
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
    status = "ready"
    if core_missing_artifact_count:
        status = "partial" if available_count else "unavailable"
    elif _ontology_seed_blocked(candidate_seed):
        status = "blocked"
    elif promotion_gate is not None and not _readiness(promotion_gate)["ready"]:
        status = "blocked"
    candidate_counts = _candidate_counts(candidate_graph)
    ontology_seed = _ontology_seed(candidate_seed)
    pre_sib_findings = _findings(pre_sib)
    repair_actions = _repair_actions(repair_loop)
    repair_session = _repair_session(repair_session_journal)
    if (
        status != "partial"
        and repair_session_journal is not None
        and (
            not repair_session["readiness_impact"]["ready_for_candidate_approval"]
            or not repair_session["readiness_impact"]["ready_for_platform_promotion"]
        )
    ):
        status = "blocked"
    repair_review = _repair_review_lane(
        repair_session=repair_session_journal,
        clarification_requests=clarification_requests,
        clarification_answers=clarification_answers,
        ontology_decisions=ontology_decisions,
        rerun_input=rerun_input,
        rerun_preview=rerun_preview,
        rerun_materialization=rerun_materialization,
        product_repair_rerun_execution=product_repair_rerun_execution,
        product_repair_rerun_publication=product_repair_rerun_publication,
    )
    materialized_files = _materialized_files(materialization)
    promotion_gate_findings = _findings(promotion_gate)
    promotion_request = _promotion_request(promotion_gate or materialization)
    workflow = _workflow(
        statuses=statuses,
        core_missing_artifact_count=core_missing_artifact_count,
        active_candidate=active_candidate,
        intake=intake,
        candidate_seed=candidate_seed,
        candidate_graph=candidate_graph,
        pre_sib=pre_sib,
        repair_loop=repair_loop,
        repair_session=repair_session_journal,
        materialization=materialization,
        promotion_gate=promotion_gate,
        product_repair_rerun_execution=product_repair_rerun_execution,
        product_repair_rerun_publication=product_repair_rerun_publication,
        candidate_approval=candidate_approval,
        platform_promotion=platform_promotion,
        git_service_execution=git_service_execution,
        review_status=review_status,
        read_model_publication=read_model_publication,
        promotion_finalization=promotion_finalization,
    )
    return {
        "api_version": "v1",
        "artifact_kind": IDEA_TO_SPEC_WORKSPACE_ARTIFACT_KIND,
        "schema_version": 1,
        "generated_at": _now_iso(),
        "read_only": True,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source": source,
        "workspace": _workspace(active_candidate),
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
            "resolved_ontology_gap_count": (
                repair_session["readiness_impact"]["resolved_ontology_gap_count"]
                if repair_session_journal is not None
                else repair_review["rerun_preview"]["candidate_quality_preview"][
                    "resolved_ontology_gap_count"
                ]
            ),
            "unresolved_ontology_gap_count": (
                repair_session["readiness_impact"]["unresolved_ontology_gap_count"]
                if repair_session_journal is not None
                else repair_review["rerun_preview"]["candidate_quality_preview"][
                    "unresolved_ontology_gap_count"
                ]
            ),
            "rerun_removed_gap_count": (
                repair_session["readiness_impact"]["rerun_removed_gap_count"]
                if repair_session_journal is not None
                else len(
                    repair_review["rerun_materialization"]["delta"][
                        "removed_gap_ids"
                    ]
                )
            ),
            "repair_context_required_count": _number(
                _record((repair_loop or {}).get("summary")).get(
                    "context_required_count"
                )
            ),
            "materialized_file_count": _materialized_file_count(materialization),
            "promotion_path_count": len(promotion_request["paths"]),
            "promotion_gate_blocker_count": _finding_count(promotion_gate),
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
            "approval_ready": _candidate_approval_decision(candidate_approval)[
                "ready"
            ],
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
                _record((promotion_gate or {}).get("readiness")).get("next_artifact")
                or _record((materialization or {}).get("readiness")).get(
                    "next_artifact"
                )
                or _record((repair_loop or {}).get("readiness")).get("next_artifact")
            ),
        },
        "workflow": workflow,
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
        "candidate_graph": {
            "available": candidate_graph is not None,
            "active_frame": _active_frame((candidate_graph or {}).get("active_frame")),
            "summary": candidate_counts,
            "pre_sib_readiness": _record(
                (candidate_graph or {}).get("pre_sib_readiness")
            ),
            "nodes": _candidate_nodes(candidate_graph),
        },
        "ontology_seed": ontology_seed,
        "pre_sib": {
            "available": pre_sib is not None,
            "readiness": _readiness(pre_sib),
            "metrics": _record((pre_sib or {}).get("metrics")),
            "findings": pre_sib_findings,
        },
        "repair_loop": {
            "available": repair_loop is not None,
            "readiness": _readiness(repair_loop),
            "summary": _record((repair_loop or {}).get("summary")),
            "metric_delta_projection": _record(
                (repair_loop or {}).get("metric_delta_projection")
            ),
            "actions": repair_actions,
        },
        "repair_session": repair_session,
        "repair_review": repair_review,
        "materialization": {
            "available": materialization is not None,
            "readiness": _readiness(materialization),
            "summary": _record((materialization or {}).get("summary")),
            "materialization_source": _optional_text(
                (materialization or {}).get("materialization_source")
            ),
            "files": materialized_files,
            "promotion_request": _promotion_request(materialization),
        },
        "promotion_gate": {
            "available": promotion_gate is not None,
            "readiness": _readiness(promotion_gate),
            "summary": _record((promotion_gate or {}).get("summary")),
            "metric_snapshot": _record((promotion_gate or {}).get("metric_snapshot")),
            "promotion_request": promotion_request,
            "findings": promotion_gate_findings,
        },
        "controlled_promotion": {
            "available": platform_promotion is not None
            or git_service_execution is not None
            or candidate_approval is not None
            or review_status is not None
            or read_model_publication is not None
            or promotion_finalization is not None,
            "candidate_approval": _candidate_approval_decision(candidate_approval),
            "platform_request": _platform_promotion_request(platform_promotion),
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
