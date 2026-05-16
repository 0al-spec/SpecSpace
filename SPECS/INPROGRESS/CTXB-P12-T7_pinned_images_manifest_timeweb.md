# CTXB-P12-T7 — Publish pinned SpecSpace images and generate manifest-only Timeweb branch

## Task

Replace the current source-build Timeweb deployment shape with a generated
manifest-only branch that references CI-published SpecSpace API and GraphSpace
UI container images.

## Context

`CTXB-P12-T6` moved Timeweb runtime data access to the HTTP/static SpecGraph
artifact provider. Timeweb no longer needs bind-mounted SpecGraph artifact
directories, but the `timeweb-deploy` branch still contains the full repository
because its compose file builds images from source.

The next release boundary is to make source builds a CI concern and keep
Timeweb responsible only for pulling pinned images and running the compose
manifest.

## Deliverables

- CI builds SpecSpace API and GraphSpace UI Docker images.
- CI publishes those images to GHCR on `main` with commit-SHA tags.
- CI generates a `timeweb-deploy` branch that contains only deployment
  manifests and minimal deployment notes.
- The generated compose file uses digest-pinned image references and the
  HTTP/static artifact provider.
- Guard scripts validate the manifest-only tree shape.
- Timeweb documentation explains image pinning and rollback.

## Acceptance Criteria

- API and UI images are built in CI and tagged by the commit SHA.
- `timeweb-deploy` can be generated without application source files.
- Generated `docker-compose.yml` has no `build`, no `volumes`, no required
  `${VAR:?message}` interpolation, and keeps the first service named `app`.
- Generated `docker-compose.yml` uses pinned image references, not `latest`.
- The API command includes `--artifact-base-url https://specgraph.tech`.
- Documentation explains rollback by selecting an older pinned image pair.

## Out Of Scope

- Changing SpecGraph artifact publishing.
- Changing the `/api/v1/*` runtime contract.
- Making Timeweb pull private packages; the workflow assumes GHCR images are
  accessible to the deployment environment after publish.

## Validation Plan

- Render a candidate manifest-only deploy tree locally.
- Validate the generated deploy tree with guard scripts.
- Render Docker Compose config from the generated tree.
- Run existing Python, viewer, GraphSpace, and compose smoke checks.
