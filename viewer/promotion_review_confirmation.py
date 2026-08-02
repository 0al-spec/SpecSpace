"""Authenticated SpecSpace authoring for hosted promotion-review confirmation."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from http import HTTPStatus
import re
from typing import Any
import uuid

from viewer import (
    operator_auth,
    product_workspace_binding,
    specspace_state_backend,
)


CONFIRMATION_KIND = "platform_hosted_promotion_review_confirmation"
CONFIRMATION_CONTRACT_REF = "platform.hosted-promotion-review-confirmation.v1"
CONFIRMATION_OPERATION_ID = "promotion_review_execute"
DRY_RUN_OPERATION_ID = "promotion_execute_dry_run"
CONFIRMATION_TTL_SECONDS = 10 * 60
CONFIRMATION_DIR = "confirmations"
POINTER_FILENAME = "latest.json"
PROMOTION_REQUEST_REF = "runs/graph_repository_promotion_request.json"
APPROVAL_DECISION_REF = "runs/candidate_approval_decision.json"
EXECUTION_PLAN_REF = "runs/graph_repository_execution_plan.json"
BOUND_INPUT_REFS = {
    "promotion_request": PROMOTION_REQUEST_REF,
    "approval_decision": APPROVAL_DECISION_REF,
    "execution_plan": EXECUTION_PLAN_REF,
}
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
CONFIRMATION_ID_RE = re.compile(
    r"^confirmation://([a-z0-9][a-z0-9-]{1,62}[a-z0-9])/"
    r"promotion_review_execute/([0-9a-f]{32})$"
)
DRY_RUN_REQUEST_RE = re.compile(
    r"^managed-operation://([a-z0-9][a-z0-9-]{1,62}[a-z0-9])/"
    r"promotion_execute_dry_run/([0-9a-f]{24})$"
)
# These names mirror platform.hosted-promotion-review-confirmation.v1 exactly;
# the plural ontology-packages field is intentional.
AUTHORITY_BOUNDARY = {
    "confirmation_is_execution_authority": False,
    "may_execute_platform": False,
    "may_mutate_canonical_specs": False,
    "may_write_ontology_packages": False,
    "may_accept_ontology_terms": False,
    "may_create_git_branch": False,
    "may_create_git_commit": False,
    "may_push_candidate_branch": False,
    "may_open_pull_request": False,
    "may_merge_pull_request": False,
    "may_publish_read_model": False,
}
PROJECTION_AUTHORITY_BOUNDARY = {
    "report_only": True,
    "confirmation_authoring_is_execution_authority": False,
    "may_execute_platform": False,
    "may_execute_git_service": False,
    "may_mutate_candidate_artifacts": False,
    "may_mutate_canonical_specs": False,
    "may_write_ontology_package": False,
    "may_accept_ontology_terms": False,
    "may_create_git_branch": False,
    "may_create_git_commit": False,
    "may_push_candidate_branch": False,
    "may_open_pull_request": False,
    "may_merge_pull_request": False,
    "may_publish_read_model": False,
}
POINTER_AUTHORITY_BOUNDARY = {
    "confirmation_pointer_is_execution_authority": False,
    "may_execute_platform": False,
    "may_create_git_branch": False,
    "may_create_git_commit": False,
    "may_push_candidate_branch": False,
    "may_open_pull_request": False,
    "may_merge_pull_request": False,
    "may_publish_read_model": False,
}
CONFIRMATION_FIELDS = frozenset(
    {
        "artifact_kind",
        "schema_version",
        "contract_ref",
        "confirmation_id",
        "workspace_id",
        "operation_id",
        "operator_ref",
        "status",
        "confirmed",
        "issued_at",
        "expires_at",
        "workspace_binding",
        "inputs",
        "predecessor_dry_run",
        "authority_boundary",
    }
)
POINTER_FIELDS = frozenset(
    {
        "artifact_kind",
        "schema_version",
        "workspace_id",
        "operation_id",
        "confirmation_id",
        "confirmation_ref",
        "confirmation_sha256",
        "operator_ref",
        "issued_at",
        "expires_at",
        "predecessor_request_id",
        "authority_boundary",
    }
)


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.endswith("Z"):
        return None
    try:
        parsed = datetime.fromisoformat(value.removesuffix("Z") + "+00:00")
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else None


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _durable_confirmation_state_reasons(server: Any) -> list[str]:
    configured = specspace_state_backend.backend(server)
    if not isinstance(
        configured,
        specspace_state_backend.ExternalHTTPStateBackend,
    ):
        return ["promotion_review_confirmation_external_state_required"]
    try:
        health = configured.health()
    except specspace_state_backend.StateBackendError:
        return ["promotion_review_confirmation_state_unavailable"]
    if health.get("ready") is not True:
        return ["promotion_review_confirmation_state_unavailable"]
    if health.get("restart_persistent") is not True:
        return [
            "promotion_review_confirmation_state_not_restart_persistent"
        ]
    return []


def _pointer_key(workspace_id: str) -> str:
    return (
        f"{CONFIRMATION_DIR}/{workspace_id}/{CONFIRMATION_OPERATION_ID}/"
        f"{POINTER_FILENAME}"
    )


def _confirmation_key(workspace_id: str, identifier: str) -> str:
    return (
        f"{CONFIRMATION_DIR}/{workspace_id}/{CONFIRMATION_OPERATION_ID}/"
        f"{identifier}.json"
    )


def _catalog_input_digests(
    provider: Any,
    binding: dict[str, Any],
) -> tuple[dict[str, str], list[str]]:
    status, catalog = provider.read_artifact_catalog()
    if status != HTTPStatus.OK or not isinstance(catalog, dict):
        return {}, ["promotion_review_input_catalog_unavailable"]
    rows = catalog.get("artifacts")
    if not isinstance(rows, list):
        return {}, ["promotion_review_input_catalog_invalid"]
    digests: dict[str, str] = {}
    reasons: list[str] = []
    for logical_ref in BOUND_INPUT_REFS.values():
        bound_ref = product_workspace_binding.bound_run_ref(binding, logical_ref)
        matching = [
            item
            for item in rows
            if isinstance(item, dict)
            and item.get("path") in {logical_ref, bound_ref}
            and SHA256_RE.fullmatch(_text(item.get("sha256")) or "")
        ]
        unique_digests = {
            str(item["sha256"])
            for item in matching
        }
        if len(unique_digests) != 1:
            reasons.append(
                f"promotion_review_input_digest_unavailable:{logical_ref}"
            )
            continue
        digests[logical_ref] = unique_digests.pop()
    return digests, reasons


def _input_digest_map(value: Any) -> dict[str, str]:
    result: dict[str, str] = {}
    if not isinstance(value, list):
        return result
    for item in value:
        record = _record(item)
        logical_ref = _text(record.get("logical_ref"))
        sha256 = _text(record.get("sha256"))
        if (
            logical_ref in BOUND_INPUT_REFS.values()
            and sha256 is not None
            and SHA256_RE.fullmatch(sha256)
        ):
            result[logical_ref] = sha256
    return result


def _current_context(
    *,
    workspace_id: str,
    provider: Any,
    binding: dict[str, Any],
    hosted_execution: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    reasons = product_workspace_binding.validate_projection(
        binding,
        workspace_id=workspace_id,
    )
    input_digests, catalog_reasons = _catalog_input_digests(provider, binding)
    reasons.extend(catalog_reasons)

    operation = _record(
        _record(hosted_execution.get("operations")).get(DRY_RUN_OPERATION_ID)
    )
    request_id = _text(operation.get("request_id"))
    request_match = DRY_RUN_REQUEST_RE.fullmatch(request_id or "")
    if operation.get("status") != "succeeded":
        reasons.append("successful_promotion_dry_run_required")
    if request_match is None or request_match.group(1) != workspace_id:
        reasons.append("promotion_dry_run_request_identity_invalid")
        request_fragment = None
    else:
        request_fragment = request_match.group(2)
    if operation.get("binding_id") != binding.get("binding_id"):
        reasons.append("promotion_dry_run_binding_id_mismatch")
    if operation.get("binding_revision_sha256") != binding.get(
        "binding_revision_sha256"
    ):
        reasons.append("promotion_dry_run_binding_revision_mismatch")

    dry_run_inputs = _input_digest_map(operation.get("input_digests"))
    if dry_run_inputs != input_digests or set(dry_run_inputs) != set(
        BOUND_INPUT_REFS.values()
    ):
        reasons.append("promotion_dry_run_input_digests_missing_or_stale")

    expected_reports: dict[str, str] = {}
    if request_fragment is not None:
        expected_reports = {
            "execution_report": (
                "runs/managed-promotion-dry-runs/"
                f"{request_fragment}.product_candidate_promotion_execution_report.json"
            ),
            "git_service_report": (
                "runs/managed-promotion-dry-runs/"
                f"{request_fragment}.git_service_promotion_execution_report.json"
            ),
        }
    output_reports = operation.get("output_reports")
    if not isinstance(output_reports, list):
        output_reports = []
    output_digests = {
        _text(item.get("logical_ref")): _text(item.get("sha256"))
        for item in output_reports
        if isinstance(item, dict)
    }
    if (
        not expected_reports
        or set(output_digests) != set(expected_reports.values())
        or any(
            not SHA256_RE.fullmatch(output_digests.get(ref) or "")
            for ref in expected_reports.values()
        )
    ):
        reasons.append("promotion_dry_run_reports_missing_or_invalid")

    context = {
        "binding": {
            "binding_id": binding.get("binding_id"),
            "binding_revision_sha256": binding.get(
                "binding_revision_sha256"
            ),
            "source_sha256": binding.get("source_sha256"),
        },
        "input_digests": input_digests,
        "request_id": request_id,
        "expected_reports": expected_reports,
        "output_digests": output_digests,
    }
    return context, sorted(set(reasons))


def _confirmation_diagnostics(
    payload: dict[str, Any],
    *,
    workspace_id: str,
    operator_ref: str,
    context: dict[str, Any],
) -> list[str]:
    reasons: list[str] = []
    if set(payload) != CONFIRMATION_FIELDS:
        reasons.append("promotion_review_confirmation_contract_invalid")
    if (
        payload.get("artifact_kind") != CONFIRMATION_KIND
        or payload.get("schema_version") != 1
        or payload.get("contract_ref") != CONFIRMATION_CONTRACT_REF
    ):
        reasons.append("promotion_review_confirmation_version_invalid")
    identifier = CONFIRMATION_ID_RE.fullmatch(
        _text(payload.get("confirmation_id")) or ""
    )
    if identifier is None or identifier.group(1) != workspace_id:
        reasons.append("promotion_review_confirmation_identity_invalid")
    if (
        payload.get("workspace_id") != workspace_id
        or payload.get("operation_id") != CONFIRMATION_OPERATION_ID
        or payload.get("operator_ref") != operator_ref
    ):
        reasons.append("promotion_review_confirmation_scope_mismatch")
    if payload.get("status") != "ready" or payload.get("confirmed") is not True:
        reasons.append("promotion_review_confirmation_not_ready")

    issued_at = _parse_time(payload.get("issued_at"))
    expires_at = _parse_time(payload.get("expires_at"))
    if (
        issued_at is None
        or expires_at is None
        or expires_at <= issued_at
        or (expires_at - issued_at).total_seconds() > 15 * 60
    ):
        reasons.append("promotion_review_confirmation_lifetime_invalid")

    if payload.get("workspace_binding") != context.get("binding"):
        reasons.append("promotion_review_confirmation_binding_stale")
    inputs = _record(payload.get("inputs"))
    if set(inputs) != set(BOUND_INPUT_REFS):
        reasons.append("promotion_review_confirmation_inputs_invalid")
    for name, logical_ref in BOUND_INPUT_REFS.items():
        if _record(inputs.get(name)) != {
            "logical_ref": logical_ref,
            "sha256": _record(context.get("input_digests")).get(logical_ref),
        }:
            reasons.append(f"promotion_review_confirmation_input_stale:{name}")

    reports = _record(context.get("expected_reports"))
    output_digests = _record(context.get("output_digests"))
    predecessor = _record(payload.get("predecessor_dry_run"))
    expected_predecessor = {
        "request_id": context.get("request_id"),
        "execution_report": {
            "logical_ref": reports.get("execution_report"),
            "sha256": output_digests.get(reports.get("execution_report")),
        },
        "git_service_report": {
            "logical_ref": reports.get("git_service_report"),
            "sha256": output_digests.get(reports.get("git_service_report")),
        },
    }
    if predecessor != expected_predecessor:
        reasons.append("promotion_review_confirmation_dry_run_stale")
    if payload.get("authority_boundary") != AUTHORITY_BOUNDARY:
        reasons.append("promotion_review_confirmation_authority_invalid")
    return sorted(set(reasons))


def _load_confirmation(
    server: Any,
    *,
    workspace_id: str,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[str]]:
    try:
        pointer_record = specspace_state_backend.read_state_record(
            server,
            _pointer_key(workspace_id),
            workspace_id=workspace_id,
        )
    except specspace_state_backend.StateBackendError:
        return None, None, ["promotion_review_confirmation_state_unavailable"]
    if pointer_record is None:
        return None, None, []
    pointer = _record(pointer_record.get("content"))
    if (
        pointer_record.get("lifecycle_state") != "active"
        or set(pointer) != POINTER_FIELDS
        or pointer.get("artifact_kind")
        != "specspace_promotion_review_confirmation_pointer"
        or pointer.get("schema_version") != 1
        or pointer.get("workspace_id") != workspace_id
        or pointer.get("operation_id") != CONFIRMATION_OPERATION_ID
        or pointer.get("authority_boundary") != POINTER_AUTHORITY_BOUNDARY
    ):
        return pointer, None, ["promotion_review_confirmation_pointer_invalid"]
    confirmation_ref = _text(pointer.get("confirmation_ref"))
    if confirmation_ref is None or not confirmation_ref.startswith(
        "specspace-state://"
    ):
        return pointer, None, ["promotion_review_confirmation_ref_invalid"]
    record_key = confirmation_ref.removeprefix("specspace-state://")
    try:
        confirmation_record = specspace_state_backend.read_state_record(
            server,
            record_key,
            workspace_id=workspace_id,
        )
    except specspace_state_backend.StateBackendError:
        return pointer, None, ["promotion_review_confirmation_state_unavailable"]
    if confirmation_record is None:
        return pointer, None, ["promotion_review_confirmation_missing"]
    if (
        confirmation_record.get("content_sha256")
        != pointer.get("confirmation_sha256")
    ):
        return pointer, confirmation_record, [
            "promotion_review_confirmation_digest_mismatch"
        ]
    confirmation = _record(confirmation_record.get("content"))
    confirmation_id = _text(confirmation.get("confirmation_id"))
    identifier = CONFIRMATION_ID_RE.fullmatch(confirmation_id or "")
    expected_ref = (
        f"specspace-state://{_confirmation_key(workspace_id, identifier.group(2))}"
        if identifier is not None and identifier.group(1) == workspace_id
        else None
    )
    if (
        pointer.get("confirmation_id") != confirmation_id
        or pointer.get("confirmation_ref") != expected_ref
        or pointer.get("operator_ref") != confirmation.get("operator_ref")
        or pointer.get("issued_at") != confirmation.get("issued_at")
        or pointer.get("expires_at") != confirmation.get("expires_at")
        or pointer.get("predecessor_request_id")
        != _record(confirmation.get("predecessor_dry_run")).get("request_id")
    ):
        return pointer, confirmation_record, [
            "promotion_review_confirmation_pointer_mismatch"
        ]
    return pointer, confirmation_record, []


def workspace_projection(
    server: Any,
    *,
    workspace_id: str | None,
    provider: Any,
    binding: dict[str, Any],
    hosted_execution: dict[str, Any],
    now: datetime | None = None,
) -> dict[str, Any]:
    operator_ref = operator_auth.operator_profile_ref(server)
    context: dict[str, Any] = {}
    context_reasons: list[str] = []
    confirmation_reasons: list[str] = []
    state_reasons = _durable_confirmation_state_reasons(server)
    context_reasons.extend(state_reasons)
    if workspace_id is None:
        context_reasons.append("promotion_review_confirmation_workspace_missing")
    if operator_ref is None:
        context_reasons.append("authenticated_operator_profile_required")
    if workspace_id is not None:
        context, current_context_reasons = _current_context(
            workspace_id=workspace_id,
            provider=provider,
            binding=binding,
            hosted_execution=hosted_execution,
        )
        context_reasons.extend(current_context_reasons)
        if not state_reasons:
            _pointer, record, record_reasons = _load_confirmation(
                server,
                workspace_id=workspace_id,
            )
            confirmation_reasons.extend(record_reasons)
        else:
            record = None
    else:
        pointer, record = None, None

    confirmation = _record(_record(record).get("content"))
    lifecycle_state = _text(_record(record).get("lifecycle_state"))
    current_time = now or utc_now()
    if confirmation and workspace_id is not None and operator_ref is not None:
        confirmation_reasons.extend(
            _confirmation_diagnostics(
                confirmation,
                workspace_id=workspace_id,
                operator_ref=operator_ref,
                context=context,
            )
        )
    issued_at = _parse_time(confirmation.get("issued_at"))
    expires_at = _parse_time(confirmation.get("expires_at"))
    if issued_at is not None and issued_at > current_time:
        confirmation_reasons.append(
            "promotion_review_confirmation_not_yet_valid"
        )
    expired = expires_at is not None and expires_at <= current_time
    if lifecycle_state not in {None, "active", "consumed"}:
        confirmation_reasons.append(
            "promotion_review_confirmation_lifecycle_invalid"
        )
    context_ready = not context_reasons
    if not confirmation and not confirmation_reasons:
        status = "confirmation_needed" if context_ready else "blocked"
    elif lifecycle_state == "consumed" and not confirmation_reasons:
        status = "consumed"
    elif expired and not confirmation_reasons:
        status = "expired"
    elif confirmation_reasons:
        status = "stale" if context_ready else "blocked"
    elif context_ready:
        status = "ready"
    else:
        status = "blocked"
    can_author = context_ready and status in {
        "confirmation_needed",
        "expired",
        "stale",
    }
    next_actions = {
        "ready": (
            "Review the bound evidence, then request the separately "
            "allowlisted promotion review operation."
        ),
        "confirmation_needed": (
            "Authorize review creation for the current successful "
            "promotion dry-run."
        ),
        "expired": "Create a fresh short-lived confirmation for the current evidence.",
        "consumed": "Reconcile the consumed review request before authoring any new confirmation.",
        "stale": "Create a new confirmation bound to the current promotion inputs and dry-run.",
        "blocked": (
            "Resolve the listed confirmation prerequisites before authorizing "
            "review creation."
        ),
    }
    return {
        "artifact_kind": "specspace_promotion_review_confirmation_authoring",
        "schema_version": 1,
        "available": bool(confirmation) or context_ready,
        "status": status,
        "workspace_id": workspace_id,
        "operation_id": CONFIRMATION_OPERATION_ID,
        "can_author": can_author,
        "operator_profile_bound": operator_ref is not None,
        "confirmation": {
            "available": bool(confirmation),
            "status": lifecycle_state or ("missing" if not confirmation else "unknown"),
            "confirmation_id": _text(confirmation.get("confirmation_id")),
            "issued_at": _text(confirmation.get("issued_at")),
            "expires_at": _text(confirmation.get("expires_at")),
            "predecessor_request_id": _text(
                _record(confirmation.get("predecessor_dry_run")).get(
                    "request_id"
                )
            ),
        },
        "bound_inputs": [
            {
                "logical_ref": logical_ref,
                "sha256": _record(context.get("input_digests")).get(logical_ref),
            }
            for logical_ref in BOUND_INPUT_REFS.values()
            if _record(context.get("input_digests")).get(logical_ref)
        ],
        "blockers": sorted(set([*context_reasons, *confirmation_reasons])),
        "next_safe_action": next_actions[status],
        "authority_boundary": dict(PROJECTION_AUTHORITY_BOUNDARY),
    }


def author_confirmation(
    server: Any,
    *,
    workspace_id: str | None,
    payload: Any,
    provider: Any,
    binding: dict[str, Any],
    hosted_execution: dict[str, Any],
) -> tuple[HTTPStatus, dict[str, Any]]:
    if not isinstance(payload, dict) or set(payload) != {
        "workspace_id",
        "confirmed",
    }:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Promotion review confirmation payload is invalid.",
            "reason": "promotion_review_confirmation_payload_invalid",
        }
    if payload.get("workspace_id") != workspace_id or payload.get("confirmed") is not True:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Promotion review confirmation must target the selected workspace.",
            "reason": "promotion_review_confirmation_scope_invalid",
        }
    projection = workspace_projection(
        server,
        workspace_id=workspace_id,
        provider=provider,
        binding=binding,
        hosted_execution=hosted_execution,
    )
    if projection["status"] == "ready":
        return HTTPStatus.OK, {
            **projection,
            "ok": True,
            "created": False,
        }
    if projection["can_author"] is not True or workspace_id is None:
        return HTTPStatus.CONFLICT, {
            **projection,
            "ok": False,
            "error": "Promotion review confirmation prerequisites are not ready.",
            "reason": "promotion_review_confirmation_prerequisites_not_ready",
        }
    operator_ref = operator_auth.operator_profile_ref(server)
    if operator_ref is None:
        return HTTPStatus.CONFLICT, {
            "ok": False,
            "error": "Authenticated operator profile is required.",
            "reason": "authenticated_operator_profile_required",
        }
    context, reasons = _current_context(
        workspace_id=workspace_id,
        provider=provider,
        binding=binding,
        hosted_execution=hosted_execution,
    )
    if reasons:
        return HTTPStatus.CONFLICT, {
            "ok": False,
            "error": "Promotion review confirmation evidence changed.",
            "reason": "promotion_review_confirmation_evidence_changed",
            "blockers": reasons,
        }

    issued_at = utc_now()
    expires_at = issued_at + timedelta(seconds=CONFIRMATION_TTL_SECONDS)
    identifier = uuid.uuid4().hex
    confirmation_id = (
        f"confirmation://{workspace_id}/{CONFIRMATION_OPERATION_ID}/{identifier}"
    )
    reports = _record(context.get("expected_reports"))
    output_digests = _record(context.get("output_digests"))
    confirmation = {
        "artifact_kind": CONFIRMATION_KIND,
        "schema_version": 1,
        "contract_ref": CONFIRMATION_CONTRACT_REF,
        "confirmation_id": confirmation_id,
        "workspace_id": workspace_id,
        "operation_id": CONFIRMATION_OPERATION_ID,
        "operator_ref": operator_ref,
        "status": "ready",
        "confirmed": True,
        "issued_at": _iso(issued_at),
        "expires_at": _iso(expires_at),
        "workspace_binding": context["binding"],
        "inputs": {
            name: {
                "logical_ref": logical_ref,
                "sha256": context["input_digests"][logical_ref],
            }
            for name, logical_ref in BOUND_INPUT_REFS.items()
        },
        "predecessor_dry_run": {
            "request_id": context["request_id"],
            "execution_report": {
                "logical_ref": reports["execution_report"],
                "sha256": output_digests[reports["execution_report"]],
            },
            "git_service_report": {
                "logical_ref": reports["git_service_report"],
                "sha256": output_digests[reports["git_service_report"]],
            },
        },
        "authority_boundary": dict(AUTHORITY_BOUNDARY),
    }
    confirmation_key = _confirmation_key(workspace_id, identifier)
    confirmation_ref = f"specspace-state://{confirmation_key}"
    try:
        record = specspace_state_backend.write_state_record(
            server,
            confirmation_key,
            workspace_id=workspace_id,
            content=confirmation,
            lifecycle_state="active",
        )
        pointer = {
            "artifact_kind": "specspace_promotion_review_confirmation_pointer",
            "schema_version": 1,
            "workspace_id": workspace_id,
            "operation_id": CONFIRMATION_OPERATION_ID,
            "confirmation_id": confirmation_id,
            "confirmation_ref": confirmation_ref,
            "confirmation_sha256": record["content_sha256"],
            "operator_ref": operator_ref,
            "issued_at": confirmation["issued_at"],
            "expires_at": confirmation["expires_at"],
            "predecessor_request_id": context["request_id"],
            "authority_boundary": dict(POINTER_AUTHORITY_BOUNDARY),
        }
        specspace_state_backend.write_state_record(
            server,
            _pointer_key(workspace_id),
            workspace_id=workspace_id,
            content=pointer,
            lifecycle_state="active",
        )
    except specspace_state_backend.StateBackendError:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "ok": False,
            "error": "SpecSpace could not persist promotion review confirmation state.",
            "reason": "promotion_review_confirmation_state_unavailable",
        }
    refreshed = workspace_projection(
        server,
        workspace_id=workspace_id,
        provider=provider,
        binding=binding,
        hosted_execution=hosted_execution,
        now=issued_at,
    )
    return HTTPStatus.CREATED, {
        **refreshed,
        "ok": True,
        "created": True,
    }


def ready_confirmation(
    server: Any,
    *,
    workspace_id: str,
    provider: Any,
    binding: dict[str, Any],
    hosted_execution: dict[str, Any],
) -> tuple[dict[str, str] | None, dict[str, Any]]:
    projection = workspace_projection(
        server,
        workspace_id=workspace_id,
        provider=provider,
        binding=binding,
        hosted_execution=hosted_execution,
    )
    if projection.get("status") != "ready":
        return None, projection
    pointer, record, reasons = _load_confirmation(
        server,
        workspace_id=workspace_id,
    )
    content = _record(_record(record).get("content"))
    confirmation_ref = _text(_record(pointer).get("confirmation_ref"))
    operator_ref = _text(content.get("operator_ref"))
    if reasons or confirmation_ref is None or operator_ref is None:
        return None, {
            **projection,
            "status": "stale",
            "blockers": [*projection.get("blockers", []), *reasons],
        }
    return {
        "confirmation_ref": confirmation_ref,
        "operator_ref": operator_ref,
    }, projection
