# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `2ea2d0b3f68279112359b759f8d19d6e95dac7d9`
- Generated at: `2026-05-21T19:50:56Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:c3f750b96721d5e5be35e92cf4440b88ea55d110db39ac1a82c55ee7510f26c2`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:a77a8eea7cce442eb50a1c50a5c2ba7955b2de97aeecb3590474846448bfa893`
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
