"""Readonly proposal viewer read model for SpecSpace."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any, Callable

from viewer import specgraph_surfaces

PROPOSAL_INDEX_ARTIFACT_KIND = "specspace_proposal_index"
PROPOSAL_ARTIFACTS: dict[str, str] = {
    "proposal_spec_trace_index": "proposal_spec_trace_index.json",
    "proposal_lane_overlay": "proposal_lane_overlay.json",
    "proposal_runtime_index": "proposal_runtime_index.json",
    "proposal_promotion_index": "proposal_promotion_index.json",
}


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _text(value: Any, default: str = "") -> str:
    return value if isinstance(value, str) and value else default


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list_of_dicts(value: Any) -> list[dict[str, Any]]:
    return [entry for entry in value if isinstance(entry, dict)] if isinstance(value, list) else []


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _nested(mapping: dict[str, Any], *keys: str) -> Any:
    current: Any = mapping
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _count_by(entries: list[dict[str, Any]], field: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for entry in entries:
        value = entry.get(field)
        key = value if isinstance(value, str) and value else "unknown"
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items()))


def _entry_count(data: dict[str, Any]) -> int:
    entry_count = data.get("entry_count")
    if isinstance(entry_count, int) and entry_count >= 0:
        return entry_count
    return len(_list_of_dicts(data.get("entries")))


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


def _read_file_artifact(runs_dir: Path | None, filename: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    if runs_dir is None:
        return empty_source(filename.removesuffix(".json"), filename, reason="runs_not_configured"), None
    path = runs_dir / filename
    if not path.is_file():
        return empty_source(
            filename.removesuffix(".json"),
            filename,
            reason="missing_artifact",
            path=str(path),
        ), None
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
    return artifact_source(filename.removesuffix(".json"), filename, payload), payload


def extract_proposal_title(content: str, fallback: str) -> str:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip() or fallback
    return fallback


def extract_proposal_status(content: str) -> str:
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


def extract_proposal_excerpt(content: str, *, max_length: int = 280) -> str:
    paragraphs: list[str] = []
    current: list[str] = []
    in_frontmatter = False
    frontmatter_checked = False
    in_fence = False
    skip_status_section = False
    skipped_status_content = False

    def flush() -> None:
        nonlocal current
        if current:
            paragraphs.append(" ".join(current).strip())
            current = []

    for line in content.splitlines():
        stripped = line.strip()
        lowered = stripped.lower()
        if not frontmatter_checked:
            if not stripped:
                continue
            frontmatter_checked = True
            if stripped == "---":
                in_frontmatter = True
                continue
        if in_frontmatter:
            if stripped == "---":
                in_frontmatter = False
            continue
        if stripped.startswith("```"):
            flush()
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if not stripped:
            flush()
            if skip_status_section and skipped_status_content:
                skip_status_section = False
                skipped_status_content = False
            continue
        if stripped.startswith("#"):
            flush()
            skip_status_section = lowered in {"## status", "### status"}
            skipped_status_content = False
            continue
        if lowered.startswith("status:"):
            flush()
            continue
        if skip_status_section:
            skipped_status_content = True
            continue
        current.append(stripped.lstrip("-* ").strip())

    flush()

    for paragraph in paragraphs:
        if not paragraph:
            continue
        if len(paragraph) <= max_length:
            return paragraph
        return f"{paragraph[: max_length - 1].rstrip()}…"
    return ""


def _proposal_markdown_entry(path: Path, content: str, stat: os.stat_result) -> dict[str, Any]:
    content_excerpt = extract_proposal_excerpt(content)
    return {
        "proposal_id": path.stem.split("_", 1)[0],
        "title": extract_proposal_title(content, path.stem),
        "status": extract_proposal_status(content) or "Unknown",
        "content_excerpt": content_excerpt,
        "content_preview": extract_proposal_excerpt(content, max_length=1200),
        "file_name": path.name,
        "relative_path": f"docs/proposals/{path.name}",
        "path": str(path),
        "mtime": stat.st_mtime,
        "mtime_iso": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    }


def collect_local_proposal_markdown(specgraph_dir: Path | None) -> dict[str, Any]:
    if specgraph_dir is None:
        return {
            "available": False,
            "path": None,
            "entry_count": 0,
            "entries": [],
            "reason": "specgraph_root_not_configured",
        }
    proposals_dir = specgraph_dir / "docs" / "proposals"
    if not proposals_dir.is_dir():
        return {
            "available": False,
            "path": str(proposals_dir),
            "entry_count": 0,
            "entries": [],
            "reason": "proposals_dir_missing",
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
        entries.append(_proposal_markdown_entry(path, content, stat))

    return {
        "available": True,
        "path": str(proposals_dir),
        "entry_count": len(entries),
        "entries": entries,
        "errors": errors,
    }


def _proposal_sort_key(entry: dict[str, Any]) -> tuple[int, int | str]:
    proposal_id = _text(entry.get("proposal_id"))
    if proposal_id.isdigit():
        return (0, int(proposal_id))
    return (1, proposal_id or _text(entry.get("proposal_key")))


def _new_entry(key: str, proposal_id: str) -> dict[str, Any]:
    return {
        "proposal_key": key,
        "proposal_id": proposal_id,
        "proposal_handle": None,
        "title": proposal_id,
        "status": "unknown",
        "proposal_path": None,
        "markdown": {"available": False},
        "authority_state": None,
        "proposal_type": None,
        "runtime_state": None,
        "runtime_posture": None,
        "promotion_status": None,
        "trace_status": None,
        "next_gap": None,
        "affected_spec_ids": [],
        "source_kinds": [],
    }


def _entry_for(entries: dict[str, dict[str, Any]], key: str, proposal_id: str) -> dict[str, Any]:
    if key not in entries:
        entries[key] = _new_entry(key, proposal_id)
    return entries[key]


def _add_source(entry: dict[str, Any], source: str) -> None:
    sources = entry["source_kinds"]
    if source not in sources:
        sources.append(source)


def _add_specs(entry: dict[str, Any], refs: list[str]) -> None:
    current = set(entry["affected_spec_ids"])
    for ref in refs:
        if ref:
            current.add(ref)
    entry["affected_spec_ids"] = sorted(current)


def _path_from_entry(entry: dict[str, Any]) -> str | None:
    path = entry.get("proposal_path") or entry.get("path") or _nested(entry, "repository_projection", "path")
    return path if isinstance(path, str) and path else None


def _merge_markdown(entries: dict[str, dict[str, Any]], markdown: dict[str, Any]) -> None:
    for item in _list_of_dicts(markdown.get("entries")):
        proposal_id = _text(item.get("proposal_id"))
        if not proposal_id:
            continue
        entry = _entry_for(entries, f"proposal::{proposal_id}", proposal_id)
        entry["title"] = _text(item.get("title"), entry["title"])
        entry["status"] = _text(item.get("status"), entry["status"])
        entry["proposal_path"] = _text(item.get("relative_path")) or entry["proposal_path"]
        entry["markdown"] = {
            "available": True,
            "file_name": item.get("file_name"),
            "relative_path": item.get("relative_path"),
            "mtime_iso": item.get("mtime_iso"),
            "content_excerpt": item.get("content_excerpt"),
            "content_preview": item.get("content_preview"),
        }
        _add_source(entry, "proposal_markdown")


def _merge_trace(entries: dict[str, dict[str, Any]], data: dict[str, Any]) -> None:
    for item in _list_of_dicts(data.get("entries")):
        proposal_id = _text(item.get("proposal_id"))
        if not proposal_id:
            continue
        entry = _entry_for(entries, f"proposal::{proposal_id}", proposal_id)
        entry["title"] = _text(item.get("title"), entry["title"])
        entry["status"] = _text(item.get("status"), entry["status"])
        entry["proposal_path"] = _text(item.get("proposal_path")) or entry["proposal_path"]
        promotion_trace = _dict(item.get("promotion_trace"))
        entry["trace_status"] = _text(promotion_trace.get("trace_status"), _text(promotion_trace.get("status"))) or entry["trace_status"]
        entry["promotion_status"] = _text(promotion_trace.get("status")) or entry["promotion_status"]
        entry["next_gap"] = _text(item.get("next_gap"), _text(promotion_trace.get("next_gap"))) or entry["next_gap"]
        spec_ids = _string_list(item.get("mentioned_spec_ids"))
        spec_ids.extend(_text(ref.get("spec_id")) for ref in _list_of_dicts(item.get("spec_refs")))
        _add_specs(entry, spec_ids)
        _add_source(entry, "proposal_spec_trace_index")


def _merge_runtime(entries: dict[str, dict[str, Any]], data: dict[str, Any]) -> None:
    for item in _list_of_dicts(data.get("entries")):
        proposal_id = _text(item.get("proposal_id"))
        if not proposal_id:
            continue
        entry = _entry_for(entries, f"proposal::{proposal_id}", proposal_id)
        entry["title"] = _text(item.get("title"), entry["title"])
        entry["status"] = _text(item.get("status"), entry["status"])
        entry["proposal_path"] = _path_from_entry(item) or entry["proposal_path"]
        entry["runtime_posture"] = _text(item.get("posture")) or entry["runtime_posture"]
        entry["runtime_state"] = (
            _text(_nested(item, "runtime_realization", "status"))
            or _text(_nested(item, "reflective_chain", "runtime_realization"))
            or entry["runtime_state"]
        )
        entry["next_gap"] = _text(_nested(item, "reflective_chain", "next_gap")) or entry["next_gap"]
        _add_source(entry, "proposal_runtime_index")


def _merge_promotion(entries: dict[str, dict[str, Any]], data: dict[str, Any]) -> None:
    for item in _list_of_dicts(data.get("entries")):
        proposal_id = _text(item.get("proposal_id"))
        if not proposal_id:
            continue
        entry = _entry_for(entries, f"proposal::{proposal_id}", proposal_id)
        entry["title"] = _text(item.get("title"), entry["title"])
        entry["status"] = _text(item.get("status"), entry["status"])
        entry["proposal_path"] = _path_from_entry(item) or entry["proposal_path"]
        traceability = _dict(item.get("promotion_traceability"))
        entry["promotion_status"] = _text(traceability.get("status")) or entry["promotion_status"]
        entry["next_gap"] = _text(traceability.get("next_gap")) or entry["next_gap"]
        _add_source(entry, "proposal_promotion_index")


def _lane_spec_refs(item: dict[str, Any]) -> list[str]:
    refs: list[str] = []
    target_reference = _nested(item, "target_region", "target_reference")
    if isinstance(target_reference, str):
        refs.append(target_reference)
    for link in _list_of_dicts(item.get("lineage_links")):
        source_reference = link.get("source_reference")
        if isinstance(source_reference, str):
            refs.append(source_reference)
    return refs


def _merge_lane(entries: dict[str, dict[str, Any]], data: dict[str, Any]) -> None:
    for item in _list_of_dicts(data.get("entries")):
        handle = _text(item.get("proposal_handle")) or _text(item.get("tracked_path"))
        if not handle:
            continue
        entry = _entry_for(entries, f"lane::{handle}", handle)
        entry["proposal_handle"] = handle
        entry["title"] = _text(item.get("title"), entry["title"])
        entry["status"] = _text(item.get("proposal_authority_state"), entry["status"])
        entry["authority_state"] = _text(item.get("proposal_authority_state")) or entry["authority_state"]
        entry["proposal_type"] = _text(item.get("proposal_type")) or entry["proposal_type"]
        entry["proposal_path"] = _text(item.get("tracked_path")) or entry["proposal_path"]
        entry["trace_status"] = _text(_nested(item, "query_contract", "status")) or entry["trace_status"]
        _add_specs(entry, _lane_spec_refs(item))
        _add_source(entry, "proposal_lane_overlay")


def build_proposal_index(
    *,
    artifacts: dict[str, dict[str, Any] | None],
    sources: dict[str, dict[str, Any]],
    markdown: dict[str, Any],
    source: dict[str, Any],
) -> dict[str, Any]:
    entries: dict[str, dict[str, Any]] = {}
    _merge_markdown(entries, markdown)

    merge_steps: list[tuple[str, Callable[[dict[str, dict[str, Any]], dict[str, Any]], None]]] = [
        ("proposal_spec_trace_index", _merge_trace),
        ("proposal_runtime_index", _merge_runtime),
        ("proposal_promotion_index", _merge_promotion),
        ("proposal_lane_overlay", _merge_lane),
    ]
    for name, merge in merge_steps:
        artifact = artifacts.get(name)
        if artifact is None:
            continue
        data = _dict(artifact.get("data"))
        merge(entries, data)

    ordered_entries = sorted(entries.values(), key=_proposal_sort_key)
    for entry in ordered_entries:
        entry["source_kinds"] = sorted(entry["source_kinds"])

    return {
        "api_version": "v1",
        "artifact_kind": PROPOSAL_INDEX_ARTIFACT_KIND,
        "generated_at": _now_iso(),
        "read_only": True,
        "source": source,
        "entry_count": len(ordered_entries),
        "entries": ordered_entries,
        "filters": {
            "status_counts": _count_by(ordered_entries, "status"),
            "authority_state_counts": _count_by(ordered_entries, "authority_state"),
            "runtime_state_counts": _count_by(ordered_entries, "runtime_state"),
            "runtime_posture_counts": _count_by(ordered_entries, "runtime_posture"),
            "affected_spec_ids": sorted(
                {
                    spec_id
                    for entry in ordered_entries
                    for spec_id in entry.get("affected_spec_ids", [])
                    if isinstance(spec_id, str) and spec_id
                }
            ),
        },
        "sources": {
            **sources,
            "proposal_markdown": {
                "available": bool(markdown.get("available")),
                "path": markdown.get("path"),
                "entry_count": markdown.get("entry_count", 0),
                "reason": markdown.get("reason"),
                "errors": markdown.get("errors", []),
            },
        },
    }


def read_file_proposal_index(
    *,
    runs_dir: Path | None,
    specgraph_dir: Path | None,
) -> tuple[int, dict[str, Any]]:
    sources: dict[str, dict[str, Any]] = {}
    artifacts: dict[str, dict[str, Any] | None] = {}
    for name, filename in PROPOSAL_ARTIFACTS.items():
        source, artifact = _read_file_artifact(runs_dir, filename)
        sources[name] = source
        artifacts[name] = artifact

    return HTTPStatus.OK, build_proposal_index(
        artifacts=artifacts,
        sources=sources,
        markdown=collect_local_proposal_markdown(specgraph_dir),
        source={
            "provider": "file",
            "runs_dir": str(runs_dir) if runs_dir is not None else None,
            "specgraph_dir": str(specgraph_dir) if specgraph_dir is not None else None,
        },
    )


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
