# CTXB-P10-T8 Validation Report

## Scope

Validated the GraphSpace canvas-first panel dock change:

- Sidebar is hidden by default and opens from canvas chrome.
- Recent changes, Implementation work, and Proposal trace are reachable as one
  active utility panel at a time.
- Spec Inspector remains a separate selected-spec surface.
- Canvas, React Flow controls, and minimap remain mounted.

## Automated Checks

- `npm test` — PASS
  - 17 test files
  - 130 tests
- `npm run build` — PASS
- `npm run lint:fsd` — PASS with existing warnings
  - `fsd/insignificant-slice` warnings remain for single-reference GraphSpace
    feature/widget slices.

## Browser Smoke

Target: `http://localhost:5173/`

- Initial load shows the SpecGraph canvas with no Sidebar or utility panel open.
- Canvas root is mounted.
- React Flow minimap is mounted.
- Sidebar button opens the Sidebar.
- Sidebar exposes utility entry points for Recent changes, Implementation work,
  and Proposal trace.
- Implementation work opens as the active utility panel.
- Recent changes replaces Implementation work as the active utility panel.
- Selecting the first graph node opens Spec Inspector while keeping the utility
  panel state independent.
