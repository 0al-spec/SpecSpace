# Ontology diagram library

MIT source subset from the exact Ontology revision in `upstream.json`. No App,
WorkspaceEditor, network client or writer is included. Do not edit upstream files;
update the pin and regenerate from a reviewed checkout with:

```sh
node scripts/sync-ontology-viewer.mjs --source /path/to/Ontology
node scripts/sync-ontology-viewer.mjs --check
```

The check verifies all copied bytes and the derived CSS. Only the generated CSS
is scoped under `.ontology-explorer`; upstream components/model remain exact.
SpecSpace composes this library in `widgets/ontology-explorer`. Normalized IR
remains a separate legacy input contract, never relabeled as diagram-projection.
