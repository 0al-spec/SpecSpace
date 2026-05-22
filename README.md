# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `5883af1277a4fdc01d55191d57759cbbef66a5db`
- Generated at: `2026-05-22T20:49:14Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:69eed6bf92f02b7c7f542a4197f19256be322b82704c4eb4982a31e210a3522b`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:cf46e3cd99217e2886056d96d581d12cc0e74ed1fe4ec1bb7f77a794ef84f10c`
- SpecGraph artifact source: `https://specgraph.tech`
- SpecPM registry source: `https://specpm.dev`

## Rollback

To roll back, restore `docker-compose.yml` to a previous generated commit on
this branch. Each generated commit pins both images by digest, so the API/UI pair
is selected together.

## Notes

- The first service is named `app` because Timeweb proxies the public domain to
  the first compose service.
- SpecGraph data is read over HTTP through `--artifact-base-url`.
- SpecPM registry metadata is read over HTTP through `--specpm-registry-url`.
- This branch should not contain application source files.
