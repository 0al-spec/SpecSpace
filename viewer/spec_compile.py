"""Spec tree → Markdown compiler.

Isolated module with zero HTTP dependencies and zero ContextBuilder I/O.

Entry point:
    compile_spec_tree(nodes_by_id, root_id, options) -> CompileResult

The caller is responsible for loading nodes (e.g. via specgraph.load_spec_nodes).
This module only knows about plain Python dicts.

Tree structure:
    A node B is a child of node A when B.refines contains A's id.
    Child order: position in parent's depends_on list (author-defined intent),
    then by node id for children not in depends_on.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------


@dataclass
class CompileOptions:
    """Tunable knobs for the compiler. All have safe defaults."""

    max_depth: int = 6
    """Maximum heading depth (1-6). Headings deeper than this are capped at H6."""

    include_objective: bool = True
    """Include specification.objective as a blockquote under the heading."""

    include_acceptance: bool = True
    """Include acceptance criteria as a bulleted list."""

    include_depends_on_refs: bool = True
    """Include a compact 'Depends on: ...' line listing cross-tree dependencies."""

    include_prompt: bool = False
    """Include the node's prompt field (verbose; off by default)."""


@dataclass
class CompileResult:
    """Output of compile_spec_tree."""

    markdown: str
    root_id: str
    node_count: int
    max_depth_reached: int
    nodes_included: list[str] = field(default_factory=list)
    cycles_skipped: list[str] = field(default_factory=list)
    missing_skipped: list[str] = field(default_factory=list)

    def manifest(self) -> dict[str, Any]:
        """Return a serialisable summary dict suitable for API responses."""
        return {
            "root_id": self.root_id,
            "node_count": self.node_count,
            "max_depth_reached": self.max_depth_reached,
            "nodes_included": self.nodes_included,
            "cycles_skipped": self.cycles_skipped,
            "missing_skipped": self.missing_skipped,
        }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _coerce_id_list(value: Any) -> list[str]:
    """Coerce None / str / list to a list of non-empty strings."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value else []
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return []


def _build_parent_to_children(
    nodes_by_id: dict[str, dict[str, Any]],
) -> dict[str, list[str]]:
    """Return mapping parent_id → [child_id, ...] derived from refines edges.

    A node that declares `refines: [parent_id]` is a child of parent_id.
    Children not found in nodes_by_id are silently omitted (broken refs).
    """
    parent_to_children: dict[str, list[str]] = {nid: [] for nid in nodes_by_id}
    for node_id, raw in nodes_by_id.items():
        for parent_id in _coerce_id_list(raw.get("refines")):
            if parent_id in parent_to_children:
                parent_to_children[parent_id].append(node_id)
    return parent_to_children


def _ordered_children(
    parent_id: str,
    parent_raw: dict[str, Any],
    children: list[str],
) -> list[str]:
    """Sort children using author-declared depends_on order, then by id.

    The author's depends_on list expresses intent order. Children that appear
    there come first (in depends_on order). Remaining children follow sorted
    by their string id.
    """
    if not children:
        return []
    depends_on = _coerce_id_list(parent_raw.get("depends_on"))
    # position map for fast lookup; only children present in depends_on count
    dep_pos = {cid: i for i, cid in enumerate(depends_on) if cid in children}
    in_dep = [cid for cid in depends_on if cid in dep_pos]
    not_in_dep = sorted(cid for cid in children if cid not in dep_pos)
    return in_dep + not_in_dep


def _heading(depth: int, max_depth: int) -> str:
    """Return the Markdown heading prefix for *depth* (0-based)."""
    level = min(depth + 1, max_depth)
    return "#" * level


def _number_prefix(stack: list[int]) -> str:
    """Convert a counter stack to a dotted number prefix.

    depth-0 node (root) → no prefix
    depth-1 node, position 3 → "3. "
    depth-2 node, positions [3, 1] → "3.1. "
    """
    if not stack:
        return ""
    return ".".join(str(n) for n in stack) + ". "


def _render_node(
    raw: dict[str, Any],
    depth: int,
    stack: list[int],
    options: CompileOptions,
) -> list[str]:
    """Render a single spec node as Markdown lines."""
    lines: list[str] = []

    node_id = raw.get("id", "UNKNOWN")
    title = raw.get("title", "")
    status = raw.get("status", "")
    maturity = raw.get("maturity")

    # Heading
    prefix = _number_prefix(stack)
    heading_text = f"{prefix}{node_id}"
    if title:
        heading_text += f" · {title}"
    heading_prefix = _heading(depth, options.max_depth)
    lines.append(f"{heading_prefix} {heading_text}")
    lines.append("")

    # Metadata line
    meta_parts: list[str] = []
    if status:
        meta_parts.append(f"**Status:** {status}")
    if maturity is not None:
        meta_parts.append(f"**Maturity:** {maturity}")
    if meta_parts:
        lines.append("  ".join(meta_parts))
        lines.append("")

    # Objective (blockquote)
    if options.include_objective:
        spec = raw.get("specification")
        if isinstance(spec, dict):
            objective = spec.get("objective")
            if objective and isinstance(objective, str):
                obj_text = objective.strip().replace("\n", " ")
                lines.append(f"> {obj_text}")
                lines.append("")

    # Prompt (optional, verbose)
    if options.include_prompt:
        prompt = raw.get("prompt")
        if prompt and isinstance(prompt, str):
            prompt_text = prompt.strip().replace("\n", " ")
            lines.append(f"*{prompt_text}*")
            lines.append("")

    # Acceptance criteria
    if options.include_acceptance:
        acceptance = raw.get("acceptance")
        if isinstance(acceptance, list) and acceptance:
            lines.append("**Acceptance:**")
            lines.append("")
            for criterion in acceptance:
                if criterion:
                    lines.append(f"- {str(criterion).strip()}")
            lines.append("")

    # Cross-tree depends_on references (nodes not in the rendered subtree)
    if options.include_depends_on_refs:
        depends_on = _coerce_id_list(raw.get("depends_on"))
        if depends_on:
            refs = ", ".join(f"`{d}`" for d in depends_on)
            lines.append(f"*Depends on: {refs}*")
            lines.append("")

    return lines


# ---------------------------------------------------------------------------
# Main compiler
# ---------------------------------------------------------------------------


def compile_spec_tree(
    nodes_by_id: dict[str, dict[str, Any]],
    root_id: str,
    options: CompileOptions | None = None,
) -> CompileResult:
    """Compile the spec subtree rooted at *root_id* into a Markdown document.

    Uses DFS over refines-derived parent→children edges. Cycle detection
    ensures every node appears at most once (first occurrence wins).

    Args:
        nodes_by_id: Mapping of spec id → raw YAML dict. Typically produced by
            specgraph.load_spec_nodes() and re-keyed by callers.
        root_id: The id of the node to start from.
        options: Rendering options. Defaults to CompileOptions().

    Returns:
        CompileResult with the markdown string and a manifest dict.
    """
    if options is None:
        options = CompileOptions()

    if root_id not in nodes_by_id:
        return CompileResult(
            markdown="",
            root_id=root_id,
            node_count=0,
            max_depth_reached=0,
            missing_skipped=[root_id],
        )

    parent_to_children = _build_parent_to_children(nodes_by_id)

    lines: list[str] = []
    nodes_included: list[str] = []
    cycles_skipped: list[str] = []
    missing_skipped: list[str] = []
    visited: set[str] = set()
    max_depth_reached = 0

    # DFS stack entries: (node_id, depth, counter_stack)
    # counter_stack is a list of ints representing the current heading numbers.
    # We use an explicit stack to avoid Python recursion limits on deep graphs.
    # Each entry also carries a sibling_counter reference for post-pop increment.

    # We need to track sibling position per depth. Use a separate counter stack
    # that we manage alongside the DFS.
    dfs_stack: list[tuple[str, int, list[int]]] = [(root_id, 0, [])]

    while dfs_stack:
        node_id, depth, num_stack = dfs_stack.pop()

        if node_id in visited:
            cycles_skipped.append(node_id)
            continue

        raw = nodes_by_id.get(node_id)
        if raw is None:
            missing_skipped.append(node_id)
            continue

        visited.add(node_id)
        nodes_included.append(node_id)
        max_depth_reached = max(max_depth_reached, depth)

        # Render this node
        node_lines = _render_node(raw, depth, num_stack, options)
        lines.extend(node_lines)
        lines.append("---")
        lines.append("")

        # Push children in reverse order so the leftmost child is processed first
        children_unordered = parent_to_children.get(node_id, [])
        children = _ordered_children(node_id, raw, children_unordered)

        for i, child_id in enumerate(reversed(children)):
            child_position = len(children) - i  # 1-based, reversed
            child_stack = num_stack + [child_position]
            dfs_stack.append((child_id, depth + 1, child_stack))

    # Fix: child_position computed above in reverse order is wrong.
    # We need forward order. Rebuild correctly: push in reverse so first child
    # is popped first; assign positions 1..n in forward order.

    # The above logic is buggy — let me use recursive approach with a list
    # collector instead, which is cleaner for numbered sections.
    # Reset and redo with recursive DFS (bounded by max_depth; Python default
    # recursion limit ~1000 is fine for any realistic spec graph).

    lines = []
    nodes_included = []
    cycles_skipped = []
    missing_skipped = []
    visited = set()
    max_depth_reached = 0

    def _dfs(node_id: str, depth: int, num_stack: list[int]) -> None:
        nonlocal max_depth_reached

        if node_id in visited:
            cycles_skipped.append(node_id)
            return

        raw = nodes_by_id.get(node_id)
        if raw is None:
            missing_skipped.append(node_id)
            return

        visited.add(node_id)
        nodes_included.append(node_id)
        max_depth_reached = max(max_depth_reached, depth)

        node_lines = _render_node(raw, depth, num_stack, options)
        lines.extend(node_lines)
        lines.append("---")
        lines.append("")

        children_unordered = parent_to_children.get(node_id, [])
        children = _ordered_children(node_id, raw, children_unordered)

        for i, child_id in enumerate(children, start=1):
            _dfs(child_id, depth + 1, num_stack + [i])

    _dfs(root_id, 0, [])

    markdown = "\n".join(lines).rstrip() + "\n"

    return CompileResult(
        markdown=markdown,
        root_id=root_id,
        node_count=len(nodes_included),
        max_depth_reached=max_depth_reached,
        nodes_included=nodes_included,
        cycles_skipped=cycles_skipped,
        missing_skipped=missing_skipped,
    )


def index_nodes(
    nodes: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Index a node list by id, skipping entries without a valid string id.

    Convenience helper for callers that have the list form from load_spec_nodes.
    """
    result: dict[str, dict[str, Any]] = {}
    for raw in nodes:
        node_id = raw.get("id")
        if isinstance(node_id, str) and node_id.strip() and node_id not in result:
            result[node_id] = raw
    return result
