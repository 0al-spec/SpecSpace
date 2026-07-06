"""SpecSpace API v1 handlers."""

from __future__ import annotations

from http import HTTPStatus
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import unquote

from viewer import (
    agent_workbench,
    idea_to_spec_candidate_approval_intents,
    idea_to_spec_intake_clarification_answers,
    idea_to_spec_repair_drafts,
    idea_to_spec_repair_rerun_request_gate_execution,
    idea_to_spec_repair_rerun_execution,
    idea_to_spec_repair_rerun_publication,
    idea_to_spec_repair_rerun_requests,
    idea_to_spec_workspace,
    idea_to_spec_workspace_state_hygiene,
    ontology_acknowledgements,
    product_workspace_initialization_execution,
    product_workspace_creation_requests,
    project_local_ontology_review_decisions,
    real_idea_answer_continuation_execution,
    real_idea_answer_continuation_execution_requests,
    real_idea_entry_requests,
    real_idea_intake_execution,
    real_idea_intake_execution_requests,
    spec_compile,
    specspace_provider,
)
from viewer.http_response import JsonResponseHandler, json_response
from viewer.request_query import query_params, query_value


class SpecSpaceV1Handler(JsonResponseHandler, Protocol):
    server: Any

    def read_json_body(self) -> dict[str, Any] | None: ...

    def _exploration_build_available(self) -> bool: ...

    def _graph_dashboard_path(self) -> Any: ...

    def _runs_dir(self) -> Any: ...

    def _viewer_surfaces_build_available(self) -> bool: ...

    def handle_runs_watch(self) -> None: ...


def _provider(
    handler: SpecSpaceV1Handler,
    workspace_id: str | None = None,
) -> specspace_provider.SpecSpaceProvider:
    return specspace_provider.provider_from_server(handler.server, workspace_id)


def _query_workspace_id(parsed: Any) -> str | None:
    return specspace_provider.normalize_workspace_id(
        query_value(query_params(parsed), "workspace", None)
    )


def _query_provider(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> specspace_provider.SpecSpaceProvider:
    return _provider(handler, _query_workspace_id(parsed))


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _apply_real_idea_entry_projection(
    payload: dict[str, Any],
    entry_projection: dict[str, Any],
) -> None:
    summary = _record(entry_projection.get("summary"))
    active_submitted_count = summary.get("active_submitted_count")
    has_submitted_entry = (
        isinstance(active_submitted_count, int)
        and not isinstance(active_submitted_count, bool)
        and active_submitted_count > 0
    )
    if not has_submitted_entry:
        return
    intake = _record(payload.get("real_idea_intake"))
    if intake.get("status") not in {None, "missing"}:
        return
    source_refs = [
        ref
        for ref in intake.get("source_refs", [])
        if isinstance(ref, str) and ref.strip()
    ]
    source_refs.append("specspace-state://real_idea_entry_requests.json")
    payload["real_idea_intake"] = {
        **intake,
        "available": True,
        "status": "entry_submitted",
        "next_action": (
            "Import the submitted raw idea entry through SpecGraph/Platform intake "
            "handoff."
        ),
        "blockers": [],
        "source_refs": sorted(set(source_refs)),
    }


def _workspace_initialization_path(
    *,
    server: Any,
    workspace_id: str | None,
    creation: dict[str, Any],
) -> dict[str, Any]:
    summary = _record(creation.get("summary"))
    active_request = _record(creation.get("active_request"))
    initialization = _record(creation.get("initialization"))
    execution_request = _record(initialization.get("execution_request"))
    execution = _record(initialization.get("execution"))
    refs = _record(initialization.get("refs"))
    status = "route_only"
    next_safe_action = "Create a workspace request before starting product intake."
    blockers: list[str] = []
    platform_dir = getattr(server, "platform_dir", None)
    managed_execution_available = (
        getattr(server, "platform_execution_enabled", False) is True
        and isinstance(platform_dir, Path)
        and (platform_dir / "scripts" / "platform.py").is_file()
    )

    creation_status = summary.get("status")
    if creation_status in {
        "product_workspace_creation_state_invalid",
        "workspace_creation_blocked",
    }:
        status = "blocked"
        next_safe_action = "Repair workspace creation state before initialization."
        blockers.append(str(creation_status))
    elif initialization.get("initialized") is True:
        status = "initialized"
        next_safe_action = "Start or continue raw idea intake in this workspace."
    elif not active_request:
        status = "route_only"
    elif initialization.get("available") is True and initialization.get("trusted") is False:
        status = "blocked"
        next_safe_action = "Review the untrusted workspace initialization artifacts."
        blockers.append("workspace_initialization_untrusted")
    elif execution.get("available") is True and execution.get("ok") is not True:
        status = "blocked"
        next_safe_action = "Review the failed workspace initialization execution report."
        blockers.append("workspace_initialization_execution_failed")
    elif execution_request.get("available") is True:
        if execution_request.get("trusted") is False:
            status = "blocked"
            next_safe_action = "Review the untrusted workspace initialization request."
            blockers.append("workspace_initialization_request_untrusted")
        elif (
            execution_request.get("ok") is not True
            or execution_request.get("ready_for_managed_execution") is not True
        ):
            status = "blocked"
            next_safe_action = "Review the unready workspace initialization request."
            blockers.append("workspace_initialization_request_not_ready")
        else:
            status = "waiting_for_platform"
            next_safe_action = "Wait for Platform to execute the workspace initialization request."
    else:
        status = "initialization_request_needed"
        next_safe_action = "Request controlled Platform workspace initialization."

    return {
        "available": bool(workspace_id),
        "status": status,
        "workspace_id": workspace_id,
        "display_name": active_request.get("display_name"),
        "initial_idea_present": bool(active_request.get("root_intent_summary_present")),
        "creation_request_ref": "specspace-state://product_workspace_creation_requests.json"
        if active_request
        else None,
        "initialization_request_ref": refs.get("execution_request")
        if execution_request.get("available") is True
        else None,
        "initialization_report_ref": "runs/platform_product_workspace_initialization_execution_report.json"
        if execution.get("available") is True
        else None,
        "next_safe_action": next_safe_action,
        "blockers": blockers,
        "managed_execution_available": managed_execution_available,
        "authority_boundary": {
            "inspect_only": True,
            "acknowledge_only": True,
            "may_execute_platform": False,
            "may_execute_specgraph": False,
            "may_create_workspace": False,
            "may_initialize_workspace": False,
            "may_mutate_canonical_specs": False,
            "may_write_ontology_package": False,
            "may_accept_ontology_terms": False,
            "may_create_branch_or_commit": False,
            "may_open_pull_request": False,
            "may_publish_read_model": False,
        },
    }


def _query_limit(parsed: Any, *, default: int, minimum: int = 1, maximum: int = 500) -> int:
    params = query_params(parsed)
    try:
        value = int(query_value(params, "limit", str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(value, maximum))


def _query_int_required_range(
    params: dict[str, list[str]],
    name: str,
    *,
    default: int,
    minimum: int,
    maximum: int,
) -> tuple[int | None, dict[str, Any] | None]:
    raw = query_value(params, name, None)
    if raw is None:
        return default, None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, {
            "error": f"Invalid query parameter: {name}",
            "parameter": name,
            "detail": f"Expected integer from {minimum} to {maximum}.",
        }
    if value < minimum or value > maximum:
        return None, {
            "error": f"Invalid query parameter: {name}",
            "parameter": name,
            "detail": f"Expected integer from {minimum} to {maximum}.",
        }
    return value, None


def _query_bool_required(
    params: dict[str, list[str]],
    name: str,
    *,
    default: bool,
) -> tuple[bool | None, dict[str, Any] | None]:
    raw = query_value(params, name, None)
    if raw is None:
        return default, None
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True, None
    if value in {"0", "false", "no", "off"}:
        return False, None
    return None, {
        "error": f"Invalid query parameter: {name}",
        "parameter": name,
        "detail": "Expected boolean true/false value.",
    }


def _query_scope_required(params: dict[str, list[str]]) -> tuple[str | None, dict[str, Any] | None]:
    raw = query_value(params, "scope", "subtree")
    value = raw.strip().lower() if raw is not None else "subtree"
    if value in {"node", "subtree"}:
        return value, None
    return None, {
        "error": "Invalid query parameter: scope",
        "parameter": "scope",
        "detail": "Expected one of: node, subtree.",
    }


def _payload_int_required_range(
    payload: dict[str, Any],
    name: str,
    *,
    default: int,
    minimum: int,
    maximum: int,
) -> tuple[int | None, dict[str, Any] | None]:
    raw = payload.get(name, default)
    if isinstance(raw, bool):
        return None, {
            "error": f"Invalid request field: {name}",
            "field": name,
            "detail": f"Expected integer from {minimum} to {maximum}.",
        }
    if isinstance(raw, int):
        value = raw
    elif isinstance(raw, str):
        try:
            value = int(raw)
        except ValueError:
            return None, {
                "error": f"Invalid request field: {name}",
                "field": name,
                "detail": f"Expected integer from {minimum} to {maximum}.",
            }
    else:
        return None, {
            "error": f"Invalid request field: {name}",
            "field": name,
            "detail": f"Expected integer from {minimum} to {maximum}.",
        }
    if value < minimum or value > maximum:
        return None, {
            "error": f"Invalid request field: {name}",
            "field": name,
            "detail": f"Expected integer from {minimum} to {maximum}.",
        }
    return value, None


def _payload_bool_required(
    payload: dict[str, Any],
    name: str,
    *,
    default: bool,
) -> tuple[bool | None, dict[str, Any] | None]:
    raw = payload.get(name, default)
    if isinstance(raw, bool):
        return raw, None
    if isinstance(raw, str):
        value = raw.strip().lower()
        if value in {"1", "true", "yes", "on"}:
            return True, None
        if value in {"0", "false", "no", "off"}:
            return False, None
    return None, {
        "error": f"Invalid request field: {name}",
        "field": name,
        "detail": "Expected boolean true/false value.",
    }


def _payload_scope_required(payload: dict[str, Any]) -> tuple[str | None, dict[str, Any] | None]:
    raw = payload.get("scope", "subtree")
    if not isinstance(raw, str):
        return None, {
            "error": "Invalid request field: scope",
            "field": "scope",
            "detail": "Expected one of: node, subtree.",
        }
    value = raw.strip().lower()
    if value in {"node", "subtree"}:
        return value, None
    return None, {
        "error": "Invalid request field: scope",
        "field": "scope",
        "detail": "Expected one of: node, subtree.",
    }


def _compile_options_from_payload(
    payload: dict[str, Any],
) -> tuple[spec_compile.CompileOptions | None, str | None, dict[str, Any] | None]:
    max_depth, error = _payload_int_required_range(payload, "depth", default=6, minimum=1, maximum=6)
    if error is not None:
        return None, None, error
    assert max_depth is not None

    include_objective, error = _payload_bool_required(payload, "objective", default=True)
    if error is not None:
        return None, None, error
    include_acceptance, error = _payload_bool_required(payload, "acceptance", default=True)
    if error is not None:
        return None, None, error
    include_depends_on_refs, error = _payload_bool_required(payload, "deps", default=True)
    if error is not None:
        return None, None, error
    include_prompt, error = _payload_bool_required(payload, "prompt", default=False)
    if error is not None:
        return None, None, error
    scope, error = _payload_scope_required(payload)
    if error is not None:
        return None, None, error
    assert scope is not None

    return (
        spec_compile.CompileOptions(
            max_depth=max_depth,
            include_objective=bool(include_objective),
            include_acceptance=bool(include_acceptance),
            include_depends_on_refs=bool(include_depends_on_refs),
            include_prompt=bool(include_prompt),
            include_children=scope == "subtree",
        ),
        scope,
        None,
    )


def handle_v1_health(handler: SpecSpaceV1Handler) -> None:
    json_response(
        handler,
        HTTPStatus.OK,
        specspace_provider.health_with_specpm_registry(handler.server, _provider(handler)),
    )


def handle_v1_capabilities(handler: SpecSpaceV1Handler) -> None:
    provider = _provider(handler)
    json_response(handler, HTTPStatus.OK, specspace_provider.versioned_capabilities(handler, provider))


def handle_v1_workspaces(handler: SpecSpaceV1Handler) -> None:
    json_response(handler, HTTPStatus.OK, specspace_provider.workspace_catalog(handler.server))


def handle_v1_spec_graph(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_spec_graph()
    json_response(handler, status, payload)


def handle_v1_spec_node(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    prefix = "/api/v1/spec-nodes/"
    node_id = unquote(parsed.path[len(prefix):]).strip()
    if not node_id:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing spec node id in path."})
        return
    status, payload = _query_provider(handler, parsed).read_spec_node(node_id)
    json_response(handler, status, payload)


def handle_v1_spec_markdown(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    root_id = query_value(params, "root", "").strip()
    if not root_id:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing required query parameter: root"})
        return

    max_depth, error = _query_int_required_range(params, "depth", default=6, minimum=1, maximum=6)
    if error is not None:
        json_response(handler, HTTPStatus.BAD_REQUEST, error)
        return
    assert max_depth is not None

    include_objective, error = _query_bool_required(params, "objective", default=True)
    if error is not None:
        json_response(handler, HTTPStatus.BAD_REQUEST, error)
        return
    include_acceptance, error = _query_bool_required(params, "acceptance", default=True)
    if error is not None:
        json_response(handler, HTTPStatus.BAD_REQUEST, error)
        return
    include_depends_on_refs, error = _query_bool_required(params, "deps", default=True)
    if error is not None:
        json_response(handler, HTTPStatus.BAD_REQUEST, error)
        return
    include_prompt, error = _query_bool_required(params, "prompt", default=False)
    if error is not None:
        json_response(handler, HTTPStatus.BAD_REQUEST, error)
        return
    scope, error = _query_scope_required(params)
    if error is not None:
        json_response(handler, HTTPStatus.BAD_REQUEST, error)
        return
    assert scope is not None

    options = spec_compile.CompileOptions(
        max_depth=max_depth,
        include_objective=bool(include_objective),
        include_acceptance=bool(include_acceptance),
        include_depends_on_refs=bool(include_depends_on_refs),
        include_prompt=bool(include_prompt),
        include_children=scope == "subtree",
    )
    status, payload = _query_provider(handler, parsed).read_spec_markdown(root_id, options)
    if status == HTTPStatus.OK:
        payload["scope"] = scope
        if isinstance(payload.get("manifest"), dict):
            payload["manifest"]["scope"] = scope
    json_response(handler, status, payload)


def handle_v1_spec_markdown_compile(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return

    root_raw = payload.get("root")
    root_id = root_raw.strip() if isinstance(root_raw, str) else ""
    if not root_id:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing required request field: root"})
        return

    options, scope, error = _compile_options_from_payload(payload)
    if error is not None:
        json_response(handler, HTTPStatus.BAD_REQUEST, error)
        return
    assert options is not None and scope is not None

    status, response = _query_provider(handler, parsed).compile_spec_markdown(
        handler,
        root_id,
        options,
        scope=scope,
    )
    json_response(handler, status, response)


def handle_v1_recent_runs(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    status, payload = _query_provider(handler, parsed).read_recent_runs(
        limit=_query_limit(parsed, default=50, maximum=500),
        since_iso=query_value(params, "since", None),
    )
    json_response(handler, status, payload)


def handle_v1_spec_activity(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    status, payload = _query_provider(handler, parsed).read_spec_activity(
        limit_raw=query_value(params, "limit", None),
        since_raw=query_value(params, "since", None),
    )
    json_response(handler, status, payload)


def handle_v1_implementation_work_index(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    status, payload = _query_provider(handler, parsed).read_implementation_work_index(
        limit_raw=query_value(params, "limit", "50"),
    )
    json_response(handler, status, payload)


def handle_v1_proposal_spec_trace_index(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_proposal_spec_trace_index()
    json_response(handler, status, payload)


def handle_v1_proposals(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_proposals()
    json_response(handler, status, payload)


def handle_v1_artifacts(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_artifact_catalog()
    json_response(handler, status, payload)


def handle_v1_artifact_content(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    path = query_value(params, "path", "")
    status, payload = _query_provider(handler, parsed).read_artifact_content(path or "")
    json_response(handler, status, payload)


def handle_v1_practical_ontology(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_practical_ontology()
    json_response(handler, status, payload)


def handle_v1_ontology_workbench(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_ontology_workbench()
    json_response(handler, status, payload)


def handle_v1_idea_to_spec_workspace(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    workspace_id = _query_workspace_id(parsed)
    status, payload = _provider(handler, workspace_id).read_idea_to_spec_workspace()
    if status == HTTPStatus.OK and workspace_id is not None:
        payload["selected_workspace_id"] = workspace_id
    if status == HTTPStatus.OK:
        _, hygiene = idea_to_spec_workspace_state_hygiene.build_hygiene(
            handler.server,
            workspace_id=workspace_id,
            workspace_payload=payload,
        )
        payload["workspace_state_hygiene"] = hygiene
        entry_status, entry_state = real_idea_entry_requests.read_state(
            handler.server,
            workspace_id=workspace_id,
        )
        entry_projection = real_idea_entry_requests.workspace_projection(
            entry_status,
            entry_state,
            workspace_id=workspace_id,
        )
        payload["real_idea_entry"] = entry_projection
        _apply_real_idea_entry_projection(payload, entry_projection)
        if workspace_id is not None:
            creation_status, creation_state = product_workspace_creation_requests.read_state(
                handler.server,
                workspace_id=workspace_id,
            )
            payload["workspace_creation"] = (
                product_workspace_creation_requests.workspace_projection(
                    creation_status,
                    creation_state,
                    workspace_id=workspace_id,
                    initialization=payload.get("workspace_initialization")
                    if isinstance(payload.get("workspace_initialization"), dict)
                    else None,
                    include_root_intent_summary=True,
                )
            )
            payload["workspace_initialization_path"] = _workspace_initialization_path(
                server=handler.server,
                workspace_id=workspace_id,
                creation=payload["workspace_creation"],
            )
        idea_to_spec_workspace.attach_guided_flow(payload)
    json_response(handler, status, payload)


def handle_v1_idea_to_spec_workspace_state_hygiene(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    workspace_id = _query_workspace_id(parsed)
    workspace_status, workspace_payload = (
        _provider(handler, workspace_id).read_idea_to_spec_workspace()
    )
    if workspace_status != HTTPStatus.OK:
        json_response(
            handler,
            workspace_status,
            {
                "error": "Cannot build workspace state hygiene without readable idea-to-spec workspace.",
                "reason": "source_workspace_unavailable",
                "source_status": int(workspace_status),
                "source": workspace_payload,
            },
        )
        return
    status, payload = idea_to_spec_workspace_state_hygiene.build_hygiene(
        handler.server,
        workspace_id=workspace_id,
        workspace_payload=workspace_payload,
    )
    json_response(handler, status, payload)


def handle_v1_idea_to_spec_repair_drafts(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    workspace_id = _query_workspace_id(parsed)
    status, payload = idea_to_spec_repair_drafts.read_state(
        handler.server,
        workspace_id=workspace_id,
    )
    json_response(handler, status, payload)


def handle_v1_idea_to_spec_intake_clarification_answers(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    workspace_id = _query_workspace_id(parsed)
    status, payload = idea_to_spec_intake_clarification_answers.read_state(
        handler.server,
        workspace_id=workspace_id,
    )
    json_response(handler, status, payload)


def handle_v1_real_idea_entry_requests(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    workspace_id = _query_workspace_id(parsed)
    status, payload = real_idea_entry_requests.read_state(
        handler.server,
        workspace_id=workspace_id,
    )
    json_response(handler, status, payload)


def handle_v1_real_idea_intake_execution_requests(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    workspace_id = _query_workspace_id(parsed)
    status, payload = real_idea_intake_execution_requests.read_state(
        handler.server,
        workspace_id=workspace_id,
    )
    json_response(handler, status, payload)


def handle_v1_real_idea_answer_continuation_execution_requests(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    workspace_id = _query_workspace_id(parsed)
    status, payload = real_idea_answer_continuation_execution_requests.read_state(
        handler.server,
        workspace_id=workspace_id,
    )
    json_response(handler, status, payload)


def handle_v1_product_workspace_creation_requests(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    workspace_id = _query_workspace_id(parsed)
    status, payload = product_workspace_creation_requests.read_state(
        handler.server,
        workspace_id=workspace_id,
    )
    json_response(
        handler,
        status,
        product_workspace_creation_requests.workspace_projection(
            status,
            payload,
            workspace_id=workspace_id,
        ),
    )


def handle_v1_idea_to_spec_repair_rerun_requests(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    workspace_id = _query_workspace_id(parsed)
    workspace_payload: dict[str, Any] | None = None
    repair_draft_state: dict[str, Any] | None = None
    if workspace_id is not None:
        workspace_status, workspace_payload_candidate = (
            _provider(handler, workspace_id).read_idea_to_spec_workspace()
        )
        if workspace_status == HTTPStatus.OK:
            workspace_payload = workspace_payload_candidate
        draft_status, draft_payload = idea_to_spec_repair_drafts.read_state(
            handler.server,
            workspace_id=workspace_id,
        )
        if draft_status == HTTPStatus.OK:
            repair_draft_state = draft_payload
    status, payload = idea_to_spec_repair_rerun_requests.read_state(
        handler.server,
        workspace_id=workspace_id,
        workspace_payload=workspace_payload,
        repair_draft_state=repair_draft_state,
    )
    json_response(handler, status, payload)


def handle_v1_project_local_ontology_review_decisions(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    workspace_id = _query_workspace_id(parsed)
    status, payload = project_local_ontology_review_decisions.read_state(
        handler.server,
        workspace_id=workspace_id,
    )
    json_response(handler, status, payload)


def handle_v1_idea_to_spec_repair_draft_post(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Repair draft workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    workspace_status, workspace_payload = (
        _provider(handler, workspace_id).read_idea_to_spec_workspace()
    )
    if workspace_status != HTTPStatus.OK:
        json_response(
            handler,
            workspace_status,
            {
                "error": "Cannot save repair draft without readable idea-to-spec workspace.",
                "reason": "source_workspace_unavailable",
                "source_status": int(workspace_status),
                "source": workspace_payload,
            },
        )
        return
    status, response = idea_to_spec_repair_drafts.save_repair_draft(
        handler.server,
        payload,
        workspace_payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_project_local_ontology_review_decision_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Project-local ontology decision workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    provider = _provider(handler, workspace_id)
    workspace_status, workspace_payload = provider.read_idea_to_spec_workspace()
    if workspace_status != HTTPStatus.OK:
        json_response(
            handler,
            workspace_status,
            {
                "error": "Cannot save project-local ontology decision without readable idea-to-spec workspace.",
                "reason": "source_workspace_unavailable",
                "source_status": int(workspace_status),
                "source": workspace_payload,
            },
        )
        return
    lane_status, lane_payload = provider.read_artifact_content(
        f"runs/{idea_to_spec_workspace.PROJECT_LOCAL_ONTOLOGY_REVIEW_LANE_ARTIFACT}"
    )
    lane_artifact = (
        lane_payload.get("data")
        if lane_status == HTTPStatus.OK and isinstance(lane_payload.get("data"), dict)
        else None
    )
    status, response = project_local_ontology_review_decisions.save_decision(
        handler.server,
        payload,
        workspace_payload,
        workspace_id=workspace_id,
        lane_artifact=lane_artifact,
    )
    json_response(handler, status, response)


def handle_v1_idea_to_spec_intake_clarification_answer_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Intake clarification answer workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    workspace_status, workspace_payload = (
        _provider(handler, workspace_id).read_idea_to_spec_workspace()
    )
    if workspace_status != HTTPStatus.OK:
        json_response(
            handler,
            workspace_status,
            {
                "error": "Cannot save intake clarification answer without readable idea-to-spec workspace.",
                "reason": "source_workspace_unavailable",
                "source_status": int(workspace_status),
                "source": workspace_payload,
            },
        )
        return
    status, response = idea_to_spec_intake_clarification_answers.save_intake_answer(
        handler.server,
        payload,
        workspace_payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_real_idea_entry_request_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Real idea entry workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = real_idea_entry_requests.save_request(
        handler.server,
        payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_real_idea_intake_execution_request_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Real idea intake execution workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = real_idea_intake_execution_requests.save_request(
        handler.server,
        payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_real_idea_answer_continuation_execution_request_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Real idea answer continuation execution workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = real_idea_answer_continuation_execution_requests.save_request(
        handler.server,
        payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_real_idea_answer_continuation_execute_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Real idea answer continuation execution workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = real_idea_answer_continuation_execution.execute_requested_continuation(
        handler.server,
        payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_product_workspace_creation_request_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_product_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Product workspace creation workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = product_workspace_creation_requests.save_request(
        handler.server,
        payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_product_workspace_initialization_execute_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_product_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Workspace initialization execution workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = (
        product_workspace_initialization_execution.execute_requested_initialization(
            handler.server,
            payload,
            workspace_id=workspace_id,
        )
    )
    json_response(handler, status, response)


def handle_v1_real_idea_intake_execute_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_product_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Real idea intake execution workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = real_idea_intake_execution.execute_requested_intake(
        handler.server,
        payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_idea_to_spec_repair_rerun_request_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Repair rerun request workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    workspace_status, workspace_payload = (
        _provider(handler, workspace_id).read_idea_to_spec_workspace()
    )
    if workspace_status != HTTPStatus.OK:
        json_response(
            handler,
            workspace_status,
            {
                "error": "Cannot request repair rerun without readable idea-to-spec workspace.",
                "reason": "source_workspace_unavailable",
                "source_status": int(workspace_status),
                "source": workspace_payload,
            },
        )
        return
    draft_status, draft_state = idea_to_spec_repair_drafts.read_state(
        handler.server,
        workspace_id=workspace_id,
    )
    if draft_status != HTTPStatus.OK:
        json_response(
            handler,
            draft_status,
            {
                "error": "Cannot request repair rerun without readable repair draft state.",
                "reason": "repair_draft_state_unavailable",
                "source_status": int(draft_status),
                "source": draft_state,
            },
        )
        return
    status, response = idea_to_spec_repair_rerun_requests.save_rerun_request(
        handler.server,
        payload,
        workspace_payload,
        draft_state,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_idea_to_spec_repair_rerun_request_gate_execute_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Repair rerun request gate execution workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = (
        idea_to_spec_repair_rerun_request_gate_execution.execute_requested_request_gate(
            handler.server,
            payload,
            workspace_id=workspace_id,
        )
    )
    json_response(handler, status, response)


def handle_v1_idea_to_spec_repair_rerun_execute_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Repair rerun execution workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = idea_to_spec_repair_rerun_execution.execute_requested_rerun(
        handler.server,
        payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_idea_to_spec_repair_rerun_publish_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Repair rerun publication workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    status, response = idea_to_spec_repair_rerun_publication.publish_repair_rerun(
        handler.server,
        payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_idea_to_spec_candidate_approval_intents(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    workspace_id = _query_workspace_id(parsed)
    workspace_payload: dict[str, Any] | None = None
    if workspace_id is not None:
        workspace_status, workspace_payload_candidate = (
            _provider(handler, workspace_id).read_idea_to_spec_workspace()
        )
        if workspace_status == HTTPStatus.OK:
            workspace_payload = workspace_payload_candidate
    status, payload = idea_to_spec_candidate_approval_intents.read_state(
        handler.server,
        workspace_id=workspace_id,
        workspace_payload=workspace_payload,
    )
    json_response(handler, status, payload)


def handle_v1_idea_to_spec_candidate_approval_intent_post(
    handler: SpecSpaceV1Handler,
    parsed: Any,
) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    query_workspace_id = _query_workspace_id(parsed)
    payload_workspace_id = specspace_provider.normalize_workspace_id(
        payload.get("workspace_id")
        if isinstance(payload.get("workspace_id"), str)
        else None
    )
    if query_workspace_id and payload_workspace_id and query_workspace_id != payload_workspace_id:
        json_response(
            handler,
            HTTPStatus.CONFLICT,
            {
                "error": "Candidate approval intent workspace_id does not match selected workspace.",
                "expected": query_workspace_id,
                "actual": payload_workspace_id,
            },
        )
        return
    workspace_id = query_workspace_id or payload_workspace_id
    workspace_status, workspace_payload = (
        _provider(handler, workspace_id).read_idea_to_spec_workspace()
    )
    if workspace_status != HTTPStatus.OK:
        json_response(
            handler,
            workspace_status,
            {
                "error": "Cannot record candidate approval intent without readable idea-to-spec workspace.",
                "reason": "source_workspace_unavailable",
                "source_status": int(workspace_status),
                "source": workspace_payload,
            },
        )
        return
    status, response = idea_to_spec_candidate_approval_intents.save_candidate_approval_intent(
        handler.server,
        payload,
        workspace_payload,
        workspace_id=workspace_id,
    )
    json_response(handler, status, response)


def handle_v1_metrics(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_metrics()
    json_response(handler, status, payload)


def handle_v1_agent_surfaces(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_agent_surfaces()
    json_response(handler, status, payload)


def handle_v1_ontology_semantic_review_surface(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_ontology_semantic_review_surface()
    json_response(handler, status, payload)


def handle_v1_ontology_review_dashboard(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_ontology_review_dashboard()
    json_response(handler, status, payload)


def handle_v1_ontology_owner_decision_review(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_ontology_owner_decision_review()
    json_response(handler, status, payload)


def handle_v1_ontology_compliance_review(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_spec_ontology_validation_report()
    json_response(handler, status, payload)


def handle_v1_ontology_owner_decision_acknowledgements(handler: SpecSpaceV1Handler) -> None:
    status, payload = ontology_acknowledgements.read_state(handler.server)
    json_response(handler, status, payload)


def handle_v1_ontology_owner_decision_acknowledgement_post(handler: SpecSpaceV1Handler) -> None:
    payload = handler.read_json_body()
    if payload is None:
        return
    review_status, review_payload = _provider(handler).read_ontology_owner_decision_review()
    if review_status != HTTPStatus.OK:
        json_response(
            handler,
            review_status,
            {
                "error": "Cannot acknowledge owner decision without readable review artifact.",
                "reason": "source_review_unavailable",
                "source_status": int(review_status),
                "source": review_payload,
            },
        )
        return
    status, response = ontology_acknowledgements.acknowledge_owner_decision(
        handler.server,
        payload,
        review_payload,
    )
    json_response(handler, status, response)


def handle_v1_specpm_registry(handler: SpecSpaceV1Handler) -> None:
    status, payload = specspace_provider.read_specpm_registry_summary(handler.server)
    json_response(handler, status, payload)


def handle_v1_specpm_registry_package(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    prefix = "/api/v1/specpm/registry/packages/"
    suffix = parsed.path[len(prefix):]
    if not suffix:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing SpecPM package id in path."})
        return

    version_prefix = "/versions"
    version_marker = f"{version_prefix}/"
    if suffix.endswith(version_prefix):
        package_id = unquote(suffix[: -len(version_prefix)]).strip()
        if not package_id:
            json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing SpecPM package id in path."})
            return
        json_response(
            handler,
            HTTPStatus.BAD_REQUEST,
            {"error": "SpecPM package id and version are required in path."},
        )
        return

    if version_marker in suffix:
        package_raw, version_raw = suffix.split(version_marker, 1)
        package_id = unquote(package_raw).strip()
        version = unquote(version_raw).strip()
        if not package_id or not version:
            json_response(
                handler,
                HTTPStatus.BAD_REQUEST,
                {"error": "SpecPM package id and version are required in path."},
            )
            return
        status, payload = specspace_provider.read_specpm_registry_package_version(
            handler.server,
            package_id,
            version,
        )
        json_response(handler, status, payload)
        return

    package_id = unquote(suffix).strip()
    if not package_id:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing SpecPM package id in path."})
        return
    status, payload = specspace_provider.read_specpm_registry_package(handler.server, package_id)
    json_response(handler, status, payload)


def handle_v1_specpm_lifecycle(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    status, payload = _query_provider(handler, parsed).read_specpm_lifecycle()
    json_response(handler, status, payload)


def handle_v1_agent_workbench_conversations(handler: SpecSpaceV1Handler) -> None:
    status, payload = agent_workbench.read_agent_conversation_index(handler.server)
    json_response(handler, status, payload)


def handle_v1_agent_workbench_conversation(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    prefix = "/api/v1/agent-workbench/conversations/"
    conversation_id = unquote(parsed.path[len(prefix):]).strip()
    status, payload = agent_workbench.read_agent_conversation(handler.server, conversation_id)
    json_response(handler, status, payload)


def handle_v1_runs_watch(handler: SpecSpaceV1Handler) -> None:
    handler.handle_runs_watch()
