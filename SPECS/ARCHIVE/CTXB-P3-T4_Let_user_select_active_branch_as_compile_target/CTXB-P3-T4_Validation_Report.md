# Validation Report — CTXB-P3-T4

**Task:** Let the user select the active branch as a compile target
**Date:** 2026-03-25
**Verdict:** PASS

---

## Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Tests | `make test` | PASS — 61 tests, 0 failures |
| Lint | `make lint` | PASS — no errors |
| Type check | `npx tsc --noEmit` | PASS — no type errors |

---

## Acceptance Criteria

- [x] The user can click "Set as Compile Target" on any conversation node in the inspector.
  - Button added in InspectorOverlay conversation section.
- [x] The user can click "Set as Compile Target" on any checkpoint (message node) in the inspector.
  - Button added in InspectorOverlay checkpoint section.
- [x] The selected compile target persists across page refresh (sessionStorage).
  - `useSessionString("compile_target_conversation_id")` and `useSessionString("compile_target_message_id")` in App.tsx persist via sessionStorage with `ctxb_` prefix.
- [x] The graph canvas shows a distinct visual marker on the node that is the active compile target.
  - `.compile-target` CSS class added to ConversationNode, ExpandedConversationNode, MessageNode via `CompileTargetContext`.
  - Renders an amber ring (`box-shadow: 0 0 0 3px #d97706`) and a `◎` badge on conversation nodes.
- [x] The compile target is unambiguous: only one conversation+message pair can be the active compile target at any time.
  - Single `compileTargetConversationId` + `compileTargetMessageId` state pair.
- [x] The compile target state is serializable: `{ conversation_id, message_id | null }`.
  - Stored as separate session keys, directly consumable by CTXB-P4-T1.
- [x] Existing graph interaction (click to view, expand/collapse) is unaffected.
  - Compile target state is separate from `selectedConversationId`/`selectedMessageId`.
- [x] All existing tests pass.
  - 61 tests pass.
- [x] PRD FR-11 satisfied: "The user must be able to choose a compile target from the graph."

---

## Files Changed

| File | Change |
|------|--------|
| `viewer/app/src/CompileTargetContext.ts` | New — React context for compile target state |
| `viewer/app/src/App.tsx` | Added compile target session state, `setCompileTarget` callback, context provider, props to InspectorOverlay |
| `viewer/app/src/InspectorOverlay.tsx` | Added compile target props, "Set as Compile Target" buttons (conversation + checkpoint levels), "ACTIVE COMPILE TARGET" badge |
| `viewer/app/src/InspectorOverlay.css` | Added `.inspector-compile-target-active`, `.inspector-compile-target-btn`, `.inspector-compile-target-btn.active` styles |
| `viewer/app/src/ConversationNode.tsx` | Use CompileTargetContext to apply `.compile-target` class |
| `viewer/app/src/ExpandedConversationNode.tsx` | Use CompileTargetContext to apply `.compile-target` class |
| `viewer/app/src/MessageNode.tsx` | Use CompileTargetContext to apply `.compile-target` class |
| `viewer/app/src/ConversationNode.css` | Added amber ring + `◎` badge for `.compile-target` |
| `viewer/app/src/ExpandedConversationNode.css` | Added amber ring for `.compile-target` |
| `viewer/app/src/MessageNode.css` | Added amber ring for `.compile-target` |

---

## Notes

- The compile target button at conversation level sets scope: `{ convId, msgId: null }` matching `build_compile_target()` scope "conversation".
- The compile target button at checkpoint level sets scope: `{ convId, msgId }` matching `build_compile_target()` scope "checkpoint".
- No backend changes required — the API already returns full `compile_target` metadata for both conversation and checkpoint endpoints.
- The `ACTIVE COMPILE TARGET` badge in the inspector is shown only when the checkpoint `compile_target` field is available from the API response. The `CheckpointDetail` interface has been updated to include optional `compile_target`.
