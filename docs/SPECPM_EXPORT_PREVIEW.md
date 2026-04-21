# SpecPM Export Preview — integration plan

Reviewable preview of a SpecGraph → SpecPM export boundary, shown inside the ContextBuilder viewer. Read-only: no write-back to SpecPM.

## Upstream surface (SpecGraph)

- Builder: `python3 {SPECGRAPH}/tools/supervisor.py --build-specpm-export-preview`
- Output: `{SPECGRAPH}/runs/specpm_export_preview.json`
- Status is intentionally `draft_preview_only` — downstream RFC in SpecPM is still draft.

## Backend (viewer/server.py)

New CLI flag:

- `--specgraph-dir` — path to the SpecGraph repo root. When absent, preview endpoints return 503 and the capability flag is false.

New routes:

- `GET  /api/specpm/preview`       — read `{SPECGRAPH}/runs/specpm_export_preview.json`, return as-is with `mtime`.
- `POST /api/specpm/preview/build` — run `supervisor.py --build-specpm-export-preview` (subprocess, 60s timeout, `invoke_hyperprompt` pattern). Returns `{exit_code, stderr_tail, preview_path, built_at}`.

Capability flag:

- `/api/capabilities` gains `specpm_preview: bool`.

## Frontend

- New action in `PanelActions` inside `SpecInspector` — icon button "Preview for SpecPM" (disabled when capability false).
- New overlay component `SpecPMExportPreview.tsx`, mounted like `SpecLens` (fixed, top-level) from `App.tsx`.
- Loads `GET /api/specpm/preview`. If 404/stale → CTA "Build preview" → `POST .../build` → refetch.
- Layout: left — export entries list with badges (`export_status`, `review_state`, `consumer_bridge_state`); right — `package_preview`, `boundary_source_preview`, `missing_fields_for_full_boundary_spec`, `next_gap`.

## Explicitly out of scope (for now)

- No "Export to SpecPM" button.
- No write to `/SpecPM`.
- No import flow from SpecPM.
- No per-node filtering of entries — overlay shows all entries from the preview.

## Commit plan

1. Backend: CLI flag, 2 routes, capability flag.
2. Frontend: minimal JSON viewer + Rebuild button wired through `PanelActions`.
3. Frontend: structured list/detail UI with badges.
