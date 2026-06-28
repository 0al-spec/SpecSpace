"""Read-only Idea Maturity metrics surface for product workspaces."""

from __future__ import annotations

import math
from typing import Any

IDEA_MATURITY_METRICS_REPORT_ARTIFACT = "idea_maturity_metrics_report.json"
IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT = (
    "idea_maturity_metrics_validation_report.json"
)
IDEA_MATURITY_ARTIFACTS: tuple[str, ...] = (
    IDEA_MATURITY_METRICS_REPORT_ARTIFACT,
    IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT,
)

REPORT_ARTIFACT_KIND = "idea_maturity_metrics_report"
VALIDATION_ARTIFACT_KIND = "idea_maturity_metrics_validation_report"
METRIC_PACK_ID = "idea_to_spec_maturity"

DISPLAY_LIMITS = {
    "findings": 12,
    "source_artifacts": 24,
    "validation_reports": 8,
}


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


def _metric_number(value: Any) -> int | float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, float) and value >= 0 and math.isfinite(value):
        return value
    return None


def _safe_json_value(value: Any) -> Any:
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, list):
        return [_safe_json_value(item) for item in value]
    if isinstance(value, dict):
        return {
            key: _safe_json_value(item)
            for key, item in value.items()
            if isinstance(key, str)
        }
    return None


def _safe_record(value: Any) -> dict[str, Any]:
    safe = _safe_json_value(value)
    return safe if isinstance(safe, dict) else {}


def safe_json_record(value: Any) -> dict[str, Any]:
    return _safe_record(value)


def _false_authority_error(
    value: dict[str, Any],
    *,
    subject: str,
) -> dict[str, Any] | None:
    authority_boundary = _record(value.get("authority_boundary"))
    if not authority_boundary:
        return {
            "reason": "invalid_artifact_contract",
            "detail": f"{subject} authority boundary is required.",
            "artifact_kind": _optional_text(value.get("artifact_kind")),
        }
    for key, enabled in authority_boundary.items():
        if enabled is not False:
            return {
                "reason": "invalid_artifact_contract",
                "detail": f"{subject} authority boundary flag {key} must be false.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
    return None


def artifact_contract_error(value: Any, filename: str) -> dict[str, Any] | None:
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
    if filename == IDEA_MATURITY_METRICS_REPORT_ARTIFACT:
        if value.get("artifact_kind") != REPORT_ARTIFACT_KIND:
            return {
                "reason": "invalid_artifact_contract",
                "detail": f"artifact_kind must be {REPORT_ARTIFACT_KIND}.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("metric_pack_id") != METRIC_PACK_ID:
            return {
                "reason": "invalid_artifact_contract",
                "detail": f"metric_pack_id must be {METRIC_PACK_ID}.",
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
        authority_error = _false_authority_error(
            value,
            subject="idea maturity metrics report",
        )
        if authority_error is not None:
            return authority_error
        privacy_boundary = _record(value.get("privacy_boundary"))
        for flag in {
            "raw_prompt_or_operator_text_included",
            "contains_human_operator_identity",
            "join_to_identity_allowed",
        }:
            if privacy_boundary.get(flag) is not False:
                return {
                    "reason": "invalid_artifact_contract",
                    "detail": f"privacy boundary flag {flag} must be false.",
                    "artifact_kind": _optional_text(value.get("artifact_kind")),
                }
        return None
    if filename == IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT:
        if value.get("artifact_kind") != VALIDATION_ARTIFACT_KIND:
            return {
                "reason": "invalid_artifact_contract",
                "detail": f"artifact_kind must be {VALIDATION_ARTIFACT_KIND}.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        if value.get("metric_pack_id") != METRIC_PACK_ID:
            return {
                "reason": "invalid_artifact_contract",
                "detail": f"metric_pack_id must be {METRIC_PACK_ID}.",
                "artifact_kind": _optional_text(value.get("artifact_kind")),
            }
        return _false_authority_error(
            value,
            subject="idea maturity validation report",
        )
    return None


def _finding_rows(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    rows = []
    for item in _records((report or {}).get("findings"))[: DISPLAY_LIMITS["findings"]]:
        finding_id = _text(item.get("finding_id"))
        if not finding_id:
            continue
        rows.append(
            {
                "finding_id": finding_id,
                "severity": _text(item.get("severity"), "unknown"),
                "message": _text(item.get("message"), "No message supplied."),
                "source": _optional_text(item.get("source")),
            }
        )
    return rows


def _group(report: dict[str, Any] | None, group_id: str) -> dict[str, Any]:
    return _safe_record(_record((report or {}).get("groups")).get(group_id))


def _metric_source_value(
    report: dict[str, Any] | None,
    group_id: str,
    key: str,
) -> Any:
    metrics = _record((report or {}).get("metrics"))
    if key in metrics:
        return metrics.get(key)
    return _group(report, group_id).get(key)


def _safe_artifact_ref(value: Any) -> str | None:
    text = _optional_text(value)
    if text is None:
        return None
    normalized = text.replace("\\", "/")
    marker = "/runs/"
    if normalized.startswith("runs/"):
        return normalized
    if marker in normalized:
        return f"runs/{normalized.rsplit(marker, 1)[1]}"
    return None


def _validation_report_rows(
    validation: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    rows = []
    for item in _records((validation or {}).get("reports"))[
        : DISPLAY_LIMITS["validation_reports"]
    ]:
        rows.append(
            {
                "path": _safe_artifact_ref(item.get("path")),
                "status": _text(item.get("status"), "unknown"),
                "diagnostic_count": len(_records(item.get("diagnostics"))),
            }
        )
    return rows


def _validation_ok(validation: dict[str, Any]) -> bool:
    summary = _record(validation.get("summary"))
    if summary.get("status") != "ok":
        return False
    reports = _records(validation.get("reports"))
    return bool(reports) and all(_text(item.get("status")) == "ok" for item in reports)


def _metrics(report: dict[str, Any] | None) -> dict[str, Any]:
    metrics = _record((report or {}).get("metrics"))
    return {
        "candidate_node_count": _number(metrics.get("candidate_node_count")),
        "clarification_question_count": _number(
            _metric_source_value(report, "clarification_load", "clarification_question_count")
        ),
        "review_required_question_count": _number(
            _metric_source_value(report, "clarification_load", "review_required_question_count")
        ),
        "blocking_question_count": _number(
            _metric_source_value(report, "clarification_load", "blocking_question_count")
        ),
        "answered_question_count": _number(
            _metric_source_value(report, "answer_materialization", "answered_question_count")
        ),
        "accepted_answer_count": _number(
            _metric_source_value(report, "answer_materialization", "accepted_answer_count")
        ),
        "deferred_answer_count": _number(
            _metric_source_value(report, "answer_materialization", "deferred_answer_count")
        ),
        "invalid_answer_count": _number(
            _metric_source_value(report, "answer_materialization", "invalid_answer_count")
        ),
        "materialized_answer_count": _number(
            _metric_source_value(report, "answer_materialization", "materialized_answer_count")
        ),
        "unmaterialized_answer_count": _number(
            _metric_source_value(report, "answer_materialization", "unmaterialized_answer_count")
        ),
        "answer_materialization_rate": _metric_number(
            _metric_source_value(report, "answer_materialization", "answer_materialization_rate")
        ),
        "ontology_gap_count_initial": _number(
            _metric_source_value(report, "ontology_grounding", "ontology_gap_count_initial")
        ),
        "ontology_gap_resolved_count": _number(
            _metric_source_value(report, "ontology_grounding", "ontology_gap_resolved_count")
        ),
        "ontology_gap_unresolved_count": _number(
            _metric_source_value(report, "ontology_grounding", "ontology_gap_unresolved_count")
        ),
        "ontology_gap_resolution_rate": _metric_number(
            _metric_source_value(report, "ontology_grounding", "ontology_gap_resolution_rate")
        ),
        "candidate_gap_count_initial": _number(
            _metric_source_value(report, "candidate_repair", "candidate_gap_count_initial")
        ),
        "candidate_gap_resolved_count": _number(
            _metric_source_value(report, "candidate_repair", "candidate_gap_resolved_count")
        ),
        "candidate_gap_unresolved_count": _number(
            _metric_source_value(report, "candidate_repair", "candidate_gap_unresolved_count")
        ),
        "candidate_gap_closure_rate": _metric_number(
            _metric_source_value(report, "candidate_repair", "candidate_gap_closure_rate")
        ),
        "remaining_blocker_count": _number(
            _metric_source_value(report, "candidate_repair", "remaining_blocker_count")
        ),
        "stale_ref_count": _number(
            _metric_source_value(report, "workflow_friction", "stale_ref_count")
        ),
        "failed_gate_count": _number(
            _metric_source_value(report, "workflow_friction", "failed_gate_count")
        ),
        "dry_run_count": _number(
            _metric_source_value(report, "workflow_friction", "dry_run_count")
        ),
        "rerun_count": _number(
            _metric_source_value(report, "workflow_friction", "rerun_count")
        ),
        "rerun_request_count": _number(
            _metric_source_value(report, "workflow_friction", "rerun_request_count")
        ),
        "manual_handoff_count": _number(
            _metric_source_value(report, "workflow_friction", "manual_handoff_count")
        ),
        "operator_command_count": _number(
            _metric_source_value(report, "workflow_friction", "operator_command_count")
        ),
        "promotion_path_count": _number(
            _metric_source_value(report, "promotion_readiness", "promotion_path_count")
        ),
        "published_file_count": _number(
            _metric_source_value(report, "review_publication", "published_file_count")
        ),
        "time_to_first_candidate_seconds": _metric_number(
            _metric_source_value(report, "temporal_progress", "time_to_first_candidate_seconds")
        ),
        "time_to_approval_ready_seconds": _metric_number(
            _metric_source_value(report, "temporal_progress", "time_to_approval_ready_seconds")
        ),
        "time_to_first_materialization_seconds": _metric_number(
            _metric_source_value(
                report,
                "temporal_progress",
                "time_to_first_materialization_seconds",
            )
        ),
        "last_progress_at": _optional_text(
            _metric_source_value(report, "temporal_progress", "last_progress_at")
        ),
        "stalled_phase": _optional_text(
            _metric_source_value(report, "temporal_progress", "stalled_phase")
        ),
    }


def _report_surface(report: dict[str, Any] | None) -> dict[str, Any]:
    candidate = _record((report or {}).get("candidate"))
    derived_state = _record((report or {}).get("derived_state"))
    return {
        "available": report is not None,
        "artifact_kind": _optional_text((report or {}).get("artifact_kind")),
        "generated_at": _optional_text((report or {}).get("generated_at")),
        "status": _optional_text((report or {}).get("status")),
        "proposal_id": _optional_text((report or {}).get("proposal_id")),
        "contract_ref": _optional_text((report or {}).get("contract_ref")),
        "metric_pack_id": _optional_text((report or {}).get("metric_pack_id")),
        "metric_pack_ref": _optional_text((report or {}).get("metric_pack_ref")),
        "metrics_rfc_ref": _optional_text((report or {}).get("metrics_rfc_ref")),
        "authority_state": _optional_text((report or {}).get("authority_state")),
        "candidate": {
            "candidate_id": _optional_text(candidate.get("candidate_id")),
            "workspace_route": _optional_text(candidate.get("workspace_route")),
            "workflow_lane": _optional_text(candidate.get("workflow_lane")),
            "target_repository_role": _optional_text(
                candidate.get("target_repository_role")
            ),
            "governance_profile": _optional_text(candidate.get("governance_profile")),
        },
        "derived_state": {
            "lifecycle_state": _optional_text(derived_state.get("lifecycle_state")),
            "candidate_approval_state": _optional_text(
                derived_state.get("candidate_approval_state")
            ),
            "platform_promotion_state": _optional_text(
                derived_state.get("platform_promotion_state")
            ),
            "review_status": _optional_text(derived_state.get("review_status")),
            "read_model_publication_state": _optional_text(
                derived_state.get("read_model_publication_state")
            ),
            "blockers": _string_list(derived_state.get("blockers")),
        },
        "metrics": _metrics(report),
        "groups": {
            "clarification_load": _group(report, "clarification_load"),
            "answer_materialization": _group(report, "answer_materialization"),
            "ontology_grounding": _group(report, "ontology_grounding"),
            "candidate_repair": _group(report, "candidate_repair"),
            "workflow_friction": _group(report, "workflow_friction"),
            "promotion_readiness": _group(report, "promotion_readiness"),
            "review_publication": _group(report, "review_publication"),
            "temporal_progress": _group(report, "temporal_progress"),
        },
        "summary": _safe_record((report or {}).get("summary")),
        "findings": _finding_rows(report),
        "source_artifacts": _string_list((report or {}).get("source_artifacts"))[
            : DISPLAY_LIMITS["source_artifacts"]
        ],
    }


def _validation_surface(validation: dict[str, Any] | None) -> dict[str, Any]:
    validator = _record((validation or {}).get("validator"))
    return {
        "available": validation is not None,
        "artifact_kind": _optional_text((validation or {}).get("artifact_kind")),
        "generated_at": _optional_text((validation or {}).get("generated_at")),
        "metric_pack_id": _optional_text((validation or {}).get("metric_pack_id")),
        "summary": _safe_record((validation or {}).get("summary")),
        "validator": {
            "id": _optional_text(validator.get("id")),
            "rfc_ref": _optional_text(validator.get("rfc_ref")),
            "schema_ref": _optional_text(validator.get("schema_ref")),
            "script_ref": _optional_text(validator.get("script_ref")),
        },
        "reports": _validation_report_rows(validation),
    }


def build_surface(
    *,
    report: dict[str, Any] | None,
    validation: dict[str, Any] | None,
    report_error: dict[str, Any] | None,
    validation_error: dict[str, Any] | None,
) -> dict[str, Any]:
    report_path = f"runs/{IDEA_MATURITY_METRICS_REPORT_ARTIFACT}"
    validation_path = f"runs/{IDEA_MATURITY_METRICS_VALIDATION_REPORT_ARTIFACT}"
    report_missing = (
        report_error is not None and report_error.get("reason") == "missing_artifact"
    )
    validation_missing = (
        validation_error is not None
        and validation_error.get("reason") == "missing_artifact"
    )
    if report_missing:
        status = "missing"
        trusted = False
    elif report_error is not None:
        status = "invalid"
        trusted = False
    elif validation_missing:
        status = "validation_unavailable"
        trusted = False
    elif validation_error is not None:
        status = "invalid"
        trusted = False
    elif validation is not None and not _validation_ok(validation):
        status = "validation_failed"
        trusted = False
    else:
        status = "available"
        trusted = True
    return {
        "available": report_error is None,
        "status": status,
        "trusted": trusted,
        "report": _report_surface(report if report_error is None else None),
        "validation": _validation_surface(
            validation if validation_error is None else None
        ),
        "source_refs": [report_path, validation_path],
        "report_error": report_error if not report_missing else None,
        "validation_error": (
            validation_error if validation_error is not None and not validation_missing else None
        ),
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_recalculate_metrics": False,
            "may_execute_metrics_validator": False,
            "may_mutate_candidate_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_execute_git_service": False,
            "may_create_branch_or_commit": False,
        },
    }
