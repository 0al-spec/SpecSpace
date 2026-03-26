# CTXB-P3-T5 — Re-index and reconcile external file changes

**Status:** In Progress
**Priority:** P1
**Dependencies:** CTXB-P1-T4 (✅), CTXB-P2-T1 (✅)
**Branch:** `feature/CTXB-P3-T5-reindex-external-changes`

## Problem Statement

When an external agent or tool adds, edits, or deletes `.json` files in the workspace directory, those changes are invisible to the user until the app is restarted. The sidebar's existing "Refresh workspace" button refreshes the file list, but the graph canvas continues to show stale data because the graph fetch is not triggered. Deleted or renamed conversations can leave dangling selections in the inspector.

## Deliverables

1. **Unified refresh**: clicking "Refresh workspace" in the sidebar re-fetches both the file list (`/api/files`) and the graph (`/api/graph`) atomically so both panels are consistent after one click.
2. **Stale selection guard**: after a graph refresh, any selected `conversationId` that no longer exists in the new graph data is automatically cleared (this logic already exists in `App.tsx` and must remain intact through this change).
3. **Automated tests** covering the server-side re-indexing behaviour:
   - Newly added files appear in `/api/files` and `/api/graph` without a server restart.
   - Deleted files disappear from both endpoints after the next request.
   - Modified files (content change) are reflected in the next response.

## Architecture

### Current state

| Component | Fetch behaviour |
|---|---|
| `Sidebar.tsx` | Calls `/api/files` on mount and on "Refresh workspace" button click |
| `useGraphData.ts` | Calls `/api/graph` on mount; exposes `refresh` callback |
| `App.tsx` | Passes `refresh` to `InspectorOverlay` (for post-write/delete refresh), but not to `Sidebar` |
| `server.py` | `collect_workspace_listing()` re-reads disk on every call — no caching |

### Change

Add `onRefresh?: () => void` prop to `Sidebar`. When the "Refresh workspace" button is clicked, call `fetchFiles()` AND `onRefresh()`. In `App.tsx` pass the graph `refresh` function as `onRefresh` to `Sidebar`.

No server-side changes are needed: the server already re-reads the workspace directory on every API request.

## Acceptance Criteria

- [ ] Clicking "Refresh workspace" in the sidebar updates both the file list and the graph canvas.
- [ ] After a refresh, a conversation that was deleted externally is no longer visible in the graph, and its inspector is dismissed if it was open.
- [ ] Newly added files appear in the sidebar file list and as graph nodes after a refresh.
- [ ] Modified files (e.g. title change) are reflected in graph nodes after a refresh.
- [ ] All existing tests continue to pass.
- [ ] New tests cover: file addition visible after re-index, file deletion visible after re-index, file modification visible after re-index.
- [ ] Satisfies PRD FR-10 (re-index on demand) and NFR-8 (no server restart required).

## Implementation Plan

1. `viewer/app/src/Sidebar.tsx`: add `onRefresh?: () => void` to `SidebarProps`; call it from the refresh button `onClick` alongside `fetchFiles`.
2. `viewer/app/src/App.tsx`: pass `refresh` (from `useGraphData`) as `onRefresh` prop to `<Sidebar>`.
3. `tests/test_reindex.py`: new test module with integration tests using a live `ThreadingHTTPServer` pointed at a temp directory.

## Test Plan

| Test | Method |
|---|---|
| File added externally appears in `/api/files` response | Write file to temp dir after server start; GET `/api/files`; assert file present |
| File added externally appears in `/api/graph` response | Same setup; GET `/api/graph`; assert node present |
| File deleted externally disappears from `/api/files` | Delete file from temp dir; GET `/api/files`; assert file absent |
| File deleted externally disappears from `/api/graph` | Delete file; GET `/api/graph`; assert node absent |
| File modified externally reflects new content | Overwrite file; GET `/api/graph`; assert updated title |
