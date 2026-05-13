"""SpecPM and SpecGraph exploration read-model helpers."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any


def _read_specpm_artifact(path: Path | None) -> dict[str, Any]:
    """Read a SpecPM runs artifact, returning a graceful shell when unavailable."""
    if path is None or not path.exists():
        return {"available": False, "entry_count": 0, "entries": [], "generated_at": None}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        mtime = path.stat().st_mtime
        return {
            "available": True,
            "mtime": mtime,
            "mtime_iso": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
            **data,
        }
    except Exception as exc:
        return {"available": False, "error": str(exc), "entry_count": 0, "entries": [], "generated_at": None}


def specpm_runs_path(specgraph_dir: Path, filename: str) -> Path:
    return specgraph_dir / "runs" / filename


def specpm_preview_path(specgraph_dir: Path) -> Path:
    return specpm_runs_path(specgraph_dir, "specpm_export_preview.json")


def read_specpm_preview_response(specgraph_dir: Path) -> tuple[HTTPStatus, dict[str, Any]]:
    preview_path = specpm_preview_path(specgraph_dir)
    if not preview_path.exists():
        return (
            HTTPStatus.NOT_FOUND,
            {
                "error": "Preview artifact not built yet",
                "hint": "POST /api/specpm/preview/build to create it",
                "preview_path": str(preview_path),
            },
        )
    try:
        data = json.loads(preview_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return (
            HTTPStatus.UNPROCESSABLE_ENTITY,
            {"error": f"Failed to read preview: {exc}", "preview_path": str(preview_path)},
        )
    mtime = preview_path.stat().st_mtime
    return (
        HTTPStatus.OK,
        {
            "preview_path": str(preview_path),
            "mtime": mtime,
            "mtime_iso": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
            "preview": data,
        },
    )


def read_specpm_artifact_response(specgraph_dir: Path, filename: str) -> tuple[HTTPStatus, dict[str, Any]]:
    path = specpm_runs_path(specgraph_dir, filename)
    if not path.exists():
        return HTTPStatus.NOT_FOUND, {"error": "Artifact not built yet", "path": str(path)}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {"error": f"Failed to read artifact: {exc}"}
    mtime = path.stat().st_mtime
    return (
        HTTPStatus.OK,
        {
            "path": str(path),
            "mtime": mtime,
            "mtime_iso": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
            "data": data,
        },
    )


def exploration_preview_path(specgraph_dir: Path) -> Path:
    return specgraph_dir / "runs" / "exploration_preview.json"


def read_exploration_preview_response(specgraph_dir: Path) -> tuple[HTTPStatus, dict[str, Any]]:
    path = exploration_preview_path(specgraph_dir)
    if not path.exists():
        return (
            HTTPStatus.NOT_FOUND,
            {
                "error": "Exploration preview artifact not built yet",
                "hint": "POST /api/exploration-preview/build to create it",
                "path": str(path),
            },
        )
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {"error": f"Failed to read exploration preview: {exc}", "path": str(path)}
    if (
        data.get("artifact_kind") != "exploration_preview"
        or data.get("canonical_mutations_allowed") is not False
        or data.get("tracked_artifacts_written") is not False
    ):
        return (
            HTTPStatus.UNPROCESSABLE_ENTITY,
            {
                "error": "Artifact failed boundary check",
                "artifact_kind": data.get("artifact_kind"),
                "canonical_mutations_allowed": data.get("canonical_mutations_allowed"),
                "tracked_artifacts_written": data.get("tracked_artifacts_written"),
            },
        )
    mtime = path.stat().st_mtime
    return (
        HTTPStatus.OK,
        {
            "path": str(path),
            "mtime": mtime,
            "mtime_iso": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
            "data": data,
        },
    )


def _extract_proposal_title(content: str, fallback: str) -> str:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip() or fallback
    return fallback


def _extract_proposal_status(content: str) -> str:
    lines = content.splitlines()

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        lowered = stripped.lower()
        if lowered.startswith("status:"):
            return stripped.split(":", 1)[1].strip()
        if stripped.startswith("## "):
            break

    in_status = False
    collected: list[str] = []
    for line in lines:
        stripped = line.strip()
        lowered = stripped.lower()
        if lowered == "## status":
            in_status = True
            continue
        if lowered.startswith("## status:"):
            return stripped.split(":", 1)[1].strip()
        if not in_status:
            continue
        if stripped.startswith("## "):
            break
        if stripped:
            collected.append(stripped.lstrip("-* ").strip())
    return " ".join(collected).strip()


def _proposal_entry(path: Path, content: str, stat: os.stat_result, *, include_content: bool = False) -> dict[str, Any]:
    entry = {
        "proposal_id": path.stem.split("_", 1)[0],
        "title": _extract_proposal_title(content, path.stem),
        "status": _extract_proposal_status(content) or "Unknown",
        "file_name": path.name,
        "relative_path": f"docs/proposals/{path.name}",
        "path": str(path),
        "mtime": stat.st_mtime,
        "mtime_iso": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    }
    if include_content:
        entry["content"] = content
    return entry


def _collect_proposals(specgraph_dir: Path) -> dict[str, Any]:
    proposals_dir = specgraph_dir / "docs" / "proposals"
    if not proposals_dir.is_dir():
        return {
            "available": False,
            "path": str(proposals_dir),
            "count": 0,
            "entries": [],
            "error": "docs/proposals not found",
        }

    entries: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for path in sorted(proposals_dir.glob("*.md")):
        try:
            content = path.read_text(encoding="utf-8")
            stat = path.stat()
        except OSError as exc:
            errors.append({"file_name": path.name, "error": str(exc)})
            continue

        entries.append(_proposal_entry(path, content, stat))

    return {
        "available": True,
        "path": str(proposals_dir),
        "count": len(entries),
        "entries": entries,
        "errors": errors,
    }


def _read_proposal_markdown(specgraph_dir: Path, file_name: str) -> tuple[int, dict[str, Any]]:
    proposals_dir = specgraph_dir / "docs" / "proposals"
    if not proposals_dir.is_dir():
        return HTTPStatus.NOT_FOUND, {"error": "docs/proposals not found", "path": str(proposals_dir)}

    if not file_name:
        return HTTPStatus.BAD_REQUEST, {"error": "Missing required query parameter: file"}
    if Path(file_name).name != file_name or not file_name.endswith(".md"):
        return HTTPStatus.BAD_REQUEST, {"error": "Invalid proposal file name"}

    path = proposals_dir / file_name
    if not path.is_file():
        return HTTPStatus.NOT_FOUND, {"error": "Proposal markdown not found", "file_name": file_name}

    try:
        content = path.read_text(encoding="utf-8")
        stat = path.stat()
    except OSError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": f"Failed to read proposal markdown: {exc}",
            "file_name": file_name,
        }

    return HTTPStatus.OK, _proposal_entry(path, content, stat, include_content=True)


def _read_specgraph_runs_artifact(
    specgraph_dir: Path,
    filename: str,
    *,
    expected_kind: str | None = None,
) -> dict[str, Any]:
    path = specgraph_dir / "runs" / filename
    envelope: dict[str, Any] = {
        "available": False,
        "filename": filename,
        "path": str(path),
        "expected_kind": expected_kind,
        "data": None,
    }
    if not path.exists():
        envelope["not_built"] = True
        return envelope

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            envelope["error"] = "Artifact root is not a JSON object."
            return envelope
    except (OSError, json.JSONDecodeError) as exc:
        envelope["error"] = str(exc)
        return envelope

    stat = path.stat()
    envelope.update(
        {
            "available": True,
            "not_built": False,
            "mtime": stat.st_mtime,
            "mtime_iso": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "generated_at": data.get("generated_at"),
            "artifact_kind": data.get("artifact_kind"),
            "data": data,
        }
    )
    if expected_kind is not None and data.get("artifact_kind") != expected_kind:
        envelope["kind_warning"] = {
            "expected": expected_kind,
            "actual": data.get("artifact_kind"),
        }
    return envelope


def _count_field(entries: list[dict[str, Any]], field: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for entry in entries:
        value = entry.get(field)
        if value is None or value == "":
            continue
        key = str(value)
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items()))


def _nested_value(entry: dict[str, Any], *keys: str) -> Any:
    value: Any = entry
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def _count_nested(entries: list[dict[str, Any]], *keys: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for entry in entries:
        value = _nested_value(entry, *keys)
        if value is None or value == "":
            continue
        key = str(value)
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items()))


def _entries_from_artifact(artifact: dict[str, Any]) -> list[dict[str, Any]]:
    data = artifact.get("data")
    if not isinstance(data, dict):
        return []
    entries = data.get("entries")
    if not isinstance(entries, list):
        return []
    return [entry for entry in entries if isinstance(entry, dict)]


def _entry_count(artifact: dict[str, Any], entries: list[dict[str, Any]]) -> int:
    data = artifact.get("data")
    if isinstance(data, dict) and isinstance(data.get("entry_count"), int):
        return data["entry_count"]
    return len(entries)


def _artifact_available_meta(artifact: dict[str, Any], entries: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "available": bool(artifact.get("available")),
        "generated_at": artifact.get("generated_at"),
        "entry_count": _entry_count(artifact, entries),
    }


def _build_proposal_pressure_summary(artifacts: dict[str, dict[str, Any]]) -> dict[str, Any]:
    runtime_entries = _entries_from_artifact(artifacts["proposal_runtime_index"])
    promotion_entries = _entries_from_artifact(artifacts["proposal_promotion_index"])
    lane_entries = _entries_from_artifact(artifacts["proposal_lane_overlay"])

    runtime_ids = sorted(
        {str(entry.get("proposal_id")) for entry in runtime_entries if entry.get("proposal_id")}
    )
    promotion_ids = sorted(
        {str(entry.get("proposal_id")) for entry in promotion_entries if entry.get("proposal_id")}
    )

    lane_data = artifacts["proposal_lane_overlay"].get("data")
    under_review_count = 0
    if isinstance(lane_data, dict) and isinstance(lane_data.get("under_review_count"), int):
        under_review_count = lane_data["under_review_count"]
    else:
        under_review_count = sum(
            1
            for entry in lane_entries
            if entry.get("proposal_authority_state") == "under_review"
        )

    runtime_data = artifacts["proposal_runtime_index"].get("data")
    reflective_backlog_count = 0
    if isinstance(runtime_data, dict) and isinstance(runtime_data.get("reflective_backlog_count"), int):
        reflective_backlog_count = runtime_data["reflective_backlog_count"]
    else:
        reflective_backlog_count = sum(
            1
            for entry in runtime_entries
            if _nested_value(entry, "reflective_chain", "next_gap") == "runtime_realization"
        )

    promotion_data = artifacts["proposal_promotion_index"].get("data")
    policy_finding_count = 0
    if isinstance(promotion_data, dict) and isinstance(promotion_data.get("policy_findings"), list):
        policy_finding_count = len(promotion_data["policy_findings"])

    return {
        "runtime": {
            **_artifact_available_meta(artifacts["proposal_runtime_index"], runtime_entries),
            "reflective_backlog_count": reflective_backlog_count,
            "posture_counts": _count_field(runtime_entries, "posture"),
            "next_gap_counts": _count_nested(runtime_entries, "reflective_chain", "next_gap"),
            "proposal_ids": runtime_ids,
        },
        "promotion": {
            **_artifact_available_meta(artifacts["proposal_promotion_index"], promotion_entries),
            "policy_finding_count": policy_finding_count,
            "traceability_counts": _count_nested(promotion_entries, "promotion_traceability", "status"),
            "next_gap_counts": _count_nested(promotion_entries, "promotion_traceability", "next_gap"),
            "proposal_ids": promotion_ids,
        },
        "lane": {
            **_artifact_available_meta(artifacts["proposal_lane_overlay"], lane_entries),
            "under_review_count": under_review_count,
            "authority_state_counts": _count_field(lane_entries, "proposal_authority_state"),
            "proposal_type_counts": _count_field(lane_entries, "proposal_type"),
            "proposal_handles": [
                str(entry.get("proposal_handle"))
                for entry in lane_entries[:40]
                if entry.get("proposal_handle")
            ],
        },
    }


def _collect_exploration_surfaces(specgraph_dir: Path) -> dict[str, Any]:
    artifacts = {
        "conversation_memory": _read_specgraph_runs_artifact(
            specgraph_dir,
            "conversation_memory_index.json",
            expected_kind="conversation_memory_index",
        ),
        "exploration_preview": _read_specgraph_runs_artifact(
            specgraph_dir,
            "exploration_preview.json",
            expected_kind="exploration_preview",
        ),
        "graph_next_moves": _read_specgraph_runs_artifact(
            specgraph_dir,
            "graph_next_moves.json",
            expected_kind="graph_next_moves",
        ),
        "proposal_lane_overlay": _read_specgraph_runs_artifact(
            specgraph_dir,
            "proposal_lane_overlay.json",
            expected_kind="proposal_lane_overlay",
        ),
        "proposal_runtime_index": _read_specgraph_runs_artifact(
            specgraph_dir,
            "proposal_runtime_index.json",
            expected_kind="proposal_runtime_index",
        ),
        "proposal_promotion_index": _read_specgraph_runs_artifact(
            specgraph_dir,
            "proposal_promotion_index.json",
            expected_kind="proposal_promotion_index",
        ),
        "proposal_spec_trace_index": _read_specgraph_runs_artifact(
            specgraph_dir,
            "proposal_spec_trace_index.json",
            expected_kind="proposal_spec_trace_index",
        ),
    }
    return {
        "specgraph_dir": str(specgraph_dir),
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "boundary_label": "Pre-canonical exploration surfaces, not canonical specs",
        "read_only": True,
        "proposals": _collect_proposals(specgraph_dir),
        "artifacts": artifacts,
        "proposal_pressure": _build_proposal_pressure_summary(artifacts),
    }


def _pkg_key(primary: str | None, fallback: str | None) -> str | None:
    return primary if primary else fallback


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _dict_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _merge_specpm_source_refs(
    package: dict[str, Any],
    *,
    root_spec_id: Any = None,
    source_spec_ids: Any = None,
) -> None:
    if isinstance(root_spec_id, str) and root_spec_id:
        package.setdefault("root_spec_id", root_spec_id)

    merged = [
        *(_string_list(package.get("source_spec_ids"))),
        *_string_list(source_spec_ids),
    ]
    if isinstance(root_spec_id, str) and root_spec_id:
        merged.append(root_spec_id)

    if merged:
        package["source_spec_ids"] = sorted(set(merged))


def _build_specpm_lifecycle(specgraph_dir: Path) -> dict[str, Any]:
    """Aggregate the five SpecPM artifacts into a normalized package lifecycle read-model.

    Join policy: use primary key exclusively when present; fall back to the secondary
    key only when primary is absent.  Never merge by both keys simultaneously.
    """
    runs = specgraph_dir / "runs"
    export = _read_specpm_artifact(runs / "specpm_export_preview.json")
    handoff = _read_specpm_artifact(runs / "specpm_handoff_packets.json")
    mat = _read_specpm_artifact(runs / "specpm_materialization_report.json")
    imp = _read_specpm_artifact(runs / "specpm_import_preview.json")
    imp_handoff = _read_specpm_artifact(runs / "specpm_import_handoff_packets.json")

    packages: dict[str, dict[str, Any]] = {}

    for entry in export.get("entries") or []:
        if not isinstance(entry, dict):
            continue
        package_preview = _dict_value(entry.get("package_preview"))
        pkg_id = _dict_value(package_preview.get("metadata")).get("id")
        key = _pkg_key(pkg_id, entry.get("export_id"))
        if not key:
            continue
        packages.setdefault(key, {"package_key": key})
        contract_summary = _dict_value(entry.get("contract_summary"))
        boundary_source = _dict_value(entry.get("boundary_source_preview"))
        boundary_source_ids = [
            item.get("spec_id")
            for item in boundary_source.get("source_specs") or []
            if isinstance(item, dict)
        ]
        _merge_specpm_source_refs(
            packages[key],
            root_spec_id=contract_summary.get("root_spec_id") or boundary_source.get("root_spec_id"),
            source_spec_ids=[
                *_string_list(contract_summary.get("source_spec_ids")),
                *_string_list(boundary_source_ids),
            ],
        )
        packages[key]["export"] = {
            "status": entry.get("export_status"),
            "review_state": entry.get("review_state"),
            "next_gap": entry.get("next_gap"),
        }

    for entry in handoff.get("entries") or []:
        pkg_id = (entry.get("package_identity") or {}).get("package_id")
        key = _pkg_key(pkg_id, entry.get("export_id"))
        if not key:
            continue
        packages.setdefault(key, {"package_key": key})
        packages[key]["handoff"] = {
            "status": entry.get("handoff_status"),
            "review_state": entry.get("review_state"),
            "next_gap": entry.get("next_gap"),
        }

    for entry in mat.get("entries") or []:
        pkg_id = (entry.get("package_identity") or {}).get("package_id")
        key = _pkg_key(pkg_id, entry.get("export_id"))
        if not key:
            continue
        packages.setdefault(key, {"package_key": key})
        packages[key]["materialization"] = {
            "status": entry.get("materialization_status"),
            "review_state": entry.get("review_state"),
            "next_gap": entry.get("next_gap"),
            "bundle_root": entry.get("bundle_root"),
        }

    for entry in imp.get("entries") or []:
        pkg_id = (entry.get("manifest_summary") or {}).get("package_id")
        key = _pkg_key(pkg_id, entry.get("bundle_id"))
        if not key:
            continue
        packages.setdefault(key, {"package_key": key})
        packages[key]["import"] = {
            "status": entry.get("import_status"),
            "review_state": entry.get("review_state"),
            "next_gap": entry.get("next_gap"),
            "suggested_target_kind": entry.get("suggested_target_kind"),
        }

    for entry in imp_handoff.get("entries") or []:
        pkg_id = (entry.get("manifest_summary") or {}).get("package_id")
        key = _pkg_key(pkg_id, entry.get("bundle_id"))
        if not key:
            continue
        packages.setdefault(key, {"package_key": key})
        packages[key]["import_handoff"] = {
            "status": entry.get("handoff_status"),
            "review_state": entry.get("review_state"),
            "next_gap": entry.get("next_gap"),
            "route_kind": (entry.get("target_route") or {}).get("route_kind"),
        }

    import_source = imp.get("import_source") if imp.get("available") else None

    def artifact_meta(a: dict[str, Any]) -> dict[str, Any]:
        return {
            "available": a.get("available", False),
            "generated_at": a.get("generated_at"),
            "entry_count": a.get("entry_count", 0),
        }

    return {
        "packages": list(packages.values()),
        "package_count": len(packages),
        "import_source": import_source,
        "artifacts": {
            "export_preview": artifact_meta(export),
            "handoff_packets": artifact_meta(handoff),
            "materialization_report": artifact_meta(mat),
            "import_preview": artifact_meta(imp),
            "import_handoff_packets": artifact_meta(imp_handoff),
        },
    }
