"""Managed Platform review-status inspection for idea-to-spec promotion."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import idea_to_spec_workspace, specspace_provider

PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT = (
    idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
)
PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT = (
    idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
)


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _execution_disabled_payload(next_action: str | None = None) -> dict[str, Any]:
    return {
        "artifact_kind": "specspace_managed_review_status_execution",
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": next_action
            or (
                "Start SpecSpace with --enable-platform-execution, --platform-dir, "
                "and --specgraph-dir to run managed review-status inspection."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "inspects_review_status": False,
            "merges_pull_requests": False,
            "publishes_read_models": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
            "mutates_canonical_specs": False,
        },
    }


def _platform_script(server: Any) -> Path | None:
    platform_dir = getattr(server, "platform_dir", None)
    if not isinstance(platform_dir, Path):
        return None
    candidate = platform_dir / "scripts" / "platform.py"
    return candidate if candidate.is_file() else None


def _specgraph_dir(server: Any) -> Path | None:
    specgraph_dir = getattr(server, "specgraph_dir", None)
    if not isinstance(specgraph_dir, Path):
        return None
    return specgraph_dir if (specgraph_dir / "Makefile").is_file() else None


def _runs_dir(server: Any) -> Path | None:
    runs_dir = getattr(server, "runs_dir", None)
    return runs_dir if isinstance(runs_dir, Path) else None


def _runs_path(server: Any, filename: str) -> Path | None:
    runs_dir = _runs_dir(server)
    return runs_dir / filename if runs_dir is not None else None


def _load_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _promotion_execution_ready_for_review_status(path: Path) -> bool:
    payload = _load_json(path)
    if payload is None:
        return False
    summary = _record(payload.get("summary"))
    git_review = _record(payload.get("git_review"))
    return (
        payload.get("artifact_kind")
        == "platform_product_candidate_promotion_execution_report"
        and payload.get("ok") is True
        and payload.get("dry_run") is not True
        and payload.get("open_review_dry_run") is not True
        and (summary.get("review_opened") is True or git_review.get("review_opened") is True)
    )


def _promotion_execution_candidate_id(payload: dict[str, Any]) -> str | None:
    return _text(payload.get("candidate_id")) or _text(
        _record(payload.get("summary")).get("candidate_id")
    )


def execute_review_status(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    if getattr(server, "platform_execution_enabled", False) is not True:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()

    platform_script = _platform_script(server)
    if platform_script is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Configured Platform directory does not contain scripts/platform.py."
        )
    specgraph_dir = _specgraph_dir(server)
    if specgraph_dir is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Configured SpecGraph directory does not contain a Makefile."
        )

    payload_workspace_id = specspace_provider.normalize_product_workspace_id(
        _text(payload.get("workspace_id"))
    )
    selected_workspace_id = workspace_id or payload_workspace_id
    if (
        workspace_id is not None
        and payload_workspace_id is not None
        and workspace_id != payload_workspace_id
    ):
        return HTTPStatus.CONFLICT, {
            "error": "Review-status execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed review-status execution."
        }

    execution_report_path = _runs_path(
        server, PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
    )
    if execution_report_path is None or not execution_report_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Product promotion execution report artifact not found.",
            "execution_report_ref": (
                f"runs/{PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT}"
            ),
        }
    if not _promotion_execution_ready_for_review_status(execution_report_path):
        return HTTPStatus.CONFLICT, {
            "error": "Review-status inspection requires a non-dry-run promotion execution with an opened review.",
            "execution_report_ref": (
                f"runs/{PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT}"
            ),
            "reason": "promotion_execution_not_ready_for_review_status",
        }
    execution_report = _load_json(execution_report_path) or {}
    execution_candidate_id = specspace_provider.normalize_product_workspace_id(
        _promotion_execution_candidate_id(execution_report)
    )
    if execution_candidate_id != selected_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Promotion execution candidate_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": execution_candidate_id,
            "reason": "promotion_execution_workspace_mismatch",
        }

    runs_dir = _runs_dir(server)
    if runs_dir is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()
    output_path = runs_dir / PRODUCT_CANDIDATE_PROMOTION_REVIEW_STATUS_REPORT_ARTIFACT
    output_ref = f"runs/{output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"

    timeout = getattr(server, "platform_execution_timeout_seconds", 120)
    try:
        timeout_seconds = int(timeout)
    except (TypeError, ValueError):
        timeout_seconds = 120
    timeout_seconds = max(1, min(timeout_seconds, 600))

    command = [
        sys.executable,
        str(platform_script),
        "product-candidate-promotion",
        "review-status",
        "--execution-report",
        str(execution_report_path),
        "--output",
        str(output_path),
        "--format",
        "json",
    ]
    completed = subprocess.run(
        command,
        cwd=str(platform_script.parent.parent),
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
    )
    stdout = completed.stdout.strip()
    try:
        report = json.loads(stdout) if stdout else {}
    except json.JSONDecodeError:
        report = {}

    ok = completed.returncode == 0
    response = {
        "artifact_kind": "specspace_managed_review_status_execution",
        "ok": ok,
        "status": "completed" if ok else "failed",
        "workspace_id": selected_workspace_id,
        "execution_report_ref": (
            f"runs/{PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT}"
        ),
        "output_ref": output_ref,
        "platform_returncode": completed.returncode,
        "platform_report": report,
        "stderr_tail": completed.stderr[-2000:] if completed.stderr else "",
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "inspects_review_status": bool(ok),
            "merges_pull_requests": False,
            "publishes_read_models": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
            "mutates_canonical_specs": False,
        },
        "summary": {
            "status": "managed_review_status_inspected"
            if ok
            else "managed_review_status_failed",
            "executed": True,
            "output_ref": output_ref,
            "review_state": _text(report.get("review_state"))
            or _text(_record(report.get("summary")).get("review_state")),
            "review_merged": report.get("review_merged") is True
            or _record(report.get("summary")).get("review_merged") is True,
        },
    }
    return HTTPStatus.OK if ok else HTTPStatus.BAD_GATEWAY, response
