# CTXB-P7-T2 SpecGraph Surfaces API Validation Report

Date: 2026-05-14

## Verdict

PASS

## Scope

- Extracted SpecGraph viewer-surface HTTP handlers into `viewer/specgraph_surfaces_api.py`.
- Moved graph dashboard, backlog projection, recent runs, spec activity, implementation work, metrics surfaces, spec overlay, and viewer-surfaces build handlers out of `ViewerHandler`.
- Kept capability checks stable by binding `_runs_dir`, `_graph_dashboard_path`, and `_viewer_surfaces_build_available` onto `ViewerHandler`.

## Quality Gates

- `python -m py_compile viewer/server.py viewer/specgraph_surfaces_api.py viewer/specgraph_api.py viewer/conversation_api.py viewer/file_api.py viewer/http_response.py viewer/request_query.py viewer/routes.py`: passed
- `python -m pytest tests/test_graph_dashboard.py tests/test_graph_backlog_projection.py tests/test_metrics_surfaces.py tests/test_specgraph_surfaces.py tests/test_supervisor_build.py tests/test_routes.py`: 176 passed
- `make lint`: passed
- `python -m pytest tests/`: 516 passed
