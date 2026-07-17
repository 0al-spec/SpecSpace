"""SpecSpace client/state boundary for Platform hosted managed operations."""

from __future__ import annotations

from datetime import datetime, timezone
from http import HTTPStatus
import json
from pathlib import Path
import threading
from typing import Any
import urllib.error
import urllib.parse
import urllib.request
import uuid

from viewer import managed_operations_registry, product_workspace_binding


STATE_FILENAME = "hosted_managed_operation_requests.json"
STATE_KIND = "specspace_hosted_managed_operation_request_state"
CONFIRMATION_DIR = "hosted-managed-confirmations"
ACTIVE_STATUSES = {"queued", "leased", "running"}
TERMINAL_STATUSES = {"rejected", "succeeded", "failed", "timed_out", "quarantined"}
REPLAY_SAFE_OPERATION_IDS = {"promotion_execute_dry_run", "review_status_execute"}
_STATE_LOCK = threading.Lock()


class HostedExecutionError(ValueError):
    pass


def _safe_remote_error(value: Any) -> str | None:
    message = _text(value)
    if message is None or len(message) > 240:
        return None
    lowered = message.lower()
    if any(
        marker in lowered
        for marker in ("/users/", "/home/", "/tmp/", "token", "password", "secret")
    ):
        return None
    if any(ord(character) < 32 for character in message):
        return None
    return message


def now_iso() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _authority_expansion(value: Any, *, path: str = "$") -> str | None:
    if isinstance(value, dict):
        for key, item in value.items():
            child_path = f"{path}.{key}"
            if isinstance(key, str) and key.startswith("may_") and item is not False:
                return child_path
            if key == "authority_boundary" and not isinstance(item, dict):
                return child_path
            expanded = _authority_expansion(item, path=child_path)
            if expanded is not None:
                return expanded
    elif isinstance(value, list):
        for index, item in enumerate(value):
            expanded = _authority_expansion(item, path=f"{path}[{index}]")
            if expanded is not None:
                return expanded
    return None


def _valid_persisted_record(item: dict[str, Any]) -> bool:
    request_id = _text(item.get("request_id"))
    idempotency_key = _text(item.get("idempotency_key"))
    operation_id = _text(item.get("operation_id"))
    workspace_id = _text(item.get("workspace_id"))
    status = _text(item.get("status"))
    return bool(
        request_id
        and request_id.startswith("managed-operation://")
        and idempotency_key
        and operation_id
        and managed_operations_registry.operation_by_id(operation_id) is not None
        and workspace_id
        and status in ACTIVE_STATUSES | TERMINAL_STATUSES
        and item.get("authority_boundary") == authority_boundary()
        and _authority_expansion(item) is None
    )


def _state_dir(server: Any) -> Path:
    value = getattr(server, "specspace_state_dir", None)
    if not isinstance(value, Path):
        value = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return value


def state_path(server: Any) -> Path:
    return _state_dir(server) / STATE_FILENAME


def configured_operation_allowlist(server: Any) -> frozenset[str] | None:
    value = getattr(server, "hosted_managed_operation_allowlist", None)
    if value is None:
        return None
    if not isinstance(value, (set, frozenset)) or not all(
        isinstance(item, str) and item for item in value
    ):
        return frozenset()
    return frozenset(value)


def _empty_state() -> dict[str, Any]:
    return {
        "artifact_kind": STATE_KIND,
        "schema_version": 1,
        "state_owner": "SpecSpace",
        "updated_at": None,
        "requests": [],
        "authority_boundary": authority_boundary(),
    }


def authority_boundary() -> dict[str, bool]:
    return {
        "hosted_request_state_is_execution_authority": False,
        "browser_executes_platform": False,
        "specspace_backend_executes_platform": False,
        "specspace_backend_executes_shell": False,
        "specspace_mutates_candidate_artifacts": False,
        "specspace_mutates_canonical_specs": False,
        "specspace_writes_ontology_packages": False,
        "specspace_accepts_ontology_terms": False,
        "specspace_creates_git_branch": False,
        "specspace_creates_git_commit": False,
        "specspace_opens_pull_request": False,
        "specspace_merges_pull_request": False,
        "specspace_publishes_read_model": False,
        "queue_status_is_lifecycle_evidence": False,
    }


def read_state(server: Any) -> dict[str, Any]:
    path = state_path(server)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return _empty_state()
    except (OSError, json.JSONDecodeError):
        state = _empty_state()
        state["status"] = "invalid"
        state["reasons"] = ["hosted_managed_operation_state_unreadable"]
        return state
    if not isinstance(payload, dict) or payload.get("artifact_kind") != STATE_KIND:
        state = _empty_state()
        state["status"] = "invalid"
        state["reasons"] = ["hosted_managed_operation_state_kind_mismatch"]
        return state
    if payload.get("authority_boundary") != authority_boundary():
        state = _empty_state()
        state["status"] = "invalid"
        state["reasons"] = ["hosted_managed_operation_state_authority_invalid"]
        return state
    requests = payload.get("requests")
    if not isinstance(requests, list) or any(
        not isinstance(item, dict) or not _valid_persisted_record(item)
        for item in requests
    ):
        state = _empty_state()
        state["status"] = "invalid"
        state["reasons"] = ["hosted_managed_operation_state_request_invalid"]
        return state
    payload["requests"] = requests
    payload["status"] = "available"
    return payload


def _write_state(server: Any, state: dict[str, Any]) -> None:
    path = state_path(server)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(state, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def _safe_output_reports(receipt: dict[str, Any]) -> list[dict[str, str]]:
    reports: list[dict[str, str]] = []
    for item in receipt.get("output_reports", []):
        if not isinstance(item, dict):
            continue
        logical_ref = _text(item.get("logical_ref"))
        sha256 = _text(item.get("sha256"))
        if logical_ref is None or sha256 is None:
            continue
        if not logical_ref.startswith("runs/") or ".." in Path(logical_ref).parts:
            continue
        if len(sha256) != 64 or any(character not in "0123456789abcdef" for character in sha256):
            continue
        reports.append({"logical_ref": logical_ref, "sha256": sha256})
    return reports


def _operator_ref(operation_id: str) -> str:
    if operation_id in REPLAY_SAFE_OPERATION_IDS:
        return f"operator://specspace-{uuid.uuid4().hex}"
    return "operator://specspace-backend"


def _compact_enqueue_record(report: dict[str, Any]) -> dict[str, Any]:
    request = _record(report.get("request"))
    receipt = _record(report.get("receipt"))
    operation = _record(request.get("operation"))
    workspace = _record(request.get("workspace"))
    binding = _record(request.get("workspace_binding"))
    request_id = _text(receipt.get("request_ref"))
    idempotency_key = _text(receipt.get("idempotency_key"))
    operation_id = _text(operation.get("operation_id"))
    workspace_id = _text(workspace.get("workspace_id"))
    status = _text(receipt.get("status"))
    if (
        report.get("artifact_kind")
        != "platform_hosted_managed_operation_enqueue_report"
        or report.get("ok") is not True
        or request_id is None
        or idempotency_key is None
        or operation_id is None
        or workspace_id is None
        or status not in ACTIVE_STATUSES | TERMINAL_STATUSES
        or receipt.get("operation_id") != operation_id
        or receipt.get("workspace_id") != workspace_id
        or _authority_expansion(report) is not None
    ):
        raise HostedExecutionError("hosted executor returned an invalid enqueue report")
    boundary = _record(report.get("authority_boundary"))
    if (
        boundary.get("enqueue_is_execution_authority") is not False
        or boundary.get("queue_status_is_lifecycle_evidence") is not False
        or boundary.get("platform_output_reports_are_authoritative") is not True
    ):
        raise HostedExecutionError("hosted enqueue report authority boundary is invalid")
    return {
        "request_id": request_id,
        "idempotency_key": idempotency_key,
        "operation_id": operation_id,
        "workspace_id": workspace_id,
        "status": status,
        "attempt": receipt.get("attempt") if isinstance(receipt.get("attempt"), int) else 0,
        "binding_id": _text(binding.get("binding_id")),
        "binding_revision_sha256": _text(binding.get("binding_revision_sha256")),
        "expected_output_reports": [
            item
            for item in request.get("expected_output_reports", [])
            if isinstance(item, str) and item.startswith("runs/")
        ],
        "output_reports": _safe_output_reports(receipt),
        "created_at": _text(request.get("generated_at")) or now_iso(),
        "updated_at": now_iso(),
        "last_poll_error": None,
        "authority_boundary": authority_boundary(),
    }


def save_enqueue_report(server: Any, report: dict[str, Any]) -> dict[str, Any]:
    record = _compact_enqueue_record(report)
    with _STATE_LOCK:
        state = read_state(server)
        requests = [
            item
            for item in state.get("requests", [])
            if item.get("request_id") != record["request_id"]
        ]
        requests.append(record)
        state = {
            **_empty_state(),
            "updated_at": now_iso(),
            "requests": requests[-500:],
        }
        _write_state(server, state)
    return record


def update_status_report(server: Any, report: dict[str, Any]) -> dict[str, Any]:
    job = _record(report.get("job"))
    request_id = _text(job.get("request_id"))
    status = _text(job.get("status"))
    receipt = _record(job.get("receipt"))
    if (
        report.get("artifact_kind")
        != "platform_hosted_managed_operation_status_report"
        or report.get("ok") is not True
        or request_id is None
        or status not in ACTIVE_STATUSES | TERMINAL_STATUSES
        or _authority_expansion(report) is not None
    ):
        raise HostedExecutionError("hosted executor returned an invalid status report")
    boundary = _record(report.get("authority_boundary"))
    if (
        boundary.get("status_is_execution_authority") is not False
        or boundary.get("queue_status_is_lifecycle_evidence") is not False
        or boundary.get("platform_output_reports_are_authoritative") is not True
    ):
        raise HostedExecutionError("hosted status report authority boundary is invalid")
    with _STATE_LOCK:
        state = read_state(server)
        matched: dict[str, Any] | None = None
        for item in state.get("requests", []):
            if item.get("request_id") != request_id:
                continue
            item["status"] = status
            item["attempt"] = job.get("attempt") if isinstance(job.get("attempt"), int) else item.get("attempt", 0)
            item["output_reports"] = _safe_output_reports(receipt)
            item["updated_at"] = now_iso()
            item["last_poll_error"] = None
            matched = item
            break
        if matched is None:
            raise HostedExecutionError("hosted status does not match SpecSpace-owned request state")
        state["updated_at"] = now_iso()
        state["authority_boundary"] = authority_boundary()
        _write_state(server, state)
    return matched


class HostedManagedOperationClient:
    def __init__(self, *, base_url: str, token: str, timeout_seconds: float) -> None:
        parsed = urllib.parse.urlparse(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise HostedExecutionError("hosted executor URL must be HTTP(S)")
        if parsed.scheme == "http" and parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
            raise HostedExecutionError("non-loopback hosted executor URL must use HTTPS")
        if len(token) < 32:
            raise HostedExecutionError("hosted executor token must contain at least 32 characters")
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout_seconds = max(0.2, min(timeout_seconds, 30.0))

    def _request(
        self,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        authenticated: bool = True,
    ) -> dict[str, Any]:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Accept": "application/json"}
        if payload is not None:
            headers["Content-Type"] = "application/json"
        if authenticated:
            headers["Authorization"] = f"Bearer {self.token}"
        try:
            with urllib.request.urlopen(
                urllib.request.Request(
                    f"{self.base_url}{path}",
                    data=data,
                    headers=headers,
                    method="POST" if payload is not None else "GET",
                ),
                timeout=self.timeout_seconds,
            ) as response:
                body = json.loads(response.read())
        except urllib.error.HTTPError as exc:
            try:
                error_body = json.loads(exc.read(16 * 1024))
            except (OSError, json.JSONDecodeError):
                error_body = {}
            remote_error = _safe_remote_error(
                error_body.get("error") if isinstance(error_body, dict) else None
            )
            detail = f": {remote_error}" if remote_error else ""
            raise HostedExecutionError(
                f"hosted executor rejected the request with HTTP {exc.code}{detail}"
            ) from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise HostedExecutionError("hosted executor is unavailable or returned invalid JSON") from exc
        if not isinstance(body, dict):
            raise HostedExecutionError("hosted executor response must be a JSON object")
        return body

    def health(self) -> dict[str, Any]:
        return self._request("/v1/health", authenticated=False)

    def enqueue(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("/v1/managed-operations", payload=payload)

    def status(self, request_id: str) -> dict[str, Any]:
        query = urllib.parse.urlencode({"request_id": request_id, "include_events": "false"})
        return self._request(f"/v1/managed-operations/status?{query}")


def client_from_server(server: Any) -> HostedManagedOperationClient:
    base_url = _text(getattr(server, "hosted_managed_executor_url", None))
    token = _text(getattr(server, "hosted_managed_executor_token", None))
    if base_url is None or token is None:
        raise HostedExecutionError("hosted managed executor is not configured")
    timeout = getattr(server, "hosted_managed_executor_timeout_seconds", 5.0)
    try:
        timeout_seconds = float(timeout)
    except (TypeError, ValueError):
        timeout_seconds = 5.0
    return HostedManagedOperationClient(
        base_url=base_url,
        token=token,
        timeout_seconds=timeout_seconds,
    )


def _conditional_ref_available(
    server: Any,
    workspace_id: str,
    ref: str,
    *,
    workspace_payload: dict[str, Any] | None = None,
) -> bool:
    if ref == "runs/product_candidate_promotion_review_object_evidence.json":
        artifact = _record(
            _record((workspace_payload or {}).get("artifacts")).get(
                "product_promotion_review_object_evidence"
            )
        )
        return artifact.get("available") is True and artifact.get("valid") is not False
    if ref.startswith("specspace-state://"):
        return (_state_dir(server) / ref.removeprefix("specspace-state://")).is_file()
    if ref.startswith("runs/"):
        runs_dir = getattr(server, "runs_dir", None)
        if not isinstance(runs_dir, Path):
            return False
        return (runs_dir / workspace_id / ref.removeprefix("runs/")).is_file()
    return False


def _confirmation_ref(server: Any, workspace_id: str, operation_id: str) -> str:
    identifier = uuid.uuid4().hex
    relative = Path(CONFIRMATION_DIR) / workspace_id / operation_id / f"{identifier}.json"
    path = _state_dir(server) / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "artifact_kind": "specspace_hosted_managed_operation_confirmation",
                "schema_version": 1,
                "workspace_id": workspace_id,
                "operation_id": operation_id,
                "confirmed": True,
                "created_at": now_iso(),
                "authority_boundary": authority_boundary(),
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return f"specspace-state://{relative.as_posix()}"


def enqueue_operation(
    server: Any,
    *,
    operation_id: str,
    workspace_id: str | None,
    payload: dict[str, Any],
    workspace_binding: dict[str, Any] | None = None,
    workspace_payload: dict[str, Any] | None = None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    if getattr(server, "hosted_managed_execution_enabled", False) is not True:
        return HTTPStatus.SERVICE_UNAVAILABLE, {
            "error": "Hosted managed execution is not enabled.",
            "reason": "hosted_managed_execution_disabled",
        }
    operation = managed_operations_registry.operation_by_id(operation_id)
    if operation is None or workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Managed operation or workspace identity is invalid.",
            "reason": "hosted_managed_operation_invalid",
        }
    configured_allowlist = configured_operation_allowlist(server)
    if configured_allowlist is not None and operation_id not in configured_allowlist:
        return HTTPStatus.FORBIDDEN, {
            "error": "Managed operation is not enabled by the SpecSpace deployment profile.",
            "reason": "hosted_managed_operation_not_allowlisted",
        }
    if operation.requires_explicit_confirmation and payload.get("confirm") is not True:
        return HTTPStatus.CONFLICT, {
            "error": "Managed operation requires explicit operator confirmation.",
            "reason": "hosted_managed_operation_confirmation_required",
        }
    if operation_id == "workspace_initialization_execute":
        binding_ref = _text(payload.get("execution_request_ref")) or (
            f"runs/{workspace_id}/product_workspace_initialization_execution_request.json"
        )
    else:
        binding = workspace_binding or product_workspace_binding.discover_binding(
            server, workspace_id=workspace_id
        )
        if product_workspace_binding.validate_projection(
            binding,
            workspace_id=workspace_id,
        ):
            return HTTPStatus.CONFLICT, {
                "error": "Hosted managed execution requires a ready durable workspace binding.",
                "reason": "durable_workspace_binding_not_ready",
            }
        source_ref = _text(binding.get("source_ref"))
        binding_ref = (
            product_workspace_binding.bound_run_ref(binding, source_ref)
            if source_ref is not None
            else None
        )
    if binding_ref is None or not binding_ref.startswith("runs/") or ".." in Path(binding_ref).parts:
        return HTTPStatus.CONFLICT, {
            "error": "Hosted managed execution binding ref is invalid.",
            "reason": "durable_workspace_binding_ref_invalid",
        }
    input_refs = [
        ref
        for ref in operation.input_refs
        if ref not in operation.conditional_input_refs
        or _conditional_ref_available(
            server,
            workspace_id,
            ref,
            workspace_payload=workspace_payload,
        )
    ]
    confirmation_ref = (
        _confirmation_ref(server, workspace_id, operation_id)
        if operation.requires_explicit_confirmation
        else None
    )
    operator_ref = _operator_ref(operation_id)
    request_payload = {
        "operation_id": operation_id,
        "workspace_id": workspace_id,
        "workspace_binding_ref": binding_ref,
        "input_refs": input_refs,
        "operator_ref": operator_ref,
        "confirmation_ref": confirmation_ref,
    }
    try:
        report = client_from_server(server).enqueue(request_payload)
        record = save_enqueue_report(server, report)
    except HostedExecutionError as exc:
        return HTTPStatus.BAD_GATEWAY, {
            "artifact_kind": "specspace_hosted_managed_operation_enqueue_error",
            "ok": False,
            "status": "hosted_executor_unavailable",
            "error": str(exc),
            "workspace_id": workspace_id,
            "operation_id": operation_id,
            "authority_boundary": authority_boundary(),
        }
    terminal = record["status"] in TERMINAL_STATUSES
    return HTTPStatus.ACCEPTED, {
        "artifact_kind": "specspace_hosted_managed_operation_request",
        "schema_version": 1,
        "ok": True,
        "status": "execution_already_recorded" if terminal else "execution_requested",
        "workspace_id": workspace_id,
        "operation_id": operation_id,
        "request_id": record["request_id"],
        "idempotency_key": record["idempotency_key"],
        "queue_status": record["status"],
        "summary": {
            "status": f"hosted_managed_operation_{record['status']}",
            "executed": False,
            "next_action": (
                "Refresh Product Workspace and inspect the authoritative Platform report."
                if terminal
                else "Wait for the hosted Platform worker and refresh Product Workspace status."
            ),
        },
        "authority_boundary": authority_boundary(),
    }


def refresh_workspace(server: Any, *, workspace_id: str | None) -> dict[str, Any]:
    state = read_state(server)
    if workspace_id is None or state.get("status") == "invalid":
        return workspace_projection(state, workspace_id=workspace_id)
    active = [
        item
        for item in state.get("requests", [])
        if item.get("workspace_id") == workspace_id
        and item.get("status") in ACTIVE_STATUSES
    ][-12:]
    if active:
        try:
            client = client_from_server(server)
        except HostedExecutionError:
            return workspace_projection(state, workspace_id=workspace_id)
        for item in active:
            try:
                report = client.status(str(item.get("request_id") or ""))
                update_status_report(server, report)
            except HostedExecutionError:
                continue
        state = read_state(server)
    return workspace_projection(state, workspace_id=workspace_id)


def workspace_projection(
    state: dict[str, Any],
    *,
    workspace_id: str | None,
) -> dict[str, Any]:
    requests = [
        item
        for item in state.get("requests", [])
        if workspace_id is not None and item.get("workspace_id") == workspace_id
    ]
    latest_by_operation: dict[str, dict[str, Any]] = {}
    for item in requests:
        operation_id = _text(item.get("operation_id"))
        if operation_id is not None:
            latest_by_operation[operation_id] = item
    status_counts: dict[str, int] = {}
    for item in latest_by_operation.values():
        status = _text(item.get("status")) or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1
    return {
        "available": bool(requests),
        "status": "invalid" if state.get("status") == "invalid" else "available",
        "workspace_id": workspace_id,
        "request_count": len(requests),
        "status_counts": status_counts,
        "operations": latest_by_operation,
        "authority_boundary": authority_boundary(),
    }
