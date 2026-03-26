# CTXB-P2R-B6 — Selecting a conversation node or message subnode does not populate the right inspector

## Problem

Clicking a conversation node or message sub-node on the graph canvas does not always populate the right-side inspector panel. The inspector panel slides in (becomes visible) but remains empty — no conversation detail, no lineage, no checkpoint information.

## Root Cause Analysis

Three interacting defects contribute to this bug:

1. **Stale sessionStorage selection**: `useSessionString` persists `selectedConversationId` across page reloads. When the backing data changes (different `--dialog-dir`, data refresh), the stored ID no longer exists in the graph. The inspector opens (because the stored value is truthy) but the `/api/conversation` call returns 404, setting `convDetail` to `null`. The panel is visible but empty.

2. **Silent API error handling**: In `InspectorOverlay.tsx`, non-OK API responses are swallowed — `.then((r) => (r.ok ? r.json() : null))` silently sets state to `null`. No error message is shown to the user; the inspector is visible but blank.

3. **Hidden inspector intercepts pointer events**: The inspector overlay is `position: fixed` with `z-index: 20` and slides off-screen via `transform: translateX(100%)` when hidden. However, there is no `pointer-events: none` on the hidden state, which can interfere with click propagation on the graph canvas on some viewports/browsers.

## Fix Plan

### Fix 1: Invalidate stale selection when graph data changes (`App.tsx`)

When the graph finishes loading, check whether `selectedConversationId` still exists among the graph node IDs. If not, clear both `selectedConversationId` and `selectedMessageId`.

### Fix 2: Show error/empty state in inspector (`InspectorOverlay.tsx`)

When the API call finishes and `convDetail` is `null` (either from a 404 or network error), display a user-facing message: "Conversation not found. Click a node to select." Also clear the selection after a brief display so the inspector auto-dismisses.

### Fix 3: Disable pointer events on hidden inspector (`InspectorOverlay.css`)

Add `pointer-events: none` to `.inspector-overlay` and `pointer-events: auto` to `.inspector-overlay.visible`.

## Files to Change

- `viewer/app/src/App.tsx` — Add stale selection invalidation effect
- `viewer/app/src/InspectorOverlay.tsx` — Add error state UI and auto-clear
- `viewer/app/src/InspectorOverlay.css` — Add pointer-events toggle

## Acceptance Criteria

- Clicking a conversation node populates the inspector with conversation detail (title, kind, parent/child edges, checkpoints).
- Clicking a message sub-node populates the inspector with checkpoint detail.
- Inspector content updates on every subsequent selection.
- Deselecting clears or retains the last selection gracefully (no blank flash).
- Stale sessionStorage values are cleared when the graph data does not contain the stored ID.
- When the API returns an error, the inspector shows a descriptive message instead of a blank panel.

## Dependencies

- CTXB-P2R-T6 (already completed)
