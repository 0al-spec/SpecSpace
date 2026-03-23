## REVIEW REPORT — Edge Routing (CTXB-P2-T15)

**Scope:** main..HEAD (branch `feature/CTXB-P2-T13-T15-message-subgraph`)
**Files:** 1 (viewer/index.html)

### Summary Verdict
- [x] Approve

### Critical Issues
None.

### Secondary Issues
None.

### Architectural Notes
- `messageAnchorY` does a linear scan of `node.checkpoints` to find the message. With typical conversation sizes (<100 messages), this is negligible.
- Child edge anchoring defaults to the first message node — this is a reasonable heuristic since child conversations start from the parent's fork point.
- The implementation gracefully falls back to `edgeAnchorY` when the message is not found or the node is collapsed.

### Tests
- 11 smoke tests pass.

### Verdict: APPROVE
