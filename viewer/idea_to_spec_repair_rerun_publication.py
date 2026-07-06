"""Managed Platform publication for idea-to-spec repair rerun artifacts."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specspace_provider

EXECUTION_REPORT_ARTIFACT = "platform_product_repair_rerun_execution_report.json"
PUBLICATION_REPORT_ARTIFACT = "platform_product_repair_rerun_publication_report.json"


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _execution_disabled_payload(next_action: str | None = None) -> dict[str, Any]:
    return {
        "artifact_kind": "specspace_managed_repair_rerun_publication",
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": next_action
            or (
                "Start SpecSpace with --enable-platform-execution, --platform-dir, "
                "and --specgraph-dir to run managed repair rerun publication."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "executes_specgraph": False,
            "publishes_public_bundle": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
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


def _runs_path(server: Any, filename: str) -> Path | None:
    runs_dir = getattr(server, "runs_dir", None)
    if not isinstance(runs_dir, Path):
        return None
    return runs_dir / filename


def _load_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def publish_repair_rerun(
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
            "error": "Repair rerun publication workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed repair rerun publication."
        }

    execution_report_path = _runs_path(server, EXECUTION_REPORT_ARTIFACT)
    if execution_report_path is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()
    if not execution_report_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Repair rerun execution report artifact not found.",
            "execution_report_ref": f"runs/{EXECUTION_REPORT_ARTIFACT}",
        }
    execution_report = _load_json(execution_report_path)
    if execution_report is None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": "Repair rerun execution report is not valid JSON.",
            "execution_report_ref": f"runs/{EXECUTION_REPORT_ARTIFACT}",
        }
    if execution_report.get("artifact_kind") != (
        "platform_product_repair_rerun_execution_report"
    ):
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": "Repair rerun publication requires a Platform repair rerun execution report.",
            "execution_report_ref": f"runs/{EXECUTION_REPORT_ARTIFACT}",
        }
    if execution_report.get("ok") is not True or execution_report.get("dry_run") is True:
        return HTTPStatus.CONFLICT, {
            "error": "Repair rerun publication requires a successful non-dry-run execution report.",
            "execution_report_ref": f"runs/{EXECUTION_REPORT_ARTIFACT}",
            "reason": "execution_report_not_publishable",
        }

    runs_dir = getattr(server, "runs_dir", None)
    assert isinstance(runs_dir, Path)
    output_path = runs_dir / PUBLICATION_REPORT_ARTIFACT
    output_ref = (
        f"runs/{output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    )

    timeout = getattr(server, "platform_execution_timeout_seconds", 120)
    try:
        timeout_seconds = int(timeout)
    except (TypeError, ValueError):
        timeout_seconds = 120
    timeout_seconds = max(1, min(timeout_seconds, 600))

    command = [
        sys.executable,
        str(platform_script),
        "product-repair-rerun",
        "publish",
        "--execution-report",
        str(execution_report_path),
        "--specgraph-dir",
        str(specgraph_dir),
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
        "artifact_kind": "specspace_managed_repair_rerun_publication",
        "ok": ok,
        "status": "completed" if ok else "failed",
        "workspace_id": selected_workspace_id,
        "execution_report_ref": f"runs/{EXECUTION_REPORT_ARTIFACT}",
        "output_ref": output_ref,
        "platform_returncode": completed.returncode,
        "platform_report": report,
        "stderr_tail": completed.stderr[-2000:] if completed.stderr else "",
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "executes_specgraph": bool(
                _record(report.get("authority_boundary")).get(
                    "executes_specgraph_make_target"
                )
            ),
            "publishes_public_bundle": bool(
                _record(report.get("summary")).get("status") == "published"
            ),
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
        },
        "summary": {
            "status": "managed_repair_rerun_publication_executed"
            if ok
            else "managed_repair_rerun_publication_failed",
            "executed": True,
            "output_ref": output_ref,
        },
    }
    return HTTPStatus.OK if ok else HTTPStatus.BAD_GATEWAY, response
