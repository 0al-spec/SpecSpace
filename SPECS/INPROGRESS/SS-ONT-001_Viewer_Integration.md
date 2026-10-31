# SS-ONT-001 — Embed the Ontology Viewer

## Intent and scope
Reuse the delivered Ontology read-only declaration canvas, inspector and filters
in the existing SpecSpace /ontology-viewer route. Preserve normalized IR/archive
loading. New diagram-projection/v1 files retain upstream validation and package,
source/digest/pointer semantics. No YAML writer, loopback service or agent API.

## Composition
Pin the MIT Ontology source subset at 613b0accf17e30fa774e126f50c163f5a697a24a.
Keep upstream files byte-identical with a SHA-256 manifest and explicit update
script. Isolate upstream CSS under the explorer host. FSD: entity owns the
external diagram library, widget composes its read-only exploration state,
page selects file format; catalog consumes the same widget before route wiring.

## Acceptance
- Render a real compiler-produced full projection in /dev/ui-catalog first.
- Search, source inspection, Hide/Dim, package filters and stable node positions.
- Load valid diagram JSON on the existing route; reject malformed, unsupported
  or ambiguous selections without losing the last valid diagram. Preserve legacy
  normalized IR/ZIP path and diagnostics. Handle file-read errors and concurrent
  loads; no automatic trust/approval claim from a valid projection.
- Unit/parser compatibility, provenance check, build, FSD lint and focused browser
  scenarios; desktop/mobile screenshots and overflow/scroll checks.
- Self-contained build, no dependency on a sibling checkout at runtime/CI.

## Workspace and validation
Use the clean primary SpecSpace checkout on codex/ontology-viewer-integration;
no new Git worktree. Preserve existing node_modules/dist. Install/build and serve
an exact source copy on verified TB5, recording copy identity and output paths.
Publish a focused PR; no deployment or merge in this slice.
