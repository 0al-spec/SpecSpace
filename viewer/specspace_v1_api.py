"""SpecSpace API v1 handlers."""

from __future__ import annotations

from http import HTTPStatus
from typing import Any, Protocol
from urllib.parse import unquote

from viewer import spec_compile, specspace_provider
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


def _provider(handler: SpecSpaceV1Handler) -> specspace_provider.SpecSpaceProvider:
    return specspace_provider.provider_from_server(handler.server)


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


def handle_v1_spec_graph(handler: SpecSpaceV1Handler) -> None:
    status, payload = _provider(handler).read_spec_graph()
    json_response(handler, status, payload)


def handle_v1_spec_node(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    prefix = "/api/v1/spec-nodes/"
    node_id = unquote(parsed.path[len(prefix):]).strip()
    if not node_id:
        json_response(handler, HTTPStatus.BAD_REQUEST, {"error": "Missing spec node id in path."})
        return
    status, payload = _provider(handler).read_spec_node(node_id)
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
    status, payload = _provider(handler).read_spec_markdown(root_id, options)
    if status == HTTPStatus.OK:
        payload["scope"] = scope
        if isinstance(payload.get("manifest"), dict):
            payload["manifest"]["scope"] = scope
    json_response(handler, status, payload)


def handle_v1_spec_markdown_compile(handler: SpecSpaceV1Handler) -> None:
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

    status, response = _provider(handler).compile_spec_markdown(handler, root_id, options, scope=scope)
    json_response(handler, status, response)


def handle_v1_recent_runs(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    status, payload = _provider(handler).read_recent_runs(
        limit=_query_limit(parsed, default=50, maximum=500),
        since_iso=query_value(params, "since", None),
    )
    json_response(handler, status, payload)


def handle_v1_spec_activity(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    status, payload = _provider(handler).read_spec_activity(
        limit_raw=query_value(params, "limit", None),
        since_raw=query_value(params, "since", None),
    )
    json_response(handler, status, payload)


def handle_v1_implementation_work_index(handler: SpecSpaceV1Handler, parsed: Any) -> None:
    params = query_params(parsed)
    status, payload = _provider(handler).read_implementation_work_index(
        limit_raw=query_value(params, "limit", "50"),
    )
    json_response(handler, status, payload)


def handle_v1_proposal_spec_trace_index(handler: SpecSpaceV1Handler) -> None:
    status, payload = _provider(handler).read_proposal_spec_trace_index()
    json_response(handler, status, payload)


def handle_v1_proposals(handler: SpecSpaceV1Handler) -> None:
    status, payload = _provider(handler).read_proposals()
    json_response(handler, status, payload)


def handle_v1_metrics(handler: SpecSpaceV1Handler) -> None:
    status, payload = _provider(handler).read_metrics()
    json_response(handler, status, payload)


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


def handle_v1_specpm_lifecycle(handler: SpecSpaceV1Handler) -> None:
    status, payload = _provider(handler).read_specpm_lifecycle()
    json_response(handler, status, payload)


def handle_v1_runs_watch(handler: SpecSpaceV1Handler) -> None:
    handler.handle_runs_watch()
