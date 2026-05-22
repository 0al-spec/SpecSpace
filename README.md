# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `ba8bcae78bbce0805d1b79f7b0f5019585134f53`
- Generated at: `2026-05-22T16:39:21Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:a7e998c94fbb443cc2e90c1515764fa17374ae8e4733e8c0d4999edd871b5004`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:18f3bf0ce4b37a3da2e2db5c065004878a1093f74e59ced4badbe0e1407baa7b`
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
