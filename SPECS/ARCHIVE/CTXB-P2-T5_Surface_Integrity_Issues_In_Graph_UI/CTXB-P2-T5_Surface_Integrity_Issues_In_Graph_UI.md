# CTXB-P2-T5 — Surface Integrity Issues Directly In The Graph UI

## Objective Summary

Make broken references, duplicate IDs, unsupported files, and compile-blocking validation errors visible in the graph UI so the user can distinguish data issues from missing content. Currently blocked files are invisible on the canvas, issue counts are hidden in the summary, and the user must select individual nodes to see diagnostics. This task surfaces workspace-level integrity at three levels: the graph summary, the workspace stats, and a dedicated blocked-files section.

## Scope And Deliverables

### Deliverables

1. **Enhanced workspace stats** — include blocking and non-blocking issue counts alongside file/node counts.
2. **Enhanced graph summary** — when blocking issues exist, call them out explicitly with count and note that blocked files are not rendered on the canvas.
3. **Blocked files panel** — render a `blocked-files` section below the graph canvas listing each blocked file with its diagnostics, diagnostic codes, and file name. This makes invisible blocked files actionable.
4. **Diagnostic count badges on graph nodes** — for nodes with diagnostics, show the count on the canvas node card (in addition to the existing "Broken lineage" warning text).
5. **Smoke test** for the new UI surface presence.

### Out Of Scope

1. Fixing blocked files automatically.
2. Inline editing of blocked files.
3. Aggregate diagnostic dashboard (grouping by diagnostic code across files).
4. Server-side changes — all data is already available from `/api/graph`.

## Success Criteria

1. Broken lineage is visible on the canvas and in the details UI.
2. Unsupported files or blocking errors are explicit and actionable.
3. The UI does not silently suppress graph inconsistencies.
4. Satisfies PRD NFR-7.

## Acceptance Tests

### UI Behavior Acceptance

1. Workspace stats show issue counts when blocking/non-blocking issues exist.
2. Graph summary calls out blocking issues when present.
3. Blocked files are listed with their diagnostic codes and messages below the canvas.
4. Nodes with diagnostics show a count badge on the canvas card.

### Verification Acceptance

1. `make test` passes.
2. `make lint` passes.
3. `pytest --cov=viewer --cov=tests --cov-report=term-missing --cov-fail-under=90` passes.

## Test-First Plan

### Step 1: Add smoke tests

- Verify presence of blocked-files rendering logic and enhanced stats in `viewer/index.html`.

### Step 2: Enhance workspace stats

- Show blocking/non-blocking issue counts from `graphState.api.summary`.

### Step 3: Enhance graph summary

- When `has_blocking_issues` is true, add explicit warning text.

### Step 4: Add blocked files panel

- Add HTML container for blocked files.
- Render each blocked file as a detail item with diagnostics.

### Step 5: Add diagnostic count badge on canvas nodes

- For nodes with diagnostics, render a small count indicator on the canvas card.

### Step 6: Validation and cleanup

- Run quality gates, create validation report.
