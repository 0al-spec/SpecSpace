# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `74f02ded371e0b260e1be3636cd21c21a1b1eaba`
- Generated at: `2026-05-18T18:57:29Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:2af7f1220862a098bee60b7b1edd20d7de7e6b07ff7168c9bcc7bd338d0aaeba`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:051dbd3cb8d7f784460be8fd58b0b73ef218c10255f2c5ef055b2435f073e519`
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
