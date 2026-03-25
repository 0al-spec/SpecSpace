## REVIEW REPORT — Expose compile results and artifact locations (CTXB-P4-T4)

**Scope:** feature/CTXB-P4-T3..HEAD (CTXB-P4-T4 only)
**Files:** 3 changed (types.ts, InspectorOverlay.tsx, InspectorOverlay.css)

### Summary Verdict
- [x] Approve with comments

### Critical Issues

None.

### Secondary Issues

- [Medium] **Compile section always visible when target is set, even when inspector is for a different conversation.** If the user selects conversation A but the compile target is conversation B, the compile section still shows at the bottom of the inspector. This is intentional (users can compile from anywhere), but may confuse users who expect the compile button to relate to what they're currently inspecting. A small "Compiling: {target_id}" label was added, which helps. No change needed but worth documenting.

- [Low] **`navigator.clipboard` may be undefined in older browsers.** The `?.writeText(...)` optional chain handles the API absence silently but the button stays active and appears to do nothing. Consider adding a visual fallback (e.g., select-all text input) or at least a title that says "Copy path (requires modern browser)". Not a blocker.

- [Low] **`CompileSuccess.exit_code` is typed as the literal `0`.** This is semantically accurate but makes the union discriminant the `status` field anyway. The exit code literal type adds no runtime value. Minor type clarity issue — no fix needed.

### Architectural Notes

- The `CompileResult` union type (`CompileSuccess | CompileFailure`) discriminated on `status: "ok" | "error"` is clean and maps well to the server's response shape.
- Resetting `compileResult` on compile target change (via `useEffect`) correctly prevents stale results.
- The compile section is decoupled from the conversation/checkpoint detail sections — it stands on its own at the bottom of the inspector, which is the right pattern since it acts on a global state (`compileTargetConversationId`), not on the currently selected node.

### Tests

- No new automated tests for the UI layer (React components). This is acceptable for the current phase since the project doesn't have a React testing setup.
- The `/api/compile` endpoint was fully tested in T3. T4 adds only frontend code.
- All 92 Python tests continue to pass.

### Next Steps

- CTXB-P4-T5: preserve provenance from compiled artifact back to graph selection.
- Consider adding a React component test layer in Phase 5 (CTXB-P5-T3 partially covers this).
- No FOLLOW-UP tasks required from this review.
