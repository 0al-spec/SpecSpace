# CTXB-P13-T5 — Start Proposal Viewer parity with static proposal indexes

## Summary

Start SpecSpace Proposal Viewer parity by exposing a readonly proposal index that
combines existing static SpecGraph proposal artifacts and rendering it in
GraphSpace as a browseable utility panel.

## Deliverables

- Add a SpecSpace API v1 proposal viewer read model endpoint.
- Combine these static artifacts when available:
  - `proposal_spec_trace_index.json`
  - `proposal_lane_overlay.json`
  - `proposal_runtime_index.json`
  - `proposal_promotion_index.json`
- Include local proposal markdown metadata when a local SpecGraph checkout is
  configured, without requiring it for static/HTTP deployments.
- Add GraphSpace contract parsing, data hook, and Proposal Viewer utility panel.
- Allow filtering proposal entries by status, authority lane, runtime state, and
  affected spec query.
- Keep Spec ID links graph-aware via the existing resolver.

## Acceptance Criteria

- `GET /api/v1/proposals` returns a structured readonly proposal index for file
  and HTTP artifact providers.
- Missing optional proposal artifacts degrade to empty source summaries instead
  of failing the whole endpoint.
- The GraphSpace sidebar exposes a Proposal Viewer panel separate from the
  legacy proposal trace panel.
- Proposal entries expose clickable affected spec ids through the existing
  graph-aware Spec ID resolver.
- Backend and GraphSpace tests cover the read model and UI contract.

## Validation Plan

- `python -m pytest tests/test_specspace_api_v1.py -q`
- `make lint`
- `npm test --prefix graphspace`
- `npm run build --prefix graphspace`
- `npm run lint:fsd --prefix graphspace`
