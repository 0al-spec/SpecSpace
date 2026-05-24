# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `13cd4fe54da5fe906a35c566a7dd0d7c771558a0`
- Generated at: `2026-05-24T12:44:03Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:e5f1c665cdf709474a1b422b9d9ee5fc6bdb00f20b30218c8d334ad3feed2c36`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:1e6307f260fdae473ec60d9767fed2055892652542a038c985ed8ec4438c4232`
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
