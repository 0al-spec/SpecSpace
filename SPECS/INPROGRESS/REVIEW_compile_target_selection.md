## REVIEW REPORT — compile_target_selection

**Scope:** main..HEAD (feature/CTXB-P3-T4-select-compile-target)
**Files:** 11 changed (10 viewer/app/src/*, 1 new CompileTargetContext.ts)

### Summary Verdict
- [ ] Approve
- [x] Approve with comments
- [ ] Request changes
- [ ] Block

---

### Critical Issues

None.

---

### Secondary Issues

**[Medium] Checkpoint "ACTIVE COMPILE TARGET" badge shown only when `compile_target` field present**

In `InspectorOverlay.tsx`, the badge is guarded by `checkpointDetail.compile_target &&`. However, the backend `/api/checkpoint` endpoint already always returns a `compile_target` object (per CTXB-P3-T3). The guard works correctly in practice but is misleading — it looks like the badge might silently not appear if the field is missing for some reason. If it's expected to always be present, the `compile_target?` optional field on `CheckpointDetail` is technically correct but the UI silently hides the badge rather than showing an error state.

*Fix suggestion:* No immediate change needed. If a future task removes `compile_target` from the checkpoint response, the badge will silently vanish rather than breaking. Add a note in CTXB-P4-T1 to ensure the field is always populated.

**[Low] Trailing empty string in class list when `isCompileTarget` is false**

`${isCompileTarget ? "compile-target" : ""}` appends a trailing space to the className when false. This is harmless in browsers but creates class names like `"conversation-node root "` with a trailing space. Minor cleanliness issue.

*Fix suggestion:* Use `[..., isCompileTarget && "compile-target"].filter(Boolean).join(" ")` or a className utility. Not blocking.

**[Low] Context reads in every ReactFlow node render**

`ConversationNode`, `ExpandedConversationNode`, and `MessageNode` each call `useContext(CompileTargetContext)` on every render. Since the context value changes only when the user sets a compile target, this should be acceptable, but React will re-render all node instances when the context value changes (even nodes that are not the compile target). With large graphs this could cause many node re-renders on every compile target change.

*Fix suggestion:* For v1 graph sizes this is fine. In a future optimization task, consider `React.memo` on node components or splitting the context into smaller pieces. Log as a performance note for Phase 5 hardening.

---

### Architectural Notes

1. **Context pattern is correct for this use case.** Using `CompileTargetContext` avoids polluting node `data` with UI-selection state, keeping data and presentation concerns separate. ReactFlow node components can safely consume React context.

2. **Serialization contract is sound.** The compile target state is stored as `{ conversation_id: string | null, message_id: string | null }` — exactly the signature that `build_compile_target()` accepts, making CTXB-P4-T1 straightforward.

3. **Button placement at conversation vs checkpoint level is semantically correct.** Conversation-level setting produces scope "conversation" (compile from last checkpoint); checkpoint-level setting produces scope "checkpoint" (compile up to a specific message). This matches the existing API contract.

4. **No backend changes.** The change is entirely frontend — appropriate for a "user selects a UI state" task. The backend already had the correct data model.

---

### Tests

- 61 existing tests pass. No new unit tests added.
- The feature is UI-only (sessionStorage state + React context + CSS classes). Manual testing is the appropriate verification method for this change.
- No regression coverage gap introduced: the compile target state does not affect any server-side logic.

---

### Next Steps

- CTXB-P4-T1 (Export selected graph nodes) can now read `compileTargetConversationId` and `compileTargetMessageId` from sessionStorage (`ctxb_compile_target_conversation_id`, `ctxb_compile_target_message_id`) to determine what to export.
- Consider adding a "Clear compile target" button or allowing re-click to deselect (currently clicking the active target button re-sets it to itself, which is idempotent but has no deselect path). Low priority for v1.
- The `[Low]` trailing space in className is a nit — can be cleaned up in a future pass.
