# CTXB-P13-T49 Validation Report

**Task:** Add canvas subtree collapse controls  
**Date:** 2026-05-23  
**Verdict:** PASS

## Summary

SpecGraph canvas nodes with direct `refines` children now expose compact
collapse/expand controls. Collapsed subtrees hide descendants before layout is
computed, so the remaining visible graph compacts instead of preserving large
empty branch gaps.

## Acceptance Criteria

| Criterion | Result |
| --- | --- |
| Nodes with direct `refines` children expose collapse/expand controls | PASS |
| Collapsing a node hides descendant nodes and incident edges | PASS |
| Layout recomputes against the visible collapsed graph | PASS |
| Collapsed nodes show hidden descendant count | PASS |
| Global `Expand all` appears while subtrees are collapsed | PASS |
| Desktop and mobile/narrow smoke pass for collapse and expand | PASS |

## Validation

```bash
npm test --prefix graphspace -- subtree-collapse
```

Result: PASS - 1 file / 4 tests passed.

```bash
npm test --prefix graphspace
```

Result: PASS - 58 files / 317 tests passed.

```bash
npm run build --prefix graphspace
```

Result: PASS - Vite build completed; existing chunk-size warning remains.

```bash
npm run lint:fsd --prefix graphspace
```

Result: PASS - no FSD problems found.

## Browser Smoke

Target: `http://localhost:5173/`

Desktop viewport `1440x1000`:
- before collapse: 67 rendered nodes.
- first collapse control: `Collapse 66 descendants`.
- after collapse: 1 rendered node, `data-hidden-subtree-nodes=66`,
  `data-collapsed-subtrees=1`.
- `Expand all` restored 67 rendered nodes and zero hidden subtree nodes.

Mobile viewport `390x844`:
- collapse controls rendered on canvas nodes.
- after collapse: 1 rendered node, `data-hidden-subtree-nodes=66`,
  `data-collapsed-subtrees=1`.
- `Expand all` restored 67 rendered nodes and zero hidden subtree nodes.

Known local noise: `/api/v1/specpm/registry` returned `503` during local smoke.
This is unrelated to canvas subtree collapse and has been seen before in
local-only registry configuration.
