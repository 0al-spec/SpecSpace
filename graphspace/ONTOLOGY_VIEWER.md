# Ontology Viewer in SpecSpace

Open `/ontology` and select or drop a local `ontology.graph.json` exported by
`ontologyviz --format json`. Files opened manually stay in browser memory; this route performs
no upload, YAML save, canonical mutation or publication. Existing normalized IR
packages and ZIP imports continue through the legacy viewer. Select one format
at a time; competing projections are rejected explicitly. A failed load preserves
the previous valid view. Opening another valid diagram resets its display state.
To bound local import memory, one selection accepts at most 128 files and 64 MiB
of input. Across all selected ZIPs, at most 512 entries and 64 MiB of expanded
data are accepted; an individual expanded entry is limited to 32 MiB. Limits
are checked while decompressing, including when a ZIP header claims a smaller
size. A rejected import reports the reason and leaves the previous view open.

The compiler declaration view supports search/focus, node/relation inspection,
source package/version, logical YAML pointers and file digests. Filter node types,
origin, link kinds and exact package identities; Hide/Dim preserve node positions
and viewport. Counts describe the complete loaded projection. Empty categories
cannot be reconstructed by the viewer: export a full profile and explicitly
include the imports you need. Loaded declarations, unresolved references,
structural validity, approval and executed policies remain separate concepts.

**Focus on relationship** highlights the selected relationship, its roles or
endpoints, and their recursive inheritance, conformance and `Ref` dependencies.
The rest of the graph is dimmed without moving nodes or changing line style.
Selecting another relationship updates the focus; switching the mode off
restores the normal view. A non-relationship selection keeps the mode ready for
the next relationship. Existing filters remain in effect; the status reports
when focused dependencies are filtered or include unloaded external references.
The path is based on declarations, not proof of execution or completeness.

In **Directed layers**, **Relationship layers** and the experimental **Type
layers**, inheritance is drawn as a flow from a base type to its subtype: the
arrow is labelled `extended by`
(`implemented by` for protocol conformance). The source declaration remains
`subtype extends base`; selecting the edge shows that original declaration.
Action relationship role wires enter their named ports from the left. **Directed
layers** and **Relationship layers** use hierarchy and role links for placement;
in **Relationship layers**, other ontology relations also influence placement.
Constraints that would introduce a cycle remain visible as backward links.

**Type layers** groups foundation base types and unloaded hierarchy bases,
other declarations, actions, and relationship nodes from left to right. Within
each group, inheritance takes precedence and other directed links add columns
when they do not contradict that hierarchy or previously placed links. Siblings
may share a column, while a descendant appears after all of its parents.
Members of an inheritance cycle share a column. Other cyclic or cross-group
links remain visible and can point backward. Empty columns are omitted.
Unresolved references that are not used as hierarchy bases or action roles
remain with the other declarations: their type is not inferred. This is a view
of the existing graph, not a change to the ontology. Lines may cross cards; the
ports identify their endpoints.

## Development and updates

`/dev/ui-catalog#ontology-explorer` renders the same widget with a real full
motivation/events compiler fixture. The catalog is dev-only.

The `specgraph-payloadcheck.fixture.json` layout test uses a full projection
exported with Ontology 0.8.0 from SpecGraph commit
`a6cfdb7d44bbc8687bf2db5078fa42701bc74d0c`, with the local `SG-SPEC-0071`
package and its direct `specgraph-core` import. Its source-byte digests bind the
YAML inputs; `sg:DomainEntity` remains an unloaded foundation reference. JSON
whitespace was formatted for this repository.

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

For the public bootstrap workspace, the combined draft overview is preferred.
When that is absent, the Viewer prefers the source-bound core `0.4.0` diagram,
then the historical `0.3.0` diagram. The historical version remains accessible
through its fixed public endpoint. For other workspaces, multiple diagram
candidates require a selection; a single diagram is opened automatically. If no
diagram is published, the normalized IR is shown in the explicitly labeled
legacy view. A declared broken diagram never silently falls back to another
artifact.

The UI validates path/workspace/envelope and compares catalog/content digests when
the catalog supplies one. No digest is invented for older file catalogs. Missing,
HTTP-error, malformed and future-schema states remain visible alongside manual
loading. Content SHA-256 is an additive field of the existing content API; it
binds the bytes read by the provider and does not prove approval or source truth.

The published `specgraph-bootstrap` overview and core ontology are public and
load without an operator session through dedicated endpoints restricted to fixed
`specgraph.tech` artifacts. The general artifact-content API remains
operator-only; other workspace artifacts may require authentication. The 0.4.0
route is usable after the corresponding SpecGraph bundle is deployed; until
then, the 0.3.0 fallback remains available.
