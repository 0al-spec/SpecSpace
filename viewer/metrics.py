"""Readonly metrics viewer read model for SpecSpace."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any

from viewer import specgraph_surfaces

METRICS_INDEX_ARTIFACT_KIND = "specspace_metrics_index"
METRICS_ARTIFACTS: dict[str, str] = {
    "graph_dashboard": "graph_dashboard.json",
    "metrics_source_promotion": "metrics_source_promotion_index.json",
    "metrics_delivery": "metrics_delivery_workflow.json",
    "metrics_feedback": "metrics_feedback_index.json",
    "metric_pack_adapters": "metric_pack_adapter_index.json",
    "metric_pack_runs": "metric_pack_runs.json",
    "metric_signals": "metric_signal_index.json",
}

CATEGORY_ORDER = {
    "metric_score": 0,
    "metric_signal": 1,
    "source_promotion": 2,
    "delivery": 3,
    "feedback": 4,
    "metric_pack_adapter": 5,
    "metric_pack_run": 6,
}


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list_of_dicts(value: Any) -> list[dict[str, Any]]:
    return [entry for entry in value if isinstance(entry, dict)] if isinstance(value, list) else []


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _text(value: Any, default: str = "") -> str:
    return value if isinstance(value, str) and value else default


def _number(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


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
    entries = data.get("entries")
    if isinstance(entries, list):
        return len(entries)
    metrics = data.get("metrics")
    if isinstance(metrics, list):
        return len(metrics)
    metric_scores = _nested(data, "sections", "metrics", "metric_scores")
    if isinstance(metric_scores, dict):
        return len(metric_scores)
    return 0


def _format_key(value: str) -> str:
    return value.replace("_", " ").replace("-", " ").strip().title()


def _flatten_strings(value: Any) -> list[str]:
    if isinstance(value, str) and value:
        return [value]
    if isinstance(value, list):
        refs: list[str] = []
        for item in value:
            refs.extend(_flatten_strings(item))
        return refs
    if isinstance(value, dict):
        refs = []
        for item in value.values():
            refs.extend(_flatten_strings(item))
        return refs
    return []


def _references(*values: Any) -> list[str]:
    refs: list[str] = []
    for value in values:
        refs.extend(_flatten_strings(value))
    return sorted({ref for ref in refs if ref})


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


def _read_file_artifact(runs_dir: Path | None, name: str, filename: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
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
    return artifact_source(name, filename, payload), payload


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


def _artifact_data(artifacts: dict[str, dict[str, Any] | None], name: str) -> dict[str, Any]:
    artifact = artifacts.get(name)
    if artifact is None:
        return {}
    return _dict(artifact.get("data"))


def _entry(
    *,
    category: str,
    item_id: str,
    title: str,
    status: str,
    source_kind: str,
    secondary_status: str | None = None,
    score: float | None = None,
    minimum_score: float | None = None,
    value: str | None = None,
    next_gap: str | None = None,
    reference_texts: list[str] | None = None,
    summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "metric_key": f"{category}::{item_id}",
        "category": category,
        "item_id": item_id,
        "title": title,
        "status": status or "unknown",
        "secondary_status": secondary_status,
        "score": score,
        "minimum_score": minimum_score,
        "value": value,
        "next_gap": next_gap,
        "source_kind": source_kind,
        "reference_texts": reference_texts or [],
        "summary": summary or {},
    }


def _merge_dashboard(entries: list[dict[str, Any]], data: dict[str, Any]) -> None:
    metric_scores = _dict(_nested(data, "sections", "metrics", "metric_scores"))
    for metric_id, raw in sorted(metric_scores.items()):
        metric = _dict(raw)
        entries.append(
            _entry(
                category="metric_score",
                item_id=metric_id,
                title=_text(metric.get("title"), _format_key(metric_id)),
                status=_text(metric.get("status"), "unknown"),
                source_kind="graph_dashboard",
                score=_number(metric.get("score")),
                minimum_score=_number(metric.get("minimum_score")),
                value=_text(metric.get("value_status")),
                next_gap=_text(metric.get("next_gap")) or None,
                reference_texts=_references(metric_id, metric.get("source_refs"), metric.get("target_spec_ids")),
                summary={
                    "threshold_gap": metric.get("threshold_gap"),
                    "trigger_signal": metric.get("trigger_signal"),
                },
            )
        )


def _merge_metric_signals(entries: list[dict[str, Any]], data: dict[str, Any]) -> None:
    signals = _list_of_dicts(data.get("metrics")) or _list_of_dicts(data.get("entries"))
    for item in signals:
        metric_id = _text(item.get("metric_id"))
        if not metric_id:
            continue
        entries.append(
            _entry(
                category="metric_signal",
                item_id=metric_id,
                title=_text(item.get("title"), _format_key(metric_id)),
                status=_text(item.get("status"), "unknown"),
                source_kind="metric_signals",
                score=_number(item.get("score")),
                minimum_score=_number(item.get("minimum_score")),
                next_gap=_text(item.get("next_gap")) or None,
                reference_texts=_references(metric_id, item.get("source_refs"), item.get("target_spec_ids")),
                summary={
                    "threshold_gap": item.get("threshold_gap"),
                    "signal_emitted": item.get("signal_emitted"),
                    "basis": item.get("basis"),
                },
            )
        )


def _merge_source_promotion(entries: list[dict[str, Any]], data: dict[str, Any]) -> None:
    for item in _list_of_dicts(data.get("entries")):
        item_id = _text(item.get("promotion_id")) or _text(item.get("metric_id"))
        if not item_id:
            continue
        entries.append(
            _entry(
                category="source_promotion",
                item_id=item_id,
                title=_text(item.get("title"), _format_key(item_id)),
                status=_text(item.get("promotion_status"), "unknown"),
                secondary_status=_text(item.get("authority_state")) or None,
                source_kind="metrics_source_promotion",
                next_gap=_text(item.get("next_gap")) or None,
                reference_texts=_references(
                    item.get("metric_id"),
                    item.get("candidate_metric_id"),
                    item.get("legacy_metric_ids"),
                    item.get("threshold_proposal_ids"),
                    item.get("target_spec_ids"),
                ),
                summary={
                    "consumer_id": item.get("consumer_id"),
                    "review_state": item.get("review_state"),
                },
            )
        )


def _merge_delivery(entries: list[dict[str, Any]], data: dict[str, Any]) -> None:
    for item in _list_of_dicts(data.get("entries")):
        item_id = _text(item.get("delivery_id")) or _text(item.get("consumer_id"))
        if not item_id:
            continue
        entries.append(
            _entry(
                category="delivery",
                item_id=item_id,
                title=_text(item.get("title"), _format_key(item_id)),
                status=_text(item.get("delivery_status"), "unknown"),
                secondary_status=_text(item.get("review_state")) or None,
                source_kind="metrics_delivery",
                next_gap=_text(item.get("next_gap")) or None,
                reference_texts=_references(
                    item.get("consumer_id"),
                    item.get("bound_metric_ids"),
                    item.get("threshold_proposal_ids"),
                    item.get("delivery_paths"),
                    item.get("target_spec_ids"),
                ),
                summary={
                    "target_consumer": item.get("target_consumer"),
                    "handoff_id": item.get("handoff_id"),
                },
            )
        )


def _merge_feedback(entries: list[dict[str, Any]], data: dict[str, Any]) -> None:
    for item in _list_of_dicts(data.get("entries")):
        item_id = _text(item.get("feedback_id")) or _text(item.get("consumer_id"))
        if not item_id:
            continue
        entries.append(
            _entry(
                category="feedback",
                item_id=item_id,
                title=_text(item.get("title"), _format_key(item_id)),
                status=_text(item.get("feedback_status"), "unknown"),
                secondary_status=_text(item.get("review_state")) or None,
                source_kind="metrics_feedback",
                next_gap=_text(item.get("next_gap")) or None,
                reference_texts=_references(
                    item.get("consumer_id"),
                    item.get("bound_metric_ids"),
                    item.get("threshold_proposal_ids"),
                    item.get("target_spec_ids"),
                ),
                summary={
                    "delivery_id": item.get("delivery_id"),
                    "handoff_id": item.get("handoff_id"),
                },
            )
        )


def _merge_adapter(entries: list[dict[str, Any]], data: dict[str, Any]) -> None:
    for item in _list_of_dicts(data.get("entries")):
        item_id = _text(item.get("metric_pack_id"))
        if not item_id:
            continue
        entries.append(
            _entry(
                category="metric_pack_adapter",
                item_id=item_id,
                title=_text(item.get("title"), _format_key(item_id)),
                status=_text(item.get("adapter_status"), "unknown"),
                secondary_status=_text(item.get("pack_status")) or None,
                source_kind="metric_pack_adapters",
                next_gap=_text(item.get("next_gap")) or None,
                reference_texts=_references(
                    item.get("metric_pack_id"),
                    item.get("missing_inputs"),
                    item.get("target_spec_ids"),
                    [input_item.get("source_artifact") for input_item in _list_of_dicts(item.get("inputs"))],
                ),
                summary={
                    "input_count": item.get("input_count"),
                    "missing_input_count": item.get("missing_input_count"),
                    "review_state": item.get("review_state"),
                },
            )
        )


def _merge_runs(entries: list[dict[str, Any]], data: dict[str, Any]) -> None:
    for item in _list_of_dicts(data.get("entries")):
        item_id = _text(item.get("run_id")) or _text(item.get("metric_pack_id"))
        if not item_id:
            continue
        computed_values = _list_of_dicts(item.get("computed_values"))
        entries.append(
            _entry(
                category="metric_pack_run",
                item_id=item_id,
                title=_text(item.get("title"), _format_key(item_id)),
                status=_text(item.get("run_status"), "unknown"),
                secondary_status=_text(item.get("review_state")) or None,
                source_kind="metric_pack_runs",
                value=f"{len(computed_values)} values",
                next_gap=_text(item.get("next_gap")) or None,
                reference_texts=_references(
                    item.get("metric_pack_id"),
                    item.get("target_spec_ids"),
                    [value.get("metric_id") for value in computed_values],
                ),
                summary={
                    "computed_value_count": len(computed_values),
                    "gap_count": len(_list_of_dicts(item.get("gaps"))),
                    "threshold_authority_granted": item.get("threshold_authority_granted"),
                },
            )
        )


def _dashboard_summary(data: dict[str, Any]) -> dict[str, Any]:
    metrics = _dict(_nested(data, "sections", "metrics"))
    external_consumers = _dict(_nested(data, "sections", "external_consumers"))
    return {
        "available": bool(data),
        "metric_count": metrics.get("metric_count", 0),
        "metric_status_counts": metrics.get("metric_status_counts", {}),
        "below_threshold_metric_ids": metrics.get("below_threshold_metric_ids", []),
        "metric_pack_entry_count": metrics.get("metric_pack_entry_count", 0),
        "metric_pack_adapter_entry_count": metrics.get("metric_pack_adapter_entry_count", 0),
        "metrics_delivery_entry_count": external_consumers.get("metrics_delivery_entry_count", 0),
        "metrics_feedback_entry_count": external_consumers.get("metrics_feedback_entry_count", 0),
        "metrics_source_promotion_entry_count": external_consumers.get("metrics_source_promotion_entry_count", 0),
        "external_consumer_entry_count": external_consumers.get("entry_count", 0),
    }


def _sort_key(entry: dict[str, Any]) -> tuple[int, str, str]:
    return (
        CATEGORY_ORDER.get(_text(entry.get("category")), 99),
        _text(entry.get("status")),
        _text(entry.get("item_id")),
    )


def build_metrics_index(
    *,
    artifacts: dict[str, dict[str, Any] | None],
    sources: dict[str, dict[str, Any]],
    source: dict[str, Any],
) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    _merge_dashboard(entries, _artifact_data(artifacts, "graph_dashboard"))
    _merge_metric_signals(entries, _artifact_data(artifacts, "metric_signals"))
    _merge_source_promotion(entries, _artifact_data(artifacts, "metrics_source_promotion"))
    _merge_delivery(entries, _artifact_data(artifacts, "metrics_delivery"))
    _merge_feedback(entries, _artifact_data(artifacts, "metrics_feedback"))
    _merge_adapter(entries, _artifact_data(artifacts, "metric_pack_adapters"))
    _merge_runs(entries, _artifact_data(artifacts, "metric_pack_runs"))

    ordered_entries = sorted(entries, key=_sort_key)
    reference_texts = sorted(
        {
            ref
            for entry in ordered_entries
            for ref in entry.get("reference_texts", [])
            if isinstance(ref, str) and ref
        }
    )

    return {
        "api_version": "v1",
        "artifact_kind": METRICS_INDEX_ARTIFACT_KIND,
        "generated_at": _now_iso(),
        "read_only": True,
        "source": source,
        "entry_count": len(ordered_entries),
        "entries": ordered_entries,
        "filters": {
            "category_counts": _count_by(ordered_entries, "category"),
            "status_counts": _count_by(ordered_entries, "status"),
            "source_kind_counts": _count_by(ordered_entries, "source_kind"),
            "reference_texts": reference_texts,
        },
        "dashboard": _dashboard_summary(_artifact_data(artifacts, "graph_dashboard")),
        "sources": sources,
    }


def read_file_metrics_index(*, runs_dir: Path | None) -> tuple[int, dict[str, Any]]:
    sources: dict[str, dict[str, Any]] = {}
    artifacts: dict[str, dict[str, Any] | None] = {}
    for name, filename in METRICS_ARTIFACTS.items():
        source, artifact = _read_file_artifact(runs_dir, name, filename)
        sources[name] = source
        artifacts[name] = artifact

    return HTTPStatus.OK, build_metrics_index(
        artifacts=artifacts,
        sources=sources,
        source={
            "provider": "file",
            "runs_dir": str(runs_dir) if runs_dir is not None else None,
        },
    )
