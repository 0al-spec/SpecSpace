"""Readonly agent/executor/passport surface read model for SpecSpace."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specgraph_surfaces

AGENT_SURFACE_INDEX_ARTIFACT_KIND = "specspace_agent_surface_index"
AGENT_SURFACE_SCHEMA_VERSION = 1
AGENT_SURFACE_ARTIFACTS: dict[str, str] = {
    "executor_adapters": "supervisor_executor_adapter_index.json",
    "known_agent_passports": "known_agent_passport_index.json",
    "agent_surfaces": "agent_surface_index.json",
    "verification_report": "agent_passport_verification_report.json",
    "verification_gaps": "agent_verification_gap_index.json",
    "runtime_evidence": "agent_runtime_enforcement_evidence_index.json",
    "external_handoffs": "external_consumer_handoff_packets.json",
}


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list_of_dicts(value: Any) -> list[dict[str, Any]]:
    return [entry for entry in value if isinstance(entry, dict)] if isinstance(value, list) else []


def _text(value: Any, default: str = "") -> str:
    return value if isinstance(value, str) and value else default


def _bool(value: Any) -> bool:
    return bool(value) if isinstance(value, bool) else False


def _optional_bool(value: Any) -> bool | None:
    return value if isinstance(value, bool) else None


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _entry_count(data: dict[str, Any]) -> int:
    entry_count = data.get("entry_count")
    if isinstance(entry_count, int) and entry_count >= 0:
        return entry_count
    for key in ("entries", "surfaces", "gaps"):
        entries = data.get(key)
        if isinstance(entries, list):
            return len(entries)
    summary = data.get("summary")
    if isinstance(summary, dict):
        for key in ("surface_count", "backend_count", "gap_count", "agent_count"):
            value = summary.get(key)
            if isinstance(value, int) and value >= 0:
                return value
    return 0


def _artifact_data(artifacts: dict[str, dict[str, Any] | None], name: str) -> dict[str, Any]:
    artifact = artifacts.get(name)
    if artifact is None:
        return {}
    return _dict(artifact.get("data"))


def empty_source(name: str, filename: str, *, reason: str, path: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "available": False,
        "artifact": f"runs/{filename}",
        "entry_count": 0,
        "reason": reason,
    }
    if path is not None:
        payload["path"] = path
    return payload


def artifact_source(name: str, filename: str, artifact: dict[str, Any]) -> dict[str, Any]:
    data = _dict(artifact.get("data"))
    return {
        "available": True,
        "artifact": f"runs/{filename}",
        "path": artifact.get("path"),
        "mtime_iso": artifact.get("mtime_iso"),
        "artifact_kind": data.get("artifact_kind"),
        "generated_at": data.get("generated_at"),
        "entry_count": _entry_count(data),
    }


def decode_json_artifact_text(text: str, *, artifact: str, path: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        return None, {
            "available": False,
            "artifact": artifact,
            "path": path,
            "entry_count": 0,
            "reason": "invalid_json",
            "detail": str(exc),
        }
    if not isinstance(data, dict):
        return None, {
            "available": False,
            "artifact": artifact,
            "path": path,
            "entry_count": 0,
            "reason": "invalid_json_root",
            "detail": "JSON root is not an object",
        }
    return data, None


def read_file_artifact(runs_dir: Path | None, name: str, filename: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    if runs_dir is None:
        return empty_source(name, filename, reason="runs_not_configured"), None
    path = runs_dir / filename
    if not path.is_file():
        return empty_source(name, filename, reason="missing_artifact", path=str(path)), None
    status, payload = specgraph_surfaces.read_json_artifact(
        path,
        invalid_message=f"{filename} is not valid JSON",
    )
    if status != HTTPStatus.OK:
        return {
            "available": False,
            "artifact": f"runs/{filename}",
            "path": str(path),
            "entry_count": 0,
            "reason": "invalid_artifact",
            **payload,
        }, None
    if not isinstance(payload.get("data"), dict):
        return {
            "available": False,
            "artifact": f"runs/{filename}",
            "path": str(path),
            "entry_count": 0,
            "reason": "invalid_json_root",
            "detail": "JSON root is not an object",
        }, None
    return artifact_source(name, filename, payload), payload


def _specspace_handoff(data: dict[str, Any]) -> dict[str, Any] | None:
    for entry in _list_of_dicts(data.get("entries")):
        if entry.get("consumer_id") == "specspace":
            return entry
    return None


def _safe_gap(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "gap_id": _text(raw.get("gap_id")),
        "gap": _text(raw.get("gap"), "unknown"),
        "severity": _text(raw.get("severity"), "unknown"),
        "reason": _text(raw.get("reason")),
        "next_action": _text(raw.get("next_action")),
        "source_proposal_ids": _string_list(raw.get("source_proposal_ids")),
    }


def _gaps_by_surface(gaps: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for gap in gaps:
        surface_id = _text(gap.get("agent_surface"))
        if not surface_id:
            continue
        grouped.setdefault(surface_id, []).append(_safe_gap(gap))
    return grouped


def _entries_by_surface(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for entry in entries:
        surface_id = _text(entry.get("agent_surface"))
        if surface_id and surface_id not in grouped:
            grouped[surface_id] = entry
    return grouped


def _runtime_evidence_by_surface(entries: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        surface_id = _text(entry.get("surface_id") or entry.get("agent_surface"))
        if not surface_id:
            continue
        grouped.setdefault(surface_id, []).append(
            {
                "evidence_id": _text(entry.get("evidence_id")),
                "evidence_kind": _text(entry.get("evidence_kind"), "unknown"),
                "status": _text(entry.get("status"), "missing"),
                "runtime_enforcement_state": _text(
                    entry.get("runtime_enforcement_state"),
                    "unknown",
                ),
                "posture_claim": _text(entry.get("posture_claim")),
                "evidence_ref": _text(entry.get("evidence_ref")) or None,
                "result_status": _text(entry.get("result_status"), "unknown"),
                "source_proposal_ids": _string_list(entry.get("source_proposal_ids")),
            }
        )
    for items in grouped.values():
        items.sort(key=lambda item: (item["status"], item["evidence_kind"], item["evidence_id"]))
    return grouped


def _surface_entry(
    raw: dict[str, Any],
    *,
    gaps: list[dict[str, Any]],
    passport: dict[str, Any],
    verification: dict[str, Any],
    runtime_evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    surface_id = _text(raw.get("surface_id"))
    verification_result = _dict(passport.get("verification_result"))
    verification_state = _text(
        verification.get("verification_state")
        or passport.get("verification_state")
        or raw.get("verification_state"),
        "unknown",
    )
    verification_status = _text(
        verification.get("verification_status")
        or verification_result.get("verification_status"),
        "unknown",
    )
    verification_tool_status = _text(
        verification.get("tool_status")
        or verification_result.get("tool_status")
        or _dict(raw.get("passport_validation")).get("tool_status"),
        "unknown",
    )
    verification_valid = _optional_bool(verification.get("valid"))
    if verification_valid is None:
        verification_valid = _optional_bool(verification_result.get("valid"))
    runtime_enforcement_state = _text(
        passport.get("runtime_enforcement_state") or raw.get("runtime_enforcement_state"),
        "unknown",
    )
    next_action = _text(gaps[0].get("next_action")) if gaps else ""
    return {
        "surface_id": surface_id,
        "title": _text(raw.get("title"), surface_id or "Agent surface"),
        "surface_type": _text(raw.get("surface_type"), "unknown"),
        "source": _text(raw.get("source"), "unknown"),
        "source_proposal_ids": _string_list(raw.get("source_proposal_ids")),
        "requires_passport": _bool(raw.get("requires_passport")),
        "launches_agents": _bool(raw.get("launches_agents")),
        "prepares_handoffs": _bool(raw.get("prepares_handoffs")),
        "passport_ref": _text(raw.get("passport_ref")) or None,
        "verification_state": verification_state,
        "verification_status": verification_status,
        "verification_tool_status": verification_tool_status,
        "verification_valid": bool(verification_valid),
        "runtime_enforcement_state": runtime_enforcement_state,
        "runtime_enforcement_observed": runtime_enforcement_state == "observed",
        "next_action": next_action or None,
        "executor_backend_id": _text(raw.get("executor_backend_id")) or None,
        "backend_status": _text(raw.get("backend_status")) or None,
        "passport_validation": _dict(raw.get("passport_validation")),
        "gap_count": len(gaps),
        "gaps": gaps,
        "runtime_enforcement_evidence_count": len(runtime_evidence),
        "runtime_enforcement_evidence": runtime_evidence,
    }


def _executor_entry(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "backend_id": _text(raw.get("backend_id")),
        "display_name": _text(raw.get("display_name")),
        "backend_status": _text(raw.get("backend_status"), "unknown"),
        "authority_state": _text(raw.get("authority_state"), "unknown"),
        "command_surface": _text(raw.get("command_surface"), "unknown"),
        "protocol_contract": _text(raw.get("protocol_contract"), "unknown"),
        "passport_ref": _text(raw.get("passport_ref")) or None,
        "passport_validation": _dict(raw.get("passport_validation")),
        "smoke_status": _text(raw.get("smoke_status"), "unknown"),
        "canonical_trial_allowed": _bool(raw.get("canonical_trial_allowed")),
        "safe_next_action": _text(raw.get("safe_next_action")) or None,
        "capability_gap_count": len(_list_of_dicts(raw.get("capability_gaps"))),
    }


def _passport_entry(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "agent_surface": _text(raw.get("agent_surface")),
        "surface_type": _text(raw.get("surface_type"), "unknown"),
        "passport_ref": _text(raw.get("passport_ref")) or None,
        "verification_state": _text(raw.get("verification_state"), "unknown"),
        "runtime_enforcement_state": _text(raw.get("runtime_enforcement_state"), "unknown"),
        "requires_passport": _bool(raw.get("requires_passport")),
        "executor_backend_id": _text(raw.get("executor_backend_id")) or None,
    }


def _handoff_payload(raw: dict[str, Any] | None) -> dict[str, Any]:
    if raw is None:
        return {
            "available": False,
            "handoff_status": "missing",
            "review_state": "missing",
            "next_gap": "publish_specspace_handoff_packet",
        }
    return {
        "available": True,
        "handoff_id": _text(raw.get("handoff_id")) or None,
        "handoff_status": _text(raw.get("handoff_status"), "unknown"),
        "review_state": _text(raw.get("review_state"), "unknown"),
        "next_gap": _text(raw.get("next_gap")) or None,
        "source_gap": _text(raw.get("source_gap")) or None,
        "source_proposal_ids": _string_list(raw.get("source_proposal_ids")),
        "artifact_contract": _dict(raw.get("artifact_contract")),
        "expected_consumer_behavior": _string_list(raw.get("expected_consumer_behavior")),
        "evidence_contract": _dict(raw.get("evidence_contract")),
        "privacy_boundary": _dict(raw.get("privacy_boundary")),
    }


def _summary_value(data: dict[str, Any], key: str, default: int = 0) -> int:
    value = _dict(data.get("summary")).get(key)
    return value if isinstance(value, int) and value >= 0 else default


def build_agent_surface_index(
    *,
    artifacts: dict[str, dict[str, Any] | None],
    sources: dict[str, dict[str, Any]],
    source: dict[str, Any],
) -> dict[str, Any]:
    agent_surfaces_data = _artifact_data(artifacts, "agent_surfaces")
    verification_data = _artifact_data(artifacts, "verification_gaps")
    verification_report_data = _artifact_data(artifacts, "verification_report")
    executor_data = _artifact_data(artifacts, "executor_adapters")
    passport_data = _artifact_data(artifacts, "known_agent_passports")
    runtime_evidence_data = _artifact_data(artifacts, "runtime_evidence")
    handoff_data = _artifact_data(artifacts, "external_handoffs")

    gaps = _list_of_dicts(verification_data.get("gaps"))
    grouped_gaps = _gaps_by_surface(gaps)
    passports_by_surface = _entries_by_surface(_list_of_dicts(passport_data.get("entries")))
    verification_by_surface = _entries_by_surface(
        _list_of_dicts(verification_report_data.get("entries"))
    )
    runtime_evidence_by_surface = _runtime_evidence_by_surface(
        _list_of_dicts(runtime_evidence_data.get("entries"))
    )
    entries = [
        _surface_entry(
            surface,
            gaps=grouped_gaps.get(_text(surface.get("surface_id")), []),
            passport=passports_by_surface.get(_text(surface.get("surface_id")), {}),
            verification=verification_by_surface.get(_text(surface.get("surface_id")), {}),
            runtime_evidence=runtime_evidence_by_surface.get(_text(surface.get("surface_id")), []),
        )
        for surface in _list_of_dicts(agent_surfaces_data.get("surfaces"))
        if _text(surface.get("surface_id"))
    ]
    entries.sort(key=lambda entry: (entry["surface_type"], entry["surface_id"]))

    executor_adapters = [
        _executor_entry(entry)
        for entry in _list_of_dicts(executor_data.get("entries"))
        if _text(entry.get("backend_id"))
    ]
    executor_adapters.sort(key=lambda entry: entry["backend_id"])

    passport_entries = [
        _passport_entry(entry)
        for entry in _list_of_dicts(passport_data.get("entries"))
        if _text(entry.get("agent_surface"))
    ]
    passport_entries.sort(key=lambda entry: entry["agent_surface"])

    handoff = _handoff_payload(_specspace_handoff(handoff_data))
    surface_summary = _dict(agent_surfaces_data.get("summary"))
    gap_summary = _dict(verification_data.get("summary"))
    report_summary = _dict(verification_report_data.get("summary"))
    executor_summary = _dict(executor_data.get("summary"))
    runtime_evidence_summary = _dict(runtime_evidence_data.get("summary"))

    return {
        "api_version": "v1",
        "artifact_kind": AGENT_SURFACE_INDEX_ARTIFACT_KIND,
        "schema_version": AGENT_SURFACE_SCHEMA_VERSION,
        "generated_at": _now_iso(),
        "read_only": True,
        "source": source,
        "entry_count": len(entries),
        "entries": entries,
        "executor_adapters": executor_adapters,
        "known_agent_passports": passport_entries,
        "handoff": handoff,
        "summary": {
            "surface_count": len(entries),
            "executor_backend_count": len(executor_adapters),
            "missing_passport_count": _summary_value(agent_surfaces_data, "missing_passport_count"),
            "verification_gap_count": _summary_value(verification_data, "gap_count"),
            "verification_valid_count": _summary_value(verification_report_data, "valid_count"),
            "verification_invalid_count": _summary_value(verification_report_data, "invalid_count"),
            "verification_unavailable_count": _summary_value(
                verification_report_data,
                "unavailable_count",
            ),
            "runtime_enforcement_unknown_count": _summary_value(
                verification_data,
                "runtime_enforcement_unknown_count",
            ),
            "runtime_enforcement_policy_only_count": _summary_value(
                verification_data,
                "runtime_enforcement_policy_only_count",
            ),
            "runtime_enforcement_boundary_only_count": _summary_value(
                verification_data,
                "runtime_enforcement_boundary_only_count",
            ),
            "runtime_enforcement_deferred_count": _summary_value(
                verification_data,
                "runtime_enforcement_deferred_count",
            ),
            "runtime_enforcement_evidence_count": _summary_value(
                runtime_evidence_data,
                "evidence_count",
            ),
            "runtime_enforcement_evidence_passed_count": _summary_value(
                runtime_evidence_data,
                "passed_count",
            ),
            "runtime_enforcement_evidence_failed_count": _summary_value(
                runtime_evidence_data,
                "failed_count",
            ),
            "runtime_enforcement_evidence_missing_count": _summary_value(
                runtime_evidence_data,
                "missing_count",
            ),
            "agent_passport_cli_status": _text(
                surface_summary.get("agent_passport_cli_status")
                or gap_summary.get("agent_passport_cli_status")
                or report_summary.get("agent_passport_cli_status")
                or executor_summary.get("agent_passport_cli_status"),
                "unknown",
            ),
            "handoff_status": _text(handoff.get("handoff_status"), "unknown"),
            "next_gap": _text(handoff.get("next_gap"))
            or _text(surface_summary.get("next_gap"))
            or _text(gap_summary.get("next_gap"))
            or _text(runtime_evidence_summary.get("next_gap"))
            or _text(executor_summary.get("next_gap"))
            or None,
        },
        "sources": sources,
    }


def read_file_agent_surface_index(*, runs_dir: Path | None) -> tuple[int, dict[str, Any]]:
    sources: dict[str, dict[str, Any]] = {}
    artifacts: dict[str, dict[str, Any] | None] = {}
    for name, filename in AGENT_SURFACE_ARTIFACTS.items():
        source, artifact = read_file_artifact(runs_dir, name, filename)
        sources[name] = source
        artifacts[name] = artifact

    return HTTPStatus.OK, build_agent_surface_index(
        artifacts=artifacts,
        sources=sources,
        source={
            "provider": "file",
            "runs_dir": str(runs_dir) if runs_dir is not None else None,
        },
    )
