"""Managed Platform execution for idea-to-spec candidate approval."""

from __future__ import annotations

import json
import subprocess
import sys
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import (
    idea_to_spec_candidate_approval_intents,
    idea_to_spec_workspace,
    specspace_provider,
)

APPROVAL_EXECUTION_REPORT_ARTIFACT = "platform_candidate_approval_execution_report.json"
CANDIDATE_APPROVAL_DECISION_ARTIFACT = "candidate_approval_decision.json"
CANDIDATE_APPROVAL_GATE_REPORT_ARTIFACT = (
    "platform_candidate_approval_intent_gate_report.json"
)
REPAIR_EXECUTION_REPORT_ARTIFACT = "platform_product_repair_rerun_execution_report.json"
REPAIR_PUBLICATION_REPORT_ARTIFACT = (
    "platform_product_repair_rerun_publication_report.json"
)


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _records(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _execution_disabled_payload(next_action: str | None = None) -> dict[str, Any]:
    return {
        "artifact_kind": "specspace_managed_candidate_approval_execution",
        "ok": False,
        "status": "platform_execution_unavailable",
        "summary": {
            "status": "platform_execution_unavailable",
            "executed": False,
            "next_action": next_action
            or (
                "Start SpecSpace with --enable-platform-execution, --platform-dir, "
                "and --specgraph-dir to run managed candidate approval execution."
            ),
        },
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": False,
            "materializes_candidate_approval_decision": False,
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


def _state_path(server: Any, filename: str) -> Path:
    state_dir = getattr(server, "specspace_state_dir", None)
    if state_dir is None:
        state_dir = Path(getattr(server, "repo_root")) / ".specspace-dev" / "state"
    return Path(state_dir) / filename


def _load_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _safe_runs_ref_to_path(server: Any, ref: str | None, *, filename: str) -> Path | None:
    if ref is None or not ref.startswith("runs/"):
        return None
    rel = ref.removeprefix("runs/")
    if not rel or rel.startswith("/") or ".." in Path(rel).parts:
        return None
    runs_dir = _runs_dir(server)
    if runs_dir is None:
        return None
    candidate = (runs_dir / rel).resolve()
    try:
        candidate.relative_to(runs_dir.resolve())
    except ValueError:
        return None
    return candidate if candidate.name == filename else None


def _promotion_paths_from_gate(report: dict[str, Any] | None) -> list[str]:
    promotion_request = _record((report or {}).get("promotion_request"))
    paths = _string_list(promotion_request.get("paths"))
    if paths:
        return paths
    materialized_files = _records((report or {}).get("materialized_files"))
    return [
        path
        for path in (
            _text(item.get("promotion_path")) or _text(item.get("path"))
            for item in materialized_files
        )
        if path is not None
    ]


def _runs_ref(path: Path, runs_dir: Path | None) -> str:
    if runs_dir is None:
        return f"runs/{path.name}"
    try:
        return f"runs/{path.resolve().relative_to(runs_dir.resolve()).as_posix()}"
    except ValueError:
        return f"runs/{path.name}"


def _successful_platform_report(
    path: Path,
    *,
    artifact_kind: str,
) -> dict[str, Any] | None:
    report = _load_json(path)
    if report is None:
        return None
    if report.get("artifact_kind") != artifact_kind:
        return None
    if report.get("ok") is not True or report.get("dry_run") is True:
        return None
    return report


def _matching_active_approval_intents(
    state: dict[str, Any],
    *,
    workspace_id: str,
    candidate_id: str,
    repair_session_ref: str,
) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    for intent in _records(state.get("intents")):
        if intent.get("status") != "requested":
            continue
        if _text(intent.get("workspace_id")) != workspace_id:
            continue
        if _text(intent.get("candidate_id")) != candidate_id:
            continue
        if _text(intent.get("repair_session_ref")) != repair_session_ref:
            continue
        matches.append(intent)
    return matches


def _current_artifact_path(
    server: Any,
    *,
    preferred_filename: str,
    fallback_filename: str,
) -> Path | None:
    preferred = _runs_path(server, preferred_filename)
    if preferred is not None and preferred.is_file():
        return preferred
    fallback = _runs_path(server, fallback_filename)
    return fallback if fallback is not None and fallback.is_file() else None


def execute_candidate_approval(
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
            "error": "Candidate approval execution workspace_id does not match selected workspace.",
            "expected": workspace_id,
            "actual": payload_workspace_id,
        }
    if selected_workspace_id is None:
        return HTTPStatus.BAD_REQUEST, {
            "error": "workspace_id is required for managed candidate approval execution."
        }

    approval_intents_path = _state_path(
        server,
        idea_to_spec_candidate_approval_intents.APPROVAL_INTENT_FILENAME,
    )
    if not approval_intents_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Candidate approval intent state artifact not found.",
            "approval_intents_ref": (
                "specspace-state://"
                f"{idea_to_spec_candidate_approval_intents.APPROVAL_INTENT_FILENAME}"
            ),
        }
    intent_status, intent_state = idea_to_spec_candidate_approval_intents.read_state(
        server,
        workspace_id=selected_workspace_id,
    )
    if intent_status != HTTPStatus.OK:
        return intent_status, intent_state

    active_candidate_path = _current_artifact_path(
        server,
        preferred_filename=idea_to_spec_workspace.REPAIRED_ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
        fallback_filename=idea_to_spec_workspace.ACTIVE_IDEA_TO_SPEC_CANDIDATE_ARTIFACT,
    )
    repair_session_path = _current_artifact_path(
        server,
        preferred_filename=idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT,
        fallback_filename=idea_to_spec_workspace.IDEA_TO_SPEC_REPAIR_SESSION_ARTIFACT,
    )
    promotion_gate_path = _current_artifact_path(
        server,
        preferred_filename=idea_to_spec_workspace.REPAIRED_IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT,
        fallback_filename=idea_to_spec_workspace.IDEA_TO_SPEC_PROMOTION_GATE_ARTIFACT,
    )
    if repair_session_path is None or promotion_gate_path is None:
        return HTTPStatus.CONFLICT, {
            "error": "Candidate approval requires repair session and promotion gate artifacts.",
            "reason": "approval_inputs_missing",
        }
    runs_dir = _runs_dir(server)
    if runs_dir is None:
        return HTTPStatus.SERVICE_UNAVAILABLE, _execution_disabled_payload()
    repair_session_ref = _runs_ref(repair_session_path, runs_dir)
    promotion_gate_ref = _runs_ref(promotion_gate_path, runs_dir)

    promotion_gate = _load_json(promotion_gate_path)
    promotion_paths = _promotion_paths_from_gate(promotion_gate)
    if not promotion_paths:
        return HTTPStatus.CONFLICT, {
            "error": "Candidate approval requires promotion paths.",
            "reason": "promotion_paths_missing",
            "promotion_gate_ref": f"runs/{promotion_gate_path.name}",
        }
    candidate_id = (
        _text(_record(promotion_gate).get("candidate_id"))
        or _text(_record(_record(promotion_gate).get("summary")).get("candidate_id"))
        or selected_workspace_id
    )
    matching_intents = _matching_active_approval_intents(
        intent_state,
        workspace_id=selected_workspace_id,
        candidate_id=candidate_id,
        repair_session_ref=repair_session_ref,
    )
    if len(matching_intents) != 1:
        return HTTPStatus.CONFLICT, {
            "error": "Candidate approval execution requires exactly one current approval intent.",
            "reason": "candidate_approval_intent_not_current",
            "workspace_id": selected_workspace_id,
            "candidate_id": candidate_id,
            "repair_session_ref": repair_session_ref,
            "promotion_gate_ref": promotion_gate_ref,
            "matching_intent_count": len(matching_intents),
        }

    repair_execution_path = _runs_path(server, REPAIR_EXECUTION_REPORT_ARTIFACT)
    repair_publication_path = _runs_path(server, REPAIR_PUBLICATION_REPORT_ARTIFACT)
    if repair_execution_path is None or not repair_execution_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Repair rerun execution report artifact not found.",
            "repair_execution_ref": f"runs/{REPAIR_EXECUTION_REPORT_ARTIFACT}",
        }
    if repair_publication_path is None or not repair_publication_path.is_file():
        return HTTPStatus.NOT_FOUND, {
            "error": "Repair rerun publication report artifact not found.",
            "repair_publication_ref": f"runs/{REPAIR_PUBLICATION_REPORT_ARTIFACT}",
        }
    if _successful_platform_report(
        repair_execution_path,
        artifact_kind="platform_product_repair_rerun_execution_report",
    ) is None:
        return HTTPStatus.CONFLICT, {
            "error": "Candidate approval requires a successful non-dry-run repair execution report.",
            "reason": "repair_execution_report_not_approval_ready",
            "repair_execution_ref": f"runs/{REPAIR_EXECUTION_REPORT_ARTIFACT}",
        }
    if _successful_platform_report(
        repair_publication_path,
        artifact_kind="platform_product_repair_rerun_publication_report",
    ) is None:
        return HTTPStatus.CONFLICT, {
            "error": "Candidate approval requires a successful non-dry-run repair publication report.",
            "reason": "repair_publication_report_not_approval_ready",
            "repair_publication_ref": f"runs/{REPAIR_PUBLICATION_REPORT_ARTIFACT}",
        }

    repaired_handoff_path = _runs_path(
        server,
        idea_to_spec_workspace.REPAIRED_CANDIDATE_PROMOTION_HANDOFF_REPORT_ARTIFACT,
    )

    gate_output_path = runs_dir / CANDIDATE_APPROVAL_GATE_REPORT_ARTIFACT
    decision_output_path = runs_dir / CANDIDATE_APPROVAL_DECISION_ARTIFACT
    execution_output_path = runs_dir / APPROVAL_EXECUTION_REPORT_ARTIFACT
    output_ref = f"runs/{execution_output_path.resolve().relative_to(runs_dir.resolve()).as_posix()}"

    timeout = getattr(server, "platform_execution_timeout_seconds", 120)
    try:
        timeout_seconds = int(timeout)
    except (TypeError, ValueError):
        timeout_seconds = 120
    timeout_seconds = max(1, min(timeout_seconds, 600))

    command = [
        sys.executable,
        str(platform_script),
        "product-candidate-approval",
        "approve",
        "--specgraph-dir",
        str(specgraph_dir),
        "--workspace-id",
        selected_workspace_id,
        "--approval-intents",
        str(approval_intents_path),
        "--repair-session",
        str(repair_session_path),
        "--promotion-gate",
        str(promotion_gate_path),
        "--repair-execution",
        str(repair_execution_path),
        "--repair-publication",
        str(repair_publication_path),
        "--gate-output",
        str(gate_output_path),
        "--decision-output",
        str(decision_output_path),
        "--output",
        str(execution_output_path),
        "--format",
        "json",
    ]
    if active_candidate_path is not None:
        command.extend(["--active-candidate", str(active_candidate_path)])
    if repaired_handoff_path is not None and repaired_handoff_path.is_file():
        command.extend(["--repaired-handoff", str(repaired_handoff_path)])
    for path in promotion_paths:
        command.extend(["--path", path])

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
    summary = _record(report.get("summary"))
    response = {
        "artifact_kind": "specspace_managed_candidate_approval_execution",
        "ok": ok,
        "status": "completed" if ok else "failed",
        "workspace_id": selected_workspace_id,
        "approval_intents_ref": (
            "specspace-state://"
            f"{idea_to_spec_candidate_approval_intents.APPROVAL_INTENT_FILENAME}"
        ),
        "repair_session_ref": f"runs/{repair_session_path.name}",
        "promotion_gate_ref": f"runs/{promotion_gate_path.name}",
        "repair_execution_ref": f"runs/{REPAIR_EXECUTION_REPORT_ARTIFACT}",
        "repair_publication_ref": f"runs/{REPAIR_PUBLICATION_REPORT_ARTIFACT}",
        "output_ref": output_ref,
        "platform_returncode": completed.returncode,
        "platform_report": report,
        "stderr_tail": completed.stderr[-2000:] if completed.stderr else "",
        "authority_boundary": {
            "browser_executes_platform": False,
            "specspace_backend_executes_platform": True,
            "materializes_candidate_approval_decision": bool(
                summary.get("decision_written") is True
            ),
            "executes_git_commands": False,
            "creates_git_commits": False,
            "opens_pull_requests": False,
            "publishes_read_models": False,
            "writes_ontology_packages": False,
            "accepts_ontology_terms": False,
            "mutates_canonical_specs": False,
        },
        "summary": {
            "status": "managed_candidate_approval_executed"
            if ok
            else "managed_candidate_approval_failed",
            "executed": True,
            "output_ref": output_ref,
            "decision_ref": f"runs/{CANDIDATE_APPROVAL_DECISION_ARTIFACT}",
            "approved_path_count": len(promotion_paths),
        },
    }
    return HTTPStatus.OK if ok else HTTPStatus.BAD_GATEWAY, response
