# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `2901f034b879a3e906606e4c15e1972579c2567a`
- Generated at: `2026-05-19T19:00:28Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:c3af0fe473db09c034d13194c6a122e19ce8e46842b759d17f36e9e4d9ae5203`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:90a5ff6f35e0cd4a80a83a9a9d94f52b86c57967ce205f0537d451697b796eb3`
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
