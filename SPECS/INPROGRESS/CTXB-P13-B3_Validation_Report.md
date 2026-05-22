# CTXB-P13-B3 Validation Report

**Task:** Balance Spine sibling anchors  
**Date:** 2026-05-23  
**Verdict:** PASS

## Summary

The Spine layout now computes subtrees relative to each root and keeps
two-child sibling anchors symmetric around the parent when their descendant
subtrees can fit. Descendants expand around the child anchor instead of pulling
the sibling anchor off balance.

## Acceptance Criteria

| Criterion | Result |
| --- | --- |
| Two immediate Spine children are evenly spaced around parent when possible | PASS |
| Deeper descendants expand around the child anchor | PASS |
| Larger sibling groups relax deterministically to avoid overlap | PASS |
| Secondary links still do not influence Spine placement | PASS |
| Desktop and mobile/narrow browser smoke pass for Spine | PASS |

## Validation

```bash
npm test --prefix graphspace -- layout-presets
```

Result: PASS - 1 file / 8 tests passed.

```bash
npm test --prefix graphspace
```

Result: PASS - 56 files / 309 tests passed.

```bash
npm run build --prefix graphspace
```

Result: PASS - Vite build completed with the existing chunk-size warning.

```bash
npm run lint:fsd --prefix graphspace
```

Result: PASS - no problems found.

```bash
git diff --check
```

Result: PASS.

## Browser Smoke

Local browser automation could not attach to the in-app browser pane in this
session, so the smoke used the local Playwright browser against the same dev
server at `http://127.0.0.1:5173/`.

Desktop viewport:

- Viewport: `1440x1000`
- Layout preset after click: `spine`
- Rendered nodes: `66`
- Rendered edges: `177`
- Checked fork: `SG-SPEC-0065 -> SG-SPEC-0007 / SG-SPEC-0009`
- Symmetry delta between the two child anchors around the parent: `0px`

Mobile/narrow viewport:

- Viewport: `390x844`
- Layout preset after click: `spine`
- Rendered nodes: `66`
- Rendered edges: `177`
- Checked fork: `SG-SPEC-0065 -> SG-SPEC-0007 / SG-SPEC-0009`
- Symmetry delta between the two child anchors around the parent: `0px`

Known local-only console noise:

- `GET /api/v1/specpm/registry` returned `503` in the local dev service.
- The error is unrelated to canvas layout rendering and matches the existing
  local registry configuration gap.
