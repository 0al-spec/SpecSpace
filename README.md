# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `81e5369576ac14991896c84ce0cbac2236e919e9`
- Generated at: `2026-05-17T22:12:16Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:85f7c0da9164edb19e5ce5c4edbc3b422a1403a98b3ae2609c11bc6406e1e30b`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:2fbe08cb2eef6849f18adbc7efdb9b52275f95f85f09504071fa3ad8b23c3b3b`
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
