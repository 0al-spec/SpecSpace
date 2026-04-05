"""SpecGraph YAML node ingestion and in-memory graph construction.

Reads *.yaml files from a spec directory, parses them with PyYAML, and builds a
graph of specification nodes connected by depends_on, refines, and relates_to edges.

The output shape mirrors the conversation graph API so the viewer can switch between
the two modes without changing its core data-handling logic.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EDGE_KINDS = ("depends_on", "refines", "relates_to")

# Lifecycle status ordering (idea is earliest; frozen is latest)
LIFECYCLE_ORDER = ("idea", "stub", "outlined", "specified", "linked", "reviewed", "frozen")


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


def load_spec_nodes(spec_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Read all *.yaml files from *spec_dir* and return (nodes, load_errors).

    Each element of *nodes* is the raw parsed YAML dict, augmented with a
    ``_file_name`` key holding the originating filename.  Unknown fields are
    preserved so the viewer is tolerant of schema evolution.

    Each element of *load_errors* is a dict with ``file_name`` and ``message``
    describing a file that could not be parsed.
    """
    nodes: list[dict[str, Any]] = []
    load_errors: list[dict[str, Any]] = []

    for yaml_path in sorted(spec_dir.glob("*.yaml")):
        try:
            raw = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            load_errors.append(
                {
                    "file_name": yaml_path.name,
                    "message": f"YAML parse error: {exc}",
                }
            )
            continue
        except OSError as exc:
            load_errors.append(
                {
                    "file_name": yaml_path.name,
                    "message": f"File read error: {exc}",
                }
            )
            continue

        if not isinstance(raw, dict):
            load_errors.append(
                {
                    "file_name": yaml_path.name,
                    "message": "YAML root is not a mapping — skipping.",
                }
            )
            continue

        raw["_file_name"] = yaml_path.name
        nodes.append(raw)

    return nodes, load_errors


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------


def _coerce_id_list(value: Any) -> list[str]:
    """Coerce a scalar, list, or None into a list of string IDs."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return []


def build_spec_graph(
    nodes: list[dict[str, Any]],
    load_errors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build an in-memory spec graph from parsed node dicts.

    Returns a dict shaped like the conversation ``/api/graph`` response so the
    React client can reuse the same data-handling logic.
    """
    if load_errors is None:
        load_errors = []

    # Index nodes by id
    nodes_by_id: dict[str, dict[str, Any]] = {}
    blocked: list[dict[str, Any]] = []

    for raw in nodes:
        node_id = raw.get("id")
        file_name = raw.get("_file_name", "unknown.yaml")

        if not isinstance(node_id, str) or not node_id.strip():
            blocked.append(
                {
                    "file_name": file_name,
                    "node_id": None,
                    "message": "Missing or invalid 'id' field.",
                }
            )
            continue

        if node_id in nodes_by_id:
            blocked.append(
                {
                    "file_name": file_name,
                    "node_id": node_id,
                    "message": f"Duplicate node id '{node_id}' — skipped.",
                }
            )
            continue

        nodes_by_id[node_id] = raw

    # Build edges from depends_on / refines / relates_to
    edges: list[dict[str, Any]] = []
    edge_diagnostics: list[dict[str, Any]] = []

    for node_id, raw in nodes_by_id.items():
        file_name = raw.get("_file_name", "unknown.yaml")

        for edge_kind in EDGE_KINDS:
            targets = _coerce_id_list(raw.get(edge_kind))
            for target_id in targets:
                edge_id = f"{node_id}__{edge_kind}__{target_id}"
                status = "resolved" if target_id in nodes_by_id else "broken"

                if status == "broken":
                    edge_diagnostics.append(
                        {
                            "edge_id": edge_id,
                            "source_id": node_id,
                            "target_id": target_id,
                            "edge_kind": edge_kind,
                            "file_name": file_name,
                            "message": f"Target node '{target_id}' not found in spec directory.",
                        }
                    )

                edges.append(
                    {
                        "edge_id": edge_id,
                        "edge_kind": edge_kind,
                        "source_id": node_id,
                        "target_id": target_id,
                        "status": status,
                    }
                )

    # Identify roots: nodes that are not the target of any *refines* edge
    # (i.e. no other node refines them AND they don't refine anyone else —
    # actually: roots = nodes with no incoming *refines* targeting them from
    # another node).  We want top-level specs that are not children of anything.
    refined_by_others: set[str] = set()
    for edge in edges:
        if edge["edge_kind"] == "refines":
            refined_by_others.add(edge["target_id"])

    roots: list[str] = [nid for nid in nodes_by_id if nid not in refined_by_others]

    # Serialize nodes into the viewer-facing shape
    serialized_nodes = []
    for node_id, raw in nodes_by_id.items():
        # Collect per-node diagnostics (broken outbound edges)
        node_edge_diags = [d for d in edge_diagnostics if d["source_id"] == node_id]

        # Extract acceptance criteria count for display
        acceptance = raw.get("acceptance") or []
        acceptance_count = len(acceptance) if isinstance(acceptance, list) else 0

        # Extract decisions count
        spec_section = raw.get("specification") or {}
        decisions = spec_section.get("decisions") or [] if isinstance(spec_section, dict) else []
        decisions_count = len(decisions) if isinstance(decisions, list) else 0

        serialized_nodes.append(
            {
                "node_id": node_id,
                "file_name": raw.get("_file_name", "unknown.yaml"),
                "title": raw.get("title", node_id),
                "kind": raw.get("kind", "spec"),
                "status": raw.get("status", "stub"),
                "maturity": raw.get("maturity") if isinstance(raw.get("maturity"), (int, float)) else None,
                "acceptance_count": acceptance_count,
                "decisions_count": decisions_count,
                "depends_on": _coerce_id_list(raw.get("depends_on")),
                "refines": _coerce_id_list(raw.get("refines")),
                "relates_to": _coerce_id_list(raw.get("relates_to")),
                "diagnostics": node_edge_diags,
            }
        )

    all_diagnostics = (
        [{"scope": "file", **e} for e in load_errors]
        + [{"scope": "file", **b} for b in blocked]
        + [{"scope": "edge", **d} for d in edge_diagnostics]
    )

    return {
        "nodes": serialized_nodes,
        "edges": edges,
        "roots": roots,
        "blocked_files": blocked,
        "diagnostics": all_diagnostics,
        "summary": {
            "node_count": len(serialized_nodes),
            "edge_count": len(edges),
            "root_count": len(roots),
            "blocked_file_count": len(blocked),
            "diagnostic_count": len(all_diagnostics),
            "broken_edge_count": sum(1 for e in edges if e["status"] == "broken"),
        },
    }


# ---------------------------------------------------------------------------
# Raw node detail
# ---------------------------------------------------------------------------


def get_spec_node_detail(
    nodes: list[dict[str, Any]],
    node_id: str,
) -> dict[str, Any] | None:
    """Return the full raw YAML payload for *node_id*, or None if not found.

    The ``_file_name`` internal key is stripped from the returned dict.
    """
    for raw in nodes:
        if raw.get("id") == node_id:
            return {k: v for k, v in raw.items() if not k.startswith("_")}
    return None


# ---------------------------------------------------------------------------
# Top-level API collector
# ---------------------------------------------------------------------------


def collect_spec_graph_api(spec_dir: Path) -> dict[str, Any]:
    """Read spec_dir, build graph, and return the full /api/spec-graph payload."""
    nodes, load_errors = load_spec_nodes(spec_dir)
    graph = build_spec_graph(nodes, load_errors)
    return {
        "spec_dir": str(spec_dir),
        "graph": graph,
        "summary": graph["summary"],
    }
