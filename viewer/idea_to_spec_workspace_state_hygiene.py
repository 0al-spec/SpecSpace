"""Read-only workspace-scoped state hygiene for idea-to-spec workflows."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from viewer import (
    idea_to_spec_candidate_approval_intents,
    idea_to_spec_repair_drafts,
    idea_to_spec_repair_rerun_requests,
)

ARTIFACT_KIND = "specspace_idea_to_spec_workspace_state_hygiene"
SCHEMA_VERSION = 1


def build_hygiene(
    server: Any,
    *,
    workspace_id: str | None,
    workspace_payload: dict[str, Any] | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    payload = workspace_payload or {}
    current = _current_identity(workspace_id=workspace_id, workspace_payload=payload)
    states = [
        _state_status(
            kind="repair_drafts",
            state_status=idea_to_spec_repair_drafts.read_state(server),
            records_key="drafts",
            current=current,
            blocks=["repair_draft_import_preview", "repair_rerun_request"],
            missing_next_action="Save repair drafts for the current repair session.",
            stale_next_action="Replace repair drafts for the current workspace and repair session.",
        ),
        _state_status(
            kind="repair_rerun_request",
            state_status=idea_to_spec_repair_rerun_requests.read_state(server),
            records_key="requests",
            current=current,
            blocks=["repair_rerun_smoke", "repair_rerun_execution"],
            missing_next_action="Request a repair rerun after drafts and import preview are ready.",
            stale_next_action="Replace the rerun request for the current workspace and repair session.",
            active_status="requested",
        ),
        _state_status(
            kind="candidate_approval_intent",
            state_status=idea_to_spec_candidate_approval_intents.read_state(server),
            records_key="intents",
            current=current,
            blocks=["candidate_approval_gate", "candidate_approval_materialization"],
            missing_next_action="Record approval intent after the repaired candidate is approval-ready.",
            stale_next_action="Record a fresh approval intent for the current workspace and repair session.",
            active_status="requested",
        ),
    ]
    states.extend(_artifact_state_statuses(payload, current))
    summary = _summary(states)
    recommended_actions = _recommended_actions(
        states=states,
        current=current,
        workspace_payload=payload,
    )
    summary = {
        **summary,
        "recommended_action_count": len(recommended_actions),
        "enabled_recommended_action_count": sum(
            1 for action in recommended_actions if action.get("enabled") is True
        ),
    }
    return HTTPStatus.OK, {
        "api_version": "v1",
        "artifact_kind": ARTIFACT_KIND,
        "schema_version": SCHEMA_VERSION,
        "workspace_id": current["workspace_id"],
        "candidate_id": current["candidate_id"],
        "repair_session_id": current["repair_session_id"],
        "repair_session_ref": current["repair_session_ref"],
        "summary": summary,
        "states": states,
        "recommended_actions": recommended_actions,
        "authority_boundary": {
            "workspace_state_hygiene_is_authority": False,
            "may_execute_specgraph": False,
            "may_execute_platform": False,
            "may_execute_git_service": False,
            "may_apply_answers": False,
            "may_apply_decisions": False,
            "may_mutate_candidate_artifacts": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
        },
        "action_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_clear_state": False,
            "may_apply_state": False,
            "may_delete_state": False,
        },
    }


def _recommended_actions(
    *,
    states: list[dict[str, Any]],
    current: dict[str, str | None],
    workspace_payload: dict[str, Any],
) -> list[dict[str, Any]]:
    by_kind = {
        _text(state.get("kind")): state
        for state in states
        if _text(state.get("kind"))
    }
    approval_readiness = _record(workspace_payload.get("approval_readiness"))
    approval_ready = (
        approval_readiness.get("ready_for_candidate_approval") is True
        or approval_readiness.get("promotion_review_can_be_requested") is True
    )
    actions: list[dict[str, Any]] = []

    repair_drafts = by_kind.get("repair_drafts", {})
    if _text(repair_drafts.get("status")) != "usable":
        actions.append(
            _recommended_action(
                action_id="workspace_state.save_repair_drafts",
                label="Save repair drafts for the current repair session",
                reason=_state_action_reason(repair_drafts),
                target_state="repair_drafts",
                target_section="idea-to-spec-repair-review",
                current=current,
                enabled=True,
                blockers=[],
                ui_intent="open_repair_draft_editor",
                command_hint=None,
                evidence_refs=_state_evidence_refs(repair_drafts),
            )
        )

    import_preview = by_kind.get("repair_draft_import_preview", {})
    if _text(import_preview.get("status")) != "usable":
        if not current.get("repair_session_id"):
            actions.append(
                _recommended_action(
                    action_id="workspace_state.build_initial_repair_session_journal",
                    label="Build initial repair session journal",
                    reason=(
                        "A durable repair session journal is required before "
                        "SpecGraph can import SpecSpace-owned repair drafts."
                    ),
                    target_state="repair_session_journal",
                    target_section="idea-to-spec-workspace-state-hygiene",
                    current=current,
                    enabled=True,
                    blockers=[],
                    ui_intent="show_specgraph_initial_repair_session_command",
                    command_hint=(
                        "make idea-to-spec-initial-repair-session-journal "
                        f"IDEA_TO_SPEC_REPAIR_SESSION_OUTPUT="
                        f"{current['repair_session_ref'] or 'runs/idea_to_spec_repair_session.json'}"
                    ),
                    evidence_refs=[
                        "runs/active_idea_to_spec_candidate.json",
                        "runs/idea_to_spec_clarification_requests.json",
                        "runs/idea_to_spec_promotion_gate.json",
                    ],
                )
            )
        blockers = _missing_prerequisites(
            by_kind,
            (("repair_drafts", "Save repair drafts first."),),
        )
        if not current.get("repair_session_id"):
            blockers.append("Build repair session journal first.")
        actions.append(
            _recommended_action(
                action_id="workspace_state.rebuild_repair_draft_import_preview",
                label="Rebuild repair draft import preview",
                reason=_state_action_reason(import_preview),
                target_state="repair_draft_import_preview",
                target_section="idea-to-spec-workspace-state-hygiene",
                current=current,
                enabled=not blockers,
                blockers=blockers,
                ui_intent="show_specgraph_import_preview_command",
                command_hint=(
                    "make specspace-repair-draft-import-preview "
                    "SPECSPACE_REPAIR_DRAFT_IMPORT_DRAFTS=<specspace-state/"
                    "idea_to_spec_repair_drafts.json> "
                    f"SPECSPACE_REPAIR_DRAFT_IMPORT_REPAIR_SESSION="
                    f"{current['repair_session_ref'] or '<repair-session>'} "
                    f"SPECSPACE_REPAIR_DRAFT_IMPORT_WORKSPACE_ID="
                    f"{current['workspace_id'] or '<workspace>'}"
                ),
                evidence_refs=_state_evidence_refs(import_preview),
            )
        )

    rerun_request = by_kind.get("repair_rerun_request", {})
    if _text(rerun_request.get("status")) != "usable":
        blockers = _missing_prerequisites(
            by_kind,
            (
                ("repair_drafts", "Save repair drafts first."),
                (
                    "repair_draft_import_preview",
                    "Rebuild repair draft import preview first.",
                ),
            ),
        )
        actions.append(
            _recommended_action(
                action_id="workspace_state.recreate_repair_rerun_request",
                label="Recreate repair rerun request",
                reason=_state_action_reason(rerun_request),
                target_state="repair_rerun_request",
                target_section="idea-to-spec-repair-review",
                current=current,
                enabled=not blockers,
                blockers=blockers,
                ui_intent="create_repair_rerun_request",
                command_hint=None,
                evidence_refs=_state_evidence_refs(rerun_request),
            )
        )

    request_gate = by_kind.get("repair_rerun_request_gate", {})
    if _text(request_gate.get("status")) != "usable":
        blockers = _missing_prerequisites(
            by_kind,
            (
                (
                    "repair_draft_import_preview",
                    "Rebuild repair draft import preview first.",
                ),
                ("repair_rerun_request", "Recreate repair rerun request first."),
            ),
        )
        actions.append(
            _recommended_action(
                action_id="workspace_state.rebuild_repair_rerun_request_gate",
                label="Rebuild repair rerun request gate",
                reason=_state_action_reason(request_gate),
                target_state="repair_rerun_request_gate",
                target_section="idea-to-spec-workspace-state-hygiene",
                current=current,
                enabled=not blockers,
                blockers=blockers,
                ui_intent="show_specgraph_rerun_request_gate_command",
                command_hint=(
                    "make product-workspace-requested-repair-draft-rerun "
                    f"SPECSPACE_REPAIR_RERUN_REQUEST_REPAIR_SESSION="
                    f"{current['repair_session_ref'] or '<repair-session>'} "
                    f"SPECSPACE_REPAIR_RERUN_REQUEST_WORKSPACE_ID="
                    f"{current['workspace_id'] or '<workspace>'}"
                ),
                evidence_refs=_state_evidence_refs(request_gate),
            )
        )

    approval_intent = by_kind.get("candidate_approval_intent", {})
    if _text(approval_intent.get("status")) != "usable":
        blockers = _missing_prerequisites(
            by_kind,
            (
                ("repair_drafts", "Save repair drafts first."),
                (
                    "repair_draft_import_preview",
                    "Rebuild repair draft import preview first.",
                ),
                ("repair_rerun_request", "Recreate repair rerun request first."),
                (
                    "repair_rerun_request_gate",
                    "Rebuild repair rerun request gate first.",
                ),
            ),
        )
        if not approval_ready:
            blockers.append("Candidate is not approval-ready yet.")
        actions.append(
            _recommended_action(
                action_id="workspace_state.recreate_candidate_approval_intent",
                label="Recreate candidate approval intent",
                reason=_state_action_reason(approval_intent),
                target_state="candidate_approval_intent",
                target_section="idea-to-spec-approval-readiness",
                current=current,
                enabled=not blockers,
                blockers=blockers,
                ui_intent="create_candidate_approval_intent",
                command_hint=None,
                evidence_refs=_state_evidence_refs(approval_intent),
            )
        )
    return actions


def _recommended_action(
    *,
    action_id: str,
    label: str,
    reason: str,
    target_state: str,
    target_section: str,
    current: dict[str, str | None],
    enabled: bool,
    blockers: list[str],
    ui_intent: str,
    command_hint: str | None,
    evidence_refs: list[str],
) -> dict[str, Any]:
    return {
        "id": action_id,
        "label": label,
        "reason": reason,
        "target_state": target_state,
        "target_section": target_section,
        "requires_current_repair_session": True,
        "workspace_id": current["workspace_id"],
        "candidate_id": current["candidate_id"],
        "repair_session_id": current["repair_session_id"],
        "repair_session_ref": current["repair_session_ref"],
        "enabled": enabled,
        "blockers": blockers,
        "ui_intent": ui_intent,
        "command_hint": command_hint,
        "evidence_refs": evidence_refs,
        "authority_boundary": _recommended_action_boundary(),
    }


def _recommended_action_boundary() -> dict[str, bool]:
    return {
        "inspect_only": True,
        "operator_intent_only": True,
        "may_execute_specgraph": False,
        "may_execute_platform": False,
        "may_execute_git_service": False,
        "may_apply_answers": False,
        "may_apply_decisions": False,
        "may_mutate_candidate_artifacts": False,
        "may_mutate_canonical_specs": False,
        "may_write_ontology_package": False,
        "may_accept_ontology_terms": False,
        "may_clear_state": False,
        "may_delete_state": False,
        "may_create_branch_or_commit": False,
        "may_open_pull_request": False,
    }


def _state_action_reason(state: dict[str, Any]) -> str:
    status = _text(state.get("status")) or "missing"
    reason = _text(state.get("reason"))
    kind = _text(state.get("kind")) or "workspace state"
    if reason:
        return f"{kind} is {status}: {reason}."
    return f"{kind} is {status}."


def _state_evidence_refs(state: dict[str, Any]) -> list[str]:
    refs = []
    path = _text(state.get("path"))
    current_ref = _text(state.get("current_repair_session_ref"))
    stored_ref = _text(state.get("stored_repair_session_ref"))
    if path:
        refs.append(path)
    if current_ref:
        refs.append(current_ref)
    if stored_ref and stored_ref != current_ref:
        refs.append(stored_ref)
    return refs


def _missing_prerequisites(
    by_kind: dict[str | None, dict[str, Any]],
    prerequisites: tuple[tuple[str, str], ...],
) -> list[str]:
    blockers = []
    for kind, message in prerequisites:
        if _text(by_kind.get(kind, {}).get("status")) != "usable":
            blockers.append(message)
    return blockers


def _current_identity(
    *,
    workspace_id: str | None,
    workspace_payload: dict[str, Any],
) -> dict[str, str | None]:
    workspace = _record(workspace_payload.get("workspace"))
    repair_session = _record(workspace_payload.get("repair_session"))
    artifacts = _record(workspace_payload.get("artifacts"))
    approval_readiness = _record(workspace_payload.get("approval_readiness"))
    approval_source_refs = _record(approval_readiness.get("source_refs"))
    repaired_repair_session = _record(artifacts.get("repaired_repair_session"))
    standard_repair_session = _record(artifacts.get("repair_session"))
    repaired_source_mode = _text(approval_readiness.get("source_mode"))
    repaired_handoff_selected = repaired_source_mode == "repaired_handoff"
    repaired_selected = (
        repaired_source_mode in {"repaired_handoff", "partial_repaired"}
        or repaired_repair_session.get("available") is True
    )
    repair_session_key = (
        "repaired_repair_session" if repaired_selected else "repair_session"
    )
    repair_session_artifact = _record(artifacts.get(repair_session_key))
    session = _record(repair_session_artifact.get("session"))
    if not session:
        session = _record(repair_session.get("session"))
    repair_session_ref = (
        _text(approval_source_refs.get("repair_session"))
        or _text(repair_session_artifact.get("path"))
        or _text(standard_repair_session.get("path"))
    )
    if repair_session_ref is None:
        repair_session_ref = (
            "runs/repaired_idea_to_spec_repair_session.json"
            if repaired_selected
            else "runs/idea_to_spec_repair_session.json"
        )
    selected_workspace = workspace_id or _text(workspace.get("id"))
    return {
        "workspace_id": selected_workspace,
        "candidate_id": _text(session.get("candidate_id")) or selected_workspace,
        "repair_session_id": _text(session.get("session_id")),
        "repair_session_ref": repair_session_ref,
        "source_repair_session_id": _text(
            _record(standard_repair_session.get("session")).get("session_id")
        ),
        "source_repair_session_ref": _text(standard_repair_session.get("path"))
        or "runs/idea_to_spec_repair_session.json",
        "repaired_selected": "true" if repaired_selected else None,
        "repaired_handoff_selected": "true" if repaired_handoff_selected else None,
    }


def _state_status(
    *,
    kind: str,
    state_status: tuple[HTTPStatus, dict[str, Any]],
    records_key: str,
    current: dict[str, str | None],
    blocks: list[str],
    missing_next_action: str,
    stale_next_action: str,
    active_status: str | None = None,
) -> dict[str, Any]:
    status, state = state_status
    base = {
        "kind": kind,
        "artifact_type": "specspace_owned_state",
        "status": "unknown",
        "path": _text(state.get("state_path")) or _text(state.get("path")),
        "stored_workspace_id": None,
        "stored_candidate_id": None,
        "stored_repair_session_id": None,
        "stored_repair_session_ref": None,
        "current_workspace_id": current["workspace_id"],
        "current_candidate_id": current["candidate_id"],
        "current_repair_session_id": current["repair_session_id"],
        "current_repair_session_ref": current["repair_session_ref"],
        "record_count": 0,
        "current_record_count": 0,
        "stale_record_count": 0,
        "blocks": blocks,
        "next_action": missing_next_action,
    }
    if status != HTTPStatus.OK:
        return {
            **base,
            "status": "invalid",
            "reason": _text(state.get("error")) or "state_unreadable",
            "next_action": f"Repair malformed {kind} state before continuing.",
        }
    records = _records(state.get(records_key))
    records_for_current = records
    if active_status is not None:
        records_for_current = [
            item for item in records if _text(item.get("status")) == active_status
        ]
    if not records_for_current:
        return {
            **base,
            "status": "missing",
            "reason": "no_state_records",
            "record_count": len(records),
        }
    current_matches = [
        item for item in records_for_current if _matches_current(item, current)
    ]
    workspace_matches = [
        item
        for item in records_for_current
        if _text(item.get("workspace_id")) == current["workspace_id"]
    ]
    latest = _latest_record(workspace_matches or records_for_current)
    result = {
        **base,
        "path": _text(state.get("state_path")),
        "stored_workspace_id": _text(latest.get("workspace_id")),
        "stored_candidate_id": _text(latest.get("candidate_id")),
        "stored_repair_session_id": _text(latest.get("repair_session_id")),
        "stored_repair_session_ref": _text(latest.get("repair_session_ref")),
        "record_count": len(records),
        "current_record_count": len(current_matches),
        "stale_record_count": len(records_for_current) - len(current_matches),
    }
    if current_matches:
        return {
            **result,
            "status": "usable",
            "reason": "current_workspace_session_state_present",
            "next_action": "Continue with the current idea-to-spec workflow.",
        }
    if _source_repair_state_consumed_by_repaired_handoff(kind, latest, current):
        return {
            **result,
            "status": "usable",
            "reason": "source_repair_state_consumed_by_repaired_handoff",
            "current_record_count": len(workspace_matches) or len(records_for_current),
            "stale_record_count": 0,
            "next_action": "Continue with the repaired idea-to-spec workflow.",
        }
    return {
        **result,
        "status": "stale",
        "reason": _stale_reason(latest, current),
        "next_action": stale_next_action,
    }


def _artifact_state_statuses(
    workspace_payload: dict[str, Any],
    current: dict[str, str | None],
) -> list[dict[str, Any]]:
    artifacts = _record(workspace_payload.get("artifacts"))
    import_preview_artifact = _record(
        artifacts.get("specspace_repair_draft_import_preview")
    )
    if import_preview_artifact.get("available") is not True:
        import_preview_artifact = _import_preview_from_platform_execution(
            _record(artifacts.get("product_repair_draft_import_execution"))
        )
    request_gate_artifact = _request_gate_from_platform_execution(
        _record(artifacts.get("product_repair_rerun_request_gate_execution"))
    )
    if request_gate_artifact.get("available") is not True:
        request_gate_artifact = _record(artifacts.get("specspace_repair_rerun_request_gate"))
    return [
        _artifact_state_status(
            kind="repair_draft_import_preview",
            artifact=import_preview_artifact,
            current=current,
            blocks=["repair_rerun_request"],
            missing_next_action="Run SpecGraph repair draft import preview for the current repair session.",
        ),
        _artifact_state_status(
            kind="repair_rerun_request_gate",
            artifact=request_gate_artifact,
            current=current,
            blocks=["repair_rerun_execution", "repair_rerun_smoke"],
            missing_next_action="Run SpecGraph rerun request gate for the current request.",
        ),
    ]


def _import_preview_from_platform_execution(report: dict[str, Any]) -> dict[str, Any]:
    if report.get("available") is not True:
        return {}
    if report.get("artifact_kind") != "platform_product_repair_draft_import_preview_execution_report":
        return {}
    if report.get("ok") is not True or report.get("dry_run") is True:
        return {}
    boundary = _record(report.get("authority_boundary"))
    for field in (
        "executes_git_commands",
        "opens_pull_requests",
        "merges_pull_requests",
        "writes_ontology_packages",
        "accepts_ontology_terms",
        "mutates_canonical_specs",
        "publishes_private_artifacts",
    ):
        if boundary.get(field) is True:
            return {}
    import_preview = _record(_record(report.get("output_artifacts")).get("import_preview"))
    if import_preview.get("ready") is not True:
        return {}
    repair_session_ref = _text(report.get("repair_session_ref"))
    return {
        "available": True,
        "path": _text(import_preview.get("path")),
        "status": _text(import_preview.get("status")) or "repair_draft_import_preview_ready",
        "artifact_kind": import_preview.get("artifact_kind"),
        "contract_ref": import_preview.get("contract_ref"),
        "summary": {
            "status": _text(import_preview.get("status"))
            or "repair_draft_import_preview_ready",
            "source": "platform_product_repair_draft_import_execution",
        },
        "source_mode": "platform_import_execution",
        "readiness": {
            "ready": True,
            "review_state": _text(import_preview.get("status"))
            or "repair_draft_import_preview_ready",
            "blocked_by": [],
        },
        "source_artifacts": {
            "idea_to_spec_repair_session": repair_session_ref,
        }
        if repair_session_ref
        else {},
    }


def _request_gate_from_platform_execution(report: dict[str, Any]) -> dict[str, Any]:
    if report.get("available") is not True:
        return {}
    if (
        report.get("artifact_kind")
        != "platform_product_repair_rerun_request_gate_execution_report"
    ):
        return {}
    if report.get("ok") is not True or report.get("dry_run") is True:
        return {}
    boundary = _record(report.get("authority_boundary"))
    for field in (
        "executes_git_commands",
        "opens_pull_requests",
        "merges_pull_requests",
        "writes_ontology_packages",
        "accepts_ontology_terms",
        "mutates_canonical_specs",
        "publishes_private_artifacts",
    ):
        if boundary.get(field) is True:
            return {}
    request_gate = _record(_record(report.get("output_artifacts")).get("request_gate"))
    if request_gate.get("ready") is not True:
        return {}
    repair_session_ref = _text(report.get("repair_session_ref"))
    return {
        "available": True,
        "path": _text(request_gate.get("path")),
        "status": _text(request_gate.get("status")) or "ready",
        "artifact_kind": request_gate.get("artifact_kind"),
        "contract_ref": request_gate.get("contract_ref"),
        "summary": {
            "status": _text(request_gate.get("status")) or "ready",
            "source": "platform_product_repair_rerun_request_gate_execution",
        },
        "source_mode": "platform_request_gate_execution",
        "readiness": {
            "ready": True,
            "review_state": _text(request_gate.get("status")) or "ready",
            "blocked_by": [],
        },
        "source_artifacts": {
            "idea_to_spec_repair_session": repair_session_ref,
        }
        if repair_session_ref
        else {},
    }


def _artifact_state_status(
    *,
    kind: str,
    artifact: dict[str, Any],
    current: dict[str, str | None],
    blocks: list[str],
    missing_next_action: str,
) -> dict[str, Any]:
    status = _text(artifact.get("status"))
    available = artifact.get("available") is True
    source_refs = _record(artifact.get("source_artifacts"))
    session_ref = _source_ref_any(
        source_refs,
        (
            "idea_to_spec_repair_session",
            "repair_session",
            "repair_session_journal",
            "repaired_idea_to_spec_repair_session",
        ),
    )
    summary = _record(artifact.get("summary"))
    stored_workspace_id = _text(artifact.get("workspace_id")) or _text(
        summary.get("workspace_id")
    )
    session = _record(artifact.get("session"))
    selected_request = _record(artifact.get("selected_request"))
    stored_candidate_id = (
        _text(artifact.get("candidate_id"))
        or _text(summary.get("candidate_id"))
        or _text(session.get("candidate_id"))
        or _text(selected_request.get("candidate_id"))
    )
    stored_repair_session_id = (
        _text(artifact.get("repair_session_id"))
        or _text(summary.get("repair_session_id"))
        or _text(summary.get("session_id"))
        or _text(session.get("session_id"))
        or _text(selected_request.get("repair_session_id"))
    )
    current_ref = current["repair_session_ref"]
    session_ref = (
        session_ref
        or _text(artifact.get("repair_session_ref"))
        or _text(summary.get("repair_session_ref"))
    )
    base = {
        "kind": kind,
        "artifact_type": "specgraph_handoff_artifact",
        "status": "missing",
        "path": _text(artifact.get("path")),
        "stored_workspace_id": stored_workspace_id,
        "stored_candidate_id": stored_candidate_id,
        "stored_repair_session_id": stored_repair_session_id,
        "stored_repair_session_ref": session_ref,
        "current_workspace_id": current["workspace_id"],
        "current_candidate_id": current["candidate_id"],
        "current_repair_session_id": current["repair_session_id"],
        "current_repair_session_ref": current_ref,
        "record_count": 1 if available else 0,
        "current_record_count": 0,
        "stale_record_count": 0,
        "blocks": blocks,
        "next_action": missing_next_action,
    }
    if not available:
        return {**base, "reason": "artifact_missing"}
    ready_statuses = _ready_statuses_for_artifact(kind)
    if session_ref and current_ref and session_ref != current_ref:
        if artifact.get("source_mode") in {
            "platform_import_execution",
            "platform_request_gate_execution",
        }:
            return {
                **base,
                "status": "usable",
                "reason": f"{artifact.get('source_mode')}_ready",
                "current_record_count": 1,
                "next_action": "Continue with the repair rerun request handoff.",
            }
        if _source_repair_artifact_consumed_by_repaired_handoff(
            kind,
            status=status,
            ready_statuses=ready_statuses,
            session_ref=session_ref,
            stored_workspace_id=stored_workspace_id,
            stored_candidate_id=stored_candidate_id,
            stored_repair_session_id=stored_repair_session_id,
            current=current,
        ):
            return {
                **base,
                "status": "usable",
                "reason": "source_repair_artifact_consumed_by_repaired_handoff",
                "current_record_count": 1,
                "next_action": "Continue with the repaired idea-to-spec workflow.",
            }
        return {
            **base,
            "status": "stale",
            "reason": "repair_session_ref_mismatch",
            "stale_record_count": 1,
            "next_action": f"Rebuild {kind} for the current repair session.",
        }
    if (
        stored_workspace_id
        and current["workspace_id"]
        and stored_workspace_id != current["workspace_id"]
    ):
        return {
            **base,
            "status": "stale",
            "reason": "workspace_id_mismatch",
            "stale_record_count": 1,
            "next_action": f"Rebuild {kind} for the selected workspace.",
        }
    if (
        stored_candidate_id
        and current["candidate_id"]
        and stored_candidate_id != current["candidate_id"]
    ):
        return {
            **base,
            "status": "stale",
            "reason": "candidate_id_mismatch",
            "stale_record_count": 1,
            "next_action": f"Rebuild {kind} for the selected candidate.",
        }
    if (
        stored_repair_session_id
        and current["repair_session_id"]
        and stored_repair_session_id != current["repair_session_id"]
    ):
        return {
            **base,
            "status": "stale",
            "reason": "repair_session_id_mismatch",
            "stale_record_count": 1,
            "next_action": f"Rebuild {kind} for the current repair session.",
        }
    if status not in ready_statuses:
        return {
            **base,
            "status": "invalid",
            "reason": status or "artifact_not_ready",
            "next_action": f"Repair {kind} before using it as a handoff.",
        }
    return {
        **base,
        "status": "usable",
        "reason": "current_workspace_session_artifact_ready",
        "current_record_count": 1,
        "next_action": "Continue with the current idea-to-spec workflow.",
    }


def _ready_statuses_for_artifact(kind: str) -> set[str]:
    if kind == "repair_draft_import_preview":
        return {"repair_draft_import_preview_ready"}
    if kind == "repair_rerun_request_gate":
        return {
            "specspace_repair_rerun_request_ready",
            "specspace_repair_rerun_request_gate_ready",
            "repair_rerun_request_gate_ready",
        }
    return set()


def _summary(states: list[dict[str, Any]]) -> dict[str, Any]:
    counts: dict[str, int] = {"usable": 0, "missing": 0, "stale": 0, "invalid": 0}
    for state in states:
        status = _text(state.get("status")) or "invalid"
        counts[status] = counts.get(status, 0) + 1
    blockers = [
        state
        for state in states
        if _text(state.get("status")) in {"stale", "invalid"}
    ]
    status = "ready" if not blockers else "blocked"
    next_action = "Continue with the current idea-to-spec workflow."
    if blockers:
        next_action = _text(blockers[0].get("next_action")) or "Resolve stale workspace state."
    elif counts.get("missing", 0):
        status = "partial"
        missing = next(
            (state for state in states if _text(state.get("status")) == "missing"),
            {},
        )
        next_action = _text(missing.get("next_action")) or next_action
    return {
        "status": status,
        "usable_state_count": counts.get("usable", 0),
        "missing_state_count": counts.get("missing", 0),
        "stale_state_count": counts.get("stale", 0),
        "invalid_state_count": counts.get("invalid", 0),
        "blocking_state_count": len(blockers),
        "next_action": next_action,
    }


def _matches_current(item: dict[str, Any], current: dict[str, str | None]) -> bool:
    workspace_id = _text(item.get("workspace_id"))
    candidate_id = _text(item.get("candidate_id"))
    repair_session_id = _text(item.get("repair_session_id"))
    repair_session_ref = _text(item.get("repair_session_ref"))
    return (
        workspace_id == current["workspace_id"]
        and (not current["candidate_id"] or candidate_id == current["candidate_id"])
        and (
            not current["repair_session_id"]
            or repair_session_id == current["repair_session_id"]
        )
        and (
            not current["repair_session_ref"]
            or repair_session_ref == current["repair_session_ref"]
        )
    )


def _source_repair_state_consumed_by_repaired_handoff(
    kind: str,
    item: dict[str, Any],
    current: dict[str, str | None],
) -> bool:
    if kind not in {
        "repair_drafts",
        "repair_rerun_request",
    }:
        return False
    if current.get("repaired_handoff_selected") != "true":
        return False
    workspace_id = _text(item.get("workspace_id"))
    candidate_id = _text(item.get("candidate_id"))
    repair_session_id = _text(item.get("repair_session_id"))
    repair_session_ref = _text(item.get("repair_session_ref"))
    return (
        workspace_id == current["workspace_id"]
        and (not current["candidate_id"] or candidate_id == current["candidate_id"])
        and (
            not current.get("source_repair_session_id")
            or not repair_session_id
            or repair_session_id == current.get("source_repair_session_id")
        )
        and (
            not current.get("source_repair_session_ref")
            or repair_session_ref == current.get("source_repair_session_ref")
        )
    )


def _source_repair_artifact_consumed_by_repaired_handoff(
    kind: str,
    *,
    status: str | None,
    ready_statuses: set[str],
    session_ref: str,
    stored_workspace_id: str | None,
    stored_candidate_id: str | None,
    stored_repair_session_id: str | None,
    current: dict[str, str | None],
) -> bool:
    if kind not in {
        "repair_draft_import_preview",
        "repair_rerun_request_gate",
    }:
        return False
    return (
        current.get("repaired_handoff_selected") == "true"
        and status in ready_statuses
        and session_ref == current.get("source_repair_session_ref")
        and (
            not stored_repair_session_id
            or not current.get("source_repair_session_id")
            or stored_repair_session_id == current.get("source_repair_session_id")
        )
        and (
            not stored_workspace_id
            or not current["workspace_id"]
            or stored_workspace_id == current["workspace_id"]
        )
        and (
            not stored_candidate_id
            or not current["candidate_id"]
            or stored_candidate_id == current["candidate_id"]
        )
    )


def _stale_reason(item: dict[str, Any], current: dict[str, str | None]) -> str:
    if _text(item.get("workspace_id")) != current["workspace_id"]:
        return "workspace_id_mismatch"
    if _text(item.get("candidate_id")) != current["candidate_id"]:
        return "candidate_id_mismatch"
    if current["repair_session_id"] and _text(item.get("repair_session_id")) != current["repair_session_id"]:
        return "repair_session_id_mismatch"
    if current["repair_session_ref"] and _text(item.get("repair_session_ref")) != current["repair_session_ref"]:
        return "repair_session_ref_mismatch"
    return "current_session_state_missing"


def _latest_record(records: list[dict[str, Any]]) -> dict[str, Any]:
    if not records:
        return {}
    return max(records, key=lambda item: _text(item.get("updated_at") or item.get("created_at")) or "")


def _source_ref(source_refs: dict[str, Any], key: str) -> str | None:
    value = source_refs.get(key)
    if isinstance(value, str):
        return _text(value)
    if isinstance(value, dict):
        return _text(value.get("source_ref") or value.get("path"))
    return None


def _source_ref_any(source_refs: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        ref = _source_ref(source_refs, key)
        if ref:
            return ref
    return None


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _records(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None
