# SpecSpace Spec Markdown Export And Hyperprompt Boundary

Status: planned
Updated: 2026-05-19

## Decision

SpecSpace should restore the useful old ContextBuilder ability to turn a graph
selection into Markdown, but the first SpecSpace version must be a readonly
SpecGraph export surface, not the legacy conversation export and compile
workflow.

The boundary is:

- SpecSpace owns a versioned readonly SpecGraph Markdown export API.
- SpecSpace may expose an optional Hyperprompt compile capability only when a
  deployment explicitly configures it.
- SpecSpace does not own legacy conversation JSON export, checkpoint export, or
  authoring compile flows.

## Behavior Source

The existing `viewer/spec_compile.py` module is the behavior source for the
first export slice:

- input: loaded SpecGraph nodes indexed by spec id;
- root: selected spec id;
- options: depth, objective, acceptance, dependency refs, prompt inclusion;
- output: Markdown plus a serializable manifest with included, skipped, and
  missing nodes.

This module is useful because it is already isolated from HTTP and legacy
conversation I/O. It should be reused or adapted behind `/api/v1/*`, not copied
through the legacy `/api/spec-compile`, `/api/export`, or `/api/compile`
architecture.

## API Shape

The planned backend slice should add a v1 endpoint such as:

```text
GET /api/v1/spec-markdown?root=SG-SPEC-0001&scope=subtree&depth=6
```

The final name can change during implementation, but the contract should remain
rooted in `/api/v1/*`.

The response should include:

```json
{
  "api_version": "v1",
  "root_id": "SG-SPEC-0001",
  "scope": "subtree",
  "markdown": "# SG-SPEC-0001 ...",
  "manifest": {
    "root_id": "SG-SPEC-0001",
    "scope": "subtree",
    "node_count": 12,
    "max_depth_reached": 4,
    "nodes_included": ["SG-SPEC-0001"],
    "cycles_skipped": [],
    "missing_skipped": []
  },
  "source": {
    "provider": "file",
    "read_only": true
  },
  "download_filename": "SG-SPEC-0001.md"
}
```

Errors should be structured and actionable:

- `400` for invalid query options;
- `404` for unknown root spec id;
- `422` for malformed provider data that prevents export;
- `503` only when the configured provider cannot provide spec nodes.

## Frontend Shape

The first UI slice should be deliberately small:

- add `Export Markdown` from Spec Inspector for the selected spec;
- show a readonly preview or copy/download action;
- include manifest diagnostics when cycles, missing refs, or depth limits were
  involved;
- allow adding the generated Markdown artifact to Agent Context later.

This should be implemented through SpecSpace FSD layers and the shared
`/api/v1/*` client, not through the old `SpecCompileOverlay`.

## Hyperprompt Compile Boundary

Hyperprompt compile is a separate optional capability.

If enabled, SpecSpace should:

- compile only from a SpecSpace-generated readonly export bundle;
- run in an isolated temporary or configured work directory;
- never mutate mounted SpecGraph inputs;
- report binary path, version/provenance when available, exit code, stderr, and
  timeout as structured diagnostics;
- fail closed when the binary is missing or not executable.

If disabled, SpecSpace should still provide Markdown export. Static/HTTP
artifact deployments should keep compile disabled by default because they do not
have a writable export workspace or a local compiler binary.

The capability model should distinguish:

- `spec_markdown_export`: readonly export is available;
- `hyperprompt_compile`: local compile is configured and available.

## Deployment Constraints

Local file provider deployments can support Markdown export because the API can
read readonly `specs/nodes`. They may support Hyperprompt compile only when a
compiler binary and scratch workspace are configured.

HTTP/static artifact deployments can support Markdown export if all required
spec nodes are present in the static manifest. They should not support compile
unless a future worker/storage boundary is explicitly added.

Timeweb-style deployment should therefore expose a useful export button without
requiring any mounted SpecGraph checkout or Hyperprompt binary.

## Follow-Up Tasks

1. `CTXB-P13-T30` — Add SpecSpace v1 Spec Markdown export endpoint.
2. `CTXB-P13-T31` — Add Spec Markdown export action to Spec Inspector.
3. `CTXB-P13-T32` — Add optional Hyperprompt compile capability diagnostics.

These tasks should stay separate so the readonly export can ship without
blocking on compiler setup or production storage policy.
