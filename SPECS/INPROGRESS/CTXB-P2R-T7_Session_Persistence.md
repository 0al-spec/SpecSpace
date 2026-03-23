# CTXB-P2R-T7 — Restore session persistence and graph context

## Objective Summary

Persist and restore selected conversation, selected message, expanded nodes, and sidebar collapse state across page reload using sessionStorage.

## Technical Approach

- Create `useSessionState.ts` hook that wraps `useState` with sessionStorage serialization.
- Persist: `selectedConversationId`, `selectedMessageId`, `expandedNodes` (as JSON array), sidebar collapse (already done in Sidebar.tsx).
- On mount, read from sessionStorage and restore state.
- Graceful fallback: if conversation no longer exists in API response, clear selection.
- Viewport persistence via React Flow's `onMoveEnd` → save viewport, `defaultViewport` → restore.

## Acceptance Criteria

1. Reload restores selected conversation, checkpoint, expanded nodes, and viewport.
2. If referenced objects no longer exist, falls back gracefully.
