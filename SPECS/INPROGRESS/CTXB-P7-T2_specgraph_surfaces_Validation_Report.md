# Validation Report — CTXB-P7-T2: SpecGraph Surfaces Extraction

**Date:** 2026-05-13  
**Verdict:** PASS  
**Slice:** Extract SpecGraph runs/surface read models

---

## Deliverables Produced

| Artifact | Status |
|----------|--------|
| `viewer/specgraph_surfaces.py` — SpecGraph runs directory helpers, generic runs artifact envelopes, recent runs summaries, activity/work index filtering, graph dashboard/backlog reads, and spec overlay merging | ✅ Done |
| `viewer/server.py` — thin route wrappers delegating SpecGraph surface read-model logic to the extracted module | ✅ Done |

---

## Acceptance Criteria

| AC | Description | Result |
|----|-------------|--------|
| AC1 | Graph dashboard and graph backlog endpoints keep their response contracts | ✅ Verified by focused endpoint tests |
| AC2 | Metrics surface endpoints keep the standard `{path, mtime, mtime_iso, data}` envelope | ✅ Verified by `tests/test_metrics_surfaces.py` |
| AC3 | Recent runs parsing remains deterministic and watcher-adjacent behavior still passes | ✅ Verified by focused tests including `tests/test_runs_watcher.py` |
| AC4 | SpecGraph and exploration capability endpoints keep working | ✅ Verified by `tests/test_specgraph.py` and `tests/test_exploration_preview.py` |
| AC5 | Backend lint and full test suite pass after extraction | ✅ `make lint` and `python -m pytest tests/` passed |

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Review-focused tests | `python -m pytest tests/test_specgraph_surfaces.py tests/test_graph_dashboard.py tests/test_graph_backlog_projection.py tests/test_metrics_surfaces.py` | ✅ 166 passed |
| Python lint | `make lint` | ✅ Passed |
| Full backend tests | `python -m pytest tests/` | ✅ 488 passed |

---

## Implementation Summary

- Added `viewer/specgraph_surfaces.py` for read-only SpecGraph viewer surfaces backed by `runs/`.
- Moved graph dashboard, graph backlog projection, generic metrics artifacts, recent runs, spec activity, implementation work index, and spec overlay read-model logic out of `viewer/server.py`.
- Kept `ViewerHandler` methods as route wrappers so HTTP routing remains local to `server.py`.
- Added regression coverage for `--specgraph-dir`-only runs surfaces, recent-runs ordering/metadata parsing, and malformed optional overlay artifacts.
- Reduced `viewer/server.py` from 2176 lines to 1865 lines in this slice after review hardening.

## Residual Work

- Extract `SpecWatcher` and `RunsWatcher` into a watcher-focused module.
- Continue reducing build/invocation handlers where useful, especially SpecPM and exploration build routes.
