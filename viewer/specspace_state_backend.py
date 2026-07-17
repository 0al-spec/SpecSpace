"""File and authenticated HTTP backends for private SpecSpace state."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import threading
from typing import Any
import urllib.error
import urllib.parse
import urllib.request


SERVICE_CONTRACT_REF = "platform.specspace-state.service.v1"
RECORD_CONTRACT_REF = "platform.specspace-state.record.v1"
MAX_REQUEST_BYTES = 2 * 1024 * 1024
MAX_RESPONSE_BYTES = 8 * 1024 * 1024
STATE_COLLECTION_KEYS: dict[str, str] = {
    "hosted_managed_operation_requests.json": "requests",
    "idea_to_spec_candidate_approval_intents.json": "intents",
    "idea_to_spec_intake_clarification_answers.json": "answers",
    "idea_to_spec_repair_drafts.json": "drafts",
    "idea_to_spec_repair_rerun_requests.json": "requests",
    "ontology_owner_decision_acknowledgements.json": "acknowledgements",
    "product_workspace_creation_requests.json": "requests",
    "project_local_ontology_review_decisions.json": "decisions",
    "real_idea_answer_continuation_execution_requests.json": "requests",
    "real_idea_entry_requests.json": "requests",
    "real_idea_intake_execution_requests.json": "requests",
}
TERMINAL_CONSUMED_STATUSES = frozenset(
    {
        "consumed",
        "completed",
        "executed",
        "materialized",
        "published",
    }
)
TERMINAL_SUPERSEDED_STATUSES = frozenset(
    {"superseded", "rejected", "cancelled", "deleted"}
)


class StateBackendError(RuntimeError):
    pass


class StateBackendConflict(StateBackendError):
    pass


class StateBackendUnavailable(StateBackendError):
    pass


class StateBackendNotFound(StateBackendError):
    pass


def canonical_json_bytes(value: Any) -> bytes:
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise StateBackendError("SpecSpace state must be JSON serializable") from exc


def content_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def _state_dir(server: Any) -> Path:
    value = getattr(server, "specspace_state_dir", None)
    if value is None:
        value = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(value)


def file_path(server: Any, filename: str) -> Path:
    return _state_dir(server) / filename


def workspace_file_path(server: Any, workspace_id: str, filename: str) -> Path:
    return _state_dir(server) / workspace_id / filename


def materialization_path(
    server: Any,
    filename: str,
    *,
    workspace_id: str,
) -> Path:
    configured = backend(server)
    if isinstance(configured, ExternalHTTPStateBackend):
        return configured.materialization_root / workspace_id / filename
    return configured.state_dir / filename


def _atomic_write(path: Path, content: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(content, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def _load_file(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StateBackendError("SpecSpace state file is unreadable") from exc
    if not isinstance(payload, dict):
        raise StateBackendError("SpecSpace state file must contain an object")
    return payload


def _collection_key(filename: str) -> str:
    try:
        return STATE_COLLECTION_KEYS[filename]
    except KeyError as exc:
        raise StateBackendError(
            "SpecSpace state filename is outside the backend registry"
        ) from exc


def validate_record_key(record_key: str, *, workspace_id: str) -> str:
    if record_key in STATE_COLLECTION_KEYS:
        return record_key
    parts = Path(record_key).parts
    if (
        len(parts) != 4
        or parts[0] != "confirmations"
        or parts[1] != workspace_id
        or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", parts[2])
        or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,180}\.json", parts[3])
        or Path(record_key).as_posix() != record_key
    ):
        raise StateBackendError(
            "SpecSpace state record key is outside the backend allowlist"
        )
    return record_key


def _workspace_document(
    state: dict[str, Any],
    *,
    filename: str,
    workspace_id: str,
) -> dict[str, Any]:
    collection_key = _collection_key(filename)
    collection = state.get(collection_key)
    if not isinstance(collection, list):
        raise StateBackendError(
            f"SpecSpace state {collection_key} must be an array"
        )
    selected: list[dict[str, Any]] = []
    for item in collection:
        if not isinstance(item, dict):
            raise StateBackendError("SpecSpace state collection contains a non-object")
        item_workspace_id = item.get("workspace_id")
        if not isinstance(item_workspace_id, str):
            raise StateBackendError(
                "SpecSpace state collection entry has no workspace_id"
            )
        if item_workspace_id == workspace_id:
            selected.append(item)
    document = dict(state)
    document[collection_key] = selected
    return document


def _validate_workspace_document(
    content: dict[str, Any],
    *,
    filename: str,
    workspace_id: str,
) -> None:
    collection_key = _collection_key(filename)
    collection = content.get(collection_key)
    if not isinstance(collection, list):
        raise StateBackendUnavailable(
            "external state record has an invalid collection"
        )
    for item in collection:
        if (
            not isinstance(item, dict)
            or item.get("workspace_id") != workspace_id
        ):
            raise StateBackendUnavailable(
                "external state record crosses its workspace boundary"
            )


def _merge_workspace_documents(
    records: list[dict[str, Any]],
    *,
    filename: str,
) -> dict[str, Any] | None:
    if not records:
        return None
    collection_key = _collection_key(filename)
    merged: dict[str, Any] | None = None
    merged_items: list[dict[str, Any]] = []
    for record in records:
        workspace_id = record["workspace_id"]
        content = record["content"]
        _validate_workspace_document(
            content,
            filename=filename,
            workspace_id=workspace_id,
        )
        if merged is None:
            merged = dict(content)
        merged_items.extend(content[collection_key])
    if merged is None:  # pragma: no cover - records is non-empty
        return None
    merged[collection_key] = sorted(
        merged_items,
        key=lambda item: canonical_json_bytes(item),
    )
    return merged


def _lifecycle_state(document: dict[str, Any], *, filename: str) -> str:
    entries = document.get(_collection_key(filename))
    if not isinstance(entries, list) or not entries:
        return "active"
    statuses = {
        str(item.get("status") or "").strip().lower()
        for item in entries
        if isinstance(item, dict)
    }
    statuses.discard("")
    if statuses and statuses <= TERMINAL_SUPERSEDED_STATUSES:
        return "superseded"
    if statuses and statuses <= (
        TERMINAL_CONSUMED_STATUSES | TERMINAL_SUPERSEDED_STATUSES
    ):
        return "consumed"
    return "active"


def lifecycle_state(document: dict[str, Any], *, filename: str) -> str:
    return _lifecycle_state(document, filename=filename)


class FileStateBackend:
    kind = "file"

    def health(self) -> dict[str, Any]:
        state_dir = self.state_dir
        ready = state_dir.is_dir() and os.access(state_dir, os.W_OK)
        return {
            "status": "ready" if ready else "unavailable",
            "ready": ready,
            "kind": self.kind,
            "restart_persistent": True,
        }

    def __init__(self, state_dir: Path) -> None:
        self.state_dir = state_dir

    def read(
        self,
        filename: str,
        *,
        workspace_id: str | None,
    ) -> dict[str, Any] | None:
        state = _load_file(self.state_dir / filename)
        if state is None or workspace_id is None:
            return state
        return _workspace_document(
            state,
            filename=filename,
            workspace_id=workspace_id,
        )

    def write(
        self,
        filename: str,
        *,
        workspace_id: str,
        state: dict[str, Any],
    ) -> dict[str, Any]:
        document = _workspace_document(
            state,
            filename=filename,
            workspace_id=workspace_id,
        )
        path = self.state_dir / filename
        existing = _load_file(path)
        if existing is not None:
            collection_key = _collection_key(filename)
            existing_collection = existing.get(collection_key)
            if not isinstance(existing_collection, list):
                raise StateBackendError(
                    f"SpecSpace state {collection_key} must be an array"
                )
            preserved: list[dict[str, Any]] = []
            for item in existing_collection:
                if not isinstance(item, dict):
                    raise StateBackendError(
                        "SpecSpace state collection contains an unscoped entry"
                    )
                item_workspace_id = item.get("workspace_id")
                if (
                    not isinstance(item_workspace_id, str)
                    and filename
                    == "ontology_owner_decision_acknowledgements.json"
                ):
                    item_workspace_id = "ontology-workbench"
                if not isinstance(item_workspace_id, str):
                    raise StateBackendError(
                        "SpecSpace state collection contains an unscoped entry"
                    )
                if item_workspace_id != workspace_id:
                    preserved.append(item)
            document[collection_key] = [
                *preserved,
                *document[collection_key],
            ]
        _atomic_write(path, document)
        return {
            "workspace_id": workspace_id,
            "record_key": filename,
            "revision": None,
            "content_sha256": content_sha256(document),
            "lifecycle_state": _lifecycle_state(
                _workspace_document(
                    document,
                    filename=filename,
                    workspace_id=workspace_id,
                ),
                filename=filename,
            ),
        }

    def materialize(
        self,
        filename: str,
        *,
        workspace_id: str,
    ) -> Path | None:
        path = self.state_dir / filename
        return path if path.is_file() else None

    def ref_exists(self, ref: str, *, workspace_id: str) -> bool:
        if not ref.startswith("specspace-state://"):
            return False
        try:
            record_key = validate_record_key(
                ref.removeprefix("specspace-state://"),
                workspace_id=workspace_id,
            )
        except StateBackendError:
            return False
        if record_key in STATE_COLLECTION_KEYS:
            state = self.read(record_key, workspace_id=workspace_id)
            if state is None:
                return False
            collection = state.get(_collection_key(record_key))
            return isinstance(collection, list) and bool(collection)
        return (self.state_dir / record_key).is_file()

    def write_record(
        self,
        record_key: str,
        *,
        workspace_id: str,
        content: dict[str, Any],
        lifecycle_state: str = "active",
    ) -> dict[str, Any]:
        del lifecycle_state
        record_key = validate_record_key(
            record_key,
            workspace_id=workspace_id,
        )
        path = self.state_dir / record_key
        _atomic_write(path, content)
        return {
            "workspace_id": workspace_id,
            "record_key": record_key,
            "revision": None,
            "content_sha256": content_sha256(content),
        }


@dataclass(frozen=True)
class ExternalStateConfig:
    base_url: str
    token: str
    timeout_seconds: float


class ExternalHTTPStateBackend:
    kind = "external_http"

    def __init__(
        self,
        *,
        config: ExternalStateConfig,
        materialization_root: Path,
    ) -> None:
        self.config = config
        self.materialization_root = materialization_root
        self._revisions = threading.local()

    def _revision_map(self) -> dict[tuple[str, str], int]:
        revisions = getattr(self._revisions, "values", None)
        if revisions is None:
            revisions = {}
            self._revisions.values = revisions
        return revisions

    def _request(
        self,
        path: str,
        *,
        method: str = "GET",
        payload: dict[str, Any] | None = None,
        authenticated: bool = True,
    ) -> dict[str, Any]:
        headers = {"Accept": "application/json"}
        if authenticated:
            headers["Authorization"] = f"Bearer {self.config.token}"
        data: bytes | None = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload).encode("utf-8")
            if len(data) > MAX_REQUEST_BYTES:
                raise StateBackendError(
                    "external state mutation exceeds the bounded request size"
                )
        try:
            with urllib.request.urlopen(
                urllib.request.Request(
                    f"{self.config.base_url}{path}",
                    data=data,
                    headers=headers,
                    method=method,
                ),
                timeout=self.config.timeout_seconds,
            ) as response:
                encoded = response.read(MAX_RESPONSE_BYTES + 1)
                if len(encoded) > MAX_RESPONSE_BYTES:
                    raise StateBackendUnavailable(
                        "external state response exceeds the bounded size"
                    )
                body = json.loads(encoded)
        except urllib.error.HTTPError as exc:
            try:
                error_payload = json.loads(exc.read())
            except (json.JSONDecodeError, UnicodeDecodeError):
                error_payload = {}
            code = (
                error_payload.get("error")
                if isinstance(error_payload, dict)
                else None
            )
            if exc.code == 409:
                raise StateBackendConflict(
                    str(code or "external state revision conflict")
                ) from exc
            if exc.code == 404:
                raise StateBackendNotFound(
                    str(code or "external state record not found")
                ) from exc
            raise StateBackendUnavailable(
                str(code or f"external state HTTP {exc.code}")
            ) from exc
        except (
            OSError,
            TimeoutError,
            urllib.error.URLError,
            json.JSONDecodeError,
        ) as exc:
            raise StateBackendUnavailable(
                "external state service is unavailable"
            ) from exc
        if not isinstance(body, dict):
            raise StateBackendUnavailable(
                "external state service returned a non-object"
            )
        return body

    @staticmethod
    def _boundary_trusted(payload: dict[str, Any]) -> bool:
        boundary = payload.get("authority_boundary")
        if not isinstance(boundary, dict):
            return False
        for key, value in boundary.items():
            if key.startswith("may_") and value is not False:
                return False
        return (
            boundary.get("state_service_is_execution_authority") is False
            and boundary.get("executes_managed_operations") is False
            and boundary.get("executes_platform_wrappers") is False
        )

    def health(self) -> dict[str, Any]:
        try:
            payload = self._request(
                "/v1/health",
                authenticated=False,
            )
            ready = (
                payload.get("artifact_kind")
                == "platform_specspace_state_service_health"
                and payload.get("contract_ref") == SERVICE_CONTRACT_REF
                and payload.get("record_contract_ref") == RECORD_CONTRACT_REF
                and payload.get("ok") is True
                and payload.get("status") == "ready"
                and payload.get("workspace_scoped") is True
                and payload.get("cas_required") is True
                and self._boundary_trusted(payload)
            )
            return {
                "status": "ready" if ready else "untrusted",
                "ready": ready,
                "kind": self.kind,
                "restart_persistent": ready,
                "contract_ref": payload.get("contract_ref"),
                "adapter": payload.get("adapter"),
            }
        except StateBackendUnavailable:
            return {
                "status": "unavailable",
                "ready": False,
                "kind": self.kind,
                "restart_persistent": False,
            }

    def _validate_record(
        self,
        record: Any,
        *,
        expected_filename: str,
        expected_workspace_id: str | None,
    ) -> dict[str, Any]:
        if (
            not isinstance(record, dict)
            or record.get("contract_ref") != RECORD_CONTRACT_REF
            or record.get("record_key") != expected_filename
            or not isinstance(record.get("workspace_id"), str)
            or (
                expected_workspace_id is not None
                and record.get("workspace_id") != expected_workspace_id
            )
            or not isinstance(record.get("revision"), int)
            or isinstance(record.get("revision"), bool)
            or record.get("revision") < 1
            or not isinstance(record.get("content"), dict)
            or content_sha256(record["content"]) != record.get("content_sha256")
            or record.get("lifecycle_state")
            not in {"active", "consumed", "superseded"}
        ):
            raise StateBackendUnavailable(
                "external state record failed contract validation"
            )
        return record

    def read(
        self,
        filename: str,
        *,
        workspace_id: str | None,
    ) -> dict[str, Any] | None:
        _collection_key(filename)
        params: dict[str, str] = {
            "record_key": filename,
            "include_content": "true",
        }
        if workspace_id is not None:
            params["workspace_id"] = workspace_id
        payload = self._request(
            "/v1/specspace-state/records?"
            + urllib.parse.urlencode(params)
        )
        if (
            payload.get("artifact_kind")
            != "platform_specspace_state_record_collection"
            or payload.get("ok") is not True
            or not self._boundary_trusted(payload)
        ):
            raise StateBackendUnavailable(
                "external state collection failed contract validation"
            )
        raw_records = payload.get("records")
        if not isinstance(raw_records, list):
            raise StateBackendUnavailable(
                "external state collection has no records array"
            )
        records = [
            self._validate_record(
                item,
                expected_filename=filename,
                expected_workspace_id=workspace_id,
            )
            for item in raw_records
        ]
        revisions = self._revision_map()
        for record in records:
            key = (record["workspace_id"], filename)
            revisions[key] = record["revision"]
            self._materialize_record(
                record["workspace_id"],
                filename,
                record["content"],
            )
        return _merge_workspace_documents(records, filename=filename)

    def _materialize_record(
        self,
        workspace_id: str,
        record_key: str,
        content: dict[str, Any],
    ) -> Path:
        path = workspace_file_path(
            type("Server", (), {"specspace_state_dir": self.materialization_root})(),
            workspace_id,
            record_key,
        )
        root = self.materialization_root.resolve()
        resolved = path.resolve()
        try:
            resolved.relative_to(root)
        except ValueError as exc:
            raise StateBackendError(
                "external state materialization escaped its root"
            ) from exc
        _atomic_write(resolved, content)
        return resolved

    def _current_revision(self, workspace_id: str, filename: str) -> int:
        revisions = self._revision_map()
        key = (workspace_id, filename)
        if key not in revisions:
            if filename in STATE_COLLECTION_KEYS:
                self.read(filename, workspace_id=workspace_id)
            else:
                params = urllib.parse.urlencode(
                    {"workspace_id": workspace_id, "record_key": filename}
                )
                try:
                    payload = self._request(
                        f"/v1/specspace-state/record?{params}"
                    )
                except StateBackendNotFound:
                    return 0
                record = payload.get("record")
                if (
                    not isinstance(record, dict)
                    or record.get("contract_ref") != RECORD_CONTRACT_REF
                    or record.get("workspace_id") != workspace_id
                    or record.get("record_key") != filename
                    or not isinstance(record.get("revision"), int)
                    or not self._boundary_trusted(payload)
                ):
                    raise StateBackendUnavailable(
                        "external state record identity is invalid"
                    )
                revisions[key] = record["revision"]
        return revisions.get(key, 0)

    def read_record(
        self,
        record_key: str,
        *,
        workspace_id: str,
    ) -> dict[str, Any] | None:
        record_key = validate_record_key(
            record_key,
            workspace_id=workspace_id,
        )
        params = urllib.parse.urlencode(
            {"workspace_id": workspace_id, "record_key": record_key}
        )
        try:
            payload = self._request(
                f"/v1/specspace-state/record?{params}"
            )
        except StateBackendNotFound:
            return None
        if (
            payload.get("artifact_kind")
            != "platform_specspace_state_record_report"
            or payload.get("ok") is not True
            or not self._boundary_trusted(payload)
        ):
            raise StateBackendUnavailable(
                "external state record report failed contract validation"
            )
        record = self._validate_record(
            payload.get("record"),
            expected_filename=record_key,
            expected_workspace_id=workspace_id,
        )
        self._revision_map()[(workspace_id, record_key)] = record["revision"]
        self._materialize_record(workspace_id, record_key, record["content"])
        return record

    def _mutate_record(
        self,
        *,
        workspace_id: str,
        record_key: str,
        content: dict[str, Any],
        lifecycle_state: str,
    ) -> dict[str, Any]:
        digest = content_sha256(content)
        expected_revision = self._current_revision(workspace_id, record_key)
        record_key_digest = hashlib.sha256(record_key.encode("utf-8")).hexdigest()[:16]
        idempotency_key = (
            f"specspace-state:{workspace_id}:{record_key_digest}:"
            f"{expected_revision}:{digest}"
        )
        payload = self._request(
            "/v1/specspace-state/record",
            method="PUT",
            payload={
                "workspace_id": workspace_id,
                "record_key": record_key,
                "expected_revision": expected_revision,
                "idempotency_key": idempotency_key,
                "lifecycle_state": lifecycle_state,
                "content": content,
                "content_sha256": digest,
            },
        )
        if (
            payload.get("artifact_kind")
            != "platform_specspace_state_mutation_report"
            or payload.get("ok") is not True
            or not self._boundary_trusted(payload)
        ):
            raise StateBackendUnavailable(
                "external state mutation report failed contract validation"
            )
        record = payload.get("record")
        if (
            not isinstance(record, dict)
            or record.get("workspace_id") != workspace_id
            or record.get("record_key") != record_key
            or record.get("content_sha256") != digest
            or not isinstance(record.get("revision"), int)
        ):
            raise StateBackendUnavailable(
                "external state mutation identity is invalid"
            )
        self._revision_map()[(workspace_id, record_key)] = record["revision"]
        self._materialize_record(workspace_id, record_key, content)
        return record

    def write(
        self,
        filename: str,
        *,
        workspace_id: str,
        state: dict[str, Any],
    ) -> dict[str, Any]:
        document = _workspace_document(
            state,
            filename=filename,
            workspace_id=workspace_id,
        )
        if "state_path" in document:
            document["state_path"] = f"specspace-state://{filename}"
        return self._mutate_record(
            workspace_id=workspace_id,
            record_key=filename,
            content=document,
            lifecycle_state=_lifecycle_state(document, filename=filename),
        )

    def materialize(
        self,
        filename: str,
        *,
        workspace_id: str,
    ) -> Path | None:
        state = self.read(filename, workspace_id=workspace_id)
        if state is None:
            return None
        return self._materialize_record(workspace_id, filename, state)

    def ref_exists(self, ref: str, *, workspace_id: str) -> bool:
        if not ref.startswith("specspace-state://"):
            return False
        record_key = ref.removeprefix("specspace-state://")
        try:
            record_key = validate_record_key(
                record_key,
                workspace_id=workspace_id,
            )
        except StateBackendError:
            return False
        if record_key in STATE_COLLECTION_KEYS:
            state = self.read(record_key, workspace_id=workspace_id)
            if state is None:
                return False
            collection = state.get(_collection_key(record_key))
            return isinstance(collection, list) and bool(collection)
        try:
            record = self.read_record(
                record_key,
                workspace_id=workspace_id,
            )
        except StateBackendUnavailable:
            return False
        return record is not None

    def write_record(
        self,
        record_key: str,
        *,
        workspace_id: str,
        content: dict[str, Any],
        lifecycle_state: str = "active",
    ) -> dict[str, Any]:
        record_key = validate_record_key(
            record_key,
            workspace_id=workspace_id,
        )
        return self._mutate_record(
            workspace_id=workspace_id,
            record_key=record_key,
            content=content,
            lifecycle_state=lifecycle_state,
        )


def backend(server: Any) -> FileStateBackend | ExternalHTTPStateBackend:
    configured = getattr(server, "specspace_state_backend", None)
    if isinstance(configured, (FileStateBackend, ExternalHTTPStateBackend)):
        return configured
    configured = FileStateBackend(_state_dir(server))
    server.specspace_state_backend = configured
    return configured


def read_state(
    server: Any,
    filename: str,
    *,
    workspace_id: str | None,
) -> dict[str, Any] | None:
    return backend(server).read(filename, workspace_id=workspace_id)


def write_state(
    server: Any,
    filename: str,
    *,
    workspace_id: str,
    state: dict[str, Any],
) -> dict[str, Any]:
    return backend(server).write(
        filename,
        workspace_id=workspace_id,
        state=state,
    )


def materialize_state(
    server: Any,
    filename: str,
    *,
    workspace_id: str,
) -> Path | None:
    return backend(server).materialize(filename, workspace_id=workspace_id)


def state_ref_exists(server: Any, ref: str, *, workspace_id: str) -> bool:
    return backend(server).ref_exists(ref, workspace_id=workspace_id)


def write_state_record(
    server: Any,
    record_key: str,
    *,
    workspace_id: str,
    content: dict[str, Any],
    lifecycle_state: str = "active",
) -> dict[str, Any]:
    return backend(server).write_record(
        record_key,
        workspace_id=workspace_id,
        content=content,
        lifecycle_state=lifecycle_state,
    )
