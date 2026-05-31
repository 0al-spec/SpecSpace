# CTXB-P13-T55 Validation Report

## Scope

Add browser-like back/forward navigation for selected SpecGraph specs across
SpecSpace selection surfaces.

## Local Validation

- `npm test --prefix graphspace -- src/pages/viewer/model/spec-selection-history.spec.ts --reporter=verbose` — passed, 1 file / 5 tests.
- `npm test --prefix graphspace` — passed, 60 files / 326 tests.
- `npm run lint:fsd --prefix graphspace` — passed.
- `npm run build --prefix graphspace` — passed, Vite chunk-size warning unchanged.
- `git diff --check` — passed.

## Browser Smoke

- Desktop Playwright smoke on `http://127.0.0.1:5173/`:
  - first spec selection leaves Back/Forward disabled;
  - second spec selection enables Back;
  - Back restores `SG-SPEC-0001` and enables Forward;
  - Forward restores `SG-SPEC-0002`;
  - keyboard shortcuts `[` and `]` restore previous/next selected specs.
- Mobile/narrow Playwright smoke at `390x844`:
  - Sidebar shows selected-spec Back/Forward controls in the header;
  - controls stay within Sidebar chrome and do not overlap the canvas control dock;
  - Sidebar remains tall after the prior mobile height fix.

## Notes

- The local smoke target still reports the known local `/api/v1/specpm/registry`
  503 and `favicon.ico` 404; selected-spec navigation behavior is otherwise
  validated.
- History is bounded and pruned against the currently canvas-visible graph nodes,
  including collapsed subtree and gap-filter visibility.
- Review fix: hidden history entries are skipped during Back/Forward traversal
  instead of mutating history into a non-restored hidden selection.
