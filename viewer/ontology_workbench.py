"""Consolidated read-only Ontology Workbench read model."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from viewer import practical_ontology

ONTOLOGY_WORKBENCH_ARTIFACT_KIND = "specspace_ontology_workbench"
GAP_REVIEW_WORKFLOW_ARTIFACT = "ontology_gap_review_workflow.json"
OWNER_DECISION_IMPORT_V2_ARTIFACT = "ontology_owner_decision_import_v2.json"
LEGACY_BACKFILL_PLAN_ARTIFACT = "legacy_spec_ontology_backfill_plan.json"
SPECAUTHOR_WRITE_GATE_ARTIFACT = "specauthor_ontology_write_gate_report.json"
SPEC_ONTOLOGY_VALIDATION_ARTIFACT = "spec_ontology_validation_report.json"
OWNER_DECISION_IMPORT_PREVIEW_ARTIFACT = "ontology_decision_import_preview.json"
ONTOLOGY_LAYERS: tuple[str, ...] = (
    "objective",
    "mechanics",
    "execution",
    "meta",
    "multi_agent",
)
APPLICABILITY_SCOPE_FIELDS: tuple[tuple[str, str], ...] = (
    ("domains", "domains"),
    ("lifecycle_phases", "lifecyclePhases"),
    ("agent_types", "agentTypes"),
    ("subsystems", "subsystems"),
    ("runtimes", "runtimes"),
    ("platforms", "platforms"),
    ("contexts", "contexts"),
)

ADDITIONAL_RUN_ARTIFACTS: tuple[str, ...] = (
    GAP_REVIEW_WORKFLOW_ARTIFACT,
    OWNER_DECISION_IMPORT_V2_ARTIFACT,
    LEGACY_BACKFILL_PLAN_ARTIFACT,
    SPECAUTHOR_WRITE_GATE_ARTIFACT,
    SPEC_ONTOLOGY_VALIDATION_ARTIFACT,
    OWNER_DECISION_IMPORT_PREVIEW_ARTIFACT,
)

WORKBENCH_PUBLIC_SAFE_RUN_ARTIFACTS: tuple[str, ...] = (
    practical_ontology.PACKAGE_INDEX_ARTIFACT,
    practical_ontology.BINDING_PREVIEW_ARTIFACT,
    practical_ontology.GAP_INDEX_ARTIFACT,
    practical_ontology.COMPATIBILITY_DIFF_PREVIEW_ARTIFACT,
    practical_ontology.GOVERNANCE_EVIDENCE_INDEX_ARTIFACT,
    *ADDITIONAL_RUN_ARTIFACTS,
)

DISPLAY_LIMITS = {
    "classes": 80,
    "relations": 80,
    "gap_groups": 40,
    "compliance_entries": 30,
    "write_gate_findings": 30,
    "owner_decisions": 30,
    "legacy_batches": 20,
}


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _records(value: Any) -> list[dict[str, Any]]:
    return (
        [item for item in value if isinstance(item, dict)]
        if isinstance(value, list)
        else []
    )


def _text(value: Any, default: str = "") -> str:
    return value if isinstance(value, str) and value.strip() else default


def _optional_text(value: Any) -> str | None:
    text = _text(value)
    return text or None


def _number(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    return value if isinstance(value, int) and value >= 0 else 0


def _string_list(value: Any) -> list[str]:
    if isinstance(value, str) and value:
        return [value]
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _append_unique_layers(
    layers: list[str],
    seen: set[str],
    values: Any,
) -> None:
    for layer in _string_list(values):
        if layer not in seen:
            seen.add(layer)
            layers.append(layer)


def _layer_count_map(value: Any) -> dict[str, int]:
    counts = _record(value)
    return {
        layer: count
        for layer, raw_count in counts.items()
        if isinstance(layer, str)
        if (count := _number(raw_count)) > 0
    }


def _artifact_data(artifacts: dict[str, Any], key: str) -> dict[str, Any] | None:
    value = artifacts.get(key)
    if not isinstance(value, dict):
        return None
    data = value.get("data")
    if isinstance(data, dict):
        return data
    return value


def _artifact_status(artifacts: dict[str, Any], key: str, path: str) -> dict[str, Any]:
    data = _artifact_data(artifacts, key)
    if data is None:
        return {
            "available": False,
            "path": path,
            "reason": "missing_artifact",
        }
    summary = data.get("summary")
    return {
        "available": True,
        "path": path,
        "artifact_kind": _optional_text(data.get("artifact_kind")),
        "schema_version": data.get("schema_version")
        if isinstance(data.get("schema_version"), int)
        else None,
        "status": _optional_text(data.get("status") or _record(summary).get("status")),
        "summary": summary if isinstance(summary, dict) else None,
    }


def _run_artifact_status(artifacts: dict[str, Any], key: str) -> dict[str, Any]:
    return _artifact_status(artifacts, key, f"runs/{key}")


def _normalized_ir_status(
    artifacts: dict[str, Any], practical: dict[str, Any]
) -> dict[str, Any]:
    package = _record(practical.get("package"))
    path = _text(
        package.get("materialized_ir"), practical_ontology.NORMALIZED_IR_ARTIFACT_KEY
    )
    return _artifact_status(
        artifacts, practical_ontology.NORMALIZED_IR_ARTIFACT_KEY, path
    )


def _package_summary(practical: dict[str, Any]) -> dict[str, Any] | None:
    package = practical.get("package")
    if not isinstance(package, dict):
        return None
    return {
        "package_id": _text(package.get("package_id")),
        "namespace": _text(package.get("namespace")),
        "version": _text(package.get("version")),
        "package_ref": _text(package.get("package_ref")),
        "authority_class": _text(package.get("authority_class"), "unknown"),
        "source_ref": _optional_text(package.get("source_ref")),
        "source_uri": _optional_text(package.get("source_uri")),
        "digest": _optional_text(package.get("digest")),
        "materialized_ir": _optional_text(package.get("materialized_ir")),
        "accepted_by_proposal": _optional_text(package.get("accepted_by_proposal")),
    }


def _class_rows(ir: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not ir:
        return []
    rows: list[dict[str, Any]] = []
    for item in _records(ir.get("classes"))[: DISPLAY_LIMITS["classes"]]:
        class_id = _text(item.get("id"))
        if not class_id:
            continue
        rows.append(
            {
                "id": class_id,
                "fqid": _optional_text(item.get("fqid")),
                "uri": _optional_text(item.get("uri")),
                "description": _optional_text(item.get("description")),
            }
        )
    return rows


def _relation_rows(ir: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not ir:
        return []
    rows: list[dict[str, Any]] = []
    for item in _records(ir.get("relations"))[: DISPLAY_LIMITS["relations"]]:
        relation_id = _text(item.get("id"))
        if not relation_id:
            continue
        rows.append(
            {
                "id": relation_id,
                "fqid": _optional_text(item.get("fqid")),
                "domain": _optional_text(item.get("domain")),
                "range": _optional_text(item.get("range")),
                "uri": _optional_text(item.get("uri")),
                "description": _optional_text(item.get("description")),
            }
        )
    return rows


def _layer_lens(
    *,
    package_index: dict[str, Any] | None,
    gap_index: dict[str, Any] | None,
    compatibility_diff: dict[str, Any] | None,
) -> dict[str, Any]:
    package_layer_summaries = [
        summary
        for package in _records((package_index or {}).get("packages"))
        if (summary := _record(package.get("ontology_layer_summary")))
    ]
    gap_layer_summary = _record(
        _record((gap_index or {}).get("summary")).get("layer_review")
    )
    diff_layer_review = _record((compatibility_diff or {}).get("layer_review"))
    known_layers: list[str] = []
    seen_layers: set[str] = set()
    package_counts: dict[str, int] = {}
    package_layered_entry_count = 0
    package_unlayered_entry_count = 0
    for package_layer_summary in package_layer_summaries:
        _append_unique_layers(
            known_layers,
            seen_layers,
            package_layer_summary.get("known_layers"),
        )
        for layer, count in _layer_count_map(
            package_layer_summary.get("layer_counts")
        ).items():
            if layer not in seen_layers:
                seen_layers.add(layer)
                known_layers.append(layer)
            package_counts[layer] = package_counts.get(layer, 0) + count
        package_layered_entry_count += _number(
            package_layer_summary.get("layered_entry_count")
        )
        package_unlayered_entry_count += _number(
            package_layer_summary.get("unlayered_entry_count")
        )
    gap_counts = _layer_count_map(gap_layer_summary.get("layer_counts"))
    diff_counts = _layer_count_map(diff_layer_review.get("layer_counts"))
    for layer_review, counts in (
        (gap_layer_summary, gap_counts),
        (diff_layer_review, diff_counts),
    ):
        _append_unique_layers(known_layers, seen_layers, layer_review.get("known_layers"))
        for layer in counts:
            if layer not in seen_layers:
                seen_layers.add(layer)
                known_layers.append(layer)
    if not known_layers:
        known_layers = list(ONTOLOGY_LAYERS)

    rows = []
    for layer in known_layers:
        package_entry_count = package_counts.get(layer, 0)
        gap_count = gap_counts.get(layer, 0)
        diff_change_count = diff_counts.get(layer, 0)
        total_count = package_entry_count + gap_count + diff_change_count
        if total_count == 0:
            continue
        rows.append(
            {
                "layer": layer,
                "package_entry_count": package_entry_count,
                "gap_count": gap_count,
                "diff_change_count": diff_change_count,
                "total_count": total_count,
            }
        )

    unassigned_diff_refs = [
        {
            "change_type": _text(item.get("change_type"), "unknown"),
            "ref": _text(item.get("ref"), "unknown"),
        }
        for item in _records(diff_layer_review.get("unassigned_refs"))[:10]
    ]
    return {
        "known_layers": known_layers,
        "rows": rows,
        "summary": {
            "known_layer_count": len(known_layers),
            "used_layer_count": len(rows),
            "package_layered_entry_count": package_layered_entry_count,
            "package_unlayered_entry_count": package_unlayered_entry_count,
            "gap_unassigned_layer_count": _number(
                gap_layer_summary.get("unassigned_layer_count")
            ),
            "diff_unassigned_change_count": _number(
                diff_layer_review.get("unassigned_change_count")
            ),
        },
        "unassigned": {
            "gap_count": _number(gap_layer_summary.get("unassigned_layer_count")),
            "diff_change_count": _number(
                diff_layer_review.get("unassigned_change_count")
            ),
            "diff_refs": unassigned_diff_refs,
        },
    }


def _package_ref(package: dict[str, Any]) -> str:
    lock = _record(package.get("lock"))
    return _text(lock.get("package_ref")) or _text(
        package.get("package_ref"),
        _text(package.get("package_id"), "unknown-package"),
    )


def _gap_group_rows(workflow: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not workflow:
        return []
    rows: list[dict[str, Any]] = []
    for item in _records(workflow.get("gap_groups"))[: DISPLAY_LIMITS["gap_groups"]]:
        rows.append(
            {
                "group_id": _text(item.get("group_id"), "ontology-gap-group"),
                "gap_kind": _text(item.get("gap_kind"), "unknown"),
                "gap_key": _optional_text(item.get("gap_key")),
                "review_state": _text(item.get("review_state"), "unknown"),
                "recommended_owner_action": _optional_text(
                    item.get("recommended_owner_action")
                ),
                "recommended_route": _optional_text(item.get("recommended_route")),
                "proposed_term": _optional_text(item.get("proposed_term")),
                "proposed_relation": _optional_text(item.get("proposed_relation")),
                "source_spec_count": _number(item.get("source_spec_count")),
                "affected_generated_artifact_count": _number(
                    item.get("affected_generated_artifact_count")
                ),
                "source_specs": [
                    {
                        "spec_id": _text(spec.get("spec_id")),
                        "path": _optional_text(spec.get("path")),
                        "source": _optional_text(spec.get("source")),
                        "term": _optional_text(spec.get("term")),
                        "classification": _optional_text(spec.get("classification")),
                    }
                    for spec in _records(item.get("source_specs"))[:6]
                    if _text(spec.get("spec_id"))
                ],
            }
        )
    return rows


def _compliance_rows(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not report:
        return []
    entries = [
        entry
        for entry in _records(report.get("entries"))
        if _records(entry.get("findings"))
    ]
    rows: list[dict[str, Any]] = []
    for entry in entries[: DISPLAY_LIMITS["compliance_entries"]]:
        findings = _records(entry.get("findings"))
        rows.append(
            {
                "spec_id": _text(entry.get("spec_id")),
                "path": _optional_text(entry.get("path")),
                "validation_status": _text(entry.get("validation_status"), "unknown"),
                "finding_count": len(findings),
                "terms": [
                    term
                    for term in (_text(finding.get("term")) for finding in findings)
                    if term
                ][:10],
                "findings": [
                    {
                        "finding_id": _text(finding.get("finding_id")),
                        "severity": _text(finding.get("severity"), "unknown"),
                        "classification": _text(
                            finding.get("classification"), "unknown"
                        ),
                        "term": _optional_text(finding.get("term")),
                        "gap_ref": _optional_text(finding.get("gap_ref")),
                        "suggested_action": _optional_text(
                            finding.get("suggested_action")
                        ),
                    }
                    for finding in findings[:6]
                    if _text(finding.get("finding_id"))
                ],
            }
        )
    return rows


def _write_gate_rows(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not report:
        return []
    return [
        {
            "finding_id": _text(item.get("finding_id"), "write-gate-finding"),
            "severity": _text(item.get("severity"), "unknown"),
            "message": _text(item.get("message"), "Write gate finding."),
            "source_ref": _optional_text(item.get("source_ref")),
        }
        for item in _records(report.get("findings"))[
            : DISPLAY_LIMITS["write_gate_findings"]
        ]
    ]


def _owner_decision_rows(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not report:
        return []
    raw_rows = _records(report.get("decision_import_reviews")) or _records(
        report.get("decision_import_previews")
    )
    rows: list[dict[str, Any]] = []
    for item in raw_rows[: DISPLAY_LIMITS["owner_decisions"]]:
        rows.append(
            {
                "review_id": _text(
                    item.get("review_id"),
                    _text(
                        item.get("preview_id"),
                        _text(item.get("decision_id"), "owner-decision"),
                    ),
                ),
                "decision_id": _optional_text(item.get("decision_id")),
                "decision_state": _text(item.get("decision_state"), "unknown"),
                "review_state": _text(
                    item.get("review_state"),
                    _text(item.get("preview_state"), "unknown"),
                ),
                "candidate_id": _optional_text(item.get("candidate_id")),
                "gap_group_id": _optional_text(item.get("gap_group_id")),
                "matched_gap_group_id": _optional_text(
                    item.get("matched_gap_group_id")
                ),
                "import_recommended": item.get("import_recommended") is True,
                "required_human_action": _optional_text(
                    item.get("required_human_action")
                ),
                "before_semantic_status": _optional_text(
                    item.get("before_semantic_status")
                ),
                "after_semantic_status": _optional_text(
                    item.get("after_semantic_status")
                ),
                "evidence_refs": _string_list(item.get("evidence_refs")),
            }
        )
    return rows


def _legacy_batch_rows(report: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not report:
        return []
    rows: list[dict[str, Any]] = []
    for item in _records(report.get("small_pr_batches"))[
        : DISPLAY_LIMITS["legacy_batches"]
    ]:
        rows.append(
            {
                "batch_id": _text(item.get("batch_id"), "legacy-backfill-batch"),
                "review_state": _text(item.get("review_state"), "unknown"),
                "recommended_pr_scope": _optional_text(
                    item.get("recommended_pr_scope")
                ),
                "spec_count": _number(item.get("spec_count")),
                "finding_count": _number(item.get("finding_count")),
                "writes_ontology_package": item.get("writes_ontology_package") is True,
                "mutates_canonical_specs": item.get("mutates_canonical_specs") is True,
                "specs": [
                    {
                        "spec_id": _text(spec.get("spec_id")),
                        "path": _optional_text(spec.get("path")),
                        "finding_count": _number(spec.get("finding_count")),
                        "unknown_terms": _string_list(spec.get("unknown_terms")),
                    }
                    for spec in _records(item.get("specs"))[:6]
                    if _text(spec.get("spec_id"))
                ],
            }
        )
    return rows


def _applicability_scope(value: Any) -> dict[str, list[str]]:
    scope = _record(value)
    return {
        output_key: values
        for output_key, input_key in APPLICABILITY_SCOPE_FIELDS
        if (values := _string_list(scope.get(input_key)))
    }


def _applicability_records(value: Any) -> list[dict[str, Any]]:
    rows = []
    for item in _records(value):
        record_id = _text(item.get("id"))
        if not record_id:
            continue
        rows.append(
            {
                "id": record_id,
                "layer": _optional_text(item.get("layer")),
                "text": _text(item.get("text"), "No text supplied."),
            }
        )
    return rows


def _applicability_lens(package_index: dict[str, Any] | None) -> dict[str, Any]:
    profiles = []
    layer_counts: dict[str, int] = {}
    for package in _records((package_index or {}).get("packages")):
        profile = _record(package.get("model_applicability"))
        summary = _record(package.get("model_applicability_summary"))
        if not profile and _text(summary.get("status")) != "declared":
            continue
        assumptions = _applicability_records(profile.get("assumptions"))
        invalidation_triggers = _applicability_records(
            profile.get("invalidation_triggers")
        )
        for record in assumptions + invalidation_triggers:
            layer = record.get("layer")
            if isinstance(layer, str) and layer:
                layer_counts[layer] = layer_counts.get(layer, 0) + 1
        profiles.append(
            {
                "package_id": _text(package.get("package_id"), "unknown-package"),
                "package_ref": _package_ref(package),
                "status": _text(summary.get("status"), "declared"),
                "applies_to": _applicability_scope(profile.get("applies_to")),
                "excludes": _applicability_scope(profile.get("excludes")),
                "assumptions": assumptions,
                "invalidation_triggers": invalidation_triggers,
                "summary": {
                    "assumption_count": _number(summary.get("assumption_count"))
                    or len(assumptions),
                    "invalidation_trigger_count": _number(
                        summary.get("invalidation_trigger_count")
                    )
                    or len(invalidation_triggers),
                    "used_layers": _string_list(summary.get("used_layers")),
                },
            }
        )
    used_layers = sorted(layer_counts)
    return {
        "summary": {
            "profile_count": len(profiles),
            "assumption_count": sum(
                len(profile["assumptions"]) for profile in profiles
            ),
            "invalidation_trigger_count": sum(
                len(profile["invalidation_triggers"]) for profile in profiles
            ),
            "used_layer_count": len(used_layers),
            "used_layers": used_layers,
            "layer_counts": layer_counts,
        },
        "profiles": profiles,
    }


def _change_classification_rows(value: Any) -> list[dict[str, Any]]:
    rows = []
    for item in _records(value):
        ref = _text(item.get("ref"))
        if not ref:
            continue
        rows.append(
            {
                "kind": _text(item.get("kind"), "unknown"),
                "ref": ref,
                "target_kind": _optional_text(item.get("target_kind")),
                "before": _optional_text(item.get("before")),
                "after": _optional_text(item.get("after")),
                "compatibility": _optional_text(item.get("compatibility")),
            }
        )
    return rows


def _diff_classification_lens(compatibility_diff: dict[str, Any] | None) -> dict[str, Any]:
    classification = _record((compatibility_diff or {}).get("change_classification"))
    structural_changes = _change_classification_rows(
        classification.get("structural_changes")
    )
    annotation_changes = _change_classification_rows(
        classification.get("annotation_changes")
    )
    applicability_changes = _change_classification_rows(
        classification.get("applicability_changes")
    )
    return {
        "summary": {
            "structural_change_count": len(structural_changes),
            "annotation_change_count": len(annotation_changes),
            "applicability_change_count": len(applicability_changes),
            "total_change_count": len(structural_changes)
            + len(annotation_changes)
            + len(applicability_changes),
        },
        "structural_changes": structural_changes,
        "annotation_changes": annotation_changes,
        "applicability_changes": applicability_changes,
    }


def _summary(
    *,
    practical: dict[str, Any],
    gap_workflow: dict[str, Any] | None,
    compliance: dict[str, Any] | None,
    write_gate: dict[str, Any] | None,
    owner_decisions: dict[str, Any] | None,
    legacy_backfill: dict[str, Any] | None,
    artifacts: dict[str, Any],
) -> dict[str, Any]:
    practical_summary = _record(practical.get("summary"))
    gap_summary = _record((gap_workflow or {}).get("summary"))
    compliance_summary = _record((compliance or {}).get("summary"))
    write_gate_summary = _record((write_gate or {}).get("summary"))
    owner_summary = _record((owner_decisions or {}).get("summary"))
    legacy_summary = _record((legacy_backfill or {}).get("summary"))
    expected_artifact_keys = {
        *WORKBENCH_PUBLIC_SAFE_RUN_ARTIFACTS,
        practical_ontology.NORMALIZED_IR_ARTIFACT_KEY,
    }
    missing_artifact_count = sum(
        1 for key in expected_artifact_keys if _artifact_data(artifacts, key) is None
    )
    status = "ready"
    if missing_artifact_count:
        status = "partial"
    if not practical.get("terms"):
        status = "unavailable"
    return {
        "status": status,
        "term_count": _number(practical_summary.get("term_count")),
        "relation_count": _number(practical_summary.get("semantic_relation_count")),
        "domain_count": _number(practical_summary.get("domain_count")),
        "package_count": _number(
            _record(
                _artifact_data(artifacts, practical_ontology.PACKAGE_INDEX_ARTIFACT)
            )
            .get("summary", {})
            .get("package_count")
        )
        or (1 if practical.get("package") else 0),
        "gap_count": _number(practical_summary.get("gap_count")),
        "gap_group_count": _number(gap_summary.get("gap_group_count")),
        "compliance_spec_count": _number(compliance_summary.get("spec_count")),
        "compliance_finding_count": _number(compliance_summary.get("finding_count")),
        "write_gate_finding_count": _number(write_gate_summary.get("finding_count")),
        "owner_decision_review_count": _number(owner_summary.get("review_count"))
        or _number(owner_summary.get("preview_count")),
        "owner_decision_importable_count": _number(
            owner_summary.get("importable_count")
        ),
        "legacy_spec_count": _number(legacy_summary.get("spec_count")),
        "legacy_review_required_spec_count": _number(
            legacy_summary.get("review_required_spec_count")
        ),
        "legacy_small_pr_batch_count": _number(
            legacy_summary.get("small_pr_batch_count")
        ),
        "missing_artifact_count": missing_artifact_count,
        "next_gap": _optional_text(
            legacy_summary.get("next_gap")
            or owner_summary.get("next_gap")
            or gap_summary.get("next_gap")
            or compliance_summary.get("next_gap")
        ),
    }


def build_ontology_workbench(
    *,
    practical: dict[str, Any],
    artifacts: dict[str, Any],
    source: dict[str, Any],
) -> dict[str, Any]:
    normalized_ir = _artifact_data(
        artifacts, practical_ontology.NORMALIZED_IR_ARTIFACT_KEY
    )
    package_index = _artifact_data(artifacts, practical_ontology.PACKAGE_INDEX_ARTIFACT)
    import_gap_index = _artifact_data(artifacts, practical_ontology.GAP_INDEX_ARTIFACT)
    compatibility_diff = _artifact_data(
        artifacts, practical_ontology.COMPATIBILITY_DIFF_PREVIEW_ARTIFACT
    )
    gap_workflow = _artifact_data(artifacts, GAP_REVIEW_WORKFLOW_ARTIFACT)
    compliance = _artifact_data(artifacts, SPEC_ONTOLOGY_VALIDATION_ARTIFACT)
    write_gate = _artifact_data(artifacts, SPECAUTHOR_WRITE_GATE_ARTIFACT)
    owner_decisions = _artifact_data(
        artifacts, OWNER_DECISION_IMPORT_V2_ARTIFACT
    ) or _artifact_data(artifacts, OWNER_DECISION_IMPORT_PREVIEW_ARTIFACT)
    legacy_backfill = _artifact_data(artifacts, LEGACY_BACKFILL_PLAN_ARTIFACT)
    artifact_sources = {
        "practical_ontology": {
            "available": True,
            "artifact_kind": practical.get("artifact_kind"),
            "schema_version": practical.get("schema_version"),
            "status": _record(practical.get("summary")).get("status"),
        },
        "normalized_ir": _normalized_ir_status(artifacts, practical),
        "package_index": _run_artifact_status(
            artifacts, practical_ontology.PACKAGE_INDEX_ARTIFACT
        ),
        "binding_preview": _run_artifact_status(
            artifacts, practical_ontology.BINDING_PREVIEW_ARTIFACT
        ),
        "import_gap_index": _run_artifact_status(
            artifacts, practical_ontology.GAP_INDEX_ARTIFACT
        ),
        "compatibility_diff": _run_artifact_status(
            artifacts, practical_ontology.COMPATIBILITY_DIFF_PREVIEW_ARTIFACT
        ),
        "governance_evidence": _run_artifact_status(
            artifacts, practical_ontology.GOVERNANCE_EVIDENCE_INDEX_ARTIFACT
        ),
        "gap_review_workflow": _run_artifact_status(
            artifacts, GAP_REVIEW_WORKFLOW_ARTIFACT
        ),
        "compliance_review": _run_artifact_status(
            artifacts, SPEC_ONTOLOGY_VALIDATION_ARTIFACT
        ),
        "write_gate": _run_artifact_status(artifacts, SPECAUTHOR_WRITE_GATE_ARTIFACT),
        "owner_decision_import_v2": _run_artifact_status(
            artifacts, OWNER_DECISION_IMPORT_V2_ARTIFACT
        ),
        "owner_decision_import_preview": _run_artifact_status(
            artifacts, OWNER_DECISION_IMPORT_PREVIEW_ARTIFACT
        ),
        "legacy_backfill_plan": _run_artifact_status(
            artifacts, LEGACY_BACKFILL_PLAN_ARTIFACT
        ),
    }
    return {
        "api_version": "v1",
        "artifact_kind": ONTOLOGY_WORKBENCH_ARTIFACT_KIND,
        "schema_version": 1,
        "generated_at": _now_iso(),
        "read_only": True,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source": source,
        "summary": _summary(
            practical=practical,
            gap_workflow=gap_workflow,
            compliance=compliance,
            write_gate=write_gate,
            owner_decisions=owner_decisions,
            legacy_backfill=legacy_backfill,
            artifacts=artifacts,
        ),
        "package": _package_summary(practical),
        "normalized_ir": {
            "available": normalized_ir is not None,
            "id": _optional_text(_record(normalized_ir).get("id")),
            "namespace": _optional_text(_record(normalized_ir).get("namespace")),
            "version": _optional_text(_record(normalized_ir).get("version")),
            "classes": _class_rows(normalized_ir),
            "relations": _relation_rows(normalized_ir),
        },
        "terms": _records(practical.get("terms"))[: DISPLAY_LIMITS["classes"]],
        "relations": _records(practical.get("relations"))[
            : DISPLAY_LIMITS["relations"]
        ],
        "domains": _records(practical.get("domains")),
        "layers": _layer_lens(
            package_index=package_index,
            gap_index=import_gap_index,
            compatibility_diff=compatibility_diff,
        ),
        "applicability": _applicability_lens(package_index),
        "diff_classification": _diff_classification_lens(compatibility_diff),
        "gap_review": {
            "summary": _record((gap_workflow or {}).get("summary")),
            "groups": _gap_group_rows(gap_workflow),
        },
        "compliance": {
            "summary": _record((compliance or {}).get("summary")),
            "entries": _compliance_rows(compliance),
        },
        "write_gate": {
            "summary": _record((write_gate or {}).get("summary")),
            "findings": _write_gate_rows(write_gate),
            "would_reject_in_hard_gate": (write_gate or {}).get(
                "would_reject_in_hard_gate"
            )
            is True,
            "write_decision": _optional_text((write_gate or {}).get("write_decision")),
        },
        "owner_decisions": {
            "summary": _record((owner_decisions or {}).get("summary")),
            "reviews": _owner_decision_rows(owner_decisions),
        },
        "legacy_backfill": {
            "summary": _record((legacy_backfill or {}).get("summary")),
            "small_pr_batches": _legacy_batch_rows(legacy_backfill),
        },
        "artifacts": artifact_sources,
        "display_limits": DISPLAY_LIMITS,
        "authority_boundary": {
            "ontology_workbench_is_authority": False,
            "practical_ontology_is_authority": False,
            "may_write_ontology_package": False,
            "may_update_ontology_lockfile": False,
            "may_mutate_canonical_specs": False,
            "may_mark_candidate_accepted": False,
            "may_import_owner_decision": False,
            "may_close_semantic_gate": False,
        },
    }
