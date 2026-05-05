---
description: Isolated compiler module + modal UI that traverses a spec subtree via refines edges and emits a numbered Markdown document with configurable sections
status: shipped
files_changed:
  - viewer/spec_compile.py
  - viewer/server.py
  - viewer/app/src/SpecCompileOverlay.tsx
  - viewer/app/src/SpecCompileOverlay.css
  - viewer/app/src/SpecInspector.tsx
  - viewer/app/src/App.tsx
rationale: Users needed a way to export a readable structured summary of a spec subtree for use in LLMs, documents, and review sessions — similar to what hyperprompt does for conversation graphs but targeting the spec graph
created: 2026-05-05
areas:
  - [[feature register]]
---

# spec tree compiled to markdown from root node

Selecting any spec node in SpecInspector and clicking the "Compile spec tree to
Markdown" button (document icon) opens a modal overlay. The overlay immediately
compiles the node's subtree into a structured Markdown document and displays it.
Users can adjust depth and section toggles, copy to clipboard, or download as
`{rootId}.md`.

## Backend: viewer/spec_compile.py

Pure Python module with zero cross-module dependencies — callers supply a
`nodes_by_id` dict; the module handles all tree logic.

**Types:**

```python
CompileOptions(max_depth=6, include_objective=True, include_acceptance=True,
               include_depends_on_refs=True, include_prompt=False)

CompileResult(markdown, root_id, node_count, max_depth_reached,
              nodes_included, cycles_skipped, missing_skipped)
# .manifest() → serialisable dict for API responses
```

**Entry point:**

```python
compile_spec_tree(nodes_by_id, root_id, options) → CompileResult
```

Tree structure: a node B is a child of A when `B.refines` contains A's id.
Child ordering: position in parent's `depends_on` list (author intent), then by
node id for children not in `depends_on`. Headings are numbered hierarchically
(`1. / 1.1. / 1.1.2.`) via a counter stack passed through recursion.

Each node renders as:
1. Heading (`#` × min(depth+1, max_depth)) with dotted number prefix and id·title
2. Metadata line: **Status:** / **Maturity:**
3. `> objective` blockquote (if `include_objective`)
4. `*prompt text*` italic (if `include_prompt`)
5. **Acceptance:** bullet list (if `include_acceptance`)
6. `*Depends on: \`id\`*` (if `include_depends_on_refs`)
7. `---` separator

Cycle detection uses a visited set; first occurrence wins. Missing nodes are
recorded in `missing_skipped` rather than crashing.

**Why recursive DFS instead of explicit stack:** An initial iterative DFS
implementation had a numbering bug — `child_position` computed during reverse
iteration was incorrect. The recursive `_dfs()` inside `compile_spec_tree`
handles numbered sections naturally via the stack argument.

## Backend: server.py

**Endpoint:** `GET /api/spec-compile`

Query params: `root` (required), `depth` (int), `objective`/`acceptance`/`deps`/`prompt` (0/1)

Response:
```json
{
  "root_id": "...",
  "markdown": "...",
  "manifest": {
    "node_count": 12,
    "max_depth_reached": 3,
    "nodes_included": [...],
    "cycles_skipped": [...],
    "missing_skipped": [...]
  },
  "load_errors": [{"file_name": "...", "message": "..."}]
}
```

**Capability flag:** `spec_compile: true` in `/api/capabilities` when `spec_dir`
is configured. Checked once on startup by the frontend.

Loads spec nodes via existing `specgraph.load_spec_nodes()`, re-indexes by id
using `spec_compile.index_nodes()`.

## Frontend: SpecCompileOverlay.tsx

Modal dialog following the `specpm-overlay / specpm-panel` pattern (imports
`SpecPMExportPreview.css` for base styles, same as `SpecPMLifecyclePanel`).

**Options bar:** depth `<select>` (1–6) + checkboxes for objective / acceptance /
deps / prompt. Any change triggers immediate recompile.

**PanelActions:**
- Rotate icon (spins while compiling) — recompile button
- Copy icon → copies markdown to clipboard, shows checkmark for 2 s
- Download icon → downloads `{rootId}.md` via blob URL

**Warnings bar:** shown when cycles/missing nodes/load errors are present.

**Body:** `<pre className="spec-compile-output">` — monospace, wrapping.

**Accessibility:** focus trapped in panel on open; Escape key closes; previous
focus restored on unmount.

## Frontend: SpecInspector.tsx

Added `onOpenSpecCompile?: (nodeId: string) => void` to both `SpecInspectorProps`
(outer) and `SpecDetailPaneProps` (inner). Button uses `faFileLines` icon,
title "Compile spec tree to Markdown", appears in the card footer action row
alongside Lens / SpecPM / Exploration buttons.

`hasCardActions` now includes `onOpenSpecCompile` in its boolean check.

## App.tsx wiring

```
specCompileAvailable ← Boolean(data.spec_compile) from /api/capabilities
specCompileRootId    ← useState<string | null>(null)

onOpenSpecCompile={specCompileAvailable ? (nodeId) => setSpecCompileRootId(nodeId) : undefined}
→ passed to SpecInspector → forwarded to SpecDetailPane

{specCompileRootId && (
  <SpecCompileOverlay rootId={specCompileRootId} onClose={() => setSpecCompileRootId(null)} />
)}
```

---

Related Features:
- [[feature register]]
