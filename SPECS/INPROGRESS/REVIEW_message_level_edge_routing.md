## REVIEW REPORT — message_level_edge_routing

**Scope:** main..HEAD (branch feature/CTXB-P2R-T11-message-level-edges)
**Files:** 4 (useGraphData.ts, MessageNode.tsx, SubflowHeader.tsx, MessageNode.css)

### Summary Verdict
- [x] Approve
- [ ] Approve with comments
- [ ] Request changes
- [ ] Block

### Critical Issues
None.

### Secondary Issues

- **[Low] MessageNode now has 4 handles**: Adding `left` (target) and `right` (source) handles to every message node increases DOM complexity. When no cross-conversation edges use these handles, they're invisible but still in the DOM. This is fine for current scale (2–20 messages), but worth documenting.

- **[Low] `sourceHandle`/`targetHandle` are `undefined` when not expanded**: React Flow handles `undefined` handle IDs correctly (falls back to default handle selection), but it would be cleaner to explicitly specify `"right"` for all source handles on conversation nodes too, for consistency. Not urgent.

- **[Nit] `msgToNodeId` second loop through nodes**: The lookup map is built by iterating `apiGraph.nodes` a second time after the first loop that builds allNodes. This is O(n) and fine for typical graph sizes (<100 conversations), but could be merged into the first loop for micro-optimization.

### Architectural Notes

- The `msgToNodeId` Map approach is clean: it only populates entries for expanded conversations, so collapsed conversations naturally fall through to the conversation-level ID fallback.

- The approach of routing to the subflow header (`{conv_id}-header`) rather than the first message node for the target is correct — the header semantically represents the conversation entry point, has Left/Right handles in the horizontal flow direction, and avoids edge routing through the group container.

- Handle IDs (`"left"`, `"right"`, `"top"`, `"bottom"`) added to all relevant nodes make future edge routing explicit and predictable.

### Tests
- All 45 tests pass.
- Edge routing verified via DOM path analysis: cross-conversation edges originate at x≈237 (right handle of message nodes), internal edges use x≈124 (center/top-bottom handles).

### Next Steps
- No actionable follow-up items. FOLLOW-UP skipped.
- Phase 2R is now complete. All tasks (T7–T9, B1, T10, T11) are archived as PASS.
- Next phase: CTXB-P3 — Authoring and Compile Target Selection.
