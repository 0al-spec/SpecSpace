# CTXB-P4-T4 — Expose Compile Results and Artifact Locations

**Status:** IN PROGRESS
**Priority:** P0
**Phase:** 4 — Compile Pipeline
**Dependencies:** CTXB-P4-T3

---

## Description

Show compile status, output paths, and failure details in the InspectorOverlay so the user can immediately use the generated context artifact with an external agent.

The user must be able to:
1. Click a "Compile" button in the inspector for the active compile target.
2. See compile progress (in-flight spinner).
3. On success: see the path to `compiled.md` and `manifest.json` with a copy-to-clipboard button.
4. On failure: see the exit code and stderr/error message directly in the inspector.
5. Re-run compile at any time.

---

## Deliverables

1. **`viewer/app/src/InspectorOverlay.tsx`** — Compile button + result panel (success paths, failure diagnostics)
2. **`viewer/app/src/InspectorOverlay.css`** (or `theme.css`) — Styles for compile result panel
3. **`viewer/app/src/types.ts`** — `CompileResult` type

---

## UI Specification

### Compile Button
- Shown whenever a compile target is active (conversation or checkpoint scope).
- Label: "Compile" (idle) / "Compiling…" (in-flight) / "Compiled ✓" (success, then resets after 3 s)
- Positioned below the existing "Set as Compile Target" / "Compile Target ✓" button.

### Compile Result Panel (shown after compile attempt)
**Success:**
```
COMPILE RESULT
Exit code: 0

compiled.md  [copy path]
  /abs/path/to/export/.../compiled.md

manifest.json  [copy path]
  /abs/path/to/export/.../manifest.json
```

**Failure:**
```
COMPILE ERROR  (Exit code: 2)
Hyperprompt compiler failed: Syntax error

stderr:
<stderr content>
```

**Binary not found:**
```
COMPILE ERROR
Hyperprompt not found
/path/to/binary
```

---

## API

Calls `POST /api/compile` with `{conversation_id, message_id?}`.

The response shape (from CTXB-P4-T3):
- Success: `{ ..., compile: { compiled_md, manifest_json, exit_code, stdout, stderr } }`
- Failure: `{ ..., compile: { error, exit_code?, details?, stderr?, stdout? } }`

---

## Acceptance Criteria

- [ ] The user can find the generated `.hc` and compiled `.md` without manual filesystem inspection.
- [ ] Failed compiles show actionable diagnostics (exit code, stderr) instead of silent failure.
- [ ] The compile button is visible only when a compile target is set.
- [ ] In-flight state prevents double-clicks.
- [ ] The task satisfies PRD FR-15 and Flow D.

---

## Implementation Notes

- Keep the compile call inside `InspectorOverlay`; it has `compileTargetConversationId` and `compileTargetMessageId` in scope.
- A `CompileResult` union type (success | failure) keeps the rendering logic clean.
- No new API surface needed — `POST /api/compile` added in T3 is sufficient.
- "Copy path" uses `navigator.clipboard.writeText`; degrade gracefully if clipboard API is unavailable.
