"""SpecGraph viewer surface read-model helpers."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

RUN_FILENAME_RE = re.compile(
    r"^(?P<ts>\d{8}T\d{6}Z)-(?P<spec_id>SG-[A-Z]+-\d+)-(?P<hash>[0-9a-f]+)\.json$",
)
JSON_STRING_RE = r'"(?:\\.|[^"\\])*"'


def runs_dir_from_spec_dir(spec_dir: Path | None) -> Path | None:
    if spec_dir is None:
        return None
    runs = spec_dir.parent.parent / "runs"
    return runs if runs.is_dir() else None


def runs_dir_from_context(spec_dir: Path | None, specgraph_dir: Path | None) -> Path | None:
    runs = runs_dir_from_spec_dir(spec_dir)
    if runs is not None:
        return runs
    if specgraph_dir is None:
        return None
    runs = specgraph_dir / "runs"
    return runs if runs.is_dir() else None


def supervisor_has_flags(specgraph_dir: Path | None, *flags: str) -> bool:
    if specgraph_dir is None:
        return False
    supervisor = specgraph_dir / "tools" / "supervisor.py"
    if not supervisor.exists():
        return False
    try:
        content = supervisor.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False
    return all(flag in content for flag in flags)


def envelope(path: Path, data: Any) -> dict[str, Any]:
    mtime = path.stat().st_mtime
    return {
        "path": str(path),
        "mtime": mtime,
        "mtime_iso": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
        "data": data,
    }


def read_json_artifact(path: Path, *, invalid_message: str) -> tuple[int, dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {"error": invalid_message, "detail": str(exc)}
    return HTTPStatus.OK, envelope(path, data)


def graph_dashboard_path(runs_dir: Path | None) -> Path | None:
    if runs_dir is None:
        return None
    path = runs_dir / "graph_dashboard.json"
    return path if path.exists() else None


def read_graph_dashboard(runs_dir: Path | None) -> tuple[int, dict[str, Any]]:
    path = graph_dashboard_path(runs_dir)
    if path is None:
        return HTTPStatus.NOT_FOUND, {"error": "graph_dashboard.json not found. Run --build-graph-dashboard first."}
    try:
        return HTTPStatus.OK, json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": "graph_dashboard.json is not valid JSON",
            "detail": str(exc),
        }


def read_graph_backlog_projection(spec_dir: Path | None, runs_dir: Path | None) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, {
            "error": "graph_backlog_projection.json not found. Run --build-graph-backlog-projection first."
        }
    path = runs_dir / "graph_backlog_projection.json"
    if not path.exists():
        return HTTPStatus.NOT_FOUND, {
            "error": "graph_backlog_projection.json not found. Run --build-graph-backlog-projection first."
        }
    return read_json_artifact(
        path,
        invalid_message="graph_backlog_projection.json is not valid JSON",
    )


def read_runs_artifact(
    *,
    spec_dir: Path | None,
    runs_dir: Path | None,
    filename: str,
    build_hint: str,
) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, {"error": f"{filename} not found. Run {build_hint} first."}
    path = runs_dir / filename
    if not path.exists():
        return HTTPStatus.NOT_FOUND, {"error": f"{filename} not found. Run {build_hint} first."}
    return read_json_artifact(path, invalid_message=f"{filename} is not valid JSON")


def parse_iso_compact(stamp: str) -> str:
    """Convert `20260427T204723Z` to ISO 8601 (`2026-04-27T20:47:23Z`)."""
    return f"{stamp[0:4]}-{stamp[4:6]}-{stamp[6:8]}T{stamp[9:11]}:{stamp[11:13]}:{stamp[13:15]}Z"


def harvest_run_meta(path: Path) -> dict[str, Any]:
    """Read the head of a run file and extract cheap summary fields."""
    head_bytes = 4096
    try:
        with path.open("rb") as fh:
            head = fh.read(head_bytes).decode("utf-8", errors="ignore")
    except OSError:
        return {}

    out: dict[str, Any] = {}
    for key in ("title", "run_kind", "completion_status", "execution_profile", "child_model"):
        match = re.search(rf'"{re.escape(key)}"\s*:\s*(?P<value>{JSON_STRING_RE})', head)
        if match:
            try:
                out[key] = json.loads(match.group("value"))
            except json.JSONDecodeError:
                pass
    match = re.search(r'"run_duration_sec"\s*:\s*([0-9.]+)', head)
    if match:
        try:
            out["duration_sec"] = float(match.group(1))
        except ValueError:
            pass
    return out


def collect_recent_runs(runs_dir: Path, *, limit: int, since_iso: str | None) -> dict[str, Any]:
    candidates: list[tuple[str, str, str, Path]] = []
    for entry in runs_dir.iterdir():
        if not entry.is_file() or entry.suffix != ".json":
            continue
        match = RUN_FILENAME_RE.match(entry.name)
        if not match:
            continue
        ts_iso = parse_iso_compact(match.group("ts"))
        if since_iso is not None and ts_iso <= since_iso:
            continue
        candidates.append((ts_iso, entry.stem, match.group("spec_id"), entry))

    candidates.sort(key=lambda candidate: (candidate[0], candidate[1]), reverse=True)

    events: list[dict[str, Any]] = []
    for ts_iso, run_id, spec_id, entry in candidates[:limit]:
        meta = harvest_run_meta(entry)
        events.append({
            "run_id": run_id,
            "ts": ts_iso,
            "spec_id": spec_id,
            "title": meta.get("title"),
            "run_kind": meta.get("run_kind"),
            "completion_status": meta.get("completion_status"),
            "duration_sec": meta.get("duration_sec"),
            "execution_profile": meta.get("execution_profile"),
            "child_model": meta.get("child_model"),
        })

    return {"events": events, "total": len(events)}


def read_spec_activity(
    *,
    spec_dir: Path | None,
    runs_dir: Path | None,
    limit_raw: str | None,
    since_raw: str | None,
) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, {
            "error": "spec_activity_feed.json not found. Run `make spec-activity` in SpecGraph first."
        }
    path = runs_dir / "spec_activity_feed.json"
    if not path.exists():
        return HTTPStatus.NOT_FOUND, {
            "error": "spec_activity_feed.json not found. Run `make spec-activity` in SpecGraph first."
        }
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": "spec_activity_feed.json is not valid JSON",
            "detail": str(exc),
        }

    try:
        limit: int | None = int(limit_raw) if limit_raw is not None else None
    except (TypeError, ValueError):
        limit = 50
    if limit is not None:
        limit = max(1, min(limit, 1000))
    since_iso = since_raw if isinstance(since_raw, str) and since_raw else None

    if (limit is not None or since_iso is not None) and isinstance(data, dict):
        entries = data.get("entries") or []
        if isinstance(entries, list):
            if since_iso is not None:
                entries = [
                    entry
                    for entry in entries
                    if isinstance(entry, dict)
                    and isinstance(entry.get("occurred_at"), str)
                    and entry["occurred_at"] > since_iso
                ]
            if limit is not None:
                entries = entries[:limit]
            data = {**data, "entries": entries, "entry_count": len(entries)}

    return HTTPStatus.OK, envelope(path, data)


def read_implementation_work_index(
    *,
    spec_dir: Path | None,
    runs_dir: Path | None,
    limit_raw: str | None,
) -> tuple[int, dict[str, Any]]:
    if runs_dir is None:
        return HTTPStatus.NOT_FOUND, {
            "error": "implementation_work_index.json not found. Run `make viewer-surfaces` in SpecGraph first."
        }
    path = runs_dir / "implementation_work_index.json"
    if not path.exists():
        return HTTPStatus.NOT_FOUND, {
            "error": "implementation_work_index.json not found. Run `make viewer-surfaces` in SpecGraph first."
        }
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return HTTPStatus.UNPROCESSABLE_ENTITY, {
            "error": "implementation_work_index.json is not valid JSON",
            "detail": str(exc),
        }

    try:
        limit: int | None = int(limit_raw) if limit_raw is not None else 50
    except (TypeError, ValueError):
        limit = 50
    if limit is not None:
        limit = max(1, min(limit, 1000))

    if limit is not None and isinstance(data, dict):
        entries = data.get("entries") or []
        if isinstance(entries, list):
            entries = entries[:limit]
            data = {**data, "entries": entries, "entry_count": len(entries)}

    return HTTPStatus.OK, envelope(path, data)


def read_optional_overlay(path: Path) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not path.exists():
        return None, None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return None, {
            "error": f"{path.name} is not valid JSON",
            "detail": str(exc),
            "path": str(path),
        }
    if not isinstance(data, dict):
        return None, {
            "error": f"{path.name} must contain a JSON object",
            "path": str(path),
        }
    return data, None


def collect_spec_overlay(runs_dir: Path) -> tuple[int, dict[str, Any]]:
    out: dict[str, Any] = {}

    health_path = runs_dir / "graph_health_overlay.json"
    data, error = read_optional_overlay(health_path)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    if data is not None:
        projection = data.get("viewer_projection", {})
        named_filters = projection.get("named_filters", {})
        spec_filters: dict[str, list[str]] = {}
        for filter_name, spec_ids in named_filters.items():
            if not isinstance(spec_ids, list):
                continue
            for spec_id in spec_ids:
                spec_filters.setdefault(spec_id, []).append(filter_name)
        for entry in data.get("entries", []):
            spec_id = entry.get("spec_id")
            if not spec_id:
                continue
            out.setdefault(spec_id, {})["health"] = {
                "gate_state": entry.get("gate_state", "none"),
                "signals": entry.get("signals", []),
                "recommended_actions": entry.get("recommended_actions", []),
                "filters": spec_filters.get(spec_id, []),
            }

    trace_path = runs_dir / "spec_trace_projection.json"
    data, error = read_optional_overlay(trace_path)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    if data is not None:
        projection = data.get("viewer_projection", {})
        for state_map_key in ("implementation_state", "freshness", "acceptance_coverage"):
            state_map = projection.get(state_map_key, {})
            for state, spec_ids in state_map.items():
                if not isinstance(spec_ids, list):
                    continue
                for spec_id in spec_ids:
                    node = out.setdefault(spec_id, {}).setdefault("implementation", {})
                    node[state_map_key] = state
        named_filters = projection.get("named_filters", {})
        implementation_filters: dict[str, list[str]] = {}
        for filter_name, spec_ids in named_filters.items():
            if not isinstance(spec_ids, list):
                continue
            for spec_id in spec_ids:
                implementation_filters.setdefault(spec_id, []).append(filter_name)
        for spec_id, filters in implementation_filters.items():
            out.setdefault(spec_id, {}).setdefault("implementation", {})["filters"] = filters

    evidence_path = runs_dir / "evidence_plane_overlay.json"
    data, error = read_optional_overlay(evidence_path)
    if error is not None:
        return HTTPStatus.UNPROCESSABLE_ENTITY, error
    if data is not None:
        projection = data.get("viewer_projection", {})
        for state_map_key in (
            "chain_status",
            "artifact_stage",
            "observation_coverage",
            "outcome_coverage",
            "adoption_coverage",
        ):
            state_map = projection.get(state_map_key, {})
            for state, spec_ids in state_map.items():
                if not isinstance(spec_ids, list):
                    continue
                for spec_id in spec_ids:
                    node = out.setdefault(spec_id, {}).setdefault("evidence", {})
                    node[state_map_key] = state
        named_filters = projection.get("named_filters", {})
        evidence_filters: dict[str, list[str]] = {}
        for filter_name, spec_ids in named_filters.items():
            if not isinstance(spec_ids, list):
                continue
            for spec_id in spec_ids:
                evidence_filters.setdefault(spec_id, []).append(filter_name)
        for spec_id, filters in evidence_filters.items():
            out.setdefault(spec_id, {}).setdefault("evidence", {})["filters"] = filters

    return HTTPStatus.OK, {"overlays": out}
