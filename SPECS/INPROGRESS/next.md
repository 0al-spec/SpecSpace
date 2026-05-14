# In Progress Queue

**Current Task:** `CTXB-P7-T13` — Add CI pipeline

## Recently Archived
- `CTXB-P7-T12` — Extract shared data-fetching base hook (PASS, 2026-05-14)
- `CTXB-P7-T11` — Enable TypeScript strict mode and add ESLint (PASS, 2026-05-14)
- `CTXB-P7-T9` — Decompose App.tsx god component (PASS, 2026-05-14)
- `CTXB-P7-T3` — Introduce typed dataclasses for graph objects (PASS, 2026-05-14)
- `CTXB-P7-T2` — Split server.py into focused modules (PASS, 2026-05-14)
- `CTXB-P9-T7` — SpecNode visual signal unification (PASS, 2026-05-13)
- `CTXB-P8-T2` — SpecPM lifecycle badge on SpecNode (PASS, 2026-05-13)
- `CTXB-P9-T6` — Hover preview card on spec nodes (PASS, 2026-05-13)
- `CTXB-P10-T12` — Keep selected navigator row visible (PASS, 2026-05-13)
- `CTXB-P10-T11` — Focus canvas on selected SpecGraph node (PASS, 2026-05-13)
- `CTXB-P10-T10` — Add Sidebar navigator signal filters (PASS, 2026-05-13)
- `CTXB-P10-T9` — Add Sidebar spec node navigator (PASS, 2026-05-13)
- `CTXB-P10-T8` — Add canvas-first panel dock for GraphSpace (PASS, 2026-05-13)
- `CTXB-P10` follow-up — Tune Sidebar and canvas utility layout (PASS, 2026-05-13)
- `CTXB-P9-T2` — Pin + compare two specs side-by-side (PASS, 2026-04-24)
- `CTXB-P9-T5` — Related-items drawer in SpecInspector (PASS, 2026-04-24)
- `CTXB-P9-T3` — Command palette ⌘K — already implemented as SearchPalette (PASS, 2026-04-24)
- `CTXB-P9-T4` — Filter bar — hide/show nodes by criteria (PASS, 2026-04-24)
- `CTXB-P7-T7` — Fix SSE spec-watch thread management (PASS, 2026-04-24)
- `CTXB-P9-T1` — Change highlighting on SSE reload (PASS, 2026-04-23)
- `CTXB-P8-T1` — Add 5th lifecycle stage (import_handoff) to SpecPMLifecyclePanel (PASS, 2026-04-23)
- `CTXB-P7-T16` — Hide AgentChat behind a feature flag (PASS, 2026-04-23)
- `CTXB-P7-T15` — Replace SHA-1 with SHA-256 (PASS, 2026-04-23)
- `CTXB-P7-T14` — Expose compile capability in /api/capabilities (PASS, 2026-04-12)
- `CTXB-P7-T10` — Add React Error Boundaries (PASS, 2026-04-12)
- `CTXB-P7-T8` — Add rmtree safety marker to export directory (PASS, 2026-04-12)
- `CTXB-P7-T6` — Consolidate path traversal protection (PASS, 2026-04-12)

## Suggested Next Tasks

### Technical Debt (Phase 7, current)
- `CTXB-P7-T13` — Add CI pipeline (P1, depends on T11)
- Initial implementation target: add a GitHub Actions workflow for backend tests/lint and viewer/app typecheck/build using Python 3.11 and the documented Node.js 18+ baseline.

### Phase 7 Follow-ups
- No remaining Phase 7 follow-up selected after CI; next queue item is the GraphSpace FSD cleanup below.

### GraphSpace Follow-ups
- `CTXB-P10-T13` — Resolve GraphSpace FSD `insignificant-slice` warnings (P3, depends on T12)

### Completed GraphSpace Context
- Completed context: `CTXB-P10-T1` through `CTXB-P10-T12`, plus `CTXB-P8-T2`, `CTXB-P9-T6`, and `CTXB-P9-T7`.
- GraphSpace currently has the primary SpecGraph canvas, Sidebar navigator, rich Spec Inspector, hover previews, SpecPM lifecycle badges, and unified SpecNode visual signals.
