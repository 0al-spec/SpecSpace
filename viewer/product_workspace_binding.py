"""Durable product workspace binding discovery and public projection."""

from __future__ import annotations

import hashlib
import json
import re
import urllib.parse
from pathlib import Path
from typing import Any

BINDING_KIND = "platform_product_workspace_binding"
BINDING_CONTRACT_REF = "platform.product-workspace.binding.v1"
INITIALIZATION_REPORT_KIND = "platform_product_workspace_initialization_execution_report"
INITIALIZATION_REPORT_FILENAME = (
    "platform_product_workspace_initialization_execution_report.json"
)
WORKSPACE_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _safe_public_ref(value: Any) -> str | None:
    ref = _text(value)
    if ref is None or "\x00" in ref or "\n" in ref or "\r" in ref:
        return None
    if ref.startswith(("runs/", "workspaces/", "specspace-state://")):
        path_part = ref.split("://", 1)[-1]
        if ".." not in Path(path_part).parts:
            return ref
    return None


def bound_run_ref(binding: Any, ref: str) -> str:
    """Resolve a logical run ref under a ready workspace binding."""
    if not ref.startswith("runs/") or not isinstance(binding, dict):
        return ref
    if binding.get("status") != "ready" or binding.get("trusted") is not True:
        return ref
    routing = _record(binding.get("routing"))
    execution = _record(binding.get("execution"))
    run_dir_ref = _text(
        routing.get("platform_default_run_dir_ref")
        or execution.get("platform_default_run_dir_ref")
    )
    if run_dir_ref is None or not run_dir_ref.startswith("runs/"):
        return ref
    suffix = ref.removeprefix("runs/")
    prefix = run_dir_ref.removeprefix("runs/") + "/"
    return ref if suffix.startswith(prefix) else f"{run_dir_ref}/{suffix}"


def _binding_revision(binding: dict[str, Any]) -> str:
    identity = _record(binding.get("identity"))
    routing = _record(binding.get("routing"))
    execution = _record(binding.get("execution"))
    logical = {
        "workspace_id": identity.get("workspace_id"),
        "display_name": identity.get("display_name"),
        "route": identity.get("route"),
        "repository_role": identity.get("repository_role"),
        "governance_profile": identity.get("governance_profile"),
        "specspace_state_namespace_ref": routing.get(
            "specspace_state_namespace_ref"
        ),
        "platform_default_run_dir_ref": execution.get(
            "platform_default_run_dir_ref"
        ),
        "product_artifact_bundle_ref": routing.get(
            "product_artifact_bundle_ref"
        ),
        "product_artifact_manifest_ref": routing.get(
            "product_artifact_manifest_ref"
        ),
        "root_artifact_base_url": routing.get("root_artifact_base_url"),
        "product_artifact_base_url": routing.get(
            "product_artifact_base_url"
        ),
    }
    return hashlib.sha256(
        json.dumps(logical, sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
    ).hexdigest()


def validate_binding(
    binding: Any,
    *,
    workspace_id: str,
    require_ready: bool = True,
) -> list[str]:
    if not isinstance(binding, dict):
        return ["workspace_binding_missing"]
    reasons: list[str] = []
    if binding.get("artifact_kind") != BINDING_KIND:
        reasons.append("workspace_binding_kind_mismatch")
    if binding.get("schema_version") != 1:
        reasons.append("workspace_binding_schema_unsupported")
    if binding.get("contract_ref") != BINDING_CONTRACT_REF:
        reasons.append("workspace_binding_contract_mismatch")
    identity = _record(binding.get("identity"))
    if identity.get("workspace_id") != workspace_id:
        reasons.append("workspace_binding_workspace_mismatch")
    if identity.get("route") != f"/{workspace_id}":
        reasons.append("workspace_binding_route_mismatch")
    if identity.get("repository_role") != "product_spec_workspace":
        reasons.append("workspace_binding_repository_role_mismatch")
    if binding.get("binding_id") != (
        f"product-workspace-binding://{workspace_id}"
    ):
        reasons.append("workspace_binding_id_mismatch")
    routing = _record(binding.get("routing"))
    if routing.get("specspace_state_namespace_ref") != (
        f"specspace-state://workspace/{workspace_id}"
    ):
        reasons.append("workspace_binding_state_namespace_mismatch")
    if routing.get("product_artifact_bundle_ref") != f"workspaces/{workspace_id}":
        reasons.append("workspace_binding_artifact_bundle_mismatch")
    if routing.get("product_artifact_manifest_ref") != (
        f"workspaces/{workspace_id}/artifact_manifest.json"
    ):
        reasons.append("workspace_binding_artifact_manifest_mismatch")
    root_artifact_base_url = routing.get("root_artifact_base_url")
    product_artifact_base_url = routing.get("product_artifact_base_url")
    for field, value in (
        ("root_artifact_base_url", root_artifact_base_url),
        ("product_artifact_base_url", product_artifact_base_url),
    ):
        if value is None:
            continue
        parsed = urllib.parse.urlparse(value) if isinstance(value, str) else None
        if (
            parsed is None
            or parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
        ):
            reasons.append(f"workspace_binding_artifact_url_invalid:{field}")
    expected_manifest_url = (
        f"{product_artifact_base_url.rstrip('/')}/artifact_manifest.json"
        if isinstance(product_artifact_base_url, str)
        and product_artifact_base_url.strip()
        else None
    )
    if routing.get("product_artifact_manifest_url") != expected_manifest_url:
        reasons.append("workspace_binding_artifact_manifest_url_mismatch")
    execution = _record(binding.get("execution"))
    run_dir_ref = execution.get("platform_default_run_dir_ref")
    if run_dir_ref != f"runs/{workspace_id}":
        reasons.append("workspace_binding_run_dir_invalid")
    if execution.get("local_only") is not True:
        reasons.append("workspace_binding_local_resolution_not_private")
    repository = _record(binding.get("repository"))
    if (
        repository.get("repository_role") != "product_spec_workspace"
        or repository.get("workspace_identity") != workspace_id
        or repository.get("worktree_identity")
        != f"product-workspace/{workspace_id}"
        or repository.get("creates_worktree") is not False
    ):
        reasons.append("workspace_binding_repository_identity_mismatch")
    privacy = _record(binding.get("privacy_boundary"))
    for field, expected in (
        ("public_safe_projection_available", True),
        ("local_execution_paths_public", False),
        ("raw_idea_public", False),
    ):
        if privacy.get(field) is not expected:
            reasons.append(f"workspace_binding_privacy_invalid:{field}")
    if require_ready and binding.get("status") != "ready":
        reasons.append("workspace_binding_not_ready")
    if binding.get("binding_revision_sha256") != _binding_revision(binding):
        reasons.append("workspace_binding_revision_mismatch")
    authority = _record(binding.get("binding_authority"))
    if authority.get("report_only") is not True:
        reasons.append("workspace_binding_authority_expanded:report_only")
    for key, value in authority.items():
        if key.startswith("may_") and value is not False:
            reasons.append(f"workspace_binding_authority_expanded:{key}")
    return sorted(set(reasons))


def project_published_initialization_binding(
    report: Any,
    *,
    workspace_id: str,
    source_ref: str,
    source_sha256: str,
) -> dict[str, Any]:
    """Validate and sanitize a public initialization report without local paths."""
    if (
        not isinstance(report, dict)
        or report.get("artifact_kind") != INITIALIZATION_REPORT_KIND
    ):
        return {
            "available": False,
            "status": "invalid",
            "trusted": False,
            "workspace_id": workspace_id,
            "reasons": ["workspace_initialization_report_invalid"],
        }
    binding = _record(report.get("workspace_binding"))
    reasons = validate_binding(binding, workspace_id=workspace_id)
    summary = _record(report.get("summary"))
    if (
        report.get("ok") is not True
        or report.get("dry_run") is True
        or summary.get("status") != "workspace_initialization_executed"
    ):
        reasons.append("workspace_initialization_not_ready")
    if _safe_public_ref(source_ref) is None:
        reasons.append("workspace_binding_source_ref_invalid")
    if not re.fullmatch(r"[0-9a-f]{64}", source_sha256):
        reasons.append("workspace_binding_source_digest_invalid")
    if reasons:
        return {
            "available": True,
            "status": "invalid",
            "trusted": False,
            "workspace_id": workspace_id,
            "reasons": sorted(set(reasons)),
        }

    identity = _record(binding.get("identity"))
    routing = _record(binding.get("routing"))
    execution = _record(binding.get("execution"))
    repository = _record(binding.get("repository"))
    provenance = _record(binding.get("provenance"))
    return {
        "available": True,
        "status": "ready",
        "trusted": True,
        "workspace_id": workspace_id,
        "binding_id": _text(binding.get("binding_id")),
        "binding_revision_sha256": _text(binding.get("binding_revision_sha256")),
        "source_ref": source_ref,
        "source_sha256": source_sha256,
        "identity": {
            "workspace_id": workspace_id,
            "display_name": _text(identity.get("display_name")),
            "route": _text(identity.get("route")),
            "governance_profile": _text(identity.get("governance_profile")),
            "repository_role": _text(identity.get("repository_role")),
        },
        "routing": {
            "specspace_state_namespace_ref": _text(
                routing.get("specspace_state_namespace_ref")
            ),
            "root_artifact_base_url": _text(routing.get("root_artifact_base_url")),
            "platform_default_run_dir_ref": _text(
                execution.get("platform_default_run_dir_ref")
            ),
            "product_artifact_bundle_ref": _text(
                routing.get("product_artifact_bundle_ref")
            ),
            "product_artifact_manifest_ref": _text(
                routing.get("product_artifact_manifest_ref")
            ),
            "product_artifact_base_url": _text(
                routing.get("product_artifact_base_url")
            ),
            "product_artifact_manifest_url": _text(
                routing.get("product_artifact_manifest_url")
            ),
        },
        "repository": {
            "repository_role": _text(repository.get("repository_role")),
            "workspace_identity": _text(repository.get("workspace_identity")),
            "worktree_identity": _text(repository.get("worktree_identity")),
            "creates_worktree": repository.get("creates_worktree") is True,
        },
        "provenance": {
            "plan_ref": _safe_public_ref(provenance.get("plan_ref")),
            "plan_sha256": _text(provenance.get("plan_sha256")),
            "specgraph_initialization_report_ref": _safe_public_ref(
                provenance.get("specgraph_initialization_report_ref")
            ),
            "specgraph_initialization_report_sha256": _text(
                provenance.get("specgraph_initialization_report_sha256")
            ),
        },
        "local_resolution": {
            "workspace_root_configured": bool(_text(execution.get("workspace_root"))),
            "workspace_runs_root_configured": bool(
                _text(execution.get("workspace_runs_root"))
            ),
            "local_only": execution.get("local_only") is True,
        },
        "initialization": {
            "status": _text(summary.get("status")),
            "specgraph_executed": summary.get("specgraph_executed") is True,
            "catalog_written": summary.get("catalog_written") is True,
            "workspace_files_created": summary.get("workspace_files_created") is True,
            "error_count": (
                summary.get("error_count")
                if isinstance(summary.get("error_count"), int)
                and not isinstance(summary.get("error_count"), bool)
                else None
            ),
        },
        "reasons": [],
        "authority_boundary": {
            "report_only": True,
            "workspace_binding_is_execution_authority": False,
            "may_execute_platform": False,
            "may_execute_specgraph": False,
            "may_mutate_specspace_state": False,
            "may_write_catalog": False,
            "may_create_git_commit": False,
            "may_open_pull_request": False,
            "may_publish_read_model": False,
        },
    }


def validate_projection(projection: Any, *, workspace_id: str) -> list[str]:
    """Validate the public-safe binding projection used by hosted consumers."""
    if not isinstance(projection, dict):
        return ["workspace_binding_projection_missing"]
    reasons: list[str] = []
    if projection.get("available") is not True:
        reasons.append("workspace_binding_projection_unavailable")
    if projection.get("status") != "ready" or projection.get("trusted") is not True:
        reasons.append("workspace_binding_projection_not_ready")
    if projection.get("workspace_id") != workspace_id:
        reasons.append("workspace_binding_projection_workspace_mismatch")
    if projection.get("binding_id") != f"product-workspace-binding://{workspace_id}":
        reasons.append("workspace_binding_projection_id_mismatch")
    for field in ("binding_revision_sha256", "source_sha256"):
        if not re.fullmatch(r"[0-9a-f]{64}", _text(projection.get(field)) or ""):
            reasons.append(f"workspace_binding_projection_digest_invalid:{field}")

    source_ref = _safe_public_ref(projection.get("source_ref"))
    if source_ref is None or not source_ref.startswith("runs/"):
        reasons.append("workspace_binding_projection_source_ref_invalid")

    identity = _record(projection.get("identity"))
    if (
        identity.get("workspace_id") != workspace_id
        or identity.get("route") != f"/{workspace_id}"
        or identity.get("repository_role") != "product_spec_workspace"
    ):
        reasons.append("workspace_binding_projection_identity_mismatch")

    routing = _record(projection.get("routing"))
    if routing.get("specspace_state_namespace_ref") != (
        f"specspace-state://workspace/{workspace_id}"
    ):
        reasons.append("workspace_binding_projection_state_namespace_mismatch")
    if routing.get("platform_default_run_dir_ref") != f"runs/{workspace_id}":
        reasons.append("workspace_binding_projection_run_dir_mismatch")
    if routing.get("product_artifact_bundle_ref") != f"workspaces/{workspace_id}":
        reasons.append("workspace_binding_projection_artifact_bundle_mismatch")

    repository = _record(projection.get("repository"))
    if (
        repository.get("repository_role") != "product_spec_workspace"
        or repository.get("workspace_identity") != workspace_id
        or repository.get("worktree_identity") != f"product-workspace/{workspace_id}"
        or repository.get("creates_worktree") is not False
    ):
        reasons.append("workspace_binding_projection_repository_mismatch")

    authority = _record(projection.get("authority_boundary"))
    if (
        authority.get("report_only") is not True
        or authority.get("workspace_binding_is_execution_authority") is not False
    ):
        reasons.append("workspace_binding_projection_authority_invalid")
    for key, value in authority.items():
        if key.startswith("may_") and value is not False:
            reasons.append(f"workspace_binding_projection_authority_expanded:{key}")
    return sorted(set(reasons))


def _candidate_reports(runs_dir: Path) -> list[Path]:
    candidates = [runs_dir / INITIALIZATION_REPORT_FILENAME]
    if runs_dir.exists() and runs_dir.is_dir():
        candidates.extend(
            path
            for path in runs_dir.glob(f"*/{INITIALIZATION_REPORT_FILENAME}")
            if path.is_file()
        )
    return candidates


def _load_report(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def discover_binding(
    server: Any,
    *,
    workspace_id: str | None,
) -> dict[str, Any]:
    runs_dir = getattr(server, "runs_dir", None)
    if (
        not isinstance(workspace_id, str)
        or not WORKSPACE_ID_RE.fullmatch(workspace_id)
        or not isinstance(runs_dir, Path)
    ):
        return {
            "available": False,
            "status": "missing",
            "trusted": False,
            "workspace_id": workspace_id,
            "reasons": ["workspace_binding_missing"],
        }

    matching: list[tuple[Path, dict[str, Any], dict[str, Any]]] = []
    invalid_reasons: list[str] = []
    for path in _candidate_reports(runs_dir):
        report = _load_report(path)
        if report is None or report.get("artifact_kind") != INITIALIZATION_REPORT_KIND:
            continue
        report_workspace_id = _text(
            _record(report.get("workspace")).get("workspace_id")
        )
        if report_workspace_id != workspace_id:
            continue
        binding = _record(report.get("workspace_binding"))
        reasons = validate_binding(binding, workspace_id=workspace_id)
        if (
            report.get("ok") is not True
            or report.get("dry_run") is True
            or _record(report.get("summary")).get("status")
            != "workspace_initialization_executed"
        ):
            reasons.append("workspace_initialization_not_ready")
        if reasons:
            invalid_reasons.extend(reasons)
            continue
        matching.append((path, report, binding))

    if not matching:
        return {
            "available": bool(invalid_reasons),
            "status": "invalid" if invalid_reasons else "legacy_read_only",
            "trusted": False,
            "workspace_id": workspace_id,
            "reasons": sorted(set(invalid_reasons))
            if invalid_reasons
            else ["durable_workspace_binding_not_published"],
        }

    path, report, binding = sorted(
        matching,
        key=lambda item: (
            str(item[1].get("generated_at") or ""),
            item[0].as_posix(),
        ),
    )[-1]
    identity = _record(binding.get("identity"))
    routing = _record(binding.get("routing"))
    execution = _record(binding.get("execution"))
    repository = _record(binding.get("repository"))
    provenance = _record(binding.get("provenance"))
    initialization_summary = _record(report.get("summary"))
    try:
        relative_source = path.resolve().relative_to(runs_dir.resolve())
        run_dir_ref = _text(execution.get("platform_default_run_dir_ref"))
        if relative_source.parts and relative_source.parts[0] == workspace_id:
            source_ref = f"runs/{relative_source.as_posix()}"
        elif runs_dir.name == workspace_id and run_dir_ref == f"runs/{workspace_id}":
            source_ref = f"{run_dir_ref}/{relative_source.as_posix()}"
        else:
            source_ref = f"runs/{relative_source.as_posix()}"
    except ValueError:
        source_ref = None
    return {
        "available": True,
        "status": "ready",
        "trusted": True,
        "workspace_id": workspace_id,
        "binding_id": _text(binding.get("binding_id")),
        "binding_revision_sha256": _text(
            binding.get("binding_revision_sha256")
        ),
        "source_ref": source_ref,
        "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "identity": {
            "workspace_id": workspace_id,
            "display_name": _text(identity.get("display_name")),
            "route": _text(identity.get("route")),
            "governance_profile": _text(identity.get("governance_profile")),
            "repository_role": _text(identity.get("repository_role")),
        },
        "routing": {
            "specspace_state_namespace_ref": _text(
                routing.get("specspace_state_namespace_ref")
            ),
            "root_artifact_base_url": _text(
                routing.get("root_artifact_base_url")
            ),
            "platform_default_run_dir_ref": _text(
                execution.get("platform_default_run_dir_ref")
            ),
            "product_artifact_bundle_ref": _text(
                routing.get("product_artifact_bundle_ref")
            ),
            "product_artifact_manifest_ref": _text(
                routing.get("product_artifact_manifest_ref")
            ),
            "product_artifact_base_url": _text(
                routing.get("product_artifact_base_url")
            ),
            "product_artifact_manifest_url": _text(
                routing.get("product_artifact_manifest_url")
            ),
        },
        "repository": {
            "repository_role": _text(repository.get("repository_role")),
            "workspace_identity": _text(repository.get("workspace_identity")),
            "worktree_identity": _text(repository.get("worktree_identity")),
            "creates_worktree": repository.get("creates_worktree") is True,
        },
        "provenance": {
            "plan_ref": _safe_public_ref(provenance.get("plan_ref")),
            "plan_sha256": _text(provenance.get("plan_sha256")),
            "specgraph_initialization_report_ref": _safe_public_ref(
                provenance.get("specgraph_initialization_report_ref")
            ),
            "specgraph_initialization_report_sha256": _text(
                provenance.get("specgraph_initialization_report_sha256")
            ),
        },
        "local_resolution": {
            "workspace_root_configured": bool(
                _text(execution.get("workspace_root"))
            ),
            "workspace_runs_root_configured": bool(
                _text(execution.get("workspace_runs_root"))
            ),
            "local_only": execution.get("local_only") is True,
        },
        "initialization": {
            "status": _text(initialization_summary.get("status")),
            "specgraph_executed": (
                initialization_summary.get("specgraph_executed") is True
            ),
            "catalog_written": (
                initialization_summary.get("catalog_written") is True
            ),
            "workspace_files_created": (
                initialization_summary.get("workspace_files_created") is True
            ),
            "error_count": (
                initialization_summary.get("error_count")
                if isinstance(initialization_summary.get("error_count"), int)
                and not isinstance(initialization_summary.get("error_count"), bool)
                else None
            ),
        },
        "reasons": [],
        "authority_boundary": {
            "report_only": True,
            "workspace_binding_is_execution_authority": False,
            "may_execute_platform": False,
            "may_execute_specgraph": False,
            "may_mutate_specspace_state": False,
            "may_write_catalog": False,
            "may_create_git_commit": False,
            "may_open_pull_request": False,
            "may_publish_read_model": False,
        },
    }


def workspace_runs_dir(
    server: Any,
    *,
    workspace_id: str | None,
) -> Path | None:
    runs_dir = getattr(server, "runs_dir", None)
    if not isinstance(runs_dir, Path):
        return None
    projection = discover_binding(server, workspace_id=workspace_id)
    if projection.get("status") != "ready":
        return runs_dir
    run_dir_ref = _text(_record(projection.get("routing")).get(
        "platform_default_run_dir_ref"
    ))
    if run_dir_ref is None:
        return runs_dir
    candidate = (runs_dir.parent / run_dir_ref).resolve()
    try:
        candidate.relative_to(runs_dir.resolve())
    except ValueError:
        return runs_dir
    return candidate


def binding_report_path(server: Any, *, workspace_id: str | None) -> Path | None:
    runs_dir = getattr(server, "runs_dir", None)
    if not isinstance(runs_dir, Path):
        return None
    projection = discover_binding(server, workspace_id=workspace_id)
    source_ref = _safe_public_ref(projection.get("source_ref"))
    if projection.get("status") != "ready" or source_ref is None:
        return None
    candidate = (runs_dir.parent / source_ref).resolve()
    try:
        candidate.relative_to(runs_dir.resolve())
    except ValueError:
        return None
    return candidate if candidate.is_file() else None
