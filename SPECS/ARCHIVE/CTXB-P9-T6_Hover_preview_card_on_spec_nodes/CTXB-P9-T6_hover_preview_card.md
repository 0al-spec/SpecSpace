# CTXB-P9-T6 - Hover preview card on spec nodes

## Summary

Add a lightweight hover preview for GraphSpace SpecGraph canvas nodes.

## Deliverables

- Preview model that derives display-ready text from `SpecNode` plus optional `/api/spec-node` detail.
- Viewport-safe placement helper for right/left/top/bottom positioning around a node.
- Hover preview UI that shows title, objective excerpt, status, maturity, and gap signal.
- Canvas integration with a 300ms intent delay and immediate dismissal on leave or click.

## Acceptance Criteria

- Hovering a node for at least 300ms shows the preview card.
- Moving off a node hides the preview immediately.
- Clicking a node still selects the node and dismisses the preview.
- The preview stays within viewport bounds and flips away from viewport edges.
- The objective text is limited to the first 80 visible characters.
- The preview does not add same-layer FSD dependencies between widgets.

## Stack Plan

1. Model and tests for preview content and viewport positioning.
2. Card UI and CSS module for the fixed-position preview surface.
3. Canvas wiring with hover delay, detail fetch, and validation report.
