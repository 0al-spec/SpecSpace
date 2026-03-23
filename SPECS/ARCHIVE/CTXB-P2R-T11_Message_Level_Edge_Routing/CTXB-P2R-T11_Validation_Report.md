# Validation Report — CTXB-P2R-T11: Message-Level Edge Routing

**Date:** 2026-03-24
**Task:** CTXB-P2R-T11 — Route cross-conversation edges to message-level nodes
**Branch:** feature/CTXB-P2R-T11-message-level-edges
**Verdict:** PASS

---

## Changes Implemented

### 1. `viewer/app/src/useGraphData.ts`
- Added `msgToNodeId: Map<string, string>` — maps `message_id` → message node ID for all expanded conversations
- For cross-conversation edges:
  - **Source**: when parent is expanded → routes from `{conv_id}-msg-{idx}` (the specific checkpoint message) with `sourceHandle="right"`
  - **Target**: when child is expanded → routes to `{conv_id}-header` (subflow header) with `targetHandle="left"`
  - Fallback to conversation-level IDs when not expanded (unchanged behavior)

### 2. `viewer/app/src/MessageNode.tsx`
- Added IDs to all handles: `top`, `bottom`, `left`, `right`
- Added Left target handle and Right source handle for cross-conversation edge connections
- Internal subflow edges continue using `top`/`bottom` handles; cross-conversation edges use `right`/`left`

### 3. `viewer/app/src/SubflowHeader.tsx`
- Added `id="left"` to target handle and `id="right"` to source handle for explicit handle selection

### 4. `viewer/app/src/MessageNode.css`
- Added `transition: opacity 0.15s` for smooth handle reveal on hover
- Adjusted hover opacity from `1` to `0.7` for subtler interaction

---

## Verification

**Edge path analysis (DOM inspection with all 3 conversations expanded):**

| Edge | Start X | Interpretation |
|------|---------|----------------|
| Root's msg-root-2 → Branch header | x≈237 | Right handle of message node (14 + 220 + 3 = 237) ✅ |
| Branch's msg-branch-2 → Merge header | x≈237 | Right handle of message node ✅ |
| Root's msg-root-2 → Merge header | x≈237 | Right handle of message node ✅ |
| Internal: msg-0 → msg-1 | x≈124 | Center top/bottom handle (14 + 220/2 = 124) ✅ |

Cross-conversation edges correctly route from the right handle of the specific branching message to the left handle of the child conversation's subflow header.

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `python3 -m pytest tests/ -q` | ✅ 45 passed |
| TypeScript | `npx tsc --noEmit` | ✅ No errors |
