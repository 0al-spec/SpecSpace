# SpecSpace Product Boundary

SpecSpace is the standalone readonly viewer and API for SpecGraph and SpecPM
artifacts. It is not the ContextBuilder conversation-authoring application.

## Owns

SpecSpace owns these product surfaces:

- `graphspace/`: the SpecSpace UI.
- `/api/v1/*`: the versioned SpecSpace API contract.
- Docker/Compose deployment for readonly SpecGraph mounts.
- Readonly consumption of SpecGraph `specs/nodes` and `runs` artifacts.
- Optional readonly SpecPM lifecycle diagnostics derived from a mounted
  SpecGraph root.

The primary user workflow is inspection: open the graph, navigate specs, inspect
spec detail, follow spec references, view recent activity, and diagnose artifact
state. SpecSpace may surface producer status, but it does not become the
producer.

## Does Not Own

These remain legacy ContextBuilder responsibilities:

- conversation JSON authoring;
- checkpoint editing;
- branch, merge, delete, reorder, move, duplicate, copy, or paste operations for
  conversations/messages;
- Hyperprompt export and compile flows;
- write APIs over dialog JSON workspaces.

Those workflows can continue to live in `viewer/app` and the legacy
ContextBuilder route set while they are still useful. They should not be pulled
into `graphspace/` unless the product goal explicitly changes from readonly
SpecSpace to authoring.

## API Boundary

Runtime SpecSpace UI code should read through `/api/v1/*`.

Current SpecSpace endpoints include:

- `GET /api/v1/health`
- `GET /api/v1/spec-graph`
- `GET /api/v1/spec-nodes/{id}`
- `GET /api/v1/runs/recent`
- `GET /api/v1/specpm/lifecycle`
- `GET /api/v1/capabilities`
- `GET /api/v1/runs-watch`

Legacy endpoints such as `/api/file`, `/api/files`, `/api/graph`,
`/api/conversation`, `/api/checkpoint`, `/api/export`, `/api/compile`, and
non-versioned SpecGraph routes are not part of the SpecSpace product contract.

Compatibility tests and fixtures may preserve legacy response shapes when they
are explicitly named as compatibility coverage. Runtime `graphspace/` code
should not default to those endpoints.

## Deployment Boundary

SpecSpace deployment mounts SpecGraph inputs readonly and exposes a stable API
facade to the UI. The deployment contract is documented in
[`SPECSPACE_DEPLOYMENT.md`](SPECSPACE_DEPLOYMENT.md), and the HTTP contracts are
documented in [`SPECSPACE_API_V1.md`](SPECSPACE_API_V1.md).

SpecGraph and SpecPM remain upstream producers. If a future deployment switches
from file-backed reads to an HTTP-backed producer provider, that provider should
be added behind the same `/api/v1/*` SpecSpace API boundary.

## Design Rule

When a new feature is proposed for SpecSpace, first classify it:

- readonly artifact inspection: candidate for SpecSpace;
- producer mutation, conversation editing, or compile authoring: legacy
  ContextBuilder or a separate authoring product;
- integration diagnostics: candidate only if it can be shown through readonly
  provider state.

This keeps SpecSpace reusable across projects whose spec IDs, producers, and
artifact layouts differ from the original ContextBuilder workspace.
