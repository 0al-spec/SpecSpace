# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `efc064d15bb9a4254ecc43d45d8904d600068ace`
- Generated at: `2026-05-18T20:31:19Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:661abefa5cd70653882bd575b2da2041531b91aa418d8e21f8bbe27d3e9ea9b9`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:fbebb84d6ff44a2dfd3c8bf712f8c2e16b32665852bd1481c2b25249b178f8e6`
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
