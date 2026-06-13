"""SpecGraph viewer surface read-model helpers."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

RUN_FILENAME_RE = re.compile(
    r"^(?P<ts>\d{8}T\d{6}Z)-(?P<spec_id>SG-[A-Z]+-\d+)-(?P<hash>[0-9a-f]+)\.json$",
)
JSON_STRING_RE = r'"(?:\\.|[^"\\])*"'
ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FILENAME = "ontology_semantic_review_surface.json"
ONTOLOGY_SEMANTIC_REVIEW_SURFACE_ARTIFACT = f"runs/{ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FILENAME}"
ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT = "`make ontology-imports`"
ONTOLOGY_SEMANTIC_REVIEW_SURFACE_KIND = "ontology_semantic_review_surface"
ONTOLOGY_SEMANTIC_REVIEW_SURFACE_PROPOSAL_ID = "0108"
ONTOLOGY_REVIEW_DASHBOARD_FILENAME = "ontology_review_dashboard.json"
ONTOLOGY_REVIEW_DASHBOARD_ARTIFACT = f"runs/{ONTOLOGY_REVIEW_DASHBOARD_FILENAME}"
ONTOLOGY_REVIEW_DASHBOARD_KIND = "ontology_review_dashboard"
ONTOLOGY_REVIEW_DASHBOARD_PROPOSAL_ID = "0113"
ONTOLOGY_OWNER_DECISION_REVIEW_FILENAME = "ontology_decision_import_preview.json"
ONTOLOGY_OWNER_DECISION_REVIEW_ARTIFACT = f"runs/{ONTOLOGY_OWNER_DECISION_REVIEW_FILENAME}"
ONTOLOGY_OWNER_DECISION_REVIEW_KIND = "ontology_decision_import_preview"
ONTOLOGY_OWNER_DECISION_REVIEW_PROPOSAL_ID = "0115"
ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FALSE_BOUNDARY_FLAGS = (
    "may_execute_prompt_agent",
    "may_write_ontology_package",
    "may_update_ontology_lockfile",
    "may_mutate_canonical_specs",
    "may_mark_candidate_accepted",
)
ONTOLOGY_SEMANTIC_REVIEW_SURFACE_TRUE_BOUNDARY_FLAGS = (
    "for_supervisor_gate_evidence",
    "for_specspace_review_surface",
)
ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FALSE_ACTION_FLAGS = (
    "writes_ontology_package",
    "mutates_canonical_specs",
)
ONTOLOGY_REVIEW_DASHBOARD_TRUE_BOUNDARY_FLAGS = (
    "for_specgraph_review_dashboard",
    "for_specspace_review_dashboard",
)
ONTOLOGY_REVIEW_DASHBOARD_FALSE_BOUNDARY_FLAGS = (
    "may_execute_prompt_agent",
    "may_write_ontology_package",
    "may_update_ontology_lockfile",
    "may_mutate_canonical_specs",
    "may_mark_candidate_accepted",
    "may_import_owner_decision",
    "may_close_semantic_gate",
)
ONTOLOGY_REVIEW_DASHBOARD_FALSE_DRAFT_REQUEST_FLAGS = (
    "writes_ontology_package",
    "updates_ontology_lockfile",
    "mutates_canonical_specs",
    "marks_candidate_accepted",
)
ONTOLOGY_REVIEW_DASHBOARD_STATUSES = {
    "blocked_by_semantic_gate",
    "pending_ontology_owner_decision",
    "review_pending",
    "clear",
    "no_candidates",
}
ONTOLOGY_OWNER_DECISION_REVIEW_TRUE_BOUNDARY_FLAGS = (
    "for_specgraph_decision_import_preview",
    "for_specspace_review_dashboard",
)
ONTOLOGY_OWNER_DECISION_REVIEW_FALSE_BOUNDARY_FLAGS = (
    "may_execute_prompt_agent",
    "may_write_ontology_package",
    "may_update_ontology_lockfile",
    "may_mutate_canonical_specs",
    "may_mark_candidate_accepted",
    "may_apply_preview",
    "may_import_into_specgraph",
    "may_close_semantic_gate",
)
ONTOLOGY_OWNER_DECISION_REVIEW_FALSE_PREVIEW_FLAGS = (
    "imports_into_specgraph",
    "closes_semantic_gate",
    "mutates_canonical_specs",
    "writes_ontology_package",
    "updates_ontology_lockfile",
)
ONTOLOGY_OWNER_DECISION_REVIEW_FALSE_AUTHORITY_FLAGS = (
    "ontology_decision_import_preview_is_authority",
    "prompt_agent_execution_allowed",
    "automatic_import_lock_update",
    "automatic_canonical_node_update",
    "canonical_mutations_allowed",
)
ONTOLOGY_OWNER_DECISION_REVIEW_STATUSES = {
    "blocked_by_semantic_gate",
    "ready_for_operator_review",
    "rejected_by_owner",
    "needs_clarification",
    "unmatched_decision",
    "no_decisions",
}


def runs_dir_from_spec_dir(spec_dir: Path | None) -> Path | None:
    if spec_dir is None:
        return None
    runs = spec_dir.parent.parent / "runs"
    return runs if runs.is_dir() else None


def runs_dir_from_context(spec_dir: Path | None, specgraph_dir: Path | None) -> Path | None:
    runs = runs_dir_from_spec_dir(spec_dir)
    if runs is not None:
        return runs
    if specgraph_dir is None:
        return None
    runs = specgraph_dir / "runs"
    return runs if runs.is_dir() else None


def supervisor_has_flags(specgraph_dir: Path | None, *flags: str) -> bool:
    if specgraph_dir is None:
        return False
    supervisor = specgraph_dir / "tools" / "supervisor.py"
    if not supervisor.exists():
        return False
    try:
        content = supervisor.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False
    return all(flag in content for flag in flags)


def envelope(path: Path, data: Any) -> dict[str, Any]:
    mtime = path.stat().st_mtime
    return {
        "path": str(path),
        "mtime": mtime,
        "mtime_iso": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
        "data": data,
    }


def read_json_artifact(path: Path, *, invalid_message: str) -> tuple[int, dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {"error": invalid_message, "detail": str(exc)}
    return HTTPStatus.OK, envelope(path, data)


def graph_dashboard_path(runs_dir: Path | None) -> Path | None:
    if runs_dir is None:
        return None
    path = runs_dir / "graph_dashboard.json"
    return path if path.exists() else None


def read_graph_dashboard(runs_dir: Path | None) -> tuple[int, dict[str, Any]]:
    path = graph_dashboard_path(runs_dir)
    if path is None:
        return HTTPStatus.NOT_FOUND, {"error": "graph_dashboard.json not found. Run --build-graph-dashboard first."}
    try:
        return HTTPStatus.OK, json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": "graph_dashboard.json is not valid JSON",
            "detail": str(exc),
        }


def read_graph_backlog_projection(spec_dir: Path | None, runs_dir: Path | None) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, {
            "error": "graph_backlog_projection.json not found. Run --build-graph-backlog-projection first."
        }
    path = runs_dir / "graph_backlog_projection.json"
    if not path.exists():
        return HTTPStatus.NOT_FOUND, {
            "error": "graph_backlog_projection.json not found. Run --build-graph-backlog-projection first."
        }
    return read_json_artifact(
        path,
        invalid_message="graph_backlog_projection.json is not valid JSON",
    )


def read_runs_artifact(
    *,
    spec_dir: Path | None,
    runs_dir: Path | None,
    filename: str,
    build_hint: str,
) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, {"error": f"{filename} not found. Run {build_hint} first."}
    path = runs_dir / filename
    if not path.exists():
        return HTTPStatus.NOT_FOUND, {"error": f"{filename} not found. Run {build_hint} first."}
    return read_json_artifact(path, invalid_message=f"{filename} is not valid JSON")


def _ontology_semantic_review_surface_missing_error() -> dict[str, Any]:
    return {
        "error": (
            f"{ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FILENAME} not found. "
            f"Run {ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT} first."
        ),
        "reason": "missing_artifact",
        "artifact": ONTOLOGY_SEMANTIC_REVIEW_SURFACE_ARTIFACT,
        "build_hint": f"{ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT} in SpecGraph",
    }


def _ontology_semantic_review_surface_contract_error(reason: str, detail: str) -> tuple[int, dict[str, Any]]:
    return HTTPStatus.UNPROCESSABLE_ENTITY, {
        "error": "ontology_semantic_review_surface.json violates the SpecSpace read-only consumer contract.",
        "reason": reason,
        "artifact": ONTOLOGY_SEMANTIC_REVIEW_SURFACE_ARTIFACT,
        "detail": detail,
    }


def _ontology_review_dashboard_missing_error() -> dict[str, Any]:
    return {
        "error": (
            f"{ONTOLOGY_REVIEW_DASHBOARD_FILENAME} not found. "
            f"Run {ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT} first."
        ),
        "reason": "missing_artifact",
        "artifact": ONTOLOGY_REVIEW_DASHBOARD_ARTIFACT,
        "build_hint": f"{ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT} in SpecGraph",
    }


def _ontology_review_dashboard_contract_error(reason: str, detail: str) -> tuple[int, dict[str, Any]]:
    return HTTPStatus.UNPROCESSABLE_ENTITY, {
        "error": "ontology_review_dashboard.json violates the SpecSpace read-only consumer contract.",
        "reason": reason,
        "artifact": ONTOLOGY_REVIEW_DASHBOARD_ARTIFACT,
        "detail": detail,
    }


def _ontology_owner_decision_review_missing_error() -> dict[str, Any]:
    return {
        "error": (
            f"{ONTOLOGY_OWNER_DECISION_REVIEW_FILENAME} not found. "
            f"Run {ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT} first."
        ),
        "reason": "missing_artifact",
        "artifact": ONTOLOGY_OWNER_DECISION_REVIEW_ARTIFACT,
        "build_hint": f"{ONTOLOGY_SEMANTIC_REVIEW_SURFACE_BUILD_HINT} in SpecGraph",
    }


def _ontology_owner_decision_review_contract_error(reason: str, detail: str) -> tuple[int, dict[str, Any]]:
    return HTTPStatus.UNPROCESSABLE_ENTITY, {
        "error": "ontology_decision_import_preview.json violates the SpecSpace read-only owner decision contract.",
        "reason": reason,
        "artifact": ONTOLOGY_OWNER_DECISION_REVIEW_ARTIFACT,
        "detail": detail,
    }


def validate_ontology_semantic_review_surface_data(data: Any) -> tuple[int, dict[str, Any] | None]:
    if not isinstance(data, dict):
        return _ontology_semantic_review_surface_contract_error(
            "invalid_json_root",
            "JSON root must be an object.",
        )
    if data.get("artifact_kind") != ONTOLOGY_SEMANTIC_REVIEW_SURFACE_KIND:
        return _ontology_semantic_review_surface_contract_error(
            "wrong_artifact_kind",
            "artifact_kind must be ontology_semantic_review_surface.",
        )
    if data.get("schema_version") != 1:
        return _ontology_semantic_review_surface_contract_error(
            "unsupported_schema_version",
            "schema_version must be 1.",
        )
    if data.get("proposal_id") != ONTOLOGY_SEMANTIC_REVIEW_SURFACE_PROPOSAL_ID:
        return _ontology_semantic_review_surface_contract_error(
            "wrong_proposal_id",
            "proposal_id must be 0108.",
        )
    if data.get("canonical_mutations_allowed") is not False:
        return _ontology_semantic_review_surface_contract_error(
            "authority_expansion",
            "canonical_mutations_allowed must be false.",
        )
    if data.get("tracked_artifacts_written") is not False:
        return _ontology_semantic_review_surface_contract_error(
            "authority_expansion",
            "tracked_artifacts_written must be false.",
        )

    consumer_boundary = data.get("consumer_boundary")
    if not isinstance(consumer_boundary, dict):
        return _ontology_semantic_review_surface_contract_error(
            "missing_consumer_boundary",
            "consumer_boundary must be an object.",
        )
    for flag in ONTOLOGY_SEMANTIC_REVIEW_SURFACE_TRUE_BOUNDARY_FLAGS:
        if consumer_boundary.get(flag) is not True:
            return _ontology_semantic_review_surface_contract_error(
                "consumer_boundary_mismatch",
                f"consumer_boundary.{flag} must be true.",
            )
    for flag in ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FALSE_BOUNDARY_FLAGS:
        if consumer_boundary.get(flag) is not False:
            return _ontology_semantic_review_surface_contract_error(
                "authority_expansion",
                f"consumer_boundary.{flag} must be false.",
            )

    authority_boundary = data.get("authority_boundary")
    if not isinstance(authority_boundary, dict):
        return _ontology_semantic_review_surface_contract_error(
            "missing_authority_boundary",
            "authority_boundary must be an object.",
        )
    if authority_boundary.get("semantic_review_surface_is_authority") is not False:
        return _ontology_semantic_review_surface_contract_error(
            "authority_expansion",
            "authority_boundary.semantic_review_surface_is_authority must be false.",
        )
    review_actions = data.get("review_actions")
    if not isinstance(review_actions, list):
        return _ontology_semantic_review_surface_contract_error(
            "invalid_review_actions",
            "review_actions must be a list.",
        )
    for index, action in enumerate(review_actions):
        if not isinstance(action, dict):
            return _ontology_semantic_review_surface_contract_error(
                "invalid_review_actions",
                f"review_actions[{index}] must be an object.",
            )
        for flag in ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FALSE_ACTION_FLAGS:
            if action.get(flag) is not False:
                return _ontology_semantic_review_surface_contract_error(
                    "authority_expansion",
                    f"review_actions[{index}].{flag} must be false.",
                )
    return HTTPStatus.OK, None


def validate_ontology_semantic_review_surface_envelope(payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    status, error = validate_ontology_semantic_review_surface_data(payload.get("data"))
    if error is not None:
        return status, error
    return HTTPStatus.OK, payload


def read_ontology_semantic_review_surface(
    *,
    spec_dir: Path | None,
    runs_dir: Path | None,
) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, _ontology_semantic_review_surface_missing_error()
    path = runs_dir / ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FILENAME
    if not path.exists():
        return HTTPStatus.NOT_FOUND, _ontology_semantic_review_surface_missing_error()
    status, payload = read_json_artifact(
        path,
        invalid_message=f"{ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FILENAME} is not valid JSON",
    )
    if status != HTTPStatus.OK:
        return status, {
            "reason": "invalid_json",
            "artifact": ONTOLOGY_SEMANTIC_REVIEW_SURFACE_ARTIFACT,
            **payload,
        }
    return validate_ontology_semantic_review_surface_envelope(payload)


def validate_ontology_review_dashboard_data(data: Any) -> tuple[int, dict[str, Any] | None]:
    if not isinstance(data, dict):
        return _ontology_review_dashboard_contract_error(
            "invalid_json_root",
            "JSON root must be an object.",
        )
    if data.get("artifact_kind") != ONTOLOGY_REVIEW_DASHBOARD_KIND:
        return _ontology_review_dashboard_contract_error(
            "wrong_artifact_kind",
            "artifact_kind must be ontology_review_dashboard.",
        )
    if data.get("schema_version") != 1:
        return _ontology_review_dashboard_contract_error(
            "unsupported_schema_version",
            "schema_version must be 1.",
        )
    if data.get("proposal_id") != ONTOLOGY_REVIEW_DASHBOARD_PROPOSAL_ID:
        return _ontology_review_dashboard_contract_error(
            "wrong_proposal_id",
            "proposal_id must be 0113.",
        )
    if data.get("canonical_mutations_allowed") is not False:
        return _ontology_review_dashboard_contract_error(
            "authority_expansion",
            "canonical_mutations_allowed must be false.",
        )
    if data.get("tracked_artifacts_written") is not False:
        return _ontology_review_dashboard_contract_error(
            "authority_expansion",
            "tracked_artifacts_written must be false.",
        )

    status_summary = data.get("status_summary")
    if not isinstance(status_summary, dict):
        return _ontology_review_dashboard_contract_error(
            "invalid_status_summary",
            "status_summary must be an object.",
        )
    if status_summary.get("status") not in ONTOLOGY_REVIEW_DASHBOARD_STATUSES:
        return _ontology_review_dashboard_contract_error(
            "unsupported_status",
            "status_summary.status is not a supported dashboard state.",
        )

    consumer_boundary = data.get("consumer_boundary")
    if not isinstance(consumer_boundary, dict):
        return _ontology_review_dashboard_contract_error(
            "missing_consumer_boundary",
            "consumer_boundary must be an object.",
        )
    for flag in ONTOLOGY_REVIEW_DASHBOARD_TRUE_BOUNDARY_FLAGS:
        if consumer_boundary.get(flag) is not True:
            return _ontology_review_dashboard_contract_error(
                "consumer_boundary_mismatch",
                f"consumer_boundary.{flag} must be true.",
            )
    for flag in ONTOLOGY_REVIEW_DASHBOARD_FALSE_BOUNDARY_FLAGS:
        if consumer_boundary.get(flag) is not False:
            return _ontology_review_dashboard_contract_error(
                "authority_expansion",
                f"consumer_boundary.{flag} must be false.",
            )

    authority_boundary = data.get("authority_boundary")
    if not isinstance(authority_boundary, dict):
        return _ontology_review_dashboard_contract_error(
            "missing_authority_boundary",
            "authority_boundary must be an object.",
        )
    if authority_boundary.get("ontology_review_dashboard_is_authority") is not False:
        return _ontology_review_dashboard_contract_error(
            "authority_expansion",
            "authority_boundary.ontology_review_dashboard_is_authority must be false.",
        )

    for field in (
        "blocking_items",
        "review_required_items",
        "delta_candidates",
        "draft_requests",
        "closed_loop_entries",
        "review_actions",
    ):
        if not isinstance(data.get(field), list):
            return _ontology_review_dashboard_contract_error(
                f"invalid_{field}",
                f"{field} must be a list.",
            )

    if status_summary.get("draft_request_count") != len(data["draft_requests"]):
        return _ontology_review_dashboard_contract_error(
            "stale_status_summary",
            "status_summary.draft_request_count must match draft_requests length.",
        )
    if status_summary.get("evidence_entry_count") != len(data["closed_loop_entries"]):
        return _ontology_review_dashboard_contract_error(
            "stale_status_summary",
            "status_summary.evidence_entry_count must match closed_loop_entries length.",
        )
    for index, request in enumerate(data["draft_requests"]):
        if not isinstance(request, dict):
            return _ontology_review_dashboard_contract_error(
                "invalid_draft_requests",
                f"draft_requests[{index}] must be an object.",
            )
        for flag in ONTOLOGY_REVIEW_DASHBOARD_FALSE_DRAFT_REQUEST_FLAGS:
            if request.get(flag) is not False:
                return _ontology_review_dashboard_contract_error(
                    "authority_expansion",
                    f"draft_requests[{index}].{flag} must be false.",
                )

    for index, action in enumerate(data["review_actions"]):
        if not isinstance(action, dict):
            return _ontology_review_dashboard_contract_error(
                "invalid_review_actions",
                f"review_actions[{index}] must be an object.",
            )
        for flag in ONTOLOGY_SEMANTIC_REVIEW_SURFACE_FALSE_ACTION_FLAGS:
            if action.get(flag) is not False:
                return _ontology_review_dashboard_contract_error(
                    "authority_expansion",
                    f"review_actions[{index}].{flag} must be false.",
                )
    for index, entry in enumerate(data["closed_loop_entries"]):
        if not isinstance(entry, dict):
            return _ontology_review_dashboard_contract_error(
                "invalid_closed_loop_entries",
                f"closed_loop_entries[{index}] must be an object.",
            )
        for flag in ("accepted_ontology_delta", "closes_semantic_gate", "mutates_canonical_specs"):
            if entry.get(flag) is not False:
                return _ontology_review_dashboard_contract_error(
                    "authority_expansion",
                    f"closed_loop_entries[{index}].{flag} must be false.",
                )
    return HTTPStatus.OK, None


def validate_ontology_review_dashboard_envelope(payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    status, error = validate_ontology_review_dashboard_data(payload.get("data"))
    if error is not None:
        return status, error
    return HTTPStatus.OK, payload


def read_ontology_review_dashboard(
    *,
    spec_dir: Path | None,
    runs_dir: Path | None,
) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, _ontology_review_dashboard_missing_error()
    path = runs_dir / ONTOLOGY_REVIEW_DASHBOARD_FILENAME
    if not path.exists():
        return HTTPStatus.NOT_FOUND, _ontology_review_dashboard_missing_error()
    status, payload = read_json_artifact(
        path,
        invalid_message=f"{ONTOLOGY_REVIEW_DASHBOARD_FILENAME} is not valid JSON",
    )
    if status != HTTPStatus.OK:
        return status, {
            "reason": "invalid_json",
            "artifact": ONTOLOGY_REVIEW_DASHBOARD_ARTIFACT,
            **payload,
        }
    return validate_ontology_review_dashboard_envelope(payload)


def validate_ontology_owner_decision_review_data(data: Any) -> tuple[int, dict[str, Any] | None]:
    if not isinstance(data, dict):
        return _ontology_owner_decision_review_contract_error(
            "invalid_json_root",
            "JSON root must be an object.",
        )
    if data.get("artifact_kind") != ONTOLOGY_OWNER_DECISION_REVIEW_KIND:
        return _ontology_owner_decision_review_contract_error(
            "wrong_artifact_kind",
            "artifact_kind must be ontology_decision_import_preview.",
        )
    if data.get("schema_version") != 1:
        return _ontology_owner_decision_review_contract_error(
            "unsupported_schema_version",
            "schema_version must be 1.",
        )
    if data.get("proposal_id") != ONTOLOGY_OWNER_DECISION_REVIEW_PROPOSAL_ID:
        return _ontology_owner_decision_review_contract_error(
            "wrong_proposal_id",
            "proposal_id must be 0115.",
        )
    if data.get("canonical_mutations_allowed") is not False:
        return _ontology_owner_decision_review_contract_error(
            "authority_expansion",
            "canonical_mutations_allowed must be false.",
        )
    if data.get("tracked_artifacts_written") is not False:
        return _ontology_owner_decision_review_contract_error(
            "authority_expansion",
            "tracked_artifacts_written must be false.",
        )

    summary = data.get("summary")
    if not isinstance(summary, dict):
        return _ontology_owner_decision_review_contract_error(
            "invalid_summary",
            "summary must be an object.",
        )
    if summary.get("status") not in ONTOLOGY_OWNER_DECISION_REVIEW_STATUSES:
        return _ontology_owner_decision_review_contract_error(
            "unsupported_status",
            "summary.status is not a supported owner decision review state.",
        )

    decision_import_previews = data.get("decision_import_previews")
    if not isinstance(decision_import_previews, list):
        return _ontology_owner_decision_review_contract_error(
            "invalid_decision_import_previews",
            "decision_import_previews must be a list.",
        )
    ignored_owner_decisions = data.get("ignored_owner_decisions", [])
    if not isinstance(ignored_owner_decisions, list):
        return _ontology_owner_decision_review_contract_error(
            "invalid_ignored_owner_decisions",
            "ignored_owner_decisions must be a list.",
        )
    if summary.get("preview_count") != len(decision_import_previews):
        return _ontology_owner_decision_review_contract_error(
            "stale_summary",
            "summary.preview_count must match decision_import_previews length.",
        )
    if summary.get("ignored_decision_count") != len(ignored_owner_decisions):
        return _ontology_owner_decision_review_contract_error(
            "stale_summary",
            "summary.ignored_decision_count must match ignored_owner_decisions length.",
        )
    for index, ignored in enumerate(ignored_owner_decisions):
        if not isinstance(ignored, dict):
            return _ontology_owner_decision_review_contract_error(
                "invalid_ignored_owner_decisions",
                f"ignored_owner_decisions[{index}] must be an object.",
            )
        if not isinstance(ignored.get("decision_id"), str) or not ignored["decision_id"]:
            return _ontology_owner_decision_review_contract_error(
                "invalid_ignored_owner_decisions",
                f"ignored_owner_decisions[{index}].decision_id must be a non-empty string.",
            )

    accepted_count = 0
    rejected_count = 0
    clarification_count = 0
    importable_count = 0
    blocked_count = 0
    unmatched_count = 0
    for index, preview in enumerate(decision_import_previews):
        if not isinstance(preview, dict):
            return _ontology_owner_decision_review_contract_error(
                "invalid_decision_import_previews",
                f"decision_import_previews[{index}] must be an object.",
            )
        for field in (
            "preview_id",
            "decision_id",
            "candidate_id",
            "intake_id",
            "ontology_decision_ref",
            "decided_by",
            "decided_at",
            "required_human_action",
        ):
            if not isinstance(preview.get(field), str) or not preview[field]:
                return _ontology_owner_decision_review_contract_error(
                    "invalid_decision_import_previews",
                    f"decision_import_previews[{index}].{field} must be a non-empty string.",
                )
        decision_state = preview.get("decision_state")
        if decision_state not in {"accepted", "rejected", "needs_clarification"}:
            return _ontology_owner_decision_review_contract_error(
                "unsupported_decision_state",
                f"decision_import_previews[{index}].decision_state must be supported.",
            )
        if decision_state == "accepted":
            accepted_count += 1
        elif decision_state == "rejected":
            rejected_count += 1
        else:
            clarification_count += 1
        preview_state = preview.get("preview_state")
        if preview_state not in ONTOLOGY_OWNER_DECISION_REVIEW_STATUSES - {"no_decisions"}:
            return _ontology_owner_decision_review_contract_error(
                "unsupported_preview_state",
                f"decision_import_previews[{index}].preview_state must be supported.",
            )
        if preview_state == "blocked_by_semantic_gate":
            blocked_count += 1
        elif preview_state == "unmatched_decision":
            unmatched_count += 1
        import_recommended = preview.get("import_recommended")
        if import_recommended is not (preview_state == "ready_for_operator_review"):
            return _ontology_owner_decision_review_contract_error(
                "state_mismatch",
                (
                    f"decision_import_previews[{index}].import_recommended must match "
                    "ready_for_operator_review state."
                ),
            )
        if import_recommended:
            importable_count += 1
        accepted_ontology_delta = preview.get("accepted_ontology_delta")
        if not isinstance(accepted_ontology_delta, bool):
            return _ontology_owner_decision_review_contract_error(
                "invalid_decision_import_previews",
                f"decision_import_previews[{index}].accepted_ontology_delta must be boolean.",
            )
        if preview_state == "ready_for_operator_review":
            if decision_state != "accepted" or accepted_ontology_delta is not True:
                return _ontology_owner_decision_review_contract_error(
                    "state_mismatch",
                    (
                        "decision_import_previews"
                        f"[{index}].ready_for_operator_review requires an accepted decision."
                    ),
                )
            for field in (
                "matched_closed_loop_evidence_id",
                "matched_source_intake_state",
                "matched_evidence_state",
            ):
                if not isinstance(preview.get(field), str) or not preview[field]:
                    return _ontology_owner_decision_review_contract_error(
                        "missing_evidence_link",
                        f"decision_import_previews[{index}].{field} must be a non-empty string.",
                    )
        for flag in ONTOLOGY_OWNER_DECISION_REVIEW_FALSE_PREVIEW_FLAGS:
            if preview.get(flag) is not False:
                return _ontology_owner_decision_review_contract_error(
                    "authority_expansion",
                    f"decision_import_previews[{index}].{flag} must be false.",
                )

    derived_summary_counts = {
        "accepted_count": accepted_count,
        "rejected_count": rejected_count,
        "clarification_count": clarification_count,
        "importable_count": importable_count,
        "blocked_count": blocked_count,
        "unmatched_count": unmatched_count,
    }
    for field, expected in derived_summary_counts.items():
        if summary.get(field) != expected:
            return _ontology_owner_decision_review_contract_error(
                "stale_summary",
                f"summary.{field} must match decision_import_previews.",
            )
    if summary.get("status") == "no_decisions" and any(derived_summary_counts.values()):
        return _ontology_owner_decision_review_contract_error(
            "state_mismatch",
            "summary.status no_decisions requires empty decision previews and decision counters.",
        )

    consumer_boundary = data.get("consumer_boundary")
    if not isinstance(consumer_boundary, dict):
        return _ontology_owner_decision_review_contract_error(
            "missing_consumer_boundary",
            "consumer_boundary must be an object.",
        )
    for flag in ONTOLOGY_OWNER_DECISION_REVIEW_TRUE_BOUNDARY_FLAGS:
        if consumer_boundary.get(flag) is not True:
            return _ontology_owner_decision_review_contract_error(
                "consumer_boundary_mismatch",
                f"consumer_boundary.{flag} must be true.",
            )
    for flag in ONTOLOGY_OWNER_DECISION_REVIEW_FALSE_BOUNDARY_FLAGS:
        if consumer_boundary.get(flag) is not False:
            return _ontology_owner_decision_review_contract_error(
                "authority_expansion",
                f"consumer_boundary.{flag} must be false.",
            )

    authority_boundary = data.get("authority_boundary")
    if not isinstance(authority_boundary, dict):
        return _ontology_owner_decision_review_contract_error(
            "missing_authority_boundary",
            "authority_boundary must be an object.",
        )
    for flag in ONTOLOGY_OWNER_DECISION_REVIEW_FALSE_AUTHORITY_FLAGS:
        if authority_boundary.get(flag) is not False:
            return _ontology_owner_decision_review_contract_error(
                "authority_expansion",
                f"authority_boundary.{flag} must be false.",
            )
    return HTTPStatus.OK, None


def validate_ontology_owner_decision_review_envelope(payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    status, error = validate_ontology_owner_decision_review_data(payload.get("data"))
    if error is not None:
        return status, error
    return HTTPStatus.OK, payload


def read_ontology_owner_decision_review(
    *,
    spec_dir: Path | None,
    runs_dir: Path | None,
) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, _ontology_owner_decision_review_missing_error()
    path = runs_dir / ONTOLOGY_OWNER_DECISION_REVIEW_FILENAME
    if not path.exists():
        return HTTPStatus.NOT_FOUND, _ontology_owner_decision_review_missing_error()
    status, payload = read_json_artifact(
        path,
        invalid_message=f"{ONTOLOGY_OWNER_DECISION_REVIEW_FILENAME} is not valid JSON",
    )
    if status != HTTPStatus.OK:
        return status, {
            "reason": "invalid_json",
            "artifact": ONTOLOGY_OWNER_DECISION_REVIEW_ARTIFACT,
            **payload,
        }
    return validate_ontology_owner_decision_review_envelope(payload)


def parse_iso_compact(stamp: str) -> str:
    """Convert `20260427T204723Z` to ISO 8601 (`2026-04-27T20:47:23Z`)."""
    return f"{stamp[0:4]}-{stamp[4:6]}-{stamp[6:8]}T{stamp[9:11]}:{stamp[11:13]}:{stamp[13:15]}Z"


def harvest_run_meta(path: Path) -> dict[str, Any]:
    """Read the head of a run file and extract cheap summary fields."""
    head_bytes = 4096
    try:
        with path.open("rb") as fh:
            head = fh.read(head_bytes).decode("utf-8", errors="ignore")
    except OSError:
        return {}

    out: dict[str, Any] = {}
    for key in ("title", "run_kind", "completion_status", "execution_profile", "child_model"):
        match = re.search(rf'"{re.escape(key)}"\s*:\s*(?P<value>{JSON_STRING_RE})', head)
        if match:
            try:
                out[key] = json.loads(match.group("value"))
            except json.JSONDecodeError:
                pass
    match = re.search(r'"run_duration_sec"\s*:\s*([0-9.]+)', head)
    if match:
        try:
            out["duration_sec"] = float(match.group(1))
        except ValueError:
            pass
    return out


def collect_recent_runs(runs_dir: Path, *, limit: int, since_iso: str | None) -> dict[str, Any]:
    candidates: list[tuple[str, str, str, Path]] = []
    for entry in runs_dir.iterdir():
        if not entry.is_file() or entry.suffix != ".json":
            continue
        match = RUN_FILENAME_RE.match(entry.name)
        if not match:
            continue
        ts_iso = parse_iso_compact(match.group("ts"))
        if since_iso is not None and ts_iso <= since_iso:
            continue
        candidates.append((ts_iso, entry.stem, match.group("spec_id"), entry))

    candidates.sort(key=lambda candidate: (candidate[0], candidate[1]), reverse=True)

    events: list[dict[str, Any]] = []
    for ts_iso, run_id, spec_id, entry in candidates[:limit]:
        meta = harvest_run_meta(entry)
        events.append({
            "run_id": run_id,
            "ts": ts_iso,
            "spec_id": spec_id,
            "title": meta.get("title"),
            "run_kind": meta.get("run_kind"),
            "completion_status": meta.get("completion_status"),
            "duration_sec": meta.get("duration_sec"),
            "execution_profile": meta.get("execution_profile"),
            "child_model": meta.get("child_model"),
        })

    return {"events": events, "total": len(events)}


def read_spec_activity(
    *,
    spec_dir: Path | None,
    runs_dir: Path | None,
    limit_raw: str | None,
    since_raw: str | None,
) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, {
            "error": "spec_activity_feed.json not found. Run `make spec-activity` in SpecGraph first."
        }
    path = runs_dir / "spec_activity_feed.json"
    if not path.exists():
        return HTTPStatus.NOT_FOUND, {
            "error": "spec_activity_feed.json not found. Run `make spec-activity` in SpecGraph first."
        }
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": "spec_activity_feed.json is not valid JSON",
            "detail": str(exc),
        }

    try:
        limit: int | None = int(limit_raw) if limit_raw is not None else None
    except (TypeError, ValueError):
        limit = 50
    if limit is not None:
        limit = max(1, min(limit, 1000))
    since_iso = since_raw if isinstance(since_raw, str) and since_raw else None

    if (limit is not None or since_iso is not None) and isinstance(data, dict):
        entries = data.get("entries") or []
        if isinstance(entries, list):
            if since_iso is not None:
                entries = [
                    entry
                    for entry in entries
                    if isinstance(entry, dict)
                    and isinstance(entry.get("occurred_at"), str)
                    and entry["occurred_at"] > since_iso
                ]
            if limit is not None:
                entries = entries[:limit]
            data = {**data, "entries": entries, "entry_count": len(entries)}

    return HTTPStatus.OK, envelope(path, data)


def read_implementation_work_index(
    *,
    spec_dir: Path | None,
    runs_dir: Path | None,
    limit_raw: str | None,
) -> tuple[int, dict[str, Any]]:
    artifact_path = "runs/implementation_work_index.json"
    missing_error = {
        "error": "implementation_work_index.json not found. Run `make viewer-surfaces` in SpecGraph first.",
        "reason": "missing_artifact",
        "artifact": artifact_path,
        "build_hint": "`make viewer-surfaces` in SpecGraph",
    }
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, missing_error
    path = runs_dir / "implementation_work_index.json"
    if not path.exists():
        return HTTPStatus.NOT_FOUND, missing_error
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": "implementation_work_index.json is not valid JSON",
            "reason": "invalid_json",
            "artifact": artifact_path,
            "detail": str(exc),
        }

    try:
        limit: int | None = int(limit_raw) if limit_raw is not None else 50
    except (TypeError, ValueError):
        limit = 50
    if limit is not None:
        limit = max(1, min(limit, 1000))

    if limit is not None and isinstance(data, dict):
        entries = data.get("entries") or []
        if isinstance(entries, list):
            entries = entries[:limit]
            data = {**data, "entries": entries, "entry_count": len(entries)}

    return HTTPStatus.OK, envelope(path, data)


def read_optional_overlay(path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not path.exists():
        return None, None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return None, {
            "error": f"{path.name} is not valid JSON",
            "detail": str(exc),
            "path": str(path),
        }
    if not isinstance(data, dict):
        return None, {
            "error": f"{path.name} must contain a JSON object",
            "path": str(path),
        }
    return data, None


def collect_spec_overlay(runs_dir: Path) -> tuple[int, dict[str, Any]]:
    out: dict[str, Any] = {}

    health_path = runs_dir / "graph_health_overlay.json"
    data, error = read_optional_overlay(health_path)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    if data is not None:
        projection = data.get("viewer_projection", {})
        named_filters = projection.get("named_filters", {})
        spec_filters: dict[str, list[str]] = {}
        for filter_name, spec_ids in named_filters.items():
            if not isinstance(spec_ids, list):
                continue
            for spec_id in spec_ids:
                spec_filters.setdefault(spec_id, []).append(filter_name)
        for entry in data.get("entries", []):
            spec_id = entry.get("spec_id")
            if not spec_id:
                continue
            out.setdefault(spec_id, {})["health"] = {
                "gate_state": entry.get("gate_state", "none"),
                "signals": entry.get("signals", []),
                "recommended_actions": entry.get("recommended_actions", []),
                "filters": spec_filters.get(spec_id, []),
            }

    trace_path = runs_dir / "spec_trace_projection.json"
    data, error = read_optional_overlay(trace_path)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    if data is not None:
        projection = data.get("viewer_projection", {})
        for state_map_key in ("implementation_state", "freshness", "acceptance_coverage"):
            state_map = projection.get(state_map_key, {})
            for state, spec_ids in state_map.items():
                if not isinstance(spec_ids, list):
                    continue
                for spec_id in spec_ids:
                    node = out.setdefault(spec_id, {}).setdefault("implementation", {})
                    node[state_map_key] = state
        named_filters = projection.get("named_filters", {})
        implementation_filters: dict[str, list[str]] = {}
        for filter_name, spec_ids in named_filters.items():
            if not isinstance(spec_ids, list):
                continue
            for spec_id in spec_ids:
                implementation_filters.setdefault(spec_id, []).append(filter_name)
        for spec_id, filters in implementation_filters.items():
            out.setdefault(spec_id, {}).setdefault("implementation", {})["filters"] = filters

    evidence_path = runs_dir / "evidence_plane_overlay.json"
    data, error = read_optional_overlay(evidence_path)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    if data is not None:
        projection = data.get("viewer_projection", {})
        for state_map_key in (
            "chain_status",
            "artifact_stage",
            "observation_coverage",
            "outcome_coverage",
            "adoption_coverage",
        ):
            state_map = projection.get(state_map_key, {})
            for state, spec_ids in state_map.items():
                if not isinstance(spec_ids, list):
                    continue
                for spec_id in spec_ids:
                    node = out.setdefault(spec_id, {}).setdefault("evidence", {})
                    node[state_map_key] = state
        named_filters = projection.get("named_filters", {})
        evidence_filters: dict[str, list[str]] = {}
        for filter_name, spec_ids in named_filters.items():
            if not isinstance(spec_ids, list):
                continue
            for spec_id in spec_ids:
                evidence_filters.setdefault(spec_id, []).append(filter_name)
        for spec_id, filters in evidence_filters.items():
            out.setdefault(spec_id, {}).setdefault("evidence", {})["filters"] = filters

    return HTTPStatus.OK, {"overlays": out}
