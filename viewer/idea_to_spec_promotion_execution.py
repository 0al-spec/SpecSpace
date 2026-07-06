"""Managed Platform execution for idea-to-spec promotion handoff."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import idea_to_spec_workspace, specspace_provider

GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT = (
    idea_to_spec_workspace.GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT
)
CANDIDATE_APPROVAL_DECISION_ARTIFACT = (
    idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT
)
PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT = (
    idea_to_spec_workspace.PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
)
GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT = (
    idea_to_spec_workspace.GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
)


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _execution_disabled_payload(
    next_action: str | None = None,
    *,
    review_execution: bool = False,
) -> dict[str, Any]:
    return {
        "artifact_kind": (
            "specspace_managed_promotion_review_execution"
            if review_execution
            else "specspace_managed_promotion_execution"
        ),
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": next_action
            or (
                "Start SpecSpace with --enable-platform-execution, --platform-dir, "
                "and --specgraph-dir to run managed promotion execution."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "executes_git_service_dry_run": False,
            "creates_candidate_worktree_or_branch": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
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


def _promotion_request_ready(path: Path) -> bool:
    payload = _load_json(path)
    if payload is None:
        return False
    return (
        payload.get("artifact_kind") == "platform_graph_repository_promotion_request"
        and payload.get("ok") is True
        and _record(payload.get("summary")).get("promotion_ready") is True
    )


def _promotion_request_candidate_id(payload: dict[str, Any]) -> str | None:
    return _text(payload.get("candidate_id")) or _text(
        _record(payload.get("summary")).get("candidate_id")
    )


def _approval_decision_ready(path: Path) -> bool:
    payload = _load_json(path)
    if payload is None:
        return False
    return (
        payload.get("artifact_kind") == "candidate_approval_decision"
        and _record(payload.get("readiness")).get("ready") is True
        and _record(payload.get("decision")).get("state") == "approved"
    )


def _approval_decision_candidate_id(payload: dict[str, Any]) -> str | None:
    return _text(_record(payload.get("candidate")).get("candidate_id")) or _text(
        payload.get("candidate_id")
    )


def _is_real_promotion_execution_report(path: Path) -> bool:
    payload = _load_json(path)
    if payload is None:
        return False
    return (
        payload.get("artifact_kind")
        == "platform_product_candidate_promotion_execution_report"
        and payload.get("dry_run") is False
        and payload.get("open_review_dry_run") is not True
    )


def _is_real_git_service_execution_report(path: Path) -> bool:
    payload = _load_json(path)
    if payload is None:
        return False
    return (
        payload.get("artifact_kind")
        == "platform_git_service_promotion_execution_report"
        and payload.get("dry_run") is False
        and payload.get("open_review_dry_run") is False
    )


def _promotion_dry_run_succeeded(path: Path) -> bool:
    payload = _load_json(path)
    if payload is None:
        return False
    summary = _record(payload.get("summary"))
    return (
        payload.get("artifact_kind")
        == "platform_product_candidate_promotion_execution_report"
        and payload.get("ok") is True
        and (
            payload.get("dry_run") is True
            or payload.get("open_review_dry_run") is True
        )
        and summary.get("error_count") in (None, 0)
    )


def _review_opened(report: dict[str, Any]) -> bool:
    summary = _record(report.get("summary"))
    git_review = _record(report.get("git_review"))
    return (
        report.get("review_opened") is True
        or summary.get("review_opened") is True
        or git_review.get("review_opened") is True
    )


def _promotion_review_opened(payload: dict[str, Any]) -> bool:
    return (
        payload.get("artifact_kind")
        == "platform_product_candidate_promotion_execution_report"
        and payload.get("ok") is True
        and payload.get("dry_run") is False
        and payload.get("open_review_dry_run") is not True
        and _review_opened(payload)
    )


def _workspace_dir(specgraph_dir: Path, workspace_id: str) -> Path:
    return specgraph_dir / ".platform" / "candidates" / workspace_id


def _execute_promotion(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
    review_execution: bool,
) -> tuple[HTTPStatus, dict[str, Any]]:
    if getattr(server, "platform_execution_enabled", False) is not True:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            review_execution=review_execution
        )

    platform_script = _platform_script(server)
    if platform_script is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Configured Platform directory does not contain scripts/platform.py.",
            review_execution=review_execution,
        )
    specgraph_dir = _specgraph_dir(server)
    if specgraph_dir is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            "Configured SpecGraph directory does not contain a Makefile.",
            review_execution=review_execution,
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
            "error": "Promotion execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed promotion execution."
        }
    if review_execution and payload.get("confirm_open_review") is not True:
        return HTTPStatus.BAD_REQUEST, {
            "error": "Non-dry-run promotion review execution requires confirm_open_review=true.",
            "reason": "missing_open_review_confirmation",
        }

    promotion_request_path = _runs_path(
        server, GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT
    )
    if promotion_request_path is None or not promotion_request_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Graph repository promotion request artifact not found.",
            "promotion_request_ref": (
                f"runs/{GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT}"
            ),
        }
    if not _promotion_request_ready(promotion_request_path):
        return HTTPStatus.CONFLICT, {
            "error": "Promotion execution requires a ready promotion request.",
            "promotion_request_ref": (
                f"runs/{GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT}"
            ),
            "reason": "promotion_request_not_ready",
        }
    promotion_request = _load_json(promotion_request_path) or {}
    request_candidate_id = specspace_provider.normalize_product_workspace_id(
        _promotion_request_candidate_id(promotion_request)
    )
    if request_candidate_id != selected_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Promotion request candidate_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": request_candidate_id,
            "reason": "promotion_request_workspace_mismatch",
        }

    approval_decision_path = _runs_path(server, CANDIDATE_APPROVAL_DECISION_ARTIFACT)
    if approval_decision_path is None or not approval_decision_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Candidate approval decision artifact not found.",
            "approval_decision_ref": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
        }
    if not _approval_decision_ready(approval_decision_path):
        return HTTPStatus.CONFLICT, {
            "error": "Promotion execution requires a ready approved candidate approval decision.",
            "approval_decision_ref": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
            "reason": "candidate_approval_decision_not_ready",
        }
    approval_decision = _load_json(approval_decision_path) or {}
    approval_candidate_id = specspace_provider.normalize_product_workspace_id(
        _approval_decision_candidate_id(approval_decision)
    )
    if approval_candidate_id != selected_workspace_id:
        return HTTPStatus.CONFLICT, {
            "error": "Candidate approval decision candidate_id does not match selected workspace.",
            "expected": selected_workspace_id,
            "actual": approval_candidate_id,
            "reason": "candidate_approval_decision_workspace_mismatch",
        }

    runs_dir = _runs_dir(server)
    if runs_dir is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload(
            review_execution=review_execution
        )
    output_path = runs_dir / PRODUCT_CANDIDATE_PROMOTION_EXECUTION_REPORT_ARTIFACT
    git_service_output_path = runs_dir / GIT_SERVICE_PROMOTION_EXECUTION_REPORT_ARTIFACT
    output_ref = f"runs/{output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    git_service_output_ref = (
        f"runs/{git_service_output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    )
    if _is_real_promotion_execution_report(output_path):
        existing_report = _load_json(output_path) or {}
        if review_execution and _promotion_review_opened(existing_report):
            return HTTPStatus.OK, {
                "artifact_kind": "specspace_managed_promotion_review_execution",
                "ok": True,
                "status": "completed",
                "workspace_id": selected_workspace_id,
                "promotion_request_ref": (
                    f"runs/{GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT}"
                ),
                "approval_decision_ref": (
                    f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}"
                ),
                "output_ref": output_ref,
                "git_service_output_ref": git_service_output_ref,
                "platform_returncode": 0,
                "platform_report": existing_report,
                "reused_existing_report": True,
                "stderr_tail": "",
                "authority_boundary": {
                    "browser_executes_platform": False,
                    "specspace_backend_executes_platform": False,
                    "executes_git_service_dry_run": False,
                    "creates_candidate_worktree_or_branch": False,
                    "creates_git_commits": False,
                    "opens_pull_requests": False,
                    "publishes_read_models": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                    "mutates_canonical_specs": False,
                },
                "summary": {
                    "status": "managed_promotion_review_execution_reused",
                    "executed": False,
                    "dry_run": False,
                    "open_review_dry_run": False,
                    "opens_pull_requests": False,
                    "review_opened": True,
                    "output_ref": output_ref,
                    "git_service_output_ref": git_service_output_ref,
                    "promotion_execution_ok": True,
                    "next_action": "Inspect review status for the existing promotion review.",
                },
            }
        return HTTPStatus.CONFLICT, {
            "error": "Refusing to overwrite an existing non-dry-run promotion execution report.",
            "output_ref": output_ref,
            "reason": "promotion_execution_report_not_dry_run",
        }
    if _is_real_git_service_execution_report(git_service_output_path):
        return HTTPStatus.CONFLICT, {
            "error": "Refusing to overwrite an existing non-dry-run Git Service promotion execution report.",
            "git_service_output_ref": git_service_output_ref,
            "reason": "git_service_promotion_execution_report_not_dry_run",
        }
    if review_execution and not _promotion_dry_run_succeeded(output_path):
        return HTTPStatus.CONFLICT, {
            "error": "Non-dry-run promotion review execution requires a successful prior promotion dry-run report.",
            "promotion_execution_ref": output_ref,
            "reason": "promotion_dry_run_not_ready",
        }

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
        "execute",
        "--promotion-request",
        str(promotion_request_path),
        "--approval-decision",
        str(approval_decision_path),
        "--repository-dir",
        str(specgraph_dir),
        "--workspace-dir",
        str(_workspace_dir(specgraph_dir, selected_workspace_id)),
        "--git-service-output",
        str(git_service_output_path),
        "--output",
        str(output_path),
        "--format",
        "json",
    ]
    if not review_execution:
        command.extend(["--dry-run", "--open-review-dry-run"])
    try:
        completed = subprocess.run(
            command,
            cwd=str(platform_script.parent.parent),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        return HTTPStatus.GATEWAY_TIMEOUT, {
            "artifact_kind": (
                "specspace_managed_promotion_review_execution"
                if review_execution
                else "specspace_managed_promotion_execution"
            ),
            "ok": False,
            "status": "platform_execution_timeout",
            "workspace_id": selected_workspace_id,
            "promotion_request_ref": (
                f"runs/{GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT}"
            ),
            "approval_decision_ref": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
            "output_ref": output_ref,
            "git_service_output_ref": git_service_output_ref,
            "platform_timeout_seconds": timeout_seconds,
            "stderr_tail": (exc.stderr or "")[-2000:]
            if isinstance(exc.stderr, str)
            else "",
            "authority_boundary": {
                "browser_executes_platform": False,
                "specspace_backend_executes_platform": True,
                "executes_git_service_dry_run": False,
                "creates_candidate_worktree_or_branch": False,
                "creates_git_commits": False,
                "opens_pull_requests": False,
                "publishes_read_models": False,
                "writes_ontology_packages": False,
                "accepts_ontology_terms": False,
                "mutates_canonical_specs": False,
            },
            "summary": {
                "status": (
                    "managed_promotion_review_execution_timeout"
                    if review_execution
                    else "managed_promotion_execution_dry_run_timeout"
                ),
                "executed": True,
                "dry_run": not review_execution,
                "open_review_dry_run": not review_execution,
                "output_ref": output_ref,
                "git_service_output_ref": git_service_output_ref,
                "promotion_execution_ok": False,
                "next_action": "Inspect Platform promotion execution timeout and retry.",
            },
        }
    stdout = completed.stdout.strip()
    try:
        report = json.loads(stdout) if stdout else {}
    except json.JSONDecodeError:
        report = {}

    command_ok = completed.returncode == 0
    review_opened = _review_opened(report) if review_execution else False
    ok = command_ok and (not review_execution or review_opened)
    response = {
        "artifact_kind": (
            "specspace_managed_promotion_review_execution"
            if review_execution
            else "specspace_managed_promotion_execution"
        ),
        "ok": ok,
        "status": "completed" if ok else "failed",
        "workspace_id": selected_workspace_id,
        "promotion_request_ref": f"runs/{GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT}",
        "approval_decision_ref": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
        "output_ref": output_ref,
        "git_service_output_ref": git_service_output_ref,
        "platform_returncode": completed.returncode,
        "platform_report": report,
        "stderr_tail": completed.stderr[-2000:] if completed.stderr else "",
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "executes_git_service_dry_run": bool(ok) and not review_execution,
            "creates_candidate_worktree_or_branch": bool(ok) and review_execution,
            "creates_git_commits": bool(ok) and review_execution,
            "opens_pull_requests": bool(ok) and review_execution,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
            "mutates_canonical_specs": False,
        },
        "summary": {
            "status": (
                "managed_promotion_review_execution_completed"
                if review_execution
                else "managed_promotion_execution_dry_run_completed"
            )
            if ok
            else (
                "managed_promotion_review_execution_failed"
                if review_execution
                else "managed_promotion_execution_dry_run_failed"
            ),
            "executed": True,
            "dry_run": not review_execution,
            "open_review_dry_run": not review_execution,
            "review_opened": review_opened,
            "opens_pull_requests": bool(ok) and review_execution,
            "output_ref": output_ref,
            "git_service_output_ref": git_service_output_ref,
            "promotion_execution_ok": _record(report).get("ok") is True,
            "review_opened_required": review_execution,
        },
    }
    return HTTPStatus.OK if ok else HTTPStatus.BAD_GATEWAY, response


def execute_promotion_dry_run(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    return _execute_promotion(
        server,
        payload,
        workspace_id=workspace_id,
        review_execution=False,
    )


def execute_promotion_review(
    server: Any,
    payload: dict[str, Any],
    *,
    workspace_id: str | None,
) -> tuple[HTTPStatus, dict[str, Any]]:
    return _execute_promotion(
        server,
        payload,
        workspace_id=workspace_id,
        review_execution=True,
    )
