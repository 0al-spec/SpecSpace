# CTXB-P10-T12 Validation Report

## Scope

Sidebar navigator selected-row visibility:
- selected row is tracked with a ref
- externally selected visible rows scroll into view
- custom overlay scrollbar metrics refresh after selection-driven scrolling
- selected row exposes `aria-current="true"`

## Automated Checks

- `npm test` — PASS, 19 files / 137 tests.
- `npm run build` — PASS. Vite reports the existing >500 kB chunk warning.
- `npm run lint:fsd` — PASS with the known `fsd/insignificant-slice` warnings.

## Browser Smoke

- Opened `http://localhost:5173/`.
- Opened Sidebar and selected `SG-SPEC-0001`.
- Cleared navigator search and opened Inspector direct-link groups.
- Selected `SG-SPEC-0061` through the Inspector relation button.
- Verified the navigator custom scrollbar thumb moved from
  `translateY(0px)` to `translateY(213px)`.
- Verified the `Select SG-SPEC-0061` row exposes `aria-current="true"`.
- Verified Spec Inspector opened `SG-SPEC-0061`.
