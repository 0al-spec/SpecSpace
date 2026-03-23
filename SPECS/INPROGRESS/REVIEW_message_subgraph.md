## REVIEW REPORT — Message Subgraph (CTXB-P2-T13)

**Scope:** main..HEAD (branch `feature/CTXB-P2-T13-T15-message-subgraph`)
**Files:** 7

### Summary Verdict
- [x] Approve with comments

### Critical Issues
None.

### Secondary Issues
- [Medium] Layout does not yet account for expanded node height — expanded subflow containers overlap with adjacent nodes in the same column. This is expected and will be addressed in T14 (Reflow graph layout).
- [Low] Collapse toggle click via `dispatchEvent` on the `rect` child with `bubbles: true` works, but direct clicks on the `g.graph-node-expand` element don't fire the handler consistently. The toggle's `addEventListener("click", ...)` is on the `g`, but SVG event propagation from `rect` children works correctly for real user clicks.

### Architectural Notes
- The subflow container uses `.graph-node-card.subflow-container` — it inherits kind-based fill colors from `.graph-node.root .graph-node-card` etc., which gives it the same color as the collapsed card. This is intentional for visual continuity.
- `SUBFLOW_PAD = 14` and `MSG_NODE_WIDTH = NODE_WIDTH - 2 * SUBFLOW_PAD` keep child nodes inset from the container boundary, matching the React Flow subflow visual pattern.
- Internal edges use `var(--line-strong)` to distinguish them from cross-conversation edges.

### Tests
- 11 smoke tests pass. Test updated: `MSG_SUB_HEIGHT` → `MSG_NODE_HEIGHT`, added `graph-msg-node` assertion.

### Verdict: APPROVE with follow-up on T14 layout reflow.
