# CTXB-P2R-T5 — Migrate sidebar to React component

## Objective Summary

Convert the sidebar (workspace path, file list, refresh button, collapse toggle) to a React component. Fetch file list from `/api/files`. Persist collapse state via sessionStorage.

## Deliverables

1. `Sidebar.tsx` — sidebar component with workspace info, file list, and collapse toggle.
2. App layout updated with CSS grid (sidebar + graph).
3. File list items show name, kind badge, size.
4. Collapse toggle persists via sessionStorage.

## Acceptance Criteria

1. Sidebar renders workspace info and file list.
2. Click-to-select files triggers a callback.
3. Collapse toggle works and persists across refresh via sessionStorage.
4. TypeScript compiles with zero errors.
