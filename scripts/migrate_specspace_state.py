#!/usr/bin/env python3
"""Migrate legacy file-backed SpecSpace state to the external state service."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
import tempfile
from typing import Any
import urllib.parse


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from viewer import specspace_provider, specspace_state_backend


REPORT_KIND = "specspace_external_state_migration_report"
ONTOLOGY_WORKBENCH_WORKSPACE_ID = "ontology-workbench"


class MigrationError(RuntimeError):
    pass


@dataclass(frozen=True)
class PlannedRecord:
    workspace_id: str
    record_key: str
    content: dict[str, Any]
    lifecycle_state: str
    source_ref: str


def now_iso() -> str:
    return (
        datetime.now(tz=timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _load_object(path: Path) -> dict[str, Any]:
    if path.is_symlink():
        raise MigrationError(f"state source must not be a symlink: {path.name}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise MigrationError(f"state source is unreadable: {path.name}") from exc
    if not isinstance(payload, dict):
        raise MigrationError(f"state source must contain an object: {path.name}")
    return payload


def _workspace_id(value: Any, *, source_name: str) -> str:
    normalized = specspace_provider.normalize_workspace_id(
        value if isinstance(value, str) else None
    )
    if normalized is None:
        raise MigrationError(
            f"state entry has no valid workspace_id: {source_name}"
        )
    return normalized


def _collection_records(
    source_dir: Path,
    filename: str,
) -> list[PlannedRecord]:
    path = source_dir / filename
    if not path.exists():
        return []
    payload = _load_object(path)
    collection_key = specspace_state_backend.STATE_COLLECTION_KEYS[filename]
    entries = payload.get(collection_key)
    if not isinstance(entries, list):
        raise MigrationError(
            f"state source {collection_key} must be an array: {filename}"
        )
    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise MigrationError(
                f"state source contains a non-object entry: {filename}"
            )
        if filename == "ontology_owner_decision_acknowledgements.json":
            workspace_id = ONTOLOGY_WORKBENCH_WORKSPACE_ID
            normalized_entry = {
                **entry,
                "workspace_id": workspace_id,
            }
        else:
            workspace_id = _workspace_id(
                entry.get("workspace_id"),
                source_name=filename,
            )
            normalized_entry = entry
        grouped.setdefault(workspace_id, []).append(normalized_entry)

    records: list[PlannedRecord] = []
    for workspace_id, workspace_entries in sorted(grouped.items()):
        document = {
            **payload,
            "state_path": f"specspace-state://{filename}",
            collection_key: workspace_entries,
        }
        if "selected_workspace_id" in document:
            document["selected_workspace_id"] = workspace_id
        records.append(
            PlannedRecord(
                workspace_id=workspace_id,
                record_key=filename,
                content=document,
                lifecycle_state=specspace_state_backend.lifecycle_state(
                    document,
                    filename=filename,
                ),
                source_ref=f"specspace-state://legacy/{filename}",
            )
        )
    return records


def _confirmation_records(source_dir: Path) -> list[PlannedRecord]:
    confirmation_root = source_dir / "confirmations"
    if not confirmation_root.exists():
        return []
    if confirmation_root.is_symlink() or not confirmation_root.is_dir():
        raise MigrationError("confirmation source must be a real directory")
    records: list[PlannedRecord] = []
    for path in sorted(confirmation_root.rglob("*.json")):
        relative = path.relative_to(source_dir)
        parts = relative.parts
        if len(parts) != 4:
            raise MigrationError("confirmation state path is not workspace scoped")
        workspace_id = _workspace_id(
            parts[1],
            source_name=relative.as_posix(),
        )
        record_key = specspace_state_backend.validate_record_key(
            relative.as_posix(),
            workspace_id=workspace_id,
        )
        content = _load_object(path)
        records.append(
            PlannedRecord(
                workspace_id=workspace_id,
                record_key=record_key,
                content=content,
                lifecycle_state="active",
                source_ref=f"specspace-state://legacy/{relative.as_posix()}",
            )
        )
    return records


def plan_records(source_dir: Path) -> list[PlannedRecord]:
    if source_dir.is_symlink() or not source_dir.is_dir():
        raise MigrationError("legacy SpecSpace state directory is unavailable")
    records: list[PlannedRecord] = []
    for filename in sorted(specspace_state_backend.STATE_COLLECTION_KEYS):
        records.extend(_collection_records(source_dir, filename))
    records.extend(_confirmation_records(source_dir))
    identities = [
        (record.workspace_id, record.record_key)
        for record in records
    ]
    if len(identities) != len(set(identities)):
        raise MigrationError("migration plan contains duplicate record identities")
    return records


def _service_url(value: str) -> str:
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise MigrationError("external state service URL must use HTTP(S)")
    if (
        parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise MigrationError(
            "external state service URL must not contain credentials, query, or fragment"
        )
    if (
        parsed.scheme != "https"
        and parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
    ):
        raise MigrationError(
            "non-loopback external state service URL must use HTTPS"
        )
    return value.rstrip("/")


def _token(path: Path) -> str:
    if path.is_symlink() or not path.is_file():
        raise MigrationError("external state token file is unavailable")
    try:
        token = path.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise MigrationError("external state token file is unreadable") from exc
    if len(token) < 32:
        raise MigrationError(
            "external state token must contain at least 32 characters"
        )
    return token


def migrate(
    records: list[PlannedRecord],
    *,
    backend: specspace_state_backend.ExternalHTTPStateBackend,
    apply: bool,
) -> list[dict[str, Any]]:
    health = backend.health()
    if health.get("ready") is not True:
        raise MigrationError("external state service health is not trusted")
    results: list[dict[str, Any]] = []
    for planned in records:
        if planned.record_key in specspace_state_backend.STATE_COLLECTION_KEYS:
            current_content = backend.read(
                planned.record_key,
                workspace_id=planned.workspace_id,
            )
        else:
            current_record = backend.read_record(
                planned.record_key,
                workspace_id=planned.workspace_id,
            )
            current_content = (
                current_record["content"]
                if current_record is not None
                else None
            )
        digest = specspace_state_backend.content_sha256(planned.content)
        if current_content is not None:
            current_digest = specspace_state_backend.content_sha256(
                current_content
            )
            if current_digest != digest:
                raise MigrationError(
                    "destination state already exists with a different digest "
                    f"for {planned.workspace_id}/{planned.record_key}"
                )
            action = "unchanged"
        elif not apply:
            action = "planned"
        else:
            if planned.record_key in specspace_state_backend.STATE_COLLECTION_KEYS:
                persisted = backend.write(
                    planned.record_key,
                    workspace_id=planned.workspace_id,
                    state=planned.content,
                )
            else:
                persisted = backend.write_record(
                    planned.record_key,
                    workspace_id=planned.workspace_id,
                    content=planned.content,
                    lifecycle_state=planned.lifecycle_state,
                )
            if persisted.get("content_sha256") != digest:
                raise MigrationError(
                    "external state service returned a mismatched content digest"
                )
            action = "imported"
        results.append(
            {
                "workspace_id": planned.workspace_id,
                "record_key": planned.record_key,
                "source_ref": planned.source_ref,
                "content_sha256": digest,
                "lifecycle_state": planned.lifecycle_state,
                "action": action,
            }
        )
    return results


def report(
    *,
    apply: bool,
    records: list[dict[str, Any]],
    status: str,
    error: str | None = None,
) -> dict[str, Any]:
    return {
        "artifact_kind": REPORT_KIND,
        "schema_version": 1,
        "generated_at": now_iso(),
        "ok": status in {"migration_planned", "migration_completed"},
        "status": status,
        "apply": apply,
        "records": records,
        "summary": {
            "record_count": len(records),
            "planned_count": sum(
                item.get("action") == "planned" for item in records
            ),
            "imported_count": sum(
                item.get("action") == "imported" for item in records
            ),
            "unchanged_count": sum(
                item.get("action") == "unchanged" for item in records
            ),
            "error": error,
        },
        "authority_boundary": {
            "migration_grants_execution_authority": False,
            "executes_platform_wrappers": False,
            "executes_specgraph": False,
            "mutates_candidate_artifacts": False,
            "mutates_canonical_specs": False,
            "writes_ontology_packages": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
        },
    }


def _atomic_report(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary = Path(name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
        path.chmod(0o600)
    finally:
        temporary.unlink(missing_ok=True)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description=(
            "Plan or apply a private, workspace-scoped migration from the "
            "legacy SpecSpace file backend to the external state service."
        )
    )
    result.add_argument("--source-dir", type=Path, required=True)
    result.add_argument("--state-service-url", required=True)
    result.add_argument("--token-file", type=Path, required=True)
    result.add_argument("--materialization-dir", type=Path, required=True)
    result.add_argument("--report", type=Path, required=True)
    result.add_argument("--apply", action="store_true")
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    records: list[dict[str, Any]] = []
    try:
        planned = plan_records(args.source_dir.expanduser().resolve())
        backend = specspace_state_backend.ExternalHTTPStateBackend(
            config=specspace_state_backend.ExternalStateConfig(
                base_url=_service_url(args.state_service_url),
                token=_token(args.token_file.expanduser()),
                timeout_seconds=5.0,
            ),
            materialization_root=args.materialization_dir.expanduser().resolve(),
        )
        records = migrate(planned, backend=backend, apply=args.apply)
        payload = report(
            apply=args.apply,
            records=records,
            status="migration_completed" if args.apply else "migration_planned",
        )
        exit_code = 0
    except (
        MigrationError,
        specspace_state_backend.StateBackendError,
    ) as exc:
        payload = report(
            apply=args.apply,
            records=records,
            status="migration_blocked",
            error=str(exc),
        )
        exit_code = 1
    _atomic_report(args.report.expanduser().resolve(), payload)
    print(
        json.dumps(
            {
                "artifact_kind": REPORT_KIND,
                "ok": payload["ok"],
                "status": payload["status"],
                "report": str(args.report),
                "record_count": payload["summary"]["record_count"],
            },
            sort_keys=True,
        )
    )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
