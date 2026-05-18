# Local Static Deployment Lab

The local deployment lab mirrors the production SpecSpace topology without
depending on a specific cloud host.

It runs three readonly producer/consumer surfaces on the local Docker network:

- SpecGraph static artifacts, served from `../SpecGraph/dist/specgraph-public`.
- SpecPM public registry metadata, served from `../SpecPM/.specpm/public-index`.
- SpecSpace API and UI, reading both sources over HTTP.

This is a meta-level integration environment across the adjacent repositories:
SpecGraph remains the artifact producer, SpecPM remains the registry producer,
and SpecSpace remains the readonly consumer.

## Topology

```text
Browser
  |
  v
SpecSpace UI :5173
  |
  v
SpecSpace API :8001
  |
  +-- http://specgraph-static:8080/artifact_manifest.json
  +-- http://specgraph-static:8080/specs/nodes/*.yaml
  +-- http://specgraph-static:8080/runs/*.json
  |
  +-- http://specpm-registry:8080/v0/status
  +-- http://specpm-registry:8080/v0/packages
```

The browser talks to SpecSpace only. SpecSpace talks to the static artifact
services server-side, so browser CORS is not part of the normal lab path.

## Prepare Static Inputs

Build or refresh the SpecGraph static bundle in the SpecGraph repository. The
lab expects:

```text
../SpecGraph/dist/specgraph-public/artifact_manifest.json
../SpecGraph/dist/specgraph-public/specs/nodes/*.yaml
../SpecGraph/dist/specgraph-public/runs/*.json
```

Generate the SpecPM public index in the SpecPM repository:

```bash
(cd ../SpecPM && make public-index-generate)
```

The lab expects:

```text
../SpecPM/.specpm/public-index/v0/status/index.json
../SpecPM/.specpm/public-index/v0/packages/index.json
```

Override paths when needed:

```bash
export SPECGRAPH_PUBLIC_DIR=/absolute/path/to/specgraph-public
export SPECPM_PUBLIC_INDEX_DIR=/absolute/path/to/public-index
```

## Start The Lab

```bash
docker compose -f compose.deploy-lab.yml up --build
```

Default host ports:

- SpecSpace UI: `http://127.0.0.1:5183`
- SpecSpace API: `http://127.0.0.1:8011`
- SpecGraph static artifacts: `http://127.0.0.1:8082`
- SpecPM registry: `http://127.0.0.1:8081`

To avoid port conflicts:

```bash
SPECSPACE_UI_PORT=5193 \
SPECSPACE_API_PORT=8021 \
SPECGRAPH_STATIC_PORT=8083 \
SPECPM_REGISTRY_PORT=8084 \
docker compose -f compose.deploy-lab.yml up --build
```

## Smoke Test

Build, start, verify, and tear down the lab:

```bash
scripts/smoke-specspace-deploy-lab.sh
```

Probe an already running lab:

```bash
SPECSPACE_DEPLOY_LAB_MODE=probe scripts/smoke-specspace-deploy-lab.sh
```

The smoke checks:

- static SpecGraph manifest is reachable;
- static SpecPM `/v0/status` is reachable;
- SpecSpace health reports `provider: "http"`;
- SpecSpace health reports `artifact_manifest` as `ok` and `specpm_registry`
  as `configured`;
- graph, implementation work, registry, UI, and UI-proxied health endpoints
  return `200`.

## GitHub CI

The full lab smoke is intentionally outside the required default CI path. It
runs in `.github/workflows/deploy-lab-smoke.yml` for:

- manual `workflow_dispatch`, with optional `SpecGraph` ref and paired
  `SpecPM` ref/revision override;
- weekly scheduled drift detection;
- release tag pushes matching `v*`;
- PRs that change the lab, Docker, or SpecSpace UI version/build files.

This keeps ordinary PR feedback fast while still providing a GitHub-hosted
regression gate for release and deployment-boundary changes.

The CI workflow builds the SpecGraph static artifact bundle, but uses SpecPM's
remote-registry conformance fixtures instead of regenerating the full public
index. That keeps the SpecSpace lab focused on HTTP/static consumer behavior
and avoids failing because of unrelated public-index source drift.

SpecSpace owns the trusted SpecPM fixture lock. The workflow checks out SpecPM
by the pinned `SPECPM_FIXTURE_REVISION` commit by default; `SPECPM_FIXTURE_REF`
is only a readable label. Manual runs may override SpecPM, but must provide
both `specpm_ref` and `specpm_revision`. A ref without an expected revision is
rejected so mutable branches or rewritten tags cannot silently become the root
of trust.

## Stop The Lab

```bash
docker compose -f compose.deploy-lab.yml down --remove-orphans
```

## Relation To Production

Production can use any static host for SpecGraph and SpecPM outputs. The lab
uses local nginx containers to exercise the same HTTP/static provider contracts:

- `--artifact-base-url`
- `--specpm-registry-url`

Provider-specific deployment details, such as Timeweb branch publishing or
GitHub Pages publication, stay outside this lab.
