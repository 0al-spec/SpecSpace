"""Derived practical ontology read model for SpecSpace."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

PRACTICAL_ONTOLOGY_ARTIFACT_KIND = "specspace_practical_ontology"
SPEC_REF_RE = re.compile(r"\bSG-SPEC-\d{4}\b")

DOMAIN_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("ontology", "Ontology"),
    ("specspace", "SpecSpace"),
    ("specgraph", "SpecGraph"),
    ("specpm", "SpecPM"),
    ("agent passport", "Agent Passport"),
    ("agent", "Agent Layer"),
    ("supervisor", "Supervisor"),
    ("executor", "Executor"),
    ("prompt", "Prompting"),
    ("metric", "Metrics"),
    ("runtime", "Runtime"),
    ("governance", "Governance"),
    ("proposal", "Proposal Workflow"),
    ("evidence", "Evidence"),
    ("hypercode", "Hypercode"),
)
DOMAIN_HEAD_STOPWORDS = {
    "a",
    "an",
    "and",
    "or",
    "the",
    "this",
    "that",
    "these",
    "those",
}

STRUCTURED_CONCEPT_PATHS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("core_attribute", ("specification", "core_attributes")),
    ("node_kind", ("specification", "node_kinds")),
    ("edge_kind", ("specification", "edge_kinds")),
    ("lifecycle_state", ("specification", "lifecycle", "statuses")),
    ("authority_class", ("specification", "authority_classes")),
    ("term", ("specification", "terminology")),
    ("term", ("specification", "vocabulary")),
)


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _text(value: Any, default: str = "") -> str:
    return value if isinstance(value, str) and value.strip() else default


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _string_list(value: Any) -> list[str]:
    if isinstance(value, str) and value:
        return [value]
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "unknown"


def _source_ref_for_node(node: dict[str, Any]) -> str:
    file_name = _text(node.get("_file_name"), f"{_text(node.get('id'), 'unknown')}.yaml")
    return f"specs/nodes/{file_name}"


def _at_path(root: dict[str, Any], path: tuple[str, ...]) -> Any:
    current: Any = root
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _entry_label(key: str, value: Any, *, from_list: bool) -> str:
    if isinstance(value, str):
        return value if from_list else key
    if isinstance(value, dict):
        for field in ("name", "id", "kind", "label", "title"):
            label = _text(value.get(field))
            if label:
                return label
    return "" if from_list else key


def _entry_description(key: str, value: Any, *, from_list: bool) -> str | None:
    if isinstance(value, str) and not from_list:
        return value
    if isinstance(value, dict):
        for field in ("description", "summary", "purpose", "objective"):
            description = _text(value.get(field))
            if description:
                return description
    return None


def _entries_from_structured_value(value: Any) -> list[tuple[str, Any, bool]]:
    if isinstance(value, dict):
        return [(str(key), item, False) for key, item in value.items()]
    if isinstance(value, list):
        return [(str(index), item, True) for index, item in enumerate(value)]
    return []


def infer_domain(label: str) -> str:
    lowered = label.lower()
    for needle, domain in DOMAIN_KEYWORDS:
        if needle in lowered:
            return domain
    if " " in label:
        head = label.split(" ", 1)[0].strip(":-")
        if head.lower() in DOMAIN_HEAD_STOPWORDS:
            return "SpecGraph"
        return head or "SpecGraph"
    return "SpecGraph"


def _term_key(kind: str, label: str) -> str:
    return f"{kind}:{label.lower()}"


def _add_term(
    terms: dict[str, dict[str, Any]],
    *,
    kind: str,
    label: str,
    source_ref: str,
    canonical_ref: str | None = None,
    description: str | None = None,
) -> None:
    clean_label = label.strip()
    if not clean_label:
        return
    key = _term_key(kind, clean_label)
    entry = terms.get(key)
    if entry is None:
        entry = {
            "term_id": f"{kind}.{_slug(clean_label)}",
            "label": clean_label,
            "kind": kind,
            "domain": infer_domain(clean_label),
            "canonical_ref": canonical_ref,
            "description": description,
            "source_refs": [],
            "evidence_count": 0,
        }
        terms[key] = entry
    if canonical_ref and entry.get("canonical_ref") is None:
        entry["canonical_ref"] = canonical_ref
    if description and entry.get("description") is None:
        entry["description"] = description
    if source_ref not in entry["source_refs"]:
        entry["source_refs"].append(source_ref)
    entry["evidence_count"] = len(entry["source_refs"])


def _add_relation(
    relations: dict[str, dict[str, Any]],
    *,
    source_term: str,
    relation: str,
    target_term: str,
    source_ref: str,
) -> None:
    if not source_term or not relation or not target_term:
        return
    relation_id = f"{_slug(source_term)}--{_slug(relation)}--{_slug(target_term)}"
    entry = relations.get(relation_id)
    if entry is None:
        entry = {
            "relation_id": relation_id,
            "source_term": source_term,
            "relation": relation,
            "target_term": target_term,
            "source_refs": [],
            "evidence_count": 0,
        }
        relations[relation_id] = entry
    if source_ref not in entry["source_refs"]:
        entry["source_refs"].append(source_ref)
    entry["evidence_count"] = len(entry["source_refs"])


def _add_topology_edge(
    topology_edges: dict[str, dict[str, Any]],
    *,
    source_id: str,
    source_title: str,
    relation: str,
    target_id: str,
    target_title: str,
    source_ref: str,
) -> None:
    if not source_id or not relation or not target_id:
        return
    edge_id = f"{_slug(source_id)}--{_slug(relation)}--{_slug(target_id)}"
    entry = topology_edges.get(edge_id)
    if entry is None:
        entry = {
            "edge_id": edge_id,
            "source_id": source_id,
            "source_title": source_title or source_id,
            "relation": relation,
            "target_id": target_id,
            "target_title": target_title or target_id,
            "display_label": f"{source_id} {relation} {target_id}",
            "source_refs": [],
            "evidence_count": 0,
            "authority_class": "specgraph_topology",
        }
        topology_edges[edge_id] = entry
    if source_ref not in entry["source_refs"]:
        entry["source_refs"].append(source_ref)
    entry["evidence_count"] = len(entry["source_refs"])


def _add_proposal_reference(
    proposal_references: dict[str, dict[str, Any]],
    *,
    proposal_id: str,
    proposal_title: str,
    target_spec_id: str,
    source_ref: str,
) -> None:
    if not proposal_id or not target_spec_id:
        return
    reference_id = f"{_slug(proposal_id)}--mentions-spec--{_slug(target_spec_id)}"
    entry = proposal_references.get(reference_id)
    if entry is None:
        entry = {
            "reference_id": reference_id,
            "proposal_id": proposal_id,
            "proposal_title": proposal_title or proposal_id,
            "relation": "mentions_spec",
            "target_spec_id": target_spec_id,
            "display_label": f"{proposal_id} mentions {target_spec_id}",
            "source_refs": [],
            "evidence_count": 0,
            "authority_class": "proposal_reference",
        }
        proposal_references[reference_id] = entry
    if source_ref not in entry["source_refs"]:
        entry["source_refs"].append(source_ref)
    entry["evidence_count"] = len(entry["source_refs"])


def _collect_spec_terms(
    nodes: list[dict[str, Any]],
    terms: dict[str, dict[str, Any]],
    relations: dict[str, dict[str, Any]],
    topology_edges: dict[str, dict[str, Any]],
) -> None:
    node_titles = {
        _text(node.get("id")): _text(node.get("title"), _text(node.get("id")))
        for node in nodes
        if _text(node.get("id"))
    }

    for node in nodes:
        node_id = _text(node.get("id"))
        title = _text(node.get("title"), node_id)
        if not node_id:
            continue
        source_ref = _source_ref_for_node(node)
        objective = _text(_at_path(node, ("specification", "objective")))
        _add_term(
            terms,
            kind="spec_node",
            label=title,
            canonical_ref=node_id,
            source_ref=source_ref,
            description=objective or _text(node.get("prompt")) or None,
        )

        for edge_kind in ("depends_on", "relates_to", "refines"):
            for target_id in _string_list(node.get(edge_kind)):
                _add_topology_edge(
                    topology_edges,
                    source_id=node_id,
                    source_title=title,
                    relation=edge_kind,
                    target_id=target_id,
                    target_title=node_titles.get(target_id, target_id),
                    source_ref=source_ref,
                )

        for concept_kind, path in STRUCTURED_CONCEPT_PATHS:
            value = _at_path(node, path)
            for key, item, from_list in _entries_from_structured_value(value):
                label = _entry_label(key, item, from_list=from_list)
                if not label:
                    continue
                path_ref = ".".join(path)
                _add_term(
                    terms,
                    kind=concept_kind,
                    label=label,
                    source_ref=f"{source_ref}#{path_ref}",
                    description=_entry_description(key, item, from_list=from_list),
                )


def _collect_proposal_terms(
    proposal_markdown: dict[str, Any],
    terms: dict[str, dict[str, Any]],
    relations: dict[str, dict[str, Any]],
    proposal_references: dict[str, dict[str, Any]],
) -> None:
    for item in _list(proposal_markdown.get("entries")):
        if not isinstance(item, dict):
            continue
        proposal_id = _text(item.get("proposal_id"))
        title = _text(item.get("title"), proposal_id)
        source_ref = _text(item.get("relative_path")) or _text(item.get("path"))
        if not proposal_id or not title or not source_ref:
            continue
        _add_term(
            terms,
            kind="proposal",
            label=title,
            canonical_ref=proposal_id,
            source_ref=source_ref,
            description=_text(item.get("content_excerpt")) or None,
        )
        body = _text(item.get("content_body")) or _text(item.get("content_preview"))
        for spec_ref in sorted(set(SPEC_REF_RE.findall(body))):
            _add_proposal_reference(
                proposal_references,
                proposal_id=proposal_id,
                proposal_title=title,
                target_spec_id=spec_ref,
                source_ref=source_ref,
            )


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
    terms_by_key: dict[str, dict[str, Any]] = {}
    relations_by_id: dict[str, dict[str, Any]] = {}
    topology_edges_by_id: dict[str, dict[str, Any]] = {}
    proposal_references_by_id: dict[str, dict[str, Any]] = {}

    _collect_spec_terms(nodes, terms_by_key, relations_by_id, topology_edges_by_id)
    _collect_proposal_terms(proposal_markdown, terms_by_key, relations_by_id, proposal_references_by_id)

    terms = sorted(
        terms_by_key.values(),
        key=lambda item: (
            _text(item.get("kind")),
            _text(item.get("label")).lower(),
        ),
    )
    relations = sorted(
        relations_by_id.values(),
        key=lambda item: (
            _text(item.get("relation")),
            _text(item.get("source_term")).lower(),
            _text(item.get("target_term")).lower(),
        ),
    )
    topology_edges = sorted(
        topology_edges_by_id.values(),
        key=lambda item: (
            _text(item.get("relation")),
            _text(item.get("source_id")),
            _text(item.get("target_id")),
        ),
    )
    proposal_references = sorted(
        proposal_references_by_id.values(),
        key=lambda item: (
            _text(item.get("proposal_id")),
            _text(item.get("target_spec_id")),
        ),
    )
    domains = _domains_from_terms(terms)

    return {
        "api_version": "v1",
        "artifact_kind": PRACTICAL_ONTOLOGY_ARTIFACT_KIND,
        "schema_version": 1,
        "generated_at": _now_iso(),
        "read_only": True,
        "canonical_mutations_allowed": False,
        "tracked_artifacts_written": False,
        "source": source,
        "sources": {
            "spec_nodes": {
                "available": bool(nodes),
                "entry_count": len(nodes),
                "load_error_count": len(load_errors),
                "errors": load_errors,
            },
            "proposal_markdown": {
                "available": bool(proposal_markdown.get("available")),
                "path": proposal_markdown.get("path"),
                "entry_count": proposal_markdown.get("entry_count", 0),
                "reason": proposal_markdown.get("reason"),
                "errors": proposal_markdown.get("errors", []),
            },
        },
        "summary": {
            "term_count": len(terms),
            "relation_count": len(relations),
            "semantic_relation_count": len(relations),
            "topology_edge_count": len(topology_edges),
            "proposal_reference_count": len(proposal_references),
            "domain_count": len(domains),
            "source_count": len(nodes) + int(proposal_markdown.get("entry_count", 0) or 0),
        },
        "domains": domains,
        "terms": terms,
        "relations": relations,
        "topology_edges": topology_edges,
        "proposal_references": proposal_references,
        "relation_taxonomy": {
            "relations": "semantic ontology relation observations only",
            "topology_edges": "SpecGraph graph topology facts such as depends_on, relates_to, and refines",
            "proposal_references": "Proposal markdown references to SpecGraph spec ids",
            "semantic_relations_are_authority": False,
            "topology_edges_are_ontology_relations": False,
            "proposal_references_are_ontology_relations": False,
        },
        "authority_boundary": {
            "practical_ontology_is_authority": False,
            "derived_from_specgraph_sources": True,
            "may_write_ontology_package": False,
            "may_mutate_canonical_specs": False,
            "may_mark_candidate_accepted": False,
        },
    }
