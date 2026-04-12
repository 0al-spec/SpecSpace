# PR: CTXB-P6-T1 — SpecGraph Specification Viewer

**Branch:** `feature/CTXB-P6-T1-specgraph-viewer` → `main`

## Summary

- Implements the complete **Phase 6** SpecGraph viewer (T1–T9) as a FLOW-compliant archive
- Adds **T8** (the only previously unimplemented deliverable): `ExpandedSpecNode` group container and `SpecSubItemNode` component for expanded spec node sub-items
- All Phase 6 tasks marked ✅ in `SPECS/Workplan.md`
- PRD archived to `SPECS/ARCHIVE/CTXB-P6-T1_SpecGraph_Viewer/`

## Changes

### New files (T8)
- `viewer/app/src/ExpandedSpecNode.tsx` — React Flow group container (`type: "expandedSpec"`) for expanded spec nodes; preserves same handle IDs as `SpecNode` for seamless edge routing
- `viewer/app/src/ExpandedSpecNode.css`
- `viewer/app/src/SpecSubItemNode.tsx` — compact sub-item node (`type: "specSubItem"`) showing acceptance criteria (AC), decisions (DEC), and invariants (INV)
- `viewer/app/src/SpecSubItemNode.css`

### Modified files (T8)
- `viewer/app/src/SpecNode.tsx` — added `isExpanded?` and `onToggleExpand?` to `SpecNodeData`; expand toggle button (▸/▾) shown when node has expandable sub-items
- `viewer/app/src/SpecNode.css` — expand button style
- `viewer/app/src/useSpecGraphData.ts` — expansion state (`expandedSpecIds`, `specDetails`), lazy detail fetch via `/api/spec-node`, group+sub-item node generation
- `viewer/app/src/App.tsx` — registered `expandedSpec` and `specSubItem` node types; `onNodeClick` handler for sub-items selects the parent spec

### Docs / FLOW
- `SPECS/ARCHIVE/CTXB-P6-T1_SpecGraph_Viewer/` — PRD + validation report
- `SPECS/ARCHIVE/INDEX.md` — updated
- `SPECS/ARCHIVE/_Historical/REVIEW_ctxb_p6_t1_specgraph_viewer.md` — review report
- `SPECS/INPROGRESS/next.md` — cleared, Phase 7 suggested
- `SPECS/Workplan.md` — T1–T9 marked ✅

## Quality Gate Results

| Gate | Result |
|------|--------|
| `python -m pytest tests/` | 243 passed |
| `make lint` | pass (exit 0) |
| `tsc --noEmit` | pass (exit 0) |

## Review Verdict

Approve with comments — no blockers. Three low-severity observations (loading state UX, extractSubItems test coverage, searchDimmed propagation) noted as optional follow-up.
