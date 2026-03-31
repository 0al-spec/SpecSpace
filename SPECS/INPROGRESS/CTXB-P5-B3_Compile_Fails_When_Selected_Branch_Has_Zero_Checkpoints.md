# CTXB-P5-B3 — Compile fails when selected branch has zero checkpoints (empty title node in root.hc)

**Status:** In Progress
**Priority:** P2
**Phase:** Phase 5 — Hardening, Tests, and Documentation
**Dependencies:** CTXB-P5-B2

## Problem

When a BRANCH conversation has no checkpoints (0 messages), `export_graph_nodes` still appends it to
`conversations_written` with `"files": []`. `generate_hc_root` then emits a depth-1 title-only line with
no file children:

```
"ContextBuilder export root"
    "Агентная Операционная Система - Риски для PRD рынка"
    "nodes/.../0000.md"
    ...
    "Testing"          ← empty container, no children
```

Depending on the Hyperprompt parser version, an empty container node may either be silently ignored or
trigger a syntax error. Additionally, the _stale-server_ scenario (server started before the B2 fix was
loaded) still exhibits the original multi-root error (`Multiple root nodes (depth 0)`) for this input,
confirming the path was never tested.

## Reproduction

1. Open workspace `/private/tmp/specgraph_canonical` (30 JSON files).
2. Select `conv-march-branch` (BRANCH, `march-branch.json`, 0 checkpoints).
3. Click **Compile** — observe `COMPILE ERROR — EXIT CODE: 2`.

## Root Cause

`generate_hc_root` does not guard against conversations with an empty `files` list. The title node is
emitted unconditionally even when a conversation contributed zero checkpoint files.

## Fix Strategy

Filter zero-file conversations out of the `.hc` body inside `generate_hc_root`. Conversations with no
files have nothing to contribute to compiled context; omitting them is semantically correct and prevents
empty container nodes. The `conversations_written` response payload is unchanged (callers may still
inspect it).

## Deliverables

1. Update `generate_hc_root` in `viewer/server.py` to skip conversations where `conv_entry["files"]` is
   empty.
2. Add regression tests in `tests/test_export.py`:
   - Zero-file conversation is omitted from `.hc` output entirely.
   - Single-conversation export with zero checkpoints produces only the root wrapper (no orphan title).
   - Existing one-root and multi-conversation tests remain green.

## Acceptance Criteria

- Compiling a BRANCH node with 0 checkpoints does not produce a Hyperprompt syntax error.
- Generated `root.hc` contains no title-only nodes (every emitted title has at least one file child).
- `POST /api/compile` succeeds (or returns a clear user-facing message if _all_ conversations in the
  lineage have zero checkpoints).
- `make test` and `make lint` pass.

## Test-First Plan

1. Add a failing test: `generate_hc_root` with a zero-file conversation should not emit the title.
2. Observe red. Implement the guard. Observe green.
3. Add compile integration test for a conversation graph where the target branch has 0 checkpoints.
4. Run full quality gates.
