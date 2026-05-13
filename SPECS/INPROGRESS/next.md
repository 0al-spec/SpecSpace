# In Progress Queue

**Current Task:** `CTXB-P8-T2` — SpecPM lifecycle badge on SpecNode

## Recently Archived
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

### GraphSpace SpecGraph Canvas Migration
- Completed context: `CTXB-P10-T1` graph contract, `CTXB-P10-T2` data model, `CTXB-P10-T3` minimal canvas, `CTXB-P10-T4` deterministic layout, `CTXB-P10-T5` viewer recomposition, `CTXB-P10-T6` node selection, `CTXB-P10-T7` rich inspector, `CTXB-P10-T8` canvas-first panel dock, `CTXB-P10-T9` Sidebar navigator, `CTXB-P10-T10` navigator filters, `CTXB-P10-T11` canvas focus, and `CTXB-P10-T12` navigator selection visibility.
- Phase 10 is complete through the current Sidebar/canvas utility layout stack.

### SpecPM Integration
- `CTXB-P8-T2` — SpecPM lifecycle badge on SpecNode cards (P3, current)
- Implementation target is the GraphSpace rewrite (`graphspace/`); legacy `viewer/app`
  paths in the original Workplan entry are historical.

### Graph UX
- `CTXB-P9-T6` — Hover preview card on spec nodes (PASS, 2026-05-13)

### Technical Debt (Phase 7, pending)
- `CTXB-P7-T2` — Split server.py into focused modules (P2, depends on T1 ✅)
- `CTXB-P7-T9` — Decompose App.tsx god component (P2, no deps)
