# CTXB-P10-T11 — Focus canvas on selected SpecGraph node

## Status

INPROGRESS

## Context

The Sidebar navigator can select nodes, but the canvas currently remains at its
existing viewport. For graph review, selection should keep the graph, Sidebar,
and Inspector aligned around the same node.

## Deliverables

- Center the React Flow viewport when `selectedNodeId` changes.
- Keep canvas click selection and pane clear behavior intact.
- Add deterministic focus point coverage.

## Acceptance Criteria

- Sidebar selection pans/zooms the canvas toward the selected node.
- Canvas node click still opens the Spec Inspector.
- Pane click and Inspector close still clear selection.
- Stale selected ids do not throw or create viewport churn.

## Validation Plan

- Run `npm test`.
- Run `npm run build`.
- Run `npm run lint:fsd`.
- Browser-smoke Sidebar selection and canvas selection at `http://localhost:5173/`.
