"""Curated practical ontology read model for SpecSpace."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

PRACTICAL_ONTOLOGY_ARTIFACT_KIND = "specspace_practical_ontology"
CURATED_SOURCE_REF = "specs/nodes/SG-SPEC-0001.yaml#specification.seed"

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
) -> dict[str, Any]:
    source_count = len(nodes) + int(proposal_markdown.get("entry_count", 0) or 0)
    terms = [
        {
            **term,
            "source_refs": [CURATED_SOURCE_REF],
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
            "source_refs": [CURATED_SOURCE_REF],
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
                "source_ref": CURATED_SOURCE_REF,
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
        },
        "domains": domains,
        "terms": terms,
        "relations": relations,
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
            "may_write_ontology_package": False,
            "may_mutate_canonical_specs": False,
            "may_mark_candidate_accepted": False,
        },
    }
