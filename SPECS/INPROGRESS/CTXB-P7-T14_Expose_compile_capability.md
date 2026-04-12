# CTXB-P7-T14 — Expose compile capability in /api/capabilities and surface in UI

**Status:** In Progress  
**Priority:** P1  
**Date:** 2026-04-12

---

## Problem

`GET /api/capabilities` only reports `spec_graph`. The Compile button in the UI is always shown
and always active, so users click it and get a cryptic 422 error when the Hyperprompt binary is
missing. The binary resolvability should be surfaced upfront in the capabilities response and
reflected in the UI.

---

## Deliverables

| Artifact | Description |
|----------|-------------|
| `viewer/server.py` — `main()` | Cache `server.compile_available` by probing binary at startup |
| `viewer/server.py` — `handle_capabilities` | Include `"compile": bool` in response |
| `viewer/app/src/App.tsx` | Extend `checkSpecAvailable` → `checkCapabilities`; add `compileAvailable` state; pass to `InspectorOverlay` |
| `viewer/app/src/InspectorOverlay.tsx` | Accept `compileAvailable` prop; disable Compile button with tooltip when false |

---

## Implementation

### Server (`server.py`)

In `main()`, after setting `server.hyperprompt_binary`, resolve the binary and cache:

```python
resolved_binary, _, _ = resolve_hyperprompt_binary(args.hyperprompt_binary)
server.compile_available = resolved_binary is not None
```

In `handle_capabilities`:
```python
{
    "spec_graph": self.server.spec_dir is not None,
    "compile": self.server.compile_available,
}
```

### UI (`App.tsx`)

Replace the narrow `checkSpecAvailable` function with `checkCapabilities` that returns both flags:

```ts
async function checkCapabilities(): Promise<{ specAvailable: boolean; compileAvailable: boolean }> {
  try {
    const res = await fetch("/api/capabilities");
    if (!res.ok) return { specAvailable: false, compileAvailable: false };
    const data = await res.json();
    return { specAvailable: Boolean(data.spec_graph), compileAvailable: Boolean(data.compile) };
  } catch {
    return { specAvailable: false, compileAvailable: false };
  }
}
```

Add `compileAvailable` state and pass to `InspectorOverlay`.

### UI (`InspectorOverlay.tsx`)

Add optional prop `compileAvailable?: boolean` (defaults to `true`).

When `compileAvailable` is false, render the Compile button as `disabled` with a `title` tooltip
and a visible inline note explaining the binary is not configured.

---

## Acceptance Criteria

| AC | Description |
|----|-------------|
| AC1 | `GET /api/capabilities` includes `"compile": true` when binary resolves, `false` otherwise |
| AC2 | Compile button is disabled with tooltip when `compile` is false |
| AC3 | Compile button works normally when `compile` is true |
| AC4 | All existing tests pass |
| AC5 | TypeScript build clean |

---

## Dependencies

None (no prior P7 task dependencies).
