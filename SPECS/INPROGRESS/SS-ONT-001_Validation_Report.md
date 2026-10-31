# SS-ONT-001 — validation and author review

Date: 2026-11-01 (Europe/Moscow). Local bounded checks PASS; hosted CI,
independent review, merge and deployment remain separate.

## Delivered boundary
The existing `/ontology` route can open diagram-projection/v1 with the pinned
Ontology canvas/inspector/filters. Legacy normalized IR/ZIP loading remains in
its existing contract. Malformed/future/ambiguous diagrams and file-read errors
preserve the previous valid diagram; late completions cannot override a newer
load. The component contains no writer, workspace client or new backend API.

The MIT upstream subset is byte-identical at 613b0ac; per-file hashes and a
scoped-CSS generation check run in CI. `entities/ontology-diagram` owns the
library, `widgets/ontology-explorer` composes read-only state, and the existing
page owns format selection. Normal builds need no sibling checkout.

## Executed
- 43 focused Vitest tests: existing normalized-IR/archive/projection contracts,
  new diagram selection negatives, catalog rendering and route resolution.
- Production TypeScript/Vite build PASS; FSD lint: no problems.
- Pinned-source/scoped-CSS check PASS; Python GraphSpace API-boundary checker PASS.
- CI YAML parses; focused browser smoke and artifact upload added.
- Two Chromium scenarios PASS at 1600×1000 and 390×844: local file load,
  search/focus, source inspection, Hide/Dim, package filters, preserved node
  positions, invalid-file retention, new/legacy/new format switching and no
  HTTP mutation requests. Desktop additionally probes an unreadable File and
  slow failed read racing a newer valid load.
- Catalog fixture was rendered/inspected before route wiring; desktop/mobile
  DOM measurements showed no horizontal page overflow. Final route screenshots
  inspected at both widths, with the source inspector reachable through scroll.
- Screenshot/HTTP evidence is local browser evidence, not a production deploy,
  native-device, Safari or independent security validation.
- `git diff --check` PASS.

Build/install/test outputs were confined to a source copy on verified TB5. The
413 graphspace source files match the checkout; source-copy SHA-256:
`b2f58c65bb72122e68fc1594a8ca9d557753c8d7eabc402ba6b078171aa645ee`. Node 26.5.0/npm 12.2.0 were used locally; hosted CI uses its own
configured Node version. Existing primary-checkout node_modules/dist were not
modified. A source-receipt manifest and Playwright evidence remain in the
ontology-integration directory under the TB5 project build root.

## Limits and follow-up
The build retains its large-chunk warning. npm audit reported 23 advisories for
the base lockfile and 22 for the current lockfile (1 low, 10 moderate, 9 high,
2 critical); neither Dagre nor Graphlib has a reported advisory. PostCSS is
promoted to a direct dev dependency at the pre-existing root version 8.5.14;
remaining advisories were not remediated or assessed for exploitability here.
No automated audit fixes were applied. The dev preview also has the existing
missing-favicon 404. These facts do not certify security or gate this UI task.

Initial browser-test failures were harness errors: wrong route, expecting Dim
after Reset, and uploading an IR fixture under a noncanonical filename. Corrected
those expectations; the final two scenarios pass. The CSS generation script also
now creates its output directory when starting from a file-only source copy.

Next bounded slice: load the selected workspace's published diagram projection
through the existing SpecGraph/SpecSpace artifact boundary. Source editing and
agent execution are later, separately governed integrations.
