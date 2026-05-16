# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `3d93c7bbc424ddce34927623f1e0acc5d8abc779`
- Generated at: `2026-05-16T21:16:28Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:08e02ad380e53f36e640b3ab6305f7a1eb6b6fb65d69088fa14108c4499e4da7`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:ad003c95d66940b01ed397c10a501ce7856cf95ef2761b4ba906c5b7a3b0d225`
- SpecGraph artifact source: `https://specgraph.tech`

## Rollback

To roll back, restore `docker-compose.yml` to a previous generated commit on
this branch. Each generated commit pins both images by digest, so the API/UI pair
is selected together.

## Notes

- The first service is named `app` because Timeweb proxies the public domain to
  the first compose service.
- SpecGraph data is read over HTTP through `--artifact-base-url`.
- This branch should not contain application source files.
