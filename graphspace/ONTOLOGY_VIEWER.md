# Ontology Viewer in SpecSpace

Open `/ontology` and select or drop a local `ontology.graph.json` exported by
`ontologyviz --format json`. Files opened manually stay in browser memory; this route performs
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

## Published workspace data

`/ontology?workspace=team-decision-log` automatically reads that selected provider's
artifact catalog and content API. The workbench links here with its workspace ID.
Without a workspace parameter it selects `specgraph-bootstrap`; invalid IDs never
fall back to bootstrap. `?source=local` disables the initial automatic request.
Manual selection cancels automatic loading; Reload published ontology retries.

One optional `ontology.graph.json` in the selected runs root is preferred. If no
diagram is published, the existing normalized IR is shown in the explicitly
labeled legacy view. Multiple candidates require a selection. A declared broken
diagram never silently falls back to another artifact. The current SpecGraph
producer does not yet emit this diagram in its bundle; its existing IR works now.

The UI validates path/workspace/envelope and compares catalog/content digests when
the catalog supplies one. No digest is invented for older file catalogs. Missing,
HTTP-error, malformed and future-schema states remain visible alongside manual
loading. Content SHA-256 is an additive field of the existing content API; it
binds the bytes read by the provider and does not prove approval or source truth.

The published `specgraph-bootstrap` core ontology is public and loads without an
operator session through a dedicated endpoint restricted to the published
`specgraph.tech` artifact. The general artifact-content API remains operator-only;
other workspace artifacts may require authentication.
