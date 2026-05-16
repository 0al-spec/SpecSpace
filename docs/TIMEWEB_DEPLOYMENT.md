# Timeweb Deployment

This guide covers SpecSpace deployment through Timeweb Cloud Apps with Docker
Compose.

Timeweb's Docker Compose deploy flow expects a file named `docker-compose.yml`
in the repository root. See Timeweb's Docker Compose deployment docs:
https://timeweb.cloud/docs/apps/deploying-with-docker-compose

## Compose Entrypoint

SpecSpace keeps Timeweb's required compose filename out of the main development
line:

- main/PR branches: `compose.specspace.yml`
- `timeweb-deploy` branch only: `docker-compose.yml`

Timeweb should be configured to deploy from the `timeweb-deploy` branch.

The branch contains the full SpecSpace repository plus the Timeweb-only root
`docker-compose.yml`. It is not manifest-only yet because the current compose
file builds API/UI images from repository source.

## Why Timeweb Uses A Different Compose File

Local/operator compose uses readonly bind mounts:

```text
SPECSPACE_SPEC_NODES_DIR -> /mnt/specgraph/specs/nodes
SPECSPACE_RUNS_DIR       -> /mnt/specgraph/runs
```

Timeweb currently rejects `volumes` in `docker-compose.yml`. It also fails when
required environment interpolation such as `${SPECSPACE_SPEC_NODES_DIR:?…}` is
missing. Therefore the Timeweb compose file is intentionally different from
`compose.specspace.yml`:

- no `volumes`;
- no required `SPECSPACE_*` artifact path variables;
- API reads bundled demo artifacts from `/app/deploy/specspace-demo`;
- real SpecGraph artifacts wait for the HTTP/static artifact provider work.

This lets Timeweb boot SpecSpace now, but it displays demo data until external
SpecGraph artifact publishing is implemented.

## Guardrails

Check the deploy branch manually from a normal development branch:

```bash
TIMEWEB_DEPLOY_REMOTE=specspace scripts/check-timeweb-deploy-branch.sh
```

Validate that the deploy branch compose can be rendered:

```bash
TIMEWEB_DEPLOY_REMOTE=specspace scripts/validate-timeweb-deploy-branch.sh
```

Enable the optional local pre-push hook:

```bash
git config core.hooksPath .githooks
```

Git does not enable repository hooks automatically after clone, so CI also runs
the same deploy-branch guard in the `Timeweb Docker Support` job.

The guard checks:

- normal PR/main branches do not accidentally contain root `docker-compose.yml`;
- `timeweb-deploy:docker-compose.yml` exists;
- the Timeweb compose has no `volumes`;
- the Timeweb compose has no required `${VAR:?message}` interpolation;
- the Timeweb API command points at bundled demo artifact paths.

## Current Deployment Shape

The current Timeweb compose file builds images from the repository:

```yaml
services:
  specspace-api:
    build:
      context: .
      dockerfile: Dockerfile
    command:
      - python
      - viewer/server.py
      - --spec-dir
      - /app/deploy/specspace-demo/specs/nodes
      - --runs-dir
      - /app/deploy/specspace-demo/runs
  specspace-ui:
    build:
      context: .
      dockerfile: graphspace/Dockerfile
```

Because the compose file uses `build.context: .`, the `timeweb-deploy` branch
must contain the full repository build context. The Timeweb-specific file is
only in that branch, but the branch itself is not manifest-only.

## Required Environment

No SpecGraph artifact path variables are required for the current Timeweb demo
deployment.

Optional:

```text
SPECSPACE_API_PORT=8001
SPECSPACE_UI_PORT=5173
```

If Timeweb manages public ports itself, leave these unset and use the platform's
generated URL.

## Updating The Deploy Branch

When `compose.specspace.yml` changes, do not blindly copy it to
`timeweb-deploy`; Timeweb does not allow its `volumes` section. Update
`timeweb-deploy:docker-compose.yml` by preserving the no-volume demo shape and
then run:

```bash
TIMEWEB_DEPLOY_REMOTE=specspace scripts/check-timeweb-deploy-branch.sh
TIMEWEB_DEPLOY_REMOTE=specspace scripts/validate-timeweb-deploy-branch.sh
```

## Future Real Artifact Deployment

Publishing SpecGraph artifacts from the SpecGraph repository to an FTP-backed
site such as:

```text
https://specgraph.tech/specs/
https://specgraph.tech/runs/
```

is the right direction for Timeweb. The producer-side CI could:

1. validate canonical specs and runs;
2. publish `specs/nodes/*.yaml`;
3. publish `runs/*.json`;
4. publish index manifests with checksums, for example
   `specs/index.json` and `runs/index.json`;
5. upload through FTP, SFTP, WebDAV, or object storage.

SpecSpace does not yet have an HTTP-backed SpecGraph provider. Today local
deployment reads mounted files; Timeweb reads bundled demo files. To consume
`https://specgraph.tech/specs` directly, add a provider that fetches server-side
over HTTP and exposes the same `/api/v1/*` contracts to GraphSpace.

Preferred HTTP artifact contract:

```text
/specs/index.json
/specs/nodes/<spec-id>.yaml
/runs/index.json
/runs/<run-id>.json
```

Each index entry should include at least path, size, updated time, and SHA-256.
For reproducible deployments, prefer versioned prefixes:

```text
https://specgraph.tech/releases/<specgraph-sha>/specs/
https://specgraph.tech/releases/<specgraph-sha>/runs/
```

That keeps Timeweb deploys diagnosable: the SpecSpace commit and SpecGraph
artifact revision can be pinned independently.

## Future Manifest-Only Branch

The long-term cleaner deployment shape is a branch with only deployment
manifests. That requires prebuilt images.

Desired flow:

```text
SpecSpace CI
  -> build API image
  -> build UI image
  -> push images to registry
  -> publish timeweb-deploy branch with only docker-compose.yml and docs
```

Then `docker-compose.yml` can use pinned images instead of `build.context: .`:

```yaml
services:
  specspace-api:
    image: ghcr.io/0al-spec/specspace-api:<sha>
  specspace-ui:
    image: ghcr.io/0al-spec/specspace-ui:<sha>
```

Timeweb can still target the `timeweb-deploy` branch in its control panel. This
is tracked as a follow-up because it changes the release pipeline and registry
permissions. In that future state, the branch may contain only deployment
manifests.

## Smoke Checks

After deployment, verify:

```bash
curl http://<timeweb-host>/api/v1/health
curl http://<timeweb-host>/api/v1/spec-graph
curl "http://<timeweb-host>/api/v1/runs/recent?limit=1"
```

Expected for the current demo deployment:

- `/api/v1/health` reports `read_only: true`.
- `sources.spec_nodes.status` is `ok`.
- The graph contains `SG-SPEC-0001`.
- GraphSpace UI loads without sample fallback.
- Runtime data reads go through `/api/v1/*`.
