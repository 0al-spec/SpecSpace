# CTXB-P4-T5 — Preserve provenance from compiled artifact back to graph selection

**Status:** In Progress
**Priority:** P1
**Dependencies:** CTXB-P4-T1, CTXB-P4-T3

## Objective Summary

Make every successful compile output self-traceable back to the exact graph selection that produced it. The compile pipeline already returns `compile_target` metadata in API responses, but artifacts on disk should also carry stable provenance so users can verify origin after refresh, restarts, or repeated compilation runs. The task will add deterministic provenance artifacts in the export directory and ensure the final compiled markdown includes a clear compile-target marker.

## Deliverables

- Export pipeline writes a deterministic machine-readable provenance file in the target export directory.
- Hyperprompt root generation includes a provenance section so compile output contains explicit target identity.
- Compile API success payload includes path to the provenance file for easy discovery.
- UI compile result panel surfaces provenance artifact location alongside `compiled.md` and `manifest.json`.
- Regression tests for export/compile provenance behavior and deterministic re-runs.
- Validation report capturing quality-gate outcomes and acceptance-criteria mapping.

## Acceptance Criteria and Acceptance Tests

- [ ] A user can determine which compile target produced a compiled artifact.
  - **Test:** successful compile response includes provenance path and target fields; compiled output contains compile-target provenance section.
- [ ] Artifact provenance survives refresh and repeated compilation.
  - **Test:** running export/compile twice yields provenance artifacts with stable target mapping and deterministic content structure.
- [ ] Implementation satisfies PRD FR-16 and §6.6.
  - **Test:** provenance is available in machine-readable form (`.json`) and in compiled markdown output.

## Test-First Plan

1. Add failing tests for provenance artifact generation in `export_graph_nodes` output (presence + essential keys).
2. Add failing tests for compile success payload to include provenance artifact path.
3. Add failing tests ensuring generated `root.hc` includes provenance section reference and remains deterministic.
4. Implement minimal server changes to make tests green.
5. Update frontend compile result typing/rendering for the new field and validate TypeScript build/lint path if available.

## Implementation TODO (Phased)

### Phase 1 — Server provenance model
- **Inputs:** existing `compile_target` payload, lineage/export artifacts in `viewer/server.py`.
- **Outputs:** deterministic provenance JSON and provenance markdown generated during export.
- **Verification:** unit tests confirm files are created and include expected target identifiers.

### Phase 2 — Compile and API wiring
- **Inputs:** export response from `export_graph_nodes`, compile response payload.
- **Outputs:** compile payload includes `provenance_json`; root `.hc` includes provenance content so `compiled.md` remains traceable.
- **Verification:** compile integration tests assert new payload field and successful flow unchanged.

### Phase 3 — UI and docs alignment
- **Inputs:** compile payload contract from server.
- **Outputs:** Inspector compile result shows provenance path and copy affordance; README/API section reflects new field.
- **Verification:** lint/tests pass; manual review confirms UX clarity.

## Constraints and Decisions

- Keep provenance content deterministic: no volatile timestamps in compiled-facing content.
- Preserve backward compatibility: existing payload fields and compile flow remain unchanged.
- Avoid requiring Hyperprompt changes; provenance is prepared entirely in ContextBuilder export layer.

## Notes

After implementation, update workplan/archive docs and include explicit mention that provenance now appears as both a sidecar JSON artifact and a compile-included provenance section.
