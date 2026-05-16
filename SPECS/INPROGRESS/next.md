# In Progress Queue

**Current Task:** `CTXB-P13-T1` — Select SpecSpace parity track after deployment hardening

## Recently Archived
- `CTXB-P12-T9` — Clean up static production runtime noise (PASS, 2026-05-16)
- `CTXB-P12-T8` — Surface live artifact error diagnostics (PASS, 2026-05-16)
- `CTXB-P12-T7` — Publish pinned SpecSpace images and generate manifest-only Timeweb branch (PASS, 2026-05-16)
- `CTXB-P12-T6` — Plan registry-backed Timeweb deploy branch and HTTP artifacts (PASS, 2026-05-16)
- `CTXB-P12-T5` — Add Timeweb no-volume demo deployment guard (PASS, 2026-05-16)
- `CTXB-P12-T4` — Separate legacy ContextBuilder docs from SpecSpace docs (PASS, 2026-05-16)
- `CTXB-P12-T3` — Add GraphSpace API boundary guardrail (PASS, 2026-05-16)
- `CTXB-P12-T2` — Document SpecSpace product and deployment boundary (PASS, 2026-05-16)
- `CTXB-P12-T1` — Define SpecSpace product boundary and next queue (PASS, 2026-05-16)
- `CTXB-P3-T6` — Add message authoring to conversations (PASS, 2026-05-16)
- `CTXB-P11-T3` — Docker Compose CI smoke (PASS, 2026-05-15)
- `CTXB-P11-T2` — Dockerized SpecSpace deployment smoke (PASS, 2026-05-15)
- `CTXB-P11-T1` — Versioned readonly SpecGraph provider for SpecSpace API (PASS, 2026-05-15)
- `CTXB-P10-T13` — Resolve GraphSpace FSD insignificant-slice warnings (PASS, 2026-05-15)
- `CTXB-P7-T13` — Add CI pipeline (PASS, 2026-05-15)
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

### SpecSpace Parity (Phase 13, current)
- `CTXB-P13-T1` — Select SpecSpace parity track after deployment hardening (P1, depends on P12-T9)
- Rationale: Timeweb/static deployment is now usable with versioned UI/API status, pinned images, HTTP SpecGraph artifacts, implementation work data, and reduced production log noise. The next product priority is parity with old ContextBuilder: SpecPM registry integration, Agent Workbench conversations, proposal viewer, metrics screen, and richer canvas interactions.

### Phase 13 Suggested Stack
- `CTXB-P13-T2` — Disable or replace local-only SpecPM lifecycle UI in static mode.
- `CTXB-P13-T3` — Add SpecPM registry URL config and health reporting.
- `CTXB-P13-T4` — Add SpecPM registry status/package read adapter.
- `CTXB-P13-T5` — Start Proposal Viewer parity with static proposal indexes.
- `CTXB-P13-T6` — Start Metrics screen parity with existing metrics artifacts.
- `CTXB-P13-T7` — Define Agent Workbench conversation artifact model.
- `CTXB-P13-T8` — Add graph-context-to-agent-context selection flow.

### Legacy ContextBuilder Product Authoring (Phase 3)
- `CTXB-P3-T6` is complete. Remaining Phase 3 authoring tasks are legacy ContextBuilder work and should not be selected as SpecSpace follow-ups unless the goal explicitly returns to conversation editing.
- Next legacy candidates: `CTXB-P3-T7` delete conversation action, `CTXB-P3-T8` reorder messages, and later message move/duplicate/copy flows.

### Technical Debt (Phase 7)
- Phase 7 core technical-debt queue is complete through `CTXB-P7-T13`.

### Phase 7 Follow-ups
- No remaining Phase 7 follow-up selected after CI; next queue item is the GraphSpace FSD cleanup below.

### Deployment Follow-ups
- Phase 11 deployment boundary is complete through `CTXB-P11-T3`.

### GraphSpace Follow-ups
- Phase 10 follow-ups are complete through `CTXB-P10-T13`.

### Completed GraphSpace Context
- Completed context: `CTXB-P10-T1` through `CTXB-P10-T12`, plus `CTXB-P8-T2`, `CTXB-P9-T6`, and `CTXB-P9-T7`.
- GraphSpace currently has the primary SpecGraph canvas, Sidebar navigator, rich Spec Inspector, hover previews, SpecPM lifecycle badges, and unified SpecNode visual signals.
- New parity context: see `SPECS/SPECSPACE_PARITY_ROADMAP.md`.
