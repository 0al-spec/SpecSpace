# CTXB-P2R-T10 — Fix Expand/Collapse Button Position

**Status:** In Progress
**Priority:** P2
**Branch:** feature/CTXB-P2R-T10-expand-button-position
**Dependencies:** CTXB-P2R-T8

---

## Problem

The expand/collapse button for conversation nodes is visually unstable:
- **Collapsed state** (`ConversationNode`): button is positioned at `bottom: 8px; left: 50%` — bottom center of the card
- **Expanded state** (`SubflowHeader`): button is a flex sibling of the title text at the top-left of the subflow header

This causes the button to "jump" between positions as the node switches between collapsed and expanded states.

---

## Goal

Place the expand/collapse button in a **fixed, consistent position** (top-right corner of the node/header) for both states.

---

## Design Decision

- **Collapsed card** (`ConversationNode`): button at `position: absolute; top: 8px; right: 8px`
- **Expanded header** (`SubflowHeader`): button at `position: absolute; top: 4px; right: 8px`
- Warning badge (broken lineage) moves to `top: 8px; right: 36px` to avoid overlap with button
- Button size: `22×22px` (slightly more compact, fits top-right corner better)

---

## Deliverables

1. `viewer/app/src/ConversationNode.css` — update `.conversation-node-expand` to top-right absolute
2. `viewer/app/src/ConversationNode.css` — update `.conversation-node-warning` to avoid overlap
3. `viewer/app/src/SubflowHeader.css` — add absolute positioning for `.conversation-node-expand` in subflow header context
4. `SPECS/INPROGRESS/CTXB-P2R-T10_Validation_Report.md` — validation report

---

## Acceptance Criteria

- Expand button appears in the top-right corner of the collapsed `ConversationNode` card
- Collapse button appears in the top-right corner of the expanded `SubflowHeader`
- No visual overlap between the button and the broken-lineage warning badge
- Button size and style remain consistent (same pill/circle shape, same colors)
- All 45 tests pass; no TypeScript errors
