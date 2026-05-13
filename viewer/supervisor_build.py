"""Supervisor build invocation helpers for SpecGraph-backed viewer endpoints."""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specpm


TAIL_LINES = 40


@dataclass(frozen=True)
class SupervisorInvocation:
    result: subprocess.CompletedProcess[str]
    stderr_tail: str
    stdout_tail: str


@dataclass(frozen=True)
class SupervisorInvocationError:
    status: HTTPStatus
    payload: dict[str, Any]


def utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def tail_lines(text: str | None, limit: int = TAIL_LINES) -> str:
    return "\n".join((text or "").splitlines()[-limit:])


def supervisor_path(specgraph_dir: Path) -> Path:
    return specgraph_dir / "tools" / "supervisor.py"


def invoke_supervisor(
    specgraph_dir: Path,
    args: list[str],
    *,
    timeout: float,
    timeout_error: str = "supervisor.py timed out",
    error_built_at: str | None = None,
) -> SupervisorInvocation | SupervisorInvocationError:
    supervisor = supervisor_path(specgraph_dir)
    if not supervisor.exists():
        return SupervisorInvocationError(
            HTTPStatus.UNPROCESSABLE_ENTITY,
            {"error": "supervisor.py not found", "expected": str(supervisor)},
        )

    cmd = [sys.executable, str(supervisor), *args]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        payload: dict[str, Any] = {"error": timeout_error, "exit_code": None}
        if error_built_at is not None:
            payload["built_at"] = error_built_at
        return SupervisorInvocationError(HTTPStatus.INTERNAL_SERVER_ERROR, payload)
    except Exception as exc:
        payload = {"error": f"Failed to invoke supervisor.py: {exc}", "exit_code": None}
        if error_built_at is not None:
            payload["built_at"] = error_built_at
        return SupervisorInvocationError(HTTPStatus.INTERNAL_SERVER_ERROR, payload)

    return SupervisorInvocation(
        result=result,
        stderr_tail=tail_lines(result.stderr),
        stdout_tail=tail_lines(result.stdout),
    )


def build_viewer_surfaces(specgraph_dir: Path) -> tuple[HTTPStatus, dict[str, Any]]:
    built_at = utc_now_iso()
    invocation = invoke_supervisor(
        specgraph_dir,
        ["--build-viewer-surfaces"],
        timeout=120,
        timeout_error="supervisor.py --build-viewer-surfaces timed out",
        error_built_at=built_at,
    )
    if isinstance(invocation, SupervisorInvocationError):
        return invocation.status, invocation.payload

    result = invocation.result
    if result.returncode != 0:
        return (
            HTTPStatus.UNPROCESSABLE_ENTITY,
            {
                "error": "supervisor.py --build-viewer-surfaces failed",
                "exit_code": result.returncode,
                "stderr_tail": invocation.stderr_tail,
                "stdout_tail": invocation.stdout_tail,
                "built_at": built_at,
            },
        )

    try:
        report = json.loads(result.stdout) if result.stdout.strip() else {}
    except json.JSONDecodeError:
        report = {}
    return HTTPStatus.OK, {"built_at": built_at, "exit_code": 0, "report": report}


def build_specpm_preview(specgraph_dir: Path) -> tuple[HTTPStatus, dict[str, Any]]:
    invocation = invoke_supervisor(
        specgraph_dir,
        ["--build-specpm-export-preview"],
        timeout=60,
    )
    if isinstance(invocation, SupervisorInvocationError):
        return invocation.status, invocation.payload

    preview_path = specpm.specpm_preview_path(specgraph_dir)
    built_at = utc_now_iso()
    result = invocation.result
    if result.returncode != 0:
        return (
            HTTPStatus.UNPROCESSABLE_ENTITY,
            {
                "error": "supervisor.py failed",
                "exit_code": result.returncode,
                "stderr_tail": invocation.stderr_tail,
                "stdout_tail": invocation.stdout_tail,
                "preview_path": str(preview_path),
                "built_at": built_at,
            },
        )

    return (
        HTTPStatus.OK,
        {
            "exit_code": 0,
            "stderr_tail": invocation.stderr_tail,
            "preview_path": str(preview_path),
            "preview_exists": preview_path.exists(),
            "built_at": built_at,
        },
    )


def build_specpm_artifact(specgraph_dir: Path, flag: str, artifact_filename: str) -> tuple[HTTPStatus, dict[str, Any]]:
    invocation = invoke_supervisor(
        specgraph_dir,
        [flag],
        timeout=60,
    )
    if isinstance(invocation, SupervisorInvocationError):
        return invocation.status, invocation.payload

    artifact_path = specpm.specpm_runs_path(specgraph_dir, artifact_filename)
    built_at = utc_now_iso()
    result = invocation.result
    if result.returncode != 0:
        return (
            HTTPStatus.UNPROCESSABLE_ENTITY,
            {
                "error": "supervisor.py failed",
                "exit_code": result.returncode,
                "stderr_tail": invocation.stderr_tail,
                "stdout_tail": invocation.stdout_tail,
                "path": str(artifact_path),
                "built_at": built_at,
            },
        )

    return (
        HTTPStatus.OK,
        {
            "exit_code": 0,
            "stderr_tail": invocation.stderr_tail,
            "path": str(artifact_path),
            "artifact_exists": artifact_path.exists(),
            "built_at": built_at,
        },
    )


def build_exploration_preview(specgraph_dir: Path, intent: str) -> tuple[HTTPStatus, dict[str, Any]]:
    invocation = invoke_supervisor(
        specgraph_dir,
        ["--build-exploration-preview", "--exploration-intent", intent],
        timeout=60,
    )
    if isinstance(invocation, SupervisorInvocationError):
        return invocation.status, invocation.payload

    artifact_path = specpm.exploration_preview_path(specgraph_dir)
    built_at = utc_now_iso()
    result = invocation.result
    if result.returncode != 0:
        return (
            HTTPStatus.UNPROCESSABLE_ENTITY,
            {
                "error": "supervisor.py failed",
                "exit_code": result.returncode,
                "stderr_tail": invocation.stderr_tail,
                "stdout_tail": invocation.stdout_tail,
                "path": str(artifact_path),
                "built_at": built_at,
            },
        )

    if artifact_path.exists():
        try:
            built_data = json.loads(artifact_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            return (
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "error": f"Build succeeded but artifact is unreadable: {exc}",
                    "exit_code": 0,
                    "path": str(artifact_path),
                    "built_at": built_at,
                },
            )
        if (
            built_data.get("artifact_kind") != "exploration_preview"
            or built_data.get("canonical_mutations_allowed") is not False
            or built_data.get("tracked_artifacts_written") is not False
        ):
            return (
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {
                    "error": "Built artifact failed boundary check",
                    "artifact_kind": built_data.get("artifact_kind"),
                    "canonical_mutations_allowed": built_data.get("canonical_mutations_allowed"),
                    "tracked_artifacts_written": built_data.get("tracked_artifacts_written"),
                    "exit_code": 0,
                    "path": str(artifact_path),
                    "built_at": built_at,
                },
            )

    return (
        HTTPStatus.OK,
        {
            "exit_code": 0,
            "stderr_tail": invocation.stderr_tail,
            "path": str(artifact_path),
            "artifact_exists": artifact_path.exists(),
            "built_at": built_at,
        },
    )
