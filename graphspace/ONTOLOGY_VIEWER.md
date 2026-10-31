# Ontology Viewer in SpecSpace

Open `/ontology` and select or drop a local `ontology.graph.json` exported by
`ontologyviz --format json`. Files stay in browser memory; this route performs
no upload, YAML save, canonical mutation or publication. Existing normalized IR
packages and ZIP imports continue through the legacy viewer. Select one format
at a time; competing projections are rejected explicitly. A failed load preserves
the previous valid view. Opening another valid diagram resets its display state.

The compiler declaration view supports search/focus, node/relation inspection,
source package/version, logical YAML pointers and file digests. Filter node types,
origin, link kinds and exact package identities; Hide/Dim preserve node positions
and viewport. Counts describe the complete loaded projection. Empty categories
cannot be reconstructed by the viewer: export a full profile and explicitly
include the imports you need. Loaded declarations, unresolved references,
structural validity, approval and executed policies remain separate concepts.

## Development and updates

`/dev/ui-catalog#ontology-explorer` renders the same widget with a real full
motivation/events compiler fixture. The catalog is dev-only.

The source library lives in `src/entities/ontology-diagram`; its MIT license,
exact upstream revision and per-file SHA-256 hashes are retained. The widget
composes exploration state; the page selects the input contract. No upstream
App, WorkspaceEditor or loopback client is included. CSS is generated under the
`.ontology-explorer` container, never imported globally from upstream.

```sh
npm ci
npm run check:ontology-viewer
npm test -- src/pages/ontology-viewer src/pages/ui-catalog
npm run lint:fsd
npm run build
npm run e2e:ui-started -- ontology-explorer.spec.ts
```

To update, review the new upstream commit, update `upstream.json` revision/hashes,
then run `node scripts/sync-ontology-viewer.mjs --source /path/to/Ontology` and
re-run the checks. Normal CI/build uses only tracked sources and the lockfile;
it does not need another checkout, compiler, registry or network fetch at runtime.

Next slice: expose this component over the selected workspace's published
projection/artifact contract. YAML editing and agent actions need their own
SpecSpace-owned lifecycle and permissions; this read-only integration does not
forward the standalone local writer to hosted browsers.
