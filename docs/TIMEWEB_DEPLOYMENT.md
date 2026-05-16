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

The `timeweb-deploy` branch contains the full SpecSpace repository plus the
Timeweb-only root `docker-compose.yml`. That root file is byte-for-byte
identical to `compose.specspace.yml`.

Timeweb should be configured to deploy from the `timeweb-deploy` branch.

Check drift manually from a normal development branch:

```bash
TIMEWEB_DEPLOY_REMOTE=specspace scripts/check-timeweb-deploy-branch.sh
```

Enable the optional local pre-push hook:

```bash
git config core.hooksPath .githooks
```

Git does not enable repository hooks automatically after clone, so CI also runs
the same deploy-branch guard in the `Timeweb Docker Support` job.

The guard checks two things:

- normal PR/main branches do not accidentally contain root `docker-compose.yml`;
- `timeweb-deploy:docker-compose.yml` has the same SHA-256 as
  `compose.specspace.yml`.

## Current Deployment Shape

The current Timeweb compose file builds images from the repository:

```yaml
services:
  specspace-api:
    build:
      context: .
      dockerfile: Dockerfile
  specspace-ui:
    build:
      context: .
      dockerfile: graphspace/Dockerfile
```

Because the compose file uses `build.context: .`, the `timeweb-deploy` branch
must contain the full repository build context. The Timeweb-specific file is
only in that branch, but the branch itself is not manifest-only.

## Required Environment

Set these environment variables in Timeweb when using the current file-backed
provider:

```text
SPECSPACE_SPEC_NODES_DIR=/absolute/path/to/specs/nodes
SPECSPACE_RUNS_DIR=/absolute/path/to/runs
SPECSPACE_DIALOG_DIR=/absolute/path/to/dialogs
SPECSPACE_API_PORT=8001
SPECSPACE_UI_PORT=5173
```

`SPECSPACE_DIALOG_DIR` exists only because `viewer/server.py` still accepts a
legacy dialog directory. SpecSpace API v1 does not use dialog JSON for graph
inspection.

The important operational caveat is the two SpecGraph mounts:

- `SPECSPACE_SPEC_NODES_DIR`
- `SPECSPACE_RUNS_DIR`

On a local machine these usually point to a checked-out SpecGraph workspace. On
Timeweb they must point to paths that exist on the deployment host. If the
platform does not expose suitable host paths for bind mounts, use one of the
future artifact-provider options below.

## Current Full-Context Branch

This works with the current compose file:

1. Keep `docker-compose.yml` out of main/PR branches.
2. Keep `docker-compose.yml` in `timeweb-deploy`.
3. Point Timeweb at `timeweb-deploy`.
4. Configure the required `SPECSPACE_*` environment variables.

The branch currently has this shape:

```text
timeweb-deploy
  Dockerfile
  graphspace/
  viewer/
  compose.specspace.yml
  docker-compose.yml   # Timeweb-only root entrypoint
  ...
```

## Updating The Deploy Branch

After changing `compose.specspace.yml`, update `timeweb-deploy` so its
`docker-compose.yml` is identical:

```bash
git switch timeweb-deploy
cp compose.specspace.yml docker-compose.yml
git add docker-compose.yml
git commit -m "Update Timeweb compose entrypoint"
git push specspace timeweb-deploy
git switch -
```

Then check from your working branch:

```bash
TIMEWEB_DEPLOY_REMOTE=specspace scripts/check-timeweb-deploy-branch.sh
```

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

## SpecGraph Artifacts From FTP Or Static Hosting

Publishing SpecGraph artifacts from the SpecGraph repository to an FTP-backed
site such as:

```text
https://specgraph.tech/specs/
https://specgraph.tech/runs/
```

is a good deployment direction. The producer-side CI could:

1. validate canonical specs and runs;
2. publish `specs/nodes/*.yaml`;
3. publish `runs/*.json`;
4. publish index manifests with checksums, for example
   `specs/index.json` and `runs/index.json`;
5. upload through FTP, SFTP, WebDAV, or object storage.

SpecSpace does not yet have an HTTP-backed SpecGraph provider. Today it reads
mounted files. To consume `https://specgraph.tech/specs` directly, add a
provider that fetches server-side over HTTP and exposes the same `/api/v1/*`
contracts to GraphSpace.

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

## Smoke Checks

After deployment, verify:

```bash
curl http://<timeweb-host>/api/v1/health
curl http://<timeweb-host>/api/v1/spec-graph
curl "http://<timeweb-host>/api/v1/runs/recent?limit=1"
```

Expected:

- `/api/v1/health` reports `read_only: true`.
- `sources.spec_nodes.status` is `ok`.
- GraphSpace UI loads without sample fallback.
- Runtime data reads go through `/api/v1/*`.
