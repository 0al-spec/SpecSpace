# PRD — CTXB-P7-T2: Split server.py into focused modules

**Status:** INPROGRESS  
**Phase:** 7 — Technical Debt and Quality  
**Priority:** P2  
**Branch:** codex/p7-t2-server-split-plan  
**Date:** 2026-05-13  
**Difficulty:** high  
**reasoning_effort:** high

---

## Problem

`viewer/server.py` was originally described as approximately 1500 lines, but it has grown to
more than 3500 lines. It now combines several responsibilities:

| Area | Current responsibility inside `viewer/server.py` |
|------|--------------------------------------------------|
| HTTP routing | `ViewerHandler`, request parsing, responses, static serving |
| Workspace cache | directory fingerprints, cache registry, cached listing |
| Conversation graph | validation serialization, graph snapshot, indexes, lineage paths |
| Export pipeline | Markdown rendering, `.hc` root generation, compile provenance |
| Compile pipeline | Hyperprompt binary resolution and invocation |
| SpecGraph artifacts | SpecPM lifecycle, proposals, exploration surfaces, run artifact summaries |
| Watchers | SpecGraph artifact and runs SSE polling |

This makes behavior difficult to review safely. A direct one-shot split to a ≤400-line
`server.py` would be large and risky because tests currently import and monkeypatch functions via
`viewer.server`.

## Compatibility constraint

`viewer.server` is currently a public compatibility surface from the test perspective. The split
must preserve these call sites while moving implementations behind focused modules.

Known sensitive cases:

| Compatibility surface | Constraint |
|-----------------------|------------|
| `tests/test_workspace_cache.py` patches `viewer.server._build_workspace_listing` | Workspace-cache extraction needs a wrapper that keeps monkeypatch behavior intact. |
| `tests/test_compile.py` mutates `viewer.server.DEFAULT_HYPERPROMPT_BINARY` | Compile extraction needs a wrapper or explicit compatibility bridge for the mutable default. |
| Tests call export helpers from `viewer.server` | Export helpers can move only if names are re-exported or wrapped. |
| Tests call `_build_specpm_lifecycle` from `viewer.server` | SpecPM helpers can move first if re-export compatibility is retained. |

## Solution

Split the task into reviewable stacked PRs rather than one oversized rewrite.

### Slice 1 — Plan and compatibility contract

Add this PRD and document the extraction order, hazards, and validation expectations.

### Slice 2 — Extract SpecPM / exploration read models

Create a focused module for low-risk SpecGraph artifact read-model helpers:

- SpecPM lifecycle parsing.
- Proposal markdown parsing.
- Run artifact availability metadata.
- Exploration surface summaries.

`viewer.server` should import the moved helpers so existing tests and handler code continue to use
the same names.

### Slice 3 — Extract export pipeline

Move Markdown export, `.hc` root generation, and compile provenance rendering into a focused
module. Keep `viewer.server` compatibility imports for existing test call sites.

### Slice 4 — Extract compile pipeline

Move Hyperprompt binary resolution and invocation into a focused module. Preserve
`viewer.server.DEFAULT_HYPERPROMPT_BINARY` mutation compatibility, either with thin wrappers or an
explicit shared config object.

### Slice 5 — Extract graph read model and workspace cache

Move graph indexing and lineage helpers after the lower-risk slices. Move workspace cache last or
with explicit wrappers because `_build_workspace_listing` is monkeypatched in cache tests.

## Deliverables

| # | Artifact | Description |
|---|----------|-------------|
| 1 | `SPECS/INPROGRESS/CTXB-P7-T2_split_server_modules.md` | Extraction plan and compatibility contract |
| 2 | `viewer/specpm.py` or equivalent | SpecPM / exploration helper module |
| 3 | `viewer/export.py` | Export pipeline module |
| 4 | `viewer/compile.py` | Hyperprompt invocation module |
| 5 | `viewer/graph.py` | Conversation graph read-model module |
| 6 | `viewer/server.py` | Thin routing and compatibility facade |

## Acceptance Criteria

- AC1: `viewer.server` remains import-compatible for existing tests throughout the split.
- AC2: Each extraction PR has focused tests or regression coverage for the moved behavior.
- AC3: Full Python test suite passes after each implementation slice.
- AC4: The final slice reduces `viewer/server.py` to routing, request/response handling, and
  compatibility wrappers only.
- AC5: The original ≤400-line target is reached by the end of the staged split, not necessarily
  by the first implementation PR.

## Validation Plan

Run focused tests for each moved area first, then the full backend suite:

```bash
python -m pytest tests/test_specpm_lifecycle.py tests/test_exploration_surfaces.py tests/test_exploration_preview.py
python -m pytest tests/test_compile.py tests/test_export.py
python -m pytest tests/test_workspace_cache.py
python -m pytest tests/
```

When frontend contracts or generated artifacts are affected, also run:

```bash
npm test
npm run build
npm run lint:fsd
```

## Risks

- A naive re-export can preserve imports but not monkeypatch semantics for mutable module globals.
- Moving compile helpers without handling `DEFAULT_HYPERPROMPT_BINARY` can silently break tests that
  mutate the default binary path.
- Splitting graph helpers before export/compile helpers increases conflict risk because graph
  payloads feed many routes.
- Reaching the ≤400-line target requires multiple stacked PRs; stopping after the first extraction
  would improve organization but not complete the original task.
