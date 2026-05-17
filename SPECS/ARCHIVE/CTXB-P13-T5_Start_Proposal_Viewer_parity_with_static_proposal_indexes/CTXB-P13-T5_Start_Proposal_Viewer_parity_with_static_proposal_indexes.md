# CTXB-P13-T5 — Start Proposal Viewer parity with static proposal indexes

Status: PASS  
Date: 2026-05-17

## Summary

SpecSpace now exposes a readonly proposal index API and a GraphSpace Proposal Viewer utility panel. The surface combines static SpecGraph proposal artifacts with optional local proposal markdown metadata, so static HTTP deployments can browse proposal state without requiring a local SpecGraph checkout.

## Outputs

- `GET /api/v1/proposals`
- Static proposal artifact aggregation for:
  - `proposal_spec_trace_index.json`
  - `proposal_lane_overlay.json`
  - `proposal_runtime_index.json`
  - `proposal_promotion_index.json`
- Optional local `docs/proposals/*.md` metadata enrichment.
- `graphspace/src/shared/proposal-viewer-contract/` parser/schema.
- GraphSpace Proposal Viewer utility panel with status, authority lane, runtime state, and affected spec filters.
- Graph-aware affected-spec links through the existing Spec ID resolver.

## Boundaries

The Proposal Viewer is readonly. It does not mutate proposal state, promote proposal material, execute SpecPM packages, or treat proposal artifacts as canonical graph authority.

## Next

The next parity task is `CTXB-P13-T6`: Metrics screen parity using existing metrics artifacts.
