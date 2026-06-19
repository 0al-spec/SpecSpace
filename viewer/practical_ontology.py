"""Curated practical ontology read model for SpecSpace."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

PRACTICAL_ONTOLOGY_ARTIFACT_KIND = "specspace_practical_ontology"
CURATED_SOURCE_REF = "specs/nodes/SG-SPEC-0001.yaml#specification.seed"
CONCEPTUAL_CURATED_SOURCE_REF = "curated://specspace/specgraph-core-v0"
PACKAGE_INDEX_ARTIFACT = "ontology_package_index.json"
BINDING_PREVIEW_ARTIFACT = "ontology_binding_preview.json"
GAP_INDEX_ARTIFACT = "ontology_import_gap_index.json"
COMPATIBILITY_DIFF_PREVIEW_ARTIFACT = "ontology_compatibility_diff_preview.json"
GOVERNANCE_EVIDENCE_INDEX_ARTIFACT = "ontology_governance_evidence_index.json"
NORMALIZED_IR_ARTIFACT_KEY = "ontology_normalized_ir"

CURATED_CORE_TERMS: tuple[dict[str, str | None], ...] = (
    {
        "term_id": "ontology.specgraph",
        "label": "SpecGraph",
        "kind": "ontology",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001",
        "description": "Executable product ontology that represents intent, specifications, graph structure, and derived code surfaces.",
    },
    {
        "term_id": "entity.intent",
        "label": "Intent",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.terminology.intent",
        "description": "Governed representation of what the product must be and how it can be validated.",
    },
    {
        "term_id": "entity.spec",
        "label": "Spec",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.node_kinds.spec",
        "description": "Versioned specification artifact that refines intent into machine-readable requirements and decisions.",
    },
    {
        "term_id": "entity.node",
        "label": "Node",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.terminology.node",
        "description": "First-class graph entity with stable identity, lifecycle, provenance, and versioned state.",
    },
    {
        "term_id": "entity.edge",
        "label": "Edge",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.terminology.edge",
        "description": "Directed typed relation between two nodes.",
    },
    {
        "term_id": "entity.requirement",
        "label": "Requirement",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.node_kinds.requirement",
        "description": "Verifiable product or system obligation that can be checked by acceptance criteria or tests.",
    },
    {
        "term_id": "entity.acceptance-criterion",
        "label": "AcceptanceCriterion",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#acceptance",
        "description": "Concrete condition used to validate whether a requirement or specification is satisfied.",
    },
    {
        "term_id": "entity.decision",
        "label": "Decision",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.node_kinds.decision",
        "description": "Chosen design or product direction that constrains later specification and implementation work.",
    },
    {
        "term_id": "entity.constraint",
        "label": "Constraint",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.node_kinds.constraint",
        "description": "Rule or boundary that limits valid graph, specification, or implementation behavior.",
    },
    {
        "term_id": "entity.invariant",
        "label": "Invariant",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.node_kinds.invariant",
        "description": "Condition that must remain true across valid graph evolution.",
    },
    {
        "term_id": "entity.evidence",
        "label": "Evidence",
        "kind": "evidence",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#acceptance_evidence",
        "description": "Traceable support for acceptance, validation, and review decisions.",
    },
    {
        "term_id": "entity.code-surface",
        "label": "CodeSurface",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.node_kinds.code_surface",
        "description": "Derived executable or source-facing surface that implements specifications.",
    },
    {
        "term_id": "entity.test",
        "label": "Test",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.node_kinds.test",
        "description": "Validation artifact that checks requirements, specifications, or implementation behavior.",
    },
    {
        "term_id": "entity.release",
        "label": "Release",
        "kind": "entity",
        "domain": "SpecGraph Core",
        "canonical_ref": "SG-SPEC-0001#specification.node_kinds.release",
        "description": "Packaged delivery state that contains derived code surfaces and their validation evidence.",
    },
)

CURATED_CORE_RELATIONS: tuple[tuple[str, str, str], ...] = (
    ("SpecGraph", "contains", "Node"),
    ("SpecGraph", "contains", "Edge"),
    ("SpecGraph", "contains", "Spec"),
    ("Spec", "refines", "Intent"),
    ("Spec", "defines", "Requirement"),
    ("Spec", "has", "AcceptanceCriterion"),
    ("Requirement", "is_validated_by", "AcceptanceCriterion"),
    ("Node", "connected_by", "Edge"),
    ("Edge", "relates", "Node"),
    ("Decision", "constrains", "Spec"),
    ("Constraint", "applies_to", "Node"),
    ("Invariant", "governs", "SpecGraph"),
    ("CodeSurface", "implements", "Spec"),
    ("Test", "validates", "Requirement"),
    ("Release", "packages", "CodeSurface"),
    ("Evidence", "supports", "AcceptanceCriterion"),
)


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _text(value: Any, default: str = "") -> str:
    return value if isinstance(value, str) and value.strip() else default


def _string_list(value: Any) -> list[str]:
    if isinstance(value, str) and value:
        return [value]
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "unknown"


def _artifact_data(artifacts: dict[str, Any] | None, key: str) -> dict[str, Any] | None:
    if not artifacts:
        return None
    value = artifacts.get(key)
    if isinstance(value, dict):
        data = value.get("data")
        if isinstance(data, dict):
            return data
        return value
    return None


def _label_from_fqid(value: Any) -> str:
    text = _text(value)
    return text.split(":", 1)[-1] if ":" in text else text


def _package_domain_label(package: dict[str, Any] | None, ir: dict[str, Any]) -> str:
    package_id = _text((package or {}).get("package_id"), _text(ir.get("id"), "SpecGraph Core"))
    if package_id == "org.0al.specgraph.core":
        return "SpecGraph Core"
    namespace = _text((package or {}).get("namespace"), _text(ir.get("namespace"), package_id))
    return namespace.replace("_", " ").replace("-", " ").title()


def _term_kind_from_class(item: dict[str, Any]) -> str:
    if item.get("id") == "SpecGraph":
        return "ontology"
    if item.get("id") == "Evidence":
        return "evidence"
    return "entity"


def _terms_from_ir(ir: dict[str, Any], package: dict[str, Any] | None) -> list[dict[str, Any]]:
    classes = ir.get("classes")
    if not isinstance(classes, list):
        return []
    domain = _package_domain_label(package, ir)
    terms: list[dict[str, Any]] = []
    for item in classes:
        if not isinstance(item, dict):
            continue
        label = _text(item.get("id"))
        if not label:
            continue
        uri = _text(item.get("uri"))
        source_refs = [uri] if uri else []
        description = _text(item.get("description"))
        terms.append(
            {
                "term_id": f"ontology.{_slug(_text(item.get('fqid'), label))}",
                "label": label,
                "kind": _term_kind_from_class(item),
                "domain": domain,
                "canonical_ref": _text(item.get("fqid"), label),
                "description": description if description else None,
                "source_refs": source_refs,
                "evidence_count": len(source_refs),
            }
        )
    return sorted(terms, key=lambda item: item["label"])


def _relations_from_ir(ir: dict[str, Any]) -> list[dict[str, Any]]:
    raw_relations = ir.get("relations")
    if not isinstance(raw_relations, list):
        return []
    relations: list[dict[str, Any]] = []
    for item in raw_relations:
        if not isinstance(item, dict):
            continue
        relation_id = _text(item.get("id"))
        source_term = _label_from_fqid(item.get("domain"))
        target_term = _label_from_fqid(item.get("range"))
        if not relation_id or not source_term or not target_term:
            continue
        uri = _text(item.get("uri"))
        source_refs = [uri] if uri else []
        relations.append(
            {
                "relation_id": f"{_slug(source_term)}--{_slug(relation_id)}--{_slug(target_term)}",
                "source_term": source_term,
                "relation": relation_id,
                "target_term": target_term,
                "source_refs": source_refs,
                "evidence_count": len(source_refs),
            }
        )
    return sorted(
        relations,
        key=lambda item: (item["source_term"], item["relation"], item["target_term"]),
    )


def _source_refs_from_artifacts(*artifacts: dict[str, Any] | None) -> list[str]:
    refs: list[str] = []
    for artifact in artifacts:
        if not artifact:
            continue
        source_fixture = artifact.get("source_fixture")
        if isinstance(source_fixture, str) and source_fixture and source_fixture not in refs:
            refs.append(source_fixture)
        source_report = artifact.get("source_report")
        if isinstance(source_report, str) and source_report and source_report not in refs:
            refs.append(source_report)
    return refs


def _package_view(package: dict[str, Any] | None, package_ref: str) -> dict[str, Any] | None:
    if not package:
        return None
    lock = package.get("lock")
    lock_record = lock if isinstance(lock, dict) else {}
    return {
        "package_id": _text(package.get("package_id")),
        "namespace": _text(package.get("namespace"), _text(lock_record.get("namespace"))),
        "version": _text(package.get("version")),
        "package_ref": package_ref,
        "authority_class": _text(package.get("authority_class"), "unknown"),
        "source_ref": _text(package.get("source_ref")),
        "source_uri": _text(package.get("source_uri"), _text(lock_record.get("source_uri"))),
        "digest": _text(package.get("digest"), _text(lock_record.get("digest"))),
        "materialized_ir": _text(package.get("materialized_ir")),
        "accepted_by_proposal": _text(package.get("accepted_by_proposal")),
    }


def _gap_rows(gap_index: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not gap_index:
        return []
    gaps = gap_index.get("gaps")
    if not isinstance(gaps, list):
        return []
    source_refs = _source_refs_from_artifacts(gap_index)
    rows: list[dict[str, Any]] = []
    for item in gaps:
        if not isinstance(item, dict):
            continue
        missing_concept = item.get("missing_concept")
        missing = missing_concept if isinstance(missing_concept, dict) else {}
        subject = item.get("subject")
        subject_record = subject if isinstance(subject, dict) else {}
        rows.append(
            {
                "gap_id": _text(item.get("gap_id"), "ontology-gap"),
                "severity": _text(item.get("severity"), "unknown"),
                "target_package": _text(item.get("target_package")),
                "recommended_route": _text(item.get("recommended_route")),
                "missing_ref": _text(missing.get("ref")),
                "missing_concept": _text(
                    missing.get("concept_hint"),
                    _text(missing.get("ref"), _text(item.get("gap_id"), "unknown")),
                ),
                "namespace_hint": _text(missing.get("namespace_hint")),
                "subject": " ".join(
                    part
                    for part in (
                        _text(subject_record.get("kind")),
                        _text(subject_record.get("id")),
                    )
                    if part
                ),
                "needed_by": _string_list(item.get("needed_by")),
                "source_refs": source_refs,
            }
        )
    return rows


def _compatibility_diff_view(diff_preview: dict[str, Any] | None) -> dict[str, Any] | None:
    if not diff_preview:
        return None
    changes = diff_preview.get("changes")
    change_record = changes if isinstance(changes, dict) else {}
    return {
        "compatible": diff_preview.get("compatible") is True,
        "from_ref": _text(diff_preview.get("from_ref")),
        "to_ref": _text(diff_preview.get("to_ref")),
        "package_ref": _text(diff_preview.get("package_ref")),
        "status": _text((diff_preview.get("summary") or {}).get("status"))
        if isinstance(diff_preview.get("summary"), dict)
        else "",
        "next_gap": _text((diff_preview.get("summary") or {}).get("next_gap"))
        if isinstance(diff_preview.get("summary"), dict)
        else "",
        "added_classes": _string_list(change_record.get("added_classes")),
        "added_relations": _string_list(change_record.get("added_relations")),
        "removed_classes": _string_list(change_record.get("removed_classes")),
        "removed_relations": _string_list(change_record.get("removed_relations")),
        "breaking_changes": _string_list(change_record.get("breaking_changes")),
        "required_specgraph_actions": _string_list(
            diff_preview.get("required_specgraph_actions")
        ),
        "source_refs": _source_refs_from_artifacts(diff_preview),
    }


def _governance_evidence_rows(evidence_index: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not evidence_index:
        return []
    evidence = evidence_index.get("evidence")
    if not isinstance(evidence, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in evidence:
        if not isinstance(item, dict):
            continue
        rows.append(
            {
                "package_ref": _text(item.get("package_ref")),
                "lifecycle_state": _text(item.get("lifecycle_state"), "unknown"),
                "decision_ref": _text(item.get("decision_ref")),
                "validation_report_ref": _text(item.get("validation_report_ref")),
                "repeatability_report_ref": _text(item.get("repeatability_report_ref")),
                "trusted_registry_gate_ref": _text(item.get("trusted_registry_gate_ref")),
            }
        )
    return rows


def _raw_artifact_refs(
    *,
    package: dict[str, Any] | None,
    gap_index: dict[str, Any] | None,
    diff_preview: dict[str, Any] | None,
    governance_evidence: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    refs = [
        {"artifact": "ontology_package_index", "path": f"runs/{PACKAGE_INDEX_ARTIFACT}"},
        {"artifact": "ontology_binding_preview", "path": f"runs/{BINDING_PREVIEW_ARTIFACT}"},
    ]
    if gap_index:
        refs.append({"artifact": "ontology_import_gap_index", "path": f"runs/{GAP_INDEX_ARTIFACT}"})
    if diff_preview:
        refs.append(
            {
                "artifact": "ontology_compatibility_diff_preview",
                "path": f"runs/{COMPATIBILITY_DIFF_PREVIEW_ARTIFACT}",
            }
        )
    if governance_evidence:
        refs.append(
            {
                "artifact": "ontology_governance_evidence_index",
                "path": f"runs/{GOVERNANCE_EVIDENCE_INDEX_ARTIFACT}",
            }
        )
    materialized_ir = _text((package or {}).get("materialized_ir"))
    if materialized_ir:
        refs.append({"artifact": "ontology_normalized_ir", "path": materialized_ir})
    return refs


def _artifact_backed_ontology(
    *,
    artifacts: dict[str, Any] | None,
    source: dict[str, Any],
) -> dict[str, Any] | None:
    package_index = _artifact_data(artifacts, PACKAGE_INDEX_ARTIFACT)
    binding_preview = _artifact_data(artifacts, BINDING_PREVIEW_ARTIFACT)
    gap_index = _artifact_data(artifacts, GAP_INDEX_ARTIFACT)
    diff_preview = _artifact_data(artifacts, COMPATIBILITY_DIFF_PREVIEW_ARTIFACT)
    governance_evidence = _artifact_data(artifacts, GOVERNANCE_EVIDENCE_INDEX_ARTIFACT)
    normalized_ir = _artifact_data(artifacts, NORMALIZED_IR_ARTIFACT_KEY)
    if not package_index or not binding_preview or not normalized_ir:
        return None

    packages = package_index.get("packages")
    package = (
        packages[0]
        if isinstance(packages, list) and packages and isinstance(packages[0], dict)
        else None
    )
    terms = _terms_from_ir(normalized_ir, package)
    relations = _relations_from_ir(normalized_ir)
    if not terms:
        return None

    topology_edges: list[dict[str, Any]] = []
    proposal_references: list[dict[str, Any]] = []
    domains = _domains_from_terms(terms)
    gaps = gap_index.get("gaps") if isinstance(gap_index, dict) else []
    if not isinstance(gaps, list):
        gaps = []
    changes = diff_preview.get("changes") if isinstance(diff_preview, dict) else {}
    added_classes = changes.get("added_classes") if isinstance(changes, dict) else []
    if not isinstance(added_classes, list):
        added_classes = []
    breaking_changes = changes.get("breaking_changes") if isinstance(changes, dict) else []
    if not isinstance(breaking_changes, list):
        breaking_changes = []

    source_refs = _source_refs_from_artifacts(package_index, binding_preview, gap_index, diff_preview)
    source_count = len([artifact for artifact in (package_index, binding_preview, gap_index, diff_preview) if artifact])
    lock = (package or {}).get("lock")
    lock_package_ref = lock.get("package_ref") if isinstance(lock, dict) else None
    package_ref = _text(lock_package_ref, _text(binding_preview.get("package_ref")))
    gap_rows = _gap_rows(gap_index)
    compatibility_diff = _compatibility_diff_view(diff_preview)
    governance_rows = _governance_evidence_rows(governance_evidence)

    return {
        "api_version": "v1",
        "artifact_kind": PRACTICAL_ONTOLOGY_ARTIFACT_KIND,
        "schema_version": 1,
        "generated_at": _now_iso(),
        "read_only": True,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source": {
            **source,
            "ontology_mode": "compiler_artifact_projection",
            "package_ref": package_ref,
            "normalized_ir_available": True,
        },
        "sources": {
            "compiler_ir": {
                "available": True,
                "package_ref": package_ref,
                "source_refs": source_refs,
                "class_count": len(terms),
                "relation_count": len(relations),
            },
            "ontology_package_index": {
                "available": True,
                "summary": package_index.get("summary"),
            },
            "ontology_import_gap_index": {
                "available": bool(gap_index),
                "gap_count": len(gaps),
                "summary": gap_index.get("summary") if isinstance(gap_index, dict) else None,
            },
            "ontology_compatibility_diff_preview": {
                "available": bool(diff_preview),
                "compatible": diff_preview.get("compatible") if isinstance(diff_preview, dict) else None,
                "from_ref": diff_preview.get("from_ref") if isinstance(diff_preview, dict) else None,
                "to_ref": diff_preview.get("to_ref") if isinstance(diff_preview, dict) else None,
                "added_class_count": len(added_classes),
                "breaking_change_count": len(breaking_changes),
            },
            "ontology_governance_evidence_index": {
                "available": bool(governance_evidence),
                "evidence_count": len(governance_rows),
                "summary": governance_evidence.get("summary")
                if isinstance(governance_evidence, dict)
                else None,
            },
            "curated_seed": {
                "available": False,
                "reason": "compiler_artifacts_available",
            },
            "legacy_extraction": {
                "available": False,
                "reason": "removed_from_primary_ontology_surface",
            },
        },
        "summary": {
            "term_count": len(terms),
            "relation_count": len(relations),
            "semantic_relation_count": len(relations),
            "topology_edge_count": len(topology_edges),
            "proposal_reference_count": len(proposal_references),
            "domain_count": len(domains),
            "source_count": source_count,
            "gap_count": len(gaps),
            "diff_added_class_count": len(added_classes),
            "diff_breaking_change_count": len(breaking_changes),
        },
        "domains": domains,
        "terms": terms,
        "relations": relations,
        "package": _package_view(package, package_ref),
        "gaps": gap_rows,
        "compatibility_diff": compatibility_diff,
        "governance_evidence": governance_rows,
        "raw_artifacts": _raw_artifact_refs(
            package=package,
            gap_index=gap_index,
            diff_preview=diff_preview,
            governance_evidence=governance_evidence,
        ),
        "topology_edges": topology_edges,
        "proposal_references": proposal_references,
        "relation_taxonomy": {
            "relations": "compiler-projected ontology relations from Ontology normalized IR",
            "topology_edges": "SpecGraph topology extraction is not mixed into ontology",
            "proposal_references": "proposal markdown extraction is not mixed into ontology",
            "semantic_relations_are_authority": False,
            "topology_edges_are_ontology_relations": False,
            "proposal_references_are_ontology_relations": False,
        },
        "authority_boundary": {
            "practical_ontology_is_authority": False,
            "derived_from_specgraph_sources": True,
            "curated_from_specgraph_seed": False,
            "compiler_artifact_backed": True,
            "may_write_ontology_package": False,
            "may_mutate_canonical_specs": False,
            "may_mark_candidate_accepted": False,
        },
    }


def _domains_from_terms(terms: list[dict[str, Any]]) -> list[dict[str, Any]]:
    domains: dict[str, dict[str, Any]] = {}
    for term in terms:
        label = _text(term.get("domain"), "SpecGraph")
        key = label.lower()
        entry = domains.setdefault(
            key,
            {
                "domain_id": f"domain.{_slug(label)}",
                "label": label,
                "term_count": 0,
                "term_kinds": [],
                "source_refs": [],
            },
        )
        entry["term_count"] += 1
        kind = _text(term.get("kind"), "unknown")
        if kind not in entry["term_kinds"]:
            entry["term_kinds"].append(kind)
        for source_ref in _string_list(term.get("source_refs")):
            if source_ref not in entry["source_refs"]:
                entry["source_refs"].append(source_ref)
    return sorted(domains.values(), key=lambda item: (-item["term_count"], item["label"]))


def build_practical_ontology(
    *,
    nodes: list[dict[str, Any]],
    load_errors: list[dict[str, Any]],
    proposal_markdown: dict[str, Any],
    source: dict[str, Any],
    ontology_artifacts: dict[str, Any] | None = None,
) -> dict[str, Any]:
    artifact_backed = _artifact_backed_ontology(artifacts=ontology_artifacts, source=source)
    if artifact_backed is not None:
        return artifact_backed

    legacy_source_count = source.get("legacy_source_count")
    source_count = legacy_source_count if isinstance(legacy_source_count, int) else 0
    curated_source_ref = _text(source.get("curated_seed_source_ref"), CONCEPTUAL_CURATED_SOURCE_REF)
    terms = [
        {
            **term,
            "source_refs": [curated_source_ref],
            "evidence_count": 1,
        }
        for term in CURATED_CORE_TERMS
    ]
    relations = [
        {
            "relation_id": f"{_slug(source_term)}--{_slug(relation)}--{_slug(target_term)}",
            "source_term": source_term,
            "relation": relation,
            "target_term": target_term,
            "source_refs": [curated_source_ref],
            "evidence_count": 1,
        }
        for source_term, relation, target_term in CURATED_CORE_RELATIONS
    ]
    topology_edges: list[dict[str, Any]] = []
    proposal_references: list[dict[str, Any]] = []
    domains = _domains_from_terms(terms)

    return {
        "api_version": "v1",
        "artifact_kind": PRACTICAL_ONTOLOGY_ARTIFACT_KIND,
        "schema_version": 1,
        "generated_at": _now_iso(),
        "read_only": True,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source": {
            **source,
            "ontology_mode": "curated_core_seed",
            "curated_seed_id": "specgraph.core.v0",
            "curated_source_ref": CURATED_SOURCE_REF,
        },
        "sources": {
            "curated_seed": {
                "available": True,
                "id": "specgraph.core.v0",
                "title": "SpecGraph Core Ontology",
                "source_ref": curated_source_ref,
                "entry_count": len(terms),
                "relation_count": len(relations),
            },
            "legacy_extraction": {
                "available": False,
                "source_count": source_count,
                "load_error_count": len(load_errors),
                "reason": "removed_from_primary_ontology_surface",
            },
        },
        "summary": {
            "term_count": len(terms),
            "relation_count": len(relations),
            "semantic_relation_count": len(relations),
            "topology_edge_count": len(topology_edges),
            "proposal_reference_count": len(proposal_references),
            "domain_count": len(domains),
            "source_count": 1,
            "gap_count": 0,
            "diff_added_class_count": 0,
            "diff_breaking_change_count": 0,
        },
        "domains": domains,
        "terms": terms,
        "relations": relations,
        "package": None,
        "gaps": [],
        "compatibility_diff": None,
        "governance_evidence": [],
        "raw_artifacts": [
            {
                "artifact": "curated_seed",
                "path": curated_source_ref,
            }
        ],
        "topology_edges": topology_edges,
        "proposal_references": proposal_references,
        "relation_taxonomy": {
            "relations": "curated semantic ontology relations for the SpecGraph core seed",
            "topology_edges": "legacy SpecGraph topology extraction is removed from the primary ontology surface",
            "proposal_references": "legacy proposal reference extraction is removed from the primary ontology surface",
            "semantic_relations_are_authority": False,
            "topology_edges_are_ontology_relations": False,
            "proposal_references_are_ontology_relations": False,
        },
        "authority_boundary": {
            "practical_ontology_is_authority": False,
            "derived_from_specgraph_sources": False,
            "curated_from_specgraph_seed": True,
            "compiler_artifact_backed": False,
            "may_write_ontology_package": False,
            "may_mutate_canonical_specs": False,
            "may_mark_candidate_accepted": False,
        },
    }
