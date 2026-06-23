"""Read-only Idea-to-Spec workspace read model."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

IDEA_TO_SPEC_WORKSPACE_ARTIFACT_KIND = "specspace_idea_to_spec_workspace"
ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT = "active_idea_to_spec_candidate.json"
IDEA_EVENT_STORMING_INTAKE_ARTIFACT = "idea_event_storming_intake.json"
CANDIDATE_SPEC_GRAPH_ARTIFACT = "candidate_spec_graph.json"
PRE_SIB_COHERENCE_REPORT_ARTIFACT = "pre_sib_coherence_report.json"
CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT = "candidate_repair_loop_report.json"
CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT = (
    "candidate_spec_materialization_report.json"
)
IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT = "idea_to_spec_promotion_gate.json"
GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT = "graph_repository_promotion_request.json"
GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT = (
    "git_service_promotion_execution_report.json"
)

CORE_WORKSPACE_RUN_ARTIFACTS: tuple[str, ...] = (
    IDEA_EVENT_STORMING_INTAKE_ARTIFACT,
    CANDIDATE_SPEC_GRAPH_ARTIFACT,
    PRE_SIB_COHERENCE_REPORT_ARTIFACT,
    CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT,
    CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT,
    IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT,
)
PLATFORM_PROMOTION_ARTIFACTS: tuple[str, ...] = (
    GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT,
    GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT,
)
WORKSPACE_RUN_ARTIFACTS: tuple[str, ...] = (
    ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
    *CORE_WORKSPACE_RUN_ARTIFACTS,
    *PLATFORM_PROMOTION_ARTIFACTS,
)

ARTIFACT_KEYS: dict[str, str] = {
    ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT: "active_candidate",
    IDEA_EVENT_STORMING_INTAKE_ARTIFACT: "event_storming_intake",
    CANDIDATE_SPEC_GRAPH_ARTIFACT: "candidate_graph",
    PRE_SIB_COHERENCE_REPORT_ARTIFACT: "pre_sib",
    CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: "repair_loop",
    CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: "materialization",
    IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: "promotion_gate",
    GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT: "platform_promotion_request",
    GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT: "git_service_execution",
}

EXPECTED_ARTIFACT_KINDS: dict[str, str] = {
    ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT: "active_idea_to_spec_candidate",
    IDEA_EVENT_STORMING_INTAKE_ARTIFACT: "idea_event_storming_intake",
    CANDIDATE_SPEC_GRAPH_ARTIFACT: "candidate_spec_graph",
    PRE_SIB_COHERENCE_REPORT_ARTIFACT: "pre_sib_coherence_report",
    CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT: "candidate_repair_loop_report",
    CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT: (
        "candidate_spec_materialization_report"
    ),
    IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT: "idea_to_spec_promotion_gate",
    GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT: (
        "platform_graph_repository_promotion_request"
    ),
    GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT: (
        "platform_git_service_promotion_execution_report"
    ),
}

DISPLAY_LIMITS = {
    "nodes": 40,
    "findings": 40,
    "repair_actions": 40,
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
    if filename == GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT:
        authority_boundary = _record(value.get("authority_boundary"))
        if any(flag is True for flag in authority_boundary.values()):
            return {
                "reason": "invalid_artifact_contract",
                "detail": "git service authority boundary flags must remain false.",
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
    return {
        "available": True,
        "path": path,
        "artifact_kind": _optional_text(data.get("artifact_kind")),
        "schema_version": data.get("schema_version")
        if isinstance(data.get("schema_version"), int)
        else None,
        "proposal_id": _optional_text(data.get("proposal_id")),
        "contract_ref": _optional_text(data.get("contract_ref")),
        "status": _optional_text(
            data.get("status")
            or summary.get("status")
            or readiness.get("review_state")
            or pre_sib_readiness.get("review_state")
        ),
        "summary": summary or None,
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
    candidate_graph: dict[str, Any] | None,
    pre_sib: dict[str, Any] | None,
    repair_loop: dict[str, Any] | None,
    materialization: dict[str, Any] | None,
    promotion_gate: dict[str, Any] | None,
    platform_promotion: dict[str, Any] | None,
    git_service_execution: dict[str, Any] | None,
) -> dict[str, Any]:
    pre_sib_readiness = _readiness(pre_sib)
    repair_readiness = _readiness(repair_loop)
    materialization_readiness = _readiness(materialization)
    promotion_readiness = _readiness(promotion_gate)
    candidate_readiness = _record((candidate_graph or {}).get("pre_sib_readiness"))
    repair_summary = _record((repair_loop or {}).get("summary"))
    context_required_count = _number(repair_summary.get("context_required_count"))
    promotion_blocker_count = _finding_count(promotion_gate)
    platform_ok = (platform_promotion or {}).get("ok") is True
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
    elif promotion_readiness["ready"] and platform_promotion is None:
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
    elif platform_ok and git_service_execution is None:
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
                "--repository-dir <product-repository> "
                "--workspace-dir <candidate-worktree> "
                "--materialized-source-dir <public-bundle-root>"
            ),
            "authority_boundary": "operator_only",
        }
    elif git_ok:
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
    candidate_graph = _artifact_data(artifacts, CANDIDATE_SPEC_GRAPH_ARTIFACT)
    pre_sib = _artifact_data(artifacts, PRE_SIB_COHERENCE_REPORT_ARTIFACT)
    repair_loop = _artifact_data(artifacts, CANDIDATE_REPAIR_LOOP_REPORT_ARTIFACT)
    materialization = _artifact_data(
        artifacts, CANDIDATE_SPEC_MATERIALIZATION_REPORT_ARTIFACT
    )
    promotion_gate = _artifact_data(artifacts, IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT)
    platform_promotion = _artifact_data(
        artifacts, GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT
    )
    git_service_execution = _artifact_data(
        artifacts, GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
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
    elif promotion_gate is not None and not _readiness(promotion_gate)["ready"]:
        status = "blocked"
    candidate_counts = _candidate_counts(candidate_graph)
    pre_sib_findings = _findings(pre_sib)
    repair_actions = _repair_actions(repair_loop)
    materialized_files = _materialized_files(materialization)
    promotion_gate_findings = _findings(promotion_gate)
    promotion_request = _promotion_request(promotion_gate or materialization)
    workflow = _workflow(
        statuses=statuses,
        core_missing_artifact_count=core_missing_artifact_count,
        active_candidate=active_candidate,
        intake=intake,
        candidate_graph=candidate_graph,
        pre_sib=pre_sib,
        repair_loop=repair_loop,
        materialization=materialization,
        promotion_gate=promotion_gate,
        platform_promotion=platform_promotion,
        git_service_execution=git_service_execution,
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
            "pre_sib_finding_count": _finding_count(pre_sib),
            "repair_action_count": _repair_action_count(repair_loop),
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
            or git_service_execution is not None,
            "platform_request": _platform_promotion_request(platform_promotion),
            "git_service_execution": _git_service_execution(git_service_execution),
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
