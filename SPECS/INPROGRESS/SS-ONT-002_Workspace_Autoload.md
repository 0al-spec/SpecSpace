# SS-ONT-002 — Published workspace ontology autoload

## Contract
`/ontology?workspace=<id>` selects exactly one configured provider via the existing
read-only artifact catalog/content API. Default is specgraph-bootstrap. Link the
workbench to this route with its workspace identity. Do not import bootstrap data
for an unavailable product workspace. Public diagram filename: ontology.graph.json
in the selected provider's allowed runs root. Prefer its unique projection; when
absent, use the existing published normalized IR. Multiple candidates require an
explicit choice. Empty/unavailable/invalid states remain visible, with manual-file
loading available. Never silently replace a declared invalid diagram with legacy
IR. Manual selection wins against pending automatic reads.

Content echoes exact path, workspace source and additive content SHA-256. Compare
published catalog digest when supplied; do not label an unbound local catalog as
manifest-verified. All requests use same-origin scoped endpoints, not artifact URLs.

## Validation
Loader unit tests, API source/digest/scoping tests, browser HTTP fixtures for
diagram, legacy, absent/invalid and manual-vs-auto race; desktop/mobile layout.
No producer release, publishing, canonical mutation or deployment. Diagram
production is not yet part of SpecGraph's bundle; preserve that boundary honestly.

## Workspace
Stacked above SpecSpace #435 in the clean primary checkout; no new worktree.
Builds/caches stay in the verified TB5 source copy. Separate subsequent quality
infrastructure PR covers actual repo languages/frameworks and existing debt.
