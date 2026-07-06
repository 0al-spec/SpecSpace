"""Managed Platform execution for idea-to-spec promotion request handoff."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import idea_to_spec_workspace, specspace_provider

GRAPH_REPOSITORY_EXECUTION_PLAN_ARTIFACT = "graph_repository_execution_plan.json"
GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT = (
    idea_to_spec_workspace.GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT
)
CANDIDATE_APPROVAL_DECISION_ARTIFACT = (
    idea_to_spec_workspace.CANDIDATE_APPROVAL_DECISION_ARTIFACT
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
        "artifact_kind": "specspace_managed_promotion_request_execution",
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": next_action
            or (
                "Start SpecSpace with --enable-platform-execution, --platform-dir, "
                "and --specgraph-dir to run managed promotion request creation."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "creates_promotion_request": False,
            "executes_git_commands": False,
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


def _approval_decision_ready(path: Path) -> bool:
    payload = _load_json(path)
    if payload is None:
        return False
    return (
        payload.get("artifact_kind") == "candidate_approval_decision"
        and _record(payload.get("readiness")).get("ready") is True
        and _record(payload.get("decision")).get("state") == "approved"
    )


def execute_promotion_request(
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
            "error": "Promotion request execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed promotion request execution."
        }

    plan_path = _runs_path(server, GRAPH_REPOSITORY_EXECUTION_PLAN_ARTIFACT)
    if plan_path is None or not plan_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Graph repository execution plan artifact not found.",
            "plan_ref": f"runs/{GRAPH_REPOSITORY_EXECUTION_PLAN_ARTIFACT}",
        }
    approval_decision_path = _runs_path(server, CANDIDATE_APPROVAL_DECISION_ARTIFACT)
    if approval_decision_path is None or not approval_decision_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Candidate approval decision artifact not found.",
            "approval_decision_ref": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
        }
    if not _approval_decision_ready(approval_decision_path):
        return HTTPStatus.CONFLICT, {
            "error": "Promotion request requires a ready approved candidate approval decision.",
            "approval_decision_ref": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
            "reason": "candidate_approval_decision_not_ready",
        }

    runs_dir = _runs_dir(server)
    if runs_dir is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()
    output_path = runs_dir / GRAPH_REPOSITORY_PROMOTION_REQUEST_ARTIFACT
    output_ref = f"runs/{output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    if output_path.exists():
        existing = _load_json(output_path)
        if (
            existing is not None
            and existing.get("artifact_kind")
            == "platform_graph_repository_promotion_request"
            and existing.get("ok") is True
            and _text(existing.get("candidate_id")) == selected_workspace_id
            and _record(existing.get("summary")).get("promotion_ready") is True
        ):
            return HTTPStatus.OK, {
                "artifact_kind": "specspace_managed_promotion_request_execution",
                "ok": True,
                "status": "completed",
                "workspace_id": selected_workspace_id,
                "plan_ref": f"runs/{GRAPH_REPOSITORY_EXECUTION_PLAN_ARTIFACT}",
                "approval_decision_ref": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
                "output_ref": output_ref,
                "platform_returncode": 0,
                "platform_report": existing,
                "reused_existing_report": True,
                "authority_boundary": {
                    "browser_executes_platform": False,
                    "specspace_backend_executes_platform": False,
                    "creates_promotion_request": False,
                    "executes_git_commands": False,
                    "creates_git_commits": False,
                    "opens_pull_requests": False,
                    "publishes_read_models": False,
                    "writes_ontology_packages": False,
                    "accepts_ontology_terms": False,
                    "mutates_canonical_specs": False,
                },
                "summary": {
                    "status": "managed_promotion_request_reused",
                    "executed": False,
                    "output_ref": output_ref,
                    "promotion_ready": True,
                },
            }
        return HTTPStatus.CONFLICT, {
            "error": "Refusing to overwrite existing promotion request artifact.",
            "output_ref": output_ref,
            "reason": "promotion_request_output_exists",
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
        "request",
        "--plan",
        str(plan_path),
        "--approval-decision",
        str(approval_decision_path),
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
        "artifact_kind": "specspace_managed_promotion_request_execution",
        "ok": ok,
        "status": "completed" if ok else "failed",
        "workspace_id": selected_workspace_id,
        "plan_ref": f"runs/{GRAPH_REPOSITORY_EXECUTION_PLAN_ARTIFACT}",
        "approval_decision_ref": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
        "output_ref": output_ref,
        "platform_returncode": completed.returncode,
        "platform_report": report,
        "stderr_tail": completed.stderr[-2000:] if completed.stderr else "",
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "creates_promotion_request": bool(ok),
            "executes_git_commands": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
            "mutates_canonical_specs": False,
        },
        "summary": {
            "status": "managed_promotion_request_executed"
            if ok
            else "managed_promotion_request_failed",
            "executed": True,
            "output_ref": output_ref,
            "promotion_ready": _record(report.get("summary")).get("promotion_ready")
            is True,
        },
    }
    return HTTPStatus.OK if ok else HTTPStatus.BAD_GATEWAY, response
