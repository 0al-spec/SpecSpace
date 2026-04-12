# CTXB-P7-T10 — Add React Error Boundaries

**Status:** In Progress  
**Priority:** P1  
**Date:** 2026-04-12

---

## Problem

There are no `ErrorBoundary` components in the React app. A runtime error in any component crashes the entire UI to a blank white screen with no recovery path.

---

## Deliverables

| Artifact | Description |
|----------|-------------|
| `viewer/app/src/ErrorBoundary.tsx` | Reusable class-based React error boundary with fallback UI and Retry button |
| `viewer/app/src/App.tsx` | Error boundaries applied at 3 locations |

### Boundary Locations

1. **Top-level** — wraps `<AppInner />` in `App()`, catches any unprotected component crash.
2. **Inspector panels** — wraps `<SpecInspector>` and `<InspectorOverlay>` individually; errors in inspectors don't crash the graph canvas.
3. **ReactFlow canvas** — wraps `<ReactFlow>` and its children; canvas errors don't crash the inspectors.

---

## Acceptance Criteria

| AC | Description |
|----|-------------|
| AC1 | A thrown error inside `SpecInspector` shows the fallback UI without crashing the graph canvas. |
| AC2 | A thrown error inside `InspectorOverlay` shows the fallback UI without crashing the graph canvas. |
| AC3 | The Retry button resets the error boundary state (clears `hasError`). |
| AC4 | The top-level boundary catches errors from any unprotected component. |
| AC5 | All existing tests pass. |
| AC6 | `make lint` passes. |

---

## Implementation Notes

- `ErrorBoundary` is a React class component (error boundaries cannot be function components).
- Props: `children: React.ReactNode`, optional `label?: string` for the error message.
- State: `{ hasError: boolean; error: Error | null }`.
- `static getDerivedStateFromError(error)` — sets `hasError: true`.
- `componentDidCatch(error, info)` — logs to console.
- Fallback renders a `<div>` with: label, error message snippet, and a Retry button.
- Retry button calls `this.setState({ hasError: false, error: null })`.

---

## Dependencies

None (no dependency on prior P7 tasks).
