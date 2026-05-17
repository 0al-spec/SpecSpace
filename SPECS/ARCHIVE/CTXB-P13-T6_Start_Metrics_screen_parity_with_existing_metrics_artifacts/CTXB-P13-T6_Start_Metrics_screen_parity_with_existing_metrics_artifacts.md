# CTXB-P13-T6 — Start Metrics screen parity with existing metrics artifacts

## Summary

Start SpecSpace Metrics screen parity by exposing a readonly metrics index that
combines existing static SpecGraph metrics artifacts and rendering it in
GraphSpace as a browseable utility panel.

## Deliverables

- Add a SpecSpace API v1 metrics read model endpoint.
- Combine these static artifacts when available:
  - `graph_dashboard.json`
  - `metrics_source_promotion_index.json`
  - `metrics_delivery_workflow.json`
  - `metrics_feedback_index.json`
  - `metric_pack_adapter_index.json`
  - `metric_pack_runs.json`
  - `metric_signal_index.json`
- Add source diagnostics for missing optional artifacts without failing the
  whole endpoint.
- Add GraphSpace contract parsing, data hook, and Metrics utility panel.
- Allow filtering metric entries by category, status, and reference query.
- Link referenced Spec IDs through the existing graph-aware Spec ID resolver.

## Acceptance Criteria

- `GET /api/v1/metrics` returns a structured readonly metrics index for file
  and HTTP artifact providers.
- Existing metrics artifacts are visible from SpecSpace without switching to
  the legacy viewer.
- Missing optional metrics artifacts degrade as diagnostics, not broken app
  state.
- Metrics entries can expose clickable spec references where source refs exist.
- Backend and GraphSpace tests cover the read model and UI contract.

## Validation Plan

- `python -m pytest tests/test_specspace_api_v1.py -q`
- `python -m mypy viewer/`
- `make lint`
- `npm test --prefix graphspace -- metrics-index metrics-filters`
- `npm test --prefix graphspace`
- `npm run lint:fsd --prefix graphspace`
- `npm run build --prefix graphspace`
