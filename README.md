# SpecSpace Timeweb Deploy Manifest

This branch is generated from SpecSpace CI and is intentionally manifest-only.
It is the branch Timeweb should deploy from.

## Release

- Source commit: `72083643de9ea9ba3a6bbb000d36cd8ac4a9f41f`
- Generated at: `2026-05-19T08:57:31Z`
- API image: `ghcr.io/0al-spec/specspace-api@sha256:7e6b879275b1af78689cff9b49059c9e581280a5b8a95b2e767e642ce3ec0db7`
- UI image: `ghcr.io/0al-spec/specspace-ui@sha256:388651e08409216d84ef1ed43d812323d22039457369d4daefebaa95a113a78c`
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
